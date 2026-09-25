import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Pencil, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import BranchSelector from "@/components/admin/BranchSelector";
import { peso, UNITS } from "@/lib/brand";
import { audit } from "@/lib/pos";
import { ensureLedgerRows, migrateInventoryToLedger } from "@/lib/inventory";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const EMPTY = {
  name: "", sku: "", unit: "kg", current_stock: 0, min_stock: 0, reorder_level: 0,
  cost_per_unit: 0, supplier: "", storage_location: "", expiration_date: "", is_active: true, notes: "",
};

export default function AdminRawMaterials() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("NAR Commi");
  const [stockFilter, setStockFilter] = useState("all");
  const [editing, setEditing] = useState(null);

  const refresh = async () => {
    const [all, led] = await Promise.all([
      base44.entities.RawMaterial.list("name"),
      base44.entities.StockLedger.filter({ item_type: "Raw" }),
    ]);
    setRows(all.filter((x) => !x.deleted_at));
    setLedger(led);
  };

  useEffect(() => {
    (async () => {
      await migrateInventoryToLedger();
      refresh();
    })();
  }, []);

  const stockFor = (id) => {
    const row = ledger.find((r) => r.item_id === id && r.branch === branch);
    return row?.current_stock ?? 0;
  };
  const minFor = (id) => {
    const row = ledger.find((r) => r.item_id === id && r.branch === branch);
    return row?.min_stock ?? 0;
  };

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return rows.filter((r) => {
      const stock = stockFor(r.id);
      const low = stock <= minFor(r.id);
      const okStock = stockFilter === "all" || (stockFilter === "low" ? low : !low);
      return okStock && [r.name, r.sku].some((f) => (f || "").toLowerCase().includes(s));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ledger, q, stockFilter, branch]);

  const save = async (canCost) => {
    if (!editing.name.trim()) return toast({ title: "Raw material name is required", variant: "destructive" });
    const dupe = rows.find((r) => r.sku && editing.sku && r.sku === editing.sku && r.id !== editing.id);
    if (dupe) return toast({ title: "That SKU already exists", variant: "destructive" });

    const payload = {
      ...editing,
      current_stock: Number(editing.current_stock) || 0,
      min_stock: Number(editing.min_stock) || 0,
      reorder_level: Number(editing.reorder_level) || 0,
      cost_per_unit: Number(editing.cost_per_unit) || 0,
    };
    if (!canCost) delete payload.cost_per_unit;
    delete payload.id;

    if (editing.id) {
      await base44.entities.RawMaterial.update(editing.id, payload);
    } else {
      const created = await base44.entities.RawMaterial.create(payload);
      await ensureLedgerRows(created, "Raw");
    }
    await audit(editing.id ? "Edit raw material" : "Create raw material", "raw_materials", { record_id: editing.name });
    setEditing(null);
    refresh();
    toast({ title: "Raw material saved" });
  };

  return (
    <ModuleGuard module="raw_materials">
      {(session) => (
        <>
          <PageHeader title="Raw Materials" subtitle={`${filtered.length} raw material(s) · ${branch}`}>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#EE8720]" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or SKU…" className="pl-9 w-60 bg-white border-[#F0DFD0]" />
            </div>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-40 bg-white border-[#F0DFD0]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stock</SelectItem>
                <SelectItem value="low">Low stock</SelectItem>
                <SelectItem value="ok">Healthy stock</SelectItem>
              </SelectContent>
            </Select>
            <BranchSelector value={branch} onChange={setBranch} />
            {session.can("raw_materials", "create") && (
              <button onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-2 rounded-full bg-[#EE8720] text-white px-5 py-2.5 text-sm font-bold">
                <Plus className="w-4 h-4" /> New raw material
              </button>
            )}
          </PageHeader>

          <div className="bg-white rounded-2xl border border-[#F0DFD0] overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-[#FBF6EF] text-xs uppercase tracking-wider text-[#7a4b3a]">
                <tr className="text-left">
                  {["Raw Material", "SKU", "Unit", `Stock (${branch})`, "Min", "Cost/unit", "Supplier", "Location", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {!filtered.length && <tr><td colSpan={9} className="px-4 py-12 text-center text-[#7a4b3a]/60">No raw materials found.</td></tr>}
                {filtered.map((r) => {
                  const stock = stockFor(r.id);
                  const low = stock <= minFor(r.id);
                  return (
                    <tr key={r.id} className="border-t border-[#F7EEE5]">
                      <td className="px-4 py-3 font-semibold text-[#581E12]">{r.name}</td>
                      <td className="px-4 py-3 text-[#7a4b3a]">{r.sku || "—"}</td>
                      <td className="px-4 py-3 text-[#7a4b3a]">{r.unit}</td>
                      <td className={`px-4 py-3 font-bold ${low ? "text-[#E83934]" : "text-[#581E12]"}`}>
                        <span className="inline-flex items-center gap-1.5">{low && <AlertTriangle className="w-3.5 h-3.5" />}{stock}</span>
                      </td>
                      <td className="px-4 py-3 text-[#7a4b3a]">{minFor(r.id)}</td>
                      <td className="px-4 py-3 text-[#7a4b3a]">{session.can("raw_materials", "edit") ? peso(r.cost_per_unit) : "—"}</td>
                      <td className="px-4 py-3 text-[#7a4b3a]">{r.supplier || "—"}</td>
                      <td className="px-4 py-3 text-[#7a4b3a]">{r.storage_location || "—"}</td>
                      <td className="px-4 py-3">
                        {session.can("raw_materials", "edit") && (
                          <button onClick={() => setEditing({ ...r })} className="p-2 rounded-lg hover:bg-[#F8CFB1]/40 text-[#581E12]"><Pencil className="w-4 h-4" /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {editing && (
            <Dialog open onOpenChange={() => setEditing(null)}>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="text-[#581E12]">{editing.id ? "Edit raw material" : "New raw material"}</DialogTitle></DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label>Name *</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>SKU</Label><Input value={editing.sku || ""} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} className="mt-1.5" /></div>
                  <div>
                    <Label>Unit</Label>
                    <Select value={editing.unit} onValueChange={(v) => setEditing({ ...editing, unit: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Minimum stock</Label><Input type="number" value={editing.min_stock} onChange={(e) => setEditing({ ...editing, min_stock: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Reorder level</Label><Input type="number" value={editing.reorder_level} onChange={(e) => setEditing({ ...editing, reorder_level: e.target.value })} className="mt-1.5" /></div>
                  {session.can("raw_materials", "edit") && (
                    <div><Label>Cost per unit</Label><Input type="number" value={editing.cost_per_unit} onChange={(e) => setEditing({ ...editing, cost_per_unit: e.target.value })} className="mt-1.5" /></div>
                  )}
                  <div><Label>Supplier</Label><Input value={editing.supplier || ""} onChange={(e) => setEditing({ ...editing, supplier: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Storage location</Label><Input value={editing.storage_location || ""} onChange={(e) => setEditing({ ...editing, storage_location: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Expiration date</Label><Input type="date" value={editing.expiration_date || ""} onChange={(e) => setEditing({ ...editing, expiration_date: e.target.value })} className="mt-1.5" /></div>
                </div>
                <div><Label>Notes</Label><Textarea value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className="mt-1.5" /></div>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#581E12]">
                  <Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /> Active
                </label>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditing(null)} className="rounded-full border border-[#F0DFD0] px-5 py-2.5 text-sm font-bold text-[#581E12]">Cancel</button>
                  <button onClick={() => save(session.can("raw_materials", "edit"))} className="rounded-full bg-[#EE8720] text-white px-6 py-2.5 text-sm font-bold">Save</button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </ModuleGuard>
  );
}