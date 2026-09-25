import React from "react";
import { Building2 } from "lucide-react";
import { BRANCHES } from "@/lib/inventory";

export default function BranchSelector({ value, onChange, className = "" }) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-full bg-[#FBF6EF] border border-[#F0DFD0] p-1 ${className}`}>
      <Building2 className="w-4 h-4 text-[#EE8720] ml-2 shrink-0" />
      {BRANCHES.map((b) => (
        <button
          key={b}
          onClick={() => onChange(b)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
            value === b
              ? "bg-[#EE8720] text-white shadow"
              : "text-[#7a4b3a] hover:bg-[#F8CFB1]/40"
          }`}
        >
          {b}
        </button>
      ))}
    </div>
  );
}
