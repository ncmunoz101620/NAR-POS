import React from "react";
import { LOGO_URL, peso } from "@/lib/brand";
import { formatManila } from "@/lib/datetime";

export default function Receipt({ order, settings }) {
  const s = settings || {};
  const width = s.receipt_width === "58mm" ? 220 : 320;
  return (
    <div className="bg-white text-black mx-auto p-4 print:p-0" style={{ maxWidth: width, fontFamily: "ui-monospace, monospace" }}>
      <div className="text-center">
        {s.receipt_show_logo !== false && <img src={LOGO_URL} alt="logo" className="h-16 w-16 object-contain mx-auto" />}
        <p className="font-bold mt-1">{s.restaurant_name || "Nanay Asa Restaurant"}</p>
        <p className="text-[10px] leading-tight">{s.address || "Antipolo City, Rizal"}</p>
        <p className="text-[10px]">{s.phone || "0917 123 4567"}</p>
        {s.receipt_header && <p className="text-[10px] font-semibold mt-1">{s.receipt_header}</p>}
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <div className="text-[11px] space-y-0.5">
        <p><b>{order.order_number}</b></p>
        <p>{formatManila(order.created_date || Date.now())}</p>
        {s.receipt_show_customer !== false && <p>Customer: {order.customer_name}</p>}
        <p>Type: {order.order_type}{order.table_number ? ` · Table ${order.table_number}` : ""}</p>
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <table className="w-full text-[11px]">
        <tbody>
          {(order.items || []).map((i, idx) => (
            <tr key={idx} className="align-top">
              <td className="py-0.5">
                {i.quantity}× {i.product_name}
                <span className="block text-[10px]">{i.variant_name}</span>
              </td>
              <td className="py-0.5 text-right whitespace-nowrap">{peso(i.subtotal, s.currency_symbol)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-dashed border-black my-2" />
      <div className="text-[11px] space-y-0.5">
        <div className="flex justify-between"><span>Subtotal</span><span>{peso(order.subtotal, s.currency_symbol)}</span></div>
        {!!order.discount && <div className="flex justify-between"><span>Discount</span><span>-{peso(order.discount, s.currency_symbol)}</span></div>}
        {!!order.delivery_fee && <div className="flex justify-between"><span>Delivery Fee</span><span>{peso(order.delivery_fee, s.currency_symbol)}</span></div>}
        {!!order.tax && s.receipt_show_vat !== false && <div className="flex justify-between"><span>VAT</span><span>{peso(order.tax, s.currency_symbol)}</span></div>}
        <div className="flex justify-between font-bold text-sm pt-1"><span>TOTAL</span><span>{peso(order.total, s.currency_symbol)}</span></div>
        <p>Payment: {order.payment_method || "—"} ({order.payment_status})</p>
        {order.payment_reference && <p>Ref: {order.payment_reference}</p>}
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <p className="text-center text-[10px]">{s.receipt_footer || "Salamat po! Kita-kits ulit sa Nanay Asa!"}</p>
    </div>
  );
}
