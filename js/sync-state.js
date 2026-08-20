/* What it means to merge two devices' progress.

   Kept free of localStorage, the DOM and the other modules so it can be loaded
   and tested on its own. The plumbing is in js/sync.js.

   The hard part here is that mastery scores are MEANT to fall. mark() drops a
   letter's score on a miss, on purpose — "losing ground fast is how a kid
   decides the game is against them", so a miss costs less than a hit gains, but
   it still costs. A merge that takes the higher score would quietly delete every
   miss the moment a second device was involved, and the weighting that decides
   what to practise next would drift away from what the child actually finds
   hard. That would break the pedagogy, not just the numbers.

   So scores are not maxed. Each letter's `seen` count only ever goes up, which
   makes it a per-letter clock: the record with more attempts is strictly the
   more recent one, and taking it preserves drops as faithfully as gains. */

const SyncState = (() => {
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

  /* Sorted rebuild. Two devices holding identical numbers in a different key
     order would each see the other as changed and republish forever, because
     kidsync compares serialised state to decide whether anything moved. */
  function canonMap(map, fn) {
    const src = map && typeof map === 'object' ? map : {};
    const out = {};
    Object.keys(src).sort().forEach(k => {
      const v = fn(src[k]);
      if (v !== null) out[k] = v;
    });
    return out;
  }

  const canonRec = r => (r && typeof r === 'object'
    ? { seen: num(r.seen), right: num(r.right), score: num(r.score) }
    : null);

  /** One letter's record. `seen` is the clock; the rest is a deterministic
      tiebreak so two devices land on the same answer from either direction. */
  function mergeRec(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (a.seen !== b.seen) return a.seen > b.seen ? a : b;
    if (a.right !== b.right) return a.right > b.right ? a : b;
    return a.score >= b.score ? a : b;
  }

  function mergeScoreMap(a, b) {
    const left = canonMap(a, canonRec);
    const right = canonMap(b, canonRec);
    const out = {};
    [...new Set([...Object.keys(left), ...Object.keys(right)])].sort().forEach(k => {
      out[k] = mergeRec(left[k], right[k]);
    });
    return out;
  }

  /* Guides shown are unioned: if the child has seen the coaching screen for a
     game on either device, there is no reason to show it again on the other. */
  function mergeSeenGuides(a, b) {
    const out = {};
    [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].sort().forEach(k => {
      if ((a && a[k]) || (b && b[k])) out[k] = true;
    });
    return out;
  }

  /* Grown-up settings are last-write-wins on a timestamp, because every one of
     them is a switch a parent can turn OFF — and a merge that only ever keeps
     the higher or truer value cannot express that. seenGuides is the exception
     and is unioned, since it is a record of the child rather than a preference. */
  function canonSettings(raw, seenGuides) {
    const v = raw && typeof raw === 'object' ? raw : {};
    return {
      sessionLength: num(v.sessionLength) || 10,
      blendOnly: !!v.blendOnly,
      rewards: v.rewards !== false,
      guideFirst: v.guideFirst !== false,
      maxLevel: num(v.maxLevel),
      seenGuides: seenGuides !== undefined ? seenGuides : mergeSeenGuides(v.seenGuides, null)
    };
  }

  function mergeSettings(a, b) {
    const at = num(a.settingsAt), bt = num(b.settingsAt);
    const winner = at >= bt ? a.settings : b.settings;
    return {
      settings: canonSettings(winner, mergeSeenGuides(
        a.settings && a.settings.seenGuides,
        b.settings && b.settings.seenGuides)),
      settingsAt: Math.max(at, bt)
    };
  }

  const canonLast = l => (l && typeof l === 'object'
    ? { mode: String(l.mode == null ? '' : l.mode).slice(0, 40), right: num(l.right), total: num(l.total) }
    : null);

  /** Merge two progress subsets into a new one. Neither argument is modified. */
  function merge(a, b) {
    const left = a && typeof a === 'object' ? a : {};
    const right = b && typeof b === 'object' ? b : {};

    /* Reset progress wipes rather than lowers, and no per-field rule can say
       that: every one of them would read a fresh save as "behind" and refill it
       from the other device. The epoch is what makes resetting possible. */
    const ae = num(left.resetEpoch), be = num(right.resetEpoch);
    if (ae !== be) {
      const win = ae > be ? left : right;
      return Object.assign(subset(win), { resetEpoch: Math.max(ae, be) },
                           mergeSettings(left, right));
    }

    /* The ear score falls on a miss too, so it needs its own clock. earSeen
       counts attempts and only goes up. */
    const earNewer = num(left.earSeen) === num(right.earSeen)
      ? Math.max(num(left.ear), num(right.ear))
      : (num(left.earSeen) > num(right.earSeen) ? num(left.ear) : num(right.ear));

    const sessions = Math.max(num(left.sessions), num(right.sessions));

    return Object.assign({
      version: 1,
      /* Unlocks only ever move up — checkUnlock never demotes — so a max is
         honest here, and it means a level earned on either device is kept. */
      level: Math.max(num(left.level) || 1, num(right.level) || 1),
      letters: mergeScoreMap(left.letters, right.letters),
      pairs: mergeScoreMap(left.pairs, right.pairs),
      ear: earNewer,
      earSeen: Math.max(num(left.earSeen), num(right.earSeen)),
      sessions: sessions,
      lastPlayed: [left.lastPlayed, right.lastPlayed]
        .filter(v => typeof v === 'string').sort().pop() || null,
      /* Whichever device has played more sessions holds the more recent result. */
      last: canonLast(num(left.sessions) >= num(right.sessions) ? left.last : right.last),
      resetEpoch: ae
    }, mergeSettings(left, right));
  }

  const FIELDS = ['version', 'level', 'letters', 'pairs', 'ear', 'earSeen',
                  'sessions', 'lastPlayed', 'last', 'resetEpoch', 'settings', 'settingsAt'];

  /** The travelling subset, canonical so both devices serialise it identically. */
  function subset(state) {
    const s = state && typeof state === 'object' ? state : {};
    return {
      version: 1,
      level: num(s.level) || 1,
      letters: canonMap(s.letters, canonRec),
      pairs: canonMap(s.pairs, canonRec),
      ear: num(s.ear),
      earSeen: num(s.earSeen),
      sessions: num(s.sessions),
      lastPlayed: typeof s.lastPlayed === 'string' ? s.lastPlayed : null,
      last: canonLast(s.last),
      resetEpoch: num(s.resetEpoch),
      settings: canonSettings(s.settings),
      settingsAt: num(s.settingsAt)
    };
  }

  return { FIELDS, subset, merge, mergeRec, mergeScoreMap, canonSettings };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SyncState;
