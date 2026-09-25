import { base44 } from "@/api/base44Client";

export async function nextOrderNumber() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const prefix = `NAR-${stamp}-`;
  const todays = await base44.entities.Order.filter({ order_number: { $regex: `^${prefix}` } });
  const seq = todays.length + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// Resolve the logged-in staff member's name once per session so audit entries
// record who actually performed the action. The old role-switcher value is
// gone, so we read the identity from the auth user / staff profile instead.
let _cachedUserName = null;
async function currentUserName() {
  if (_cachedUserName) return _cachedUserName;
  try {
    const me = await base44.auth.me();
    if (me?.email) {
      const appUsers = await base44.entities.AppUser.list("name");
      const mine = appUsers.find((u) => (u.email || "").toLowerCase() === me.email.toLowerCase());
      _cachedUserName = mine?.name || me.full_name || me.email;
    }
  } catch {
    // not logged in
  }
  if (!_cachedUserName) _cachedUserName = "System";
  return _cachedUserName;
}

export async function audit(action, module, extra = {}) {
  const user_name = await currentUserName();
  await base44.entities.AuditLog.create({
    user_name,
    action,
    module,
    ...extra,
  });
}

/** Idempotent ingredient consumption: only deducts once per order, from the
 *  branch's StockLedger row (not the global Ingredient.current_stock). */
export async function consumeInventory(order, userName = "System") {
  if (order.inventory_deducted) return { deducted: false };
  const branch = order.branch || "NAR Commi";
  const [recipes, ingredients, ledger] = await Promise.all([
    base44.entities.Recipe.list(),
    base44.entities.Ingredient.list(),
    base44.entities.StockLedger.filter({ item_type: "Production", branch }),
  ]);
  const needs = {};
  for (const item of order.items || []) {
    const recipe = recipes.find(
      (r) => r.product_id === item.product_id && r.variant_name === item.variant_name
    );
    if (!recipe) continue;
    for (const ri of recipe.items || []) {
      needs[ri.ingredient_id] = (needs[ri.ingredient_id] || 0) + ri.quantity * item.quantity;
    }
  }
  const txs = [];
  const ledgerUpdates = [];
  for (const [ingredient_id, qty] of Object.entries(needs)) {
    const ing = ingredients.find((i) => i.id === ingredient_id);
    if (!ing) continue;
    const row = ledger.find((r) => r.item_id === ingredient_id);
    if (!row) continue;
    ledgerUpdates.push({
      id: row.id,
      current_stock: Math.round((row.current_stock - qty) * 1000) / 1000,
    });
    txs.push({
      ingredient_id,
      ingredient_name: ing.name,
      ingredient_type: "Production",
      branch,
      type: "Sales Consumption",
      quantity: -qty,
      unit: ing.unit,
      reference: order.order_number,
      user_name: userName,
    });
  }
  if (ledgerUpdates.length) await base44.entities.StockLedger.bulkUpdate(ledgerUpdates);
  if (txs.length) await base44.entities.InventoryTransaction.bulkCreate(txs);
  await base44.entities.Order.update(order.id, { inventory_deducted: true });
  return { deducted: true, count: txs.length };
}

/** Reverse consumption when a completed order is cancelled/refunded —
 *  credits the branch's StockLedger row back. */
export async function reverseInventory(order, userName = "System") {
  if (!order.inventory_deducted) return;
  const branch = order.branch || "NAR Commi";
  const txs = await base44.entities.InventoryTransaction.filter({
    reference: order.order_number,
    type: "Sales Consumption",
    branch,
  });
  if (!txs.length) return;
  const ledger = await base44.entities.StockLedger.filter({ item_type: "Production", branch });
  const updates = [];
  const returns = [];
  for (const tx of txs) {
    const row = ledger.find((r) => r.item_id === tx.ingredient_id);
    if (!row) continue;
    const qty = Math.abs(tx.quantity);
    updates.push({
      id: row.id,
      current_stock: Math.round((row.current_stock + qty) * 1000) / 1000,
    });
    returns.push({
      ingredient_id: tx.ingredient_id,
      ingredient_name: tx.ingredient_name,
      ingredient_type: "Production",
      branch,
      type: "Return",
      quantity: qty,
      unit: tx.unit,
      reference: order.order_number,
      user_name: userName,
      notes: "Reversal of completed order",
    });
  }
  if (updates.length) await base44.entities.StockLedger.bulkUpdate(updates);
  if (returns.length) await base44.entities.InventoryTransaction.bulkCreate(returns);
  await base44.entities.Order.update(order.id, { inventory_deducted: false });
}

export async function updateOrderStatus(order, status, userName = "ADMIN", cookName, reason) {
  const history = [...(order.status_history || []), { status, at: new Date().toISOString(), by: userName, ...(reason ? { reason } : {}) }];
  const updates = { status, status_history: history };
  if (status === "Preparing" && cookName) updates.cook_name = cookName;
  if (reason) {
    const noteLine = `[${userName}] Cancellation reason: ${reason}`;
    updates.notes = `${order.notes ? order.notes + "\n" : ""}${noteLine}`;
  }
  await base44.entities.Order.update(order.id, updates);
  const fresh = await base44.entities.Order.get(order.id);
  if (status === "Completed") await consumeInventory(fresh, userName);
  if (["Cancelled", "Refunded"].includes(status)) await reverseInventory(fresh, userName);
  if (status === "Refunded") await base44.entities.Order.update(order.id, { payment_status: "Refunded" });
  await audit(`Order ${status}`, "orders", { record_id: order.order_number, new_value: status, previous_value: order.status });
  return base44.entities.Order.get(order.id);
}

export async function loadSettings() {
  const list = await base44.entities.Setting.list();
  return list[0] || null;
}