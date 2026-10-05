# 風起淡水：四年練習曲 · 模擬引擎 API

`engine.js` is a pure ES module. All names and writing are Traditional Chinese. Characters are fictional adults; grades, opportunities and finances are fictional game mechanics, not official school information.

## Exports

- `ACTIONS`: object keyed by `study`, `code`, `project`, `club`, `social`, `work`, `exercise`, `rest`, `internship`. Each action has `{ id, name, icon, desc, effects }`; internship also has `minYear: 3`. `effects` is a stat delta map for previews. Project/relationship bonuses are described in `desc`.
- `createGame(seed = 2026)`: fresh serializable state.
- `advanceMonth(state, [actionId, actionId, actionId])`: returns a new state. Repeats allowed. Throws for invalid plan, pending event, or completed game. Internship before year 3 becomes code practice with an explanatory log.
- `resolveEvent(state, choiceIndex)`: returns a new state. Event choices spend no time. Throws if no event or invalid index.
- `CHALLENGES`: 8 fixed semester puzzles, each `{ id, title, prompt, options: string[], answer: number, explanation }`.
- `solveChallenge(state, choiceIndex)`: answers the current semester's puzzle once; returns new state, no time advancement. `challengeSolved` records the semester even when the answer is wrong. Correct answers grant code +5, study +2; wrong answers still grant code +1. Use `CHALLENGES[Math.min(7, Math.floor(state.month / 6))]`. Not allowed during a pending event or after graduation.
- `getEnding(state)`: `null` until finished, then `{ id, title, subtitle, description, conditions, achievements, averageGrade }`. `conditions` is a human-readable string. First qualified ending in `ENDINGS` order wins.
- `ENDINGS`: public array of `{ id, title, subtitle, description, conditions }`, priority order. All graduation routes and their conditions are transparent.
- `serialize(state)`: JSON string; validates before saving.
- `deserialize(text)`: validated independent state; rejects corrupt/unsupported/oversized/inconsistent saves with a Traditional-Chinese error.

## State shape

```js
{
  version: 1,
  seed: 2026,
  rng: 2026,                 // seeded random state; internal
  month: 0,                  // completed months, 0..48
  finished: false,           // true exactly at 48 after pending choice is resolved
  stats: { study: 8, code: 5, social: 12, fitness: 15, health: 80, stress: 18, money: 6000 },
  projects: { progress: 0, completed: 0, milestones: [] }, // progress 0..99; milestones strings
  relationships: [
    { id: 'yuchen', name: '林沐', role: '機器人社的程式夥伴', age: 18, affinity: 10 },
    { id: 'meilin', name: '陳柏宇', role: '社團活動的熱心夥伴', age: 19, affinity: 10 },
    { id: 'jiayu', name: '許予安', role: '設計系的河堤散步搭檔', age: 18, affinity: 10 }
  ],
  semesters: [],             // {semester, grade, label, study, code, projects, note}
  challengeSolved: [],       // semester numbers, 1..8
  challengeResults: [],      // {semester, correct}
  counts: { study:0, code:0, project:0, club:0, social:0, work:0, exercise:0, rest:0, internship:0 },
  pendingEvent: null,        // or {id, title, category, text, options:[{label, effects, note}]}
  eventDeck: [],             // internal unused event IDs; do not mutate
  eventCycles: 0,            // internal
  seenEvents: [],            // IDs in chronological order
  logs: [],                  // newest first; {month, kind, text}; max 180
  lastMonth: null            // or {month, actions:[], income, living, support, delta:{stat: number}, notes:[]}
}
```

Display next month as `state.month + 1` while under 48. Year = `Math.min(4, Math.floor(state.month / 12) + 1)`; semester = `Math.min(8, Math.floor(state.month / 6) + 1)`. A pending event belongs to the just-completed month. Month 48 has no new event, and graduates immediately.

Each month has exactly three actions. Monthly support is $3,000, living costs $2,800. Money never falls below zero; an automatic emergency grant covers a shortfall and adds stress. Health never hardlocks progress; low health triggers recovery. Other stats are clamped to 0..100; money to 0..999,999. High stress and low health reduce academic gains, while high stress also costs health. Actions are resolved in selected order, so rest first can help.

Events occur after odd-numbered months and every semester final (6, 12, ... 42). A seeded shuffled 16-card deck prevents repeats until exhausted. Options are always affordable via the same emergency-grant safety net. Each semester records a grade. Plans, optional challenges, seed and event choices all affect outcomes.

UI should catch thrown errors and show `error.message`, and render text via textContent rather than innerHTML. The engine never reads DOM, storage, network or current time.


## Verification

Run `node --test engine.test.mjs` (Node with native ES modules). The suite covers 80 seeded random-policy complete runs, all seven reachable endings, fixed-step time, early internship fallback, action costs, low-health/low-budget recovery, bounded stats, optional once-per-semester puzzles, event deck uniqueness, independent input state, interrupted event saves, deterministic resumption, and malformed save rejection.

Seven reachable reference policies are in `engine.test.mjs`. These are test fixtures, not required strategies. No network access or real school data is used.
