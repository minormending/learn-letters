/* Per-letter mastery, stored locally. No accounts, no network. */

const Settings = (function () {
  const KEY = 'll.settings.v1';
  const DEFAULTS = {
    sessionLength: 10,   // fixed, visible endpoint -- the session is built to END
    blendOnly: false,    // skip speech synthesis for whole words
    rewards: true,       // emoji payoff after a correct word read
    guideFirst: true,    // show the coaching guide before an unplayed game
    seenGuides: {},      // which guides have already been shown
    maxLevel: 0,         // 0 = follow unlocks, >0 = parent pinned a level
    /* When these last changed. Every setting here is a switch a grown-up can
       turn OFF, and a merge that keeps the higher or truer value cannot say
       that — so the newest block wins, and this is how "newest" is decided. */
    settingsAt: 0
  };
  let s;
  try { s = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { s = Object.assign({}, DEFAULTS); }

  function write() { localStorage.setItem(KEY, JSON.stringify(s)); }

  return {
    get: k => s[k],
    set: function (k, v) {
      s[k] = v;
      s.settingsAt = Date.now();
      write();
      if (typeof Sync !== 'undefined') Sync.push();
    },
    /* Take a merged settings block wholesale. Only called by the sync layer. */
    adopt: function (next, at) {
      if (!next || typeof next !== 'object') return;
      Object.keys(DEFAULTS).forEach(function (k) {
        if (k !== 'settingsAt' && next[k] !== undefined) s[k] = next[k];
      });
      s.settingsAt = Number(at) || 0;
      write();
    },
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
    p = { version: 1, level: 1, letters: {}, pairs: {}, ear: 0, earSeen: 0,
          sessions: 0, lastPlayed: null, resetEpoch: 0 };
  }
  if (typeof p.ear !== 'number') p.ear = 0;
  /* Older saves predate both of these. earSeen counts ear attempts so a dropped
     ear score can be told apart from a stale one; resetEpoch lets a reset beat
     a merge. Both default to 0, which is correct for an existing save. */
  if (typeof p.earSeen !== 'number') p.earSeen = 0;
  if (typeof p.resetEpoch !== 'number') p.resetEpoch = 0;

  /* Every change to progress already funnels through here, which makes it the
     one honest place to notice something changed and needs publishing. */
  function save() {
    localStorage.setItem(KEY, JSON.stringify(p));
    if (typeof Sync !== 'undefined') Sync.push();
  }

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

  /* Blending by ear is one skill, not twenty-six, so it gets a single score
     rather than a per-letter one. The score drives how much of the work the
     child is asked to do:

       0-4    hears one continuous stream, only has to recognise it
       5-9    hears onset and rime, two pieces to hold
       10+    hears three separate sounds and merges them

     Deliberately slow to climb and quick to drop back. A child who has lost
     the thread needs the easier rung immediately, not after five more misses. */
  const EAR_MAX = 15;

  function ear() { return p.ear; }
  function earStage() { return Math.min(2, Math.floor(p.ear / 5)); }

  function markEar(correct) {
    p.ear = correct ? Math.min(EAR_MAX, p.ear + 1) : Math.max(0, p.ear - 2);
    /* Only ever rises, so it is the clock that tells a merge which device's ear
       score is the more recent one. Without it a drop looks like being behind. */
    p.earSeen++;
    save();
  }

  /* Distractors only start sharing sounds with the answer once the child is
     reliably blending. Before that, a rival that differs in one sound is not
     a harder question, it is a different and unfair one. */
  function earTier() {
    if (p.ear < 5) return 'far';
    if (p.ear < 10) return 'onset';
    return 'inner';
  }

  function earChoices() { return p.ear < 3 ? 2 : 3; }

  /* Pick a target that actually has enough rivals at the tier we want, rather
     than picking a word first and discovering it has none. */
  function pickHeard() {
    const need = earChoices() - 1;
    const tiers = [earTier(), 'onset', 'far'];
    for (let i = 0; i < tiers.length; i++) {
      const usable = DATA.HEARD.filter(function (h) {
        return DATA.heardRivals(h.w, tiers[i]).length >= need;
      });
      if (usable.length >= 3) {
        const pool = usable.map(function (h) { return h.w; });
        const word = freshly('word', pool.length, function () {
          return pool[Math.floor(Math.random() * pool.length)];
        });
        return { word: word, tier: tiers[i] };
      }
    }
    const any = DATA.HEARD[Math.floor(Math.random() * DATA.HEARD.length)];
    return { word: any.w, tier: 'far' };
  }

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
    return { level: level(), sessions: p.sessions, last: p.last || null,
             ear: p.ear, earStage: earStage(), letters: letters };
  }

  function reset() {
    /* The epoch carries across the wipe and goes up by one. Otherwise the other
       device reads a fresh save as simply being behind and refills all of it. */
    const epoch = (p.resetEpoch || 0) + 1;
    p = { version: 1, level: 1, letters: {}, pairs: {}, ear: 0, earSeen: 0,
          sessions: 0, lastPlayed: null, resetEpoch: epoch };
    save();
  }

  /* ---- the seam the sync layer talks to ---- */

  function syncSnapshot() {
    return SyncState.subset(Object.assign({}, p, {
      settings: Settings.all(),
      settingsAt: Settings.get('settingsAt')
    }));
  }

  /** Take a merged record. Returns true if anything actually moved. */
  function syncAdopt(merged) {
    if (!merged || typeof merged !== 'object') return false;
    const before = JSON.stringify(syncSnapshot());
    ['level', 'letters', 'pairs', 'ear', 'earSeen', 'sessions', 'lastPlayed', 'last', 'resetEpoch']
      .forEach(function (k) { if (merged[k] !== undefined) p[k] = merged[k]; });
    Settings.adopt(merged.settings, merged.settingsAt);
    localStorage.setItem(KEY, JSON.stringify(p));
    return JSON.stringify(syncSnapshot()) !== before;
  }

  function syncEpochs() { return { resetEpoch: p.resetEpoch || 0 }; }
  function liftEpoch(to) { p.resetEpoch = Math.max(p.resetEpoch || 0, Number(to) || 0); }

  return { score, pairScore, markLetter, markPair, level, checkUnlock,
           activeLetters, activeWords, pickLetter, pickPair, pickWord,
           startSession, recordSession, summary, reset, MASTERED, MAX,
           ear, earStage, markEar, earTier, earChoices, pickHeard, EAR_MAX,
           syncSnapshot, syncAdopt, syncEpochs, liftEpoch };
})();
