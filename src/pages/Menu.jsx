import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Search } from "lucide-react";
import ProductCard from "@/components/site/ProductCard";
import { Input } from "@/components/ui/input";

export default function Menu() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const initial = new URLSearchParams(window.location.search).get("category") || "all";
  const [cat, setCat] = useState(initial);

  useEffect(() => {
    Promise.all([
      base44.entities.Product.filter({ is_active: true, show_on_landing: true }, "sort_order"),
      base44.entities.Category.filter({ is_active: true }, "sort_order"),
    ]).then(([p, c]) => {
      const grabCatIds = c.filter((cat) => /grab\s*order/i.test(cat.name)).map((cat) => cat.id);
      setProducts(p.filter((prod) => !grabCatIds.includes(prod.category_id)));
      setCategories(c.filter((cat) => !/grab\s*order/i.test(cat.name)));
      setLoading(false);
    });
  }, []);

  const list = useMemo(
    () =>
      products.filter(
        (p) =>
          (cat === "all" || p.category_id === cat) &&
          p.name.toLowerCase().includes(q.toLowerCase())
      ),
    [products, cat, q]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-[#581E12] tracking-tight">Our Menu</h1>
      <p className="text-[#7a4b3a]/80 mt-2">Pick a dish, choose your size, and add it to your cart.</p>

      <div className="mt-6 relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#EE8720]" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search dishes…"
          className="pl-10 h-11 rounded-full bg-white border-[#F8CFB1]"
        />
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {[{ id: "all", name: "All" }, ...categories].map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
              cat === c.id
                ? "bg-[#581E12] text-white border-[#581E12]"
                : "bg-white text-[#581E12] border-[#F8CFB1] hover:border-[#EE8720]"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-64 rounded-3xl bg-white border border-[#F8CFB1] animate-pulse" />
          ))}
        </div>
      ) : list.length ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <div className="mt-16 text-center text-[#7a4b3a]">
          <p className="font-bold text-[#581E12]">Wala pang ulam dito.</p>
          <p className="text-sm mt-1">Try another category or search word.</p>
        </div>
      )}
    </div>
  );
}