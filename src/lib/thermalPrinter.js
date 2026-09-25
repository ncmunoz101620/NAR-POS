// Silent thermal receipt printing via Web Serial (USB) and Web Bluetooth (BLE).
// Chromium-only (Chrome/Edge desktop). Falls back to window.print() elsewhere.

import { LOGO_URL } from "@/lib/brand";

const STORAGE_KEY = "na_thermal_printer";

// ---------- Logo rasterization (ESC/POS GS v 0) ----------
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Converts an image URL to ESC/POS raster bytes (GS v 0 command, 1-bit, MSB first).
// Returns null if the image cannot be loaded (e.g. CORS) so the caller can skip it.
async function imageToRaster(url, maxWidthPx) {
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxWidthPx / img.width);
    const w = Math.max(1, Math.floor(img.width * scale));
    const h = Math.max(1, Math.floor(img.height * scale));
    const widthBytes = Math.ceil(w / 8);
    const canvasW = widthBytes * 8;
    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasW, h);
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, canvasW, h).data;
    const bytes = [0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < widthBytes; x++) {
        let b = 0;
        for (let bit = 0; bit < 8; bit++) {
          const px = x * 8 + bit;
          const idx = (y * canvasW + px) * 4;
          const r = data[idx], g = data[idx + 1], bl = data[idx + 2], a = data[idx + 3];
          const lum = 0.299 * r + 0.587 * g + 0.114 * bl;
          if (a > 128 && lum < 180) b |= (0x80 >> bit);
        }
        bytes.push(b);
      }
    }
    return bytes;
  } catch {
    return null;
  }
}

// ESC/POS printers use a single-byte code page (CP437) that has no peso sign.
// Sending the Unicode ₱ (3 UTF-8 bytes) corrupts it into "Γé" and makes the
// line longer than the print head width, wrapping the decimals to a new line.
// Use an ASCII-safe peso prefix so byte length matches the column width.
function posMoney(n, symbol = "₱") {
  const sym = /[\x00-\x7F]/.test(symbol) ? symbol : "P";
  return `${sym}${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Common ESC/POS BLE service UUIDs
const BLE_SERVICES = [
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "000018f0-0000-1000-8000-00805f9b34fb",
  "00001101-0000-1000-8000-00805f9b34fb",
];

// ---------- Feature detection ----------
export function printerSupport() {
  return {
    serial: typeof navigator !== "undefined" && "serial" in navigator,
    bluetooth: typeof navigator !== "undefined" && "bluetooth" in navigator,
    usb: typeof navigator !== "undefined" && "usb" in navigator,
  };
}

// ---------- Persistence ----------
export function getSavedPrinter() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePrinter(info) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
}

export function clearPrinter() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------- Pairing ----------
export async function pairUSB() {
  if (!navigator.serial) throw new Error("Web Serial not supported in this browser");
  const port = await navigator.serial.requestPort();
  const info = port.getInfo ? port.getInfo() : {};
  const name = `USB Printer${info.usbVendorId ? ` (${info.usbVendorId.toString(16)}:${(info.usbProductId || 0).toString(16)})` : ""}`;
  const saved = { type: "usb", vendorId: info.usbVendorId ?? null, productId: info.usbProductId ?? null, name };
  savePrinter(saved);
  return saved;
}

// WebUSB pairing — detects thermal printers that Web Serial misses (e.g. when
// the OS printer driver has claimed the USB interface). Uses USB printer class 7.
export async function pairUSBDirect() {
  if (!navigator.usb) throw new Error("WebUSB not supported in this browser");
  const device = await navigator.usb.requestDevice({ filters: [{ classCode: 7 }] });
  const label = [device.manufacturerName, device.productName].filter(Boolean).join(" ").trim();
  const name = "USB Printer" + (label ? ` (${label})` : ` (${device.vendorId.toString(16)}:${device.productId.toString(16)})`);
  const saved = { type: "usb-direct", vendorId: device.vendorId, productId: device.productId, name };
  savePrinter(saved);
  return saved;
}

export async function pairBluetooth() {
  if (!navigator.bluetooth) throw new Error("Web Bluetooth not supported in this browser");
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: BLE_SERVICES,
  });
  const saved = { type: "bluetooth", id: device.id, name: device.name || "Bluetooth Printer" };
  savePrinter(saved);
  return saved;
}

// ---------- ESC/POS generation ----------
function lineWidth(settings) {
  return settings?.receipt_width === "58mm" ? 32 : 48;
}

function center(text, width) {
  const t = String(text || "");
  if (t.length >= width) return t.slice(0, width);
  const pad = width - t.length;
  return " ".repeat(Math.floor(pad / 2)) + t + " ".repeat(pad - Math.floor(pad / 2));
}

function twoCol(left, right, width) {
  const l = String(left || "");
  const r = String(right || "");
  if (l.length + r.length >= width) return (l + " " + r).slice(0, width);
  return l + " ".repeat(width - l.length - r.length) + r;
}

export async function buildReceiptBytes(order, settings) {
  const s = settings || {};
  const width = lineWidth(s);
  const enc = new TextEncoder();
  const out = [];
  const push = (str) => out.push(...enc.encode(str));
  const cmd = (...bytes) => bytes.forEach((b) => out.push(b & 0xff));

  cmd(0x1b, 0x40); // init

  // Logo (raster image via GS v 0)
  if (s.receipt_show_logo !== false) {
    const logoUrl = s.logo_url || LOGO_URL;
    if (logoUrl) {
      const raster = await imageToRaster(logoUrl, s.receipt_width === "58mm" ? 150 : 200);
      if (raster) {
        cmd(0x1b, 0x61, 0x01); // center
        out.push(...raster);
        cmd(0x1b, 0x61, 0x00); // left
      }
    }
  }

  cmd(0x1b, 0x61, 0x01); // center
  cmd(0x1b, 0x21, 0x30); // double height/width
  push(s.restaurant_name || "Nanay Asa Restaurant");
  cmd(0x1b, 0x21, 0x00); push("\n");
  if (s.address) push(s.address + "\n");
  if (s.phone) push(s.phone + "\n");
  if (s.receipt_header) push(s.receipt_header + "\n");
  push("\n");

  cmd(0x1b, 0x61, 0x00); // left
  push("-".repeat(width) + "\n");
  push(`Order: ${order.order_number || ""}\n`);
  push(new Date(order.created_date || Date.now()).toLocaleString("en-PH") + "\n");
  if (s.receipt_show_customer !== false && order.customer_name) push(`Customer: ${order.customer_name}\n`);
  push(`Type: ${order.order_type || ""}${order.table_number ? ` / Table ${order.table_number}` : ""}\n`);
  push("-".repeat(width) + "\n");

  (order.items || []).forEach((i) => {
    const label = `${i.quantity}x ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ""}`;
    const price = posMoney(i.subtotal, s.currency_symbol);
    if (label.length + price.length >= width) {
      push(label.slice(0, width) + "\n");
      push(" ".repeat(Math.max(0, width - price.length)) + price + "\n");
    } else {
      push(twoCol(label, price, width) + "\n");
    }
  });
  push("-".repeat(width) + "\n");

  push(twoCol("Subtotal", posMoney(order.subtotal, s.currency_symbol), width) + "\n");
  if (order.discount) push(twoCol("Discount", "-" + posMoney(order.discount, s.currency_symbol), width) + "\n");
  if (order.delivery_fee) push(twoCol("Delivery Fee", posMoney(order.delivery_fee, s.currency_symbol), width) + "\n");
  if (order.tax && s.receipt_show_vat !== false) push(twoCol("VAT", posMoney(order.tax, s.currency_symbol), width) + "\n");
  cmd(0x1b, 0x45, 0x01); // bold
  push(twoCol("TOTAL", posMoney(order.total, s.currency_symbol), width));
  cmd(0x1b, 0x45, 0x00); push("\n");
  push(`Payment: ${order.payment_method || "-"} (${order.payment_status || ""})\n`);
  if (order.payment_reference && !/^https?:\/\//.test(order.payment_reference)) push(`Ref: ${order.payment_reference}\n`);
  push("\n");

  cmd(0x1b, 0x61, 0x01); // center
  push((s.receipt_footer || "Salamat po! Kita-kits ulit sa Nanay Asa!") + "\n");
  cmd(0x1b, 0x61, 0x00);
  cmd(0x1b, 0x64, 3); // feed 3 lines
  cmd(0x1d, 0x56, 0x01); // partial cut
  return new Uint8Array(out);
}

// ---------- Kitchen slip ----------
export function buildKitchenSlipBytes(order, settings, cookName) {
  const s = settings || {};
  const width = lineWidth(s);
  const enc = new TextEncoder();
  const out = [];
  const push = (str) => out.push(...enc.encode(str));
  const cmd = (...bytes) => bytes.forEach((b) => out.push(b & 0xff));

  cmd(0x1b, 0x40); // init
  cmd(0x1b, 0x61, 0x01); // center
  cmd(0x1b, 0x21, 0x30); // double height/width
  push("KITCHEN SLIP");
  cmd(0x1b, 0x21, 0x00); push("\n");
  push("-".repeat(width) + "\n");
  cmd(0x1b, 0x61, 0x00); // left
  push("Order: " + (order.order_number || "") + "\n");
  push(new Date(order.created_date || Date.now()).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) + "\n");
  if (order.customer_name) push("Customer: " + order.customer_name + "\n");
  push("Type: " + (order.order_type || "") + (order.table_number ? " / Table " + order.table_number : "") + "\n");
  if (order.branch) push("Branch: " + order.branch + "\n");
  push("-".repeat(width) + "\n");

  (order.items || []).forEach((i) => {
    cmd(0x1b, 0x45, 0x01); // bold
    push(i.quantity + "x " + (i.product_name || "") + (i.variant_name ? " (" + i.variant_name + ")" : "") + "\n");
    cmd(0x1b, 0x45, 0x00); // off
    if (i.modifiers && i.modifiers.length) push("  - " + i.modifiers.join(", ") + "\n");
    if (i.notes) push("  * " + i.notes + "\n");
  });
  push("-".repeat(width) + "\n");
  if (order.notes) push("Notes: " + order.notes + "\n");
  if (cookName) push("Cook: " + cookName + "\n");
  push("\n");
  cmd(0x1b, 0x64, 3); // feed 3 lines
  cmd(0x1d, 0x56, 0x01); // partial cut
  return new Uint8Array(out);
}

export async function printKitchenSlip(order, settings, cookName, copies = 1) {
  const saved = getSavedPrinter();
  if (!saved) return { ok: false, reason: "no_printer" };
  const bytes = buildKitchenSlipBytes(order, settings, cookName);
  if (saved.type === "usb-direct") return printUSBDirect(bytes, saved, copies);
  if (saved.type === "usb") return printUSB(bytes, saved, copies);
  return printBluetooth(bytes, saved, copies);
}

async function printUSBDirect(bytes, saved, copies) {
  if (!navigator.usb) return { ok: false, reason: "unsupported" };
  const device = (await navigator.usb.getDevices()).find(
    (d) => d.vendorId === saved.vendorId && d.productId === saved.productId
  );
  if (!device) return { ok: false, reason: "not_found" };

  // "Access denied" on open() almost always means the Windows printer driver
  // is holding an exclusive lock on the USB interface. Reuse an already-open
  // session when possible, and try one recovery close+reopen for stale locks.
  const tryOpen = async () => {
    if (device.opened) return;
    try {
      await device.open();
    } catch (e) {
      const msg = (e?.message || String(e)).toLowerCase();
      if (msg.includes("access denied") || msg.includes("'open'")) {
        throw Object.assign(new Error("driver_locked"), { _reason: "driver_locked" });
      }
      throw e;
    }
  };

  let claimed = null;
  try {
    try {
      await tryOpen();
    } catch (e) {
      if (e?._reason === "driver_locked") throw e;
      // Stale session — close and retry once.
      await device.close().catch(() => {});
      await tryOpen();
    }
    if (!device.configuration) await device.selectConfiguration(1);
    const iface = device.configuration.interfaces.find((i) =>
      i.alternates.some((a) => a.interfaceClass === 7)
    );
    if (!iface) return { ok: false, reason: "no_printer_interface" };
    await device.claimInterface(iface.interfaceNumber);
    claimed = iface.interfaceNumber;
    const alt = iface.alternates.find((a) => a.interfaceClass === 7);
    const ep = alt.endpoints.find((e) => e.direction === "out" && e.type === "bulk");
    if (!ep) return { ok: false, reason: "no_endpoint" };
    const chunkSize = 1024;
    for (let c = 0; c < copies; c++) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        await device.transferOut(ep.endpointNumber, bytes.slice(i, i + chunkSize));
      }
    }
    return { ok: true };
  } catch (e) {
    if (e?._reason === "driver_locked") {
      return {
        ok: false,
        reason: "driver_locked",
        error: "Windows printer driver is holding the USB port. Remove the printer from 'Printers & scanners' (or replace its driver with WinUSB via Zadig), then re-pair in Settings → Thermal Printer.",
      };
    }
    return { ok: false, reason: "error", error: e?.message || String(e) };
  } finally {
    if (claimed !== null) await device.releaseInterface(claimed).catch(() => {});
    if (device.opened) await device.close().catch(() => {});
  }
}

// ---------- Browser print fallback ----------
// Used when WebUSB is blocked by the OS driver. Renders an HTML receipt/slip in
// a hidden iframe and calls the browser print dialog — which uses the installed
// driver, so it works even when WebUSB cannot open the device.
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function printHTML(html) {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    // Real (off-screen) dimensions — zero-size iframes are suppressed by some
    // browsers and never produce a print dialog.
    frame.style.cssText = "position:fixed;width:1024px;height:800px;border:0;left:-10000px;top:0;";
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      setTimeout(() => frame.remove(), 1500);
      resolve({ ok: true, via: "browser" });
    };
    const doPrint = () => {
      if (settled) return;
      try {
        frame.contentWindow.focus();
        frame.contentWindow.onafterprint = done;
        frame.contentWindow.print();
      } catch {
        done();
      }
      // Safety net: if onafterprint never fires (some browsers), still resolve.
      setTimeout(done, 600);
    };
    frame.onload = doPrint;
    // Fallback in case onload doesn't fire for already-written documents.
    setTimeout(doPrint, 300);
  });
}

export function receiptToHTML(order, settings) {
  const s = settings || {};
  const cur = s.currency_symbol || "₱";
  const money = (n) => `${cur}${Number(n || 0).toFixed(2)}`;
  const rows = (order.items || []).map((i) => `
    <tr><td class="qty">${escapeHtml(i.quantity)}x</td>
      <td class="name">${escapeHtml(i.product_name)}${i.variant_name ? ` <span class="var">(${escapeHtml(i.variant_name)})</span>` : ""}</td>
      <td class="amt">${escapeHtml(money(i.subtotal))}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    body { font-family: "Courier New", monospace; width: 72mm; margin: 0 auto; padding: 2mm; color:#000; }
    .logo { display:block; margin:0 auto 2px; max-width:48mm; max-height:18mm; }
    h1 { font-size: 16px; text-align:center; margin: 0 0 2px; }
    .ctr { text-align:center; }
    .meta { font-size: 11px; }
    hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
    table { width:100%; border-collapse:collapse; font-size: 12px; }
    td.qty { width: 28px; }
    td.name { font-weight:bold; }
    td.amt { text-align:right; white-space:nowrap; }
    .var { font-weight:normal; }
    .tot { text-align:right; font-weight:bold; font-size: 14px; }
    .foot { text-align:center; margin-top: 6px; font-size: 11px; }
  </style></head><body>
    ${s.receipt_show_logo !== false ? `<img class="logo" src="${escapeHtml(s.logo_url || LOGO_URL)}" alt="logo" crossorigin="anonymous" />` : ""}
    <h1>${escapeHtml(s.restaurant_name || "Nanay Asa Restaurant")}</h1>
    ${s.address ? `<div class="ctr meta">${escapeHtml(s.address)}</div>` : ""}
    ${s.phone ? `<div class="ctr meta">${escapeHtml(s.phone)}</div>` : ""}
    ${s.receipt_header ? `<div class="ctr meta">${escapeHtml(s.receipt_header)}</div>` : ""}
    <hr>
    <div class="meta">Order: ${escapeHtml(order.order_number || "")}<br>
    ${escapeHtml(new Date(order.created_date || Date.now()).toLocaleString("en-PH"))}<br>
    ${s.receipt_show_customer !== false && order.customer_name ? `Customer: ${escapeHtml(order.customer_name)}<br>` : ""}
    Type: ${escapeHtml(order.order_type || "")}${order.table_number ? ` / Table ${escapeHtml(order.table_number)}` : ""}</div>
    <hr>
    <table>${rows}</table>
    <hr>
    <table>
      <tr><td>Subtotal</td><td class="amt">${escapeHtml(money(order.subtotal))}</td></tr>
      ${order.discount ? `<tr><td>Discount</td><td class="amt">-${escapeHtml(money(order.discount))}</td></tr>` : ""}
      ${order.delivery_fee ? `<tr><td>Delivery Fee</td><td class="amt">${escapeHtml(money(order.delivery_fee))}</td></tr>` : ""}
      ${order.tax && s.receipt_show_vat !== false ? `<tr><td>VAT</td><td class="amt">${escapeHtml(money(order.tax))}</td></tr>` : ""}
      <tr><td class="tot">TOTAL</td><td class="tot">${escapeHtml(money(order.total))}</td></tr>
    </table>
    <div class="meta">Payment: ${escapeHtml(order.payment_method || "-")} (${escapeHtml(order.payment_status || "")})</div>
    <div class="foot">${escapeHtml(s.receipt_footer || "Salamat po! Kita-kits ulit sa Nanay Asa!")}</div>
  </body></html>`;
}

export async function browserPrintReceipt(order, settings) {
  return printHTML(receiptToHTML(order, settings));
}

// Try the paired thermal printer first (silent ESC/POS). If no printer is
// paired, the device is gone, or the Windows driver locks the USB port, fall
// back to the browser print dialog (which uses that same driver). Returns
// { ok, via: "thermal" | "browser", ...reason } so callers can toast accordingly.
export async function printReceiptSmart(order, settings, copies = 1) {
  const res = await printReceipt(order, settings, copies);
  if (res.ok) return { ok: true, via: "thermal" };
  const fallbackReasons = ["no_printer", "not_found", "driver_locked", "unsupported", "error", "no_printer_interface", "no_endpoint", "no_char"];
  if (fallbackReasons.includes(res.reason)) {
    // Render the receipt in an isolated off-screen iframe and call the browser
    // print dialog on it. This prints ONLY the receipt (no app chrome), works
    // with the installed Windows driver, and is reliable on the published app.
    // NOTE: the builder preview iframe is sandboxed and blocks print dialogs —
    // test printing on the published app URL.
    try {
      await browserPrintReceipt(order, settings);
      return { ok: true, via: "browser", thermalReason: res.reason };
    } catch {
      return res;
    }
  }
  return res;
}

// Human-friendly message for any non-ok print result, for toast/UI surfaces.
export function describePrintError(res) {
  if (!res || res.ok) return null;
  const map = {
    no_printer: { title: "No printer paired", description: "Pair a USB printer in Settings → Thermal Printer." },
    not_found: { title: "Printer not connected", description: "Reconnect the printer, then re-pair it in Settings → Thermal Printer." },
    driver_locked: { title: "Printer locked by Windows", description: res.error || "Remove the printer from Windows 'Printers & scanners' (or install WinUSB via Zadig), then re-pair." },
    no_printer_interface: { title: "Not a thermal printer", description: "The paired USB device has no printer interface." },
    no_endpoint: { title: "Printer not supported", description: "The paired printer exposes no bulk-out endpoint." },
    unsupported: { title: "Browser not supported", description: "Use Chrome or Edge on desktop for USB thermal printing." },
  };
  return map[res.reason] || { title: "Print failed", description: res.error || res.reason || "Unknown error" };
}

// ---------- Printing ----------
export async function printReceipt(order, settings, copies = 1) {
  const saved = getSavedPrinter();
  if (!saved) return { ok: false, reason: "no_printer" };
  const bytes = await buildReceiptBytes(order, settings);
  if (saved.type === "usb-direct") return printUSBDirect(bytes, saved, copies);
  if (saved.type === "usb") return printUSB(bytes, saved, copies);
  return printBluetooth(bytes, saved, copies);
}

// Open → print → close on every receipt. Holding the serial port open idle
// causes built-in POS printers to stop responding after a while, so we don't
// cache the connection. We force-close any stale/already-open port before
// opening, add a timeout so open() can't hang forever, and retry once on
// failure — this keeps printing reliable without re-pairing.
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function openSerialPort(saved) {
  const ports = await navigator.serial.getPorts();
  const port = ports.find((p) => {
    const i = p.getInfo ? p.getInfo() : {};
    return (saved.vendorId == null || i.usbVendorId === saved.vendorId) &&
           (saved.productId == null || i.usbProductId === saved.productId);
  }) || ports[0];
  if (!port) return null;
  // Reset any stale/already-open state to a clean starting point.
  try { await port.close(); } catch {}
  await withTimeout(port.open({ baudRate: 9600 }), 3000, "open");
  return port;
}

async function printUSB(bytes, saved, copies) {
  if (!navigator.serial) return { ok: false, reason: "unsupported" };

  const attempt = async () => {
    const port = await openSerialPort(saved);
    if (!port) return { ok: false, reason: "not_found" };
    const writer = port.writable.getWriter();
    try {
      for (let c = 0; c < copies; c++) await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
    await port.close().catch(() => {});
    return { ok: true };
  };

  try {
    return await attempt();
  } catch (e) {
    // Stale connection — retry once after the forced close in openSerialPort.
    try {
      return await attempt();
    } catch (e2) {
      return { ok: false, reason: "error", error: e2?.message || String(e2) };
    }
  }
}

async function findWriteCharacteristic(server) {
  const services = await server.getPrimaryServices();
  for (const svc of services) {
    const chars = await svc.getCharacteristics();
    for (const c of chars) {
      if (c.properties.write || c.properties.writeWithoutResponse) return c;
    }
  }
  return null;
}

async function printBluetooth(bytes, saved, copies) {
  if (!navigator.bluetooth) return { ok: false, reason: "unsupported" };
  let device = null;
  try {
    if (typeof navigator.bluetooth.getDevices === "function") {
      const devices = await navigator.bluetooth.getDevices();
      device = devices.find((d) => d.id === saved.id || d.name === saved.name);
    }
  } catch {
    device = null;
  }
  if (!device) return { ok: false, reason: "not_found" };
  try {
    const server = await device.gatt.connect();
    const char = await findWriteCharacteristic(server);
    if (!char) {
      server.disconnect();
      return { ok: false, reason: "no_char" };
    }
    const useWoR = char.properties.writeWithoutResponse;
    const chunkSize = 180;
    for (let c = 0; c < copies; c++) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        if (useWoR) await char.writeValueWithoutResponse(chunk);
        else await char.writeValueWithResponse(chunk);
      }
    }
    server.disconnect();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", error: e?.message || String(e) };
  }
}