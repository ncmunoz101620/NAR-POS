import React from "react";
import { Image } from "@/components/ui/image";

export default function ComingSoon({ settings }) {
  const title = settings?.coming_soon_title || "Coming Soon";
  const message = settings?.coming_soon_message || "We are working on something amazing. Stay tuned!";
  const bg = settings?.coming_soon_background_url;
  const logo = settings?.logo_url;
  const restaurant = settings?.restaurant_name || "Nanay Asa";

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
      {bg ? (
        <div className="absolute inset-0">
          <Image src={bg} alt="" className="w-full h-full" fittingType="fill" />
          <div className="absolute inset-0 bg-[#581E12]/70" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#581E12] via-[#7a3520] to-[#EE8720]" />
      )}

      <div className="relative z-10 max-w-xl flex flex-col items-center">
        {logo ? (
          <img src={logo} alt={restaurant} className="h-20 w-auto object-contain mb-6 drop-shadow-lg" />
        ) : (
          <p className="text-[#F8CFB1] font-extrabold uppercase tracking-[0.3em] text-sm mb-6">{restaurant}</p>
        )}
        <h1 className="font-display text-4xl sm:text-6xl font-extrabold text-white drop-shadow-lg">{title}</h1>
        <p className="mt-5 text-lg text-[#F8CFB1]/90 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}