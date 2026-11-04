import React, { useEffect, useState } from "react";
import { request } from "@/api/client";
import { Download } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BranchFilter from "@/components/admin/BranchFilter";
import { peso } from "@/lib/brand";

import { exportReport, reportTotal } from "@/lib/reportExport";

function manilaToday() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date()).map(({type,value}) => [type,value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function Report({ title, headers, rows, canExport, totalColumn, totalOverride }) {
  const total = totalColumn == null ? null : totalOverride ?? reportTotal(rows, totalColumn);
  const totalRow = headers.map((_, i) => i === 0 ? "Total Amount" : i === totalColumn ? total : "");
  const exportRows = total === null ? rows : [...rows, totalRow];
  return (
    <div className="bg-white rounded-2xl border border-[#F0DFD0] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F7EEE5]">
        <p className="font-bold text-[#581E12]">{title}</p>
        <div className="flex gap-2">
          {canExport && (
            <>
              <button onClick={() => exportReport(title, headers, exportRows, "csv")} className="inline-flex items-center gap-1.5 rounded-full border border-[#F0DFD0] px-3 py-1.5 text-xs font-bold text-[#581E12]">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={() => exportReport(title, headers, exportRows, "xlsx")} className="inline-flex items-center gap-1.5 rounded-full border border-[#F0DFD0] px-3 py-1.5 text-xs font-bold text-[#581E12]">
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
              <button onClick={() => window.print()} className="rounded-full border border-[#F0DFD0] px-3 py-1.5 text-xs font-bold text-[#581E12]">PDF / Print</button>
            </>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#FBF6EF] text-xs uppercase tracking-wider text-[#7a4b3a]">
            <tr className="text-left">{headers.map((h) => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody>
            {!rows.length && <tr><td colSpan={headers.length} className="px-4 py-10 text-center text-[#7a4b3a]/60">No data for this range.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-[#F7EEE5]">
                {r.map((c, j) => <td key={j} className={`px-4 py-2.5 ${j === 0 ? "font-semibold text-[#581E12]" : "text-[#7a4b3a]"}`}>{c}</td>)}
              </tr>
            ))}
          </tbody>
          {total !== null && <tfoot className="bg-[#FBF6EF] font-bold text-[#581E12]"><tr>{totalRow.map((cell, i) => <td key={i} className="px-4 py-3 border-t border-[#F0DFD0]">{cell}</td>)}</tr></tfoot>}
        </table>
      </div>
    </div>
  );
}

export default function AdminReports() {
  const todayStr=new Date().toLocaleDateString('en-CA');
  const [from,setFrom]=useState(new Date(Date.now()-29*86400000).toLocaleDateString('en-CA'));
  const [to,setTo]=useState(todayStr),[method,setMethod]=useState('all'),[branch,setBranch]=useState('all');
  const [report,setReport]=useState({}),[error,setError]=useState('');
  const [eventName,setEventName]=useState(''),[eventDate,setEventDate]=useState(manilaToday),[eventAmount,setEventAmount]=useState(''),[saving,setSaving]=useState(false),[refresh,setRefresh]=useState(0),[saved,setSaved]=useState('');
  useEffect(()=>{let alive=true;request('/reports/reports?'+new URLSearchParams({from,to,method,branch})).then(r=>{if(alive){setReport(r);setError('');}}).catch(e=>{if(alive)setError(e.message);});return ()=>{alive=false;};},[from,to,method,branch,refresh]);
  const {daily=[],payments=[],productSales=[],categorySales=[],consumption=[],foodCost=[],methods=[],eventSales=[],eventSalesTotal=0,eventSalesCount=0}=report;
  async function saveEvent(event) {
    event.preventDefault();
    setSaving(true); setError(''); setSaved('');
    try {
      await request('/reports/event-sales', 'POST', {event_name:eventName.trim(), event_date:eventDate, amount:eventAmount});
      setSaved(`Event sale recorded for ${eventDate}.`);
      setEventName(''); setEventAmount(''); setRefresh((n)=>n+1);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }
  return (
    <ModuleGuard module="reports">
      {(session) => (
        <>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          <PageHeader title="Reports" subtitle={`${report.validCount || 0} valid order(s) in range`}>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40 bg-white border-[#F0DFD0]" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40 bg-white border-[#F0DFD0]" />
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-44 bg-white border-[#F0DFD0]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payment methods</SelectItem>
                {methods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <BranchFilter value={branch} onChange={setBranch} />
          </PageHeader>

          <Tabs defaultValue="sales">
            <TabsList className="bg-white border border-[#F0DFD0] flex-wrap h-auto">
              <TabsTrigger value="sales">Daily Sales</TabsTrigger>
              <TabsTrigger value="payments">Payment Summary</TabsTrigger>
              <TabsTrigger value="events">Event Sales</TabsTrigger>
              <TabsTrigger value="products">Product Sales</TabsTrigger>
              <TabsTrigger value="categories">Category Sales</TabsTrigger>
              <TabsTrigger value="inventory">Inventory Consumption</TabsTrigger>
              <TabsTrigger value="foodcost">Food Cost</TabsTrigger>
            </TabsList>
            <div className="mt-4">
              <TabsContent value="sales"><Report title="Daily Sales Report" headers={["Date", "Orders", "Gross Sales", "Discounts", "Refunds", "Cancelled", "Cancelled Amount", "Net Sales", "Event Sales"]} rows={daily} canExport={session.can("reports", "export")} /></TabsContent>
              <TabsContent value="payments"><Report title="Payment Summary" headers={["Payment Method", "Orders", "Amount"]} rows={payments} totalColumn={2} canExport={session.can("reports", "export")} /></TabsContent>
              <TabsContent value="events">
                <div className="mb-4 bg-white rounded-2xl border border-[#F0DFD0] p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#7a4b3a]/70">Event Sales</p>
                  <p className="mt-2 text-2xl font-extrabold text-[#581E12]">{peso(eventSalesTotal)}</p>
                  <p className="mt-1 text-xs text-[#7a4b3a]">Included in sales on the event date when all branches and payment methods are selected.</p>
                  {eventSalesCount > 500 && <p className="mt-1 text-xs text-[#7a4b3a]">Showing the latest 500 entries in this range; the total includes all {eventSalesCount} entries.</p>}
                </div>
                {session.can('reports','create') && session.appUser?.branch === 'All' && <form onSubmit={saveEvent} className="mb-4 flex flex-wrap items-end gap-3 bg-white rounded-2xl border border-[#F0DFD0] p-5">
                  <label className="text-sm font-semibold text-[#581E12]">Event Name<Input required maxLength={255} value={eventName} onChange={(e)=>setEventName(e.target.value)} className="mt-1 bg-white border-[#F0DFD0]" /></label>
                  <label className="text-sm font-semibold text-[#581E12]">Date of Event<Input required type="date" value={eventDate} onChange={(e)=>setEventDate(e.target.value)} className="mt-1 bg-white border-[#F0DFD0]" /></label>
                  <label className="text-sm font-semibold text-[#581E12]">Amount<Input required type="number" min="0.01" max="9999999999999.99" step="0.01" value={eventAmount} onChange={(e)=>setEventAmount(e.target.value)} className="mt-1 bg-white border-[#F0DFD0]" /></label>
                  <button disabled={saving} className="rounded-full bg-[#EE8720] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Record Event Sale'}</button>
                  {saved && <p role="status" className="w-full text-sm text-emerald-700">{saved}</p>}
                </form>}
                <Report title="Event Sales" headers={["Event Date", "Event Name", "Recorded", "Amount"]} rows={eventSales} totalColumn={3} totalOverride={peso(eventSalesTotal)} canExport={session.can("reports", "export") && eventSalesCount <= 500} />
              </TabsContent>
              <TabsContent value="products"><Report title="Product Sales Report" headers={["Product", "Variant", "Qty Sold", "Revenue"]} rows={productSales} totalColumn={3} canExport={session.can("reports", "export")} /></TabsContent>
              <TabsContent value="categories"><Report title="Category Sales Report" headers={["Category", "Qty Sold", "Revenue"]} rows={categorySales} totalColumn={2} canExport={session.can("reports", "export")} /></TabsContent>
              <TabsContent value="inventory"><Report title="Inventory Consumption Report" headers={["Ingredient", "Beginning", "Stock In", "Consumption", "Waste", "Adjustment", "Ending"]} rows={consumption} canExport={session.can("reports", "export")} /></TabsContent>
              <TabsContent value="foodcost"><Report title="Food Cost Report" headers={["Product", "Variant", "Selling Price", "Recipe Cost", "Gross Profit", "Margin %"]} rows={foodCost} canExport={session.can("reports", "export")} /></TabsContent>
            </div>
          </Tabs>
        </>
      )}
    </ModuleGuard>
  );
}
