const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_ABOUT, validateAbout } = require('../src/siteContent');

test('About Us accepts plain text, optional contact fields and international paragraphs', () => {
  const content = validateAbout({ ...DEFAULT_ABOUT, title: '  Our club  ', body: 'سلام\n\nOur story <b>as text</b>', website: 'https://example.test/about', contactEmail: 'team@example.test' });
  assert.equal(content.title, 'Our club');
  assert.equal(content.body, 'سلام\n\nOur story <b>as text</b>');
  assert.equal(content.contactEmail, 'team@example.test');
});
test('About Us rejects empty, oversized and non-text content', () => {
  for (const input of [null, [], {}, { ...DEFAULT_ABOUT, title: '   ' }, { ...DEFAULT_ABOUT, body: '' }, { ...DEFAULT_ABOUT, title: 'x'.repeat(101) }, { ...DEFAULT_ABOUT, body: 'x'.repeat(10001) }, { ...DEFAULT_ABOUT, github: 123 }, { ...DEFAULT_ABOUT, contactEmail: 'bad@email' }]) assert.throws(() => validateAbout(input));
});
test('About Us rejects unsafe or credential-bearing community links', () => {
  for (const link of ['javascript:alert(1)', 'data:text/html,hello', '//example.test', 'ftp://example.test', 'https://user:password@example.test', 'https://example.test/ bad', 'https://example.test/\nnext']) {
    for (const key of ['website', 'github', 'telegram']) assert.throws(() => validateAbout({ ...DEFAULT_ABOUT, [key]: link }));
  }
});
