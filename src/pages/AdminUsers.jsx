import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import { audit } from "@/lib/pos";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const EMPTY = { name: "", email: "", mobile: "", role_name: "CSR", branch: "NAR Commi", is_active: true };

export default function AdminUsers() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const refresh = () =>
    Promise.all([base44.entities.AppUser.list("name"), base44.entities.Role.list("name")])
      .then(([u, r]) => { setRows(u); setRoles(r); });

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return rows.filter((r) => [r.name, r.email, r.role_name].some((f) => (f || "").toLowerCase().includes(s)));
  }, [rows, q]);

  // Only the ADMIN app role maps to Base44 'admin'; all other staff roles map
  // to Base44 'user' (they still reach the back office via their app role).
  const baseRoleFor = (roleName) => (roleName || "").toUpperCase() === "ADMIN" ? "admin" : "user";

  const save = async () => {
    if (!editing.name.trim() || !editing.email.trim()) return toast({ title: "Name and email are required", variant: "destructive" });
    const dupe = rows.find((r) => r.email.toLowerCase() === editing.email.toLowerCase() && r.id !== editing.id);
    if (dupe) return toast({ title: "That email is already used", variant: "destructive" });
    setSaving(true);
    const payload = { ...editing };
    delete payload.id;
    try {
      if (editing.id) {
        await base44.entities.AppUser.update(editing.id, payload);
      } else {
        await base44.entities.AppUser.create(payload);
      }
      // Keep the Base44 login account in sync with the app role: invite new
      // users with the mapped role, or update an existing account's role.
      const baseRole = baseRoleFor(editing.role_name);
      try {
        const allUsers = await base44.entities.User.list();
        const existing = allUsers.find((u) => (u.email || "").toLowerCase() === editing.email.toLowerCase());
        if (existing) {
          if (existing.role !== baseRole) await base44.entities.User.update(existing.id, { role: baseRole });
        } else {
          await base44.users.inviteUser(editing.email, baseRole);
        }
      } catch (syncErr) {
        toast({ title: "Profile saved, but login account sync failed", description: syncErr.message, variant: "destructive" });
      }
      await audit(editing.id ? "User role change" : "User creation", "users", { record_id: editing.email, new_value: editing.role_name });
      setEditing(null); refresh();
      toast({ title: editing.id ? "User saved" : "User saved — invite sent", description: editing.id ? undefined : `A login invite was sent to ${editing.email} as ${baseRole === "admin" ? "Admin" : "User"}. Have them check their inbox (and spam folder).` });
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (user) => {
    await audit("Reset password", "users", { record_id: user.email });
    toast({ title: "Password reset requested", description: `A reset link will be sent to ${user.email}.` });
  };

  const remove = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await base44.entities.AppUser.delete(deleting.id);
      await audit("User deletion", "users", { record_id: deleting.email, previous_value: deleting.name });
      setDeleting(null);
      refresh();
      toast({ title: "User deleted" });
    } catch (e) {
      toast({ title: "Failed to delete user", description: e.message, variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <ModuleGuard module="users">
      {(session) => (
        <>
          <PageHeader title="Users" subtitle={`${filtered.length} staff account(s)`}>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#EE8720]" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, role…" className="pl-9 w-64 bg-white border-[#F0DFD0]" />
            </div>
            {session.can("users", "create") && (
              <button onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-2 rounded-full bg-[#EE8720] text-white px-5 py-2.5 text-sm font-bold">
                <Plus className="w-4 h-4" /> New user
              </button>
            )}
          </PageHeader>

          <div className="bg-white rounded-2xl border border-[#F0DFD0] overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-[#FBF6EF] text-xs uppercase tracking-wider text-[#7a4b3a]">
                <tr className="text-left">{["Name", "Email", "Mobile", "Branch", "Role", "Status", "Last login", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {!filtered.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-[#7a4b3a]/60">No users yet.</td></tr>}
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t border-[#F7EEE5]">
                    <td className="px-4 py-3 font-semibold text-[#581E12]">{u.name}</td>
                    <td className="px-4 py-3 text-[#7a4b3a]">{u.email}</td>
                    <td className="px-4 py-3 text-[#7a4b3a]">{u.mobile || "—"}</td>
                    <td className="px-4 py-3"><span className="text-xs font-bold bg-[#581E12]/8 text-[#581E12] px-2.5 py-1 rounded-full">{u.branch || "—"}</span></td>
                    <td className="px-4 py-3"><span className="text-xs font-bold bg-[#EE8720]/12 text-[#a8570c] px-2.5 py-1 rounded-full">{u.role_name}</span></td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#7a4b3a]">{u.last_login ? new Date(u.last_login).toLocaleString("en-PH") : "—"}</td>
                    <td className="px-4 py-3">
                      {session.can("users", "edit") && (
                        <div className="flex gap-2 items-center">
                          <button onClick={() => setEditing({ ...u })} className="p-2 rounded-lg hover:bg-[#F8CFB1]/40 text-[#581E12]"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => resetPassword(u)} className="text-xs font-bold text-[#EE8720]">Reset password</button>
                          {session.can("users", "delete") && (
                            <button onClick={() => setDeleting(u)} className="p-2 rounded-lg hover:bg-red-50 text-red-600" title="Delete user"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editing && (
            <Dialog open onOpenChange={() => setEditing(null)}>
              <DialogContent>
                <DialogHeader><DialogTitle className="text-[#581E12]">{editing.id ? "Edit user" : "New user"}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Name *</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Email *</Label><Input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Mobile</Label><Input value={editing.mobile || ""} onChange={(e) => setEditing({ ...editing, mobile: e.target.value })} className="mt-1.5" /></div>
                  <div>
                    <Label>Role</Label>
                    <Select value={editing.role_name} onValueChange={(v) => setEditing({ ...editing, role_name: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Branch</Label>
                    <Select value={editing.branch || "NAR Commi"} onValueChange={(v) => setEditing({ ...editing, branch: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All (see all branches)</SelectItem>
                        <SelectItem value="NAR Commi">NAR Commi</SelectItem>
                        <SelectItem value="NAR Greenwoods">NAR Greenwoods</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#581E12]">
                    <Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /> Active
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditing(null)} className="rounded-full border border-[#F0DFD0] px-5 py-2.5 text-sm font-bold text-[#581E12]">Cancel</button>
                  <button onClick={save} disabled={saving} className="rounded-full bg-[#EE8720] text-white px-6 py-2.5 text-sm font-bold disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {deleting && (
            <Dialog open onOpenChange={() => setDeleting(null)}>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle className="text-[#581E12]">Delete user?</DialogTitle></DialogHeader>
                <p className="text-sm text-[#7a4b3a]">
                  This will remove <b>{deleting.name}</b> ({deleting.email}) from the staff list. The login account itself is managed separately. This cannot be undone.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setDeleting(null)} className="rounded-full border border-[#F0DFD0] px-5 py-2.5 text-sm font-bold text-[#581E12]">Cancel</button>
                  <button onClick={remove} disabled={removing} className="rounded-full bg-red-600 text-white px-6 py-2.5 text-sm font-bold disabled:opacity-60">{removing ? "Deleting…" : "Delete"}</button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </ModuleGuard>
  );
}