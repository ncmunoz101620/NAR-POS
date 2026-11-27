import React, { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { request } from "@/api/client";
import { formatManila, manilaDateString } from "@/lib/datetime";
import { BRANCHES } from "@/lib/inventory";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const quantity = (value) => Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 3 });
const today = () => manilaDateString(new Date().toISOString());

export default function IngredientLedger({ ingredients, initialIngredientId, assignedBranch, onBack }) {
  const [ingredientId, setIngredientId] = useState(initialIngredientId || "");
  const [branch, setBranch] = useState(assignedBranch && assignedBranch !== "All" ? assignedBranch : "");
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(1);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const branches = assignedBranch && assignedBranch !== "All" ? [assignedBranch] : BRANCHES;

  useEffect(() => {
    if (!ingredientId || !branch) {
      setLedger(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    request(`/reports/ingredient-ledger/${ingredientId}?${new URLSearchParams({ branch, from, to, page: String(page) })}`)
      .then((result) => { if (active) setLedger(result); })
      .catch((failure) => { if (active) { setError(failure.message); setLedger(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ingredientId, branch, from, to, page]);

  const firstRow = ledger?.rows?.[0];
  const broughtForward = firstRow ? firstRow.balance - firstRow.quantity : ledger?.opening;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-[#F0DFD0] px-4 py-2 text-sm font-bold text-[#581E12] hover:bg-[#FBF6EF]">
          <ArrowLeft className="h-4 w-4" /> Back to ingredients
        </button>
        <div>
          <h1 className="text-xl font-bold text-[#581E12]">Ingredient Ledger</h1>
          <p className="text-sm text-[#7a4b3a]">Opening stock, receipts, consumption, and running balance</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#F0DFD0] bg-white p-4">
        <div className="min-w-56 flex-1">
          <Label>Ingredient</Label>
          <Select value={ingredientId} onValueChange={(value) => { setIngredientId(value); setPage(1); }}>
            <SelectTrigger className="mt-1.5 bg-white"><SelectValue placeholder="Select ingredient" /></SelectTrigger>
            <SelectContent>{ingredients.map((ingredient) => <SelectItem key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="min-w-44">
          <Label>Branch</Label>
          <Select value={branch} onValueChange={(value) => { setBranch(value); setPage(1); }}>
            <SelectTrigger className="mt-1.5 bg-white"><SelectValue placeholder="Select branch" /></SelectTrigger>
            <SelectContent>{branches.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>From</Label><Input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="mt-1.5 w-40 bg-white" /></div>
        <div><Label>To</Label><Input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="mt-1.5 w-40 bg-white" /></div>
        <button type="button" onClick={() => { setFrom(""); setTo(""); setPage(1); }} className="rounded-full border border-[#F0DFD0] px-4 py-2.5 text-sm font-bold text-[#581E12]">All time</button>
      </div>

      {!ingredientId || !branch ? <p className="rounded-2xl border border-[#F0DFD0] bg-white p-8 text-center text-[#7a4b3a]">Select an ingredient and branch to view its ledger.</p> : null}
      {error && <p role="alert" className="text-sm text-[#E83934]">{error}</p>}
      {loading && <p className="text-sm text-[#7a4b3a]">Loading ingredient movements…</p>}

      {ledger && !loading && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[["Beginning Inventory", ledger.opening], ["Stock In", ledger.stockIn], ["Consumed", ledger.consumed], ["Other Movement", ledger.other], ["Closing Inventory", ledger.closing]].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[#F0DFD0] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7a4b3a]">{label}</p>
              <p className="mt-2 text-xl font-extrabold text-[#581E12]">{quantity(value)} <span className="text-sm font-medium">{ledger.ingredient.unit}</span></p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[#F0DFD0] bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[#FBF6EF] text-left text-xs uppercase tracking-wider text-[#7a4b3a]">
              <tr>{["Date / Time", "Movement", "Reference / Notes", "Stock In", "Consumed", "Other +/−", "Balance"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#F7EEE5] bg-[#FBF6EF]/50 font-bold text-[#581E12]">
                <td colSpan={6} className="px-4 py-3">{page === 1 ? "Beginning inventory" : "Balance brought forward"}</td>
                <td className="px-4 py-3">{quantity(broughtForward)}</td>
              </tr>
              {ledger.rows.map((movement) => <tr key={movement.id} className="border-t border-[#F7EEE5] text-[#7a4b3a]">
                <td className="whitespace-nowrap px-4 py-3">{formatManila(movement.at)}</td>
                <td className="px-4 py-3 font-semibold text-[#581E12]">{movement.type}</td>
                <td className="px-4 py-3">{movement.reference || movement.notes || "—"}</td>
                <td className="px-4 py-3 text-emerald-700">{movement.stockIn ? quantity(movement.stockIn) : "—"}</td>
                <td className="px-4 py-3 text-[#E83934]">{movement.consumed ? quantity(movement.consumed) : "—"}</td>
                <td className="px-4 py-3">{movement.other ? `${movement.other > 0 ? "+" : ""}${quantity(movement.other)}` : "—"}</td>
                <td className="px-4 py-3 font-bold text-[#581E12]">{quantity(movement.balance)}</td>
              </tr>)}
              {!ledger.rows.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#7a4b3a]/60">No movements in this range.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm text-[#7a4b3a]">
          <span>{ledger.total} movement(s) · Page {ledger.page} of {ledger.pages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-full border border-[#F0DFD0] px-3 py-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" disabled={page >= ledger.pages} onClick={() => setPage((value) => value + 1)} className="rounded-full border border-[#F0DFD0] px-3 py-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </>}
    </div>
  );
}
