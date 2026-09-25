import React, { useEffect, useMemo, useState } from "react";
import { request } from "@/api/client";
import { ArrowLeft, Download } from "lucide-react";
import { manilaDateString } from "@/lib/datetime";
import { peso } from "@/lib/brand";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const IN_TYPES = ["Stock In", "Return", "Transfer In"];
const OUT_TYPES = ["Sales Consumption", "Waste", "Transfer Out"];

function presetRange(preset) {
  const today = new Date();
  const fmt = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const manilaToday = manilaDateString(today);
  if (preset === "today") return { from: manilaToday, to: manilaToday };
  if (preset === "week") {
    const d = new Date(today);
    const day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - day);
    return { from: fmt(d), to: manilaToday };
  }
  if (preset === "month") {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: fmt(d), to: manilaToday };
  }
  return { from: "", to: "" };
}

export default function IngredientInventorySummary({ ingredients, onBack }) {
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const r = presetRange(preset);
    setFrom(r.from);
    setTo(r.to);
  }, [preset]);

  const load = () => {
    setLoading(true);
    request('/reports/inventorySummary?'+new URLSearchParams({from,to}))
      .then((r) => setTxns(r))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [from,to]);

  const summary=txns;

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return summary
      .filter((r) => !s || r.name.toLowerCase().includes(s))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [summary, q]);

  const totals = useMemo(() => {
    let totIn = 0, totOut = 0, costIn = 0, costOut = 0;
    filtered.forEach((r) => {
      totIn += r.totalIn;
      totOut += r.totalOut;
      costIn += r.totalIn * r.cost_per_unit;
      costOut += r.totalOut * r.cost_per_unit;
    });
    return { totIn, totOut, costIn, costOut };
  }, [filtered]);

  const exportCsv = () => {
    const header = ["Ingredient", "Unit", "Total In", "Total Out", "Net", "Current Stock", "Cost/Unit", "In Value", "Out Value"];
    const lines = filtered.map((r) => [
      r.name, r.unit, r.totalIn, r.totalOut, r.totalIn - r.totalOut, r.current_stock,
      r.cost_per_unit, (r.totalIn * r.cost_per_unit).toFixed(2), (r.totalOut * r.cost_per_unit).toFixed(2),
    ].join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-summary_${from || "all"}_to_${to || "now"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-[#F0DFD0] px-4 py-2 text-sm font-bold text-[#581E12] hover:bg-[#FBF6EF]">
            <ArrowLeft className="w-4 h-4" /> Back to ingredients
          </button>
          <h1 className="text-xl font-bold text-[#581E12]">Inventory Summary</h1>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-full bg-[#581E12] text-white px-5 py-2.5 text-sm font-bold">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#F0DFD0] p-4 flex flex-wrap items-end gap-4">
        <div>
          <Label className="text-xs text-[#7a4b3a]">Quick range</Label>
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-44 mt-1.5 bg-white border-[#F0DFD0]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-[#7a4b3a]">From</Label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("all"); }} className="mt-1.5 bg-white border-[#F0DFD0] w-44" />
        </div>
        <div>
          <Label className="text-xs text-[#7a4b3a]">To</Label>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("all"); }} className="mt-1.5 bg-white border-[#F0DFD0] w-44" />
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ingredient…" className="bg-white border-[#F0DFD0]" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#F0DFD0] p-4">
          <p className="text-xs uppercase tracking-wider text-[#7a4b3a]">Total In</p>
          <p className="mt-1 text-2xl font-bold text-[#2E7D32]">{totals.totIn.toLocaleString()}</p>
          <p className="text-xs text-[#7a4b3a] mt-0.5">{peso(totals.costIn)} value</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#F0DFD0] p-4">
          <p className="text-xs uppercase tracking-wider text-[#7a4b3a]">Total Out</p>
          <p className="mt-1 text-2xl font-bold text-[#E83934]">{totals.totOut.toLocaleString()}</p>
          <p className="text-xs text-[#7a4b3a] mt-0.5">{peso(totals.costOut)} value</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#F0DFD0] p-4">
          <p className="text-xs uppercase tracking-wider text-[#7a4b3a]">Net Movement</p>
          <p className={`mt-1 text-2xl font-bold ${(totals.totIn - totals.totOut) >= 0 ? "text-[#581E12]" : "text-[#E83934]"}`}>
            {(totals.totIn - totals.totOut).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#F0DFD0] p-4">
          <p className="text-xs uppercase tracking-wider text-[#7a4b3a]">Ingredients</p>
          <p className="mt-1 text-2xl font-bold text-[#581E12]">{filtered.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#F0DFD0] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-[#FBF6EF] text-xs uppercase tracking-wider text-[#7a4b3a]">
            <tr className="text-left">
              {["Ingredient", "Unit", "Total In", "Total Out", "Net", "Current Stock", "In Value", "Out Value"].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-4 py-12 text-center text-[#7a4b3a]/60">Loading transactions…</td></tr>}
            {!loading && !filtered.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-[#7a4b3a]/60">No ingredients in range.</td></tr>}
            {!loading && filtered.map((r) => {
              const net = r.totalIn - r.totalOut;
              const hasMovement = r.totalIn || r.totalOut;
              return (
                <tr key={r.id} className={`border-t border-[#F7EEE5] ${!hasMovement ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-semibold text-[#581E12]">{r.name}</td>
                  <td className="px-4 py-3 text-[#7a4b3a]">{r.unit}</td>
                  <td className="px-4 py-3 font-bold text-[#2E7D32]">{r.totalIn ? r.totalIn.toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 font-bold text-[#E83934]">{r.totalOut ? r.totalOut.toLocaleString() : "—"}</td>
                  <td className={`px-4 py-3 font-bold ${net >= 0 ? "text-[#581E12]" : "text-[#E83934]"}`}>{hasMovement ? net.toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-[#7a4b3a]">{r.current_stock.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[#7a4b3a]">{r.totalIn ? peso(r.totalIn * r.cost_per_unit) : "—"}</td>
                  <td className="px-4 py-3 text-[#7a4b3a]">{r.totalOut ? peso(r.totalOut * r.cost_per_unit) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
