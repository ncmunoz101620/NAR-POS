import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Volume2, VolumeX, Bell } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import KitchenOrderCard from "@/components/admin/KitchenOrderCard";
import { updateOrderStatus, loadSettings } from "@/lib/pos";
import { toManilaDate } from "@/lib/datetime";
import { printKitchenSlip, getSavedPrinter, describePrintError } from "@/lib/thermalPrinter";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Kitchen owns the prep lifecycle: Incoming → Preparing → Ready.
// Completion / delivery is handled by the front-of-house team, so Ready orders
// stay on the board until they leave the kitchen's scope.
const COLUMNS = [
  { key: "incoming", title: "Incoming", statuses: ["Pending", "Confirmed"], next: "Preparing", label: "Start cooking" },
  { key: "preparing", title: "Preparing", statuses: ["Preparing"], next: "Ready", label: "Mark ready" },
  { key: "ready", title: "Ready for pickup", statuses: ["Ready"], next: "Out for Delivery", label: "Out for Delivery" },
];

const STALE_MIN = 10;

function elapsed(order, now) {
  const mins = Math.floor((now - toManilaDate(order.created_date).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default function AdminKitchenDisplay() {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(null);
  const [cookPrompt, setCookPrompt] = useState(null);
  const [cookName, setCookName] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [newIds, setNewIds] = useState(() => new Set());

  const soundOnRef = useRef(true);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  const knownIds = useRef(new Set());
  const firstLoad = useRef(true);
  const audioCtx = useRef(null);

  const beep = () => {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx.current;
      if (ctx.state === "suspended") ctx.resume();
      const playTone = (freq, start, dur = 0.5, peak = 0.95) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = "square";
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + start + 0.01);
        g.gain.setValueAtTime(peak, ctx.currentTime + start + dur - 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        o.start(ctx.currentTime + start);
        o.stop(ctx.currentTime + start + dur);
      };
      // Two repeating bursts of a two-tone alert for a loud, attention-grabbing chime.
      playTone(880, 0, 0.32);
      playTone(1175, 0.34, 0.32);
      playTone(880, 0.8, 0.32);
      playTone(1175, 1.14, 0.32);
    } catch { /* audio not available */ }
  };

  const refresh = () =>
    base44.entities.Order.list("-created_date", 200).then((o) => {
      setOrders(o);
      if (firstLoad.current) {
        knownIds.current = new Set(o.map((x) => x.id));
        firstLoad.current = false;
      } else {
        const fresh = o.filter((x) => !knownIds.current.has(x.id));
        if (fresh.length) {
          fresh.forEach((x) => knownIds.current.add(x.id));
          const freshIds = new Set(fresh.map((x) => x.id));
          setNewIds((prev) => new Set([...prev, ...freshIds]));
          if (soundOnRef.current) beep();
          setTimeout(() => {
            setNewIds((prev) => {
              const next = new Set(prev);
              freshIds.forEach((id) => next.delete(id));
              return next;
            });
          }, 12000);
        }
      }
      setLoading(false);
    });

  useEffect(() => {
    refresh();
    const unsub = base44.entities.Order.subscribe(() => refresh());
    const t = setInterval(() => setNow(Date.now()), 30000);
    // Polling fallback so new orders appear even if the realtime event is missed.
    const p = setInterval(refresh, 15000);
    return () => {
      unsub();
      clearInterval(t);
      clearInterval(p);
    };
  }, []);

  const decorate = (o) => ({
    ...o,
    _elapsed: elapsed(o, now),
    _stale: (now - toManilaDate(o.created_date).getTime()) / 60000 >= STALE_MIN,
  });

  const columnItems = (col, source) =>
    source
      .filter((o) => col.statuses.includes(o.status))
      .sort((a, b) => toManilaDate(a.created_date) - toManilaDate(b.created_date))
      .map(decorate);

  const advance = async (order, session, overrideName) => {
    const col = COLUMNS.find((c) => c.statuses.includes(order.status));
    if (!col?.next) return;
    setBusy(order.id);
    try {
      const userName = overrideName || session.appUser?.name || session.roleName || "Kitchen";
      await updateOrderStatus(order, col.next, userName, overrideName);
      toast({ title: `#${order.order_number} → ${col.next}` });
      // Print a kitchen slip when cooking starts (Incoming → Preparing).
      if (col.next === "Preparing") {
        try {
          const settings = await loadSettings();
          const res = await printKitchenSlip(order, settings, overrideName || userName);
          if (res.ok) {
            toast({ title: "Kitchen slip printed", description: `#${order.order_number} sent to printer` });
          } else {
            const m = describePrintError(res);
            toast({ title: `Kitchen slip not printed — ${m.title}`, description: m.description, variant: "destructive" });
          }
        } catch (e) {
          toast({ title: "Kitchen slip not printed", description: e?.message || String(e), variant: "destructive" });
        }
      }
      refresh();
    } catch (e) {
      toast({ title: "Failed to update order", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleAdvance = (order, session) => {
    const col = COLUMNS.find((c) => c.statuses.includes(order.status));
    // Require the cook's name before starting to cook.
    if (col?.next === "Preparing") {
      setCookName("");
      setCookPrompt(order);
      return;
    }
    advance(order, session);
  };

  const confirmCook = (session) => {
    const name = cookName.trim();
    if (!name) return;
    const order = cookPrompt;
    setCookPrompt(null);
    advance(order, session, name);
  };

  return (
    <ModuleGuard module="kitchen">
      {(session) => {
        const canEdit = session.can("kitchen", "edit");
        return (
          <>
            <PageHeader title="Kitchen Display" subtitle="Live incoming orders — tap to advance status">
              <div className="flex items-center gap-2">
                {newIds.size > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EE8720] text-white px-3 py-2 text-sm font-bold animate-pulse">
                    <Bell className="w-4 h-4" /> {newIds.size} new order{newIds.size > 1 ? "s" : ""}
                  </span>
                )}
                {(session.roleName || "").toUpperCase() !== "RND COOK" && (
                  <button
                    onClick={() => setSoundOn((s) => !s)}
                    title={soundOn ? "Mute alerts" : "Enable sound alerts"}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${soundOn ? "border-[#EE8720] text-[#EE8720] bg-[#EE8720]/10" : "border-[#F0DFD0] text-[#7a4b3a] hover:bg-white"}`}
                  >
                    {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    {soundOn ? "Sound on" : "Muted"}
                  </button>
                )}
                <button
                  onClick={refresh}
                  className="inline-flex items-center gap-2 rounded-full border border-[#F0DFD0] px-4 py-2 text-sm font-bold text-[#581E12] hover:bg-white"
                >
                  <RefreshCw className="w-4 h-4" /> Refresh
                </button>
              </div>
            </PageHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COLUMNS.map((col) => {
                const myBranch = session.appUser?.branch;
                const isAdmin = (session.roleName || "").toUpperCase() === "ADMIN";
                // Admins and users assigned to "All" branches see every order.
                // Branch staff only see orders tagged with their branch;
                // orders without a branch (e.g. online orders) stay visible to every kitchen.
                const seesAll = isAdmin || !myBranch || myBranch === "All";
                const visible = seesAll
                  ? orders
                  : orders.filter((o) => !o.branch || o.branch === myBranch);
                const list = columnItems(col, visible);
                // CSR can only act on orders that are Ready for pickup; the
                // Incoming and Preparing boards are kitchen-only.
                const isCSR = (session.roleName || "").toUpperCase() === "CSR";
                const colCanEdit = canEdit && (!isCSR || col.key === "ready");
                return (
                  <div key={col.key} className="rounded-2xl bg-[#FBF6EF] border border-[#F0DFD0] flex flex-col max-h-[calc(100vh-180px)]">
                    <div className="px-4 py-3 border-b border-[#F0DFD0] flex items-center justify-between">
                      <h3 className="font-bold text-[#581E12]">{col.title}</h3>
                      <span className="text-xs font-bold bg-white text-[#7a4b3a] rounded-full px-2.5 py-0.5 border border-[#F0DFD0]">
                        {list.length}
                      </span>
                    </div>
                    <div className="p-3 space-y-3 overflow-y-auto flex-1">
                      {loading && <p className="text-center text-sm text-[#7a4b3a]/60 py-8">Loading…</p>}
                      {!loading && !list.length && (
                        <p className="text-center text-sm text-[#7a4b3a]/50 py-8">No orders.</p>
                      )}
                      {list.map((o) => (
                        <KitchenOrderCard
                          key={o.id}
                          order={o}
                          isNew={newIds.has(o.id)}
                          canEdit={colCanEdit && busy !== o.id}
                          nextDisabled={!col.next}
                          nextLabel={busy === o.id ? "Updating…" : col.label}
                          onAdvance={() => handleAdvance(o, session)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <Dialog open={!!cookPrompt} onOpenChange={(open) => { if (!open) setCookPrompt(null); }}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Start cooking</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="cook-name">Enter the cook's name</Label>
                  <Input
                    id="cook-name"
                    autoFocus
                    value={cookName}
                    onChange={(e) => setCookName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && cookName.trim()) confirmCook(session); }}
                    placeholder="Cook name"
                  />
                  <p className="text-xs text-[#7a4b3a]/70">The order will not start until a name is entered.</p>
                </div>
                <DialogFooter>
                  <button onClick={() => setCookPrompt(null)} className="rounded-full border border-[#F0DFD0] px-5 py-2 text-sm font-bold text-[#581E12] hover:bg-white">Cancel</button>
                  <button
                    onClick={() => confirmCook(session)}
                    disabled={!cookName.trim()}
                    className="rounded-full bg-[#EE8720] text-white px-5 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    Start cooking
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        );
      }}
    </ModuleGuard>
  );
}