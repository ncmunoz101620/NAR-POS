# Migration audit — 2026-09-25

## Evidence and scope

Source: `nanay-asa.zip`, 15 entity schemas, 31 pages, shared UI/admin/site components and library files. The supplied pasted task is the migration instruction. The archive's Base44 development instructions describe the old deployment and do not override that task. No production records, credentials, media archive, backend functions, tests or database dump were supplied.

## Existing architecture

React 18/Vite SPA, React Router nested SiteLayout and AdminLayout routes. TanStack Query provider exists, but business pages primarily use useEffect/useState and direct SDK calls. Tailwind/Radix UI, brown/orange restaurant branding; localStorage cart keyed by product/variant/modifiers/notes. Prices and totals in the cart are display estimates only in the target system.

Public routes: `/`, `/menu`, `/product/:id`, `/cart`, `/checkout`, `/order/:orderNumber`, `/track`. Authentication: login/register/forgot-password/reset-password/login-redirect. Admin routes cover dashboard, orders, manual-order, kitchen-display, products, categories, ingredients, inventory, raw-materials, stock-transfers, recipes, reports, raw-material-report, payment-methods, users, roles, role-menu, audit-logs and settings. AdminIndex sends INVENTORY STAFF to raw-material-report.

## Authentication and authorization

SDK email/password login, registration with emailed OTP, reset requests, reset tokens, Google provider login, token bootstrap/public-app-settings. AppUser matches User by email; its role_name matches Role.name. Permissions are module/action arrays. Actions: view/create/edit/delete/export/print/approve/cancel/refund. Staff branch is All, NAR Commi or NAR Greenwoods. Existing missing staff profile fallback to ADMIN must not become a server-side privilege escalation. Inactive staff/roles must be denied on the server. OAuthConsent is an unrouted MCP platform consent page, with no MCP config; it is not an application workflow. Google sign-in is a real login option and needs an optional configured Laravel provider.

## Order/payment workflows

Guest checkout: customer/contact/address, schedule, notes, delivery fee, settings tax/minimum, active payment method and optional reference. Checkout says Takeout although schema says Pick-up: normalize to Pick-up. Manual orders: branch, source Walk-in/Grab/Meta, dine-in/table, delivery/address, future reservation, GCash Corporate/Personal, two payment proofs, discounts (senior/PWD 20%, solo_parent 10%, custom amount plus reason), ID proof. Tax applies after discount. Order edits currently omit tax when computing total: target must consistently recalculate. Product modifiers add their prices to variant price. Prices, timestamps, order number, identity and inventory flags must be server-owned. Human payment confirmation is the actual workflow; Stripe dependencies have no implementation.

Order statuses: Pending, For Reservation, Confirmed, Preparing, Ready, Out for Delivery, Completed, Cancelled, Refunded. Completion consumes recipe ingredients; cancellation/refund restores actual consumed stock. Browser-generated daily numbers race. Browser bulk writes and client histories are non-atomic. Target must lock, generate unique numbers, preserve histories, reject negative stock, and make repeated transitions idempotent. Kitchen has subscriptions plus a 15-second polling fallback, sound alerts, cook name prompt and kitchen slip. Polling is sufficient; no websocket infrastructure needed.

## Inventory and relationships

Ingredient = production inventory, RawMaterial = separate raw inventory. Recipes link a product and variant name to production Ingredient quantities; no raw-to-production conversion/BOM exists. Do not invent one. StockLedger is a mutable per-item/per-branch balance, not the historical journal. InventoryTransaction is the movement journal. Legacy migration assigns global stock to NAR Commi and zero to NAR Greenwoods. Global ingredient edit and branch balances currently drift. Target centralizes all mutations and derives aggregate stock from branch balances.

Movement types: Stock In, Sales Consumption, Waste, Adjustment, Return, Correction, Transfer In, Transfer Out. Waste/out are negative, adjustment/correction signed. Transfers execute immediately and schema allows only Pending/Completed/Cancelled; debit/credit/journal must be atomic. Recipes without a mapping currently consume nothing. Ingredient import supports local CSV parsing and hosted XLS/XLSX extraction with preview and duplicate-SKU skipping; deterministic local spreadsheet parsing replaces the extraction service.

## Reports, settings, files and printing

Dashboard: date presets/custom range, branch, valid sales excluding cancelled/refunded, average, status/source/payment/day charts, product count/low stock. Reports: daily gross/discount/refund/cancel/net, payment including GCash subtype, product/variant/category sales, inventory consumption and food cost. Existing downloads of first 500 orders/transactions silently truncate reports; move these aggregations to server queries. Raw report: balances by both branches, low-stock/reorder filters and inventory valuation. Exports use CSV and browser PDF/print, plus order PDF/image export. Thermal printing supports Web Serial/USB/Bluetooth and browser fallback; retain it and HTML escaping.

Settings cover restaurant identity, images, order types, tax/delivery/minimum, preparation, inventory threshold, receipt preferences and coming-soon screen. `deduct_on_status` exists but actual pos.js consumes only on Completed. Preserve Completed semantics until an explicit business change. UploadFile is used for product/settings images and sensitive payment/discount proofs. Use validated local storage and private proof access. Hardcoded logo and hero are hosted media and must be copied locally for independence.

AuditLog is written by the browser and spoofable; Laravel must record actor, action, module, resource and sanitized before/after values in the same transaction. No passwords/tokens/proof contents in logs.

## Entity/table map

| Entity | Target | Relationships/notes |
|---|---|---|
| User | users | Laravel credentials, staff profile, remember token, verification |
| AppUser | app_users | unique user/email, role FK and branch |
| Role | roles + role_permissions | normalized module/action grants |
| Category | categories | hasMany products, soft delete |
| Product | products + product_variants + product_modifiers | category FK; normalized variants/modifiers |
| Ingredient | ingredients | recipes and branch stock, decimal quantity/cost |
| RawMaterial | raw_materials | separate inventory type |
| Recipe | recipes + recipe_items | product/variant and ingredient FK |
| StockLedger | stock_ledgers | unique item/type/branch balance |
| InventoryTransaction | inventory_transactions | immutable movement; item/branch/order/reversal linkage |
| StockTransfer | stock_transfers | item/source/destination and status |
| Order | orders + order_items + order_item_modifiers + order_status_histories | snapshots and authoritative decimal totals |
| PaymentMethod | payment_methods | active/configuration; referenced orders |
| Setting | settings | typed schema fields, singleton |
| AuditLog | audit_logs | actor FK and sanitized historical snapshots |

All original property definitions/defaults/enums are retained as evidence in `docs/legacy-schema/` when runtime migration is complete. Detailed per-file dependency inventory accompanies this audit.

## Implementation choice

Laravel 13 supports the installed PHP 8.3 (official release notes: https://laravel.com/framework/docs/releases). MySQL/MariaDB deployment; SQLite for fast local tests. Preserve React Router and existing components with same-origin, session/CSRF-protected Laravel JSON endpoints; this is the task's permitted API alternative and avoids a disruptive full Inertia routing rewrite. Dedicated services handle orders/inventory/reports. No standalone API tokens or duplicated authentication stack.

## Checklist

Legend: [ ] Not Started; [~] In Progress; [x] Completed; [!] Blocked.

- [x] Phase 1: source audit and schema/workflow mapping
- [x] Phase 2: Laravel foundation
- [x] Phase 3: migrations/models
- [x] Phase 4: authentication implementation and local tests
- [x] Phase 5: roles/permissions
- [x] Phase 6: products/categories
- [x] Phase 7: materials/recipes
- [x] Phase 8: inventory/journal
- [x] Phase 9: orders/manual orders
- [x] Phase 10: manual payment confirmation
- [x] Phase 11: storefront and browser checkout smoke test
- [x] Phase 12: retained admin UI connected to Laravel
- [x] Phase 13: kitchen polling
- [x] Phase 14: SQL dashboard/sales/ingredient reports
- [x] Phase 15: audit/settings/uploads
- [x] Phase 16: automated local regression tests
- [x] Phase 17: remove runtime platform dependencies; archive schemas
- [~] Phase 18: local regression and documentation complete; deployment acceptance pending items below and VALIDATION.md
- [!] Production record migration requires a data export not present in the archive.
- [!] Actual email delivery, Google provider and physical printer tests require deployment configuration/hardware.
