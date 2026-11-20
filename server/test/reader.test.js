// Run with: npm test   (no API key needed: the Claude client is faked)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, SCHEMA, MODEL, validate } from '../reader.js';

const ENV = { ALLOWED_ORIGINS: 'https://lxo0ox.github.io' };
const GOOD = {
  kind: 'chat', platform: 'instagram',
  account: { username: 'yazan_0mar', display_name: 'Yazan', username_uncertain: false, profile_link: '' },
  badge: 'none', badge_is_emoji: false, bio: '',
  stats: { followers: '', following: '', posts: '', joined: '' },
  messages: [{ from: 'them', text: 'وصلك كود، ارسله لي' }], links: [], unclear: '',
};

function fakeClient(reply, calls) {
  return () => ({ beta: { messages: { create: async (params) => {
    calls && calls.push(params);
    if (reply instanceof Error) throw reply;
    return reply;
  } } } });
}
const ok = (obj) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(obj) }] });
const req = (body, origin = 'https://lxo0ox.github.io', method = 'POST', path = '/read') =>
  new Request('https://reader.example' + path, {
    method, headers: { 'Content-Type': 'application/json', Origin: origin },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
const IMG = { media_type: 'image/jpeg', data: 'AAAA' };

test('sends the image with the right model, schema and fallbacks', async () => {
  const calls = [];
  const res = await createHandler(fakeClient(ok(GOOD), calls))(req(IMG), ENV);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://lxo0ox.github.io');
  assert.deepEqual((await res.json()).result, GOOD);
  const p = calls[0];
  assert.equal(p.model, MODEL);
  assert.equal(p.fallbacks, 'default');
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  assert.deepEqual(p.output_config.format, { type: 'json_schema', schema: SCHEMA });
  assert.equal(p.messages[0].content[0].source.data, 'AAAA');
  assert.match(p.messages[0].content[1].text, /in Arabic\.$/);
});

test('rejects other websites, bad input and big images without calling Claude', async () => {
  const calls = [];
  const h = createHandler(fakeClient(ok(GOOD), calls));
  assert.equal((await h(req(IMG, 'https://evil.example'), ENV)).status, 403);
  assert.equal((await h(req({ media_type: 'text/html', data: 'AAAA' }), ENV)).status, 400);
  assert.equal((await h(req({ media_type: 'image/png', data: 'not base64!' }), ENV)).status, 400);
  assert.equal((await h(req({ media_type: 'image/png', data: 'A'.repeat(7 * 1024 * 1024) }), ENV)).status, 413);
  assert.equal((await h(req(null, undefined, 'GET'), ENV)).status, 405);
  assert.equal((await h(req(IMG, undefined, 'POST', '/other'), ENV)).status, 404);
  assert.equal(calls.length, 0);
});

test('answers the browser preflight only for allowed websites', async () => {
  const h = createHandler(fakeClient(ok(GOOD)));
  const pre = (origin) => new Request('https://reader.example/read', { method: 'OPTIONS', headers: { Origin: origin } });
  assert.equal((await h(pre('https://lxo0ox.github.io'), ENV)).status, 204);
  assert.equal((await h(pre('https://evil.example'), ENV)).status, 403);
});

test('handles refusals, cut-off replies, bad JSON and API errors', async () => {
  const run = async (reply) => (await createHandler(fakeClient(reply))(req(IMG), ENV));
  assert.equal((await (await run({ stop_reason: 'refusal', content: [] })).json()).error, 'refused');
  assert.equal((await (await run({ stop_reason: 'max_tokens', content: [] })).json()).error, 'too_long');
  assert.equal((await run({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{oops' }] })).status, 502);
  assert.equal((await run(ok({ kind: 'chat' }))).status, 502);
  const busy = Object.assign(new Error('rate'), { status: 429 });
  assert.equal((await run(busy)).status, 503);
});

test('rate limit', async () => {
  const env = Object.assign({}, ENV, { RATE_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal((await createHandler(fakeClient(ok(GOOD)))(req(IMG), env)).status, 429);
});

test('schema follows structured-output rules', () => {
  const walk = (s) => {
    if (s.type === 'object') {
      assert.equal(s.additionalProperties, false);
      assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort());
      Object.values(s.properties).forEach(walk);
    }
    if (s.type === 'array') walk(s.items);
  };
  walk(SCHEMA);
  assert.ok(validate(GOOD));
});
