import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext, Link } from "react-router-dom";
import { api } from "@/api/client";
import { useCart, clearCart } from "@/lib/cart";
import { peso } from "@/lib/brand";

import { PH_LOCATIONS } from "@/lib/ph-locations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Checkout() {
  const { settings } = useOutletContext() || {};
  const { items, total } = useCart();
  const navigate = useNavigate();
  const [methods, setMethods] = useState([]);
  const [form, setForm] = useState({
    customer_name: "", customer_phone: "", customer_email: "", order_type: "Delivery",
    province: "", city: "", barangay: "", address: "", landmark: "",
    preferred_date: "", preferred_time: "", notes: "", payment_method: "", payment_reference: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [requestKey] = useState(()=>crypto.randomUUID());

  useEffect(() => {
    api.entities.PaymentMethod.filter({ is_active: true }, "sort_order").then((m) => {
      setMethods(m);
      setForm((f) => ({ ...f, payment_method: f.payment_method || m[0]?.name || "" }));
    });
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isDelivery = form.order_type === "Delivery";
  const deliveryFee = isDelivery ? settings?.delivery_fee || 0 : 0;
  const grandTotal = total + deliveryFee;
  const selectedMethod = methods.find((m) => m.name === form.payment_method);

  const types = [
    ["Delivery", settings?.enable_delivery !== false],
    ["Takeout", settings?.enable_takeout !== false],
    ["Dine-In", settings?.enable_dinein !== false],
  ].filter(([, on]) => on).map(([t]) => t);

  const submit = async () => {
    const e = {};
    if (!form.customer_name.trim()) e.customer_name = "Required";
    if (!form.customer_phone.trim()) e.customer_phone = "Required";
    if (isDelivery) {
      if (!form.province) e.province = "Required";
      if (!form.city) e.city = "Required";
      if (!form.barangay) e.barangay = "Required";
      if (!form.address.trim()) e.address = "Required";
    }
    if (!form.payment_method) e.payment_method = "Required";
    if (selectedMethod?.requires_reference && !form.payment_reference.trim()) e.payment_reference = "Reference number required";
    if (!items.length) e.cart = "Your cart is empty";
    if ((settings?.min_order || 0) > total) e.cart = `Minimum order is ${peso(settings.min_order)}`;
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
    const now = new Date().toISOString();
    const tax = Math.round(total * ((settings?.tax_rate || 0) / 100) * 100) / 100;
    const order = await api.entities.Order.create({
      ...form,
      request_key: requestKey,
      status: "Pending",
      payment_status: "Unpaid",
      subtotal: total,
      delivery_fee: deliveryFee,
      tax,
      total: grandTotal + tax,
      source: "Online",
      created_by_name: "Guest",
      items: items.map((i) => ({ ...i, subtotal: i.unit_price * i.quantity })),
      status_history: [{ status: "Pending", at: now, by: "Guest" }],
    });
    clearCart();
    navigate(`/order/${order.order_number}`);
    } catch (error) {
      setErrors({cart:error.message});
    } finally { setSaving(false); }
  };

  const cities = form.province ? Object.keys(PH_LOCATIONS[form.province] || {}) : [];
  const barangays = form.province && form.city ? PH_LOCATIONS[form.province]?.[form.city] || [] : [];

  if (!items.length) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-extrabold text-[#581E12]">Your cart is empty</h1>
        <Link to="/menu" className="mt-6 inline-block rounded-full bg-[#EE8720] text-white px-7 py-3.5 font-bold">Browse the menu</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="text-3xl font-extrabold text-[#581E12] tracking-tight">Checkout</h1>
        <p className="text-[#7a4b3a]/80 mt-2">No account needed — just your details and you're set.</p>

        <section className="mt-7 bg-white rounded-2xl border border-[#F8CFB1] p-6 shadow-sm space-y-4">
          <p className="font-bold text-[#581E12]">Customer information</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name *" error={errors.customer_name}>
              <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="Juan Dela Cruz" />
            </Field>
            <Field label="Mobile number *" error={errors.customer_phone}>
              <Input value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} placeholder="0917 123 4567" />
            </Field>
            <Field label="Email (optional)">
              <Input value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} placeholder="juan@email.com" />
            </Field>
            <Field label="Order type">
              <Select value={form.order_type} onValueChange={(v) => set("order_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
        </section>

        {isDelivery && (
          <section className="mt-5 bg-white rounded-2xl border border-[#F8CFB1] p-6 shadow-sm space-y-4">
            <p className="font-bold text-[#581E12]">Delivery location</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Province *" error={errors.province}>
                <Select value={form.province} onValueChange={(v) => setForm((f) => ({ ...f, province: v, city: "", barangay: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{Object.keys(PH_LOCATIONS).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="City / Municipality *" error={errors.city}>
                <Select value={form.city} onValueChange={(v) => setForm((f) => ({ ...f, city: v, barangay: "" }))} disabled={!form.province}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Barangay *" error={errors.barangay}>
                <Select value={form.barangay} onValueChange={(v) => set("barangay", v)} disabled={!form.city}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{barangays.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Full address *" error={errors.address}>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="House no., street, subdivision" />
            </Field>
            <Field label="Landmark (optional)">
              <Input value={form.landmark} onChange={(e) => set("landmark", e.target.value)} placeholder="Near the barangay hall" />
            </Field>
          </section>
        )}

        <section className="mt-5 bg-white rounded-2xl border border-[#F8CFB1] p-6 shadow-sm space-y-4">
          <p className="font-bold text-[#581E12]">Schedule & notes</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preferred date">
              <Input type="date" value={form.preferred_date} onChange={(e) => set("preferred_date", e.target.value)} />
            </Field>
            <Field label="Preferred time">
              <Input type="time" value={form.preferred_time} onChange={(e) => set("preferred_time", e.target.value)} />
            </Field>
          </div>
          <Field label="Special instructions">
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything we should know?" />
          </Field>
        </section>

        <section className="mt-5 bg-white rounded-2xl border border-[#F8CFB1] p-6 shadow-sm space-y-4">
          <p className="font-bold text-[#581E12]">Payment method</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => set("payment_method", m.name)}
                className={`rounded-2xl border p-3 text-left transition-all ${
                  form.payment_method === m.name ? "border-[#EE8720] bg-[#EE8720]/10 ring-2 ring-[#EE8720]/25" : "border-[#F8CFB1] hover:border-[#EE8720]"
                }`}
              >
                <span className="block font-bold text-[#581E12]">{m.name}</span>
                <span className="block text-xs text-[#7a4b3a]/80 mt-0.5">{m.description}</span>
              </button>
            ))}
          </div>
          {errors.payment_method && <p className="text-xs text-[#E83934] font-semibold">{errors.payment_method}</p>}
          {selectedMethod?.instructions && (
            <p className="text-sm bg-[#F5C400]/15 border border-[#F5C400]/30 rounded-xl p-3 text-[#6b5200]">{selectedMethod.instructions}</p>
          )}
          {selectedMethod?.requires_reference && (
            <Field label="Reference / transaction number *" error={errors.payment_reference}>
              <Input value={form.payment_reference} onChange={(e) => set("payment_reference", e.target.value)} placeholder="e.g. GCash ref no." />
            </Field>
          )}
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 h-fit bg-white rounded-2xl border border-[#F8CFB1] p-6 shadow-sm">
        <p className="font-bold text-[#581E12]">Order summary</p>
        <div className="mt-4 space-y-3">
          {items.map((i, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-[#7a4b3a]">{i.quantity}× {i.product_name} <span className="block text-xs opacity-70">{i.variant_name}</span></span>
              <span className="font-semibold text-[#581E12]">{peso(i.unit_price * i.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-[#F8CFB1] space-y-2 text-sm">
          <div className="flex justify-between text-[#7a4b3a]"><span>Subtotal</span><span>{peso(total)}</span></div>
          {isDelivery && <div className="flex justify-between text-[#7a4b3a]"><span>Delivery fee</span><span>{peso(deliveryFee)}</span></div>}
          <div className="flex justify-between text-lg font-extrabold text-[#581E12] pt-2"><span>Total</span><span>{peso(grandTotal)}</span></div>
        </div>
        {errors.cart && <p className="mt-3 text-xs text-[#E83934] font-semibold">{errors.cart}</p>}
        <button
          onClick={submit}
          disabled={saving}
          className="mt-5 w-full rounded-full bg-[#EE8720] hover:bg-[#d97612] disabled:opacity-60 text-white px-6 py-3.5 font-bold transition-colors"
        >
          {saving ? "Placing order…" : "Place Order"}
        </button>
        <p className="mt-3 text-xs text-center text-[#7a4b3a]/70">
          Ready in about {settings?.prep_time_minutes || 30} minutes.
        </p>
      </aside>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <Label className="text-xs font-semibold text-[#7a4b3a]">{label}</Label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="text-xs text-[#E83934] font-semibold mt-1">{error}</p>}
    </div>
  );
}
