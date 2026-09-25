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

const EMPTY = { name: "", description: "", instructions: "", requires_reference: false, is_active: true, sort_order: 0 };

export default function AdminPaymentMethods() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const refresh = () => base44.entities.PaymentMethod.list("sort_order").then(setRows);
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!editing.name.trim()) return toast({ title: "Payment method name is required", variant: "destructive" });
    const payload = { ...editing, sort_order: Number(editing.sort_order) || 0 };
    delete payload.id;
    if (editing.id) await base44.entities.PaymentMethod.update(editing.id, payload);
    else await base44.entities.PaymentMethod.create(payload);
    await audit("Payment method change", "payment_methods", { record_id: editing.name });
    setEditing(null); refresh();
    toast({ title: "Payment method saved" });
  };

  const remove = async () => {
    await base44.entities.PaymentMethod.delete(confirm.id);
    await audit("Delete payment method", "payment_methods", { record_id: confirm.name });
    setConfirm(null); refresh();
    toast({ title: "Payment method removed" });
  };

  return (
    <ModuleGuard module="payment_methods">
      {(session) => (
        <>
          <PageHeader title="Payment Methods" subtitle="Configurable payment options — gateways can be integrated later">
            {session.can("payment_methods", "create") && (
              <button onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-2 rounded-full bg-[#EE8720] text-white px-5 py-2.5 text-sm font-bold">
                <Plus className="w-4 h-4" /> New method
              </button>
            )}
          </PageHeader>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((m) => (
              <div key={m.id} className="bg-white rounded-2xl border border-[#F0DFD0] p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-[#581E12]">{m.name}</p>
                    <p className="text-sm text-[#7a4b3a]/80 mt-1">{m.description}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                    {m.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                {m.instructions && <p className="mt-3 text-xs bg-[#F5C400]/15 border border-[#F5C400]/30 rounded-xl p-2.5 text-[#6b5200]">{m.instructions}</p>}
                <p className="mt-3 text-xs text-[#7a4b3a]">Reference required: <b>{m.requires_reference ? "Yes" : "No"}</b> · Order {m.sort_order || 0}</p>
                <div className="mt-3 flex gap-1">
                  {session.can("payment_methods", "edit") && <button onClick={() => setEditing({ ...m })} className="p-2 rounded-lg hover:bg-[#F8CFB1]/40 text-[#581E12]"><Pencil className="w-4 h-4" /></button>}
                  {session.can("payment_methods", "delete") && <button onClick={() => setConfirm(m)} className="p-2 rounded-lg hover:bg-[#E83934]/10 text-[#E83934]"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            ))}
          </div>

          {editing && (
            <Dialog open onOpenChange={() => setEditing(null)}>
              <DialogContent>
                <DialogHeader><DialogTitle className="text-[#581E12]">{editing.id ? "Edit payment method" : "New payment method"}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Name *</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Description</Label><Input value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Payment instructions</Label><Textarea value={editing.instructions || ""} onChange={(e) => setEditing({ ...editing, instructions: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Display order</Label><Input type="number" value={editing.sort_order || 0} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} className="mt-1.5" /></div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#581E12]">
                    <Switch checked={!!editing.requires_reference} onCheckedChange={(v) => setEditing({ ...editing, requires_reference: v })} /> Require reference number
                  </label>
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
                <AlertDialogTitle>Remove “{confirm?.name}”?</AlertDialogTitle>
                <AlertDialogDescription>Existing orders keep their recorded payment method.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={remove} className="bg-[#E83934] hover:bg-[#c72d29]">Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </ModuleGuard>
  );
}