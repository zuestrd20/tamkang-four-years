/** DOM interaction tests. Native dialog, audio, layout and touch need browser QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import * as engine from './engine.js';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const source = await readFile(new URL('./app.js', import.meta.url), 'utf8');
const app = source.replace(/^import\s+\{([^}]+)\}\s+from\s+['"]\.\/engine\.js['"];?/, 'const {$1} = window.__engine;');
const SAVE = 'tamsui-four-years-v1';
const AUTO = `${SAVE}-auto`;

function launch(t, saved = {}) {
  const dom = new JSDOM(html, { url: 'https://example.test/game/', runScripts: 'outside-only' });
  const { window: w } = dom;
  const timers = new Map(), intervals = new Map(), errors = [];
  let timerId = 0;
  w.__engine = engine;
  w.setTimeout = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; };
  w.clearTimeout = id => timers.delete(id);
  w.setInterval = fn => { const id = ++timerId; intervals.set(id, fn); return id; };
  w.clearInterval = id => intervals.delete(id);
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.addEventListener('error', e => errors.push(e.error));
  for (const [key, value] of Object.entries(saved)) w.localStorage.setItem(key, value);
  w.eval(app);
  t.after(() => { assert.deepEqual(errors, [], 'No uncaught DOM interaction errors'); dom.window.close(); });
  const doc = w.document;
  const $ = id => doc.getElementById(id);
  const modalButtons = () => [...$('modalBody').querySelectorAll('button')];
  const clickText = text => { const b = modalButtons().find(b => b.textContent.includes(text)); assert.ok(b, `Missing dialog button: ${text}`); b.click(); };
  return { w, doc, $, timers, intervals, clickText, modalButtons,
    state: () => engine.deserialize(w.localStorage.getItem(AUTO)),
    flush: () => { for (const [id, timer] of timers) if (timer.delay <= 500) { timers.delete(id); timer.fn(); } },
    resolve: () => { if ($('modal').open && $('modalBody').querySelector('.choice')) $('modalBody').querySelector('.choice').click(); },
    escape: () => { const event = new w.Event('cancel', { cancelable: true }); if ($('modal').dispatchEvent(event)) $('modal').close(); },
  };
}

function fixture(month, plan = ['study', 'code', 'rest'], pending = false) {
  let s = engine.createGame(2031);
  while (s.month < month) {
    s = engine.advanceMonth(s, plan);
    if (s.pendingEvent && !(pending && s.month === month)) s = engine.resolveEvent(s, 0);
  }
  return engine.serialize(s);
}

test('initial screen exposes labeled controls, stats and locked internship', t => {
  const u = launch(t);
  assert.equal(u.$('monthLabel').textContent, '第 1 個月');
  assert.equal(u.$('stats').querySelectorAll('[role="meter"]').length, 6);
  assert.equal(u.$('actions').children.length, 9);
  assert.equal(u.$('plan').children.length, 3);
  assert.equal(u.$('actions').lastElementChild.disabled, true);
  assert.equal(u.$('modal').getAttribute('aria-labelledby'), 'modalTitle');
  assert.equal(u.$('toast').getAttribute('role'), 'status');
  for (const meter of u.$('stats').querySelectorAll('[role="meter"]')) assert.ok(meter.getAttribute('aria-label'));
});

test('planner preserves selected order and permits repeated activities', t => {
  const u = launch(t);
  for (let i = 0; i < 3; i++) u.$('actions').children[7].click();
  u.$('advance').click();
  assert.deepEqual(u.state().lastMonth.actions, ['rest', 'rest', 'rest']);
  assert.equal(u.state().month, 1);
  assert.equal(u.$('plan').children[0].disabled, true);
});

test('rapid advance and stale event clicks cannot duplicate progress or rewards', t => {
  const u = launch(t);
  u.$('advance').click();
  u.$('advance').click();
  assert.equal(u.state().month, 1);
  assert.equal(u.$('modal').open, true);
  u.escape();
  assert.equal(u.$('modal').open, true, 'Required event cannot be abandoned');
  const staleChoice = u.$('modalBody').querySelector('.choice');
  staleChoice.click();
  const resolved = u.w.localStorage.getItem(AUTO);
  assert.equal(u.state().pendingEvent, null);
  staleChoice.click();
  assert.equal(u.w.localStorage.getItem(AUTO), resolved, 'Stale event must not grant its reward again');
  u.$('advance').click();
  assert.equal(u.state().month, 1, 'Busy guard spans required event resolution');
  u.flush();
  u.$('advance').click();
  assert.equal(u.state().month, 2);
});

test('challenge cancellation is harmless; wrong answers consume the semester attempt', t => {
  const u = launch(t);
  u.$('challenge').click();
  u.clickText('先不挑戰');
  assert.equal(u.w.localStorage.getItem(AUTO), null);
  u.$('challenge').click();
  const wrong = u.$('modalBody').querySelector('.choice');
  wrong.click();
  assert.deepEqual(u.state().challengeSolved, [1]);
  assert.equal(u.state().stats.code, 6);
  assert.equal(u.$('challenge').disabled, true);
  const saved = u.w.localStorage.getItem(AUTO);
  wrong.click();
  assert.equal(u.w.localStorage.getItem(AUTO), saved);
  u.clickText('回到校園');
  assert.equal(u.$('modal').open, false);
});

test('manual load replaces state, restart preserves manual save and cancel preserves progress', t => {
  const manual = fixture(12), auto = fixture(25);
  const u = launch(t, { [SAVE]: manual, [AUTO]: auto });
  u.clickText('繼續我的故事');
  assert.equal(u.$('monthLabel').textContent, '第 26 個月');
  assert.equal(u.$('actions').lastElementChild.disabled, false);
  u.$('load').click();
  u.clickText('手動存檔');
  assert.equal(u.$('monthLabel').textContent, '第 13 個月');
  assert.equal(u.$('actions').lastElementChild.disabled, true);
  u.$('restart').click();
  u.clickText('取消');
  assert.equal(u.$('monthLabel').textContent, '第 13 個月');
  u.$('restart').click();
  u.clickText('確定重新開始');
  assert.equal(u.state().month, 0);
  assert.equal(u.w.localStorage.getItem(SAVE), manual);
  assert.equal(u.$('monthLabel').textContent, '第 1 個月');
});

test('reload resumes pending event and preserves a dismissed continuation offer', t => {
  const auto = fixture(7, undefined, true);
  const u = launch(t, { [AUTO]: auto });
  u.clickText('先看看新日程');
  assert.equal(u.w.localStorage.getItem(AUTO), auto);
  u.$('load').click();
  u.clickText('自動存檔');
  assert.equal(u.$('advance').disabled, true);
  assert.equal(u.$('modal').open, true);
  u.resolve();
  assert.equal(u.state().pendingEvent, null);
  assert.equal(u.state().month, 7);
});

test('corrupt and oversized saves are reported without replacing the current game', t => {
  const u = launch(t, { [SAVE]: '{broken', [AUTO]: 'x'.repeat(250001) });
  assert.match(u.$('toast').textContent, /無法讀取/);
  assert.equal(u.w.localStorage.getItem(SAVE), '{broken');
  u.$('load').click();
  assert.equal(u.$('modalBody').querySelectorAll('.choice').length, 0);
  assert.match(u.$('modalBody').textContent, /已損壞/);
  u.clickText('取消');
  assert.equal(u.$('monthLabel').textContent, '第 1 個月');
});

test('storage write/read failures are surfaced without a gameplay crash', t => {
  const u = launch(t);
  u.w.Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
  u.$('save').click();
  assert.match(u.$('toast').textContent, /無法儲存/);
  u.$('advance').click();
  u.resolve();
  u.flush();
  assert.equal(u.$('monthLabel').textContent, '第 2 個月');
  u.w.Storage.prototype.getItem = () => { throw new Error('SecurityError'); };
  u.$('load').click();
  assert.match(u.$('toast').textContent, /無法讀取/);
});

test('untrusted save text is rendered as text rather than executable markup', t => {
  const s = engine.createGame(100);
  const hostile = '<img src=x onerror="window.compromised=true">';
  s.logs.unshift({ month: 0, kind: 'welcome', text: hostile });
  const u = launch(t, { [AUTO]: engine.serialize(s) });
  u.clickText('繼續我的故事');
  assert.ok(u.$('logs').textContent.includes(hostile));
  assert.equal(u.$('logs').querySelector('img'), null);
  assert.equal(u.w.compromised, undefined);
});

test('full 48-month UI journey graduates and remains replayable', t => {
  const u = launch(t);
  for (let month = 1; month <= 48; month++) {
    u.$('advance').click();
    if (u.state().pendingEvent) u.resolve();
    u.flush();
    assert.equal(u.state().month, month);
    assert.equal(u.state().pendingEvent, null);
  }
  assert.equal(u.state().semesters.length, 8);
  assert.equal(u.state().finished, true);
  assert.equal(u.$('monthLabel').textContent, '畢業這一天');
  assert.equal(u.$('challenge').disabled, true);
  assert.equal(u.$('plan').children[0].disabled, true);
  u.clickText('留在畢業日');
  u.$('advance').click();
  assert.equal(u.state().month, 48);
  u.clickText('再過另一種四年');
  u.clickText('確定重新開始');
  assert.equal(u.state().month, 0);
  assert.equal(u.$('advance').disabled, false);
  assert.equal(u.$('challenge').disabled, false);
});

test('friend portraits use the actual 2-by-2 atlas coordinates', t => {
  const u = launch(t);
  assert.deepEqual([...u.$('friends').querySelectorAll('.portrait')].map(p => p.style.backgroundPosition.replace(/\b0px\b/g, '0%')), ['100% 0%', '0% 100%', '100% 100%']);
});

test('keyboard focus survives changing a planner slot or activity', t => {
  const u = launch(t);
  const slot = u.$('plan').children[1];
  slot.focus();
  slot.click();
  assert.equal(u.doc.activeElement, u.$('plan').children[1]);
  const activity = u.$('actions').children[0];
  activity.focus();
  activity.click();
  assert.equal(u.doc.activeElement, u.$('actions').children[0]);
});

test('rapid sound toggles leave no orphan music timers', async t => {
  const u = launch(t);
  u.w.AudioContext = class {
    currentTime = 0;
    destination = {};
    async resume() {}
    async suspend() {}
    createOscillator() { return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { connect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
  };
  const on = u.$('sound').onclick();
  const off = u.$('sound').onclick();
  await Promise.all([on, off]);
  assert.equal(u.$('sound').getAttribute('aria-pressed'), 'false');
  assert.equal(u.intervals.size, 0, 'Music switched off must not retain a timer from the pending resume');
  await u.$('sound').onclick();
  assert.equal(u.intervals.size, 1, 'Enabling sound should create only one music loop');
  await u.$('sound').onclick();
  assert.equal(u.intervals.size, 0);
});

test('runtime uses bundled assets and has no telemetry or external requests', async () => {
  const css = await readFile(new URL('./style.css', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/);
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//);
  assert.doesNotMatch(css, /(?:@import|url\(["']?https?:\/\/)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /lang="zh-Hant"/);
  assert.match(html, /18 歲以上虛構成年人/);
});
