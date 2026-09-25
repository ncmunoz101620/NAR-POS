import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Download } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import { peso } from "@/lib/brand";
import { manilaDateString, toManilaDate } from "@/lib/datetime";
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
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [txs, setTxs] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const todayStr = new Date().toLocaleDateString("en-CA");
  const [from, setFrom] = useState(new Date(Date.now() - 29 * 86400000).toLocaleDateString("en-CA"));
  const [to, setTo] = useState(todayStr);
  const [method, setMethod] = useState("all");
  const [branch, setBranch] = useState("all");

  useEffect(() => {
    Promise.all([
      base44.entities.Order.list("-created_date", 500),
      base44.entities.Product.list(),
      base44.entities.Category.list(),
      base44.entities.Ingredient.list("name"),
      base44.entities.InventoryTransaction.list("-created_date", 500),
      base44.entities.Recipe.list(),
    ]).then(([o, p, c, i, t, r]) => { setOrders(o); setProducts(p); setCategories(c); setIngredients(i); setTxs(t); setRecipes(r); });
  }, []);

  const inRange = (d) => {
    if (!from && !to) return true;
    const md = manilaDateString(d);
    if (!md) return false;
    if (from && md < from) return false;
    if (to && md > to) return false;
    return true;
  };

  const scoped = useMemo(
    () => orders.filter((o) => inRange(o.created_date) && (method === "all" || o.payment_method === method) && (branch === "all" || o.branch === branch)),
    [orders, from, to, method, branch]
  );
  const valid = scoped.filter((o) => !["Cancelled", "Refunded"].includes(o.status));

  const daily = useMemo(() => {
    const map = {};
    scoped.forEach((o) => {
      const k = toManilaDate(o.created_date).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" });
      map[k] = map[k] || { orders: 0, gross: 0, discounts: 0, refunds: 0, cancelled: 0, cancelledAmount: 0 };
      map[k].orders += 1;
      map[k].gross += o.total || 0;
      if (o.status === "Refunded") map[k].refunds += o.total || 0;
      else if (o.status === "Cancelled") { map[k].cancelled += 1; map[k].cancelledAmount += o.total || 0; }
      map[k].discounts += o.discount || 0;
    });
    return Object.entries(map).map(([d, v]) => [d, v.orders, peso(v.gross), peso(v.discounts), peso(v.refunds), v.cancelled, peso(v.cancelledAmount), peso(v.gross - v.cancelledAmount - v.refunds)]);
  }, [scoped]);

  const payments = useMemo(() => {
    const map = {};
    valid.forEach((o) => {
      const base = o.payment_method || "Unspecified";
      const isGcash = base.toLowerCase() === "gcash";
      const k = isGcash && o.gcash_type ? `GCash (${o.gcash_type})` : base;
      map[k] = map[k] || { count: 0, amount: 0 };
      map[k].count += 1;
      map[k].amount += o.total || 0;
    });
    return Object.entries(map).map(([k, v]) => [k, v.count, peso(v.amount)]);
  }, [valid]);

  const productSales = useMemo(() => {
    const map = {};
    valid.forEach((o) => (o.items || []).forEach((i) => {
      const k = `${i.product_name}||${i.variant_name}`;
      map[k] = map[k] || { qty: 0, revenue: 0 };
      map[k].qty += i.quantity;
      map[k].revenue += i.subtotal || 0;
    }));
    return Object.entries(map).map(([k, v]) => { const [p, vn] = k.split("||"); return [p, vn, v.qty, peso(v.revenue)]; })
      .sort((a, b) => b[2] - a[2]);
  }, [valid]);

  const categorySales = useMemo(() => {
    const map = {};
    valid.forEach((o) => (o.items || []).forEach((i) => {
      const prod = products.find((p) => p.id === i.product_id);
      const cat = categories.find((c) => c.id === prod?.category_id)?.name || "Uncategorized";
      map[cat] = map[cat] || { qty: 0, revenue: 0 };
      map[cat].qty += i.quantity;
      map[cat].revenue += i.subtotal || 0;
    }));
    return Object.entries(map).map(([k, v]) => [k, v.qty, peso(v.revenue)]);
  }, [valid, products, categories]);

  const consumption = useMemo(
    () => ingredients.map((ing) => {
      const mine = txs.filter((t) => t.ingredient_id === ing.id && inRange(t.created_date) && (branch === "all" || t.branch === branch));
      const sum = (type) => mine.filter((t) => t.type === type).reduce((s, t) => s + t.quantity, 0);
      const stockIn = sum("Stock In");
      const consumed = Math.abs(sum("Sales Consumption"));
      const waste = Math.abs(sum("Waste"));
      const adj = sum("Adjustment");
      const ending = ing.current_stock;
      const beginning = Math.round((ending - stockIn + consumed + waste - adj) * 1000) / 1000;
      return [ing.name, `${beginning} ${ing.unit}`, stockIn, consumed, waste, adj, `${ending} ${ing.unit}`];
    }),
    [ingredients, txs, from, to, branch]
  );

  const foodCost = useMemo(() => {
    const out = [];
    products.forEach((p) => (p.variants || []).forEach((v) => {
      const recipe = recipes.find((r) => r.product_id === p.id && r.variant_name === v.name);
      const cost = (recipe?.items || []).reduce((s, it) => {
        const ing = ingredients.find((x) => x.id === it.ingredient_id);
        return s + (ing?.cost_per_unit || 0) * it.quantity;
      }, 0);
      const profit = v.price - cost;
      out.push([p.name, v.name, peso(v.price), peso(cost), peso(profit), `${v.price ? ((profit / v.price) * 100).toFixed(1) : 0}%`]);
    }));
    return out;
  }, [products, recipes, ingredients]);

  const methods = [...new Set(orders.map((o) => o.payment_method).filter(Boolean))];

  return (
    <ModuleGuard module="reports">
      {(session) => (
        <>
          <PageHeader title="Reports" subtitle={`${valid.length} valid order(s) in range`}>
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