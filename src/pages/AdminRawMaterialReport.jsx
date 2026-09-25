import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import { Search, Download, AlertTriangle, PackageCheck } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import { BRANCHES } from "@/lib/inventory";
import { peso } from "@/lib/brand";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function AdminRawMaterialReport() {
  const { toast } = useToast();
  const [materials, setMaterials] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [m, led] = await Promise.all([
      api.entities.RawMaterial.list("name"),
      api.entities.StockLedger.filter({ item_type: "Raw" }),
    ]);
    setMaterials(m.filter((r) => !r.deleted_at));
    setLedger(led);
  };

  useEffect(() => {
    (async () => {

      await refresh();
      setLoading(false);
    })();
  }, []);

  const stockFor = (id, branch) => {
    const row = ledger.find((r) => r.item_id === id && r.branch === branch);
    return row?.current_stock ?? 0;
  };
  const minFor = (id, branch) => {
    const row = ledger.find((r) => r.item_id === id && r.branch === branch);
    return row?.min_stock ?? 0;
  };

  // Build rows with per-branch stock + totals
  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return materials
      .map((m) => {
        const byBranch = {};
        let total = 0;
        let lowestBranch = null;
        let lowestStock = Infinity;
        for (const b of BRANCHES) {
          const st = stockFor(m.id, b);
          byBranch[b] = st;
          total += st;
          if (st < lowestStock) {
            lowestStock = st;
            lowestBranch = b;
          }
        }
        const reorder = m.reorder_level || 0;
        const needsReorder = total <= reorder && reorder > 0;
        return { ...m, byBranch, total, needsReorder, lowestBranch };
      })
      .filter((m) => {
        const okStock =
          stockFilter === "all"
            ? true
            : stockFilter === "low"
            ? m.needsReorder
            : !m.needsReorder;
        return okStock && [m.name, m.sku].some((f) => (f || "").toLowerCase().includes(s));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials, ledger, q, stockFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const totalSkus = materials.length;
    const lowCount = rows.filter((r) => r.needsReorder).length;
    let totalUnits = 0;
    let totalValue = 0;
    for (const r of rows) {
      totalUnits += r.total;
      totalValue += r.total * (r.cost_per_unit || 0);
    }
    return { totalSkus, lowCount, totalUnits, totalValue };
  }, [materials, rows]);

  const exportCsv = () => {
    const headers = ["Raw Material", "SKU", "Unit", ...BRANCHES, "Total Stock", "Reorder Level", "Cost/unit", "Total Value", "Status"];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push([
        `"${r.name}"`,
        r.sku || "",
        r.unit,
        ...BRANCHES.map((b) => r.byBranch[b]),
        r.total,
        r.reorder_level || 0,
        r.cost_per_unit || 0,
        (r.total * (r.cost_per_unit || 0)).toFixed(2),
        r.needsReorder ? "REORDER" : "OK",
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raw-materials-by-branch-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported" });
  };

  return (
    <ModuleGuard module="raw_material_reports">
      <PageHeader title="Raw Material Inventory by Branch" subtitle="Stock levels per location for ordering decisions">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#EE8720]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or SKU…" className="pl-9 w-60 bg-white border-[#F0DFD0]" />
        </div>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-40 bg-white border-[#F0DFD0]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock</SelectItem>
            <SelectItem value="low">Needs reorder</SelectItem>
            <SelectItem value="ok">Healthy</SelectItem>
          </SelectContent>
        </Select>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-full bg-[#581E12] text-white px-5 py-2.5 text-sm font-bold">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#F0DFD0] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7a4b3a]/70">Raw Material SKUs</p>
          <p className="mt-1.5 text-2xl font-extrabold text-[#581E12]">{stats.totalSkus}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#F0DFD0] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7a4b3a]/70">Needs Reorder</p>
          <p className={`mt-1.5 text-2xl font-extrabold ${stats.lowCount ? "text-[#E83934]" : "text-[#581E12]"}`}>
            {stats.lowCount}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#F0DFD0] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7a4b3a]/70">Total Units (all branches)</p>
          <p className="mt-1.5 text-2xl font-extrabold text-[#581E12]">{stats.totalUnits}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#F0DFD0] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7a4b3a]/70">Total Stock Value</p>
          <p className="mt-1.5 text-2xl font-extrabold text-[#EE8720]">{peso(stats.totalValue)}</p>
        </div>
      </div>

      {/* Per-branch summary */}
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        {BRANCHES.map((b) => {
          const branchTotal = rows.reduce((sum, r) => sum + r.byBranch[b], 0);
          const branchLow = rows.filter((r) => r.byBranch[b] <= minFor(r.id, b)).length;
          return (
            <div key={b} className="bg-gradient-to-br from-[#581E12] to-[#7a3520] rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#F8CFB1]/70">{b}</p>
                  <p className="mt-1 text-3xl font-extrabold">{branchTotal} <span className="text-base font-semibold">units</span></p>
                </div>
                <PackageCheck className="w-8 h-8 text-[#EE8720]" />
              </div>
              <p className="mt-2 text-sm text-[#F8CFB1]/80">
                {rows.length} items · {branchLow} below minimum
              </p>
            </div>
          );
        })}
      </div>

      {/* Main table */}
      <div className="bg-white rounded-2xl border border-[#F0DFD0] overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="bg-[#FBF6EF] text-xs uppercase tracking-wider text-[#7a4b3a]">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Raw Material</th>
              <th className="px-4 py-3 font-semibold">SKU</th>
              <th className="px-4 py-3 font-semibold">Unit</th>
              {BRANCHES.map((b) => <th key={b} className="px-4 py-3 font-semibold">{b}</th>)}
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Reorder Level</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-12 text-center text-[#7a4b3a]/60">Loading…</td></tr>}
            {!loading && !rows.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-[#7a4b3a]/60">No raw materials found.</td></tr>}
            {rows.map((r) => {
              const reorder = r.reorder_level || 0;
              return (
                <tr key={r.id} className="border-t border-[#F7EEE5]">
                  <td className="px-4 py-3 font-semibold text-[#581E12]">{r.name}</td>
                  <td className="px-4 py-3 text-[#7a4b3a] font-mono text-xs">{r.sku || "—"}</td>
                  <td className="px-4 py-3 text-[#7a4b3a]">{r.unit}</td>
                  {BRANCHES.map((b) => {
                    const st = r.byBranch[b];
                    const low = st <= minFor(r.id, b);
                    return (
                      <td key={b} className={`px-4 py-3 font-bold ${low ? "text-[#E83934]" : "text-[#581E12]"}`}>
                        {st}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 font-extrabold text-[#581E12]">{r.total}</td>
                  <td className="px-4 py-3 text-[#7a4b3a]">{reorder}</td>
                  <td className="px-4 py-3">
                    {r.needsReorder ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E83934]/10 text-[#E83934] border border-[#E83934]/20 px-2.5 py-0.5 text-xs font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" /> Reorder
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold">
                        <PackageCheck className="w-3.5 h-3.5" /> OK
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {!loading && !!rows.length && (
            <tfoot className="bg-[#FBF6EF] text-xs uppercase tracking-wider text-[#7a4b3a]">
              <tr className="text-left font-bold">
                <td className="px-4 py-3" colSpan={3}>Totals</td>
                {BRANCHES.map((b) => (
                  <td key={b} className="px-4 py-3 font-extrabold text-[#581E12]">
                    {rows.reduce((sum, r) => sum + r.byBranch[b], 0)}
                  </td>
                ))}
                <td className="px-4 py-3 font-extrabold text-[#EE8720]">{stats.totalUnits}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </ModuleGuard>
  );
}
