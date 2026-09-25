import React, { useEffect, useState } from "react";
import { api } from "@/api/client";
import { Plus, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";

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

export default function AdminRoles() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const refresh = () => api.entities.Role.list("name").then(setRows);
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    const name = editing.name.trim().toUpperCase();
    if (!name) return toast({ title: "Role name is required", variant: "destructive" });
    if (rows.some((r) => r.name.toUpperCase() === name && r.id !== editing.id))
      return toast({ title: "That role name already exists", variant: "destructive" });
    const payload = { name, description: editing.description, is_active: editing.is_active, permissions: editing.permissions || [] };
    if (editing.id) await api.entities.Role.update(editing.id, payload);
    else await api.entities.Role.create(payload);

    setEditing(null); refresh();
    toast({ title: "Role saved" });
  };

  const remove = async () => {
    const users = await api.entities.AppUser.filter({ role_name: confirm.name });
    if (users.length) {
      setConfirm(null);
      return toast({ title: "Unable to delete this role", description: `${users.length} user(s) are still assigned to it.`, variant: "destructive" });
    }
    await api.entities.Role.delete(confirm.id);

    setConfirm(null); refresh();
    toast({ title: "Role deleted" });
  };

  return (
    <ModuleGuard module="roles">
      {(session) => (
        <>
          <PageHeader title="Roles" subtitle="Roles are fully configurable — add as many as you need">
            {session.can("roles", "create") && (
              <button onClick={() => setEditing({ name: "", description: "", is_active: true, permissions: [] })} className="inline-flex items-center gap-2 rounded-full bg-[#EE8720] text-white px-5 py-2.5 text-sm font-bold">
                <Plus className="w-4 h-4" /> New role
              </button>
            )}
          </PageHeader>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-[#F0DFD0] p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-extrabold text-[#581E12]">{r.name}</p>
                    <p className="text-sm text-[#7a4b3a]/80 mt-1">{r.description || "—"}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-3 text-xs text-[#7a4b3a]">{(r.permissions || []).length} module(s) accessible</p>
                <div className="mt-4 flex gap-1">
                  {session.can("roles", "edit") && <button onClick={() => setEditing({ ...r })} className="p-2 rounded-lg hover:bg-[#F8CFB1]/40 text-[#581E12]"><Pencil className="w-4 h-4" /></button>}
                  {session.can("roles", "delete") && <button onClick={() => setConfirm(r)} className="p-2 rounded-lg hover:bg-[#E83934]/10 text-[#E83934]"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            ))}
          </div>

          {editing && (
            <Dialog open onOpenChange={() => setEditing(null)}>
              <DialogContent>
                <DialogHeader><DialogTitle className="text-[#581E12]">{editing.id ? "Edit role" : "New role"}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Role name *</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1.5" placeholder="e.g. KITCHEN" /></div>
                  <div><Label>Description</Label><Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1.5" /></div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#581E12]">
                    <Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /> Active
                  </label>
                  <p className="text-xs text-[#7a4b3a]">Set which modules and actions this role can use in <b>Role Menu Config</b>.</p>
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
                <AlertDialogTitle>Delete role “{confirm?.name}”?</AlertDialogTitle>
                <AlertDialogDescription>Users assigned to this role must be reassigned first.</AlertDialogDescription>
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
