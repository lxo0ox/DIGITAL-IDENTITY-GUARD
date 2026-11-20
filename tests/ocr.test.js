// Run with: node --test   (only the text helpers; the OCR itself runs in the browser)
const test = require('node:test');
const assert = require('node:assert/strict');
global.self = global;
require('../js/ocr.js');
const O = global.DIGOcr;

test('tidy joins lines of one bubble and removes direction marks', () => {
  assert.equal(O.tidy('first line\nsecond line\n\nnext bubble\n\n|\n'), 'first line second line\nnext bubble');
  assert.equal(O.tidy('حسابي ‎ial‏ القديم'), 'حسابي ial القديم');
});

test('finds links and @usernames, and offers username-like lines', () => {
  const r = O.findAccounts('Bank Support\n@Bank_Support_KSA1\nopen https://sa-bank.com and instagram.com/yazan_omar.');
  assert.deepEqual(r.sure, ['instagram.com/yazan_omar', '@Bank_Support_KSA1']);
  const chat = O.findAccounts('yazan_Omar\nنشط الآن\nهلا والله');
  assert.deepEqual(chat.sure, []);
  assert.deepEqual(chat.maybe, ['@yazan_Omar']);
  assert.deepEqual(O.findAccounts('email me at a@b.com').sure, []);
});
