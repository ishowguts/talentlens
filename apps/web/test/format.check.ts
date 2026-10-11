import assert from 'node:assert/strict';
import { formatSalary } from '../src/lib/format';

assert.equal(formatSalary(null, null, 'GBP'), null);
assert.equal(formatSalary(80_000, 100_000, 'GBP'), '£80,000 – £100,000');
assert.equal(formatSalary(null, 100_000, 'GBP'), 'up to £100,000');
assert.equal(formatSalary(80_000, null, 'GBP'), 'from £80,000');
assert.equal(formatSalary(80_000, 80_000, 'GBP'), '£80,000');
assert.equal(formatSalary(0, null, null), 'from 0');
console.log('Salary display checks passed');
