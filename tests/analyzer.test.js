// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/analyzer.js');

const ids = (r) => r.factors.map((f) => f.id);

test('parses handles and profile links', () => {
  assert.equal(A.parseAccount('@yazan').username, 'yazan');
  assert.equal(A.parseAccount('yazan.omar').kind, 'handle');
  const ig = A.parseAccount('https://www.instagram.com/yazan.omar/');
  assert.equal(ig.platform, 'Instagram');
  assert.equal(ig.username, 'yazan.omar');
  assert.equal(A.parseAccount('linkedin.com/in/mohannad').username, 'mohannad');
  assert.equal(A.parseAccount('x.com/someone').platform, 'X (Twitter)');
});

test('a clean handle with no ticked signs scores 0', () => {
  const r = A.analyze({ account: '@yazan_omar', manual: [] });
  assert.equal(r.score, 0);
  assert.equal(r.level, 'low');
});

test('manual weights match the prototype', () => {
  const all = Object.keys(A.MANUAL);
  const r = A.analyze({ account: '@someone', manual: all });
  // 20+25+20+20+15 = 100, plus combinations, capped at 100.
  assert.equal(r.score, 100);
  assert.equal(r.level, 'high');
});

test('detects look-alike characters against the expected account', () => {
  const r = A.analyze({ account: '@yazan_0mar', expected: '@yazan_omar' });
  assert.ok(ids(r).includes('lookalike_name'));
  const cyr = A.analyze({ account: '@уazan_omar', expected: 'yazan_omar' }); // Cyrillic у
  assert.ok(ids(cyr).includes('homoglyph'));
  assert.ok(ids(cyr).includes('lookalike_name'));
  const rn = A.analyze({ account: 'rnohannad', expected: 'mohannad' });
  assert.ok(ids(rn).includes('lookalike_name'));
});

test('similar, extended and unrelated names', () => {
  assert.ok(ids(A.analyze({ account: 'yazann_omar', expected: 'yazan_omar' })).includes('similar_name'));
  assert.ok(ids(A.analyze({ account: 'yazanomar_support', expected: 'yazanomar' })).includes('contains_name'));
  assert.ok(ids(A.analyze({ account: 'abc_shop', expected: 'yazanomar' })).includes('name_mismatch'));
  const same = A.analyze({ account: '@YazanOmar', expected: 'yazanomar' });
  assert.equal(same.score, 0);
  assert.equal(same.notes[0].id, 'expected_match');
});

test('username signals', () => {
  assert.ok(ids(A.analyze({ account: 'bank_official' })).includes('keyword'));
  assert.ok(!ids(A.analyze({ account: 'realmadrid' })).includes('keyword'));
  assert.ok(ids(A.analyze({ account: 'real_bank' })).includes('keyword'));
  assert.ok(ids(A.analyze({ account: 'user84721' })).includes('many_digits'));
  assert.ok(ids(A.analyze({ account: 'xkcdqwrtz' })).includes('random_string'));
  assert.ok(ids(A.analyze({ account: 'yazan__omar' })).includes('odd_separators'));
  assert.ok(ids(A.analyze({ account: 'yazan​omar' })).includes('invisible_chars'));
});

test('link signals', () => {
  assert.ok(ids(A.analyze({ account: 'https://instagrarn.com/yazan' })).includes('lookalike_domain'));
  assert.ok(ids(A.analyze({ account: 'instagram-login.net/verify' })).includes('lookalike_domain'));
  assert.ok(ids(A.analyze({ account: 'https://instagram.com.verify-account.net/x' })).includes('lookalike_domain'));
  assert.ok(ids(A.analyze({ account: 'bit.ly/abc123' })).includes('shortener'));
  assert.ok(ids(A.analyze({ account: 'http://192.168.1.4/login' })).includes('ip_host'));
  assert.ok(ids(A.analyze({ account: 'http://instagram.com/yazan' })).includes('insecure_link'));
  assert.ok(ids(A.analyze({ account: 'https://xn--nstagram-r1a.com/yazan' })).includes('punycode_domain'));
  const real = A.analyze({ account: 'https://www.tiktok.com/@yazan' });
  assert.equal(real.score, 0);
  assert.equal(real.parsed.username, 'yazan');
});

test('combinations add points and groups are capped', () => {
  const r = A.analyze({ account: 'yazan_0mar', expected: 'yazan_omar', manual: ['sensitive_request'] });
  assert.ok(ids(r).includes('impersonation_scam'));
  // lookalike 30 + sensitive 15 + pattern 15
  assert.equal(r.score, 60);

  const capped = A.analyze({ account: 'уazan_official_88888', expected: 'yazan', manual: ['suspicious_username'] });
  assert.ok(capped.caps.some((c) => c.group === 'identity'));
  assert.ok(capped.score <= A.GROUP_CAPS.identity);
});
