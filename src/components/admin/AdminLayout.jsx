import React, { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Menu, UserCircle2, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { useSession } from "@/lib/permissions";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/AuthContext";

export default function AdminLayout() {
  const session = useSession();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (session.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF6]">
        <div className="w-8 h-8 border-4 border-[#F8CFB1] border-t-[#EE8720] rounded-full animate-spin" />
      </div>
    );
  }

  // Built-in 'user' role is only allowed in the back office if they have a staff
  // profile (AppUser). Pure customers (no AppUser) are sent to the customer site.
  if (session.authUser?.role === "user" && !session.appUser) {
    return <Navigate to="/" replace />;
  }

  const displayName = session.appUser?.name || session.authUser?.full_name || session.authUser?.email || "Admin";

  return (
    <div className="min-h-screen bg-[#FBF6EF] flex">
      <aside className={`hidden lg:block sticky top-0 h-screen transition-all ${sidebarOpen ? "w-64" : "w-0 overflow-hidden"}`}>
        {sidebarOpen && <AdminSidebar can={session.can} roleName={session.roleName} />}
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-[#F0DFD0] flex items-center gap-3 px-4 sticky top-0 z-30">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="lg:hidden p-2 text-[#581E12]">
              <Menu className="w-5 h-5" />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-0">
              <AdminSidebar can={session.can} roleName={session.roleName} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <button
            onClick={() => setSidebarOpen((s) => !s)}
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            className="hidden lg:inline-flex p-2 rounded-lg text-[#581E12] hover:bg-[#F8CFB1]/40"
          >
            {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
          </button>
          <p className="font-bold text-[#581E12] mr-auto">Restaurant Management</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <UserCircle2 className="w-5 h-5 text-[#EE8720]" />
              <div className="leading-tight text-right hidden sm:block">
                <p className="text-sm font-bold text-[#581E12] max-w-[160px] truncate">{displayName}</p>
                <p className="text-[11px] font-semibold text-[#a8570c]">{session.roleName}</p>
              </div>
              <span className="sm:hidden text-xs font-bold bg-[#EE8720]/12 text-[#a8570c] px-2.5 py-1 rounded-full">{session.roleName}</span>
            </div>
            <button
              onClick={() => logout()}
              title="Sign out"
              className="p-2 rounded-lg text-[#581E12] hover:bg-[#F8CFB1]/40"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6 max-w-[1500px] w-full mx-auto">
          <Outlet context={session} />
        </div>
      </div>
    </div>
  );
}
