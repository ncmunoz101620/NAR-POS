import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/api/client";
import { Minus, Plus, ArrowLeft, ShoppingCart } from "lucide-react";
import { peso, LOGO_URL } from "@/lib/brand";
import { addToCart } from "@/lib/cart";
import { Image } from "@/components/ui/image";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [product, setProduct] = useState(null);
  const [variant, setVariant] = useState(null);
  const [qty, setQty] = useState(1);
  const [mods, setMods] = useState([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    api.entities.Product.get(id).then((p) => {
      setProduct(p);
      setVariant((p.variants || []).find((v) => v.is_available !== false) || null);
    });
  }, [id]);

  if (!product) {
    return <div className="max-w-5xl mx-auto px-4 py-20"><div className="h-72 rounded-3xl bg-white border border-[#F8CFB1] animate-pulse" /></div>;
  }

  const modTotal = (product.modifiers || [])
    .filter((m) => mods.includes(m.name))
    .reduce((s, m) => s + (m.price || 0), 0);
  const unitPrice = (variant?.price || 0) + modTotal;

  const add = () => {
    if (!variant) return;
    addToCart({
      product_id: product.id,
      product_name: product.name,
      variant_name: variant.name,
      unit_price: unitPrice,
      quantity: qty,
      modifiers: mods,
      notes,
    });
    toast({ title: "Added to cart", description: `${qty}× ${product.name} (${variant.name})` });
    navigate("/cart");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link to="/menu" className="inline-flex items-center gap-2 text-sm font-semibold text-[#7a4b3a] hover:text-[#EE8720]">
        <ArrowLeft className="w-4 h-4" /> Back to menu
      </Link>

      <div className="mt-5 grid gap-8 md:grid-cols-2">
        <div className="rounded-3xl overflow-hidden bg-[#F8CFB1]/40 aspect-square grid place-items-center border border-[#F8CFB1]">
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <img src={LOGO_URL} alt={product.name} className="h-40 w-40 object-contain opacity-70" />
          )}
        </div>

        <div>
          <h1 className="text-3xl font-extrabold text-[#581E12] tracking-tight">{product.name}</h1>
          <p className="mt-3 text-[#7a4b3a] leading-relaxed">{product.description}</p>

          <p className="mt-7 text-xs font-bold uppercase tracking-widest text-[#7a4b3a]/70">Choose size</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {(product.variants || []).map((v) => {
              const disabled = v.is_available === false;
              const active = variant?.name === v.name;
              return (
                <button
                  key={v.name}
                  disabled={disabled}
                  onClick={() => setVariant(v)}
                  className={`rounded-2xl border p-3 text-left transition-all ${
                    active ? "border-[#EE8720] bg-[#EE8720]/10 ring-2 ring-[#EE8720]/30" : "border-[#F8CFB1] bg-white hover:border-[#EE8720]"
                  } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <span className="block font-bold text-[#581E12]">{v.name}</span>
                  <span className="block text-sm font-extrabold text-[#EE8720] mt-0.5">{peso(v.price)}</span>
                </button>
              );
            })}
          </div>

          {!!(product.modifiers || []).length && (
            <>
              <p className="mt-7 text-xs font-bold uppercase tracking-widest text-[#7a4b3a]/70">Add-ons</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.modifiers.map((m) => {
                  const on = mods.includes(m.name);
                  return (
                    <button
                      key={m.name}
                      onClick={() => setMods(on ? mods.filter((x) => x !== m.name) : [...mods, m.name])}
                      className={`rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${
                        on ? "bg-[#581E12] text-white border-[#581E12]" : "bg-white text-[#581E12] border-[#F8CFB1]"
                      }`}
                    >
                      {m.name} {m.price ? `+${peso(m.price)}` : ""}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <p className="mt-7 text-xs font-bold uppercase tracking-widest text-[#7a4b3a]/70">Special instructions</p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Konting bagoong lang po"
            className="mt-2 bg-white border-[#F8CFB1]"
          />

          <div className="mt-7 flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-full border border-[#F8CFB1] bg-white p-1.5">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 rounded-full grid place-items-center hover:bg-[#F8CFB1]/40 text-[#581E12]">
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-6 text-center font-bold text-[#581E12]">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="w-9 h-9 rounded-full grid place-items-center hover:bg-[#F8CFB1]/40 text-[#581E12]">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={add}
              disabled={!variant}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#EE8720] hover:bg-[#d97612] disabled:opacity-50 text-white px-6 py-3.5 font-bold shadow-md transition-colors"
            >
              <ShoppingCart className="w-4 h-4" /> Add to Cart · {peso(unitPrice * qty)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
