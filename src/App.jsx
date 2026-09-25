import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import PostLoginRedirect from '@/pages/PostLoginRedirect';
// Add page imports here
import SiteLayout from '@/components/site/SiteLayout';
import AdminLayout from '@/components/admin/AdminLayout';
import Home from '@/pages/Home';
import Menu from '@/pages/Menu';
import ProductDetail from '@/pages/ProductDetail';
import Cart from '@/pages/Cart';
import Checkout from '@/pages/Checkout';
import OrderConfirmation from '@/pages/OrderConfirmation';
import TrackOrder from '@/pages/TrackOrder';
import AdminIndex from '@/components/admin/AdminIndex';
import AdminOrders from '@/pages/AdminOrders';
import AdminKitchenDisplay from '@/pages/AdminKitchenDisplay';
import ManualOrder from '@/pages/ManualOrder';
import AdminProducts from '@/pages/AdminProducts';
import AdminCategories from '@/pages/AdminCategories';
import AdminIngredients from '@/pages/AdminIngredients';
import AdminInventory from '@/pages/AdminInventory';
import AdminRawMaterials from '@/pages/AdminRawMaterials';
import AdminStockTransfers from '@/pages/AdminStockTransfers';
import AdminRecipes from '@/pages/AdminRecipes';
import AdminReports from '@/pages/AdminReports';
import AdminRawMaterialReport from '@/pages/AdminRawMaterialReport';
import AdminPaymentMethods from '@/pages/AdminPaymentMethods';
import AdminUsers from '@/pages/AdminUsers';
import AdminRoles from '@/pages/AdminRoles';
import RoleMenuConfig from '@/pages/RoleMenuConfig';
import AdminAuditLogs from '@/pages/AdminAuditLogs';
import AdminSettings from '@/pages/AdminSettings';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order/:orderNumber" element={<OrderConfirmation />} />
        <Route path="/track" element={<TrackOrder />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/login-redirect" element={<PostLoginRedirect />} />
      <Route path="/admin" element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminIndex />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="kitchen-display" element={<AdminKitchenDisplay />} />
          <Route path="manual-order" element={<ManualOrder />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="ingredients" element={<AdminIngredients />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="raw-materials" element={<AdminRawMaterials />} />
          <Route path="stock-transfers" element={<AdminStockTransfers />} />
          <Route path="recipes" element={<AdminRecipes />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="raw-material-report" element={<AdminRawMaterialReport />} />
          <Route path="payment-methods" element={<AdminPaymentMethods />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="roles" element={<AdminRoles />} />
          <Route path="role-menu" element={<RoleMenuConfig />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App