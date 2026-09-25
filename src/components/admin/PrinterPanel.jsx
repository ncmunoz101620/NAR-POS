import React, { useState } from "react";
import { Printer, Usb, Bluetooth, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import * as thermalPrinter from "@/lib/thermalPrinter";

export default function PrinterPanel({ settings }) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(thermalPrinter.getSavedPrinter());
  const [pairing, setPairing] = useState(false);
  const [testing, setTesting] = useState(false);
  const support = thermalPrinter.printerSupport();
  const anySupport = support.serial || support.bluetooth;

  const pair = async (type) => {
    setPairing(true);
    try {
      let info;
      if (type === "usb") info = await thermalPrinter.pairUSB();
      else if (type === "usb-direct") info = await thermalPrinter.pairUSBDirect();
      else info = await thermalPrinter.pairBluetooth();
      setSaved(info);
      toast({ title: `Paired ${info.name}` });
    } catch (e) {
      if (e?.name === "NotFoundError") {
        toast({
          title: "No device selected",
          description: type === "usb"
            ? "No serial printers found. If your printer is grabbed by the OS driver, try the WebUSB option below."
            : "No USB printer found. Make sure it's connected and powered on.",
          variant: "destructive",
        });
      } else if (e?.name !== "AbortError") {
        toast({ title: "Pairing failed", description: e?.message, variant: "destructive" });
      }
    }
    setPairing(false);
  };

  const testPrint = async () => {
    setTesting(true);
    const tax = settings?.tax_rate ? Math.round(250 * settings.tax_rate) / 100 : 0;
    const sample = {
      order_number: "TEST-001",
      created_date: new Date().toISOString(),
      customer_name: "Test Customer",
      order_type: "Dine-In",
      table_number: "",
      items: [
        { quantity: 2, product_name: "Sample Dish", variant_name: "Regular", subtotal: 200 },
        { quantity: 1, product_name: "Iced Tea", variant_name: "", subtotal: 50 },
      ],
      subtotal: 250,
      discount: 0,
      delivery_fee: 0,
      tax,
      total: 250 + tax,
      payment_method: "Cash",
      payment_status: "Paid",
      payment_reference: "",
    };
    const res = await thermalPrinter.printReceipt(sample, settings, 1);
    if (res.ok) {
      toast({ title: "Test receipt sent to printer" });
    } else if (res.reason === "driver_locked" || res.reason === "not_found" || res.reason === "error") {
      // WebUSB is blocked by the Windows driver — fall back to the browser
      // print dialog, which uses that same driver and will actually print.
      try {
        await thermalPrinter.browserPrintReceipt(sample, settings);
        toast({
          title: "Test printed via browser dialog",
          description: "WebUSB is locked by the Windows driver. Pick the thermal printer in the dialog to print.",
        });
      } catch (e) {
        const m = thermalPrinter.describePrintError(res);
        toast({ title: `Test print failed — ${m.title}`, description: m.description, variant: "destructive" });
      }
    } else {
      const m = thermalPrinter.describePrintError(res);
      toast({ title: `Test print failed — ${m.title}`, description: m.description, variant: "destructive" });
    }
    setTesting(false);
  };

  const disconnect = () => {
    thermalPrinter.clearPrinter();
    setSaved(null);
    toast({ title: "Printer disconnected" });
  };

  return (
    <div className="bg-white rounded-2xl border border-[#F0DFD0] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Printer className="w-5 h-5 text-[#EE8720]" />
        <h3 className="font-bold text-[#581E12]">Thermal Printer</h3>
      </div>

      {!anySupport ? (
        <p className="text-sm text-[#7a4b3a]">
          This browser doesn't support direct printer pairing. Use Chrome or Edge on desktop to pair a
          thermal printer; otherwise receipts use the normal print dialog.
        </p>
      ) : saved ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <div>
              <p className="font-semibold text-[#581E12]">{saved.name}</p>
              <p className="text-xs text-[#7a4b3a] capitalize">{saved.type} · paired</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={testPrint}
              disabled={testing}
              className="rounded-full bg-[#EE8720] text-white px-5 py-2 text-sm font-bold disabled:opacity-60 inline-flex items-center gap-2"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Test print
            </button>
            <button
              onClick={disconnect}
              className="rounded-full border border-[#F0DFD0] px-5 py-2 text-sm font-bold text-[#E83934] inline-flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#7a4b3a]">
            Pair a thermal receipt printer for silent printing. Your browser will prompt you to select the device.
          </p>
          <div className="flex flex-wrap gap-2">
            {support.serial && (
              <button
                onClick={() => pair("usb")}
                disabled={pairing}
                className="rounded-full bg-[#581E12] text-white px-5 py-2 text-sm font-bold disabled:opacity-60 inline-flex items-center gap-2"
              >
                {pairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Usb className="w-4 h-4" />} Pair USB (Serial)
              </button>
            )}
            {support.usb && (
              <button
                onClick={() => pair("usb-direct")}
                disabled={pairing}
                className="rounded-full bg-[#581E12] text-white px-5 py-2 text-sm font-bold disabled:opacity-60 inline-flex items-center gap-2"
              >
                {pairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Usb className="w-4 h-4" />} Pair USB (WebUSB)
              </button>
            )}
            {support.bluetooth && (
              <button
                onClick={() => pair("bluetooth")}
                disabled={pairing}
                className="rounded-full bg-[#581E12] text-white px-5 py-2 text-sm font-bold disabled:opacity-60 inline-flex items-center gap-2"
              >
                {pairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />} Pair Bluetooth printer
              </button>
            )}
          </div>
          <p className="text-xs text-[#7a4b3a]/70">
            If "Pair USB (Serial)" doesn't list your printer, use "Pair USB (WebUSB)" — it detects thermal printers
            even when the OS driver has claimed the USB port. Requires Chrome or Edge over HTTPS.
          </p>
        </div>
      )}
    </div>
  );
}
