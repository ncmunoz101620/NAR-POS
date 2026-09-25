import React from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone, Clock, Mail } from "lucide-react";
import { LOGO_URL } from "@/lib/brand";

export default function SiteFooter({ settings }) {
  const s = settings || {};
  return (
    <footer id="contact" className="bg-[#581E12] text-[#F8CFB1] mt-20">
      <div className="max-w-6xl mx-auto px-4 py-14 grid gap-10 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Nanay Asa" className="h-14 w-14 object-contain bg-white rounded-full p-1" />
            <div>
              <p className="font-extrabold text-white text-xl">{s.restaurant_name || "Nanay Asa Restaurant"}</p>
              <p className="text-xs tracking-[0.25em] text-[#EE8720] font-semibold">LUTONG BAHAY, LASANG NANAY</p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-[#F8CFB1]/80">
            Home-style Filipino cooking served in generous portions — Sakto, Family, and Legendary.
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-bold text-white uppercase tracking-wider text-xs">Visit Us</p>
          <p className="flex gap-2"><MapPin className="w-4 h-4 text-[#F5C400] shrink-0" />{s.address || "601 & 602 G/F Soledad Bldg., Armal Plaza Building, C. Raymundo Avenue, Bgry. Maybunga, Pasig, Philippines, 1607"}</p>
          <p className="flex gap-2"><Phone className="w-4 h-4 text-[#F5C400] shrink-0" />{s.phone || "0995 728 4162"}</p>
          <p className="flex gap-2"><Clock className="w-4 h-4 text-[#F5C400] shrink-0" />{s.business_hours || "Mon–Sun, 9:00 AM – 9:00 PM"}</p>
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-bold text-white uppercase tracking-wider text-xs">Quick Links</p>
          <Link to="/menu" className="block hover:text-white">Full Menu</Link>
          <Link to="/cart" className="block hover:text-white">My Cart</Link>
          <Link to="/track" className="block hover:text-white">Track My Order</Link>
          <Link to="/admin" className="block hover:text-white">Staff Login</Link>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-[#F8CFB1]/60">
        © {new Date().getFullYear()} {s.restaurant_name || "Nanay Asa Restaurant"}. All rights reserved.
      </div>
    </footer>
  );
}