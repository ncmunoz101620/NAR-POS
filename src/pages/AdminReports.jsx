import React, { useEffect, useState } from "react";
import { request } from "@/api/client";
import { Download } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BranchFilter from "@/components/admin/BranchFilter";

const toCSV = (title, headers, rows) => {
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
};

function Report({ title, headers, rows, canExport }) {
  return (
    <div className="bg-white rounded-2xl border border-[#F0DFD0] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F7EEE5]">
        <p className="font-bold text-[#581E12]">{title}</p>
        <div className="flex gap-2">
          {canExport && (
            <>
              <button onClick={() => toCSV(title, headers, rows)} className="inline-flex items-center gap-1.5 rounded-full border border-[#F0DFD0] px-3 py-1.5 text-xs font-bold text-[#581E12]">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={() => toCSV(title + " excel", headers, rows)} className="inline-flex items-center gap-1.5 rounded-full border border-[#F0DFD0] px-3 py-1.5 text-xs font-bold text-[#581E12]">
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
  useEffect(()=>{let alive=true;request('/reports/reports?'+new URLSearchParams({from,to,method,branch})).then(r=>{if(alive){setReport(r);setError('');}}).catch(e=>{if(alive)setError(e.message);});return ()=>{alive=false;};},[from,to,method,branch]);
  const {daily=[],payments=[],productSales=[],categorySales=[],consumption=[],foodCost=[],methods=[]}=report;
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
              <TabsTrigger value="products">Product Sales</TabsTrigger>
              <TabsTrigger value="categories">Category Sales</TabsTrigger>
              <TabsTrigger value="inventory">Inventory Consumption</TabsTrigger>
              <TabsTrigger value="foodcost">Food Cost</TabsTrigger>
            </TabsList>
            <div className="mt-4">
              <TabsContent value="sales"><Report title="Daily Sales Report" headers={["Date", "Orders", "Gross Sales", "Discounts", "Refunds", "Cancelled", "Cancelled Amount", "Net Sales"]} rows={daily} canExport={session.can("reports", "export")} /></TabsContent>
              <TabsContent value="payments"><Report title="Payment Summary" headers={["Payment Method", "Orders", "Amount"]} rows={payments} canExport={session.can("reports", "export")} /></TabsContent>
              <TabsContent value="products"><Report title="Product Sales Report" headers={["Product", "Variant", "Qty Sold", "Revenue"]} rows={productSales} canExport={session.can("reports", "export")} /></TabsContent>
              <TabsContent value="categories"><Report title="Category Sales Report" headers={["Category", "Qty Sold", "Revenue"]} rows={categorySales} canExport={session.can("reports", "export")} /></TabsContent>
              <TabsContent value="inventory"><Report title="Inventory Consumption Report" headers={["Ingredient", "Beginning", "Stock In", "Consumption", "Waste", "Adjustment", "Ending"]} rows={consumption} canExport={session.can("reports", "export")} /></TabsContent>
              <TabsContent value="foodcost"><Report title="Food Cost Report" headers={["Product", "Variant", "Selling Price", "Recipe Cost", "Gross Profit", "Margin %"]} rows={foodCost} canExport={session.can("reports", "export")} /></TabsContent>
            </div>
          </Tabs>
        </>
      )}
    </ModuleGuard>
  );
}
