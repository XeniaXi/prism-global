# Prism Global Admin Identity and Audit Setup

The production API now records login, upload, save, conflict, video attach/update/delete, and logout events in:

`/home/priseghy/prism-private/audit-log.jsonl`

This path is outside `public_html` and must remain private.

## Configure separate admin credentials

Until named credentials are configured, the existing shared password still works with a claimed username. This compatibility mode improves visibility but does not prove identity because people still know the same secret.

For reliable attribution, create:

`/home/priseghy/prism-private/admin-users.json`

Use one entry per person:

```json
{
  "sid": {
    "password_hash": "$2y$REPLACE_WITH_A_PASSWORD_HASH"
  },
  "operations": {
    "password_hash": "$2y$REPLACE_WITH_A_DIFFERENT_PASSWORD_HASH"
  }
}
```

Generate each hash from the cPanel terminal without putting the password in Git:

```bash
php -r "echo password_hash('CHOOSE-A-UNIQUE-PASSWORD', PASSWORD_DEFAULT), PHP_EOL;"
```

Set file permissions so only the cPanel account can read it:

```bash
chmod 600 /home/priseghy/prism-private/admin-users.json
chmod 700 /home/priseghy/prism-private
```

After the file exists, the legacy shared password is automatically disabled. Each admin must use their own username and password.

## Recover an uploaded but unattached video

1. Sign in to `/admin.html`.
2. Open **Videos**.
3. Check **Uploaded files not attached to a video**.
4. Select **Attach to a video**.
5. Add a clear title and save.

The uploaded file is preserved when a video record is deleted, so an accidental record deletion can also be recovered.

## Concurrency behaviour

Every general data save includes a revision. If another admin saves first, the second admin receives a conflict message and must reload. This prevents silent whole-file overwrites.

Video add, update, and delete operations use server-side locked mutations and do not replace the entire data file.
