import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ComingSoon from "@/components/site/ComingSoon";
import { loadSettings } from "@/lib/pos";
import { api } from "@/api/client";

export default function SiteLayout() {
  const [settings, setSettings] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadSettings().then(setSettings);
    api.auth.isAuthenticated().then((authed) => {
      if (!authed) return setIsAdmin(false);
      api.auth.me().then((u) => setIsAdmin(u?.role === "admin")).catch(() => setIsAdmin(false));
    });
  }, []);

  if (settings?.coming_soon_enabled && !isAdmin) {
    return <ComingSoon settings={settings} />;
  }

  return (
    <div className="min-h-screen bg-[#FFFBF6] flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Outlet context={{ settings }} />
      </main>
      <SiteFooter settings={settings} />
    </div>
  );
}