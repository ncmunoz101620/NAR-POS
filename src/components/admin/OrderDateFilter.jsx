import React from "react";

const DATE_TYPES = [
  { id: "created", label: "Created" },
  { id: "preferred", label: "Preferred" },
];
const INTERVALS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "all", label: "All Time" },
];

export default function OrderDateFilter({
  dateType,
  interval,
  dateFrom,
  dateTo,
  onDateType,
  onInterval,
  onDateFrom,
  onDateTo,
}) {
  return (
    <div className="rounded-2xl bg-[#FDF7F2] border border-[#F0DFD0] px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <span className="text-sm font-medium text-[#525866]">Select Date Range</span>

        <div className="flex gap-2">
          {DATE_TYPES.map((t) => {
            const active = dateType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onDateType(t.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#4D2600] text-white"
                    : "bg-white text-[#374151] border border-[#D1D5DB] hover:border-[#EE8720]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          {INTERVALS.map((it) => {
            const active = interval === it.id;
            return (
              <button
                key={it.id}
                onClick={() => onInterval(it.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#B66D46] text-white"
                    : "bg-white text-[#374151] border border-[#D1D5DB] hover:border-[#EE8720]"
                }`}
              >
                {it.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#7a4b3a]/70">Range</span>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[#525866]">From</label>
          <input
            type="date"
            value={dateFrom || ""}
            onChange={(e) => onDateFrom(e.target.value)}
            className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-1.5 text-sm text-[#374151] focus:border-[#EE8720] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[#525866]">To</label>
          <input
            type="date"
            value={dateTo || ""}
            onChange={(e) => onDateTo(e.target.value)}
            className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-1.5 text-sm text-[#374151] focus:border-[#EE8720] focus:outline-none"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { onDateFrom(""); onDateTo(""); }}
            className="text-xs font-semibold text-[#7a4b3a] hover:text-[#581E12] underline"
          >
            Clear range
          </button>
        )}
      </div>
    </div>
  );
}