import React from "react";
import { Navigate, useOutletContext } from "react-router-dom";
import AdminDashboard from "@/pages/AdminDashboard";

/**
 * Role-aware landing page for /admin. Inventory Staff land on the
 * Raw Material Report; everyone else sees the default dashboard.
 */
export default function AdminIndex() {
  const session = useOutletContext();
  if ((session?.roleName || "").toUpperCase() === "INVENTORY STAFF") {
    return <Navigate to="/admin/raw-material-report" replace />;
  }
  return <AdminDashboard />;
}