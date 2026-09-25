export const LOGO_URL =
  "https://media.base44.com/images/public/user_69c1d7b19397dda792165194/f91cef088_481161528_626196233709587_1778670251383652485_n.png";

export const peso = (n, symbol = "₱") =>
  `${symbol}${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const STATUS_COLORS = {
  Pending: "bg-[#F5C400]/20 text-[#8a6d00] border-[#F5C400]/40",
  Confirmed: "bg-[#EE8720]/15 text-[#a8570c] border-[#EE8720]/30",
  Preparing: "bg-[#E45A82]/15 text-[#a82b50] border-[#E45A82]/30",
  Ready: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Out for Delivery": "bg-sky-100 text-sky-700 border-sky-200",
  Completed: "bg-emerald-600/15 text-emerald-800 border-emerald-600/25",
  Cancelled: "bg-[#E83934]/15 text-[#a8110d] border-[#E83934]/30",
  Refunded: "bg-slate-200 text-slate-700 border-slate-300",
};

export const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Preparing",
  "Ready",
  "Out for Delivery",
  "Completed",
  "Cancelled",
  "Refunded",
];

export const UNITS = ["pcs", "kg", "g", "liter", "ml", "pack", "bottle", "box", "tray", "serving"];