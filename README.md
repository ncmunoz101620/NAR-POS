# Nanay Asa Restaurant

Self-contained Laravel 13 backend with the existing React 18 storefront and staff UI. PHP sessions, role/module/branch authorization, relational catalog/recipes, transactional orders/inventory, reports, local uploads and manual payment confirmation replace the former hosted backend. No Base44 runtime dependency remains.

## Local setup

Requirements: PHP 8.3+, Composer 2, Node 20+, and MySQL/MariaDB or SQLite for development.

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
```

On PowerShell use `Copy-Item .env.example .env`. Set APP_URL and database/mail values in `.env`. For MySQL, first create a database (for example `CREATE DATABASE nanay_asa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`) and configure an application database user. For SQLite, create an empty `database/database.sqlite`, set `DB_CONNECTION=sqlite` and remove DB_DATABASE so Laravel uses that file.

```bash
php artisan migrate
php artisan db:seed
php artisan app:create-admin admin@example.com
php artisan storage:link
```

The administrator command securely prompts for a password. No default admin password is committed. Development/testing seeds include clearly marked sample catalog, ingredients, raw material and recipe; production seeds do not. Role defaults are starting points, not an export of the original staff permissions.

Run these in separate terminals:

```bash
npm run dev
php artisan serve --host=127.0.0.1 --port=8137
```

Open [the local app](http://127.0.0.1:8137). Alternatively run `npm run build` and serve Laravel without a Vite development server. Staff login is `/login`; the storefront is `/`. Development mail is written to `storage/logs/laravel.log`; configure SMTP before testing real delivery. New staff profiles use password-reset email to establish their password. Optional Google login needs GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI.

## Checks and deployment

```bash
php artisan test
npm run build
npm run lint
```

`npm run typecheck` is retained but currently fails on untyped React/Radix inference; see [validation](docs/VALIDATION.md). MySQL/MariaDB CI is provided, but only SQLite was executed locally. Deploy with HTTPS, production environment values, `composer install --no-dev --optimize-autoloader`, `npm ci && npm run build`, `php artisan migrate --force`, `php artisan storage:link` and `php artisan optimize`. Full instructions: [deployment](docs/DEPLOYMENT.md).

## Migration documentation

- [Original audit and phase checklist](docs/MIGRATION_AUDIT.md)
- [Architecture and business rules](docs/ARCHITECTURE.md)
- [Database and production data cutover](docs/DATABASE.md)
- [Source dependency inventory](docs/SOURCE_INVENTORY.md)
- [Executed checks and remaining limitations](docs/VALIDATION.md)

The supplied archive had no production records. Live data import/reconciliation, SMTP/Google configuration, printer acceptance and target database concurrency validation remain deployment prerequisites. The browser smoke test created one clearly named Migration Test order using seeded demo data.
