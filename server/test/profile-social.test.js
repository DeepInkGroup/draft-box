const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail } = require('../src/accountEmail');
const { normalizeTag, validateDetails } = require('../src/clans');
test('account emails normalize and reject invalid input', () => {
  assert.equal(normalizeEmail('  Manager@Example.test '), 'manager@example.test');
  for (const value of [null, [], '', 'not-an-email', 'a@b', 'a b@example.test', 'x'.repeat(255) + '@example.test']) assert.throws(() => normalizeEmail(value));
});
test('clan tags are unique identifiers with bounded details and support international names', () => {
  assert.equal(normalizeTag(' pgl1 '), 'PGL1');
  for (const value of ['', 'A', '1234567', 'A-B', 'admin', null]) assert.throws(() => normalizeTag(value));
  assert.deepEqual(validateDetails({ name: '  تیم فوتبال  ', description: ' دوستان فوتبال ' }), { name: 'تیم فوتبال', description: 'دوستان فوتبال' });
  for (const value of [{ name: 'AB' }, { name: 'x'.repeat(41) }, { name: 'Good name', description: 'x'.repeat(241) }, { name: 123 }]) assert.throws(() => validateDetails(value));
});
