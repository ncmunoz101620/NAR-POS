import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { normalizeSalesTrend } from '../../src/lib/salesTrend.js';

const require = createRequire(import.meta.url);
const { getDomainOfDataByKey } = require('recharts/lib/util/ChartUtils.js');

test('MySQL decimal strings use a numeric chart maximum rather than clipping larger days', () => {
  const source = [
    { day: '2026-09-05', sales: '35038.40' },
    { day: '2026-09-06', sales: '5025.00' },
    { day: '2026-09-07', sales: '132656.00' },
    { day: '2026-09-08', sales: '0.00' },
  ];
  assert.equal(getDomainOfDataByKey(source, 'sales', 'number')[1], '5025.00');
  const normalized = normalizeSalesTrend(source);
  assert.deepEqual(getDomainOfDataByKey(normalized, 'sales', 'number'), [0, 132656]);
  assert.equal(normalized[0].sales, 35038.4);
  assert.equal(source[0].sales, '35038.40');
});

test('empty and zero-sales ranges remain valid', () => {
  assert.deepEqual(normalizeSalesTrend([]), []);
  assert.equal(normalizeSalesTrend([{ sales: 0 }])[0].sales, 0);
  assert.equal(normalizeSalesTrend([{ sales: 'invalid' }])[0].sales, null);
});
