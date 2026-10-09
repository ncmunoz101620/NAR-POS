import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { reportCSV, reportWorkbook, reportTotal } from '../../src/lib/reportExport.js';

test('CSV declares UTF-8 for Excel and preserves peso and quoted names', () => {
  const csv = reportCSV(['Method', 'Amount'], [['GCash, "Corporate"', '₱4,454.00']]);
  assert.deepEqual([...Buffer.from(csv).subarray(0, 3)], [239, 187, 191]);
  assert.ok(csv.includes('"GCash, ""Corporate""","₱4,454.00"'));
});

test('Excel round trip preserves numeric currency and totals', async () => {
  const rows = [['Cash', '₱4,454.00'], ['GCash', '₱1,257.00']];
  const total = reportTotal(rows, 1);
  assert.equal(total, '₱5,711.00');
  assert.equal(reportTotal([], 1), '₱0.00');
  const bytes = XLSX.write(await reportWorkbook(['Method', 'Amount'], [...rows, ['Total Amount', total]]), { type: 'buffer', bookType: 'xlsx' });
  const sheet = XLSX.read(bytes, { type: 'buffer', cellNF: true }).Sheets.Report;
  assert.equal(sheet.B2.t, 'n');
  assert.equal(sheet.B2.v, 4454);
  assert.equal(sheet.B4.v, 5711);
  assert.ok(sheet.B2.z.includes('₱'));
});
