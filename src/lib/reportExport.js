

export function reportTotal(rows, column) {
  const cents = rows.reduce((sum, row) => sum + Math.round(Number(String(row[column]).replace(/[₱,]/g, '')) * 100), 0);
  return '₱' + (cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function reportCSV(headers, rows) {
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(quote).join(',')).join('\r\n');
}

export async function reportWorkbook(headers, rows) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  rows.forEach((row, r) => row.forEach((value, c) => {
    if (typeof value === 'string' && /^₱-?[\d,]+\.\d{2}$/.test(value)) {
      sheet[XLSX.utils.encode_cell({ r: r + 1, c })] = {
        t: 'n', v: Number(value.slice(1).replaceAll(',', '')), z: '"₱"#,##0.00;"₱"-#,##0.00',
      };
    }
  }));
  sheet['!cols'] = headers.map(() => ({ wch: 22 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Report');
  return workbook;
}

export async function exportReport(title, headers, rows, format) {
  const filename = title.replace(/\s+/g, '-').toLowerCase();
  if (format === 'xlsx') {
    const XLSX = await import("xlsx");
    XLSX.writeFile(await reportWorkbook(headers, rows), `${filename}.xlsx`);
    return;
  }
  const url = URL.createObjectURL(new Blob([reportCSV(headers, rows)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
