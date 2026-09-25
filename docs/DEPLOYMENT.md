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
7. Run the staging regression suite, verify `/up`, test email verification/reset, Google login if enabled, staff role/branch isolation, a checkout, completion/cancellation, transfers, reports, file access and actual printers. Remove demo catalog/QA data from any development copy used as a starting point.

There are no scheduled jobs or required workers in this implementation. If queued email is introduced later, configure a supervised queue worker. Local public uploads use Laravel's public disk; private evidence uses the local private disk. For object storage, adapt those configured disks with the Flysystem S3 adapter and private-object delivery; do not expose the private disk publicly.

## Google and email

Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI to the registered `/auth/google/callback` URL. The provider must return a verified email. Leave Google credentials empty to use email/password login. The development `log` mailer writes verification codes and password setup/reset links to the local Laravel log; use a real mail transport and restrict log access in production.

## Rollback and verification status

Roll back the application artifact and restore tested database/storage backups together if a schema/data rollback is needed. Do not run destructive migrate:fresh against real data. Migrations and tests were run against SQLite locally; MySQL/MariaDB acceptance and multi-process contention tests must run in the target environment. The supplied CI workflow includes MariaDB testing.

Do not call this production-accepted until actual data reconciliation, target database testing, email/provider configuration and hardware printing checks are complete. See VALIDATION.md for the checks actually run.
