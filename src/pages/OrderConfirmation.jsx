import React, { useEffect, useState } from "react";
import { useParams, Link, useOutletContext } from "react-router-dom";
import { api } from "@/api/client";
import { CheckCircle2, Clock } from "lucide-react";
import { peso } from "@/lib/brand";
import StatusBadge from "@/components/StatusBadge";

const TIMELINE = ["Pending", "Confirmed", "Preparing", "Ready", "Out for Delivery", "Completed"];

export default function OrderConfirmation() {
  const { orderNumber } = useParams();
  const { settings } = useOutletContext() || {};
  const [order, setOrder] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.entities.Order.filter({ order_number: orderNumber }).then((list) => {
      if (list.length) setOrder(list[0]);
      else setMissing(true);
    }).catch(()=>setMissing(true));
  }, [orderNumber]);

  if (missing) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-extrabold text-[#581E12]">Order not found</h1>
        <p className="mt-2 text-[#7a4b3a]">Please double-check your order number.</p>
        <Link to="/track" className="mt-6 inline-block rounded-full bg-[#EE8720] text-white px-7 py-3.5 font-bold">Track another order</Link>
      </div>
    );
  }
  if (!order) return <div className="max-w-2xl mx-auto px-4 py-20"><div className="h-64 rounded-3xl bg-white border border-[#F8CFB1] animate-pulse" /></div>;

  const currentIndex = TIMELINE.indexOf(order.status);
  const cancelled = ["Cancelled", "Refunded"].includes(order.status);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center">
        <CheckCircle2 className="w-14 h-14 mx-auto text-[#EE8720]" />
        <h1 className="mt-4 text-3xl font-extrabold text-[#581E12] tracking-tight">Salamat sa order!</h1>
        <p className="mt-2 text-[#7a4b3a]">We received your order. Keep this order number handy.</p>
        <p className="mt-5 inline-block rounded-2xl bg-[#581E12] text-white px-6 py-3 font-mono font-bold tracking-wider">{order.order_number}</p>
        <p className="mt-3 text-xs text-[#7a4b3a]">Save your private tracking code: {new URLSearchParams(location.search).get('token') || localStorage.getItem('order_token_'+order.order_number)}</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <StatusBadge status={order.status} />
          <span className="text-sm text-[#7a4b3a] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#EE8720]" /> approx. {settings?.prep_time_minutes || 30} min prep
          </span>
        </div>
      </div>

      <div className="mt-10 bg-white rounded-2xl border border-[#F8CFB1] p-6 shadow-sm">
        <p className="font-bold text-[#581E12] mb-5">Order status</p>
        {cancelled ? (
          <p className="text-sm font-semibold text-[#E83934]">This order was {order.status.toLowerCase()}.</p>
        ) : (
          <ol className="space-y-4">
            {TIMELINE.map((s, i) => {
              const done = i <= currentIndex;
              return (
                <li key={s} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold ${done ? "bg-[#EE8720] text-white" : "bg-[#F8CFB1]/60 text-[#7a4b3a]"}`}>
                    {i + 1}
                  </span>
                  <span className={`text-sm ${done ? "font-bold text-[#581E12]" : "text-[#7a4b3a]/60"}`}>{s}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="mt-5 bg-white rounded-2xl border border-[#F8CFB1] p-6 shadow-sm">
        <p className="font-bold text-[#581E12]">Order summary</p>
        <div className="mt-4 space-y-3">
          {(order.items || []).map((i, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-[#7a4b3a]">{i.quantity}× {i.product_name} <span className="block text-xs opacity-70">{i.variant_name}</span></span>
              <span className="font-semibold text-[#581E12]">{peso(i.subtotal, settings?.currency_symbol)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-[#F8CFB1] space-y-2 text-sm">
          <div className="flex justify-between text-[#7a4b3a]"><span>Subtotal</span><span>{peso(order.subtotal, settings?.currency_symbol)}</span></div>
          {!!order.delivery_fee && <div className="flex justify-between text-[#7a4b3a]"><span>Delivery fee</span><span>{peso(order.delivery_fee, settings?.currency_symbol)}</span></div>}
          {!!order.tax && <div className="flex justify-between text-[#7a4b3a]"><span>Tax</span><span>{peso(order.tax, settings?.currency_symbol)}</span></div>}
          <div className="flex justify-between text-lg font-extrabold text-[#581E12]"><span>Total</span><span>{peso(order.total, settings?.currency_symbol)}</span></div>
          <p className="text-[#7a4b3a] pt-2">Payment: <b>{order.payment_method}</b> · {order.payment_status}</p>
          <p className="text-[#7a4b3a]">Order type: <b>{order.order_type}</b></p>
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link to="/menu" className="rounded-full bg-[#EE8720] text-white px-6 py-3 font-bold hover:bg-[#d97612]">Order again</Link>
        <Link to="/track" className="rounded-full border border-[#F8CFB1] bg-white px-6 py-3 font-semibold text-[#581E12]">Track order</Link>
      </div>
    </div>
  );
}
