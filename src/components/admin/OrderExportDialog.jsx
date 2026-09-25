import React, { useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const COLUMNS = [
  { key: "order_number", label: "Order #" },
  { key: "created_date", label: "Created" },
  { key: "preferred_date", label: "Preferred Date" },
  { key: "preferred_time", label: "Preferred Time" },
  { key: "customer_name", label: "Customer" },
  { key: "customer_phone", label: "Phone" },
  { key: "customer_email", label: "Email" },
  { key: "order_type", label: "Order Type" },
  { key: "customer_source", label: "Customer Source" },
  { key: "branch", label: "Branch" },
  { key: "table_number", label: "Table #" },
  { key: "address", label: "Address" },
  { key: "items_count", label: "Items", type: "number" },
  { key: "item_quantities", label: "Item Quantities" },
  { key: "items_detail", label: "Items Detail" },
  { key: "product_prices", label: "Product Price" },
  { key: "subtotal", label: "Subtotal", type: "number" },
  { key: "discount", label: "Discount", type: "number" },
  { key: "discount_type", label: "Discount Type" },
  { key: "delivery_fee", label: "Delivery Fee", type: "number" },
  { key: "tax", label: "VAT", type: "number" },
  { key: "total", label: "Total", type: "number" },
  { key: "payment_method", label: "Payment Method" },
  { key: "payment_status", label: "Payment Status" },
  { key: "payment_reference", label: "Payment Reference" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "created_by_name", label: "Created By" },
  { key: "notes", label: "Notes" },
];

const GETTERS = {
  order_number: (o) => o.order_number,
  created_date: (o) => (o.created_date ? new Date(o.created_date).toLocaleString("en-PH") : ""),
  preferred_date: (o) => o.preferred_date || "",
  preferred_time: (o) => o.preferred_time || "",
  customer_name: (o) => o.customer_name || "",
  customer_phone: (o) => o.customer_phone || "",
  customer_email: (o) => o.customer_email || "",
  order_type: (o) => o.order_type || "",
  customer_source: (o) => o.customer_source || "",
  branch: (o) => o.branch || "",
  table_number: (o) => o.table_number || "",
  address: (o) => [o.address, o.barangay, o.city, o.province].filter(Boolean).join(", "),
  items_count: (o) => (o.items || []).reduce((s, i) => s + i.quantity, 0),
  item_quantities: (o) => (o.items || []).map((i) => i.quantity).join("; "),
  items_detail: (o) =>
    (o.items || [])
      .map((i) => `${i.quantity}x ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ""}`)
      .join("; "),
  product_prices: (o) => (o.items || []).map((i) => i.unit_price).join("; "),
  subtotal: (o) => o.subtotal || 0,
  discount: (o) => o.discount || 0,
  discount_type: (o) => o.discount_type || "",
  delivery_fee: (o) => o.delivery_fee || 0,
  tax: (o) => o.tax || 0,
  total: (o) => o.total || 0,
  payment_method: (o) => o.payment_method || "",
  payment_status: (o) => o.payment_status || "",
  payment_reference: (o) => o.payment_reference || "",
  status: (o) => o.status || "",
  source: (o) => o.source || "",
  created_by_name: (o) => o.created_by_name || "",
  notes: (o) => o.notes || "",
};

const DEFAULT_SELECTED = [
  "order_number", "created_date", "customer_name", "order_type", "items_count", "item_quantities", "items_detail",
  "product_prices", "total", "payment_method", "payment_status", "status", "source", "created_by_name",
];

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default function OrderExportDialog({ open, onClose, orders }) {
  const [selected, setSelected] = useState(() => Object.fromEntries(COLUMNS.map((c) => [c.key, DEFAULT_SELECTED.includes(c.key)])));

  const chosen = useMemo(() => COLUMNS.filter((c) => selected[c.key]), [selected]);
  const chosenCount = chosen.length;

  const toggle = (key) => setSelected((s) => ({ ...s, [key]: !s[key] }));
  const allOn = () => setSelected(Object.fromEntries(COLUMNS.map((c) => [c.key, true])));
  const allOff = () => setSelected(Object.fromEntries(COLUMNS.map((c) => [c.key, false])));

  const buildExcel = () => {
    let xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
    xml += '<Worksheet ss:Name="Orders"><Table>\n';
    xml += "<Row>";
    chosen.forEach((c) => {
      xml += `<Cell><Data ss:Type="String">${escapeXml(c.label)}</Data></Cell>`;
    });
    xml += "</Row>\n";
    orders.forEach((o) => {
      xml += "<Row>";
      chosen.forEach((c) => {
        const raw = GETTERS[c.key](o);
        const isNum = c.type === "number" && raw !== "" && raw !== null && !isNaN(raw);
        xml += `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${escapeXml(raw)}</Data></Cell>`;
      });
      xml += "</Row>\n";
    });
    xml += "</Table></Worksheet></Workbook>";

    const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `orders-export-${stamp}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (!chosenCount) return;
    buildExcel();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#581E12] flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#EE8720]" /> Export Orders to Excel
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-[#7a4b3a]">
          {orders.length} order(s) will be exported. Select the columns to include ({chosenCount} selected).
        </p>

        <div className="flex items-center gap-3 text-xs">
          <button onClick={allOn} className="font-semibold text-[#EE8720] hover:underline">Select all</button>
          <button onClick={allOff} className="font-semibold text-[#7a4b3a] hover:underline">Clear all</button>
        </div>

        <div className="max-h-72 overflow-y-auto grid grid-cols-2 gap-2 pr-1">
          {COLUMNS.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-sm text-[#581E12] cursor-pointer rounded-lg border border-[#F0DFD0] px-3 py-2 hover:bg-[#FFFBF6]">
              <Checkbox checked={!!selected[c.key]} onCheckedChange={() => toggle(c.key)} />
              <span className="font-medium">{c.label}</span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleExport} disabled={!chosenCount} className="bg-[#EE8720] hover:bg-[#d97612] text-white">
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}