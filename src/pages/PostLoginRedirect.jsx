import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

// Single source of truth for the post-login destination:
// built-in 'admin' → admin dashboard; built-in 'user' → admin dashboard only if
// they have a staff profile (AppUser), otherwise the customer landing page.
// Explicit ?returnTo= values are honoured by the caller before reaching here.
export default function PostLoginRedirect() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [dest, setDest] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) return;
      if (user.role !== "user") {
        if (alive) setDest("/admin");
        return;
      }
      try {
        const appUsers = await base44.entities.AppUser.list("name");
        const mine = appUsers.find((u) => (u.email || "").toLowerCase() === (user.email || "").toLowerCase());
        if (alive) setDest(mine ? "/admin" : "/");
      } catch {
        if (alive) setDest("/");
      }
    })();
    return () => { alive = false; };
  }, [user]);

  if (isLoadingAuth || !authChecked || !dest) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return <Navigate to={dest} replace />;
}