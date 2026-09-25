import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingCart, Search } from "lucide-react";
import { LOGO_URL } from "@/lib/brand";
import { useCart } from "@/lib/cart";

const links = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/track", label: "Track Order" },
];

export default function SiteHeader() {
  const { count } = useCart();
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#F8CFB1]">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2.5 mr-auto">
          <img src={LOGO_URL} alt="Nanay Asa Restaurant" className="h-11 w-11 object-contain" />
          <span className="font-extrabold text-[#581E12] leading-4 text-lg tracking-tight">
            Nanay Asa
            <span className="block text-[10px] font-semibold tracking-[0.25em] text-[#EE8720]">RESTAURANT</span>
          </span>
        </Link>
        <nav className="hidden sm:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-3 py-2 rounded-full text-sm font-semibold transition-colors ${
                pathname === l.to ? "bg-[#F8CFB1]/60 text-[#581E12]" : "text-[#7a4b3a] hover:bg-[#F8CFB1]/40"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link to="/menu" className="sm:hidden p-2 text-[#581E12]" aria-label="Menu">
          <Search className="w-5 h-5" />
        </Link>
        <Link
          to="/cart"
          className="relative inline-flex items-center gap-2 rounded-full bg-[#EE8720] hover:bg-[#d97612] transition-colors text-white px-4 py-2 text-sm font-bold shadow-sm"
        >
          <ShoppingCart className="w-4 h-4" />
          <span className="hidden sm:inline">Cart</span>
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-[#E83934] text-white text-[11px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}