import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import { audit } from "@/lib/pos";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

const EMPTY = { name: "", description: "", image_url: "", sort_order: 0, is_active: true };

export default function AdminCategories() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const refresh = () => base44.entities.Category.list("sort_order").then((c) => setRows(c.filter((x) => !x.deleted_at)));
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!editing.name.trim()) return toast({ title: "Category name is required", variant: "destructive" });
    const payload = { ...editing };
    delete payload.id;
    if (editing.id) await base44.entities.Category.update(editing.id, payload);
    else await base44.entities.Category.create(payload);
    await audit(editing.id ? "Edit category" : "Create category", "categories", { record_id: editing.name });
    setEditing(null); refresh();
    toast({ title: "Category saved" });
  };

  const remove = async () => {
    const products = await base44.entities.Product.filter({ category_id: confirm.id });
    if (products.length) {
      setConfirm(null);
      return toast({
        title: "Unable to delete this category",
        description: `${products.length} product(s) still use it. Move them first.`,
        variant: "destructive",
      });
    }
    await base44.entities.Category.update(confirm.id, { deleted_at: new Date().toISOString(), is_active: false });
    await audit("Delete category", "categories", { record_id: confirm.name });
    setConfirm(null); refresh();
    toast({ title: "Category deleted" });
  };

  return (
    <ModuleGuard module="categories">
      {(session) => (
        <>
          <PageHeader title="Categories" subtitle={`${rows.length} category(ies)`}>
            {session.can("categories", "create") && (
              <button onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-2 rounded-full bg-[#EE8720] text-white px-5 py-2.5 text-sm font-bold">
                <Plus className="w-4 h-4" /> New category
              </button>
            )}
          </PageHeader>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-[#F0DFD0] p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-[#581E12]">{c.name}</p>
                    <p className="text-sm text-[#7a4b3a]/80 mt-1">{c.description || "—"}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                    {c.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-[#7a4b3a]/70">Order: {c.sort_order || 0}</span>
                  <div className="flex gap-1">
                    {session.can("categories", "edit") && <button onClick={() => setEditing({ ...c })} className="p-2 rounded-lg hover:bg-[#F8CFB1]/40 text-[#581E12]"><Pencil className="w-4 h-4" /></button>}
                    {session.can("categories", "delete") && <button onClick={() => setConfirm(c)} className="p-2 rounded-lg hover:bg-[#E83934]/10 text-[#E83934]"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
              </div>
            ))}
            {!rows.length && <p className="text-sm text-[#7a4b3a]/60">No categories yet.</p>}
          </div>

          {editing && (
            <Dialog open onOpenChange={() => setEditing(null)}>
              <DialogContent>
                <DialogHeader><DialogTitle className="text-[#581E12]">{editing.id ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Name *</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Description</Label><Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Image URL</Label><Input value={editing.image_url || ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Display order</Label><Input type="number" value={editing.sort_order || 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="mt-1.5" /></div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#581E12]">
                    <Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /> Active
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditing(null)} className="rounded-full border border-[#F0DFD0] px-5 py-2.5 text-sm font-bold text-[#581E12]">Cancel</button>
                  <button onClick={save} className="rounded-full bg-[#EE8720] text-white px-6 py-2.5 text-sm font-bold">Save</button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <AlertDialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{confirm?.name}”?</AlertDialogTitle>
                <AlertDialogDescription>This category will no longer appear in the menu.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={remove} className="bg-[#E83934] hover:bg-[#c72d29]">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </ModuleGuard>
  );
}