import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import { Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import { Input } from "@/components/ui/input";
import { formatManila } from "@/lib/datetime";

export default function AdminAuditLogs() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => { api.entities.AuditLog.list("-created_date", 300).then(setRows); }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return rows.filter((r) => [r.user_name, r.action, r.module, r.record_id].some((f) => (f || "").toLowerCase().includes(s)));
  }, [rows, q]);

  useEffect(() => { setPage(1); }, [q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <ModuleGuard module="audit_logs">
      <PageHeader title="Audit Logs" subtitle={`${filtered.length} recorded action(s)`}>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#EE8720]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user, action, module…" className="pl-9 w-72 bg-white border-[#F0DFD0]" />
        </div>
      </PageHeader>

      <div className="bg-white rounded-2xl border border-[#F0DFD0] overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-[#FBF6EF] text-xs uppercase tracking-wider text-[#7a4b3a]">
            <tr className="text-left">{["Date / Time", "User", "Action", "Module", "Record", "Previous", "New"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {!filtered.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-[#7a4b3a]/60">No audit entries yet.</td></tr>}
            {pageRows.map((r) => (
              <tr key={r.id} className="border-t border-[#F7EEE5]">
                <td className="px-4 py-3 text-[#7a4b3a] whitespace-nowrap">{formatManila(r.created_date)}</td>
                <td className="px-4 py-3 font-semibold text-[#581E12]">{r.user_name || "—"}</td>
                <td className="px-4 py-3 text-[#7a4b3a]">{r.action}</td>
                <td className="px-4 py-3 text-[#7a4b3a]">{r.module}</td>
                <td className="px-4 py-3 text-[#7a4b3a] font-mono text-xs">{r.record_id || "—"}</td>
                <td className="px-4 py-3 text-[#7a4b3a] text-xs">{r.previous_value || "—"}</td>
                <td className="px-4 py-3 text-[#7a4b3a] text-xs max-w-xs break-words whitespace-normal">{r.new_value || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-[#7a4b3a]">
            Page {safePage} of {totalPages} · {filtered.length} entries
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-[#F0DFD0] bg-white text-[#581E12] disabled:opacity-40 hover:border-[#EE8720]"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-[#F0DFD0] bg-white text-[#581E12] disabled:opacity-40 hover:border-[#EE8720]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </ModuleGuard>
  );
}
