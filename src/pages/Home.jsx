import React, { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "@/api/client";
import { ArrowRight, Flame, Sparkles, Clock, MapPin, Phone } from "lucide-react";
import ProductCard from "@/components/site/ProductCard";
import { LOGO_URL } from "@/lib/brand";

const HERO = "/images/hero.png";

export default function Home() {
  const { settings } = useOutletContext() || {};
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    Promise.all([
      api.entities.Product.filter({ is_active: true }, "sort_order"),
      api.entities.Category.filter({ is_active: true }, "sort_order"),
    ]).then(([p, c]) => {
      setProducts(p);
      setCategories(c);
    });
  }, []);

  const featured = products.filter((p) => p.show_on_landing).slice(0, 6);
  const popular = products.filter((p) => p.is_popular).slice(0, 6);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={settings?.banner_image_url || HERO} alt="Nanay Asa spread" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#581E12]/95 via-[#581E12]/75 to-[#581E12]/25" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-20 sm:py-28">
          <img src={LOGO_URL} alt="Nanay Asa Restaurant" className="h-28 w-28 sm:h-36 sm:w-36 object-contain bg-white/95 rounded-full p-2 shadow-xl" />
          <p className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#F5C400]/20 text-[#F5C400] px-3 py-1 text-xs font-bold tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5" /> Lutong Bahay, Lasang Nanay
          </p>
          <h1 className="mt-4 text-4xl sm:text-6xl font-extrabold text-white leading-[1.05] max-w-2xl tracking-tight">
            Filipino comfort food, <span className="text-[#EE8720]">sakto</span> para sa buong pamilya.
          </h1>
          <p className="mt-5 text-[#F8CFB1] max-w-xl text-base sm:text-lg leading-relaxed">
            Slow-cooked classics served in three generous sizes — Sakto, Family, and Legendary. Order online in minutes, no account needed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 rounded-full bg-[#EE8720] hover:bg-[#d97612] text-white px-7 py-3.5 font-bold shadow-lg transition-all hover:scale-[1.03]"
            >
              Order Now <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/track"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/25 text-white px-7 py-3.5 font-semibold hover:bg-white/20 transition-colors"
            >
              Track my order
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#F8CFB1]/90">
            <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-[#F5C400]" />{settings?.business_hours || "Open daily 9AM – 9PM"}</span>
            <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#F5C400]" />{settings?.address || "Antipolo City, Rizal"}</span>
            <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#F5C400]" />{settings?.phone || "0917 123 4567"}</span>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#581E12] tracking-tight">Browse by category</h2>
        <div className="mt-6 flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {categories.map((c) => (
            <Link
              key={c.id}
              to={`/menu?category=${c.id}`}
              className="shrink-0 rounded-2xl bg-white border border-[#F8CFB1] px-5 py-4 min-w-[150px] shadow-sm hover:shadow-md hover:border-[#EE8720] transition-all"
            >
              <p className="font-bold text-[#581E12]">{c.name}</p>
              <p className="text-xs text-[#7a4b3a]/70 mt-1 line-clamp-1">{c.description || "Tara, kain tayo!"}</p>
            </Link>
          ))}
          {!categories.length && <p className="text-sm text-[#7a4b3a]">Menu categories coming soon.</p>}
        </div>
      </section>

      {/* Featured */}
      <section className="max-w-6xl mx-auto px-4 pb-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#581E12] tracking-tight">Nanay's specials</h2>
          <Link to="/menu" className="text-sm font-bold text-[#EE8720] hover:underline whitespace-nowrap">See full menu →</Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* Promo */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="rounded-3xl bg-gradient-to-r from-[#EE8720] to-[#E45A82] p-8 sm:p-12 text-white shadow-lg">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">
            <Flame className="w-3.5 h-3.5" /> Family Bundle Promo
          </p>
          <h3 className="mt-4 text-2xl sm:text-4xl font-extrabold max-w-xl leading-tight">
            Legendary size for barkada nights — free delivery within Antipolo.
          </h3>
          <Link to="/menu" className="mt-7 inline-flex items-center gap-2 rounded-full bg-white text-[#581E12] px-6 py-3 font-bold hover:bg-[#FFF6EA] transition-colors">
            Grab the promo <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Popular */}
      {!!popular.length && (
        <section className="max-w-6xl mx-auto px-4 pb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#581E12] tracking-tight">Paboritong-paborito</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
