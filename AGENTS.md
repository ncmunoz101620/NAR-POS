# Working in this repository

This is a Laravel 13 / React 18 restaurant application. Read README.md and docs/ARCHITECTURE.md before changing business behavior. The original hosted-backend schemas are archived in docs/legacy-schema for migration evidence only.

Preserve the existing React UI and branding. Keep financial/order rules in OrderService and every stock mutation in InventoryService. Authorize server operations through Access/Gates; never rely on frontend visibility. Keep audit and inventory journals immutable. Do not log credentials or private payment/ID evidence.

Use PHP 8.3+, Composer, and npm. Run php artisan test, npm run build and npm run lint. The known JavaScript typecheck limitations are documented in docs/VALIDATION.md; do not hide new errors or claim that typechecking passes. Never commit .env, local databases, vendor, node_modules or uploaded customer files.

See docs/DEPLOYMENT.md for production setup. Do not seed synthetic demo data into a production environment or run destructive database refreshes against real records.
