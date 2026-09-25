# Validation record

## Executed locally

Final result: **19 tests passed, 139 assertions**; production build and ESLint passed. The trivial scaffold unit test was removed; the remaining scaffold feature test verifies the Laravel-served application shell.

- Original repository inventory and all 15 entity schemas captured before platform removal.
- Laravel 13.33.0 installed with PHP 8.3.33; migrations applied to an empty SQLite database (also rebuilt independently through RefreshDatabase tests).
- Laravel Feature/Unit suite exercises login/logout/reset, registration verification/role injection, public retrieval, unauthorized and branch access, product CRUD, manual/guest orders, forged prices/payment states, cent rounding, modifiers, recipe changes/consumption, receiving/adjustment, transfer rollback, insufficient-stock rollback, repeated completion/restoration, refund grants, idempotent retries, pagination/export totals, imports, reports/date filters, immutable journals, audit tampering and upload validation.
- `npm run build` passes. Vite reports a large existing application bundle; route splitting is a future performance improvement.
- `npm run lint` passes after removing unused imports from migrated screens.
- Browser smoke test passed: home → product → cart → checkout → successful test order and confirmation, using the local seeded sample product. Brand colors, assets, layout and existing components were retained.
- Laravel health endpoint returns 200. Errors recorded during early manifest/import tests were resolved before final regression.

## Known limitations and checks still required

- `npm run typecheck` fails on widespread JavaScript/React forwardRef prop inference issues in the existing component library and page inference. This is not hidden or disabled; the migration does not claim a clean TypeScript check. Production bundling and ESLint are separate passing checks.
- No production data export was provided. Actual record/media migration and reconciliation are pending.
- MySQL/MariaDB has not been run on this machine; CI/target-environment testing is required, especially concurrent row-lock behavior. SQLite tests verify transaction rollback and repeated-request correctness, not MySQL contention.
- SMTP delivery, Google OAuth credentials and physical printers have not been exercised. Browser print and device pairing code are preserved.
- Full visual regression across every role, viewport and admin dialog is not claimed by the storefront smoke test.
- Remaining legacy catalog/inventory detail screens use bounded list responses; large installations need pagination there. SQL dashboard/sales reports and paginated order management no longer download a capped historical order set for totals.
