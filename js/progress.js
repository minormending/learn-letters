/* Per-letter mastery, stored locally. No accounts, no network. */

const Settings = (function () {
  const KEY = 'll.settings.v1';
  const DEFAULTS = {
    sessionLength: 10,   // fixed, visible endpoint -- the session is built to END
    blendOnly: false,    // skip speech synthesis for whole words
    rewards: true,       // emoji payoff after a correct word read
    guideFirst: true,    // show the coaching guide before an unplayed game
    seenGuides: {},      // which guides have already been shown
    maxLevel: 0          // 0 = follow unlocks, >0 = parent pinned a level
  };
  let s;
  try { s = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { s = Object.assign({}, DEFAULTS); }

  return {
    get: k => s[k],
    set: function (k, v) { s[k] = v; localStorage.setItem(KEY, JSON.stringify(s)); },
    all: () => s
  };
})();

const Progress = (function () {
  const KEY = 'll.progress.v1';
  const MASTERED = 3;    // per-letter score that counts as solid
  const MAX = 5;

  let p;
  try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { p = null; }
  if (!p || p.version !== 1) {
    p = { version: 1, level: 1, letters: {}, pairs: {}, sessions: 0, lastPlayed: null };
  }

  function save() { localStorage.setItem(KEY, JSON.stringify(p)); }

  /* Recently-served items, per run rather than persisted. Weighted random
     will happily serve the same letter three times running, which reads as
     the game being stuck and wastes the interleaving. Keeps the buffer well
     under the pool size so small early pools do not deadlock. */
  const recent = { letter: [], pair: [], word: [] };

  function noteRecent(kind, value, poolSize) {
    const keep = Math.max(0, Math.min(3, poolSize - 2));
    const list = recent[kind];
    list.push(value);
    while (list.length > keep) list.shift();
  }

  function freshly(kind, poolSize, draw) {
    for (let i = 0; i < 12; i++) {
      const v = draw();
      if (recent[kind].indexOf(v) < 0) { noteRecent(kind, v, poolSize); return v; }
    }
    const v = draw();
    noteRecent(kind, v, poolSize);
    return v;
  }

  function rec(map, key) {
    if (!map[key]) map[key] = { seen: 0, right: 0, score: 0 };
    return map[key];
  }

  function score(letter)     { return rec(p.letters, letter).score; }
  function pairScore(letter) { return rec(p.pairs, letter).score; }

  /* A miss costs less than a hit gains. Losing ground fast is how a kid
     decides the game is against them. */
  function mark(map, key, correct) {
    const r = rec(map, key);
    r.seen++;
    if (correct) { r.right++; r.score = Math.min(MAX, r.score + 1); }
    else         { r.score = Math.max(0, r.score - 1); }
    save();
  }

  const markLetter = (l, ok) => mark(p.letters, l, ok);
  const markPair   = (l, ok) => mark(p.pairs, l, ok);

  function level() {
    return Settings.get('maxLevel') > 0 ? Settings.get('maxLevel') : p.level;
  }

  /* Unlock the next level once every letter in the current one is solid. */
  function checkUnlock() {
    if (Settings.get('maxLevel') > 0) return false;
    const cur = DATA.LEVELS[p.level - 1];
    if (!cur) return false;
    const allSolid = cur.letters.every(l => score(l) >= MASTERED);
    if (allSolid && p.level < DATA.MAX_LEVEL) { p.level++; save(); return true; }
    return false;
  }

  function activeLetters() { return DATA.lettersUpTo(level()); }
  function activeWords()   { return DATA.wordsUpTo(level()); }

  /* Weighted pick: shaky letters come up more, but solid ones still appear
     so practice stays interleaved rather than blocked. */
  function pickLetter(scoreFn, pool, kind) {
    const list = pool || activeLetters();
    return freshly(kind || 'letter', list.length, function () {
      return drawLetter(scoreFn, list);
    });
  }

  function drawLetter(scoreFn, list) {
    const weights = list.map(function (l) {
      const s = scoreFn ? scoreFn(l) : score(l);
      return Math.pow(MAX + 1 - s, 2);   // score 0 -> 36, score 5 -> 1
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  /* Case matching: the same-shape pairs are near-free, so bias hard. */
  function pickPair() {
    const pool = activeLetters();
    return pickLetter(function (l) {
      const base = pairScore(l);
      return DATA.SAME_SHAPE.indexOf(l) >= 0 ? Math.min(MAX, base + 2) : base;
    }, pool, 'pair');
  }

  /* Words are weighted by how shaky their letters are, so practice lands on
     what the child is actually struggling with rather than on random words. */
  function pickWord(words) {
    return freshly('word', words.length, function () {
      const w = words.map(function (word) {
        let t = 0;
        word.split('').forEach(function (c) { t += (MAX + 1 - score(c)); });
        return t / word.length;
      });
      const total = w.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      for (let i = 0; i < words.length; i++) { r -= w[i]; if (r <= 0) return words[i]; }
      return words[words.length - 1];
    });
  }

  function clearRecent() { recent.letter = []; recent.pair = []; recent.word = []; }

  function startSession() { clearRecent(); p.sessions++; p.lastPlayed = new Date().toISOString(); save(); }

  function recordSession(mode, right, total) {
    p.last = { mode: mode, right: right, total: total };
    save();
  }

  function summary() {
    const letters = DATA.ORDER.map(function (l) {
      const r = rec(p.letters, l), q = rec(p.pairs, l);
      return { letter: l, score: r.score, seen: r.seen, right: r.right,
               pairScore: q.score, active: activeLetters().indexOf(l) >= 0 };
    });
    return { level: level(), sessions: p.sessions, last: p.last || null, letters: letters };
  }

  function reset() {
    p = { version: 1, level: 1, letters: {}, pairs: {}, sessions: 0, lastPlayed: null };
    save();
  }

  return { score, pairScore, markLetter, markPair, level, checkUnlock,
           activeLetters, activeWords, pickLetter, pickPair, pickWord,
           startSession, recordSession, summary, reset, MASTERED, MAX };
})();
