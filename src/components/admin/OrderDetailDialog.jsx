import React, { useState } from "react";
import { Printer, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Image } from "@/components/ui/image";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import StatusBadge from "@/components/StatusBadge";
import Receipt from "@/components/admin/Receipt";
import { peso, ORDER_STATUSES } from "@/lib/brand";
import { updateOrderStatus } from "@/lib/pos";
import { formatManila } from "@/lib/datetime";
import { api } from "@/api/client";
import * as thermalPrinter from "@/lib/thermalPrinter";

export default function OrderDetailDialog({ order, settings, session, openPrint, onClose, onChanged }) {
  const { toast } = useToast();
  const [current, setCurrent] = useState(order);
  const [status, setStatus] = useState(order.status);
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showProof, setShowProof] = useState(false);

  const isProofUrl = /^https?:\/\//.test(current.payment_reference || "");

  const canEdit = session.can("orders", "edit");
  const canRefund = session.can("orders", "refund");
  const canCancel = session.can("orders", "cancel");

  const allowed = ORDER_STATUSES.filter((s) => {
    if (s === "Refunded") return canRefund;
    if (s === "Cancelled") return canCancel;
    return canEdit;
  });

  const applyStatus = async () => {
    if (status === "Cancelled" && !cancelReason.trim()) {
      toast({ title: "Cancellation reason required", description: "Please enter a reason for cancelling this order.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
    const updated = await updateOrderStatus(current, status, session.roleName, undefined, status === "Cancelled" ? cancelReason.trim() : undefined);
    setCurrent(updated);
    if (status === "Cancelled") setCancelReason("");
    setBusy(false);
    onChanged?.();
    toast({
      title: `Order ${status}`,
      description: status === "Completed" ? "Ingredients deducted from inventory." : undefined,
    });
    } catch(error) { toast({title:'Order update failed',description:error.message,variant:'destructive'}); }
    finally { setBusy(false); }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    const notes = `${current.notes ? current.notes + "\n" : ""}[${session.roleName}] ${note.trim()}`;
    await api.entities.Order.update(current.id, { notes });
    setCurrent({ ...current, notes });
    setNote("");
    onChanged?.();
    toast({ title: "Note added" });
  };

  const markPaid = async () => {
    await api.entities.Order.update(current.id, { payment_status: "Paid" });
    setCurrent({ ...current, payment_status: "Paid" });
    onChanged?.();
  };

  const printReceipt = async () => {
    const copies = settings?.receipt_copies || 1;
    // Open the print window synchronously within the click so popup blockers
    // don't suppress it. (The builder preview sandbox blocks popups/print —
    // test on the published app.)
    const printWin = window.open("", "_blank", "width=380,height=640");
    const res = await thermalPrinter.printReceipt(current, settings, copies);
    if (res.ok) {
      try { printWin && printWin.close(); } catch {}
      toast({ title: "Receipt printed to thermal printer" });
      return;
    }
    if (!printWin) {
      toast({
        title: "Print window blocked",
        description: "Allow popups for this site, or open the published app — the builder preview blocks print dialogs.",
        variant: "destructive",
      });
      return;
    }
    printWin.document.open();
    printWin.document.write(thermalPrinter.receiptToHTML(current, settings));
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { try { printWin.print(); } catch {} }, 250);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-[#581E12]">
            <span className="font-mono">{current.order_number}</span>
            <StatusBadge status={current.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5 text-sm text-[#7a4b3a]">
            <p className="font-bold text-[#581E12] mb-2">Customer</p>
            <p>{current.customer_name} · {current.customer_phone}</p>
            {current.customer_email && <p>{current.customer_email}</p>}
            <p>{current.order_type}{current.table_number ? ` · Table ${current.table_number}` : ""}</p>
            {current.address && <p>{current.address}, {current.barangay}, {current.city}, {current.province}</p>}
            {current.landmark && <p>Landmark: {current.landmark}</p>}
            {(current.preferred_date || current.preferred_time) && <p>Preferred: {current.preferred_date} {current.preferred_time}</p>}
          </div>
          <div className="space-y-1.5 text-sm text-[#7a4b3a]">
            <p className="font-bold text-[#581E12] mb-2">Payment</p>
            <p>{current.payment_method} · {current.payment_status}</p>
            {current.payment_reference && (
              isProofUrl ? (
                <button onClick={() => setShowProof(true)} className="inline-flex items-center gap-1.5 text-[#EE8720] font-bold text-sm hover:underline">
                  <ImageIcon className="w-4 h-4" /> View Proof of Payment
                </button>
              ) : (
                <p>Ref: {current.payment_reference}</p>
              )
            )}
            <p>Created by: {current.created_by_name} ({current.source})</p>
            {current.cook_name && <p>Cook: <span className="font-semibold text-[#581E12]">{current.cook_name}</span></p>}
            {current.payment_status !== "Paid" && canEdit && (
              <button onClick={markPaid} className="mt-2 rounded-full bg-emerald-600 text-white px-4 py-1.5 text-xs font-bold">Mark as Paid</button>
            )}
          </div>
        </div>

        <div className="mt-2 rounded-xl border border-[#F0DFD0] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#FBF6EF] text-xs uppercase text-[#7a4b3a]">
              <tr><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Subtotal</th></tr>
            </thead>
            <tbody>
              {(current.items || []).map((i, idx) => (
                <tr key={idx} className="border-t border-[#F7EEE5]">
                  <td className="px-3 py-2 text-[#581E12] font-semibold">{i.product_name}<span className="block text-xs font-normal text-[#7a4b3a]">{i.variant_name}{(i.modifiers || []).length ? ` · ${i.modifiers.join(", ")}` : ""}{i.notes ? ` · ${i.notes}` : ""}</span></td>
                  <td className="px-3 py-2 text-center">{i.quantity}</td>
                  <td className="px-3 py-2 text-right">{peso(i.unit_price, settings?.currency_symbol)}</td>
                  <td className="px-3 py-2 text-right font-bold">{peso(i.subtotal, settings?.currency_symbol)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#FBF6EF]">
              <tr><td colSpan={3} className="px-3 py-1.5 text-right text-[#7a4b3a]">Subtotal</td><td className="px-3 py-1.5 text-right font-semibold text-[#581E12]">{peso(current.subtotal, settings?.currency_symbol)}</td></tr>
              {current.discount > 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-1.5 text-right text-[#7a4b3a]">
                    Discount{current.discount_type ? ` (${current.discount_type})` : ""}{current.discount_reason ? ` · ${current.discount_reason}` : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-red-600">−{peso(current.discount, settings?.currency_symbol)}</td>
                </tr>
              )}
              {current.delivery_fee > 0 && (
                <tr><td colSpan={3} className="px-3 py-1.5 text-right text-[#7a4b3a]">Delivery fee</td><td className="px-3 py-1.5 text-right font-semibold text-[#581E12]">{peso(current.delivery_fee, settings?.currency_symbol)}</td></tr>
              )}
              {current.tax > 0 && (
                <tr><td colSpan={3} className="px-3 py-1.5 text-right text-[#7a4b3a]">Tax</td><td className="px-3 py-1.5 text-right font-semibold text-[#581E12]">{peso(current.tax, settings?.currency_symbol)}</td></tr>
              )}
              <tr><td colSpan={3} className="px-3 py-2 text-right font-bold">Total</td><td className="px-3 py-2 text-right font-extrabold text-[#581E12]">{peso(current.total, settings?.currency_symbol)}</td></tr>
            </tfoot>
          </table>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="text-xs font-semibold text-[#7a4b3a] mb-1">Update status</p>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>{allowed.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <button onClick={applyStatus} disabled={busy || status === current.status || (status === "Cancelled" && !cancelReason.trim())} className="rounded-full bg-[#EE8720] text-white px-5 py-2.5 text-sm font-bold disabled:opacity-50">
              {busy ? "Saving…" : "Apply"}
            </button>
            {session.can("orders", "print") && (
              <button onClick={printReceipt} className="rounded-full border border-[#F0DFD0] px-5 py-2.5 text-sm font-bold text-[#581E12] inline-flex items-center gap-2">
                <Printer className="w-4 h-4" /> Print receipt
              </button>
            )}
          </div>
        )}

        {canEdit && status === "Cancelled" && (
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
            <p className="text-xs font-semibold text-red-700 mb-1">Cancellation reason <span className="text-red-500">*</span></p>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Why is this order being cancelled?" className="min-h-[60px] bg-white border-red-200" />
            <p className="text-xs text-red-600/80 mt-1">A reason is required to cancel this order.</p>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-[#7a4b3a] mb-1">Notes</p>
          {current.notes && <p className="text-sm whitespace-pre-line bg-[#FBF6EF] rounded-xl p-3 text-[#7a4b3a] mb-2">{current.notes}</p>}
          {canEdit && (
            <div className="flex gap-2">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" className="min-h-[42px]" />
              <button onClick={addNote} className="rounded-xl bg-[#581E12] text-white px-4 text-sm font-bold">Add</button>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-[#7a4b3a] mb-2">Status history</p>
          <ol className="text-sm space-y-1 text-[#7a4b3a]">
            {(current.status_history || []).map((h, i) => (
              <li key={i}>• <b className="text-[#581E12]">{h.status}</b> — {formatManila(h.at)} by {h.by}{h.reason ? <span className="block ml-3 text-xs text-red-600/90">Reason: {h.reason}</span> : null}</li>
            ))}
          </ol>
        </div>

        <div id="receipt-print" className={openPrint ? "" : "hidden print:block"}>
          <Receipt order={current} settings={settings} />
        </div>

        {showProof && isProofUrl && (
          <Dialog open onOpenChange={() => setShowProof(false)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-[#581E12]">Proof of Payment</DialogTitle>
              </DialogHeader>
              <div className="rounded-xl overflow-hidden border border-[#F0DFD0]">
                <Image src={current.payment_reference} alt="Proof of payment" className="w-full max-h-[70vh]" fittingType="fit" />
              </div>
              <a href={current.payment_reference} target="_blank" rel="noreferrer" className="text-sm text-[#EE8720] font-bold hover:underline text-center">
                Open in new tab
              </a>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
