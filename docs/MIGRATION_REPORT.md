# Migration delivery

## Implemented

Laravel 13.33 / PHP 8.3 with MySQL/MariaDB configuration and SQLite local tests. The existing React 18 UI, React Router, styling, charts, forms, receipt and kitchen printing components are retained. Same-origin Laravel JSON endpoints were chosen instead of an Inertia routing rewrite to preserve the application navigation.

Migrated modules: authentication (email/password, verification, reset and optional Google), staff/roles/module grants, categories/products/variants/modifiers, ingredients/raw materials/recipes, branch stock and immutable movement journal, atomic transfers, online/manual orders, discounts/tax/payment confirmation, kitchen polling, dashboard/reports, settings, audit logs and validated image uploads. Sensitive evidence uses private storage. Product, category, recipe, order, permission and history arrays are normalized into related tables.

There are **25 application/authentication tables** and Laravel's cache, sessions, password-reset, queue and migration tables. The complete list and relationships are in DATABASE.md. `app/Services`, `app/Http/Controllers`, `app/Http/Requests`, `app/Models`, `database/migrations`, `database/seeders`, `routes`, `src/api/client.js` and the connected React workflows contain the implementation.

Removed the hosted SDK/Vite plugin, token bootstrap, hosted public-settings authentication, unrouted MCP consent page, client-authoritative order/inventory mutations, unused Stripe packages and remote brand/icon dependencies. Original schemas are archived in docs/legacy-schema; the original source is preserved in Git history and the supplied ZIP remains untouched.

## Verification

- 19 automated tests pass, with 139 assertions.
- Frontend production build passes; ESLint passes.
- Empty-database SQLite migrations, development seeders and Laravel health checks pass.
- Browser storefront → product → cart → checkout → confirmation smoke test passes with seeded demo data.
- Runtime source/package scan finds no Base44 references.

Tests cover authentication, verification, password reset, role and branch denial, CRUD, server pricing/modifiers, discounts/tax, payment/refund authority, recipe consumption, insufficient-stock rollback, receiving/adjustment, transfers, restoration/idempotency, imports, report totals/date filters, paginated orders/export grants, immutable journals and upload rejection.

## Remaining acceptance work

This is an operational local migration, **not a claim of completed production acceptance**. No production data export was supplied. Reconcile/import actual records and media before cutover. MySQL/MariaDB and concurrent-lock behavior need target-environment testing (CI is provided). Real mail delivery, Google credentials and physical printers need configuration and acceptance tests. Broad visual regression across all admin roles/dialogs remains a staging task. Existing JS/Radix inference errors still fail `npm run typecheck`; the check remains enabled. Some catalog/inventory detail lists are bounded and need pagination for very large installations. See VALIDATION.md.

## Run and deploy

See README.md for `composer install`, `npm install`, `.env`, key generation, database creation/migration/seeding, safe administrator creation, storage linking and development startup. The current local preview is http://127.0.0.1:8137. Production steps, HTTPS, permissions, mail/provider settings, backups and rollback are in DEPLOYMENT.md. Do not deploy synthetic demo data or the local QA order as production records.
