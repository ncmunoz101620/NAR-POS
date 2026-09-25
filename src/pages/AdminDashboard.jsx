import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { Banknote, ReceiptText, Clock, CheckCircle2, XCircle, TrendingUp, UtensilsCrossed, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatCard from "@/components/admin/StatCard";
import ModuleGuard from "@/components/admin/ModuleGuard";
import { peso } from "@/lib/brand";
import { toManilaDate } from "@/lib/datetime";
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
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [preset, setPreset] = useState("This Month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [branch, setBranch] = useState("all");

  useEffect(() => {
    Promise.all([
      base44.entities.Order.list("-created_date", 500),
      base44.entities.Product.list(),
      base44.entities.Ingredient.list(),
    ]).then(([o, p, i]) => {
      setOrders(o);
      setProducts(p);
      setIngredients(i);
    });
  }, []);

  const [from, to] = useMemo(() => rangeFor(preset, custom), [preset, custom]);
  const scoped = useMemo(
    () => orders.filter((o) => {
      if (branch !== "all" && o.branch !== branch) return false;
      const d = toManilaDate(o.created_date);
      return d >= from && d < to;
    }),
    [orders, from, to, branch]
  );

  const valid = scoped.filter((o) => !["Cancelled", "Refunded"].includes(o.status));
  const sales = valid.reduce((s, o) => s + (o.total || 0), 0);
  const avg = valid.length ? sales / valid.length : 0;
  const lowStock = ingredients.filter((i) => i.current_stock <= (i.min_stock || 0));

  const byDay = useMemo(() => {
    const map = {};
    scoped.forEach((o) => {
      const k = toManilaDate(o.created_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" });
      map[k] = map[k] || { day: k, sales: 0, orders: 0 };
      if (!["Cancelled", "Refunded"].includes(o.status)) map[k].sales += o.total || 0;
      map[k].orders += 1;
    });
    return Object.values(map).reverse();
  }, [scoped]);

  const byStatus = useMemo(() => {
    const map = {};
    scoped.forEach((o) => { map[o.status] = (map[o.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [scoped]);

  const bySource = useMemo(() => {
    const map = {};
    scoped.forEach((o) => { map[o.customer_source || "—"] = (map[o.customer_source || "—"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [scoped]);

  const byPayment = useMemo(() => {
    const map = {};
    valid.forEach((o) => { map[o.payment_method || "Unspecified"] = (map[o.payment_method || "Unspecified"] || 0) + (o.total || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [valid]);

  return (
    <ModuleGuard module="dashboard">
      <PageHeader title="Dashboard" subtitle={`${preset} · ${valid.length} valid orders`}>
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
        <StatCard label="Orders" value={scoped.length} icon={ReceiptText} tone="brown" />
        <StatCard label="Pending" value={scoped.filter((o) => o.status === "Pending").length} icon={Clock} tone="gold" />
        <StatCard label="Completed" value={scoped.filter((o) => o.status === "Completed").length} icon={CheckCircle2} tone="green" />
        <StatCard label="Cancelled" value={scoped.filter((o) => o.status === "Cancelled").length} icon={XCircle} tone="red" />
        <StatCard label="Avg Order Value" value={peso(avg)} icon={TrendingUp} tone="pink" />
        <StatCard label="Total Products" value={products.length} icon={UtensilsCrossed} tone="brown" />
        <StatCard label="Low Stock Items" value={lowStock.length} icon={AlertTriangle} tone="red" />
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
            {!lowStock.length && <p className="text-sm text-[#7a4b3a]/60">All ingredients are above minimum stock.</p>}
          </div>
        </div>
      </div>
    </ModuleGuard>
  );
}