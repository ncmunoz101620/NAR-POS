import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import { audit } from "@/lib/pos";
import SettingField from "@/components/admin/SettingField";
import PrinterPanel from "@/components/admin/PrinterPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Image } from "@/components/ui/image";
import { useToast } from "@/components/ui/use-toast";

export default function AdminSettings() {
  const { toast } = useToast();
  const session = useOutletContext();
  const roleName = (session?.roleName || "").toUpperCase();
  const isPrinterOnlyRole = ["CSR", "RND COOK"].includes(roleName);
  const canPairPrinter = roleName === "ADMIN";
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadBanner = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("banner_image_url", file_url);
      toast({ title: "Banner image uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
  };

  const uploadComingSoonBg = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("coming_soon_background_url", file_url);
      toast({ title: "Background uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
  };

  useEffect(() => {
    base44.entities.Setting.list().then((list) => setForm(list[0] || { restaurant_name: "Nanay Asa Restaurant", currency_symbol: "₱" }));
  }, []);

  if (!form) return <div className="h-40 rounded-2xl bg-white border border-[#F0DFD0] animate-pulse" />;

  const set = (k, v) => setForm({ ...form, [k]: v });

  const save = async () => {
    setSaving(true);
    const payload = { ...form };
    delete payload.id;
    ["tax_rate", "min_order", "delivery_fee", "prep_time_minutes", "low_stock_threshold", "receipt_copies"].forEach((k) => { payload[k] = Number(payload[k]) || 0; });
    if (form.id) await base44.entities.Setting.update(form.id, payload);
    else {
      const created = await base44.entities.Setting.create(payload);
      setForm(created);
    }
    await audit("Update settings", "settings", {});
    setSaving(false);
    toast({ title: "Settings saved" });
  };

  const Field = (props) => <SettingField {...props} form={form} set={set} />;

  // CSR and RND COOK only get the device printer pairing panel (they lack full
  // settings access). ADMIN sees the complete settings page below.
  if (isPrinterOnlyRole) {
    return (
      <div>
        <PageHeader title="Printer Settings" subtitle="Pair and test the thermal receipt printer for this device" />
        <div className="max-w-2xl">
          <PrinterPanel settings={form} />
        </div>
      </div>
    );
  }

  return (
    <ModuleGuard module="settings" action="edit">
      <PageHeader title="System Settings" subtitle="Restaurant, ordering, inventory, and payment configuration">
        <button onClick={save} disabled={saving} className="rounded-full bg-[#EE8720] text-white px-6 py-2.5 text-sm font-bold disabled:opacity-60">
          {saving ? "Saving…" : "Save settings"}
        </button>
      </PageHeader>

      <Tabs defaultValue="restaurant">
        <TabsList className="bg-white border border-[#F0DFD0]">
          <TabsTrigger value="restaurant">Restaurant</TabsTrigger>
          <TabsTrigger value="ordering">Ordering</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="receipt">Receipt / Printer</TabsTrigger>
          <TabsTrigger value="coming-soon">Coming Soon</TabsTrigger>
        </TabsList>

        <TabsContent value="restaurant" className="mt-4">
          <div className="bg-white rounded-2xl border border-[#F0DFD0] p-6 grid gap-4 sm:grid-cols-2">
            <Field label="Restaurant name" k="restaurant_name" />
            <Field label="Logo URL" k="logo_url" />
            <Field label="Address" k="address" />
            <Field label="Phone" k="phone" />
            <Field label="Email" k="email" />
            <Field label="Business hours" k="business_hours" placeholder="Mon–Sun, 9AM – 9PM" />
            <Field label="Currency symbol" k="currency_symbol" />
            <Field label="Tax rate (%)" k="tax_rate" type="number" />
            <div className="sm:col-span-2 space-y-2">
              <Label>Home page banner background image</Label>
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-48 h-28 rounded-xl overflow-hidden border border-[#F0DFD0] bg-[#FBF6EF]">
                  {form.banner_image_url ? (
                    <Image src={form.banner_image_url} alt="Banner preview" className="w-full h-full" fittingType="fill" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-xs text-[#7a4b3a]/60">No banner set</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Input type="file" accept="image/*" onChange={(e) => uploadBanner(e.target.files?.[0])} disabled={uploading} className="pt-1.5 max-w-xs" />
                  {uploading && <p className="text-xs text-[#7a4b3a]">Uploading…</p>}
                  {form.banner_image_url && !uploading && (
                    <button onClick={() => set("banner_image_url", "")} className="text-xs font-bold text-[#E83934] hover:underline">Remove banner</button>
                  )}
                </div>
              </div>
              <p className="text-xs text-[#7a4b3a]/70">Used as the background of the home page hero. Recommended: wide landscape image, at least 1600×900px.</p>
            </div>
            <div className="sm:col-span-2">
              <Label>Receipt footer message</Label>
              <Textarea value={form.receipt_footer || ""} onChange={(e) => set("receipt_footer", e.target.value)} className="mt-1.5" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ordering" className="mt-4">
          <div className="bg-white rounded-2xl border border-[#F0DFD0] p-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-wrap gap-6">
              {[["enable_dinein", "Dine-In"], ["enable_takeout", "Takeout"], ["enable_delivery", "Delivery"]].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm font-semibold text-[#581E12]">
                  <Switch checked={form[k] !== false} onCheckedChange={(v) => set(k, v)} /> {label}
                </label>
              ))}
            </div>
            <Field label="Minimum order amount" k="min_order" type="number" />
            <Field label="Delivery fee" k="delivery_fee" type="number" />
            <Field label="Estimated preparation time (minutes)" k="prep_time_minutes" type="number" />
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <div className="bg-white rounded-2xl border border-[#F0DFD0] p-6 grid gap-4 sm:grid-cols-2">
            <Field label="Low stock threshold (fallback)" k="low_stock_threshold" type="number" />
            <Field label="Deduct ingredients on status" k="deduct_on_status" placeholder="Completed" />
            <p className="sm:col-span-2 text-xs text-[#7a4b3a]">
              Ingredients are deducted once per order when it reaches the configured status. Cancelling or refunding a completed order creates reversal transactions.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="receipt" className="mt-4 space-y-4">
          {canPairPrinter && <PrinterPanel settings={form} />}
          <div className="bg-white rounded-2xl border border-[#F0DFD0] p-6 grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Receipt paper width</Label>
              <Select value={form.receipt_width || "80mm"} onValueChange={(v) => set("receipt_width", v)}>
                <SelectTrigger className="bg-white border-[#F0DFD0]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58mm (small)</SelectItem>
                  <SelectItem value="80mm">80mm (standard)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field label="Number of copies" k="receipt_copies" type="number" />
            <div className="sm:col-span-2 flex flex-wrap gap-6">
              {[["receipt_auto_print", "Auto-print on order completion"], ["receipt_show_logo", "Show logo on receipt"], ["receipt_show_customer", "Show customer name"], ["receipt_show_vat", "Show VAT breakdown"]].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm font-semibold text-[#581E12]">
                  <Switch checked={form[k] !== false} onCheckedChange={(v) => set(k, v)} /> {label}
                </label>
              ))}
            </div>
            <div className="sm:col-span-2">
              <Label>Receipt header message</Label>
              <Textarea value={form.receipt_header || ""} onChange={(e) => set("receipt_header", e.target.value)} className="mt-1.5" placeholder="e.g. Official Receipt — Not valid for VAT" />
            </div>
            <div className="sm:col-span-2">
              <Label>Receipt footer message</Label>
              <Textarea value={form.receipt_footer || ""} onChange={(e) => set("receipt_footer", e.target.value)} className="mt-1.5" />
            </div>
            <p className="sm:col-span-2 text-xs text-[#7a4b3a]">
              Auto-print requires a connected printer on the device used to mark orders complete.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="coming-soon" className="mt-4">
          <div className="bg-white rounded-2xl border border-[#F0DFD0] p-6 max-w-2xl space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-bold text-[#581E12]">Enable Coming Soon Mode</p>
                <p className="text-xs text-[#7a4b3a]/80 mt-0.5">Visitors will see the coming soon page. Admins can still browse normally.</p>
              </div>
              <Switch checked={form.coming_soon_enabled === true} onCheckedChange={(v) => set("coming_soon_enabled", v)} />
            </div>
            <div>
              <Label>Page title</Label>
              <Input value={form.coming_soon_title || ""} onChange={(e) => set("coming_soon_title", e.target.value)} className="mt-1.5" placeholder="Coming Soon" />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea value={form.coming_soon_message || ""} onChange={(e) => set("coming_soon_message", e.target.value)} className="mt-1.5" placeholder="We are working on something amazing. Stay tuned!" />
            </div>
            <div className="space-y-2">
              <Label>Background image</Label>
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-48 h-28 rounded-xl overflow-hidden border border-[#F0DFD0] bg-[#FBF6EF]">
                  {form.coming_soon_background_url ? (
                    <Image src={form.coming_soon_background_url} alt="Preview" className="w-full h-full" fittingType="fill" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-xs text-[#7a4b3a]/60">No image set</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Input type="file" accept="image/*" onChange={(e) => uploadComingSoonBg(e.target.files?.[0])} disabled={uploading} className="pt-1.5 max-w-xs" />
                  {uploading && <p className="text-xs text-[#7a4b3a]">Uploading…</p>}
                  {form.coming_soon_background_url && !uploading && (
                    <button onClick={() => set("coming_soon_background_url", "")} className="text-xs font-bold text-[#E83934] hover:underline">Remove image</button>
                  )}
                </div>
              </div>
              <p className="text-xs text-[#7a4b3a]/70">Leave blank to use the default gradient background.</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </ModuleGuard>
  );
}