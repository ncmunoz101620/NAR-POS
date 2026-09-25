import React from "react";
import { peso } from "@/lib/brand";
import { ShoppingCart, Wallet, CreditCard, Ban } from "lucide-react";

export default function OrderSummaryCards({ summary, currencySymbol }) {
  const { totalOrders, totalAmount, byMethod, cancelledCount = 0, cancelledAmount = 0 } = summary;
  const methods = Object.keys(byMethod).sort();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="bg-white rounded-2xl border border-[#F0DFD0] p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FBF6EF] grid place-items-center">
            <ShoppingCart className="w-5 h-5 text-[#EE8720]" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#7a4b3a]/70">Total Orders</p>
            <p className="text-2xl font-extrabold text-[#581E12]">{totalOrders}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#F0DFD0] p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FBF6EF] grid place-items-center">
            <Wallet className="w-5 h-5 text-[#EE8720]" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#7a4b3a]/70">Total Amount</p>
            <p className="text-2xl font-extrabold text-[#581E12]">{peso(totalAmount, currencySymbol)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#F0DFD0] p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 grid place-items-center">
            <Ban className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#7a4b3a]/70">Cancelled Orders</p>
            <p className="text-2xl font-extrabold text-red-500">{cancelledCount}</p>
            <p className="text-xs font-semibold text-red-400">{peso(cancelledAmount, currencySymbol)}</p>
          </div>
        </div>
      </div>

      {methods.length > 0 ? (
        methods.map((m) => (
          <div key={m} className="bg-white rounded-2xl border border-[#F0DFD0] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FBF6EF] grid place-items-center">
                <CreditCard className="w-5 h-5 text-[#B66D46]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-[#7a4b3a]/70 truncate">{m}</p>
                <p className="text-2xl font-extrabold text-[#581E12]">{peso(byMethod[m], currencySymbol)}</p>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="bg-white rounded-2xl border border-[#F0DFD0] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FBF6EF] grid place-items-center">
              <CreditCard className="w-5 h-5 text-[#B66D46]" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#7a4b3a]/70">By Payment Gateway</p>
              <p className="text-2xl font-extrabold text-[#7a4b3a]/40">—</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}