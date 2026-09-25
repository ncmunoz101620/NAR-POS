import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "@/api/client";
import { Minus, Plus, Trash2, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import { peso } from "@/lib/brand";
import { loadSettings } from "@/lib/pos";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import DeliveryAddressPicker from "@/components/admin/DeliveryAddressPicker";
import Receipt from "@/components/admin/Receipt";
import * as thermalPrinter from "@/lib/thermalPrinter";
import { useToast } from "@/components/ui/use-toast";

export default function ManualOrder() {
  const { toast } = useToast();
  const session = useOutletContext();
  const creatorName = session?.appUser?.name || session?.authUser?.full_name || session?.authUser?.email || "CSR";
  const userBranch = session?.appUser?.branch && session.appUser.branch !== "All" ? session.appUser.branch : "NAR Commi";
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [methods, setMethods] = useState([]);
  const [settings, setSettings] = useState(null);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(null);
  const [variant, setVariant] = useState(null);
  const [qty, setQty] = useState(1);
  const [lines, setLines] = useState([]);
  const [form, setForm] = useState({
    customer_name: "", customer_phone: "", order_type: "Dine-In", table_number: "",
    address: "", province: "", city: "", barangay: "", postcode: "",
    payment_method: "", payment_reference: "", payment_reference_2: "", payment_status: "Paid", notes: "",
    customer_source: "Walk-in", delivery_fee: 0, branch: userBranch, gcash_type: "",
  });
  const [saving, setSaving] = useState(false);
  const [requestKey,setRequestKey] = useState(()=>crypto.randomUUID());
  const [uploadingId, setUploadingId] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [showSecondProof, setShowSecondProof] = useState(false);

  useEffect(() => {
    Promise.all([
      api.entities.Product.filter({ is_active: true }, "sort_order"),
      api.entities.Category.filter({ is_active: true }, "sort_order"),
      api.entities.PaymentMethod.filter({ is_active: true }, "sort_order"),
      loadSettings(),
    ]).then(([p, c, m, s]) => {
      setProducts(p); setCategories(c); setMethods(m); setSettings(s);
      setForm((f) => ({ ...f, payment_method: m[0]?.name || "" }));
    });
  }, []);

  const shown = useMemo(
    () => products.filter((p) => (cat === "all" || p.category_id === cat) && p.name.toLowerCase().includes(q.toLowerCase())),
    [products, cat, q]
  );

  // Only show categories that have at least one active product.
  const categoriesWithProducts = useMemo(
    () => categories.filter((c) => products.some((p) => p.category_id === c.id)),
    [categories, products]
  );

  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const DISCOUNT_PRESETS = [
    { id: "none", label: "None", pct: 0 },
    { id: "senior", label: "Senior Citizen (20%)", pct: 0.20 },
    { id: "pwd", label: "PWD (20%)", pct: 0.20 },
    { id: "solo_parent", label: "Solo Parent (10%)", pct: 0.10 },
    { id: "custom", label: "Custom", pct: null },
  ];
  const discountPreset = DISCOUNT_PRESETS.find((d) => d.id === form.discount_type) || DISCOUNT_PRESETS[0];
  const discountAmount = discountPreset.pct != null ? subtotal * discountPreset.pct : Number(form.discount || 0);
  const deliveryFee = Number(form.delivery_fee) || 0;
  // VAT is computed on the discounted amount (subtotal less any mandatory discount).
  const vatableAmount = Math.max(0, subtotal - discountAmount);
  const vat = Math.round(vatableAmount * ((settings?.tax_rate || 0) / 100) * 100) / 100;
  const total = vatableAmount + vat + deliveryFee;

  const pick = (p) => { setPicked(p); setVariant((p.variants || [])[0] || null); setQty(1); };

  const addLine = () => {
    if (!picked || !variant) return;
    setLines((ls) => {
      const found = ls.find((l) => l.product_id === picked.id && l.variant_name === variant.name);
      if (found) return ls.map((l) => (l === found ? { ...l, quantity: l.quantity + qty } : l));
      return [...ls, { product_id: picked.id, product_name: picked.name, variant_name: variant.name, unit_price: variant.price, quantity: qty, modifiers: [], notes: "" }];
    });
    setQty(1);
    toast({ title: `${picked.name} (${variant.name}) added to cart` });
  };

  const changeQty = (idx, delta) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l)));

  const requiresProof = ["bank transfer", "gcash"].includes((form.payment_method || "").toLowerCase());
  const isGcash = (form.payment_method || "").toLowerCase() === "gcash";

  const uploadDiscountId = async (file) => {
    if (!file) return;
    setUploadingId(true);
    try {
      const { file_url } = await api.upload(file, "proof");
      set("discount_id_url", file_url);
      toast({ title: "ID uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploadingId(false);
  };

  // Upload a proof-of-payment image file and store the resulting URL.
  const uploadProofFile = async (file, field) => {
    if (!file) return;
    setUploadingProof(field);
    try {
      const { file_url } = await api.upload(file, "proof");
      set(field, file_url);
      if (field === "payment_reference") set("payment_status", "Paid");
      toast({ title: "Proof uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploadingProof(null);
  };

  // If a proof field contains a base64 data URL (pasted by accident), upload it
  // to file storage before submitting so the entity field stays small.
  const ensureUploaded = async (value) => {
    if (!value || !value.startsWith("data:")) return value || "";
    const res = await fetch(value);
    const blob = await res.blob();
    const file = new File([blob], "proof.jpg", { type: blob.type });
    const { file_url } = await api.upload(file, "proof");
    return file_url;
  };

  const submit = async () => {
    if (!lines.length) return toast({ title: "Cart is empty", variant: "destructive" });
    if (!form.customer_name.trim()) return toast({ title: "Customer name required", variant: "destructive" });
    if (requiresProof && !form.payment_reference) return toast({ title: "Proof of payment required", variant: "destructive" });
    if (isGcash && !form.gcash_type) return toast({ title: "GCash account type required", description: "Select Corporate or Personal.", variant: "destructive" });
    const hasDiscount = form.discount_type && form.discount_type !== "none";
    if (hasDiscount && form.discount_type === "custom" && !form.discount_reason?.trim()) return toast({ title: "Discount reason required", description: "Enter what the custom discount is for.", variant: "destructive" });
    if (hasDiscount && form.discount_type !== "custom" && !form.discount_id_url) return toast({ title: "Discount ID upload required", variant: "destructive" });
    setSaving(true);
    try {
      // Convert any pasted base64 data URLs to uploaded file URLs so the
      // entity fields stay within size limits (base64 hangs the request).
      const payment_reference = await ensureUploaded(form.payment_reference);
      const payment_reference_2 = await ensureUploaded(form.payment_reference_2);
      const now = new Date().toISOString();
      const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
      const isReservation = form.preferred_date && form.preferred_date > todayStr;
      const status = isReservation ? "For Reservation" : "Confirmed";
      const order = await api.entities.Order.create({
        ...form,
      request_key: requestKey,
        payment_reference,
        payment_reference_2,
        status,
        subtotal,
        discount: discountAmount,
        discount_type: form.discount_type || "none",
        discount_reason: form.discount_reason || "",
        tax: vat,
        total,
        source: "Manual",
        created_by_name: creatorName,
        items: lines.map((l) => ({ ...l, subtotal: l.unit_price * l.quantity })),
        status_history: [{ status, at: now, by: creatorName }],
      });

      setLines([]);
      setRequestKey(crypto.randomUUID());
      setForm((f) => ({ ...f, customer_name: "", customer_phone: "", address: "", province: "", city: "", barangay: "", postcode: "", payment_reference: "", payment_reference_2: "", notes: "", customer_source: "Walk-in", discount: 0, discount_type: "none", discount_reason: "", discount_id_url: "", delivery_fee: 0, preferred_date: "", preferred_time: "" }));
      setLastOrder(order);
      toast({ title: `Order ${order.order_number} created` });
      const copies = settings?.receipt_copies || 1;
      setTimeout(async () => {
        const res = await thermalPrinter.printReceiptSmart(order, settings, copies);
        if (res.ok && res.via === "browser") {
          toast({ title: "Receipt opened in print dialog", description: "Select the thermal printer to print." });
        } else if (!res.ok) {
          const m = thermalPrinter.describePrintError(res);
          toast({ title: `Print failed — ${m.title}`, description: m.description, variant: "destructive" });
        }
      }, 400);
    } catch (e) {
      toast({ title: "Failed to create order", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleGuard module="manual_order" action="create">
      <PageHeader title="Manual Order" subtitle="Fast order entry for walk-ins and phone orders" />
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#EE8720]" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product…" className="pl-9 w-56 bg-white border-[#F0DFD0]" />
            </div>
            {[{ id: "all", name: "All" }, ...categoriesWithProducts].map((c) => (
              <button
                key={c.id}
                onClick={() => { setCat(c.id); setPicked(null); setVariant(null); }}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                  cat === c.id ? "bg-[#581E12] text-white border-[#581E12]" : "bg-white text-[#581E12] border-[#F0DFD0] hover:border-[#EE8720]"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p)}
                className="bg-white rounded-2xl border border-[#F0DFD0] p-4 text-left hover:border-[#EE8720] hover:shadow-md transition-all min-h-[104px]"
              >
                <p className="font-bold text-[#581E12] leading-tight">{p.name}</p>
                <p className="text-xs text-[#7a4b3a]/70 mt-1">{(p.variants || []).length} sizes</p>
                <p className="mt-2 text-[#EE8720] font-extrabold text-sm">
                  {peso((p.variants || []).length ? Math.min(...p.variants.map((v) => v.price)) : 0, settings?.currency_symbol)}+
                </p>
              </button>
            ))}
            {!shown.length && <p className="text-sm text-[#7a4b3a]/60">No products match.</p>}
          </div>

          {picked && (
            <div className="mt-5 bg-white rounded-2xl border-2 border-[#EE8720] p-5">
              <p className="font-extrabold text-[#581E12] text-lg">{picked.name}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-[#7a4b3a]/70 mt-4">Size</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(picked.variants || []).map((v) => (
                  <button
                    key={v.name}
                    onClick={() => setVariant(v)}
                    className={`rounded-xl border px-5 py-3 font-bold transition-colors ${
                      variant?.name === v.name ? "bg-[#EE8720] text-white border-[#EE8720]" : "bg-white text-[#581E12] border-[#F0DFD0]"
                    }`}
                  >
                    {v.name}<span className="block text-xs font-semibold opacity-80">{peso(v.price, settings?.currency_symbol)}</span>
                  </button>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 rounded-full border border-[#F0DFD0] p-1.5">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 rounded-full grid place-items-center hover:bg-[#F8CFB1]/40"><Minus className="w-4 h-4" /></button>
                  <span className="w-8 text-center font-extrabold text-lg text-[#581E12]">{qty}</span>
                  <button onClick={() => setQty(qty + 1)} className="w-10 h-10 rounded-full grid place-items-center hover:bg-[#F8CFB1]/40"><Plus className="w-4 h-4" /></button>
                </div>
                <button onClick={addLine} className="rounded-full bg-[#581E12] text-white px-7 py-3 font-bold">Add to Cart</button>
                <button onClick={() => setPicked(null)} className="text-sm font-semibold text-[#7a4b3a]">Cancel</button>
              </div>
            </div>
          )}
        </div>

        <aside className="bg-white rounded-2xl border border-[#F0DFD0] p-5 h-fit xl:sticky xl:top-24">
          <p className="font-bold text-[#581E12]">Current order</p>
          <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
            {lines.map((l, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm border-b border-[#F7EEE5] pb-2">
                <div className="flex-1">
                  <p className="font-semibold text-[#581E12]">{l.product_name}</p>
                  <p className="text-xs text-[#7a4b3a]">{l.variant_name} · {peso(l.unit_price, settings?.currency_symbol)}</p>
                </div>
                <button onClick={() => changeQty(idx, -1)} className="w-7 h-7 rounded-full border border-[#F0DFD0] grid place-items-center"><Minus className="w-3 h-3" /></button>
                <span className="w-5 text-center font-bold">{l.quantity}</span>
                <button onClick={() => changeQty(idx, 1)} className="w-7 h-7 rounded-full border border-[#F0DFD0] grid place-items-center"><Plus className="w-3 h-3" /></button>
                <button onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="text-[#E83934] p-1"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {!lines.length && <p className="text-sm text-[#7a4b3a]/60">No items yet. Tap a product to start.</p>}
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0DFD0]">
            <div className="flex justify-between text-sm text-[#7a4b3a]">
              <span>Subtotal</span><span>{peso(subtotal, settings?.currency_symbol)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-700 font-semibold">
                <span>Discount ({discountPreset.label.replace(/ \(\d+%\)/, "")})</span>
                <span>−{peso(discountAmount, settings?.currency_symbol)}</span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between text-sm text-[#7a4b3a]">
                <span>Delivery fee</span><span>{peso(deliveryFee, settings?.currency_symbol)}</span>
              </div>
            )}
            {(settings?.tax_rate || 0) > 0 && (
              <div className="flex justify-between text-sm text-[#7a4b3a]">
                <span>VAT ({settings.tax_rate}%)</span><span>{peso(vat, settings?.currency_symbol)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between text-lg font-extrabold text-[#581E12]">
              <span>Total</span><span>{peso(total, settings?.currency_symbol)}</span>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#7a4b3a]/70">Mandatory discount</p>
            <Select value={form.discount_type || "none"} onValueChange={(v) => set("discount_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DISCOUNT_PRESETS.map((d) => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.discount_type === "custom" && (
              <div className="space-y-1.5">
                <Input
                  type="number"
                  min="0"
                  value={form.discount || ""}
                  onChange={(e) => set("discount", Number(e.target.value) || 0)}
                  placeholder="Discount amount *"
                />
                <Input
                  value={form.discount_reason || ""}
                  onChange={(e) => set("discount_reason", e.target.value)}
                  placeholder="Discount reason (e.g. Staff, Promo, Complimentary) *"
                />
              </div>
            )}
            {form.discount_type && form.discount_type !== "none" && form.discount_type !== "custom" && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#7a4b3a]/70">Discount ID upload *</p>
                <Input type="file" accept="image/*" onChange={(e) => uploadDiscountId(e.target.files?.[0])} disabled={uploadingId} className="pt-1.5" />
                {uploadingId && <p className="text-xs text-[#7a4b3a]">Uploading…</p>}
                {form.discount_id_url && !uploadingId && <p className="text-xs text-green-600 font-semibold">ID uploaded ✓</p>}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2.5">
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#7a4b3a]/70">Branch</p>
              <Select value={form.branch} onValueChange={(v) => set("branch", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAR Commi">NAR Commi</SelectItem>
                  <SelectItem value="NAR Greenwoods">NAR Greenwoods</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="Customer name *" />
            <Input value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} placeholder="Mobile number" />
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#7a4b3a]/70">Customer source</p>
              <div className="flex flex-wrap gap-4">
                {["Walk-in", "Grab", "Meta"].map((src) => (
                  <label key={src} className="flex items-center gap-2 text-sm font-semibold text-[#581E12] cursor-pointer">
                    <Checkbox
                      checked={form.customer_source === src}
                      onCheckedChange={() => {
                        set("customer_source", src);
                        if (src === "Walk-in") {
                          set("order_type", "Dine-In");
                          const cashMethod = methods.find((m) => m.name.toLowerCase().includes("cash"));
                          if (cashMethod) set("payment_method", cashMethod.name);
                        }
                        if (src === "Grab") {
                          set("order_type", "Pick-up");
                          const grabMethod = methods.find((m) => m.name.toLowerCase().includes("grab"));
                          if (grabMethod) set("payment_method", grabMethod.name);
                        }
                      }}
                    />
                    {src}
                  </label>
                ))}
              </div>
            </div>
            {form.customer_source !== "Walk-in" && (
              <Select value={form.order_type} onValueChange={(v) => set("order_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {settings?.enable_takeout !== false && <SelectItem value="Pick-up">Pick-up</SelectItem>}
                  {settings?.enable_delivery !== false && form.customer_source !== "Grab" && <SelectItem value="Delivery">Delivery</SelectItem>}
                </SelectContent>
              </Select>
            )}
            {(form.order_type === "Pick-up" || form.order_type === "Delivery") && form.customer_source !== "Grab" && (
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={form.preferred_date || ""} onChange={(e) => set("preferred_date", e.target.value)} />
                <Input type="time" value={form.preferred_time || ""} onChange={(e) => set("preferred_time", e.target.value)} />
              </div>
            )}
            {form.order_type === "Delivery" && (
              <div className="space-y-2">
                <DeliveryAddressPicker
                  value={{ province: form.province, city: form.city, barangay: form.barangay, postcode: form.postcode }}
                  onChange={(v) => setForm((f) => ({ ...f, ...v }))}
                />
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="House no., street, subdivision" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.delivery_fee || ""}
                  onChange={(e) => set("delivery_fee", Number(e.target.value) || 0)}
                  placeholder="Delivery fee"
                />
              </div>
            )}
            <Select value={form.payment_method} onValueChange={(v) => { set("payment_method", v); set("gcash_type", ""); }}>
              <SelectTrigger><SelectValue placeholder="Payment method" /></SelectTrigger>
              <SelectContent>
                {methods.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {isGcash && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#7a4b3a]/70">GCash account type *</p>
                <div className="flex flex-wrap gap-4">
                  {["Corporate", "Personal"].map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm font-semibold text-[#581E12] cursor-pointer">
                      <Checkbox
                        checked={form.gcash_type === t}
                        onCheckedChange={() => set("gcash_type", t)}
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {requiresProof && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#7a4b3a]/70">Proof of payment *</p>
                <Input
                  value={form.payment_reference && form.payment_reference.startsWith("data:") ? "" : (form.payment_reference || "")}
                  onChange={(e) => {
                    set("payment_reference", e.target.value);
                    if (e.target.value) set("payment_status", "Paid");
                  }}
                  placeholder="Paste image address (https://…)"
                />
                {form.payment_reference && !form.payment_reference.startsWith("data:") && (
                  <a href={form.payment_reference} target="_blank" rel="noreferrer" className="block group">
                    <img
                      src={form.payment_reference}
                      alt="Proof of payment"
                      className="max-h-44 w-auto rounded-lg border border-[#F0DFD0] group-hover:border-[#EE8720] cursor-zoom-in"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                    <span className="text-xs text-[#EE8720] font-semibold">Click image to view full size</span>
                  </a>
                )}
                {!showSecondProof ? (
                  <button
                    type="button"
                    onClick={() => setShowSecondProof(true)}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#EE8720] hover:text-[#d97612] pt-1"
                  >
                    <Plus className="w-4 h-4" /> Add another proof of payment
                  </button>
                ) : (
                  <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#7a4b3a]/70">Additional proof of payment</p>
                    <button
                      type="button"
                      onClick={() => { setShowSecondProof(false); set("payment_reference_2", ""); }}
                      className="text-[#7a4b3a] hover:text-[#E83934]"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Input
                    value={form.payment_reference_2 && form.payment_reference_2.startsWith("data:") ? "" : (form.payment_reference_2 || "")}
                    onChange={(e) => set("payment_reference_2", e.target.value)}
                    placeholder="Or paste second image URL (https://…)"
                  />
                    {form.payment_reference_2 && !form.payment_reference_2.startsWith("data:") && (
                      <a href={form.payment_reference_2} target="_blank" rel="noreferrer" className="block group">
                        <img
                          src={form.payment_reference_2}
                          alt="Additional proof of payment"
                          className="max-h-44 w-auto rounded-lg border border-[#F0DFD0] group-hover:border-[#EE8720] cursor-zoom-in"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                        <span className="text-xs text-[#EE8720] font-semibold">Click image to view full size</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
            <Select value={form.payment_status} onValueChange={(v) => set("payment_status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Paid">Paid</SelectItem><SelectItem value="Unpaid">Unpaid</SelectItem></SelectContent>
            </Select>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Order notes" />
          </div>

          <button onClick={submit} disabled={saving} className="mt-4 w-full rounded-full bg-[#EE8720] hover:bg-[#d97612] text-white py-3.5 font-bold disabled:opacity-60">
            {saving ? "Submitting…" : "Submit Order"}
          </button>
          {lastOrder && (
            <p className="mt-3 text-center text-xs text-[#7a4b3a]">
              Last order: <b className="font-mono text-[#581E12]">{lastOrder.order_number}</b> — open it in Orders to print.
            </p>
          )}
        </aside>
      </div>

      <div id="receipt-print" className="hidden print:block">
        {lastOrder && <Receipt order={lastOrder} settings={settings} />}
      </div>
    </ModuleGuard>
  );
}
