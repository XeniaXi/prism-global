# Prism Global Admin Audit and Video Recovery

The admin keeps the original password-only login. No username is required.

The production API records login attempts, uploads, saves, conflicts, video attachment/update/deletion, and logout events in:

`/home/priseghy/prism-private/audit-log.jsonl`

This file is outside `public_html` and must remain private.

Because all administrators use the same password, the audit identifies actions as **Shared admin**. It also records the session timestamp, IP address, browser details, event, and affected file or record. It cannot prove which person was using the shared password.

## Recover an uploaded but unattached video

1. Sign in to `/admin.html` with the original admin password.
2. Open **Videos**.
3. Check **Uploaded files not attached to a video**.
4. Select **Attach to a video**.
5. Add a clear title and save.

A video upload is logged immediately. The uploaded file is preserved when its video record is deleted, allowing accidental record deletion to be recovered.

## Concurrency behaviour

Every general data save includes a revision. If another admin saves first, the second admin receives a conflict message and must reload. This prevents silent whole-file overwrites.

Video add, update, and delete operations use server-side locked mutations and do not replace the entire data file.
