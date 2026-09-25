import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function TrackOrder() {
  const [value, setValue] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const search = async () => {
    const num = value.trim().toUpperCase();
    if (!num) return setError("Enter your order number");
    setLoading(true);
    setError("");
    try {
      if (token.trim()) localStorage.setItem('order_token_'+num,token.trim());
      const list = await api.entities.Order.filter({ order_number: num });
      if (list.length) navigate(`/order/${num}`);
      else setError("We couldn't find that order number.");
    } catch { setError('Enter the tracking code from your confirmation, or use the original browser.'); }
    finally { setLoading(false); }
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
      <Input value={token} onChange={e=>setToken(e.target.value)} placeholder="Tracking code (when using another browser)" className="mt-3 bg-white border-[#F8CFB1]" />
      {error && <p className="mt-4 text-sm font-semibold text-[#E83934]">{error}</p>}
    </div>
  );
}
