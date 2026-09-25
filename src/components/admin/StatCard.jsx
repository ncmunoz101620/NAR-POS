import React from "react";

export default function StatCard({ label, value, hint, icon: Icon, tone = "orange" }) {
  const tones = {
    orange: "bg-[#EE8720]/12 text-[#EE8720]",
    brown: "bg-[#581E12]/10 text-[#581E12]",
    gold: "bg-[#F5C400]/20 text-[#a08000]",
    red: "bg-[#E83934]/12 text-[#E83934]",
    pink: "bg-[#E45A82]/12 text-[#E45A82]",
    green: "bg-emerald-100 text-emerald-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-[#F0DFD0] p-5 shadow-sm">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className={`w-9 h-9 rounded-xl grid place-items-center ${tones[tone]}`}>
            <Icon className="w-4.5 h-4.5" />
          </span>
        )}
        <p className="text-xs font-semibold uppercase tracking-wider text-[#7a4b3a]/70">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-extrabold text-[#581E12]">{value}</p>
      {hint && <p className="text-xs text-[#7a4b3a]/70 mt-1">{hint}</p>}
    </div>
  );
}