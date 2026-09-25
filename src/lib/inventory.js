import { base44 } from "@/api/base44Client";

export const BRANCHES = ["NAR Commi", "NAR Greenwoods"];

/**
 * Ensures a StockLedger row exists for every (item, branch) pair.
 * Returns the ledger rows for the given item across branches.
 */
export async function ensureLedgerRows(item, itemType) {
  const existing = await base44.entities.StockLedger.filter({
    item_id: item.id,
    item_type: itemType,
  });
  const missing = BRANCHES.filter(
    (b) => !existing.some((r) => r.branch === b)
  );
  if (missing.length) {
    const created = await base44.entities.StockLedger.bulkCreate(
      missing.map((b) => ({
        item_id: item.id,
        item_type: itemType,
        item_name: item.name,
        branch: b,
        current_stock: 0,
        unit: item.unit,
        min_stock: item.min_stock || 0,
      }))
    );
    return [...existing, ...created];
  }
  return existing;
}

/**
 * Get the ledger row for an item + branch, creating it if missing.
 */
export async function getLedgerRow(itemId, itemType, branch) {
  const rows = await base44.entities.StockLedger.filter({
    item_id: itemId,
    item_type: itemType,
    branch,
  });
  if (rows.length) return rows[0];
  return null;
}

/**
 * Adjust a ledger row by a signed delta. Returns the updated stock or null
 * if the row doesn't exist (caller should ensureLedgerRows first).
 */
export async function adjustLedgerStock(itemId, itemType, branch, delta) {
  const row = await getLedgerRow(itemId, itemType, branch);
  if (!row) return null;
  const newStock = Math.round((row.current_stock + delta) * 1000) / 1000;
  await base44.entities.StockLedger.update(row.id, { current_stock: newStock });
  return newStock;
}

/**
 * One-time migration: seed StockLedger rows for every existing Ingredient
 * and RawMaterial, splitting current_stock across branches (full stock to
 * the first branch, zero to the second) so no data is lost. Idempotent —
 * only creates rows that don't already exist.
 */
export async function migrateInventoryToLedger() {
  const [ingredients, rawMaterials, existingLedger] = await Promise.all([
    base44.entities.Ingredient.list(),
    base44.entities.RawMaterial.list(),
    base44.entities.StockLedger.list(),
  ]);

  const toCreate = [];

  for (const ing of ingredients.filter((i) => !i.deleted_at)) {
    for (const b of BRANCHES) {
      const exists = existingLedger.some(
        (r) => r.item_id === ing.id && r.item_type === "Production" && r.branch === b
      );
      if (!exists) {
        toCreate.push({
          item_id: ing.id,
          item_type: "Production",
          item_name: ing.name,
          branch: b,
          current_stock: b === BRANCHES[0] ? ing.current_stock || 0 : 0,
          unit: ing.unit,
          min_stock: ing.min_stock || 0,
        });
      }
    }
  }

  for (const rm of rawMaterials.filter((r) => !r.deleted_at)) {
    for (const b of BRANCHES) {
      const exists = existingLedger.some(
        (r) => r.item_id === rm.id && r.item_type === "Raw" && r.branch === b
      );
      if (!exists) {
        toCreate.push({
          item_id: rm.id,
          item_type: "Raw",
          item_name: rm.name,
          branch: b,
          current_stock: b === BRANCHES[0] ? rm.current_stock || 0 : 0,
          unit: rm.unit,
          min_stock: rm.min_stock || 0,
        });
      }
    }
  }

  if (toCreate.length) {
    await base44.entities.StockLedger.bulkCreate(toCreate);
  }
  return toCreate.length;
}

/**
 * Record a stock movement against a branch ledger row and log the transaction.
 */
export async function recordMovement({
  item,
  itemType,
  branch,
  type,
  quantity,
  reference = "",
  notes = "",
  userName = "System",
}) {
  const signed =
    type === "Waste" || type === "Transfer Out" ? -Math.abs(quantity) : quantity;
  const newStock = await adjustLedgerStock(item.id, itemType, branch, signed);
  if (newStock === null) {
    // ensure rows exist then retry
    await ensureLedgerRows(item, itemType);
    const retry = await adjustLedgerStock(item.id, itemType, branch, signed);
    if (retry === null) return null;
  }
  await base44.entities.InventoryTransaction.create({
    ingredient_id: item.id,
    ingredient_name: item.name,
    ingredient_type: itemType,
    branch,
    type,
    quantity: signed,
    unit: item.unit,
    reference,
    user_name: userName,
    notes,
  });
  return newStock;
}