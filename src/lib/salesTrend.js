// MySQL decimal aggregates may arrive as strings from older API deployments.
export function normalizeSalesTrend(rows) {
  return rows.map((row) => {
    const sales = Number(row.sales ?? 0);
    return { ...row, sales: Number.isFinite(sales) ? sales : null };
  });
}
