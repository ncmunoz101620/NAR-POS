import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Pencil, Trash2, X, Upload } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import { peso } from "@/lib/brand";
import { audit } from "@/lib/pos";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

const EMPTY = {
  name: "", sku: "", category_id: "", description: "", image_url: "",
  is_active: true, is_featured: false, is_popular: false, show_on_landing: false, sort_order: 0,
  variants: [{ name: "Sakto", price: 0, sku: "", is_available: true }], modifiers: [],
};

export default function AdminProducts() {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = () =>
    Promise.all([base44.entities.Product.list("sort_order"), base44.entities.Category.list("sort_order")])
      .then(([p, c]) => { setProducts(p.filter((x) => !x.deleted_at)); setCategories(c); setLoading(false); });

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return products.filter((p) => [p.name, p.sku].some((f) => (f || "").toLowerCase().includes(s)));
  }, [products, q]);

  const catName = (id) => categories.find((c) => c.id === id)?.name || "—";

  const save = async (form) => {
    if (!form.name.trim()) return toast({ title: "Product name is required", variant: "destructive" });
    if ((form.variants || []).some((v) => !v.name.trim() || Number(v.price) < 0))
      return toast({ title: "Each size needs a name and a non-negative price", variant: "destructive" });
    const dupe = products.find((p) => p.sku && form.sku && p.sku === form.sku && p.id !== form.id);
    if (dupe) return toast({ title: "That SKU is already used by another product", variant: "destructive" });

    const payload = { ...form, variants: form.variants.map((v) => ({ ...v, price: Number(v.price) || 0 })) };
    delete payload.id;
    if (form.id) await base44.entities.Product.update(form.id, payload);
    else await base44.entities.Product.create(payload);
    await audit(form.id ? "Edit product" : "Create product", "products", { record_id: form.name, new_value: form.name });
    setEditing(null);
    refresh();
    toast({ title: form.id ? "Product updated" : "Product created" });
  };

  const softDelete = async () => {
    const orders = await base44.entities.Order.list("-created_date", 500);
    const used = orders.some((o) => (o.items || []).some((i) => i.product_id === confirm.id));
    await base44.entities.Product.update(confirm.id, { deleted_at: new Date().toISOString(), is_active: false });
    await audit("Delete product", "products", { record_id: confirm.name });
    setConfirm(null);
    refresh();
    toast({
      title: "Product removed from the menu",
      description: used ? "It appears in past orders, so its history was preserved." : undefined,
    });
  };

  return (
    <ModuleGuard module="products">
      {(session) => (
        <>
          <PageHeader title="Products" subtitle={`${filtered.length} product(s)`}>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#EE8720]" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or SKU…" className="pl-9 w-64 bg-white border-[#F0DFD0]" />
            </div>
            {session.can("products", "create") && (
              <button onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-2 rounded-full bg-[#EE8720] text-white px-5 py-2.5 text-sm font-bold">
                <Plus className="w-4 h-4" /> New product
              </button>
            )}
          </PageHeader>

          <div className="bg-white rounded-2xl border border-[#F0DFD0] overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-[#FBF6EF] text-xs uppercase tracking-wider text-[#7a4b3a]">
                <tr className="text-left">
                  {["Product", "SKU", "Category", "Sizes", "Status", "Flags", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="px-4 py-12 text-center text-[#7a4b3a]/60">Loading…</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-[#7a4b3a]/60">No products yet.</td></tr>}
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-[#F7EEE5]">
                    <td className="px-4 py-3 font-semibold text-[#581E12]">{p.name}<span className="block text-xs font-normal text-[#7a4b3a]/70 line-clamp-1">{p.description}</span></td>
                    <td className="px-4 py-3 text-[#7a4b3a]">{p.sku || "—"}</td>
                    <td className="px-4 py-3 text-[#7a4b3a]">{catName(p.category_id)}</td>
                    <td className="px-4 py-3 text-[#7a4b3a]">
                      {(p.variants || []).map((v) => <span key={v.name} className="block whitespace-nowrap">{v.name} · <b className="text-[#581E12]">{peso(v.price)}</b></span>)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#7a4b3a]">{[p.is_featured && "Featured", p.is_popular && "Popular", p.show_on_landing && "Landing"].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {session.can("products", "edit") && (
                          <button onClick={() => setEditing({ ...p })} className="p-2 rounded-lg hover:bg-[#F8CFB1]/40 text-[#581E12]"><Pencil className="w-4 h-4" /></button>
                        )}
                        {session.can("products", "delete") && (
                          <button onClick={() => setConfirm(p)} className="p-2 rounded-lg hover:bg-[#E83934]/10 text-[#E83934]"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editing && <ProductDialog form={editing} setForm={setEditing} categories={categories} onSave={save} />}

          <AlertDialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{confirm?.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  It will be removed from the menu. Past orders keep their original product details.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={softDelete} className="bg-[#E83934] hover:bg-[#c72d29]">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </ModuleGuard>
  );
}

function ProductDialog({ form, setForm, categories, onSave }) {
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm({ ...form, [k]: v });
  const setVariant = (idx, k, v) => set("variants", form.variants.map((x, i) => (i === idx ? { ...x, [k]: v } : x)));
  const setMod = (idx, k, v) => set("modifiers", (form.modifiers || []).map((x, i) => (i === idx ? { ...x, [k]: v } : x)));

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("image_url", file_url);
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <Dialog open onOpenChange={() => setForm(null)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-[#581E12]">{form.id ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1.5" /></div>
          <div><Label>SKU</Label><Input value={form.sku || ""} onChange={(e) => set("sku", e.target.value)} className="mt-1.5" /></div>
          <div>
            <Label>Category</Label>
            <Select value={form.category_id || ""} onValueChange={(v) => set("category_id", v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Sort order</Label><Input type="number" value={form.sort_order || 0} onChange={(e) => set("sort_order", Number(e.target.value))} className="mt-1.5" /></div>
        </div>
        <div><Label>Description</Label><Textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} className="mt-1.5" /></div>
        <div>
          <Label>Image</Label>
          <div className="mt-1.5 flex items-center gap-3">
            <Input value={form.image_url || ""} onChange={(e) => set("image_url", e.target.value)} placeholder="Paste image URL…" />
            <label className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold cursor-pointer ${uploading ? "bg-[#F8CFB1] text-[#7a4b3a]" : "bg-[#581E12] text-white"}`}>
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading…" : "Upload"}
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
          {form.image_url && (
            <div className="mt-2 w-24 h-24 rounded-xl overflow-hidden border border-[#F0DFD0]">
              <img src={form.image_url} alt="preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-6">
          {[["is_active", "Active"], ["is_featured", "Featured"], ["is_popular", "Popular"], ["show_on_landing", "Show on landing page"]].map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm font-semibold text-[#581E12]">
              <Switch checked={!!form[k]} onCheckedChange={(v) => set(k, v)} /> {label}
            </label>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Sizes / variants</Label>
            <button onClick={() => set("variants", [...(form.variants || []), { name: "", price: 0, sku: "", is_available: true }])} className="text-xs font-bold text-[#EE8720]">+ Add size</button>
          </div>
          <div className="mt-2 space-y-2">
            {(form.variants || []).map((v, idx) => (
              <div key={idx} className="flex flex-wrap gap-2 items-center bg-[#FBF6EF] rounded-xl p-2">
                <Input value={v.name} onChange={(e) => setVariant(idx, "name", e.target.value)} placeholder="Size name" className="w-36 bg-white" />
                <Input type="number" value={v.price} onChange={(e) => setVariant(idx, "price", e.target.value)} placeholder="Price" className="w-28 bg-white" />
                <Input value={v.sku || ""} onChange={(e) => setVariant(idx, "sku", e.target.value)} placeholder="SKU" className="w-32 bg-white" />
                <label className="flex items-center gap-2 text-xs font-semibold text-[#7a4b3a]">
                  <Switch checked={v.is_available !== false} onCheckedChange={(c) => setVariant(idx, "is_available", c)} /> Available
                </label>
                <button onClick={() => set("variants", form.variants.filter((_, i) => i !== idx))} className="ml-auto p-1.5 text-[#E83934]"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Add-ons / modifiers</Label>
            <button onClick={() => set("modifiers", [...(form.modifiers || []), { name: "", price: 0 }])} className="text-xs font-bold text-[#EE8720]">+ Add modifier</button>
          </div>
          <div className="mt-2 space-y-2">
            {(form.modifiers || []).map((m, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-[#FBF6EF] rounded-xl p-2">
                <Input value={m.name} onChange={(e) => setMod(idx, "name", e.target.value)} placeholder="Add-on name" className="flex-1 bg-white" />
                <Input type="number" value={m.price || 0} onChange={(e) => setMod(idx, "price", Number(e.target.value))} placeholder="Price" className="w-28 bg-white" />
                <button onClick={() => set("modifiers", form.modifiers.filter((_, i) => i !== idx))} className="p-1.5 text-[#E83934]"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => setForm(null)} className="rounded-full border border-[#F0DFD0] px-5 py-2.5 text-sm font-bold text-[#581E12]">Cancel</button>
          <button onClick={() => onSave(form)} className="rounded-full bg-[#EE8720] text-white px-6 py-2.5 text-sm font-bold">Save product</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}