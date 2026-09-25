import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { audit } from "@/lib/pos";

const HEADER_ALIASES = {
  name: ["name", "ingredient", "ingredient name", "item"],
  sku: ["sku", "code", "item code"],
  unit: ["unit", "uom", "measure"],
  current_stock: ["stock", "current stock", "current_stock", "qty", "quantity", "on hand"],
  min_stock: ["min", "min stock", "min_stock", "minimum", "minimum stock", "reorder min"],
  reorder_level: ["reorder", "reorder level", "reorder_level", "reorder point"],
  cost_per_unit: ["cost/unit", "cost per unit", "cost", "cost_per_unit", "price", "unit cost"],
  supplier: ["supplier", "vendor"],
  storage_location: ["location", "storage", "storage location", "storage_location", "bin"],
  expiration_date: ["expiration", "expiration date", "expiration_date", "expiry", "expiry date"],
  notes: ["notes", "remarks", "note"],
};

const matchField = (header) => {
  const h = header.toLowerCase().trim();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(h)) return field;
  }
  return null;
};

const toNum = (v) => {
  if (v == null) return 0;
  const s = String(v).trim();
  if (s === "" || s === "-") return 0;
  const m = s.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(m);
  return isNaN(n) ? 0 : n;
};

const cleanStr = (v) => {
  if (v == null) return "";
  const s = String(v).trim();
  return s === "-" ? "" : s;
};

// Minimal CSV parser supporting quoted fields and commas inside quotes
function parseCSV(text) {
  const rows = [];
  let cur = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function rowsToIngredients(text) {
  const grid = parseCSV(text);
  if (!grid.length) return [];
  const headers = grid[0].map((h) => h.trim());
  const fieldMap = headers.map(matchField); // array of field keys or null
  const out = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    const obj = { unit: "kg", is_active: true };
    headers.forEach((_, i) => {
      const field = fieldMap[i];
      if (!field) return;
      const raw = cells[i] != null ? cells[i] : "";
      if (["current_stock", "min_stock", "reorder_level", "cost_per_unit"].includes(field)) {
        obj[field] = toNum(raw);
      } else {
        obj[field] = cleanStr(raw);
      }
    });
    if (obj.unit === "") obj.unit = "kg";
    if (obj.name) out.push(obj);
  }
  return out;
}

const TEMPLATE_HEADERS = ["Name", "SKU", "Unit", "Stock", "Min", "Reorder", "Cost/unit", "Supplier", "Location", "Expiration", "Notes"];

export default function ImportIngredientsDialog({ open, onOpenChange, onImported, existingSkus }) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [step, setStep] = useState("select"); // select | preview | done
  const [createdCount, setCreatedCount] = useState(0);
  const [skipped, setSkipped] = useState([]);

  const reset = () => {
    setFile(null);
    setRows([]);
    setStep("select");
    setBusy(false);
    setCreatedCount(0);
    setSkipped([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => { reset(); onOpenChange(); };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setBusy(true);
    try {
      let parsed = [];
      const isCSV = /\.csv$/i.test(f.name) || f.type === "text/csv";
      if (isCSV) {
        const text = await f.text();
        parsed = rowsToIngredients(text);
      } else {
        // xlsx path — upload + extract
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        const res = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: "object",
            properties: {
              ingredients: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" }, sku: { type: "string" }, unit: { type: "string" },
                    current_stock: { type: "number" }, min_stock: { type: "number" },
                    reorder_level: { type: "number" }, cost_per_unit: { type: "number" },
                    supplier: { type: "string" }, storage_location: { type: "string" },
                    expiration_date: { type: "string" }, notes: { type: "string" },
                  },
                  required: ["name"],
                },
              },
            },
          },
        });
        const list = res.output?.ingredients || res.output || [];
        parsed = (Array.isArray(list) ? list : [list]).map((r) => ({
          name: (r.name || "").toString().trim(),
          sku: (r.sku || "").toString().trim(),
          unit: (r.unit || "kg").toString().trim() || "kg",
          current_stock: Number(r.current_stock) || 0,
          min_stock: Number(r.min_stock) || 0,
          reorder_level: Number(r.reorder_level) || 0,
          cost_per_unit: Number(r.cost_per_unit) || 0,
          supplier: (r.supplier || "").toString().trim(),
          storage_location: (r.storage_location || "").toString().trim(),
          expiration_date: (r.expiration_date || "").toString().trim(),
          notes: (r.notes || "").toString().trim(),
          is_active: true,
        })).filter((r) => r.name);
      }
      if (!parsed.length) {
        toast({ title: "No valid rows found", description: "Check that the file has a Name column.", variant: "destructive" });
        reset();
        return;
      }
      setRows(parsed);
      setStep("preview");
    } catch (err) {
      toast({ title: "Could not read file", description: String(err?.message || err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const csv = [TEMPLATE_HEADERS.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ingredients-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmImport = async () => {
    setBusy(true);
    const toCreate = [];
    const skip = [];
    for (const r of rows) {
      if (r.sku && existingSkus.includes(r.sku)) { skip.push({ ...r, reason: "Duplicate SKU" }); continue; }
      toCreate.push(r);
    }
    try {
      if (toCreate.length) {
        await base44.entities.Ingredient.bulkCreate(toCreate);
        await audit("Import ingredients (Excel/CSV)", "ingredients", { record_id: `${toCreate.length} rows` });
      }
      setCreatedCount(toCreate.length);
      setSkipped(skip);
      setStep("done");
      if (toCreate.length) onImported?.();
    } catch (err) {
      toast({ title: "Import failed", description: String(err?.message || err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#581E12] flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#EE8720]" /> Import Ingredients
          </DialogTitle>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <p className="text-sm text-[#7a4b3a]">
              Upload a CSV or Excel (.xlsx) file. Recognized columns: <b>Name, SKU, Unit, Stock, Min, Reorder, Cost/unit, Supplier, Location, Expiration, Notes</b>. Download the template for the correct format.
            </p>
            <button onClick={downloadTemplate} className="inline-flex items-center gap-2 text-sm font-bold text-[#EE8720] hover:underline">
              <Download className="w-4 h-4" /> Download CSV template
            </button>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-[#F0DFD0] rounded-2xl p-10 text-center cursor-pointer hover:bg-[#FBF6EF] transition-colors"
            >
              {busy ? (
                <div className="flex flex-col items-center gap-2 text-[#7a4b3a]">
                  <Loader2 className="w-7 h-7 animate-spin text-[#EE8720]" />
                  <p className="text-sm font-semibold">Reading file…</p>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="w-7 h-7 text-[#EE8720]" />
                  <p className="text-sm font-bold text-[#581E12]">{file.name}</p>
                  <p className="text-xs text-[#7a4b3a]">Click to choose a different file</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-[#7a4b3a]">
                  <Upload className="w-7 h-7 text-[#EE8720]" />
                  <p className="text-sm font-bold text-[#581E12]">Click to select a CSV or Excel file</p>
                  <p className="text-xs">.csv or .xlsx supported</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-[#7a4b3a]">
              Review the parsed ingredients below, then confirm to import <b>{rows.length}</b> row(s).
            </p>
            <div className="border border-[#F0DFD0] rounded-xl overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#FBF6EF] text-[#7a4b3a] sticky top-0">
                  <tr className="text-left">
                    {["Name", "SKU", "Unit", "Stock", "Min", "Reorder", "Cost/unit", "Supplier"].map((h) => (
                      <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-[#F7EEE5]">
                      <td className="px-3 py-2 font-semibold text-[#581E12]">{r.name}</td>
                      <td className="px-3 py-2">{r.sku || "—"}</td>
                      <td className="px-3 py-2">{r.unit}</td>
                      <td className="px-3 py-2">{r.current_stock}</td>
                      <td className="px-3 py-2">{r.min_stock}</td>
                      <td className="px-3 py-2">{r.reorder_level}</td>
                      <td className="px-3 py-2">{r.cost_per_unit}</td>
                      <td className="px-3 py-2">{r.supplier || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between gap-2">
              <button onClick={reset} className="rounded-full border border-[#F0DFD0] px-5 py-2.5 text-sm font-bold text-[#581E12]">Back</button>
              <button onClick={confirmImport} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[#EE8720] text-white px-6 py-2.5 text-sm font-bold disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirm import
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-lg font-bold text-[#581E12]">Import complete</p>
            <p className="text-sm text-[#7a4b3a]">
              <b className="text-[#581E12]">{createdCount}</b> ingredient(s) imported successfully.
              {skipped.length > 0 && <span className="text-[#E83934]"> · {skipped.length} skipped (duplicate SKU).</span>}
            </p>
            {skipped.length > 0 && (
              <div className="text-left text-xs border border-[#F0DFD0] rounded-xl p-3 max-h-40 overflow-y-auto">
                {skipped.map((s, i) => (
                  <p key={i} className="text-[#7a4b3a]"><b>{s.name}</b> — {s.reason}</p>
                ))}
              </div>
            )}
            <button onClick={close} className="rounded-full bg-[#581E12] text-white px-6 py-2.5 text-sm font-bold">Done</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}