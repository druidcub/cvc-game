const assert = require('node:assert/strict'), path = require('node:path');
const { create, QUEUE_LIMIT } = require(path.join(__dirname, '..', 'dist', 'tracker.js'));
const store = new Map(), storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
const sent = []; let online = true, fail = false, clock = 1_700_000_000_000;
const fetchFn = async (url, init) => { if (fail) throw new Error('offline'); sent.push({ url, body: JSON.parse(init.body), init }); return {}; };
const make = () => create({ app: 'cvc', storage, fetch: fetchFn, now: () => clock, onLine: () => online });
const tick = () => new Promise(r => setTimeout(r, 0));

(async () => {
  let t = make();
  assert.equal(t.track('miss', { word: 'bag' }), null, 'nothing is recorded until a parent enables tracking');
  assert.equal(t.queue().length, 0);

  t.configure({ enabled: true, url: 'javascript:alert(1)', token: 'abc', learner: '小寶' });
  assert.equal(t.settings().url, '', 'only Apps Script https URLs are accepted');
  t.configure({ url: 'https://script.google.com/macros/s/AKfy/exec' });
  const ev = t.track('miss', { word: 'bag', unit: '短母音 a (CVC)' });
  const d = new Date(clock);
  assert.equal(ev.date, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, 'date is local yyyy-mm-dd');
  assert.equal(ev.learner, '小寶'); assert.equal(ev.app, 'cvc');
  await tick();
  assert.equal(sent.length, 1); assert.equal(sent[0].body.token, 'abc'); assert.equal(sent[0].body.events[0].word, 'bag');
  assert.equal(sent[0].init.mode, 'no-cors');
  assert.equal(t.queue().length, 0, 'sent events leave the queue');

  online = false; t.track('session_done', { total: 10 }); await tick();
  assert.equal(sent.length, 1); assert.equal(t.queue().length, 1, 'offline events wait in the queue');
  assert.equal(JSON.parse(store.get('cvc-tracker-v1:queue')).length, 1, 'queue survives in storage');
  online = true; fail = true; await t.flush(); assert.equal(t.queue().length, 1, 'failed send keeps the event'); assert.ok(t.status().lastError);
  fail = false; await t.flush(); assert.equal(t.queue().length, 0); assert.equal(sent.length, 2); assert.equal(t.status().lastError, '');

  t = make(); assert.equal(t.settings().learner, '小寶', 'settings persist across reloads');
  for (let i = 0; i < QUEUE_LIMIT + 20; i++) { online = false; t.track('miss', { word: 'w' + i }); }
  assert.equal(t.queue().length, QUEUE_LIMIT, 'queue is capped'); assert.equal(t.queue()[0].word, 'w20');
  online = true; await t.flush();
  assert.equal(t.queue().length, 0); assert.ok(sent.length >= 2 + Math.ceil(QUEUE_LIMIT / 50), 'large queues are sent in batches');

  t.configure({ enabled: false }); assert.equal(t.track('miss', { word: 'x' }), null);
  const r = await t.test(); assert.equal(r.ok, false, 'test() reports when it cannot run');
  console.log('PASS: tracker stays silent until enabled, validates URLs, queues offline, retries failures, batches, caps the queue and persists settings.');
})().catch(e => { console.error(e); process.exitCode = 1; });
