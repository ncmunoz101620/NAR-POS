import React, { useEffect, useMemo, useState } from "react";
import { api, request } from "@/api/client";
import { Plus, ArrowLeftRight, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";

import { BRANCHES } from "@/lib/inventory";
import { formatManila } from "@/lib/datetime";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function AdminStockTransfers() {
  const { toast } = useToast();
  const [transfers, setTransfers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);

  const refresh = async () => {
    const [t, i, r] = await Promise.all([
      api.entities.StockTransfer.list("-created_date", 300),
      api.entities.Ingredient.list("name"),
      api.entities.RawMaterial.list("name"),
    ]);
    setTransfers(t);
    setIngredients(i.filter((x) => !x.deleted_at));
    setRawMaterials(r.filter((x) => !x.deleted_at));
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return transfers.filter((t) =>
      [t.item_name, t.from_branch, t.to_branch, t.status].some((f) => (f || "").toLowerCase().includes(s))
    );
  }, [transfers, q]);

  const items = form?.item_type === "Raw" ? rawMaterials : ingredients;

  const submit = async () => {
    if (!form.item_id) return toast({ title: "Select an item to transfer", variant: "destructive" });
    if (form.from_branch === form.to_branch) return toast({ title: "Source and destination must differ", variant: "destructive" });
    const qty = Number(form.quantity);
    if (!qty || qty <= 0) return toast({ title: "Enter a valid quantity", variant: "destructive" });

    const item = items.find((x) => x.id === form.item_id);
    if (!item) return toast({ title: "Item not found", variant: "destructive" });

    // Ensure ledger rows exist for both branches


    await request('/inventory/transfers','POST',{...form,quantity:qty});
    setForm(null);
    refresh();
    toast({ title: "Stock transferred successfully" });
  };

  return (
    <ModuleGuard module="stock_transfers">
      {(session) => (
        <>
          <PageHeader title="Stock Transfers" subtitle={`${filtered.length} transfer(s) recorded`}>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#EE8720]" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item or branch…" className="pl-9 w-64 bg-white border-[#F0DFD0]" />
            </div>
            {session.can("stock_transfers", "create") && (
              <button
                onClick={() => setForm({ item_type: "Production", item_id: "", from_branch: BRANCHES[0], to_branch: BRANCHES[1], quantity: "", notes: "" })}
                className="inline-flex items-center gap-2 rounded-full bg-[#EE8720] text-white px-5 py-2.5 text-sm font-bold"
              >
                <Plus className="w-4 h-4" /> New transfer
              </button>
            )}
          </PageHeader>

          <div className="bg-white rounded-2xl border border-[#F0DFD0] overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-[#FBF6EF] text-xs uppercase tracking-wider text-[#7a4b3a]">
                <tr className="text-left">
                  {["Date / Time", "Item", "Type", "From", "To", "Qty", "Unit", "Status", "Notes"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {!filtered.length && <tr><td colSpan={9} className="px-4 py-12 text-center text-[#7a4b3a]/60">No transfers recorded yet.</td></tr>}
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t border-[#F7EEE5]">
                    <td className="px-4 py-3 text-[#7a4b3a] whitespace-nowrap">{formatManila(t.created_date)}</td>
                    <td className="px-4 py-3 font-semibold text-[#581E12]">{t.item_name}</td>
                    <td className="px-4 py-3 text-[#7a4b3a]">{t.item_type}</td>
                    <td className="px-4 py-3 text-[#7a4b3a]">{t.from_branch}</td>
                    <td className="px-4 py-3 text-[#7a4b3a]">{t.to_branch}</td>
                    <td className="px-4 py-3 font-bold text-[#581E12]">{t.quantity}</td>
                    <td className="px-4 py-3 text-[#7a4b3a]">{t.unit}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold">{t.status}</span>
                    </td>
                    <td className="px-4 py-3 text-[#7a4b3a] text-xs">{t.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {form && (
            <Dialog open onOpenChange={() => setForm(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-[#581E12]">
                    <ArrowLeftRight className="w-5 h-5 text-[#EE8720]" /> New stock transfer
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Inventory type</Label>
                    <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v, item_id: "" })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Production">Production (Ingredients)</SelectItem>
                        <SelectItem value="Raw">Raw Materials</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Item</Label>
                    <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select item" /></SelectTrigger>
                      <SelectContent>
                        {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>From branch</Label>
                      <Select value={form.from_branch} onValueChange={(v) => setForm({ ...form, from_branch: v })}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>To branch</Label>
                      <Select value={form.to_branch} onValueChange={(v) => setForm({ ...form, to_branch: v })}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="mt-1.5" />
                  </div>
                  <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1.5" /></div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setForm(null)} className="rounded-full border border-[#F0DFD0] px-5 py-2.5 text-sm font-bold text-[#581E12]">Cancel</button>
                  <button onClick={submit} className="rounded-full bg-[#EE8720] text-white px-6 py-2.5 text-sm font-bold">Transfer stock</button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </ModuleGuard>
  );
}
