import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, CHALLENGES, ENDINGS, createGame, advanceMonth, resolveEvent, solveChallenge, getEnding, serialize, deserialize } from './engine.js';

const copy = value => JSON.parse(JSON.stringify(value));
const settle = (state, choice = 0) => state.pendingEvent ? resolveEvent(state, choice) : state;
function play(policy, seed = 2026, challenges = false, eventChoice = 0) {
  let state = createGame(seed);
  while (!state.finished) {
    if (challenges && !state.challengeSolved.includes(Math.floor(state.month / 6) + 1)) {
      state = solveChallenge(state, CHALLENGES[Math.floor(state.month / 6)].answer);
    }
    state = settle(advanceMonth(state, typeof policy === 'function' ? policy(state) : policy), typeof eventChoice === 'function' ? eventChoice(state) : eventChoice);
  }
  return state;
}
const policies = {
  builder: () => ['code', 'project', 'rest'],
  scholar: () => ['study', 'code', 'rest'],
  connector: () => ['club', 'social', 'rest'],
  independent: () => ['work', 'work', 'rest'],
  wellbeing: () => ['exercise', 'rest', 'rest'],
  explorer: () => ['rest', 'rest', 'rest'],
  balanced: state => state.stats.stress > 60 ? ['rest', 'exercise', 'social'] : state.month % 3 === 0 ? ['study', 'project', 'exercise'] : state.month % 3 === 1 ? ['study', 'code', 'social'] : ['rest', 'club', 'project'],
};

function assertBounded(state) {
  for (const [key, value] of Object.entries(state.stats)) {
    assert.ok(Number.isInteger(value), key);
    assert.ok(value >= 0 && value <= (key === 'money' ? 999999 : 100), `${key}: ${value}`);
  }
  assert.ok(state.relationships.every(person => person.affinity >= 0 && person.affinity <= 100));
  assert.ok(state.projects.progress >= 0 && state.projects.progress < 100);
  assert.equal(state.projects.completed, state.projects.milestones.length);
}

test('fresh state is independent, deterministic, adult-only, and starts with low skills', () => {
  const a = createGame(19), b = createGame(19);
  assert.deepEqual(a, b);
  assert.notDeepEqual(createGame(20).eventDeck, a.eventDeck);
  assert.equal(a.month, 0); assert.equal(a.finished, false); assert.equal(a.stats.money, 6000); assert.equal(a.stats.health, 80);
  assert.ok(a.relationships.every(person => person.age >= 18));
  assert.ok(['study', 'code', 'social', 'fitness'].every(key => a.stats[key] < 20));
  a.stats.study = 99; a.relationships[0].affinity = 99;
  assert.equal(b.stats.study, 8); assert.equal(b.relationships[0].affinity, 10);
  assert.throws(() => createGame(NaN)); assert.throws(() => createGame(1.5)); assert.throws(() => createGame('2026'));
  assert.equal(createGame(-1).seed, 4294967295); assert.equal(createGame(0).seed, 0);
});

test('constants are immutable and include complete action and challenge metadata', () => {
  assert.equal(Object.keys(ACTIONS).length, 9); assert.equal(CHALLENGES.length, 8); assert.equal(ENDINGS.length, 7);
  assert.throws(() => { ACTIONS.study.effects.study = 500; });
  assert.throws(() => { CHALLENGES[0].options.push('extra'); });
  for (const [id, action] of Object.entries(ACTIONS)) {
    assert.equal(id, action.id); assert.ok(action.name && action.icon && action.desc && action.effects);
  }
  for (const challenge of CHALLENGES) assert.ok(challenge.options[challenge.answer] && challenge.explanation);
  for (const ending of ENDINGS) assert.ok(ending.title && ending.description && ending.conditions);
});

test('every month requires exactly three known actions and allows repeated activities', () => {
  const initial = createGame();
  const snapshot = serialize(initial);
  for (const plan of [null, new Array(3), [], ['study'], ['study', 'code'], ['study', 'code', 'rest', 'work'], ['study', 'code', 'bad'], ['study', 'code', '__proto__'], [1, 'code', 'rest']]) assert.throws(() => advanceMonth(initial, plan));
  const next = advanceMonth(initial, ['work', 'work', 'work']);
  assert.equal(next.month, 1); assert.equal(next.counts.work, 3); assert.equal(next.lastMonth.income, 4200);
  assert.equal(next.stats.money, 10400); assert.equal(next.lastMonth.support, 3000); assert.equal(next.lastMonth.living, 2800);
  assert.equal(serialize(initial), snapshot, 'advanceMonth must not mutate its input');
  assert.deepEqual(next.lastMonth.actions, ['work', 'work', 'work']);
  assert.equal(next.lastMonth.delta.money, 4400);
});

test('internship safely becomes code practice before year three and unlocks at month 25', () => {
  let state = advanceMonth(createGame(), ['internship', 'internship', 'internship']);
  assert.equal(state.counts.internship, 0); assert.equal(state.counts.code, 3);
  assert.deepEqual(state.lastMonth.actions, ['code', 'code', 'code']); assert.equal(state.lastMonth.notes.length, 3);
  state = settle(state);
  while (state.month < 24) state = settle(advanceMonth(state, ['rest', 'rest', 'rest']));
  state = advanceMonth(state, ['internship', 'internship', 'internship']);
  assert.equal(state.month, 25); assert.equal(state.counts.internship, 3); assert.equal(state.lastMonth.income, 5400);
  assert.deepEqual(state.lastMonth.actions, ['internship', 'internship', 'internship']);
});

test('events block progression, expose meaningful choices, cost no time and preserve inputs', () => {
  const state = advanceMonth(createGame(90), ['study', 'code', 'rest']);
  assert.ok(state.pendingEvent); assert.equal(state.pendingEvent.options.length, 2);
  const snapshot = serialize(state);
  assert.throws(() => advanceMonth(state, ['rest', 'rest', 'rest']), /事件/);
  assert.throws(() => solveChallenge(state, 0), /事件/);
  for (const bad of [-1, 2, 1.5, '0', null]) assert.throws(() => resolveEvent(state, bad));
  const a = resolveEvent(state, 0), b = resolveEvent(state, 1);
  assert.equal(a.pendingEvent, null); assert.equal(a.month, 1); assert.notDeepEqual(a, b);
  assert.equal(serialize(state), snapshot); assert.throws(() => resolveEvent(a, 0));
  assert.equal(advanceMonth(a, ['rest', 'rest', 'rest']).month, 2);
});

test('event deck never repeats within its 16-card cycle and is seeded reproducibly', () => {
  const a = play(policies.explorer, 124), b = play(policies.explorer, 124), c = play(policies.explorer, 125);
  assert.equal(a.seenEvents.length, 31); assert.equal(a.eventCycles, 2); assert.equal(a.eventDeck.length, 1);
  assert.equal(new Set(a.seenEvents.slice(0, 16)).size, 16); assert.equal(new Set(a.seenEvents.slice(16)).size, 15);
  assert.deepEqual(a, b); assert.notDeepEqual(a.seenEvents, c.seenEvents);
  assert.equal(new Set([...a.seenEvents.slice(16), ...a.eventDeck]).size, 16);
});

test('challenges allow one attempt per semester, do not advance time and reward learning', () => {
  const state = createGame();
  const correct = solveChallenge(state, CHALLENGES[0].answer);
  assert.equal(correct.month, 0); assert.equal(correct.stats.code, state.stats.code + 5); assert.equal(correct.stats.study, state.stats.study + 2);
  assert.deepEqual(correct.challengeSolved, [1]); assert.deepEqual(correct.challengeResults, [{ semester: 1, correct: true }]);
  assert.equal(state.challengeSolved.length, 0);
  assert.throws(() => solveChallenge(correct, 0), /已經/);
  const incorrect = solveChallenge(state, (CHALLENGES[0].answer + 1) % 3);
  assert.equal(incorrect.stats.code, state.stats.code + 1); assert.equal(incorrect.stats.study, state.stats.study);
  assert.deepEqual(incorrect.challengeResults, [{ semester: 1, correct: false }]);
  assert.throws(() => solveChallenge(state, 3)); assert.throws(() => solveChallenge(state, -1));
  let next = correct;
  while (next.month < 6) next = settle(advanceMonth(next, ['study', 'code', 'rest']));
  next = solveChallenge(next, CHALLENGES[1].answer);
  assert.deepEqual(next.challengeSolved, [1, 2]); assert.equal(next.month, 6);
});

test('resource safety avoids bankruptcy and low-health hardlocks with visible recovery', () => {
  const state = createGame(); state.stats.money = 0; state.stats.health = 3; state.stats.stress = 100;
  const recovered = advanceMonth(state, ['project', 'project', 'project']);
  assert.equal(recovered.stats.money, 0); assert.ok(recovered.stats.health >= 20);
  assert.ok(recovered.logs.some(item => item.kind === 'support')); assert.ok(recovered.logs.some(item => item.kind === 'recovery'));
  assertBounded(recovered); assert.equal(settle(recovered).month, 1);
  assert.equal(advanceMonth(settle(recovered), ['work', 'exercise', 'rest']).month, 2);
  const rich = createGame(); rich.stats.money = 999999;
  assert.equal(advanceMonth(rich, ['work', 'work', 'work']).stats.money, 999999);
});

test('rest order and strain affect learning; effects stay bounded at extremes', () => {
  const low = createGame(); low.stats.stress = 85; low.stats.health = 50;
  const restFirst = advanceMonth(low, ['rest', 'study', 'rest']);
  const workFirst = advanceMonth(low, ['study', 'rest', 'rest']);
  assert.ok(restFirst.stats.study > workFirst.stats.study);
  const healthy = createGame(); healthy.stats.stress = 10; healthy.stats.health = 90;
  assert.ok(advanceMonth(healthy, ['code', 'code', 'code']).stats.code > advanceMonth(low, ['code', 'code', 'code']).stats.code);
  const excessive = play(['study', 'study', 'study']);
  assertBounded(excessive); assert.ok(excessive.logs.some(item => item.kind === 'recovery'));
});

test('projects cross milestones and semester history records exactly eight results', () => {
  const state = play(policies.builder, 31, true);
  assert.ok(state.projects.completed >= 4); assert.equal(state.projects.milestones.length, state.projects.completed);
  assert.equal(state.semesters.length, 8); assert.equal(state.challengeResults.length, 8);
  for (const [index, semester] of state.semesters.entries()) {
    assert.equal(semester.semester, index + 1); assert.ok(semester.grade >= 40 && semester.grade <= 100); assert.ok(semester.note);
    assert.ok(semester.projects <= state.projects.completed);
  }
  assert.equal(Object.values(state.counts).reduce((sum, value) => sum + value, 0), 144);
});

test('graduation occurs exactly at 48, with no pending final event or extra progression', () => {
  let state = createGame(45);
  for (let month = 1; month <= 48; month++) {
    assert.equal(getEnding(state), null);
    state = settle(advanceMonth(state, ['rest', 'rest', 'rest']));
    assert.equal(state.month, month); assert.equal(state.finished, month === 48);
  }
  assert.equal(state.pendingEvent, null); assert.ok(getEnding(state));
  assert.throws(() => advanceMonth(state, ['rest', 'rest', 'rest']), /完成/);
  assert.throws(() => solveChallenge(state, 0), /完成/);
  assert.throws(() => resolveEvent(state, 0));
});

for (const [expected, policy] of Object.entries(policies)) {
  test(`ending ${expected} is reachable by an actual 48-month policy`, () => {
    const state = play(policy, 2026, true);
    const ending = getEnding(state);
    assert.equal(ending.id, expected);
    assert.ok(ending.conditions && ending.description && ending.averageGrade >= 40);
    assertBounded(state);
  });
}

test('save/load is lossless at initial state, challenges, every month and pending choices', () => {
  let state = createGame(4294967295);
  assert.deepEqual(deserialize(serialize(state)), state);
  for (let month = 0; month < 48; month++) {
    if (month % 6 === 0) state = solveChallenge(state, CHALLENGES[month / 6].answer);
    assert.deepEqual(deserialize(serialize(state)), state);
    const before = serialize(state);
    const planned = ['study', month >= 24 ? 'internship' : 'project', 'rest'];
    const advanced = advanceMonth(state, planned);
    assert.equal(serialize(state), before);
    assert.deepEqual(deserialize(serialize(advanced)), advanced);
    state = settle(advanced, month % 2);
    state = deserialize(serialize(state));
  }
  assert.equal(state.finished, true); assert.deepEqual(deserialize(serialize(state)), state);
});

test('resuming a save preserves the exact future random events and ending', () => {
  let state = createGame(1776);
  while (state.month < 17) state = settle(advanceMonth(state, policies.balanced(state)));
  const resumed = deserialize(serialize(state));
  function finish(value) {
    let current = value;
    while (!current.finished) current = settle(advanceMonth(current, policies.balanced(current)), current.month % 2);
    return current;
  }
  assert.deepEqual(finish(state), finish(resumed));
});

test('corrupt, unsupported, oversized, polluted and inconsistent saves are rejected', () => {
  for (const bad of [null, '', 'nope', 'null', '{}', '[]', '{', 'x'.repeat(250001)]) assert.throws(() => deserialize(bad));
  const base = settle(advanceMonth(createGame(), ['study', 'code', 'rest']));
  const corruptions = [
    s => { s.version = 2; }, s => { s.month = 49; }, s => { s.month = 1.5; }, s => { s.finished = true; },
    s => { s.stats.study = -1; }, s => { s.stats.code = 101; }, s => { s.stats.money = -1; }, s => { s.stats.money = 1000000; },
    s => { s.stats.health = '80'; }, s => { s.stats.extra = 2; }, s => { delete s.stats.stress; }, s => { s.rng = -1; },
    s => { s.counts.study = 20; }, s => { s.counts.internship = 1; s.counts.study = 0; },
    s => { s.projects.completed = 1; }, s => { s.projects.progress = 100; },
    s => { s.relationships[0].age = 17; }, s => { s.relationships[0].affinity = 101; }, s => { s.relationships[0].name = 'Someone else'; },
    s => { s.eventDeck[0] = s.eventDeck[1]; }, s => { s.eventDeck.push('not-an-event'); }, s => { s.seenEvents = []; },
    s => { s.eventCycles = 3; }, s => { s.pendingEvent = { id: 'rain' }; },
    s => { s.challengeSolved = [1, 1]; }, s => { s.challengeSolved = [8]; s.challengeResults = [{ semester: 8, correct: true }]; },
    s => { s.semesters = [{ semester: 1 }]; }, s => { s.lastMonth.income = 5; }, s => { s.lastMonth.actions = []; },
    s => { s.lastMonth.delta.money = null; }, s => { s.lastMonth = null; }, s => { s.logs[0].kind = 'script'; },
    s => { s.logs[0].text = 'x'.repeat(1001); }, s => { s.unknown = 'unexpected'; },
  ];
  for (const change of corruptions) { const state = copy(base); change(state); assert.throws(() => deserialize(JSON.stringify(state)), change.toString()); }
  assert.throws(() => deserialize(serialize(base).replace('"stats":{', '"stats":{"__proto__":{},')));
  const pending = advanceMonth(createGame(), ['rest', 'rest', 'rest']); pending.pendingEvent.options[0].effects.money = 100000;
  assert.throws(() => deserialize(JSON.stringify(pending)), /事件/);
  assert.equal({}.polluted, undefined);
});

test('random action policies across 80 seeds always remain valid and reach graduation', () => {
  const ids = Object.keys(ACTIONS);
  for (let seed = 0; seed < 80; seed++) {
    let random = seed + 1;
    const rand = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random; };
    let state = createGame(seed);
    while (!state.finished) {
      if (state.month % 6 === 0 && rand() % 2) state = solveChallenge(state, rand() % 3);
      state = advanceMonth(state, [ids[rand() % ids.length], ids[rand() % ids.length], ids[rand() % ids.length]]);
      assertBounded(state);
      assert.deepEqual(deserialize(serialize(state)), state);
      if (state.pendingEvent) state = resolveEvent(state, rand() % 2);
      assertBounded(state);
    }
    assert.equal(state.month, 48); assert.ok(getEnding(state)); assert.equal(state.semesters.length, 8);
  }
});
