// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/messages.js');
const G = require('../js/guard.js');

const ids = (r) => r.findings.map((f) => f.id);

// A made-up directory so the tests do not depend on real handles.
const DIR = {
  orgs: [{
    id: 'example', type: 'bank', website: 'https://example.com.sa',
    name: { ar: 'بنك المثال', en: 'Example Bank' }, aliases: ['example bank', 'المثال'],
    accounts: [
      { platform: 'x', handle: 'ExampleBank', source: 'https://example.com.sa/contact', checked: '2026-11-18' },
      { platform: 'instagram', handle: 'examplebank', source: 'https://example.com.sa/contact', checked: '2026-11-18' },
      { platform: 'tiktok', handle: 'unsourced_handle' }, // no source -> must be ignored
    ],
  }],
};

// ------------------------------------------------------------ messages ---

test('asking for a verification code is decisive (Arabic and English)', () => {
  for (const msg of [
    'هلا، وصلك كود على جوالك بالغلط، ارسله لي ضروري',
    'أرسل لي رمز التحقق اللي وصلك',
    'عطني الرمز اللي جاك الحين',
    'Please send me the verification code you just received',
    'A code was just sent to your phone by mistake, please send it to me',
  ]) {
    const r = M.analyzeMessages(msg);
    assert.ok(r.decisive, msg);
    assert.ok(ids(r).includes('otp'), msg);
  }
});

test('a genuine OTP SMS that warns the user is not flagged as a scam', () => {
  const r = M.analyzeMessages('رمز التحقق الخاص بك هو 4821. لا تشارك هذا الرمز مع أي شخص.');
  assert.equal(r.decisive, false);
  const en = M.analyzeMessages('Your verification code is 4821. Do not share this code with anyone.');
  assert.equal(en.decisive, false);
});

test('passwords and card details', () => {
  assert.ok(M.analyzeMessages('نحتاج كلمة المرور لتحديث حسابك').decisive);
  assert.ok(M.analyzeMessages('الرجاء إدخال رقم البطاقة وتاريخ الانتهاء').decisive);
  assert.ok(M.analyzeMessages('Please confirm your card number and CVV').decisive);
  assert.ok(ids(M.analyzeMessages('Then enter your PIN to confirm')).includes('password'));
});

test('promo codes are not verification codes', () => {
  assert.equal(M.analyzeMessages('Enter the promo code SAVE10 at checkout').decisive, false);
});

test('pressure and money signs', () => {
  const r = M.analyzeMessages('سيتم إيقاف حسابك خلال 24 ساعة. ادفع رسوم التفعيل فورا');
  assert.ok(ids(r).includes('threat'));
  assert.ok(ids(r).includes('urgency'));
  assert.ok(ids(r).includes('money'));
  const inv = M.analyzeMessages('ارباح يومية مضمونة، استثمر معنا وتواصل معي على الواتساب');
  assert.ok(ids(inv).includes('investment'));
  assert.ok(ids(inv).includes('move_platform'));
  assert.ok(ids(M.analyzeMessages('هذا رقمي الجديد، جوالي خرب')).includes('new_number'));
});

test('links inside messages', () => {
  const r = M.analyzeMessages('Update your details here: https://instagram-verify-login.com/x');
  assert.ok(ids(r).includes('dangerous_link'));
  assert.ok(r.decisive);
  assert.ok(ids(M.analyzeMessages('شوف هذا bit.ly/3abc')).includes('risky_link'));
  assert.equal(M.analyzeMessages('حسابنا الرسمي https://instagram.com/examplebank').findings.length, 0);
});

test('normal friendly messages raise nothing', () => {
  const r = M.analyzeMessages('السلام عليكم، كيف حالك؟ متى نلتقي بكرة؟');
  assert.equal(r.findings.length, 0);
});

// ------------------------------------------------------------ identity ---

test('official account from the directory (same platform)', () => {
  const r = G.analyze({ account: 'https://x.com/ExampleBank', claim: 'Example Bank' }, DIR);
  assert.equal(r.identity.status, 'official');
  assert.equal(r.level, 'official');
  // Also recognised without naming the organisation.
  assert.equal(G.analyze({ account: 'instagram.com/examplebank' }, DIR).identity.status, 'official');
});

test('claims to be the organisation but is a different account', () => {
  const r = G.analyze({ account: 'https://x.com/Example_Bank_Care', claim: 'بنك المثال' }, DIR);
  assert.equal(r.identity.status, 'not_official');
  assert.equal(r.identity.reason, 'imitation');
  assert.equal(r.level, 'not_official');
  const other = G.analyze({ account: 'https://x.com/someone_else', claim: 'example bank' }, DIR);
  assert.equal(other.identity.reason, 'different');
});

test('look-alike of an official account is caught even without a claim', () => {
  const r = G.analyze({ account: 'https://x.com/ExampIeBank' }, DIR); // capital I instead of l
  assert.equal(r.identity.status, 'not_official');
  assert.equal(r.identity.org.id, 'example');
});

test('same handle on another platform is not confirmed', () => {
  const r = G.analyze({ account: 'https://www.tiktok.com/@examplebank', claim: 'Example Bank' }, DIR);
  assert.equal(r.identity.status, 'unconfirmed');
  assert.equal(r.identity.reason, 'not_on_platform');
});

test('handles without a source are ignored', () => {
  const r = G.analyze({ account: 'https://www.tiktok.com/@unsourced_handle', claim: 'Example Bank' }, DIR);
  assert.notEqual(r.identity.status, 'official');
});

test('organisation not in the list', () => {
  const r = G.analyze({ account: '@whatever', claim: 'شركة غير موجودة' }, DIR);
  assert.equal(r.identity.status, 'unconfirmed');
  assert.equal(r.identity.reason, 'unknown_org');
  assert.ok(!G.parseClaim('zainab_99', { orgs: [{ name: { ar: 'زين', en: 'Zain' }, aliases: ['zain'], accounts: [] }] }).org);
});

test('real account pasted by the user (link from the official website)', () => {
  const ok = G.analyze({ account: 'https://instagram.com/yazan_omar', claim: 'https://www.instagram.com/yazan_omar/' }, DIR);
  assert.equal(ok.identity.status, 'official');
  const fake = G.analyze({ account: 'https://instagram.com/yazan_0mar', claim: 'https://instagram.com/yazan_omar' }, DIR);
  assert.equal(fake.identity.status, 'not_official');
  assert.equal(fake.identity.reason, 'imitation_of_claim');
  const otherPlatform = G.analyze({ account: 'https://x.com/yazan_omar', claim: 'https://instagram.com/yazan_omar' }, DIR);
  assert.equal(otherPlatform.identity.status, 'unconfirmed');
});

// --------------------------------------------------------------- badges ---

test('badge meanings', () => {
  assert.deepEqual(G.checkBadge('x', 'blue', true), { id: 'badge_x_blue', warn: true });
  assert.deepEqual(G.checkBadge('x', 'gold', true), { id: 'badge_x_gold', warn: false });
  assert.deepEqual(G.checkBadge('instagram', 'gold', false), { id: 'badge_unexpected', warn: true });
  assert.equal(G.checkBadge('x', 'unsure', true), null);
});

// -------------------------------------------------------------- verdict ---

test('scam outranks everything, even an official account', () => {
  const r = G.analyze({ account: 'https://x.com/ExampleBank', claim: 'Example Bank',
    messages: 'ارسل لي رمز التحقق لتحديث حسابك' }, DIR);
  assert.equal(r.level, 'scam');
  assert.ok(r.notes.includes('official_but_scam'));
});

test('a fake platform link as the account is a scam', () => {
  assert.equal(G.analyze({ account: 'https://instagrarn.com/yazan' }, DIR).level, 'scam');
});

test('several warning signs', () => {
  const r = G.analyze({ account: '@prize_center', messages: 'مبروك ربحت جائزة! ادفع رسوم التوصيل فورا' }, DIR);
  assert.equal(r.level, 'warning');
});

test('nothing found', () => {
  const r = G.analyze({ account: '@yazanomar', messages: 'هلا، كيف حالك؟' }, DIR);
  assert.equal(r.level, 'clear');
});
