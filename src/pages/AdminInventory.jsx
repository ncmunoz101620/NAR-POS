import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import BranchSelector from "@/components/admin/BranchSelector";
import { audit } from "@/lib/pos";
import { ensureLedgerRows, getLedgerRow, migrateInventoryToLedger } from "@/lib/inventory";
import { formatManila } from "@/lib/datetime";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const TYPES = ["Stock In", "Waste", "Adjustment", "Return", "Correction"];

export default function AdminInventory() {
  const { toast } = useToast();
  const [txs, setTxs] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [branch, setBranch] = useState("NAR Commi");
  const [form, setForm] = useState(null);

  const refresh = async () => {
    const [t, i, r, led, u] = await Promise.all([
      base44.entities.InventoryTransaction.list("-created_date", 300),
      base44.entities.Ingredient.list("name"),
      base44.entities.RawMaterial.list("name"),
      base44.entities.StockLedger.list(),
      base44.entities.AppUser.list("name").catch(() => []),
    ]);
    setTxs(t);
    setIngredients(i);
    setRawMaterials(r);
    setLedger(led);
    setUsers(u);
  };

  useEffect(() => {
    (async () => {
      await migrateInventoryToLedger();
      refresh();
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return txs.filter(
      (t) =>
        (type === "all" || t.type === type) &&
        (t.branch || "NAR Commi") === branch &&
        (t.ingredient_name || "").toLowerCase().includes(s)
    );
  }, [txs, q, type, branch]);

  const userName = (raw) => {
    if (!raw) return "—";
    if (raw.includes("@")) {
      const u = users.find((x) => x.email?.toLowerCase() === raw.toLowerCase());
      return u?.name || raw;
    }
    return raw;
  };

  const stockFor = (id, itemType) => {
    const row = ledger.find((r) => r.item_id === id && r.item_type === itemType && r.branch === branch);
    return row?.current_stock ?? 0;
  };

  // Top stock cards: production ingredients for the selected branch
  const cards = ingredients
    .filter((i) => !i.deleted_at)
    .slice(0, 8)
    .map((i) => ({ ...i, stock: stockFor(i.id, "Production") }));

  const save = async () => {
    const list = form.ingredient_type === "Raw" ? rawMaterials : ingredients;
    const item = list.find((i) => i.id === form.ingredient_id);
    if (!item) return toast({ title: "Select an item", variant: "destructive" });
    const qty = Number(form.quantity);
    if (!qty || Number.isNaN(qty)) return toast({ title: "Enter a valid quantity", variant: "destructive" });

    await ensureLedgerRows(item, form.ingredient_type);
    const row = await getLedgerRow(item.id, form.ingredient_type, branch);
    if (!row) return toast({ title: "Ledger row missing", variant: "destructive" });

    const signed = form.type === "Waste" ? -Math.abs(qty) : qty;
    const newStock = Math.round((row.current_stock + signed) * 1000) / 1000;
    if (newStock < 0) return toast({ title: "This movement would make stock negative", variant: "destructive" });

    await base44.entities.StockLedger.update(row.id, { current_stock: newStock });
    await base44.entities.InventoryTransaction.create({
      ingredient_id: item.id,
      ingredient_name: item.name,
      ingredient_type: form.ingredient_type,
      branch,
      type: form.type,
      quantity: signed,
      unit: item.unit,
      reference: form.reference,
      user_name: (await base44.auth.me().catch(() => null))?.full_name || "System",
      notes: form.notes,
    });
    await audit(`Inventory ${form.type}`, "inventory", { record_id: item.name, new_value: String(newStock) });
    setForm(null);
    refresh();
    toast({ title: "Inventory movement recorded" });
  };

  return (
    <ModuleGuard module="inventory">
      {(session) => (
        <>
          <PageHeader title="Inventory" subtitle={`Every movement is recorded · ${branch}`}>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#EE8720]" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item…" className="pl-9 w-56 bg-white border-[#F0DFD0]" />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-48 bg-white border-[#F0DFD0]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {[...TYPES, "Sales Consumption", "Transfer In", "Transfer Out"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <BranchSelector value={branch} onChange={setBranch} />
            {session.can("inventory", "create") && (
              <button
                onClick={() => setForm({ ingredient_type: "Production", ingredient_id: "", type: "Stock In", quantity: "", reference: "", notes: "" })}
                className="inline-flex items-center gap-2 rounded-full bg-[#EE8720] text-white px-5 py-2.5 text-sm font-bold"
              >
                <Plus className="w-4 h-4" /> New movement
              </button>
            )}
          </PageHeader>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {cards.map((i) => (
              <div key={i.id} className="bg-white rounded-2xl border border-[#F0DFD0] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#7a4b3a]/70">{i.name}</p>
                <p className={`mt-1.5 text-xl font-extrabold ${i.stock <= (i.min_stock || 0) ? "text-[#E83934]" : "text-[#581E12]"}`}>
                  {i.stock} <span className="text-sm font-semibold">{i.unit}</span>
                </p>
                <p className="text-xs text-[#7a4b3a]/70">min {i.min_stock} {i.unit}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-[#F0DFD0] overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-[#FBF6EF] text-xs uppercase tracking-wider text-[#7a4b3a]">
                <tr className="text-left">
                  {["Date / Time", "Item", "Type", "Branch", "Quantity", "Unit", "Reference", "User", "Notes"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {!filtered.length && <tr><td colSpan={9} className="px-4 py-12 text-center text-[#7a4b3a]/60">No inventory movements for this branch.</td></tr>}
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t border-[#F7EEE5]">
                    <td className="px-4 py-3 text-[#7a4b3a] whitespace-nowrap">{formatManila(t.created_date)}</td>
                    <td className="px-4 py-3 font-semibold text-[#581E12]">{t.ingredient_name}</td>
                    <td className="px-4 py-3 text-[#7a4b3a]">{t.type}</td>
                    <td className="px-4 py-3 text-[#7a4b3a]">{t.branch || "—"}</td>
                    <td className={`px-4 py-3 font-bold ${t.quantity < 0 ? "text-[#E83934]" : "text-emerald-700"}`}>{t.quantity > 0 ? "+" : ""}{t.quantity}</td>
                    <td className="px-4 py-3 text-[#7a4b3a]">{t.unit}</td>
                    <td className="px-4 py-3 text-[#7a4b3a] font-mono text-xs">{t.reference || "—"}</td>
                    <td className="px-4 py-3 text-[#7a4b3a]">{userName(t.user_name)}</td>
                    <td className="px-4 py-3 text-[#7a4b3a] text-xs">{t.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {form && (
            <Dialog open onOpenChange={() => setForm(null)}>
              <DialogContent>
                <DialogHeader><DialogTitle className="text-[#581E12]">New inventory movement — {branch}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Inventory type</Label>
                    <Select value={form.ingredient_type} onValueChange={(v) => setForm({ ...form, ingredient_type: v, ingredient_id: "" })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Production">Production (Ingredients)</SelectItem>
                        <SelectItem value="Raw">Raw Materials</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Item</Label>
                    <Select value={form.ingredient_id} onValueChange={(v) => setForm({ ...form, ingredient_id: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select item" /></SelectTrigger>
                      <SelectContent>
                        {(form.ingredient_type === "Raw" ? rawMaterials : ingredients)
                          .filter((i) => !i.deleted_at)
                          .map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Transaction type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quantity {form.type === "Waste" ? "(will be deducted)" : form.type === "Adjustment" ? "(use negative to deduct)" : ""}</Label>
                    <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="mt-1.5" />
                  </div>
                  <div><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="mt-1.5" placeholder="Delivery receipt / PO no." /></div>
                  <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1.5" /></div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setForm(null)} className="rounded-full border border-[#F0DFD0] px-5 py-2.5 text-sm font-bold text-[#581E12]">Cancel</button>
                  <button onClick={save} className="rounded-full bg-[#EE8720] text-white px-6 py-2.5 text-sm font-bold">Record movement</button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </ModuleGuard>
  );
}