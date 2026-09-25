import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ReceiptText, MonitorSmartphone, UtensilsCrossed, Tags, Carrot,
  Boxes, BookOpen, BarChart3, CreditCard, Users, Shield, ListChecks, ScrollText, Settings, ChefHat, Wheat, ArrowLeftRight, Warehouse,
} from "lucide-react";
import { MODULES } from "@/lib/permissions";
import { LOGO_URL } from "@/lib/brand";

const ICONS = {
  dashboard: LayoutDashboard, orders: ReceiptText, manual_order: MonitorSmartphone, kitchen: ChefHat,
  products: UtensilsCrossed, categories: Tags, ingredients: Carrot, raw_materials: Wheat, inventory: Boxes,
  stock_transfers: ArrowLeftRight, recipes: BookOpen, reports: BarChart3, raw_material_reports: Warehouse, payment_methods: CreditCard, users: Users,
  roles: Shield, role_menu: ListChecks, audit_logs: ScrollText, settings: Settings,
};

const GROUPS = ["Main", "Sales", "Menu", "Inventory", "Administration"];

export default function AdminSidebar({ can, roleName, onNavigate }) {
  const { pathname } = useLocation();
  const visible = MODULES.filter((m) => can(m.key, "view"));
  const showPrinter = ["CSR", "RND COOK"].includes((roleName || "").toUpperCase());

  return (
    <div className="h-full flex flex-col bg-[#581E12] text-[#F8CFB1] w-64">
      <Link to="/admin" className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
        <img src={LOGO_URL} alt="logo" className="h-9 w-9 object-contain bg-white rounded-full p-0.5" />
        <div className="leading-4">
          <p className="font-extrabold text-white text-sm">Nanay Asa</p>
          <p className="text-[10px] tracking-widest text-[#EE8720] font-semibold">BACK OFFICE</p>
        </div>
      </Link>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5 sidebar-no-scrollbar">
        {GROUPS.map((g) => {
          const items = visible.filter((m) => m.group === g);
          if (!items.length) return null;
          return (
            <div key={g}>
              <p className="px-3 pb-2 text-[10px] font-bold tracking-[0.18em] text-[#F8CFB1]/45 uppercase">{g}</p>
              <div className="space-y-1">
                {items.map((m) => {
                  const Icon = ICONS[m.key] || LayoutDashboard;
                  const active = pathname === m.path;
                  return (
                    <Link
                      key={m.key}
                      to={m.path}
                      onClick={onNavigate}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        active ? "bg-[#EE8720] text-white shadow" : "hover:bg-white/10 text-[#F8CFB1]"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {m.label}
                    </Link>
                  );
                })}
                {g === "Sales" && showPrinter && (
                  <Link
                    to="/admin/settings"
                    onClick={onNavigate}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      pathname === "/admin/settings" ? "bg-[#EE8720] text-white shadow" : "hover:bg-white/10 text-[#F8CFB1]"
                    }`}
                  >
                    <Settings className="w-4 h-4 shrink-0" />
                    Printer Settings
                  </Link>
                )}
              </div>
            </div>
          );
        })}
        {!visible.length && <p className="px-3 text-sm text-[#F8CFB1]/60">No modules assigned to this role.</p>}
      </nav>
      <Link to="/" className="px-5 py-4 text-xs border-t border-white/10 hover:text-white">
        ← Back to customer site
      </Link>
    </div>
  );
}