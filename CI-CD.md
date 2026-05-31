# Prism Global CI/CD Runbook

This project is hosted on Namecheap cPanel. GitHub is used as the source-control handoff. The repository contains both a cPanel deployment recipe and a GitHub Actions FTP workflow, so the live deployment path should be verified after the next push before treating either route as the only source of truth.

## Current Deployment Model

- Source branch: `main`
- Production host: Namecheap cPanel
- Production document root: `/home/priseghy/public_html`
- Deployment recipe: `.cpanel.yml`
- Possible manual deployment trigger: cPanel Git Version Control
- Possible automated deployment trigger: GitHub Actions FTP workflow on pushes to `main`
- Public site domain: `https://prismglobalservicesltd.com`

The `.cpanel.yml` file is the cPanel deployment contract. When cPanel deployment is triggered, it copies these project assets into `public_html`:

- `index.html`
- `admin.html`
- `api.php`
- `data.json`
- `favicon.svg`
- `images/`
- `api/`
- `uploads/`

## Standard Release Flow

1. Make and test changes locally.
2. Review the changed files with `git status` and `git diff`.
3. Commit the approved changes.
4. Push the commit to the remote `main` branch.
5. Check whether the GitHub Actions FTP workflow ran and whether the live site updated.
6. If the live site did not update automatically, log in to Namecheap cPanel.
7. Open **Git Version Control**.
8. Select the Prism Global repository.
9. Pull or update the repository to the latest commit from `main`.
10. Run the cPanel deployment action so `.cpanel.yml` copies files into `/home/priseghy/public_html`.
11. Verify the live site and admin page in the browser.

## Pre-Deployment Checklist

- Confirm the changed files are intentional.
- Confirm no public-facing secrets are present in HTML, JavaScript, Markdown, or JSON files.
- Confirm `admin.html` does not expose admin passwords or privileged API headers.
- Confirm `.cpanel.yml` includes every file or folder needed by the live site.
- Confirm `data.json` changes are intentional before deploying, because it can affect live listings.
- Confirm new images are present under `images/` or `uploads/` and referenced with the correct paths.

## Namecheap cPanel Deployment Steps

1. Sign in to Namecheap.
2. Open the hosting cPanel for `prismglobalservicesltd.com`.
3. Go to **Git Version Control**.
4. Open the Prism Global repository.
5. Use the cPanel control to update from the remote repository.
6. Run deployment from cPanel so the `.cpanel.yml` tasks execute.
7. Confirm cPanel reports a successful deployment.

If cPanel reports a deployment failure, inspect the deployment output first. Most failures will come from missing paths, permission issues, or a file listed in `.cpanel.yml` that no longer exists.

## Post-Deployment Verification

Check these pages after every deployment:

- `https://prismglobalservicesltd.com/`
- `https://prismglobalservicesltd.com/admin`
- `https://prismglobalservicesltd.com/api.php?action=getData`

Verify these flows:

- Homepage loads without broken images.
- WhatsApp links open with the correct phone number.
- Contact email is correct.
- Property listings render from data.
- Admin login opens only with the private admin password.
- Admin save/upload actions work after login.

## Rollback Procedure

1. Identify the last known good commit.
2. Revert the bad commit locally or create a new fix-forward commit.
3. Push the rollback/fix commit to `main`.
4. In cPanel Git Version Control, update the repository to the new commit.
5. Run the cPanel deployment action again.
6. Re-test the live site.

Avoid manually editing files directly inside `public_html` unless production is down and an emergency hotfix is required. If an emergency hotfix is made in cPanel, copy the same change back into Git immediately so the next deployment does not overwrite it.

## Auto-Deploy Verification

After pushing a harmless visible change or a planned release commit:

1. Open the repository in GitHub.
2. Go to the **Actions** tab.
3. Check whether **Deploy to Namecheap** ran for the pushed commit.
4. If it ran, confirm whether it succeeded or failed.
5. Open the live site and verify whether the pushed change appears without using cPanel.
6. If the change appears, GitHub Actions FTP deployment is active.
7. If the change does not appear, use the cPanel manual deployment steps.

## GitHub Actions Note

This repository currently contains `.github/workflows/deploy.yml`, which is an FTP deploy workflow for pushes to `main`. It may already be active if the `FTP_PASSWORD` GitHub secret is configured and the workflow is enabled.

If manual cPanel deployment is the desired long-term process, keep the GitHub workflow disabled, unconfigured, or remove it in a separate cleanup commit. If automatic deployment is desired, keep the GitHub workflow enabled and document the required secret owner. Running both FTP deployment and cPanel deployment can make production state harder to reason about.

## Ownership Rules

- Git is the source of truth.
- Namecheap cPanel is the production runtime.
- `.cpanel.yml` defines what reaches production.
- cPanel manual deployment is the release gate.
- Public docs must not include passwords, tokens, FTP credentials, API secrets, or private admin values.
