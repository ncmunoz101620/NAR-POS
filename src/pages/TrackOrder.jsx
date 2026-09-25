import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function TrackOrder() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const search = async () => {
    const num = value.trim().toUpperCase();
    if (!num) return setError("Enter your order number");
    setLoading(true);
    setError("");
    const list = await base44.entities.Order.filter({ order_number: num });
    setLoading(false);
    if (list.length) navigate(`/order/${num}`);
    else setError("We couldn't find that order number.");
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="text-3xl font-extrabold text-[#581E12] tracking-tight">Track your order</h1>
      <p className="mt-2 text-[#7a4b3a]">Enter the order number from your confirmation — no account needed.</p>
      <div className="mt-8 flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#EE8720]" />
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="NAR-20260820-0001"
            className="pl-10 h-11 bg-white border-[#F8CFB1] rounded-full font-mono"
          />
        </div>
        <button onClick={search} disabled={loading} className="rounded-full bg-[#EE8720] hover:bg-[#d97612] text-white px-6 font-bold disabled:opacity-60">
          {loading ? "…" : "Track"}
        </button>
      </div>
      {error && <p className="mt-4 text-sm font-semibold text-[#E83934]">{error}</p>}
    </div>
  );
}