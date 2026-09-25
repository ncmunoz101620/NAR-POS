import React from "react";
import { Utensils, ShoppingBag, Truck, AlertTriangle, Bell } from "lucide-react";

const TYPE_ICON = { "Dine-In": Utensils, Takeout: ShoppingBag, Delivery: Truck };

export default function KitchenOrderCard({ order, onAdvance, canEdit, nextLabel, nextDisabled, isNew }) {
  const TypeIcon = TYPE_ICON[order.order_type] || Utensils;
  const items = order.items || [];
  return (
    <div className={`bg-white rounded-xl border shadow-sm flex flex-col ${isNew ? "ring-2 ring-[#EE8720] animate-pulse border-[#EE8720]" : "border-[#F0DFD0]"}`}>
      {isNew && (
        <div className="bg-[#EE8720] text-white text-xs font-extrabold uppercase tracking-wider px-4 py-1 flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5" /> New order
        </div>
      )}
      <div className="px-4 py-3 border-b border-[#F7EEE5]">
        <div className="flex items-center justify-between">
          <span className="font-mono font-bold text-[#581E12]">#{order.order_number}</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#7a4b3a] bg-[#FBF6EF] rounded-full px-2 py-0.5">
            <TypeIcon className="w-3.5 h-3.5" />
            {order.order_type}
            {order.order_type === "Dine-In" && order.table_number ? ` · ${order.table_number}` : ""}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-[#7a4b3a]">
          <span className="font-medium truncate">{order.customer_name}</span>
          <span className={`inline-flex items-center gap-1 ${order._stale ? "text-[#E83934] font-bold" : ""}`}>
            {order._stale && <AlertTriangle className="w-3 h-3" />}
            {order._elapsed}
          </span>
        </div>
        {order.cook_name && (
          <div className="mt-1.5 text-xs font-semibold text-[#EE8720] bg-[#EE8720]/10 rounded-full px-2 py-0.5 inline-flex items-center gap-1 w-fit">
            <Utensils className="w-3 h-3" /> Prepared by: {order.cook_name}
          </div>
        )}
      </div>
      <div className="px-4 py-3 flex-1 space-y-2 text-sm">
        {items.map((it, i) => (
          <div key={i} className="border-b border-[#F7EEE5] last:border-0 pb-2 last:pb-0">
            <div className="flex gap-2">
              <span className="font-bold text-[#EE8720]">{it.quantity}×</span>
              <div className="flex-1">
                <p className="font-semibold text-[#581E12] leading-tight">
                  {it.product_name}
                  {it.variant_name ? ` · ${it.variant_name}` : ""}
                </p>
                {it.modifiers?.length ? <p className="text-xs text-[#7a4b3a]">{it.modifiers.join(", ")}</p> : null}
                {it.notes ? <p className="text-xs italic text-[#a8570c]">“{it.notes}”</p> : null}
              </div>
            </div>
          </div>
        ))}
        {order.notes ? (
          <p className="text-xs text-[#a8570c] bg-[#FBF6EF] rounded px-2 py-1">Note: {order.notes}</p>
        ) : null}
      </div>
      <div className="p-3">
        <button
          disabled={!canEdit || nextDisabled}
          onClick={onAdvance}
          className="w-full rounded-full bg-[#EE8720] text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50 disabled:cursor-default"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
