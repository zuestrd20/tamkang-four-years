/** Fictional adult campus-life simulation. No DOM, storage, network or clock dependencies. */
const VERSION = 1;
const TOTAL_MONTHS = 48;
const STAT_KEYS = ['study', 'code', 'social', 'fitness', 'health', 'stress', 'money'];
const SKILL_KEYS = ['study', 'code', 'social', 'fitness'];
const SUPPORT = 3000;
const LIVING = 2800;
const deepFreeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const fail = message => { throw new Error(message); };
const yearOf = month => Math.min(4, Math.floor(month / 12) + 1);
const semesterOf = month => Math.min(8, Math.floor(month / 6) + 1);

export const ACTIONS = deepFreeze({
  study: { id: 'study', name: '圖書館讀書', icon: '📚', desc: '整理課堂筆記，建立學科基礎。學業 +5、壓力 +7、健康 −1。', effects: { study: 5, stress: 7, health: -1 } },
  code: { id: 'code', name: '程式練習', icon: '💻', desc: '把想法寫成能運作的程式。程式 +6、學業 +1、壓力 +7、健康 −1；林沐好感 +3。', effects: { code: 6, study: 1, stress: 7, health: -1 } },
  project: { id: 'project', name: '打造作品', icon: '🛠️', desc: '累積作品進度；程式能力越高，進度越快。程式 +3、學業 +1、壓力 +9、健康 −2，花費 $100。', effects: { code: 3, study: 1, stress: 9, health: -2, money: -100 } },
  club: { id: 'club', name: '社團活動', icon: '🎸', desc: '與夥伴一起辦活動。社交 +6、壓力 −2、健康 −1，花費 $180；柏宇好感 +6。', effects: { social: 6, stress: -2, health: -1, money: -180 } },
  social: { id: 'social', name: '朋友小聚', icon: '🧋', desc: '聊聊生活，照顧身邊的關係。社交 +5、壓力 −5，花費 $260；三位朋友好感各 +4。', effects: { social: 5, stress: -5, money: -260 } },
  work: { id: 'work', name: '課後打工', icon: '☕', desc: '用時間換取經濟餘裕。收入 $1,400、社交 +1、壓力 +6、健康 −2。', effects: { money: 1400, social: 1, stress: 6, health: -2 } },
  exercise: { id: 'exercise', name: '河堤運動', icon: '🏃', desc: '沿河岸找回身體的節奏。體能 +6、健康 +5、壓力 −7，花費 $80；予安好感 +5。', effects: { fitness: 6, health: 5, stress: -7, money: -80 } },
  rest: { id: 'rest', name: '好好休息', icon: '🌙', desc: '睡飽、放空，替下個月留點力氣。健康 +9、壓力 −14。', effects: { health: 9, stress: -14 } },
  internship: { id: 'internship', name: '校外實習', icon: '💼', minYear: 3, desc: '大三起開放。程式 +5、社交 +2、壓力 +9、健康 −2、收入 $1,800，作品進度 +6。', effects: { code: 5, social: 2, stress: 9, health: -2, money: 1800 } },
});

export const CHALLENGES = deepFreeze([
  { id: 'variables', title: '01 ／ 變數熱身', prompt: '令 x = 3，接著執行 x = x + 2，最後 x 的值是多少？', options: ['2', '3', '5'], answer: 2, explanation: '賦值會把右邊算出的 3 + 2 存回 x，所以結果是 5。' },
  { id: 'loops', title: '02 ／ 迴圈的節奏', prompt: '從 i = 0 開始，當 i < 4 時印出 i，然後 i 加 1。共會印出幾次？', options: ['3 次', '4 次', '5 次'], answer: 1, explanation: '印出的值是 0、1、2、3，共 4 次；i = 4 時條件不成立。' },
  { id: 'arrays', title: '03 ／ 陣列索引', prompt: '陣列 names = [「林沐」,「柏宇」,「予安」]，以 0 起算的 names[1] 是誰？', options: ['林沐', '柏宇', '予安'], answer: 1, explanation: '索引 0 是第一個元素，索引 1 是第二個元素，所以是柏宇。' },
  { id: 'logic', title: '04 ／ 布林判斷', prompt: '當已完成作業為 true、已經遲交為 false，條件「已完成作業 AND NOT 已經遲交」的結果是？', options: ['true', 'false', '無法判斷'], answer: 0, explanation: 'NOT false 是 true，而 true AND true 的結果仍是 true。' },
  { id: 'complexity', title: '05 ／ 找到更快的方法', prompt: '在已排序的 1,024 筆資料中，用二分搜尋找一個值，最壞情況約需比較幾次？', options: ['約 10 次', '約 512 次', '約 1,024 次'], answer: 0, explanation: '每次排除一半範圍，log₂(1024) = 10；常見實作最多約 10～11 次比較。' },
  { id: 'debug', title: '06 ／ 找出邊界錯誤', prompt: '長度為 5 的陣列，合法索引是 0 到 4。哪個迴圈條件不會多讀一格？', options: ['i <= 5', 'i < 5', 'i <= 6'], answer: 1, explanation: '從 i = 0 開始時，i < 5 只會使用索引 0、1、2、3、4。' },
  { id: 'tests', title: '07 ／ 測試你的想法', prompt: '要測試「分數大於或等於 60 即及格」，哪組資料最能檢查邊界？', options: ['10、20、30', '80、90、100', '59、60、61'], answer: 2, explanation: '59、60、61 分別涵蓋門檻下、門檻上與門檻之後，容易找出 > 和 >= 的差異。' },
  { id: 'collaboration', title: '08 ／ 一起寫得更好', prompt: '同伴提交的程式未通過測試，你要先做哪件事？', options: ['刪除測試，讓畫面變綠', '重現失敗、確認預期，再一起修正', '不看內容直接合併'], answer: 1, explanation: '先確認問題能重現，對齊預期行為，再針對原因修正，能減少猜測與新的錯誤。' },
]);

const event = (id, title, category, text, options) => ({ id, title, category, text, options });
const option = (label, effects, note, extra = {}) => ({ label, effects, note, ...extra });
const EVENTS = deepFreeze([
  event('rain', '雨天的圖書館', '日常', '午後突然下起大雨。原本的空檔，多了一點留給自己的時間。', [
    option('留下來讀完一章', { study: 4, stress: 2 }, '雨聲伴著翻頁聲，難懂的章節終於串起來了。'),
    option('找朋友喝杯熱茶', { social: 3, stress: -6, money: -120 }, '你們聊起最近的卡關，也笑著分享了幾件小事。', { bond: 'meilin', affinity: 5 }),
  ]),
  event('debug', '深夜的那個 Bug', '程式', '林沐傳來訊息：「我卡在同一個錯誤一整晚了。」你還有一點力氣。', [
    option('一起找出原因', { code: 5, stress: 5, health: -2 }, '你們寫了最小範例，找出藏在邊界條件裡的問題。', { bond: 'yuchen', affinity: 7, project: 5 }),
    option('約明早再看，先睡吧', { health: 5, stress: -5 }, '你們都睡了一覺。第二天，思路清楚了許多。', { bond: 'yuchen', affinity: 3 }),
  ]),
  event('festival', '社團的邀請', '關係', '柏宇正在籌備小型成果展，缺一位願意一起收尾的夥伴。', [
    option('加入籌備，認識新朋友', { social: 6, stress: 3, money: -200 }, '從場地到節目單，你發現自己能把一群人連結起來。', { bond: 'meilin', affinity: 9 }),
    option('幫忙做一張活動網頁', { code: 4, social: 2, stress: 2 }, '簡單的活動頁順利上線，大家都找得到報名資訊了。', { bond: 'meilin', affinity: 4, project: 8 }),
  ]),
  event('sunset', '河岸夕陽', '生活', '予安邀你到河岸走走。今天的天空像一張慢慢變色的明信片。', [
    option('跑一小段，再慢慢散步', { fitness: 5, health: 4, stress: -5 }, '你沒有追求速度，只把注意力放回呼吸。', { bond: 'jiayu', affinity: 7 }),
    option('坐著聊天，看看夕陽', { social: 3, stress: -8 }, '有些話，和願意聽的人說出口就輕了一點。', { bond: 'jiayu', affinity: 5 }),
  ]),
  event('shift', '臨時的代班', '金錢', '打工店裡有人請假。店長問你是否願意多接一個班。', [
    option('接班，存下一點生活費', { money: 1100, stress: 7, health: -3 }, '這筆收入讓月底多了一些餘裕。'),
    option('婉拒，保留自己的空檔', { health: 3, stress: -5 }, '你把空下來的晚上留給休息，界線也是一種練習。'),
  ]),
  event('demo', '第一次公開展示', '作品', '系上的非正式交流日開放自由分享。你手上的小作品，或許已經值得被看見。', [
    option('帶著原型上台', { code: 3, social: 4, stress: 5 }, '雖然緊張，你收到幾個具體而實用的回饋。', { project: 14 }),
    option('先當觀眾，整理觀察', { study: 3, code: 2, stress: -2 }, '別人的展示提醒了你：完成小事，也是一種進步。', { project: 5 }),
  ]),
  event('deadline', '撞在一起的期限', '學業', '報告、練習與活動的期限擠在同一週。你決定重新安排優先順序。', [
    option('先完成最重要的作業', { study: 6, stress: 5, health: -2 }, '你拆小任務，一項一項勾掉。最重要的部分準時完成了。'),
    option('和組員協調分工', { social: 4, study: 2, stress: -3 }, '說清楚可負擔的範圍，團隊反而走得更順。', { bond: 'yuchen', affinity: 4 }),
  ]),
  event('breakfast', '記得吃早餐', '健康', '連著幾天匆匆出門，你發現自己很久沒有好好吃頓早餐。', [
    option('留時間吃好、慢慢出門', { health: 8, stress: -4, money: -150 }, '熱食、陽光和一段不趕路的早晨，讓精神回來了一些。'),
    option('和朋友約固定早餐日', { health: 4, social: 4, money: -180 }, '照顧自己的事，有了同伴就更容易持續。', { bond: 'meilin', affinity: 5 }),
  ]),
  event('usedbook', '二手書攤的發現', '學業', '校園裡的小書攤，有一本你想讀很久的入門書。', [
    option('買下來，做一份讀書筆記', { study: 5, money: -350, stress: 1 }, '書頁有上一位讀者的摺痕，也開始有你的筆記。'),
    option('先借閱，把預算留下', { study: 2, stress: -2 }, '你把書名記下，找到可以慢慢讀的方式。'),
  ]),
  event('teamwork', '小組裡的分歧', '關係', '專題夥伴對方向有不同想法。討論一時繞不出來。', [
    option('做兩個小原型，用結果討論', { code: 5, stress: 4, money: -100 }, '實際試一次，讓抽象的分歧變成可以比較的選項。', { project: 12, bond: 'yuchen', affinity: 5 }),
    option('先聽每個人在意什麼', { social: 6, stress: -3 }, '你們找到了共同的目標，也重新分好了工作。', { project: 6, bond: 'meilin', affinity: 4 }),
  ]),
  event('repair', '筆電的小故障', '金錢', '筆電的充電線接觸不良。重要資料已備份，現在該處理這件小麻煩。', [
    option('換一條合適的充電線', { money: -800, stress: -2 }, '設備恢復穩定，做事時少了一個分心的理由。'),
    option('先借用設備，慢慢存錢', { stress: 3, social: 2 }, '林沐幫忙安排了暫時替代的方式。', { bond: 'yuchen', affinity: 4 }),
  ]),
  event('mentor', '走廊上的一段建議', '未來', '一位畢業生回來分享經驗：「不用一下子知道全部答案，先做一個能驗證的小選擇。」', [
    option('整理下一個學習目標', { study: 4, code: 3, stress: -3 }, '你把模糊的焦慮，寫成這個月能完成的三件事。'),
    option('聊聊工作與生活的平衡', { social: 3, health: 3, stress: -7 }, '你開始把休息也排進計畫，而不是等到有空才做。'),
  ]),
  event('miniapp', '日常裡的靈感', '作品', '排隊時，你想到一個能幫大家省點時間的小工具。', [
    option('做一個最小可用版本', { code: 5, stress: 4, money: -100 }, '它還很樸素，但已經能解決一個真實的小問題。', { project: 16 }),
    option('先問朋友是否真的需要', { social: 4, study: 2, stress: -1 }, '幾句使用情境，讓原本的點子變得更清楚。', { project: 7, bond: 'meilin', affinity: 3 }),
  ]),
  event('weekend', '空白的週末', '生活', '行事曆難得空了一格。你想怎麼度過這段不必趕路的時間？', [
    option('去走一段沒走過的路', { fitness: 4, health: 4, stress: -7, money: -100 }, '陌生的小巷和風景，讓生活多了一點新鮮感。', { bond: 'jiayu', affinity: 3 }),
    option('留在房間，舒服地休息', { health: 7, stress: -10 }, '沒有完成什麼也沒關係。今天，你把精神慢慢充回來。'),
  ]),
  event('opportunity', '小小的接案機會', '未來', '朋友想請你協助整理一份簡單的資料與版面，也準備了合理的酬勞。', [
    option('確認需求，接下小任務', { money: 900, code: 3, social: 2, stress: 5 }, '你練習說清楚交付內容，也累積了一次合作經驗。', { project: 8 }),
    option('推薦更合適的朋友', { social: 5, stress: -3 }, '把機會留給合適的人，也讓彼此多了一份信任。', { bond: 'yuchen', affinity: 5 }),
  ]),
  event('postcard', '寫給以後的自己', '成長', '你翻到剛入學時寫下的願望。有些實現了，有些已經不一樣。', [
    option('記錄已經走過的路', { study: 3, health: 3, stress: -6 }, '原來那些看似普通的日子，已經累積成自己的樣子。'),
    option('和朋友交換這段時間的故事', { social: 5, stress: -5 }, '聽見彼此的改變，你們約好以後也要保持聯絡。', { bond: 'jiayu', affinity: 4 }),
  ]),
]);
const EVENT_MAP = new Map(EVENTS.map(value => [value.id, value]));

export const ENDINGS = deepFreeze([
  { id: 'balanced', title: '把日子過成自己的樣子', subtitle: '全方位成長', description: '你留下了作品、友誼，也留住了照顧自己的能力。四年沒有標準解答，而你走出了很有自己味道的一條路。', conditions: '學業、程式、社交、體能皆 ≥ 60；健康 ≥ 65；作品 ≥ 2；平均成績 ≥ 75。' },
  { id: 'builder', title: '讓想法真的發生', subtitle: '作品型開發者', description: '從第一個錯誤訊息，到能被別人使用的作品，你把想像一步步變成了現實。畢業後的方向，藏在那些親手完成的小事裡。', conditions: '程式 ≥ 80；完成作品 ≥ 4；至少 12 次作品製作或實習。' },
  { id: 'scholar', title: '問題後面，還有問題', subtitle: '好奇的研究者', description: '你養成了追問與整理的習慣。成績是旅程中的記號，真正留下來的，是面對未知時願意多想一步的好奇心。', conditions: '學業 ≥ 85；平均成績 ≥ 84；至少 24 次讀書。' },
  { id: 'connector', title: '我們一起走過', subtitle: '溫暖的連結者', description: '你記得的不只是活動的熱鬧，而是身邊每個人的故事。那些真誠的關係，會陪你走出校門，繼續很長的一段路。', conditions: '社交 ≥ 85；至少兩位朋友好感 ≥ 70；至少 24 次社團或朋友小聚。' },
  { id: 'independent', title: '替自己的明天存一點底氣', subtitle: '獨立的實踐者', description: '你在課業與現實之間練習取捨，學會規劃時間，也學會照顧自己的生活。存下的不只有金錢，還有走下一步的底氣。', conditions: '存款 ≥ $50,000；至少 30 次打工或實習。' },
  { id: 'wellbeing', title: '走得穩，也走得遠', subtitle: '生活的長跑者', description: '你找到了可持續的節奏：該努力時向前，該休息時停下。你知道，照顧好自己，是所有下一站的起點。', conditions: '體能 ≥ 80；健康 ≥ 80；壓力 ≤ 35；至少 24 次運動。' },
  { id: 'explorer', title: '下一頁，還留著空白', subtitle: '持續探索的人', description: '這四年有嘗試、有轉彎，也有還沒想清楚的事。你已經比入學時更認識自己，而人生的選項，從來不只眼前這幾個。', conditions: '完成 48 個月；未符合其他路線也能順利走到這裡。' },
]);

function random(state) {
  state.rng = (state.rng + 0x6D2B79F5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function replenishDeck(state) {
  state.eventDeck = EVENTS.map(value => value.id);
  for (let i = state.eventDeck.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [state.eventDeck[i], state.eventDeck[j]] = [state.eventDeck[j], state.eventDeck[i]];
  }
  state.eventCycles++;
}
function log(state, kind, text) {
  state.logs.unshift({ month: state.month, kind, text });
  state.logs.length = Math.min(180, state.logs.length);
}
function applyEffects(state, effects, diminish = false) {
  for (const [key, raw] of Object.entries(effects)) {
    let amount = raw;
    if (diminish && amount > 0 && SKILL_KEYS.includes(key)) {
      const levelFactor = state.stats[key] >= 80 ? 0.45 : state.stats[key] >= 55 ? 0.75 : 1;
      const strainFactor = ['study', 'code'].includes(key) && (state.stats.stress >= 80 || state.stats.health < 30) ? 0.5 : 1;
      amount = Math.max(1, Math.round(amount * levelFactor * strainFactor));
    }
    state.stats[key] = key === 'money' ? Math.min(999999, state.stats.money + amount) : clamp(state.stats[key] + amount, 0, 100);
  }
}
function bond(state, id, amount) {
  const person = state.relationships.find(value => value.id === id);
  if (person) person.affinity = clamp(person.affinity + amount, 0, 100);
}
function projectProgress(state, amount) {
  state.projects.progress += amount;
  while (state.projects.progress >= 100) {
    state.projects.progress -= 100;
    state.projects.completed++;
    const milestone = `第 ${state.projects.completed} 件作品完成 · 第 ${state.month} 個月`;
    state.projects.milestones.push(milestone);
    log(state, 'milestone', `${milestone}。從草稿到可用版本，你又累積了一次完整的實作經驗。`);
    bond(state, 'yuchen', 5);
  }
}
function ensureResources(state) {
  if (state.stats.money < 0) {
    const gap = -state.stats.money;
    state.stats.money = 0;
    state.stats.stress = clamp(state.stats.stress + 6, 0, 100);
    log(state, 'support', `生活預算短缺 $${gap.toLocaleString('en-US')}，模擬中的急難補助已補足差額；壓力 +6。下個月仍可自由安排。`);
  }
  if (state.stats.health < 20) {
    state.stats.health = 35;
    state.stats.stress = Math.max(0, state.stats.stress - 12);
    log(state, 'recovery', '身體提醒你放慢腳步。安排基本休養後，健康回到 35、壓力 −12；建議下個月留一格休息或運動。');
  }
}
function addSemester(state) {
  const semester = state.month / 6;
  const previousProjects = state.semesters.at(-1)?.projects ?? 0;
  const grade = clamp(Math.round(47 + state.stats.study * 0.40 + state.stats.code * 0.13 + Math.min(6, (state.projects.completed - previousProjects) * 3) + (state.challengeResults.some(value => value.semester === semester && value.correct) ? 3 : 0) - Math.max(0, state.stats.stress - 60) * 0.18), 40, 100);
  const label = grade >= 90 ? '表現出色' : grade >= 80 ? '穩定成長' : grade >= 70 ? '漸入佳境' : grade >= 60 ? '繼續累積' : '還有練習空間';
  const note = grade >= 80 ? '持續的小步驟，累積成看得見的進展。' : state.stats.stress > 70 ? '下學期留點喘息空間，學習也需要恢復。' : '找到適合自己的方法，比和別人比較更重要。';
  state.semesters.push({ semester, grade, label, study: state.stats.study, code: state.stats.code, projects: state.projects.completed, note });
  log(state, 'semester', `第 ${semester} 學期結束：模擬成績 ${grade} 分，${label}。${note}`);
}
function hasEventAt(month) { return month > 0 && month < TOTAL_MONTHS && (month % 2 === 1 || month % 6 === 0); }

export function createGame(seed = 2026) {
  if (!Number.isSafeInteger(seed)) fail('種子必須是有效的整數。');
  const normalizedSeed = seed >>> 0;
  const state = {
    version: VERSION, seed: normalizedSeed, rng: normalizedSeed, month: 0, finished: false,
    stats: { study: 8, code: 5, social: 12, fitness: 15, health: 80, stress: 18, money: 6000 },
    projects: { progress: 0, completed: 0, milestones: [] },
    relationships: [
      { id: 'yuchen', name: '林沐', role: '機器人社的程式夥伴', age: 18, affinity: 10 },
      { id: 'meilin', name: '陳柏宇', role: '社團活動的熱心夥伴', age: 19, affinity: 10 },
      { id: 'jiayu', name: '許予安', role: '設計系的河堤散步搭檔', age: 18, affinity: 10 },
    ],
    semesters: [], challengeSolved: [], challengeResults: [],
    counts: Object.fromEntries(Object.keys(ACTIONS).map(id => [id, 0])),
    pendingEvent: null, eventDeck: [], eventCycles: 0, seenEvents: [], logs: [], lastMonth: null,
  };
  replenishDeck(state);
  log(state, 'welcome', '四年，四十八個月。每月安排三格時間，練習把生活過成自己的樣子。所有角色皆為成年虛構人物；學業與機會皆為原創遊戲設定。');
  return state;
}

export function advanceMonth(input, plan) {
  validateState(input);
  if (input.finished) fail('四年旅程已經完成，重新開始才能展開下一段故事。');
  if (input.pendingEvent) fail('請先完成眼前的事件選擇。');
  if (!Array.isArray(plan) || plan.length !== 3 || !Array.from(plan).every(id => typeof id === 'string' && Object.hasOwn(ACTIONS, id))) fail('每個月需要安排三個有效行動；同一行動可以重複。');
  const state = clone(input);
  const before = { ...state.stats };
  const year = yearOf(state.month);
  state.month++;
  const actions = [];
  const notes = [];
  let income = 0;
  for (let id of plan) {
    if (id === 'internship' && year < 3) {
      id = 'code';
      notes.push('校外實習於大三開放，本格先進行程式練習。');
    }
    actions.push(id);
    state.counts[id]++;
    applyEffects(state, ACTIONS[id].effects, true);
    income += Math.max(0, ACTIONS[id].effects.money || 0);
    if (id === 'code') bond(state, 'yuchen', 3);
    if (id === 'project') { projectProgress(state, 9 + Math.floor(state.stats.code / 12)); bond(state, 'yuchen', 3); }
    if (id === 'club') bond(state, 'meilin', 6);
    if (id === 'social') state.relationships.forEach(person => bond(state, person.id, 4));
    if (id === 'exercise') bond(state, 'jiayu', 5);
    if (id === 'internship') { projectProgress(state, 6); bond(state, 'yuchen', 2); }
  }
  applyEffects(state, { money: SUPPORT - LIVING, health: -2 });
  if (state.stats.stress >= 80) {
    applyEffects(state, { health: -6 });
    notes.push('長期緊繃讓身體疲憊，健康額外 −6。');
  }
  if (state.stats.stress >= 95) {
    applyEffects(state, { study: -2, code: -2 });
    notes.push('壓力接近滿格，吸收與專注受到影響：學業、程式各 −2。');
  }
  ensureResources(state);
  if (state.month % 6 === 0) addSemester(state);
  state.lastMonth = {
    month: state.month, actions, income, living: LIVING, support: SUPPORT,
    delta: Object.fromEntries(STAT_KEYS.map(key => [key, state.stats[key] - before[key]])), notes,
  };
  log(state, 'month', `第 ${state.month} 個月：${actions.map(id => ACTIONS[id].name).join('、')}。生活補助 $3,000，基本開銷 $2,800${income ? `，行動收入 $${income.toLocaleString('en-US')}` : ''}。${notes.join('')}`);
  if (hasEventAt(state.month)) {
    if (!state.eventDeck.length) replenishDeck(state);
    const id = state.eventDeck.pop();
    state.seenEvents.push(id);
    state.pendingEvent = clone(EVENT_MAP.get(id));
  }
  if (state.month === TOTAL_MONTHS) {
    state.finished = true;
    log(state, 'graduation', '第四十八個月，畢業了。那些選擇、夥伴與日常，都成為了你的四年。');
  }
  return state;
}

export function resolveEvent(input, index) {
  validateState(input);
  if (!input.pendingEvent) fail('目前沒有等待選擇的事件。');
  if (!Number.isInteger(index) || index < 0 || index >= input.pendingEvent.options.length) fail('請選擇事件中有效的選項。');
  const state = clone(input);
  const current = state.pendingEvent;
  const selected = current.options[index];
  applyEffects(state, selected.effects);
  if (selected.bond) bond(state, selected.bond, selected.affinity || 0);
  if (selected.project) projectProgress(state, selected.project);
  ensureResources(state);
  log(state, 'event', `${current.title}｜${selected.label}。${selected.note}`);
  state.pendingEvent = null;
  return state;
}

export function solveChallenge(input, index) {
  validateState(input);
  if (input.finished) fail('四年旅程已完成，挑戰已經結束。');
  if (input.pendingEvent) fail('請先完成眼前的事件選擇。');
  const semester = semesterOf(input.month);
  if (input.challengeSolved.includes(semester)) fail('本學期的程式挑戰已經作答過了。');
  const challenge = CHALLENGES[semester - 1];
  if (!Number.isInteger(index) || index < 0 || index >= challenge.options.length) fail('請選擇有效的挑戰答案。');
  const state = clone(input);
  const correct = index === challenge.answer;
  state.challengeSolved.push(semester);
  state.challengeResults.push({ semester, correct });
  applyEffects(state, correct ? { code: 5, study: 2 } : { code: 1 });
  log(state, 'challenge', `${challenge.title}｜${correct ? '答對了！程式 +5、學業 +2。' : '再學會一點：程式 +1。'}${challenge.explanation}`);
  return state;
}

export function getEnding(state) {
  validateState(state);
  if (!state.finished) return null;
  const averageGrade = Math.round(state.semesters.reduce((sum, item) => sum + item.grade, 0) / 8 * 10) / 10;
  const s = state.stats;
  const counts = state.counts;
  const qualified = {
    balanced: ['study', 'code', 'social', 'fitness'].every(key => s[key] >= 60) && s.health >= 65 && state.projects.completed >= 2 && averageGrade >= 75,
    builder: s.code >= 80 && state.projects.completed >= 4 && counts.project + counts.internship >= 12,
    scholar: s.study >= 85 && averageGrade >= 84 && counts.study >= 24,
    connector: s.social >= 85 && state.relationships.filter(person => person.affinity >= 70).length >= 2 && counts.club + counts.social >= 24,
    independent: s.money >= 50000 && counts.work + counts.internship >= 30,
    wellbeing: s.fitness >= 80 && s.health >= 80 && s.stress <= 35 && counts.exercise >= 24,
    explorer: true,
  };
  const chosen = ENDINGS.find(value => qualified[value.id]);
  return { ...clone(chosen), achievements: ENDINGS.filter(value => value.id !== 'explorer' && qualified[value.id]).map(value => value.title), averageGrade };
}

// Save validation is deliberately bounded and reconstructs no objects from untrusted keys.
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
function object(value, keys, label) {
  if (!isObject(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail(`存檔格式錯誤：${label}。`);
}
function integer(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) fail(`存檔數值不正確：${label}。`);
}
function string(value, max, label) {
  if (typeof value !== 'string' || value.length > max) fail(`存檔文字不正確：${label}。`);
}
function array(value, max, label) {
  if (!Array.isArray(value) || value.length > max) fail(`存檔清單不正確：${label}。`);
}
function validateState(state) {
  object(state, ['version', 'seed', 'rng', 'month', 'finished', 'stats', 'projects', 'relationships', 'semesters', 'challengeSolved', 'challengeResults', 'counts', 'pendingEvent', 'eventDeck', 'eventCycles', 'seenEvents', 'logs', 'lastMonth'], '主資料');
  if (state.version !== VERSION) fail('這份存檔版本不受支援。');
  integer(state.seed, 0, 4294967295, '種子');
  integer(state.rng, 0, 4294967295, '隨機狀態');
  integer(state.month, 0, TOTAL_MONTHS, '月份');
  if (typeof state.finished !== 'boolean' || state.finished !== (state.month === TOTAL_MONTHS)) fail('存檔的畢業狀態與月份不一致。');
  object(state.stats, STAT_KEYS, '能力');
  STAT_KEYS.forEach(key => integer(state.stats[key], 0, key === 'money' ? 999999 : 100, key));
  object(state.projects, ['progress', 'completed', 'milestones'], '作品');
  integer(state.projects.progress, 0, 99, '作品進度');
  integer(state.projects.completed, 0, 100, '作品數');
  array(state.projects.milestones, 100, '作品里程碑');
  if (state.projects.milestones.length !== state.projects.completed) fail('存檔作品里程碑數量不一致。');
  state.projects.milestones.forEach(value => string(value, 100, '作品里程碑'));
  array(state.relationships, 3, '關係');
  if (state.relationships.length !== 3) fail('存檔需要三位校園夥伴。');
  const people = [['yuchen', '林沐', '機器人社的程式夥伴', 18], ['meilin', '陳柏宇', '社團活動的熱心夥伴', 19], ['jiayu', '許予安', '設計系的河堤散步搭檔', 18]];
  state.relationships.forEach((person, index) => {
    object(person, ['id', 'name', 'role', 'age', 'affinity'], '夥伴');
    const expected = people[index];
    if (person.id !== expected[0] || person.name !== expected[1] || person.role !== expected[2] || person.age !== expected[3]) fail('存檔中的夥伴資料不正確。');
    integer(person.affinity, 0, 100, '好感');
  });
  object(state.counts, Object.keys(ACTIONS), '行動次數');
  Object.values(state.counts).forEach(value => integer(value, 0, 144, '行動次數'));
  if (Object.values(state.counts).reduce((a, b) => a + b, 0) !== state.month * 3) fail('存檔行動次數與月份不一致。');
  if (state.counts.internship > Math.max(0, state.month - 24) * 3) fail('存檔實習時間不正確。');
  array(state.semesters, 8, '學期');
  if (state.semesters.length !== Math.floor(state.month / 6)) fail('存檔學期數量與月份不一致。');
  state.semesters.forEach((item, index) => {
    object(item, ['semester', 'grade', 'label', 'study', 'code', 'projects', 'note'], '學期資料');
    if (item.semester !== index + 1) fail('存檔學期順序不正確。');
    integer(item.grade, 40, 100, '成績');
    integer(item.study, 0, 100, '學期學業');
    integer(item.code, 0, 100, '學期程式');
    integer(item.projects, 0, state.projects.completed, '學期作品');
    string(item.label, 30, '學期評語'); string(item.note, 200, '學期筆記');
  });
  array(state.challengeSolved, 8, '挑戰紀錄');
  array(state.challengeResults, 8, '挑戰結果');
  if (new Set(state.challengeSolved).size !== state.challengeSolved.length || state.challengeSolved.length !== state.challengeResults.length) fail('存檔挑戰紀錄不一致。');
  state.challengeSolved.forEach((value, index) => {
    integer(value, 1, semesterOf(state.month), '挑戰學期');
    if (index > 0 && value <= state.challengeSolved[index - 1]) fail('存檔挑戰順序不正確。');
    const result = state.challengeResults[index];
    object(result, ['semester', 'correct'], '挑戰結果');
    if (result.semester !== value || typeof result.correct !== 'boolean') fail('存檔挑戰結果不正確。');
  });
  array(state.seenEvents, 31, '事件歷史');
  const expectedEvents = Math.ceil(Math.min(state.month, 47) / 2) + Math.floor(Math.min(state.month, 42) / 6);
  if (state.seenEvents.length !== expectedEvents || state.seenEvents.some(id => !EVENT_MAP.has(id))) fail('存檔事件歷史不正確。');
  for (let start = 0; start < state.seenEvents.length; start += EVENTS.length) {
    const cycle = state.seenEvents.slice(start, start + EVENTS.length);
    if (new Set(cycle).size !== cycle.length) fail('存檔事件在同一輪中重複。');
  }
  integer(state.eventCycles, 1, 2, '事件輪數');
  if (state.eventCycles !== Math.max(1, Math.ceil(expectedEvents / EVENTS.length))) fail('存檔事件輪數不一致。');
  array(state.eventDeck, EVENTS.length, '事件牌堆');
  const usedInCycle = expectedEvents === 0 ? 0 : (expectedEvents - 1) % EVENTS.length + 1;
  const currentCycle = state.seenEvents.slice(expectedEvents - usedInCycle);
  if (state.eventDeck.length !== EVENTS.length - usedInCycle || state.eventDeck.some(id => !EVENT_MAP.has(id)) || new Set([...state.eventDeck, ...currentCycle]).size !== EVENTS.length) fail('存檔事件牌堆不正確。');
  if (state.pendingEvent !== null) {
    if (!hasEventAt(state.month) || state.finished || !isObject(state.pendingEvent) || state.pendingEvent.id !== state.seenEvents.at(-1) || JSON.stringify(state.pendingEvent) !== JSON.stringify(EVENT_MAP.get(state.pendingEvent.id))) fail('存檔待處理事件不正確。');
  }
  array(state.logs, 180, '日誌');
  state.logs.forEach(item => {
    object(item, ['month', 'kind', 'text'], '日誌項目');
    integer(item.month, 0, state.month, '日誌月份');
    if (!['welcome', 'month', 'semester', 'event', 'challenge', 'support', 'recovery', 'milestone', 'graduation'].includes(item.kind)) fail('存檔日誌類型不正確。');
    string(item.text, 1000, '日誌');
  });
  if (state.month === 0) {
    if (state.lastMonth !== null) fail('新學期存檔不應有月份結算。');
  } else {
    const last = state.lastMonth;
    object(last, ['month', 'actions', 'income', 'living', 'support', 'delta', 'notes'], '月份結算');
    if (last.month !== state.month || last.living !== LIVING || last.support !== SUPPORT) fail('存檔月份結算不一致。');
    array(last.actions, 3, '月份行動');
    if (last.actions.length !== 3 || !last.actions.every(id => typeof id === 'string' && Object.hasOwn(ACTIONS, id))) fail('存檔月份行動不正確。');
    integer(last.income, 0, 5400, '行動收入');
    if (last.income !== last.actions.reduce((sum, id) => sum + Math.max(0, ACTIONS[id].effects.money || 0), 0)) fail('存檔行動收入不一致。');
    object(last.delta, STAT_KEYS, '能力變化');
    STAT_KEYS.forEach(key => integer(last.delta[key], key === 'money' ? -999999 : -100, key === 'money' ? 999999 : 100, '能力變化'));
    array(last.notes, 8, '月份提醒');
    last.notes.forEach(value => string(value, 250, '月份提醒'));
  }
  return true;
}

export function serialize(state) {
  validateState(state);
  return JSON.stringify(state);
}
export function deserialize(text) {
  if (typeof text !== 'string' || text.length > 250000) fail('存檔不是有效文字，或檔案太大。');
  let parsed;
  try { parsed = JSON.parse(text); } catch { fail('存檔無法讀取，請選擇完整的 JSON 存檔。'); }
  validateState(parsed);
  return parsed;
}
