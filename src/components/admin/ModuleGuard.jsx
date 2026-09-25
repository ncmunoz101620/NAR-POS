import React from "react";
import { useOutletContext } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

export default function ModuleGuard({ module, action = "view", children }) {
  const session = useOutletContext();
  if (!session?.can(module, action)) {
    return (
      <div className="bg-white border border-[#F0DFD0] rounded-2xl p-12 text-center max-w-lg mx-auto mt-10">
        <ShieldAlert className="w-10 h-10 text-[#E83934] mx-auto" />
        <h2 className="mt-4 text-lg font-bold text-[#581E12]">Access denied</h2>
        <p className="mt-2 text-sm text-[#7a4b3a]">
          The <b>{session?.roleName}</b> role does not have permission to open this module.
        </p>
      </div>
    );
  }
  return typeof children === "function" ? children(session) : children;
}
