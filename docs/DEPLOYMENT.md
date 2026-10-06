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

The only scheduled job is the daily sales report. It sends email synchronously through the configured Laravel mailer; no queue worker is required. If queued email is introduced later, configure a supervised queue worker. Local public uploads use Laravel's public disk; private evidence uses the local private disk. For object storage, adapt those configured disks with the Flysystem S3 adapter and private-object delivery; do not expose the private disk publicly.

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

