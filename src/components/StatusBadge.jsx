import React from "react";
import { STATUS_COLORS } from "@/lib/brand";

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
        STATUS_COLORS[status] || "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      {status}
    </span>
  );
}