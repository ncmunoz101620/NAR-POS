import React from "react";

export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#581E12] tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-[#7a4b3a]/80 mt-1">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}