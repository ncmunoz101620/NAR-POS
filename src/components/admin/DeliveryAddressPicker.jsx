import React, { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { PH_LOCATIONS } from "@/lib/ph-locations";
import { Input } from "@/components/ui/input";

export default function DeliveryAddressPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("province");
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const provinces = Object.keys(PH_LOCATIONS);
  const cities = value.province ? Object.keys(PH_LOCATIONS[value.province] || {}) : [];
  const barangays = value.province && value.city ? PH_LOCATIONS[value.province]?.[value.city] || [] : [];

  const display = [value.barangay, value.city, value.province].filter(Boolean).join(", ");

  const pickProvince = (p) => { onChange({ ...value, province: p, city: "", barangay: "" }); setTab("district"); setQuery(""); };
  const pickCity = (c) => { onChange({ ...value, city: c, barangay: "" }); setTab("barangay"); setQuery(""); };
  const pickBarangay = (b) => { onChange({ ...value, barangay: b }); setOpen(false); setQuery(""); };

  const list = tab === "province" ? provinces : tab === "district" ? cities : barangays;
  const filtered = list.filter((x) => x.toLowerCase().includes(query.toLowerCase()));

  const tabs = [
    { key: "province", label: "Province/State" },
    { key: "district", label: "District" },
    { key: "barangay", label: "Barangay" },
  ];

  const pick = (item) => (tab === "province" ? pickProvince(item) : tab === "district" ? pickCity(item) : pickBarangay(item));
  const selectedKey = tab === "province" ? value.province : tab === "district" ? value.city : value.barangay;

  return (
    <div className="space-y-2" ref={ref}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={display}
            readOnly
            placeholder="Select address"
            onClick={() => setOpen((o) => !o)}
            className="pr-9 cursor-pointer bg-white"
          />
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-[#7a4b3a]/50 pointer-events-none" />
        </div>
        <Input
          value={value.postcode || ""}
          onChange={(e) => onChange({ ...value, postcode: e.target.value })}
          placeholder="Postcode"
          className="w-32 bg-gray-50"
        />
      </div>

      {open && (
        <div className="bg-white rounded-xl border border-[#F0DFD0] shadow-lg z-30">
          <div className="flex border-b border-[#F0DFD0]">
            {tabs.map((t) => {
              const disabled = t.key === "district" && !value.province || t.key === "barangay" && !value.city;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  disabled={disabled}
                  className={`flex-1 px-3 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                    tab === t.key ? "text-[#EE8720] border-[#EE8720]" : "text-[#7a4b3a]/60 border-transparent"
                  } disabled:opacity-40`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="p-2">
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[#7a4b3a]/50" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="pl-8 h-8" />
            </div>
            <div className="max-h-56 overflow-y-auto sidebar-no-scrollbar">
              {filtered.map((item) => (
                <button
                  key={item}
                  onClick={() => pick(item)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedKey === item ? "bg-[#F8CFB1]/50 text-[#581E12]" : "text-[#581E12] hover:bg-[#F7EEE5]"
                  }`}
                >
                  {item}
                </button>
              ))}
              {!filtered.length && <p className="text-xs text-[#7a4b3a]/60 px-3 py-4 text-center">No results</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
