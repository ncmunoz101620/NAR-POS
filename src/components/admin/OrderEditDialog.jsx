import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/api/client";

import { peso, ORDER_STATUSES } from "@/lib/brand";

const ORDER_TYPES = ["Delivery", "Pick-up", "Walk-in"];
const PAYMENT_STATUS = ["Unpaid", "Paid", "Refunded"];

export default function OrderEditDialog({ order, settings, session, onClose, onChanged }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    customer_name: order.customer_name || "",
    customer_phone: order.customer_phone || "",
    customer_email: order.customer_email || "",
    order_type: order.order_type || "Delivery",
    table_number: order.table_number || "",
    address: order.address || "",
    province: order.province || "",
    city: order.city || "",
    barangay: order.barangay || "",
    postcode: order.postcode || "",
    landmark: order.landmark || "",
    preferred_date: order.preferred_date || "",
    preferred_time: order.preferred_time || "",
    payment_method: order.payment_method || "",
    payment_status: order.payment_status || "Unpaid",
    payment_reference: order.payment_reference || "",
    gcash_type: order.gcash_type || "",
    delivery_fee: order.delivery_fee || 0,
    discount: order.discount || 0,
    notes: order.notes || "",
    status: order.status || "Pending",
  });
  const [saving, setSaving] = useState(false);
  const [methods, setMethods] = useState([]);

  useEffect(() => {
    api.entities.PaymentMethod.filter({ is_active: true }, "sort_order").then(setMethods).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const subtotal = (order.items || []).reduce((s, i) => s + (i.subtotal || i.unit_price * i.quantity), 0);
  const discount = Number(form.discount) || 0;
  const deliveryFee = Number(form.delivery_fee) || 0;
  const total = Math.max(0, subtotal - discount + deliveryFee);

  const save = async () => {
    if (!form.customer_name.trim()) return toast({ title: "Customer name is required", variant: "destructive" });
    if ((form.payment_method || "").toLowerCase() === "gcash" && !form.gcash_type) {
      return toast({ title: "GCash account type is required", description: "Select Corporate or Personal for GCash payments.", variant: "destructive" });
    }
    setSaving(true);
    try {
      const payload = {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email,
        order_type: form.order_type,
        table_number: form.table_number,
        address: form.address,
        province: form.province,
        city: form.city,
        barangay: form.barangay,
        postcode: form.postcode,
        landmark: form.landmark,
        preferred_date: form.preferred_date,
        preferred_time: form.preferred_time,
        payment_method: form.payment_method,
        payment_status: form.payment_status,
        payment_reference: form.payment_reference,
        gcash_type: (form.payment_method || "").toLowerCase() === "gcash" ? form.gcash_type : "",
        delivery_fee: deliveryFee,
        discount,
        total,
        notes: form.notes,
        status: form.status,
      };
      await api.entities.Order.update(order.id, payload);

      toast({ title: `Order ${order.order_number} updated` });
      onChanged?.();
      onClose();
    } catch (e) {
      toast({ title: "Failed to update order", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#581E12]">Edit order <span className="font-mono">{order.order_number}</span></DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Customer name *</Label><Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} className="mt-1" /></div>
            <div><Label>Mobile</Label><Input value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} className="mt-1" /></div>
            <div><Label>Email</Label><Input value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} className="mt-1" /></div>
            <div>
              <Label>Order type</Label>
              <Select value={form.order_type} onValueChange={(v) => set("order_type", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{ORDER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {form.order_type === "Delivery" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} className="mt-1" /></div>
              <div><Label>Province</Label><Input value={form.province} onChange={(e) => set("province", e.target.value)} className="mt-1" /></div>
              <div><Label>City</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} className="mt-1" /></div>
              <div><Label>Barangay</Label><Input value={form.barangay} onChange={(e) => set("barangay", e.target.value)} className="mt-1" /></div>
              <div><Label>Postcode</Label><Input value={form.postcode} onChange={(e) => set("postcode", e.target.value)} className="mt-1" /></div>
              <div className="col-span-2"><Label>Landmark</Label><Input value={form.landmark} onChange={(e) => set("landmark", e.target.value)} className="mt-1" /></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Preferred date</Label><Input type="date" value={form.preferred_date} onChange={(e) => set("preferred_date", e.target.value)} className="mt-1" /></div>
            <div><Label>Preferred time</Label><Input type="time" value={form.preferred_time} onChange={(e) => set("preferred_time", e.target.value)} className="mt-1" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Payment method</Label>
              <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select payment method" /></SelectTrigger>
                <SelectContent>{methods.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment status</Label>
              <Select value={form.payment_status} onValueChange={(v) => set("payment_status", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_STATUS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Payment reference</Label><Input value={form.payment_reference} onChange={(e) => set("payment_reference", e.target.value)} className="mt-1" /></div>
            {(form.payment_method || "").toLowerCase() === "gcash" && (
              <div>
                <Label>GCash account type <span className="text-red-600">*</span></Label>
                <Select value={form.gcash_type} onValueChange={(v) => set("gcash_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select account type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Corporate">Corporate</SelectItem>
                    <SelectItem value="Personal">Personal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label>Discount</Label><Input type="number" min="0" step="0.01" value={form.discount || ""} onChange={(e) => set("discount", Number(e.target.value) || 0)} className="mt-1" /></div>
            <div><Label>Delivery fee</Label><Input type="number" min="0" step="0.01" value={form.delivery_fee || ""} onChange={(e) => set("delivery_fee", Number(e.target.value) || 0)} className="mt-1" /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl bg-[#FBF6EF] p-3 text-sm space-y-1">
            <div className="flex justify-between text-[#7a4b3a]"><span>Subtotal</span><span>{peso(subtotal, settings?.currency_symbol)}</span></div>
            <div className="flex justify-between text-green-700 font-semibold"><span>Discount</span><span>−{peso(discount, settings?.currency_symbol)}</span></div>
            <div className="flex justify-between text-[#7a4b3a]"><span>Delivery fee</span><span>{peso(deliveryFee, settings?.currency_symbol)}</span></div>
            <div className="flex justify-between font-extrabold text-[#581E12] text-base"><span>Total</span><span>{peso(total, settings?.currency_symbol)}</span></div>
          </div>

          <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="mt-1" /></div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-[#F0DFD0] px-5 py-2.5 text-sm font-bold text-[#581E12]">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-full bg-[#EE8720] text-white px-6 py-2.5 text-sm font-bold disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
