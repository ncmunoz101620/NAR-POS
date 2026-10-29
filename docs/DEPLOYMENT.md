# Deployment

## Prerequisites

PHP 8.3+, Composer 2, Node 20+, MySQL 8/MariaDB with InnoDB, HTTPS and a configured mail service. Laravel's standard required extensions plus PDO MySQL, mbstring, XML, curl, fileinfo, bcmath and zip should be available. SQLite/PDO SQLite is supported for local development and isolated tests.

Point the web server document root at `public/`, never the repository root. Configure all non-file routes to `public/index.php`. The included `.htaccess` supports Apache. Grant writes only to `storage` and `bootstrap/cache`. Keep `.env`, database backups and private uploads out of the document root.

## Release steps

1. Back up the database and both upload disks. Prepare and verify a data import before migrating a live installation.
2. Run `composer install --no-dev --prefer-dist --optimize-autoloader` and `npm ci`.
3. Copy `.env.example` to `.env`, set APP_URL/DB/MAIL values, set `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, `SESSION_ENCRYPT=true`. Generate an APP_KEY once with `php artisan key:generate`; preserve it on later releases.
4. Create the named MySQL database and a least-privilege application user. Run `php artisan migrate --force`, then `php artisan db:seed --force`. Production seeds create roles, settings and payment methods only, not demo products or credentials.
5. Run `php artisan app:create-admin administrator@example.com`. The password is entered at a hidden prompt, not in the command line, source code or environment file.
6. Run `php artisan storage:link`, `npm run build`, `php artisan optimize`. Deploy the resulting public/build directory with its manifest.
7. Configure the server cron to run Laravel's scheduler every minute: `* * * * * cd /path/to/app && php artisan schedule:run >> /dev/null 2>&1`. The daily sales report uses this scheduler and sends at 8:00 AM Manila time.
8. Run the staging regression suite, verify `/up`, test email verification/reset, Google login if enabled, staff role/branch isolation, a checkout, completion/cancellation, transfers, reports, file access and actual printers. Remove demo catalog/QA data from any development copy used as a starting point.

The only scheduled job is the daily sales report. It sends email synchronously through the selected Laravel mailer or Gmail API delivery mode; no queue worker is required. If queued email is introduced later, configure a supervised queue worker. Local public uploads use Laravel's public disk; private evidence uses the local private disk. For object storage, adapt those configured disks with the Flysystem S3 adapter and private-object delivery; do not expose the private disk publicly.

## Google and email

Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI to the registered `/auth/google/callback` URL. The provider must return a verified email. Leave Google credentials empty to use email/password login. The development `log` mailer writes verification codes and password setup/reset links to the local Laravel log; use a real mail transport and restrict log access in production.

## Rollback and verification status

Roll back the application artifact and restore tested database/storage backups together if a schema/data rollback is needed. Do not run destructive migrate:fresh against real data. Migrations and tests were run against SQLite locally; MySQL/MariaDB acceptance and multi-process contention tests must run in the target environment. The supplied CI workflow includes MariaDB testing.

Do not call this production-accepted until actual data reconciliation, target database testing, email/provider configuration and hardware printing checks are complete. See VALIDATION.md for the checks actually run.

## Production data transfer

After the GoDaddy database has been migrated, move the locally imported Base44 data with the application data export/import commands instead of editing production tables manually.

On the local machine, create the export file:

```bash
php artisan app:data-export exports/nanayasa-production-data.json --pretty
```

Upload the generated file from `storage/app/private/exports/nanayasa-production-data.json` to the production server, for example into `storage/app/private/imports/`.

On GoDaddy, back up the MySQL database first, then validate the file without writing:

```bash
cd /home/khw2ft6zoaa3/public_html/nanayasa.ph
php artisan app:data-import imports/nanayasa-production-data.json --dry-run
```

When the counts look correct, replace the seeded production data with the exported application data:

```bash
php artisan app:data-import imports/nanayasa-production-data.json --force
php artisan optimize
```

The import command intentionally requires `--force` before it deletes existing application data. It excludes transient framework tables such as sessions, cache, jobs, password reset tokens and email verification codes. Uploaded files are not embedded in the JSON; copy `storage/app/public`, `storage/app/private`, and refresh `public/storage` separately when migrated records reference uploaded images or private evidence.

SKU conflicts: SQLite exports may contain SKUs that differ only by case or trailing spaces. The importer now stops before writing and lists proposed suffixes. Preview with --dry-run --resolve-sku-conflicts, then add --resolve-sku-conflicts to the actual import only after reviewing the changes. All rows and IDs are preserved. This check covers case and trailing-space collisions, not every possible MySQL collation equivalence; MySQL acceptance remains required.


## Admin domain entry

Point admin.nanayasa.ph to the same public directory and install a valid certificate before staff sign in. Its root redirects to /login, including React navigation, while other hosts keep their storefront. Configure ADMIN_HOST and ADMIN_GOOGLE_REDIRECT_URI if changing the admin hostname. Add https://admin.nanayasa.ph/auth/google/callback to the Google OAuth client's authorized redirect URIs. The existing GOOGLE_REDIRECT_URI continues to serve other hosts. Keep SESSION_DOMAIN=null for separate host sessions and SESSION_SECURE_COOKIE=true with HTTPS. This entry-page change does not restrict all storefront/admin paths by host; existing server permissions remain enforced.

## Base44 CSV refresh

`php scripts/prepare-base44.php archive.zip private-output-directory` prepares a portable JSON export without changing the connected database. Run against the migrated local schema. The adapter reads the named entity CSVs directly from the ZIP, maps source IDs to deterministic UUIDs, normalizes child arrays, and validates references and unique keys. Existing local password hashes are reused only for matching staff emails. Other accounts require Google login or password setup; Base44 authentication credentials are not in these CSVs.

The migration policy, approved for this refresh, keeps missing item/category references as inactive archived records, retains the latest dated duplicate branch balance, and suffixes duplicate SKUs and order numbers. All source records remain in the original private archive; the report retains the discarded duplicate balances and the original-to-new ID map. Negative stock, source financial values, and source inventory flags are preserved. Historical returns without reversal IDs and duplicate order-number transaction links require later review. Media URLs are retained; media files are not downloaded by this adapter.

Validate the result in a new isolated SQLite file with `php scripts/verify-data-transfer.php absolute-export-path new-staging.sqlite`. This compares every exported field, table count, and foreign key; it does not replace production MySQL acceptance. Keep the output, archive, and databases outside Git and the public document root.

For the live cutover, update the application code, upload the final JSON to `storage/app/private/imports`, and run a dry run. Put the site in maintenance mode, take a production database backup, then run the replacement import. Use `&&` between the backup and import so a failed backup stops the cutover. The import clears old database sessions, email codes, and password-reset tokens because user IDs may change. After successful import, optimize and bring the site up. If import fails, it rolls back transactional tables; keep the backup and inspect the error before retrying. Do not re-run migrations with `fresh` or seed demo records.


Customer entry redirects: /admin and /login on CUSTOMER_HOST (default nanayasa.ph) redirect to https://ADMIN_HOST/ (default admin.nanayasa.ph), on both direct requests and React navigation. Local login and the admin domain login remain available. Clear cached routes and views after deploying this change. Other paths retain their existing behavior.


## Report email delivery

Daily reports require a delivery mailer. The log/array transports only record messages; reports reject these, including fallback chains containing them. A submitted report means the transport accepted it, not that it reached each inbox. Transport failures return a safe error rather than provider diagnostics that may contain private details.

For a Google Workspace mailbox with app passwords permitted, enable 2-Step Verification and create a dedicated app password. Configure production privately (never commit credentials):

```dotenv
MAIL_MAILER=smtp
MAIL_SCHEME=smtps
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_USERNAME=main@nanayasa.ph
MAIL_PASSWORD="REPLACE_WITH_GOOGLE_APP_PASSWORD"
MAIL_FROM_ADDRESS=main@nanayasa.ph
MAIL_FROM_NAME="Nanay Asa Restaurant"
```

Remove any old MAIL_URL override. Use the actual mailbox account for authentication; an alias alone cannot authenticate. Refresh cached configuration with `php artisan config:cache` after saving. Test via Settings > Reports and check receipt. If app passwords are unavailable, ask the Workspace administrator to configure an approved SMTP relay or OAuth integration. If connection times out, ask the hosting provider whether outbound Google SMTP is permitted. Do not disable certificate verification. Inspect Google Workspace Email Log Search for accepted messages that do not arrive.

Google documentation: https://support.google.com/a/answer/176600 and https://support.google.com/accounts/answer/185833.

### Gmail API for the daily sales report

The daily sales report can use the Gmail API independently of Laravel's default mailer. This is suitable for the Google Workspace mailbox `main@nanayasa.ph` when outbound SMTP is unavailable. Other application emails, such as registration and password reset, still use `MAIL_MAILER` and need their own working mail transport.

1. In a Google Cloud project owned by the Workspace organization, enable the Gmail API and create a service account with domain-wide delegation enabled. Create a JSON key for that service account. Keep the key private; never place it under `public/`, commit it, or paste it into a support message.
2. A Workspace super administrator must go to **Admin console → Security → Access and data control → API controls → Manage Domain Wide Delegation → Add new**. Enter the service account's **numeric client ID** and grant only `https://www.googleapis.com/auth/gmail.send`. The sender must be an actual Workspace mailbox, not merely an alias.
3. Put the JSON key in a private, readable path outside the web root, for example `/home/khw2ft6zoaa3/gmail-report-service-account.json`, readable only by the hosting account. Install the updated Composer dependencies with `composer install --no-dev --prefer-dist --optimize-autoloader`.
4. Set these production environment values privately:

   ```dotenv
   DAILY_REPORT_DELIVERY=gmail_api
   GMAIL_REPORT_SENDER=main@nanayasa.ph
   GMAIL_SERVICE_ACCOUNT_KEY_FILE=/home/khw2ft6zoaa3/gmail-report-service-account.json
   ```

5. Run `php artisan optimize:clear` and `php artisan optimize`, then use **Settings → Reports → Send test report now**. A successful test means Gmail accepted the message; check the recipient inbox and Workspace Email Log Search for delivery. The automatic report still requires the scheduler cron described above.

Google's [Gmail sending guide](https://developers.google.com/workspace/gmail/api/guides/sending), [service-account delegation guide](https://developers.google.com/identity/protocols/oauth2/service-account), and [messages.send reference](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send) describe this flow. If Google rejects delegation, verify the numeric client ID, `gmail.send` scope, Gmail API enablement, and sender mailbox before retrying. Do not send the JSON key or OAuth tokens to support.

### Keyless Gmail API when service-account keys are blocked

If Google Cloud enforces `iam.disableServiceAccountKeyCreation`, leave that organization policy in place. Use the dedicated `gmail_oauth` report delivery mode instead. The mailbox `main@nanayasa.ph` authorizes the app once; a refresh token lets the daily scheduler send without a person present. This mode does not use a service-account JSON key or domain-wide delegation.

1. Enable Gmail API in the Google Cloud project. Under **Google Auth Platform → Clients**, open the existing `NAR POS` Web application OAuth client and **add** `https://admin.nanayasa.ph/reports/gmail/callback` to its authorized redirect URIs; keep the existing login callback URI. The report connection uses the existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. A separate OAuth client is optional; if used, set `GMAIL_OAUTH_CLIENT_ID` and `GMAIL_OAUTH_CLIENT_SECRET` privately instead.
2. In **Google Auth Platform → Audience**, use **Internal** if the project is owned by the `nanayasa.ph` Workspace organization and that option is available. An External app left in **Testing** issues refresh tokens that expire after seven days for Gmail scopes; publishing to production may involve Google's verification requirements. Do not rely on a Testing token for the daily schedule.
3. Deploy the code, run `composer install --no-dev --prefer-dist --optimize-autoloader` and `php artisan migrate --force`, then set these values in the production `.env`:

   ```dotenv
   DAILY_REPORT_DELIVERY=gmail_oauth
   GMAIL_REPORT_SENDER=main@nanayasa.ph
   GMAIL_REPORT_REDIRECT_URI=https://admin.nanayasa.ph/reports/gmail/callback
   ```

4. Run `php artisan optimize:clear` and `php artisan optimize`. Log in to `https://admin.nanayasa.ph` with a user who can edit Settings. Open **Settings → Reports → Connect Gmail**, choose `main@nanayasa.ph`, and approve the requested send-only Gmail scope. The app checks that the Google account matches the configured sender and stores the refresh token encrypted in the database using `APP_KEY`. No JSON key or copied refresh token is needed. If the connection later expires or is revoked, use **Reconnect Gmail**.
5. When Settings shows **Connected: main@nanayasa.ph**, save report recipients and use **Send test report now**. A successful response means Gmail accepted the message; check delivery in the recipient inbox and Workspace Email Log Search. The 8:00 AM schedule still requires the cron entry described above.

Google references: [OAuth offline access and refresh-token expiry](https://developers.google.com/identity/protocols/oauth2/), [Gmail's `gmail.send` scope](https://developers.google.com/workspace/gmail/api/auth/scopes), and [Web application redirect URIs](https://developers.google.com/identity/protocols/oauth2/web-server).
