const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('shutdown_sequence.html', 'utf8');
const source = html.slice(html.indexOf('  // ——— STATE'), html.indexOf('  // ——— NOT TONIGHT'));
function browser(fetch) {
  const elements = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, { style: {}, classList: { add() {}, remove() {} }, value: id === 'braindump' ? 'Synthetic unfinished task' : '' });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { getElementById: el, querySelectorAll: () => [{ value: 'Synthetic win' }] },
    fetch, Date, console, setInterval: () => 1, clearInterval() {},
    buildSummary() {}
  });
  vm.runInContext(source, context);
  return { context, el, run: code => vm.runInContext(code, context) };
}
test('entering reflection and declining AI send no entries; disclosure precedes choice', async () => {
  let calls = 0;
  const b = browser(() => calls++);
  b.run('goTo(3)');
  await b.run('fetchReframe()');
  await b.run('fetchReframe(false)');
  assert.equal(calls, 0);
  assert.equal(b.el('close-day-btn').disabled, undefined);
  assert.match(html, /Netlify function, which forwards them to Anthropic/);
  assert.ok(html.indexOf('id="ai-reflection-disclosure"') < html.indexOf('id="ai-reflection-btn"'));
  assert.match(html, /id="close-day-btn" onclick="closeDay\(\)">/);
});
test('explicit consent sends only reflection inputs and displays successful generation', async () => {
  let request;
  const b = browser(async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ reframe: 'Synthetic closing reflection.' }) };
  });
  b.run('goTo(3)');
  await b.run('fetchReframe(true)');
  assert.equal(request.url, '/.netlify/functions/reframe');
  assert.deepEqual(request.body, { wins: ['Synthetic win'], dump: 'Synthetic unfinished task', aiConsent: true });
  assert.equal(b.el('reframe-generated').textContent, 'Synthetic closing reflection.');
  assert.equal(b.el('close-day-btn').disabled, false);
});
for (const failure of ['http', 'network', 'invalid']) {
  test('AI ' + failure + ' failure leaves shutdown available', async () => {
    const b = browser(async () => {
      if (failure === 'network') throw new Error('Synthetic failure');
      return { ok: failure !== 'http', status: 500, json: async () => ({}) };
    });
    b.run('goTo(3)');
    await b.run('fetchReframe(true)');
    assert.equal(b.el('reframe-error').style.display, 'block');
    assert.equal(b.el('close-day-btn').disabled, false);
    assert.equal(b.run('generatedReframe'), 'Sleep is the work.');
  });
}
test('duplicate clicks send once and late results cannot overwrite a completed choice', async () => {
  let finish, calls = 0;
  const b = browser(() => { calls++; return new Promise(resolve => finish = resolve); });
  b.run('goTo(3)');
  const pending = b.run('fetchReframe(true)');
  await b.run('fetchReframe(true)');
  assert.equal(calls, 1);
  assert.equal(b.el('close-day-btn').disabled, false);
  b.run('reframeRequest++; currentPhase = 4');
  finish({ ok: true, json: async () => ({ reframe: 'Late result' }) });
  await pending;
  assert.equal(b.run('generatedReframe'), null);
});
function server(create) {
  const exports = {};
  vm.runInNewContext(fs.readFileSync('netlify/functions/reframe.js', 'utf8'), {
    exports, console: { error() {} },
    require: () => class { constructor() { this.messages = { create }; } }
  });
  return body => exports.handler({ httpMethod: 'POST', body: JSON.stringify(body) });
}
test('server rejects absent/false consent before calling Anthropic', async () => {
  let calls = 0;
  const handler = server(async () => { calls++; });
  for (const aiConsent of [undefined, false, 'true']) {
    assert.equal((await handler({ wins: ['Synthetic win'], dump: 'Synthetic concern', aiConsent })).statusCode, 400);
  }
  assert.equal(calls, 0);
});
test('server handles consented success, empty entries, invalid input and API failure', async () => {
  let calls = 0;
  const handler = server(async () => { calls++; return { content: [{ text: 'Synthetic reflection' }] }; });
  assert.equal(JSON.parse((await handler({ aiConsent: true, wins: ['Synthetic win'] })).body).reframe, 'Synthetic reflection');
  assert.equal((await handler({ aiConsent: true, wins: [], dump: '' })).statusCode, 200);
  assert.equal((await handler({ aiConsent: true, wins: [42] })).statusCode, 400);
  assert.equal(calls, 1);
  const failing = server(async () => { throw new Error('Synthetic API failure'); });
  assert.equal((await failing({ aiConsent: true, dump: 'Synthetic concern' })).statusCode, 500);
});
