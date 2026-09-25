import { useEffect, useState } from "react";
import { api } from "@/api/client";

export const MODULES = [
  { key: "dashboard", label: "Dashboard", group: "Main", path: "/admin" },
  { key: "reports", label: "Reports", group: "Main", path: "/admin/reports" },
  { key: "raw_material_reports", label: "Raw Material Report", group: "Inventory", path: "/admin/raw-material-report" },
  { key: "orders", label: "Orders", group: "Sales", path: "/admin/orders" },
  { key: "manual_order", label: "Manual Order", group: "Sales", path: "/admin/manual-order" },
  { key: "kitchen", label: "Kitchen Display", group: "Sales", path: "/admin/kitchen-display" },
  { key: "products", label: "Products", group: "Menu", path: "/admin/products" },
  { key: "categories", label: "Categories", group: "Menu", path: "/admin/categories" },
  { key: "ingredients", label: "Ingredients", group: "Inventory", path: "/admin/ingredients" },
  { key: "raw_materials", label: "Raw Materials", group: "Inventory", path: "/admin/raw-materials" },
  { key: "inventory", label: "Inventory", group: "Inventory", path: "/admin/inventory" },
  { key: "stock_transfers", label: "Stock Transfers", group: "Inventory", path: "/admin/stock-transfers" },
  { key: "recipes", label: "Recipes", group: "Inventory", path: "/admin/recipes" },
  { key: "payment_methods", label: "Payment Methods", group: "Administration", path: "/admin/payment-methods" },
  { key: "users", label: "Users", group: "Administration", path: "/admin/users" },
  { key: "roles", label: "Roles", group: "Administration", path: "/admin/roles" },
  { key: "role_menu", label: "Role Menu Config", group: "Administration", path: "/admin/role-menu" },
  { key: "audit_logs", label: "Audit Logs", group: "Administration", path: "/admin/audit-logs" },
  { key: "settings", label: "Settings", group: "Administration", path: "/admin/settings" },
];

export const ACTIONS = ["view", "create", "edit", "delete", "export", "print", "approve", "cancel", "refund"];

export function useSession() {
 const [me,setMe]=useState(null),[loading,setLoading]=useState(true);
 useEffect(()=>{api.auth.me().then(setMe).catch(()=>setMe(null)).finally(()=>setLoading(false));},[]);
 const role=me?.staff_role, appUser=me?.app_user;
 const can=(module,action='view')=>!!role?.is_active && !!appUser?.is_active && !!role.permissions?.find(p=>p.module===module)?.actions?.includes(action);
 return {roleName:role?.name || '',role,roles:role?[role]:[],loading,can,authUser:me,appUser};
}
