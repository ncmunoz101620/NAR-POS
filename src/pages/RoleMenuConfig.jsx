import React, { useEffect, useState } from "react";
import { api } from "@/api/client";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import { MODULES, ACTIONS } from "@/lib/permissions";

import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function RoleMenuConfig() {
  const { toast } = useToast();
  const [roles, setRoles] = useState([]);
  const [roleId, setRoleId] = useState("");
  const [matrix, setMatrix] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.entities.Role.list("name").then((r) => {
      setRoles(r);
      if (r.length) select(r[0]);
    });
  }, []);

  const select = (role) => {
    setRoleId(role.id);
    const m = {};
    (role.permissions || []).forEach((p) => { m[p.module] = new Set(p.actions || []); });
    setMatrix(m);
  };

  const toggle = (module, action) => {
    setMatrix((prev) => {
      const next = { ...prev };
      const set = new Set(next[module] || []);
      if (set.has(action)) set.delete(action);
      else {
        set.add(action);
        if (action !== "view") set.add("view");
      }
      if (action === "view" && !set.has("view")) set.clear();
      next[module] = set;
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    const permissions = Object.entries(matrix)
      .filter(([, set]) => set.size)
      .map(([module, set]) => ({ module, actions: [...set] }));
    await api.entities.Role.update(roleId, { permissions });

    const fresh = await api.entities.Role.list("name");
    setRoles(fresh);
    setSaving(false);
    toast({ title: "Permissions updated" });
  };

  const role = roles.find((r) => r.id === roleId);

  return (
    <ModuleGuard module="role_menu">
      <PageHeader title="Role Menu Config" subtitle="Control which modules and actions each role can use — the sidebar follows this matrix">
        <Select value={roleId} onValueChange={(v) => select(roles.find((r) => r.id === v))}>
          <SelectTrigger className="w-52 bg-white border-[#F0DFD0]"><SelectValue placeholder="Select role" /></SelectTrigger>
          <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
        </Select>
        <button onClick={save} disabled={!roleId || saving} className="rounded-full bg-[#EE8720] text-white px-6 py-2.5 text-sm font-bold disabled:opacity-60">
          {saving ? "Saving…" : "Save permissions"}
        </button>
      </PageHeader>

      {role && (
        <div className="bg-white rounded-2xl border border-[#F0DFD0] overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-[#FBF6EF] text-xs uppercase tracking-wider text-[#7a4b3a]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Module</th>
                {ACTIONS.map((a) => <th key={a} className="px-3 py-3 font-semibold capitalize">{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m.key} className="border-t border-[#F7EEE5]">
                  <td className="px-4 py-2.5 font-semibold text-[#581E12]">{m.label}<span className="block text-xs font-normal text-[#7a4b3a]/60">{m.group}</span></td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="px-3 py-2.5 text-center">
                      <Checkbox checked={!!matrix[m.key]?.has(a)} onCheckedChange={() => toggle(m.key, a)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModuleGuard>
  );
}
