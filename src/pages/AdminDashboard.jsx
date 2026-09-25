import React, { useEffect, useState } from "react";
import { request } from "@/api/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { Banknote, ReceiptText, Clock, CheckCircle2, XCircle, TrendingUp, UtensilsCrossed, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatCard from "@/components/admin/StatCard";
import ModuleGuard from "@/components/admin/ModuleGuard";
import { peso } from "@/lib/brand";
import { Input } from "@/components/ui/input";
import BranchFilter from "@/components/admin/BranchFilter";

const PRESETS = ["Today", "Yesterday", "Last 7 Days", "This Week", "This Month", "Last Month", "This Year", "Custom"];
const COLORS = ["#EE8720", "#581E12", "#F5C400", "#E45A82", "#E83934", "#7a4b3a"];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function rangeFor(preset, custom) {
  const now = new Date();
  const today = startOfDay(now);
  switch (preset) {
    case "Yesterday": {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return [y, today];
    }
    case "Last 7 Days": {
      const s = new Date(today); s.setDate(s.getDate() - 6);
      return [s, new Date(today.getTime() + 86400000)];
    }
    case "This Week": {
      const s = new Date(today); s.setDate(s.getDate() - s.getDay());
      return [s, new Date(today.getTime() + 86400000)];
    }
    case "This Month":
      return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(today.getTime() + 86400000)];
    case "Last Month":
      return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)];
    case "This Year":
      return [new Date(now.getFullYear(), 0, 1), new Date(today.getTime() + 86400000)];
    case "Custom":
      return [
        custom.from ? new Date(custom.from) : new Date(2000, 0, 1),
        custom.to ? new Date(new Date(custom.to).getTime() + 86400000) : new Date(today.getTime() + 86400000),
      ];
    default:
      return [today, new Date(today.getTime() + 86400000)];
  }
}

export default function AdminDashboard() {
  const [preset,setPreset]=useState('This Month');
  const [custom,setCustom]=useState({from:'',to:''});
  const [branch,setBranch]=useState('all');
  const [report,setReport]=useState({});
  const [error,setError]=useState('');
  useEffect(()=>{
    const [from,to]=rangeFor(preset,custom);
    const fmt=d=>d.toLocaleDateString('en-CA');
    let alive=true;
    request('/reports/dashboard?'+new URLSearchParams({from:fmt(from),to:fmt(new Date(to.getTime()-1)),branch}))
      .then(r=>{if(alive){setReport(r);setError('');}}).catch(e=>{if(alive)setError(e.message);});
    return ()=>{alive=false;};
  },[preset,custom,branch]);
  const {sales=0,avg=0,byDay=[],byStatus=[],bySource=[],byPayment=[],lowStock=[]}=report;
  return (
    <ModuleGuard module="dashboard">
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <PageHeader title="Dashboard" subtitle={`${preset} · ${report.validCount || 0} valid orders`}>
        <BranchFilter value={branch} onChange={setBranch} />
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                preset === p ? "bg-[#581E12] text-white border-[#581E12]" : "bg-white text-[#581E12] border-[#F0DFD0] hover:border-[#EE8720]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </PageHeader>

      {preset === "Custom" && (
        <div className="mb-6 flex flex-wrap gap-3 items-end bg-white border border-[#F0DFD0] rounded-2xl p-4">
          <div><p className="text-xs font-semibold text-[#7a4b3a] mb-1">From</p><Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="w-44" /></div>
          <div><p className="text-xs font-semibold text-[#7a4b3a] mb-1">To</p><Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="w-44" /></div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sales" value={peso(sales)} icon={Banknote} tone="orange" hint={`${preset}`} />
        <StatCard label="Orders" value={report.orderCount || 0} icon={ReceiptText} tone="brown" />
        <StatCard label="Pending" value={byStatus.find(s=>s.name==='Pending')?.value || 0} icon={Clock} tone="gold" />
        <StatCard label="Completed" value={byStatus.find(s=>s.name==='Completed')?.value || 0} icon={CheckCircle2} tone="green" />
        <StatCard label="Cancelled" value={byStatus.find(s=>s.name==='Cancelled')?.value || 0} icon={XCircle} tone="red" />
        <StatCard label="Avg Order Value" value={peso(avg)} icon={TrendingUp} tone="pink" />
        <StatCard label="Total Products" value={report.productCount || 0} icon={UtensilsCrossed} tone="brown" />
        <StatCard label="Low Stock Items" value={report.lowStockCount || 0} icon={AlertTriangle} tone="red" />
      </div>

      <div className="grid gap-4 mt-6 lg:grid-cols-3">
        <div className="bg-white rounded-2xl border border-[#F0DFD0] p-5 lg:col-span-2">
          <p className="font-bold text-[#581E12] mb-4">Sales trend</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0DFD0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => peso(v)} />
                <Line type="monotone" dataKey="sales" stroke="#EE8720" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#F0DFD0] p-5">
          <p className="font-bold text-[#581E12] mb-4">Orders by status</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={80} label>
                  {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 mt-4 lg:grid-cols-3">
        <div className="bg-white rounded-2xl border border-[#F0DFD0] p-5">
          <p className="font-bold text-[#581E12] mb-4">Orders by customer source</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySource}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0DFD0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#E45A82" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#F0DFD0] p-5">
          <p className="font-bold text-[#581E12] mb-4">Sales by payment method</p>
          <table className="w-full text-sm">
            <tbody>
              {byPayment.map(([name, amount]) => (
                <tr key={name} className="border-b border-[#F7EEE5] last:border-0">
                  <td className="py-2 text-[#7a4b3a]">{name}</td>
                  <td className="py-2 text-right font-bold text-[#581E12]">{peso(amount)}</td>
                </tr>
              ))}
              {!byPayment.length && <tr><td className="py-4 text-[#7a4b3a]/60">No sales in this range.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-2xl border border-[#F0DFD0] p-5">
          <p className="font-bold text-[#581E12] mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#E83934]" /> Low stock ingredients
          </p>
          <div className="space-y-2">
            {lowStock.map((i) => (
              <div key={i.id} className="flex justify-between text-sm bg-[#E83934]/8 border border-[#E83934]/20 rounded-xl px-3 py-2">
                <span className="font-semibold text-[#581E12]">{i.name}</span>
                <span className="text-[#E83934] font-bold">{i.current_stock} {i.unit}</span>
              </div>
            ))}
            {!report.lowStockCount || 0 && <p className="text-sm text-[#7a4b3a]/60">All ingredients are above minimum stock.</p>}
          </div>
        </div>
      </div>
    </ModuleGuard>
  );
}
