import { useEffect, useState } from "react";

const KEY = "na_cart";
const EVT = "na_cart_change";

export const readCart = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};

const write = (items) => {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVT));
};

export const addToCart = (item) => {
  const items = readCart();
  const key = (i) => `${i.product_id}|${i.variant_name}|${(i.modifiers || []).join(",")}|${i.notes || ""}`;
  const found = items.find((i) => key(i) === key(item));
  if (found) found.quantity += item.quantity;
  else items.push(item);
  write(items);
};

export const setQuantity = (index, qty) => {
  const items = readCart();
  if (!items[index]) return;
  if (qty <= 0) items.splice(index, 1);
  else items[index].quantity = qty;
  write(items);
};

export const removeItem = (index) => setQuantity(index, 0);
export const clearCart = () => write([]);

export const cartTotal = (items) =>
  items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

export function useCart() {
  const [items, setItems] = useState(readCart());
  useEffect(() => {
    const sync = () => setItems(readCart());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return { items, total: cartTotal(items), count: items.reduce((s, i) => s + i.quantity, 0) };
}