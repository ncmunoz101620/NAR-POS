# Original source inventory

Every source file was scanned for imports, platform calls, routing, browser APIs and side effects. The original ZIP remains the unchanged recovery copy.

| File | Lines | Platform call surface |
|---|---:|---|
| src\App.jsx | 129 |  |
| src\index.css | 106 |  |
| src\main.jsx | 9 |  |
| src\api\base44Client.js | 15 |  |
| src\components\AuthLayout.jsx | 24 |  |
| src\components\GoogleIcon.jsx | 13 |  |
| src\components\ProtectedRoute.jsx | 38 |  |
| src\components\ScrollToTop.jsx | 34 |  |
| src\components\StatusBadge.jsx | 14 |  |
| src\components\UserNotRegisteredError.jsx | 32 |  |
| src\components\admin\AdminIndex.jsx | 15 |  |
| src\components\admin\AdminLayout.jsx | 78 |  |
| src\components\admin\AdminSidebar.jsx | 81 |  |
| src\components\admin\BranchFilter.jsx | 19 |  |
| src\components\admin\BranchSelector.jsx | 24 |  |
| src\components\admin\DeliveryAddressPicker.jsx | 104 |  |
| src\components\admin\ImportIngredientsDialog.jsx | 324 | base44.entities.Ingredient.bulkCreate, base44.integrations.Core.ExtractDataFromUploadedFile, base44.integrations.Core.UploadFile |
| src\components\admin\IngredientInventorySummary.jsx | 232 | base44.entities.InventoryTransaction.list |
| src\components\admin\KitchenOrderCard.jsx | 69 |  |
| src\components\admin\ModuleGuard.jsx | 19 |  |
| src\components\admin\OrderDateFilter.jsx | 100 |  |
| src\components\admin\OrderDetailDialog.jsx | 243 | base44.entities.Order.update |
| src\components\admin\OrderEditDialog.jsx | 192 | base44.entities.Order.update, base44.entities.PaymentMethod.filter |
| src\components\admin\OrderExportDialog.jsx | 174 |  |
| src\components\admin\OrderSummaryCards.jsx | 77 |  |
| src\components\admin\PageHeader.jsx | 13 |  |
| src\components\admin\PrinterPanel.jsx | 169 |  |
| src\components\admin\Receipt.jsx | 52 |  |
| src\components\admin\SettingField.jsx | 18 |  |
| src\components\admin\StatCard.jsx | 26 |  |
| src\components\site\ComingSoon.jsx | 33 |  |
| src\components\site\ProductCard.jsx | 44 |  |
| src\components\site\SiteFooter.jsx | 42 |  |
| src\components\site\SiteHeader.jsx | 58 |  |
| src\components\site\SiteLayout.jsx | 34 | base44.auth.isAuthenticated, base44.auth.me |
| src\components\ui\accordion.jsx | 42 |  |
| src\components\ui\alert-dialog.jsx | 98 |  |
| src\components\ui\alert.jsx | 48 |  |
| src\components\ui\aspect-ratio.jsx | 6 |  |
| src\components\ui\avatar.jsx | 36 |  |
| src\components\ui\badge.jsx | 35 |  |
| src\components\ui\breadcrumb.jsx | 93 |  |
| src\components\ui\button.jsx | 49 |  |
| src\components\ui\calendar.jsx | 72 |  |
| src\components\ui\card.jsx | 51 |  |
| src\components\ui\carousel.jsx | 194 |  |
| src\components\ui\chart.jsx | 310 |  |
| src\components\ui\checkbox.jsx | 23 |  |
| src\components\ui\collapsible.jsx | 12 |  |
| src\components\ui\command.jsx | 117 |  |
| src\components\ui\context-menu.jsx | 157 |  |
| src\components\ui\dialog.jsx | 97 |  |
| src\components\ui\drawer.jsx | 93 |  |
| src\components\ui\dropdown-menu.jsx | 157 |  |
| src\components\ui\form.jsx | 135 |  |
| src\components\ui\hover-card.jsx | 26 |  |
| src\components\ui\image-helpers.js | 92 |  |
| src\components\ui\image.jsx | 199 |  |
| src\components\ui\input-otp.jsx | 54 |  |
| src\components\ui\input.jsx | 20 |  |
| src\components\ui\label.jsx | 17 |  |
| src\components\ui\menubar.jsx | 201 |  |
| src\components\ui\navigation-menu.jsx | 105 |  |
| src\components\ui\pagination.jsx | 101 |  |
| src\components\ui\popover.jsx | 28 |  |
| src\components\ui\progress.jsx | 24 |  |
| src\components\ui\radio-group.jsx | 30 |  |
| src\components\ui\resizable.jsx | 43 |  |
| src\components\ui\scroll-area.jsx | 39 |  |
| src\components\ui\select.jsx | 122 |  |
| src\components\ui\separator.jsx | 24 |  |
| src\components\ui\sheet.jsx | 110 |  |
| src\components\ui\sidebar.jsx | 627 |  |
| src\components\ui\skeleton.jsx | 15 |  |
| src\components\ui\slider.jsx | 22 |  |
| src\components\ui\sonner.jsx | 30 |  |
| src\components\ui\switch.jsx | 23 |  |
| src\components\ui\table.jsx | 87 |  |
| src\components\ui\tabs.jsx | 42 |  |
| src\components\ui\textarea.jsx | 19 |  |
| src\components\ui\toast.jsx | 101 |  |
| src\components\ui\toaster.jsx | 33 |  |
| src\components\ui\toggle-group.jsx | 45 |  |
| src\components\ui\toggle.jsx | 39 |  |
| src\components\ui\tooltip.jsx | 29 |  |
| src\components\ui\use-toast.jsx | 164 |  |
| src\hooks\use-mobile.jsx | 20 |  |
| src\hooks\use-size.jsx | 29 |  |
| src\lib\app-params.js | 55 |  |
| src\lib\AuthContext.jsx | 161 | base44.auth.logout, base44.auth.me, base44.auth.redirectToLogin |
| src\lib\authReturnTo.js | 34 |  |
| src\lib\brand.js | 32 |  |
| src\lib\cart.js | 54 |  |
| src\lib\datetime.js | 39 |  |
| src\lib\inventory.js | 153 | base44.entities.Ingredient.list, base44.entities.InventoryTransaction.create, base44.entities.RawMaterial.list, base44.entities.StockLedger.bulkCreate, base44.entities.StockLedger.filter, base44.entities.StockLedger.list, base44.entities.StockLedger.update |
| src\lib\PageNotFound.jsx | 75 | base44.auth.me |
| src\lib\permissions.js | 82 | base44.auth.me, base44.entities.AppUser.list, base44.entities.Role.list |
| src\lib\ph-locations.js | 35 |  |
| src\lib\pos.js | 151 | base44.auth.me, base44.entities.AppUser.list, base44.entities.AuditLog.create, base44.entities.Ingredient.list, base44.entities.InventoryTransaction.bulkCreate, base44.entities.InventoryTransaction.filter, base44.entities.Order.filter, base44.entities.Order.get, base44.entities.Order.update, base44.entities.Recipe.list, base44.entities.Setting.list, base44.entities.StockLedger.bulkUpdate, base44.entities.StockLedger.filter |
| src\lib\query-client.js | 11 |  |
| src\lib\thermalPrinter.js | 587 |  |
| src\lib\utils.js | 10 |  |
| src\pages\AdminAuditLogs.jsx | 84 | base44.entities.AuditLog.list |
| src\pages\AdminCategories.jsx | 129 | base44.entities.Category.create, base44.entities.Category.list, base44.entities.Category.update, base44.entities.Product.filter |
| src\pages\AdminDashboard.jsx | 229 | base44.entities.Ingredient.list, base44.entities.Order.list, base44.entities.Product.list |
| src\pages\AdminIngredients.jsx | 234 | base44.entities.Ingredient.create, base44.entities.Ingredient.list, base44.entities.Ingredient.update, base44.entities.InventoryTransaction.create |
| src\pages\AdminInventory.jsx | 233 | base44.auth.me, base44.entities.AppUser.list, base44.entities.Ingredient.list, base44.entities.InventoryTransaction.create, base44.entities.InventoryTransaction.list, base44.entities.RawMaterial.list, base44.entities.StockLedger.list, base44.entities.StockLedger.update |
| src\pages\AdminKitchenDisplay.jsx | 287 | base44.entities.Order.list, base44.entities.Order.subscribe |
| src\pages\AdminOrders.jsx | 371 | base44.entities.Order.delete, base44.entities.Order.list, base44.entities.Order.subscribe |
| src\pages\AdminPaymentMethods.jsx | 121 | base44.entities.PaymentMethod.create, base44.entities.PaymentMethod.delete, base44.entities.PaymentMethod.list, base44.entities.PaymentMethod.update |
| src\pages\AdminProducts.jsx | 262 | base44.entities.Category.list, base44.entities.Order.list, base44.entities.Product.create, base44.entities.Product.list, base44.entities.Product.update, base44.integrations.Core.UploadFile |
| src\pages\AdminRawMaterialReport.jsx | 251 | base44.entities.RawMaterial.list, base44.entities.StockLedger.filter |
| src\pages\AdminRawMaterials.jsx | 194 | base44.entities.RawMaterial.create, base44.entities.RawMaterial.list, base44.entities.RawMaterial.update, base44.entities.StockLedger.filter |
| src\pages\AdminRecipes.jsx | 160 | base44.entities.Ingredient.list, base44.entities.Product.list, base44.entities.Recipe.create, base44.entities.Recipe.list, base44.entities.Recipe.update |
| src\pages\AdminReports.jsx | 220 | base44.entities.Category.list, base44.entities.Ingredient.list, base44.entities.InventoryTransaction.list, base44.entities.Order.list, base44.entities.Product.list, base44.entities.Recipe.list |
| src\pages\AdminRoles.jsx | 121 | base44.entities.AppUser.filter, base44.entities.Role.create, base44.entities.Role.delete, base44.entities.Role.list, base44.entities.Role.update |
| src\pages\AdminSettings.jsx | 248 | base44.entities.Setting.create, base44.entities.Setting.list, base44.entities.Setting.update, base44.integrations.Core.UploadFile |
| src\pages\AdminStockTransfers.jsx | 230 | base44.auth.me, base44.entities.Ingredient.list, base44.entities.InventoryTransaction.bulkCreate, base44.entities.RawMaterial.list, base44.entities.StockLedger.update, base44.entities.StockTransfer.create, base44.entities.StockTransfer.list |
| src\pages\AdminUsers.jsx | 205 | base44.entities.AppUser.create, base44.entities.AppUser.delete, base44.entities.AppUser.list, base44.entities.AppUser.update, base44.entities.Role.list, base44.entities.User.list, base44.entities.User.update, base44.users.inviteUser |
| src\pages\Cart.jsx | 67 |  |
| src\pages\Checkout.jsx | 237 | base44.entities.Order.create, base44.entities.PaymentMethod.filter |
| src\pages\ForgotPassword.jsx | 77 | base44.auth.resetPasswordRequest |
| src\pages\Home.jsx | 124 | base44.entities.Category.filter, base44.entities.Product.filter |
| src\pages\Login.jsx | 136 | base44.auth.loginViaEmailPassword, base44.auth.loginWithProvider |
| src\pages\ManualOrder.jsx | 528 | base44.entities.Category.filter, base44.entities.Order.create, base44.entities.PaymentMethod.filter, base44.entities.Product.filter, base44.integrations.Core.UploadFile |
| src\pages\Menu.jsx | 86 | base44.entities.Category.filter, base44.entities.Product.filter |
| src\pages\OAuthConsent.jsx | 240 | base44.auth.isAuthenticated |
| src\pages\OrderConfirmation.jsx | 99 | base44.entities.Order.filter |
| src\pages\PostLoginRedirect.jsx | 42 | base44.entities.AppUser.list |
| src\pages\ProductDetail.jsx | 144 | base44.entities.Product.get |
| src\pages\Register.jsx | 233 | base44.auth.loginWithProvider, base44.auth.register, base44.auth.resendOtp, base44.auth.setToken, base44.auth.verifyOtp |
| src\pages\ResetPassword.jsx | 115 | base44.auth.resetPassword |
| src\pages\RoleMenuConfig.jsx | 100 | base44.entities.Role.list, base44.entities.Role.update |
| src\pages\TrackOrder.jsx | 46 | base44.entities.Order.filter |
| src\utils\index.ts | 3 |  |
