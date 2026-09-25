import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

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

/**
 * Resolves the logged-in user's role from their AppUser record (matched by email).
 * The role is locked to the account — it cannot be switched from the UI.
 * Users without an AppUser record (e.g. the app owner) default to the ADMIN role.
 */
export function useSession() {
  const [authUser, setAuthUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [role, setRole] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await base44.auth.me();
        if (!alive) return;
        setAuthUser(me);
        const [allRoles, appUsers] = await Promise.all([
          base44.entities.Role.list("name"),
          base44.entities.AppUser.list("name"),
        ]);
        if (!alive) return;
        const mine = appUsers.find((u) => (u.email || "").toLowerCase() === (me.email || "").toLowerCase());
        // Built-in 'user' role with no staff profile = customer → no back-office
        // access (can() stays false, admin layout redirects them away). A 'user'
        // who does have a staff profile is admitted with their app role.
        if (me?.role === "user" && !mine) {
          setLoading(false);
          return;
        }
        const roleName = mine?.role_name || "ADMIN";
        setAppUser(mine);
        setRoles(allRoles);
        setRole(allRoles.find((r) => r.name === roleName) || null);
      } catch (e) {
        // not logged in — leave role null
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const can = (moduleKey, action = "view") => {
    if (!role) return false;
    const entry = (role.permissions || []).find((p) => p.module === moduleKey);
    return !!entry && (entry.actions || []).includes(action);
  };

  const roleName = role?.name || appUser?.role_name || "";

  return { roleName, role, roles, loading, can, authUser, appUser };
}