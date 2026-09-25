import React from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart, setQuantity, removeItem } from "@/lib/cart";
import { peso } from "@/lib/brand";

export default function Cart() {
  const { items, total } = useCart();

  if (!items.length) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <ShoppingBag className="w-12 h-12 mx-auto text-[#EE8720]" />
        <h1 className="mt-5 text-2xl font-extrabold text-[#581E12]">Walang laman ang cart</h1>
        <p className="mt-2 text-[#7a4b3a]">Add some of Nanay's specialties to get started.</p>
        <Link to="/menu" className="mt-7 inline-block rounded-full bg-[#EE8720] hover:bg-[#d97612] text-white px-7 py-3.5 font-bold transition-colors">
          Browse the menu
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-extrabold text-[#581E12] tracking-tight">My Cart</h1>

      <div className="mt-6 space-y-3">
        {items.map((i, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-[#F8CFB1] p-4 flex flex-wrap gap-4 items-center shadow-sm">
            <div className="flex-1 min-w-[180px]">
              <p className="font-bold text-[#581E12]">{i.product_name}</p>
              <p className="text-sm text-[#7a4b3a]">{i.variant_name} · {peso(i.unit_price)} each</p>
              {!!(i.modifiers || []).length && <p className="text-xs text-[#EE8720] mt-1">Add-ons: {i.modifiers.join(", ")}</p>}
              {i.notes && <p className="text-xs text-[#7a4b3a]/70 mt-1 italic">“{i.notes}”</p>}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[#F8CFB1] p-1">
              <button onClick={() => setQuantity(idx, i.quantity - 1)} className="w-8 h-8 rounded-full grid place-items-center hover:bg-[#F8CFB1]/40 text-[#581E12]">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-6 text-center font-bold text-[#581E12]">{i.quantity}</span>
              <button onClick={() => setQuantity(idx, i.quantity + 1)} className="w-8 h-8 rounded-full grid place-items-center hover:bg-[#F8CFB1]/40 text-[#581E12]">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="font-extrabold text-[#581E12] w-24 text-right">{peso(i.unit_price * i.quantity)}</p>
            <button onClick={() => removeItem(idx)} className="p-2 text-[#E83934] hover:bg-[#E83934]/10 rounded-full" aria-label="Remove">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-2xl border border-[#F8CFB1] p-6 shadow-sm">
        <div className="flex justify-between text-[#7a4b3a]"><span>Subtotal</span><span className="font-semibold">{peso(total)}</span></div>
        <div className="flex justify-between mt-3 pt-3 border-t border-[#F8CFB1] text-lg font-extrabold text-[#581E12]">
          <span>Total</span><span>{peso(total)}</span>
        </div>
        <Link to="/checkout" className="mt-6 block text-center rounded-full bg-[#EE8720] hover:bg-[#d97612] text-white px-6 py-3.5 font-bold transition-colors">
          Proceed to Checkout
        </Link>
        <Link to="/menu" className="mt-3 block text-center text-sm font-semibold text-[#7a4b3a] hover:text-[#EE8720]">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}