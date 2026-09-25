# Database

The immutable schema evidence is in `docs/legacy-schema`. `config/entities.php` contains validation metadata; actual tables are explicitly declared in Laravel migrations. Do not rerun migration-generation scripts over edited application models.

## Tables

Application tables:

`users`, `roles`, `role_permissions`, `app_users`, `categories`, `products`, `product_variants`, `product_modifiers`, `ingredients`, `raw_materials`, `recipes`, `recipe_items`, `payment_methods`, `settings`, `orders`, `order_items`, `order_item_modifiers`, `order_status_histories`, `stock_ledgers`, `inventory_transactions`, `stock_transfers`, `audit_logs`, `order_sequences`, `email_codes`, `uploaded_assets`.

Laravel infrastructure tables: `migrations`, `password_reset_tokens`, `sessions`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`.

Domain records use UUID primary keys compatible with the React string-ID comparisons. Users use Laravel integer IDs. Staff profiles have user and role foreign keys; the legacy role_name is maintained for UI compatibility. Email, role/payment names, SKUs, order numbers, tracking tokens and idempotency keys have uniqueness constraints where appropriate. Product variants are unique within product; recipes within product/variant; grants within role/module/action; balances within item/type/branch. Indexed branches/statuses/dates support common filters.

Money is DECIMAL(15,2); inventory quantities and balances are DECIMAL(15,3). Server financial calculations use integer cents before writing decimals. API numeric casts preserve existing JavaScript rendering. Timestamps are UTC; reporting boundaries use Asia/Manila.

Product variants/modifiers, recipes/items, orders/items/modifiers/histories and role permissions are normalized tables. Order product names and unit prices are historical snapshots. Inventory tables retain compatibility item IDs/types plus constrained production_id/raw_material_id references. Exactly one applicable item reference is assigned by InventoryService. Inventory journals and audit records reject updates/deletes through their models and public endpoints. Production database credentials should also deny arbitrary journal edits outside approved administration.

Categories, products and ingredients retain legacy soft-delete fields. Orders use archived deleted_at records so journal and order history survive removal. Stock restoration uses the immutable original consumption entries; reversal_of is unique to prevent double restoration.

## Existing production data

The ZIP contains schemas and code only. It contains no actual categories, products, staff, roles, balances, orders or asset inventory. Development seed data is explicitly synthetic. Do not replace a live database with it.

Before cutover: export every entity, including deleted rows and record IDs; export auth user emails and require password setup/reset (password hashes cannot be assumed portable); preserve order item/status snapshots; reconcile aggregate and per-branch inventory; map existing IDs to UUIDs; normalize child arrays; migrate media to owned storage; validate foreign keys, row counts, payment totals and stock balances. Dry-run on a staging copy, freeze legacy writes for the final export, reconcile again and keep rollback backups. An import mapping cannot be finalized without the actual export shape and records.
