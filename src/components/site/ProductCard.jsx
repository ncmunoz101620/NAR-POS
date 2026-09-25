import React from "react";
import { Link } from "react-router-dom";
import { peso, LOGO_URL } from "@/lib/brand";
import { Image } from "@/components/ui/image";

export default function ProductCard({ product }) {
  const prices = (product.variants || []).map((v) => v.price);
  const from = prices.length ? Math.min(...prices) : 0;
  return (
    <Link
      to={`/product/${product.id}`}
      className="group bg-white rounded-3xl overflow-hidden border border-[#F8CFB1] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      <div className="aspect-[4/3] overflow-hidden bg-[#F8CFB1]/40 grid place-items-center">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <img src={LOGO_URL} alt={product.name} className="h-20 w-20 object-contain opacity-60" />
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start gap-2">
          <h3 className="font-bold text-[#581E12] leading-tight flex-1">{product.name}</h3>
          {product.is_popular && (
            <span className="text-[10px] font-bold uppercase bg-[#F5C400]/25 text-[#8a6d00] px-2 py-0.5 rounded-full">
              Popular
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-[#7a4b3a]/80 line-clamp-2 flex-1">{product.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[#EE8720] font-extrabold">{peso(from)}</span>
          <span className="text-xs font-semibold text-[#581E12] bg-[#F8CFB1]/50 px-3 py-1.5 rounded-full">
            {(product.variants || []).length} sizes
          </span>
        </div>
      </div>
    </Link>
  );
}