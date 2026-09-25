# Application architecture

Laravel 13 / PHP 8.3 owns persistence, authentication, permissions, uploads and business rules. React 18, React Router, Radix, Tailwind, Recharts and the existing storefront/admin layouts are retained. Vite builds `src/main.jsx` into Laravel's public build manifest. Blade supplies the session's CSRF token. `src/api/client.js` makes same-origin JSON requests; there are no bearer tokens or hosted backend SDKs.

## Boundaries

- `AuthController`: Laravel sessions, hashed passwords, emailed registration codes, password broker and optional Google Socialite login. Staff access requires an active user, verified email, active profile and active role. Registration never grants staff permissions.
- `Access`: Gate-backed module/action authorization and branch scoping. The original module names and nine actions are retained. A missing staff profile grants no administrative access.
- `EntityRequest` / `EntityService`: allowlisted and validated catalog/configuration CRUD. Normalized product sizes/modifiers, recipe lines and role grants serialize into the existing React shapes. Server audit records are generated inside write transactions.
- `OrderRequest` / `OrderService`: server product/variant/modifier lookup, integer-cent arithmetic, settings-based tax/minimum/delivery rules, staff discount validation, unique daily numbering, request-key retries, status history and inventory coordination.
- `InventoryService`: all balance changes, receive/adjust/deduct/restore/transfer operations, item and balance row locks, journal entries and branch/global synchronization. Negative stock fails atomically.
- `ReportService`: SQL aggregates over filtered orders/items and movements; Manila calendar boundaries are converted to UTC. Dashboard/report totals are independent of display page size. Order list pagination and export use the same server filters.
- `UploadController`: random storage names, image MIME/size validation, public catalog images and private payment/discount evidence. Private files require staff authorization and applicable branch access.

## Preserved behavior and deliberate corrections

Orders consume production ingredients when completed, as the original code did. The legacy `deduct_on_status` setting is restricted to Completed because no alternate lifecycle was implemented in the source. Recipes match product plus variant name. Raw materials remain a separate inventory: no production conversion is invented. Transfers complete immediately with paired journal entries. Historical cancellation/refund restoration uses actual consumption entries, not the current recipe. Repeated completion/restoration cannot duplicate movements; refunded orders are final.

The legacy browser allowed negative stock, spoofed actors, price overrides and non-atomic journal writes. Those are replaced by server validation. Checkout's Takeout label maps to the original schema's Pick-up value. Public tracking requires the original session, account ownership or an unpredictable tracking code; sequential order numbers alone no longer expose customer addresses. Public orders always start Unpaid. Manual payment confirmation is a staff operation, not proof of a provider payment. Stripe was unused and is removed.

Kitchen alerts and printing are retained, with 15-second polling. The order list also polls. No broadcasting server is needed. Printing remains browser/WebUSB/Web Serial/Web Bluetooth work and needs supported hardware/browser permissions. The unrouted platform MCP consent page is removed. Google login remains optional; configure its client credentials before use.

CSV/XLS/XLSX ingredient import uses a local SheetJS parser, preview and Laravel validation; no AI extraction or uploaded spreadsheet service is required. The locked dependency comes from the [official SheetJS distribution](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).

## Operational limits

Stock is checked when an order is created and deducted at completion, matching the source workflow. Pending orders do not reserve stock; a competing order can therefore cause completion to fail with an insufficient-stock error. Do not represent the availability check as a reservation system.

Catalog and legacy inventory detail lists retain bounded responses (up to 5,000 rows); summary reports and order exports do not inherit the original 500-order limit. For larger catalogs/movement histories, paginate those remaining screens before rollout. Browser export/print permissions cannot prevent a reader from manually copying information already authorized for display.

Infrastructure secrets belong in environment configuration. No unnecessary queues, schedulers or external payment services have been introduced; email uses the configured Laravel mailer synchronously.
