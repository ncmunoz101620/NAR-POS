import React, { useEffect, useState } from "react";
import { api, request } from "@/api/client";
import { Search, Printer, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import StatusBadge from "@/components/StatusBadge";
import OrderDetailDialog from "@/components/admin/OrderDetailDialog";
import OrderEditDialog from "@/components/admin/OrderEditDialog";
import OrderExportDialog from "@/components/admin/OrderExportDialog";
import OrderDateFilter from "@/components/admin/OrderDateFilter";
import OrderSummaryCards from "@/components/admin/OrderSummaryCards";
import BranchFilter from "@/components/admin/BranchFilter";
import { peso, ORDER_STATUSES } from "@/lib/brand";
import { loadSettings, updateOrderStatus } from "@/lib/pos";
import { formatManilaDate, toManilaDate } from "@/lib/datetime";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

const PAGE = 12;

export default function AdminOrders() {
  const { toast } = useToast();
  const session = useOutletContext();
  const userBranch = session?.appUser?.branch && session.appUser.branch !== "All" ? session.appUser.branch : null;
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [active, setActive] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkReason, setBulkReason] = useState("");
  const todayStr = new Date().toLocaleDateString("en-CA");
  const [dateType, setDateType] = useState("created");
  const [interval, setIntervalType] = useState("today");
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [branch, setBranch] = useState("all");

  const [listing,setListing]=useState({total:0,last_page:1,summary:{totalOrders:0,totalAmount:0,byMethod:{}}});
  const [exportOrders,setExportOrders]=useState([]);
  const params=()=>new URLSearchParams({from:dateFrom,to:dateTo,date_type:dateType==='created'?'created':'preferred',branch:userBranch || branch,status,q,page:String(page+1)});
  const refresh=()=>request('/orders?'+params()).then(result=>{setOrders(result.data);setListing(result);setLoading(false);}).catch(e=>{setLoading(false);toast({title:e.message,variant:'destructive'});});
  const openExport=async()=>{try{const p=params();p.set('export','1');setExportOrders(await request('/orders?'+p));setExportOpen(true);}catch(e){toast({title:e.message,variant:'destructive'});}};
  useEffect(()=>{setPage(0);setSelected(new Set());},[q,status,branch,userBranch,dateType,dateFrom,dateTo]);

  useEffect(()=>{loadSettings().then(setSettings);},[]);
  useEffect(()=>{refresh();},[q,status,branch,userBranch,dateType,dateFrom,dateTo,page]);

  // Realtime: keep the list in sync even when the user is idle.
  useEffect(() => {
    const timer=setInterval(refresh,15000);
    return ()=>clearInterval(timer);
  }, [q,status,branch,userBranch,dateType,dateFrom,dateTo,page]);

  const applyInterval = (v) => {
    setIntervalType(v);
    const now = new Date();
    const fmt = (dt) => dt.toLocaleDateString("en-CA");
    if (v === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      setDateFrom(fmt(start));
      setDateTo(fmt(start));
    } else if (v === "yesterday") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      setDateFrom(fmt(start));
      setDateTo(fmt(start));
    } else if (v === "weekly") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      setDateFrom(fmt(start));
      setDateTo(fmt(end));
    } else if (v === "monthly") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDateFrom(fmt(start));
      setDateTo(fmt(end));
    } else {
      setDateFrom("");
      setDateTo("");
    }
  };

  const summary=listing.summary;
  const pages=listing.last_page;
  const rows=orders;
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.entities.Order.delete(deleteTarget.id);

      toast({ title: `Order ${deleteTarget.order_number} deleted` });
      setDeleteTarget(null);
      refresh();
    } catch (e) {
      toast({ title: "Failed to delete order", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allOnPageSelected = rows.length > 0 && rows.every((o) => selected.has(o.id));
  const toggleSelectAll = () => setSelected((s) => {
    const next = new Set(s);
    if (allOnPageSelected) rows.forEach((o) => next.delete(o.id));
    else rows.forEach((o) => next.add(o.id));
    return next;
  });
  const applyBulkStatus = async (userName) => {
    if (!bulkStatus || !selected.size) return;
    if (bulkStatus === "Cancelled" && !bulkReason.trim()) {
      toast({ title: "Cancellation reason required", description: "Please enter a reason for cancelling these orders.", variant: "destructive" });
      return;
    }
    setBulkBusy(true);
    const targets = orders.filter((o) => selected.has(o.id));
    let ok = 0;
    for (const o of targets) {
      try { await updateOrderStatus(o, bulkStatus, userName, undefined, bulkStatus === "Cancelled" ? bulkReason.trim() : undefined); ok++; } catch {}
    }
    setBulkBusy(false);
    setSelected(new Set());
    setBulkStatus("");
    setBulkReason("");
    toast({ title: `${ok} order(s) updated to ${bulkStatus}` });
    refresh();
  };

  return (
    <ModuleGuard module="orders">
      {(session) => (
        <>
          <PageHeader title="Orders" subtitle={`${listing.total} order(s)`} />

          <div className="mb-4 space-y-4">
            <OrderSummaryCards summary={summary} currencySymbol={settings?.currency_symbol} />
            <OrderDateFilter
              dateType={dateType}
              interval={interval}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateType={(v) => { setDateType(v); setPage(0); }}
              onInterval={(v) => { applyInterval(v); setPage(0); }}
              onDateFrom={(v) => { setDateFrom(v); setIntervalType(""); setPage(0); }}
              onDateTo={(v) => { setDateTo(v); setIntervalType(""); setPage(0); }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#EE8720]" />
                <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Order #, customer, phone, ref…" className="pl-9 w-72 bg-white border-[#F0DFD0]" />
              </div>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
                <SelectTrigger className="w-40 bg-white border-[#F0DFD0]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {!userBranch && <BranchFilter value={branch} onChange={(v) => { setBranch(v); setPage(0); }} />}
              <button
                onClick={openExport}
                disabled={!listing.total}
                className="inline-flex items-center gap-2 rounded-full bg-[#581E12] text-white px-4 py-2 text-sm font-bold hover:bg-[#6b2a1c] disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Export to Excel
              </button>
            </div>
          </div>

          {selected.size > 0 && session.can("orders", "edit") && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#EE8720] bg-[#FBF6EF] px-4 py-3">
              <span className="text-sm font-bold text-[#581E12]">{selected.size} selected</span>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-44 bg-white border-[#F0DFD0]"><SelectValue placeholder="Set status to…" /></SelectTrigger>
                <SelectContent>{ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              {bulkStatus === "Cancelled" && (
                <Input
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="Cancellation reason (required) *"
                  className="flex-1 min-w-[200px] bg-white border-red-200"
                />
              )}
              <button
                onClick={() => applyBulkStatus(session?.appUser?.name || session?.authUser?.full_name || "Admin")}
                disabled={!bulkStatus || bulkBusy || (bulkStatus === "Cancelled" && !bulkReason.trim())}
                className="rounded-full bg-[#EE8720] text-white px-5 py-2 text-sm font-bold disabled:opacity-50"
              >
                {bulkBusy ? "Updating…" : "Apply"}
              </button>
              <button onClick={() => { setSelected(new Set()); setBulkStatus(""); setBulkReason(""); }} className="text-sm font-semibold text-[#7a4b3a] hover:text-[#581E12]">Clear</button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#F0DFD0] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="bg-[#FBF6EF] text-[#7a4b3a]">
                  <tr className="text-left">
                    <th className="px-4 py-3 w-10">
                      <Checkbox checked={allOnPageSelected} onCheckedChange={toggleSelectAll} aria-label="Select all on page" />
                    </th>
                    {["Order #", "Created", "Preferred", "Customer", "Phone", "Items", "Products", "Total", "Payment", "Status", "Source", ""].map((h) => (
                      <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={13} className="px-4 py-12 text-center text-[#7a4b3a]/60">Loading orders…</td></tr>}
                  {!loading && !rows.length && <tr><td colSpan={13} className="px-4 py-12 text-center text-[#7a4b3a]/60">No orders found.</td></tr>}
                  {rows.map((o) => (
                    <tr key={o.id} onClick={() => setActive(o)} className="border-t border-[#F7EEE5] hover:bg-[#FFFBF6] cursor-pointer">
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleSelect(o.id)} aria-label={`Select ${o.order_number}`} /></td>
                      <td className="px-4 py-3 font-mono font-bold text-[#581E12] whitespace-nowrap">{o.order_number}</td>
                      <td className="px-4 py-3 text-[#7a4b3a] whitespace-nowrap">
                        <span className="block">{formatManilaDate(o.created_date)}</span>
                        <span className="block text-xs text-[#7a4b3a]/70">{toManilaDate(o.created_date).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" })}</span>
                      </td>
                      <td className="px-4 py-3 text-[#7a4b3a] whitespace-nowrap">{o.preferred_date || "—"} {o.preferred_time || ""}</td>
                      <td className="px-4 py-3 font-semibold text-[#581E12]">{o.customer_name}</td>
                      <td className="px-4 py-3 text-[#7a4b3a]">{o.customer_phone}</td>
                      <td className="px-4 py-3 text-[#7a4b3a]">{(o.items || []).reduce((s, i) => s + i.quantity, 0)}</td>
                      <td className="px-4 py-3 text-[#7a4b3a] max-w-[220px]">
                        <div className="text-xs leading-snug line-clamp-2" title={(o.items || []).map((i) => `${i.quantity}x ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ""}`).join(", ")}>
                          {(o.items || []).map((i) => `${i.quantity}x ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ""}`).join(", ") || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-[#581E12] whitespace-nowrap">
                        {peso(o.total, settings?.currency_symbol)}
                        {o.discount > 0 && (
                          <span className="block text-xs font-semibold text-red-600">−{peso(o.discount, settings?.currency_symbol)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#7a4b3a] whitespace-nowrap">{o.payment_method}{o.gcash_type && <span className="block text-xs opacity-70">{o.gcash_type}</span>}</td>
                      <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-semibold text-[#581E12]">{o.created_by_name || "—"}</span>
                        <span className="block text-[10px] uppercase tracking-wider text-[#7a4b3a]/60">{o.customer_source || "—"}</span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button onClick={() => setActive(o)} className="p-2 rounded-lg hover:bg-[#F8CFB1]/40 text-[#581E12]" title="View"><Eye className="w-4 h-4" /></button>
                          {session.can("orders", "edit") && (
                            <button onClick={() => setEditTarget(o)} className="p-2 rounded-lg hover:bg-[#F8CFB1]/40 text-[#EE8720]" title="Edit order"><Pencil className="w-4 h-4" /></button>
                          )}
                          {session.can("orders", "print") && (
                            <button onClick={() => setActive({ ...o, _print: true })} className="p-2 rounded-lg hover:bg-[#F8CFB1]/40 text-[#581E12]" title="Print receipt"><Printer className="w-4 h-4" /></button>
                          )}
                          {session.can("orders", "delete") && (
                            <button onClick={() => setDeleteTarget(o)} className="p-2 rounded-lg hover:bg-red-50 text-red-600" title="Delete order"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#F7EEE5] text-sm text-[#7a4b3a]">
              <span>Page {page + 1} of {pages}</span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(page - 1)} className="p-2 rounded-lg border border-[#F0DFD0] disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="p-2 rounded-lg border border-[#F0DFD0] disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          {active && (
            <OrderDetailDialog
              order={active}
              settings={settings}
              session={session}
              openPrint={active._print}
              onClose={() => setActive(null)}
              onChanged={refresh}
            />
          )}

          {editTarget && (
            <OrderEditDialog
              order={editTarget}
              settings={settings}
              session={session}
              onClose={() => setEditTarget(null)}
              onChanged={refresh}
            />
          )}

          <OrderExportDialog open={exportOpen} onClose={() => setExportOpen(false)} orders={exportOrders} />

          <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-[#581E12]">Delete order?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete order <b className="font-mono">{deleteTarget?.order_number}</b> for {deleteTarget?.customer_name}. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
                  {deleting ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </ModuleGuard>
  );
}
