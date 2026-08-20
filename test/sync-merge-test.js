/* Merging two devices' progress has to converge, and it has to preserve a
   dropped score — the whole weighting that decides what to practise next
   depends on misses actually counting.

   Run directly:  node test/sync-merge-test.js  */

const path = require('path');
const S = require(path.join(__dirname, '..', 'js', 'sync-state.js'));

const M = S.merge;
const key = o => JSON.stringify(o);
const cases = [];
const check = (name, pass, note) => cases.push({ name, pass: !!pass, note: note || '' });

const rec = (seen, right, score) => ({ seen, right, score });

/* ---- the point of the whole thing: a miss must survive a merge ---- */

check('more attempts wins, even with a lower score',
  M({ letters: { a: rec(9, 4, 2) } }, { letters: { a: rec(5, 5, 5) } }).letters.a.score === 2,
  'taking the higher score would delete every miss the moment a 2nd device existed');

check('a genuine gain still wins',
  M({ letters: { a: rec(9, 9, 5) } }, { letters: { a: rec(5, 2, 1) } }).letters.a.score === 5);

check('letters only on one device are kept',
  key(Object.keys(M({ letters: { a: rec(1, 1, 1) } }, { letters: { b: rec(1, 1, 1) } }).letters)) === key(['a', 'b']));

check('equal attempts resolve the same from either side',
  key(M({ letters: { a: rec(5, 3, 3) } }, { letters: { a: rec(5, 1, 1) } }).letters.a)
  === key(M({ letters: { a: rec(5, 1, 1) } }, { letters: { a: rec(5, 3, 3) } }).letters.a),
  'without a deterministic tiebreak the two devices disagree forever');

check('pairs merge by the same rule',
  M({ pairs: { B: rec(8, 2, 1) } }, { pairs: { B: rec(3, 3, 4) } }).pairs.B.score === 1);

/* ---- ear, which also falls on a miss ---- */

check('the ear score follows its own attempt count',
  M({ ear: 3, earSeen: 12 }, { ear: 11, earSeen: 6 }).ear === 3,
  'markEar drops the score by 2 on a miss, so a max would undo it');

/* ---- level and sessions ---- */

check('a level unlocked anywhere is kept', M({ level: 3 }, { level: 1 }).level === 3);
check('session counts take the higher', M({ sessions: 20 }, { sessions: 7 }).sessions === 20,
  'adding them would double-count on every echo');

/* ---- reset ---- */

const fresh = { version: 1, level: 1, letters: {}, pairs: {}, ear: 0, earSeen: 0, sessions: 0, resetEpoch: 1 };
const rich = { version: 1, level: 4, letters: { a: rec(9, 9, 5) }, pairs: {}, ear: 12, earSeen: 20, sessions: 30, resetEpoch: 0 };
const afterReset = M(fresh, rich);
check('Reset progress beats a fuller record',
  afterReset.level === 1 && Object.keys(afterReset.letters).length === 0 && afterReset.sessions === 0,
  'every per-field rule reads a fresh save as "behind" and refills it');
check('reset survives being merged from the other direction',
  key(M(rich, fresh)) === key(M(fresh, rich)));

/* ---- settings ---- */

const st = M({ settings: { rewards: true, maxLevel: 0, seenGuides: { blend: true } }, settingsAt: 100 },
             { settings: { rewards: false, maxLevel: 3, seenGuides: { listen: true } }, settingsAt: 200 });
check('the newer settings block wins', st.settings.rewards === false && st.settings.maxLevel === 3,
  'these are all switches a parent can turn OFF, which no max can express');
check('guides seen are unioned across devices',
  key(Object.keys(st.settings.seenGuides)) === key(['blend', 'listen']));

/* ---- convergence ---- */

const A = { level: 2, letters: { a: rec(4, 3, 3), c: rec(2, 1, 1) }, pairs: {}, ear: 4, earSeen: 8,
            sessions: 5, lastPlayed: '2026-08-19T10:00:00.000Z', settings: { rewards: true }, settingsAt: 10 };
const B = { level: 3, letters: { a: rec(6, 3, 1), b: rec(9, 9, 5) }, pairs: {}, ear: 9, earSeen: 4,
            sessions: 3, lastPlayed: '2026-08-20T10:00:00.000Z', settings: { rewards: false }, settingsAt: 20 };

check('order does not matter', key(M(A, B)) === key(M(B, A)),
  'differing key order alone makes each device see the other as changed, forever');
check('merging again changes nothing', key(M(M(A, B), B)) === key(M(A, B)));
check('re-merging the other side changes nothing', key(M(M(A, B), A)) === key(M(A, B)));
check('the later play date wins', M(A, B).lastPlayed === '2026-08-20T10:00:00.000Z');
check('subset output is canonical',
  key(Object.keys(S.subset({ letters: { z: rec(1, 1, 1), a: rec(1, 1, 1) } }).letters)) === key(['a', 'z']));

/* ---- rubbish in ---- */

check('rubbish is survivable', (() => {
  try {
    M(null, 'nope'); M(undefined, undefined);
    M({ letters: 'x', pairs: null, settings: 7 }, { letters: { a: 'bad' } });
    return true;
  } catch (err) { return false; }
})());

/* ---- report ---- */

const failed = cases.filter(c => !c.pass);
cases.forEach(c => console.log((c.pass ? '  ok   ' : '  FAIL ') + c.name + (c.note && !c.pass ? '\n         ' + c.note : '')));
console.log('');
if (failed.length) {
  console.error(failed.length + ' of ' + cases.length + ' merge checks failed.');
  process.exit(1);
}
console.log(cases.length + ' merge checks passed.');
