/* Session engine and screen routing.

   The session has a fixed, visible endpoint rather than running forever.
   Knowing how many are left is what makes stopping possible without a
   fight, and finishing while they still want more is the goal. */

const App = (function () {
  const screens = {};
  let current = null;
  let session = null;
  let sessionSeq = 0;

  /* Tapping Back mid-question leaves timers in flight -- an audio promise, a
     model-screen delay. Without a generation check those callbacks land in
     whatever session started next and render the previous question into it. */
  function alive(id) { return session && session.id === id && current === 'play'; }

  function show(name) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle('on', k === name);
    });
    const corner = document.getElementById('parent-corner');
    if (corner) corner.hidden = !(name === 'home' || name === 'done');
    current = name;
  }

  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  /* ---------- home ---------- */
  function buildHome() {
    const grid = document.getElementById('mode-grid');
    clear(grid);
    MODE_ORDER.forEach(function (id) {
      const m = MODES[id];
      const card = el('button', 'mode-card');
      card.appendChild(el('span', 'mode-emoji', m.emoji));
      card.appendChild(el('span', 'mode-title', m.title));
      card.appendChild(el('span', 'mode-sub', m.sub));
      card.onclick = function () { launch(id); };

      /* Coaching is a tap away rather than in the child's face. */
      /* Point a parent at blending-by-ear while it is still shaky. Blend It
         in front of a child who cannot blend by ear yet is the fastest way to
         convince them they cannot read. */
      if (id === 'hear' && Progress.ear() < Progress.EAR_MAX * 0.6) {
        card.appendChild(el('span', 'mode-flag', 'Start here'));
      }

      const help = el('button', 'mode-help', '?');
      help.setAttribute('aria-label', 'Parent guide for ' + m.title);
      help.onclick = function (e) { e.stopPropagation(); markGuideSeen(id); openGuide(id, id); };
      card.appendChild(help);

      grid.appendChild(card);
    });
    const lvl = Progress.level();
    document.getElementById('home-level').textContent =
      'Level ' + lvl + ' · ' + DATA.lettersUpTo(lvl).join(' ');
  }

  /* ---------- parent guides ---------- */
  let guideReturn = null;   // where Start playing should go, if anywhere

  function openGuide(key, thenPlay) {
    const g = GUIDES[key];
    if (!g) return;
    guideReturn = thenPlay || null;

    document.getElementById('g-emoji').textContent = g.emoji;
    document.getElementById('g-title').textContent = g.title;
    document.getElementById('g-lead').textContent = g.lead;

    const box = document.getElementById('g-sections');
    clear(box);
    g.sections.forEach(function (sec) {
      const kind = GUIDE_KIND[sec.kind] || GUIDE_KIND.do;
      const card = el('section', 'g-sec g-' + sec.kind);
      const head = el('div', 'g-sec-head');
      head.appendChild(el('span', 'g-ico', kind.icon));
      head.appendChild(el('h3', 'g-h', sec.head));
      card.appendChild(head);
      card.appendChild(el('p', 'g-body', sec.body));
      box.appendChild(card);
    });

    const go = document.getElementById('g-go');
    go.style.display = thenPlay ? '' : 'none';
    document.getElementById('g-back').textContent = thenPlay ? 'Not now' : 'Back';
    document.querySelector('.guide-wrap').scrollTop = 0;
    show('guide');
  }

  function markGuideSeen(key) {
    const seen = Settings.get('seenGuides') || {};
    seen[key] = true;
    Settings.set('seenGuides', seen);
  }

  function guideSeen(key) {
    const seen = Settings.get('seenGuides') || {};
    return !!seen[key];
  }

  /* ---------- session ---------- */
  /* First time on a game, show the parent how to run it. Once only, and
     switchable off for anyone who does not want the interruption. */
  function launch(modeId) {
    if (Settings.get('guideFirst') && !guideSeen(modeId)) {
      markGuideSeen(modeId);
      return openGuide(modeId, modeId);
    }
    start(modeId);
  }

  function start(modeId) {
    const mode = MODES[modeId];
    session = {
      id: ++sessionSeq,
      mode: mode,
      total: Settings.get('sessionLength'),
      index: 0,
      firstTry: 0,
      results: []
    };
    Progress.startSession();
    show('play');
    nextItem();
  }

  function renderDots() {
    const dots = document.getElementById('dots');
    clear(dots);
    for (let i = 0; i < session.total; i++) {
      const d = el('span', 'dot');
      if (i < session.index) d.classList.add('done');
      if (i === session.index) d.classList.add('now');
      dots.appendChild(d);
    }
    document.getElementById('left-count').textContent =
      (session.total - session.index) + ' left';
  }

  function nextItem() {
    if (!session) return;
    if (session.index >= session.total) return finish();
    renderDots();
    const q = session.mode.make();
    present(q, 0);
  }

  function present(q, attempt) {
    const sid = session.id;
    const stage = document.getElementById('stage');
    clear(stage);
    stage.classList.remove('celebrate');

    const host = {
      el: stage,
      attempt: attempt,
      locked: false,
      resolve: function (correct, modelTarget) {
        if (host.locked || !alive(sid)) return;
        host.locked = true;
        /* Only the first attempt moves mastery. Re-tries are for learning,
           not for scoring -- a child should never be able to dig a hole. */
        if (attempt === 0) session.mode.score(q, correct);
        if (correct) onCorrect(q, attempt);
        else onWrong(q, attempt, modelTarget);
      },
      /* Finish the item and move on even though it was not clean. Used where
         the child has assembled the right answer after fumbling: making them
         redo a word they just built correctly reads as punishment. */
      finish: function (clean) {
        if (host.locked || !alive(sid)) return;
        host.locked = true;
        if (attempt === 0) session.mode.score(q, clean);
        onCorrect(q, clean ? attempt : 1);
      }
    };
    session.mode.render(q, host);
  }

  function onCorrect(q, attempt) {
    const sid = session.id;
    Audio3.chime();
    if (attempt === 0) session.firstTry++;
    session.results.push(attempt === 0);

    const stage = document.getElementById('stage');
    stage.classList.add('celebrate');

    /* The payoff -- including any picture -- lands only after the answer,
       never beside the prompt. */
    const reward = session.mode.reward && session.mode.reward(q);
    const burst = el('div', 'burst', reward || '⭐');
    stage.appendChild(burst);

    session.index++;
    setTimeout(function () { if (alive(sid)) nextItem(); }, reward ? 1100 : 620);
  }

  function onWrong(q, attempt, modelTarget) {
    const sid = session.id;
    Audio3.nudge();
    const stage = document.getElementById('stage');
    setTimeout(function () {
      if (!alive(sid)) return;
      clear(stage);
      stage.classList.add('modelling');
      const host = { el: stage };
      const p = session.mode.model ? session.mode.model(q, host) : Promise.resolve();
      Promise.resolve(p).then(function () {
        setTimeout(function () {
          if (!alive(sid)) return;
          stage.classList.remove('modelling');
          present(q, attempt + 1);
        }, 700);
      });
    }, 420);
  }

  function finish() {
    if (!session) return;
    Audio3.fanfare();
    const unlocked = Progress.checkUnlock();
    show('done');
    Progress.recordSession(session.mode.title, session.firstTry, session.total);

    /* Stars earned only. A row of miss-marks and a "3 of 10" on the
       celebration screen is a scoreboard, and a scoreboard is response cost:
       it gives a child a number to be bad at. The grown-up panel keeps the
       real figures. */
    const stars = document.getElementById('done-stars');
    clear(stars);
    for (let i = 0; i < session.firstTry; i++) {
      stars.appendChild(el('span', 'rstar', '⭐'));
    }
    if (session.firstTry === 0) stars.appendChild(el('span', 'rstar', '🎈'));

    const note = document.getElementById('done-note');
    if (unlocked) {
      note.textContent = 'New letters unlocked: ' +
        DATA.LEVELS[Progress.level() - 1].letters.join(' ');
      note.classList.add('on');
    } else {
      note.classList.remove('on');
    }
    document.getElementById('again-btn').onclick = function () { start(session.mode.id); };
  }

  /* ---------- grown-up panel ---------- */
  function buildParent() {
    const s = Progress.summary();
    document.getElementById('p-level').textContent = s.level;
    document.getElementById('p-sessions').textContent = s.sessions;
    const last = document.getElementById('p-last');
    last.textContent = s.last
      ? s.last.mode + ' — ' + s.last.right + ' of ' + s.last.total + ' first try'
      : 'No sessions yet';

    const grid = document.getElementById('p-letters');
    clear(grid);
    DATA.ORDER.forEach(function (l) {
      const row = s.letters.filter(x => x.letter === l)[0];
      const cell = el('div', 'p-cell' + (row.active ? '' : ' off'));
      cell.appendChild(el('div', 'p-ch', l));
      /* Two bars: sound knowledge on top, big/little matching underneath.
         They come apart often -- a child can know /b/ and still not connect
         B to b -- and only the top one gates level unlocks. */
      [['score', 'p-fill'], ['pairScore', 'p-fill p-fill-pair']].forEach(function (spec) {
        const bar = el('div', 'p-bar');
        const fill = el('div', spec[1]);
        fill.style.width = (row[spec[0]] / Progress.MAX * 100) + '%';
        if (row[spec[0]] >= Progress.MASTERED) fill.classList.add('solid');
        bar.appendChild(fill);
        cell.appendChild(bar);
      });
      grid.appendChild(cell);
    });

    const len = document.getElementById('p-length');
    len.value = Settings.get('sessionLength');
    len.oninput = function () {
      Settings.set('sessionLength', parseInt(len.value, 10));
      document.getElementById('p-length-val').textContent = len.value;
    };
    document.getElementById('p-length-val').textContent = len.value;

    const lock = document.getElementById('p-level-pin');
    clear(lock);
    const auto = el('option', '', 'Auto (follow progress)');
    auto.value = '0';
    lock.appendChild(auto);
    DATA.LEVELS.forEach(function (lv) {
      const o = el('option', '', 'Level ' + lv.id + ' — ' + lv.letters.join(' '));
      o.value = String(lv.id);
      lock.appendChild(o);
    });
    lock.value = String(Settings.get('maxLevel'));
    lock.onchange = function () {
      Settings.set('maxLevel', parseInt(lock.value, 10));
      buildHome();
    };

    const gl = document.getElementById('p-guides');
    clear(gl);
    GUIDE_ORDER.forEach(function (key) {
      const g = GUIDES[key];
      const row = el('button', 'p-guide');
      row.appendChild(el('span', 'p-guide-emoji', g.emoji));
      const txt = el('span', 'p-guide-txt');
      txt.appendChild(el('span', 'p-guide-title', g.title));
      txt.appendChild(el('span', 'p-guide-lead', g.lead));
      row.appendChild(txt);
      row.appendChild(el('span', 'p-guide-chev', '›'));
      row.onclick = function () { openGuide(key, null); };
      gl.appendChild(row);
    });

    const gf = document.getElementById('p-guidefirst');
    gf.checked = Settings.get('guideFirst');
    gf.onchange = function () { Settings.set('guideFirst', gf.checked); };

    const rw = document.getElementById('p-rewards');
    rw.checked = Settings.get('rewards');
    rw.onchange = function () { Settings.set('rewards', rw.checked); };

    const bo = document.getElementById('p-blendonly');
    bo.checked = Settings.get('blendOnly');
    bo.onchange = function () { Settings.set('blendOnly', bo.checked); };

    buildSync();
  }

  /* ---------- sharing between devices ---------- */

  const JOIN_ERRORS = {
    malformed: 'That code is not complete — three words and three numbers.',
    'not-found': 'No device found with that code. Check for a typo, or press Start '
                 + 'sharing on the other one for a fresh code.',
    network: 'Could not reach the network just now. Try again in a moment.',
    'not-configured': 'Sharing is not available on this device.'
  };

  function buildSync() {
    const handle = Sync.handle();
    const paired = handle && handle.roomCode;
    const status = handle ? handle.status : 'local';
    const note = document.getElementById('p-sync-state');

    if (!handle) {
      note.textContent = 'Sharing is unavailable — this device could not reach the '
        + 'service. Progress is saved here as usual.';
    } else if (!paired) {
      note.textContent = 'Not sharing. This device keeps its own record.';
    } else if (status === 'synced') {
      note.textContent = 'Sharing with code ' + handle.roomCode + '.';
    } else if (status === 'offline') {
      note.textContent = 'Sharing with code ' + handle.roomCode + ' — offline just now. '
        + 'It will catch up when the connection returns.';
    } else {
      note.textContent = 'Connecting…';
    }

    document.getElementById('p-sync-off').hidden = !handle || !!paired;
    document.getElementById('p-sync-on').hidden = !handle || !paired;
    document.getElementById('p-sync-code').textContent = paired ? handle.roomCode : '';
  }

  function bindSync() {
    document.getElementById('p-sync-start').onclick = function () {
      const handle = Sync.handle();
      if (!handle) return;
      const btn = document.getElementById('p-sync-start');
      btn.disabled = true;
      handle.createRoom().then(function (code) {
        /* Claim it now. Sync.apply would otherwise only learn the room when a
           remote record arrived, and until then a reset from the other device
           would look like first contact and be levelled away instead of
           applied. Safe here because we seeded this room ourselves. */
        Sync.claimRoom(code);
      }).catch(function () {
        document.getElementById('p-sync-state').textContent = 'Could not start sharing just now.';
      }).then(function () {
        btn.disabled = false;
        buildSync();
      });
    };

    document.getElementById('p-sync-join').onclick = function () {
      document.getElementById('p-sync-join-box').hidden = false;
      document.getElementById('p-sync-msg').hidden = true;
      document.getElementById('p-sync-input').value = '';
      document.getElementById('p-sync-input').focus();
    };

    document.getElementById('p-sync-cancel').onclick = function () {
      document.getElementById('p-sync-join-box').hidden = true;
    };

    function join() {
      const handle = Sync.handle();
      if (!handle) return;
      const msg = document.getElementById('p-sync-msg');
      const go = document.getElementById('p-sync-go');
      go.disabled = true;
      handle.joinRoom(document.getElementById('p-sync-input').value).then(function (res) {
        go.disabled = false;
        msg.hidden = false;
        if (res.ok) {
          msg.textContent = 'Connected. The two records are merging now.';
          document.getElementById('p-sync-join-box').hidden = true;
          buildSync();
        } else {
          msg.textContent = JOIN_ERRORS[res.reason] || 'That did not work. Try again.';
        }
      });
    }

    document.getElementById('p-sync-go').onclick = join;
    document.getElementById('p-sync-input').onkeydown = function (e) {
      if (e.key === 'Enter') join();
    };

    document.getElementById('p-sync-stop').onclick = function () {
      const handle = Sync.handle();
      if (!handle) return;
      handle.leaveRoom();
      /* Forget the room, so rejoining later counts as first contact again rather
         than inheriting a reset that happened while this device was away. */
      Sync.forgetRoom();
      buildSync();
    };
  }

  /* Press and hold to open, so a five-year-old does not wander in. */
  function holdToOpen(node, ms, fn) {
    let timer = null;
    const down = function () {
      node.classList.add('is-holding');
      timer = setTimeout(function () { node.classList.remove('is-holding'); fn(); }, ms);
    };
    const up = function () {
      node.classList.remove('is-holding');
      if (timer) { clearTimeout(timer); timer = null; }
    };
    node.addEventListener('touchstart', down, { passive: true });
    node.addEventListener('mousedown', down);
    ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(function (e) {
      node.addEventListener(e, up);
    });
  }

  /* ---------- boot ---------- */
  function init() {
    ['start', 'home', 'play', 'done', 'parent', 'guide'].forEach(function (n) {
      screens[n] = document.getElementById('screen-' + n);
    });

    /* The door, its markup and its fade all come from suite/landing.js. What
       is this app's is only what has to happen while it is up: the sounds
       cannot be fetched before the child has touched the screen once. */
    Landing.open({
      host: '#screen-start',
      name: 'Letter Sounds',
      lede: 'Short practice. Real sounds. No guessing.',
      busy: 'Getting ready…',
      fail: 'Could not load the sounds. Check your connection and try again.',
      onStart: function () {
        return Audio3.unlock().then(function () {
          return Audio3.load(Audio3.allPhonemeFiles());
        });
      },
      onLeave: function () { buildHome(); show('home'); },
    });

    document.querySelectorAll('[data-home]').forEach(function (b) {
      b.onclick = function () { session = null; buildHome(); show('home'); };
    });
    document.getElementById('p-close').onclick = function () { buildHome(); show('home'); };

    document.getElementById('g-go').onclick = function () {
      const id = guideReturn;
      guideReturn = null;
      if (id) start(id);
    };
    document.getElementById('g-back').onclick = function () {
      guideReturn = null;
      buildHome();
      show('home');
    };
    document.getElementById('p-reset').onclick = function () {
      const room = Sync.handle() && Sync.handle().roomCode;
      const msg = room
        ? 'Erase all progress and start from Level 1? This clears it on this device '
          + 'and on every device sharing code ' + room + '.'
        : 'Erase all progress and start from Level 1?';
      if (confirm(msg)) {
        Progress.reset(); buildParent(); buildHome();
      }
    };

    holdToOpen(document.getElementById('parent-corner'), 1600, function () {
      buildParent(); show('parent');
    });

    /* Belt and braces on the suspended-context problem: resume when the app
       comes back to the foreground, and on any touch. Cheap when already
       running, and it means a locked iPad never comes back mute. */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) Audio3.ensureRunning();
    });
    document.addEventListener('pointerdown', function () {
      Audio3.ensureRunning();
    }, { passive: true });

    /* iPad: no double-tap zoom, no rubber-band scroll, no text selection. */
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('touchmove', function (e) {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    bindSync();

    /* Repaint when a remote record lands or the connection state moves.

       Never during a game. screen-play owns the screen for a whole session, and
       a question changing under a child part way through answering it is worse
       than a letter score that is a few seconds stale. Home and the grown-up
       panel are both passive, so those refresh. */
    Sync.onRender(function () {
      if (current === 'parent') buildParent();
      else if (current === 'home') buildHome();
    });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      });
    }
  }

  return { init: init };
})();

document.addEventListener('DOMContentLoaded', App.init);
