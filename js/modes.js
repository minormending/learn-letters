/* The five practice modes.

   Shared rules baked in here rather than per mode:
   - two or three choices, never a wall of them (working memory)
   - no picture on screen while decoding (that teaches guessing)
   - confusable distractors only once a letter is already solid
   - a wrong answer costs nothing but a re-try after hearing the model */

const el = function (tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

const shuffle = function (a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
};

/* Choice count scales with how solid the letter already is. */
function choiceCount(score, attempt) {
  if (attempt > 0) return 2;                 // always ease off after a miss
  return score < 2 ? 2 : score < 4 ? 3 : 4;
}

function distractors(target, n, pool, useConfusable) {
  const out = [];
  if (useConfusable) {
    (DATA.CONFUSABLE[target] || []).forEach(function (c) {
      if (out.length < n && pool.indexOf(c) >= 0 && c !== target) out.push(c);
    });
  }
  shuffle(pool).forEach(function (c) {
    if (out.length < n && c !== target && out.indexOf(c) < 0) out.push(c);
  });
  return out;
}

/* Only one sound sequence may run at a time.

   Two overlapping playbacks are not merely untidy here: a child learning to
   blend, who taps the button again because nothing seems to be happening,
   would hear two words smeared over each other. That is worse than silence.
   Registered buttons grey out while something is playing, so the wait is
   visible rather than mysterious. */
function makeLock() {
  const st = { busy: false, btns: [] };
  st.add = function (b) { st.btns.push(b); return b; };
  st.run = function (fn) {
    if (st.busy) return Promise.resolve();
    st.busy = true;
    st.btns.forEach(function (b) { b.disabled = true; });
    const done = function () {
      st.busy = false;
      st.btns.forEach(function (b) { b.disabled = false; });
    };
    return Promise.resolve(fn()).then(done, done);
  };
  /* Guard without grey-out, for things that should stay looking tappable. */
  st.quiet = function (fn) {
    if (st.busy) return Promise.resolve();
    st.busy = true;
    const done = function () { st.busy = false; };
    return Promise.resolve(fn()).then(done, done);
  };
  return st;
}

function speakerButton(onTap, label) {
  const b = el('button', 'speaker');
  b.setAttribute('aria-label', label || 'Play the sound again');
  b.innerHTML = '<span class="spk-ico">🔊</span>';
  b.onclick = onTap;
  return b;
}

/* Grown-up scoring row, for the modes where the child speaks the answer.
   Speech recognition is not reliable on a five-year-old's voice, and
   saying the sound out loud is worth far more than tapping it. */
function graderRow(host, onYes, onNo) {
  const row = el('div', 'grader');
  row.appendChild(el('div', 'grader-label', 'Grown-up:'));
  const no = el('button', 'btn btn-soft', 'Not yet');
  const yes = el('button', 'btn btn-yes', 'Got it');
  no.onclick = onNo; yes.onclick = onYes;
  row.appendChild(no); row.appendChild(yes);
  return row;
}

const MODES = {};


/* ---------- 0. Blending by ear, with no letters at all ---------- */
/* The prerequisite for Blend It. A child who cannot merge /m/ /a/ /t/ into a
   word by ear will not manage it with print in the way -- asking them to do
   both at once is two unlearned skills stacked on each other. There is
   deliberately no text on this screen. Pictures are safe here precisely
   because there is nothing written to guess from: the no-picture rule exists
   to stop a child reading the image instead of the word, and there is no word
   to read. */
MODES.hear = {
  id: 'hear', emoji: '🎧', title: 'Listen & Blend', sub: 'Hear the sounds, find it',

  make: function () {
    const pick = Progress.pickHeard();
    const rivals = shuffle(DATA.heardRivals(pick.word, pick.tier));
    const n = Progress.earChoices() - 1;
    const opts = rivals.slice(0, n);
    while (opts.length < n) {
      const filler = shuffle(DATA.heardRivals(pick.word, 'far'))
        .filter(function (w) { return opts.indexOf(w) < 0; })[0];
      if (!filler) break;
      opts.push(filler);
    }
    return { word: pick.word, tier: pick.tier,
             opts: shuffle(opts.concat([pick.word])),
             stage: Progress.earStage() };
  },

  score: function (q, ok) { Progress.markEar(ok); },

  /* How much of the blending the child has to do. */
  groups: function (word, stage) {
    if (stage <= 0) return [[0, 1, 2]];            // one stream
    if (stage === 1) return [[0], [1, 2]];         // onset and rime
    return [[0], [1], [2]];                        // three sounds
  },

  render: function (q, host) {
    const g = MODES.hear.groups(q.word, host.attempt > 0 ? q.stage - 1 : q.stage);
    const gap = q.stage >= 2 ? 0.4 : 0.3;

    const lock = makeLock();

    host.el.appendChild(el('div', 'prompt', 'What word is it?'));

    const play = function () { return lock.run(function () {
      return Audio3.chunked(q.word, g, gap);
    }); };
    host.el.appendChild(lock.add(speakerButton(play, 'Hear the sounds again')));

    const grid = el('div', 'pics pics-' + q.opts.length);
    q.opts.forEach(function (w) {
      const b = el('button', 'pic');
      b.appendChild(el('span', 'pic-img', DATA.heardPic(w)));
      b.setAttribute('aria-label', w);
      b.onclick = function () {
        if (host.locked) return;
        if (w === q.word) { b.classList.add('hit'); host.resolve(true); }
        else { b.classList.add('miss'); host.resolve(false, q.word); }
      };
      grid.appendChild(b);
    });
    host.el.appendChild(grid);

    /* For a child who does not yet know what the task is, being shown the
       whole operation once is worth more than any number of attempts at it. */
    const showMe = lock.add(el('button', 'btn btn-soft btn-hint', 'Show me'));
    showMe.onclick = function () {
      if (host.locked) return;
      host.helped = true;
      lock.run(function () {
        /* Sounds, then the same sounds run together, then the word, then a
           nudge at the answer. The whole operation, start to finish. */
        return Audio3.chunked(q.word, g, gap)
          .then(function () { return Audio3.chunked(q.word, [[0, 1, 2]], 0); })
          .then(function () { return Audio3.speakWord(q.word); })
          .then(function () {
            const right = [...grid.children][q.opts.indexOf(q.word)];
            if (right) right.classList.add('reveal');
          });
      });
    };
    host.el.appendChild(showMe);

    setTimeout(play, 320);
  },

  reward: function (q) { return DATA.heardPic(q.word); },

  model: function (q, host) {
    host.el.appendChild(el('div', 'prompt', 'It was…'));
    host.el.appendChild(el('div', 'pic-big', DATA.heardPic(q.word)));
    /* The separate sounds, then the very same sounds run together. Hearing
       those two back to back is the entire idea, and it is the only thing
       this screen is for. No spoken word after: where the device voice is
       unavailable it just replays the blend, so it would say the same thing
       twice and stretch a teaching moment into a wait. */
    return Audio3.chunked(q.word, [[0], [1], [2]], 0.4)
      .then(function () { return new Promise(function (r) { setTimeout(r, 250); }); })
      .then(function () { return Audio3.chunked(q.word, [[0, 1, 2]], 0); });
  }
};

/* ---------- 1. Hear a sound, find the letter ---------- */
MODES.find = {
  id: 'find', emoji: '👂', title: 'Find the Letter', sub: 'Hear a sound, tap it',
  make: function () { return { target: Progress.pickLetter() }; },
  score: function (q, ok) { Progress.markLetter(q.target, ok); },

  render: function (q, host) {
    const t = q.target;
    const s = Progress.score(t);
    const n = choiceCount(s, host.attempt);
    const opts = shuffle([t].concat(
      distractors(t, n - 1, Progress.activeLetters(), s >= Progress.MASTERED)));

    /* Once the child can already match this letter's two forms, sometimes ask
       in uppercase. It is the same sound either way, and that is the point --
       otherwise the sound only ever gets attached to the lowercase shape.
       Whole row or nothing; mixing cases inside one row just adds noise. */
    const upper = Progress.pairScore(t) >= Progress.MASTERED && Math.random() < 0.35;
    const face = function (c) { return upper ? c.toUpperCase() : c; };

    host.el.appendChild(el('div', 'prompt', 'Which one says…'));
    host.el.appendChild(speakerButton(function () { Audio3.say(t); }));

    const grid = el('div', 'tiles tiles-' + opts.length);
    opts.forEach(function (c) {
      const b = el('button', 'tile', face(c));
      b.onclick = function () {
        if (host.locked) return;
        if (c === t) { b.classList.add('hit'); host.resolve(true); }
        else { b.classList.add('miss'); host.resolve(false, t); }
      };
      grid.appendChild(b);
    });
    host.el.appendChild(grid);
    setTimeout(function () { Audio3.say(t); }, 260);
  },

  model: function (q, host) {
    host.el.appendChild(el('div', 'prompt', 'This one says…'));
    host.el.appendChild(el('div', 'big-letter', q.target));
    return Audio3.say(q.target);
  }
};

/* ---------- 2. See a letter, say the sound ---------- */
MODES.say = {
  id: 'say', emoji: '🗣️', title: 'Say the Sound', sub: 'You say it out loud',
  make: function () { return { target: Progress.pickLetter() }; },
  score: function (q, ok) { Progress.markLetter(q.target, ok); },

  render: function (q, host) {
    const t = q.target;
    host.el.appendChild(el('div', 'prompt', 'What sound does this make?'));
    host.el.appendChild(el('div', 'big-letter', t));
    const hint = el('button', 'btn btn-soft btn-hint', 'Play it for me');
    hint.onclick = function () { Audio3.say(t); };
    host.el.appendChild(hint);
    host.el.appendChild(graderRow(host,
      function () { host.resolve(true); },
      function () { host.resolve(false, t); }));
  },

  model: function (q, host) {
    host.el.appendChild(el('div', 'prompt', 'It says…'));
    host.el.appendChild(el('div', 'big-letter', q.target));
    return Audio3.say(q.target).then(function () { return Audio3.say(q.target); });
  }
};

/* ---------- 3. Match big and little letters ---------- */
MODES.match = {
  id: 'match', emoji: '🔠', title: 'Big & Little', sub: 'Match the two shapes',
  make: function () {
    return { target: Progress.pickPair(), upperFirst: Math.random() < 0.5 };
  },
  score: function (q, ok) { Progress.markPair(q.target, ok); },

  render: function (q, host) {
    const t = q.target;
    const s = Progress.pairScore(t);
    const n = choiceCount(s, host.attempt);
    const opts = shuffle([t].concat(
      distractors(t, n - 1, Progress.activeLetters(), s >= Progress.MASTERED)));

    const show = q.upperFirst ? t.toUpperCase() : t;
    const cast = q.upperFirst ? function (c) { return c; }
                              : function (c) { return c.toUpperCase(); };

    host.el.appendChild(el('div', 'prompt',
      q.upperFirst ? 'Find the little one' : 'Find the big one'));
    host.el.appendChild(el('div', 'big-letter', show));

    const grid = el('div', 'tiles tiles-' + opts.length);
    opts.forEach(function (c) {
      const b = el('button', 'tile', cast(c));
      b.onclick = function () {
        if (host.locked) return;
        if (c === t) { b.classList.add('hit'); host.resolve(true); }
        else { b.classList.add('miss'); host.resolve(false, t); }
      };
      grid.appendChild(b);
    });
    host.el.appendChild(grid);
  },

  model: function (q, host) {
    host.el.appendChild(el('div', 'prompt', 'These two go together'));
    const row = el('div', 'pair-row');
    row.appendChild(el('div', 'big-letter', q.target.toUpperCase()));
    row.appendChild(el('div', 'big-letter', q.target));
    host.el.appendChild(row);
    return Audio3.say(q.target);
  }
};

/* ---------- 4. Blend the sounds into a word ---------- */
MODES.blend = {
  id: 'blend', emoji: '🌊', title: 'Blend It', sub: 'Slide the sounds together',
  make: function () { return { word: Progress.pickWord(Progress.activeWords()) }; },
  score: function (q, ok) {
    q.word.split('').forEach(function (c) { Progress.markLetter(c, ok); });
  },

  render: function (q, host) {
    const w = q.word;
    host.el.appendChild(el('div', 'prompt', 'Sound it out, then say the word'));

    const lock = makeLock();

    const row = el('div', 'word-row');
    const boxes = w.split('').map(function (c) {
      const b = el('button', 'wbox', c);
      b.onclick = function () {
        lock.quiet(function () {
          b.classList.add('lit');
          return Audio3.say(c).then(function () { b.classList.remove('lit'); });
        });
      };
      row.appendChild(b);
      return b;
    });
    host.el.appendChild(row);

    const light = function (i) {
      boxes.forEach(function (b) { b.classList.remove('lit'); });
      if (boxes[i]) boxes[i].classList.add('lit');
    };
    const clear = function () { boxes.forEach(b => b.classList.remove('lit')); };

    /* Light every box up to and including i, for the build-up. */
    const lightUpTo = function (i) {
      boxes.forEach(function (b, j) { b.classList.toggle('lit', j <= i); });
    };

    const ctrls = el('div', 'ctrl-row');

    const sep = lock.add(el('button', 'btn btn-soft', 'Each sound'));
    sep.onclick = function () {
      lock.run(function () { return Audio3.sound(w, 'separate', light).then(clear); });
    };

    /* Cumulative blending: /m/, then "ma", then "mat". The specific fix for a
       child who can say all three sounds and still cannot say the word --
       they are losing the front of it before they reach the end, so the front
       gets rebuilt each time instead of being held. */
    const step = lock.add(el('button', 'btn btn-soft', 'Bit by bit'));
    step.onclick = function () {
      lock.run(function () {
        row.classList.add('blending');
        let chain = Promise.resolve();
        w.split('').forEach(function (_, i) {
          chain = chain.then(function () {
            lightUpTo(i);
            const upto = [];
            for (let j = 0; j <= i; j++) upto.push(j);
            return Audio3.chunked(w, [upto], 0);
          }).then(function () { return new Promise(function (r) { setTimeout(r, 260); }); });
        });
        return chain.then(function () {
          clear(); row.classList.remove('blending');
        });
      });
    };

    const bl = lock.add(el('button', 'btn btn-accent', 'Blend it →'));
    bl.onclick = function () {
      lock.run(function () {
        row.classList.add('blending');
        return Audio3.sound(w, 'blend', light).then(function () {
          clear(); row.classList.remove('blending');
        });
      });
    };

    ctrls.appendChild(sep); ctrls.appendChild(step); ctrls.appendChild(bl);
    host.el.appendChild(ctrls);

    host.el.appendChild(graderRow(host,
      function () { host.resolve(true); },
      function () { host.resolve(false, w); }));

    setTimeout(function () {
      lock.run(function () { return Audio3.sound(w, 'blend', light).then(clear); });
    }, 350);
  },

  reward: function (q) { return Settings.get('rewards') ? DATA.REWARD[q.word] : null; },

  model: function (q, host) {
    host.el.appendChild(el('div', 'prompt', 'The word is…'));
    host.el.appendChild(el('div', 'big-word', q.word));
    return Audio3.sound(q.word, 'blend').then(function () {
      return Audio3.speakWord(q.word);
    });
  }
};

/* ---------- 5. Hear a word, build it ---------- */
MODES.build = {
  id: 'build', emoji: '🧱', title: 'Build It', sub: 'Spell what you hear',
  make: function () { return { word: Progress.pickWord(Progress.activeWords()) }; },
  score: function (q, ok) {
    q.word.split('').forEach(function (c) { Progress.markLetter(c, ok); });
  },

  render: function (q, host) {
    const w = q.word;
    const need = w.split('');
    let at = 0;

    host.el.appendChild(el('div', 'prompt', 'Build this word'));
    host.el.appendChild(speakerButton(function () { Audio3.speakWord(w); }));

    const slots = el('div', 'word-row');
    const slotEls = need.map(function () {
      const s = el('div', 'wbox empty', '');
      slots.appendChild(s);
      return s;
    });
    host.el.appendChild(slots);

    /* Bank is the word's own letters plus one or two extras, so it is a
       spelling task rather than a sorting puzzle. */
    const extras = host.attempt > 0 ? 0 : (w.length <= 3 ? 2 : 1);
    const bank = shuffle(need.concat(
      distractors(w[0], extras, Progress.activeLetters().filter(
        c => need.indexOf(c) < 0), false)));

    /* A stray tap must not end the item. Fat fingers on a tablet are not a
       reading error, and throwing the child back to the start of a word they
       were halfway through is the fastest way to lose them. A miss bounces,
       and after two the next sound is replayed as a hint. It still costs the
       clean-first-try mark, so mastery stays honest. */
    let fumbles = 0;
    const bankRow = el('div', 'tiles tiles-bank');
    bank.forEach(function (c) {
      const b = el('button', 'tile tile-sm', c);
      b.onclick = function () {
        /* at === need.length means the word is already finished and we are
           inside the short pause before the celebration. Leftover bank tiles
           are still on screen and still tappable. */
        if (host.locked || b.disabled || at >= need.length) return;
        if (c === need[at]) {
          slotEls[at].textContent = c;
          slotEls[at].classList.remove('empty');
          slotEls[at].classList.add('lit');
          b.disabled = true;
          Audio3.say(c);
          at++;
          if (at === need.length) {
            setTimeout(function () { host.finish(fumbles === 0); }, 340);
          }
        } else {
          fumbles++;
          Audio3.nudge();
          b.classList.add('miss');
          setTimeout(function () { b.classList.remove('miss'); }, 400);
          if (fumbles >= 2) {
            /* Pin the slot index now. The child can fill the rest of the word
               before this hint finishes playing, and `at` would have moved on
               by then. */
            const hintAt = at;
            slotEls[hintAt].classList.add('hinting');
            setTimeout(function () {
              Audio3.say(need[hintAt]).then(function () {
                slotEls[hintAt].classList.remove('hinting');
              });
            }, 420);
          }
        }
      };
      bankRow.appendChild(b);
    });
    host.el.appendChild(bankRow);
    setTimeout(function () { Audio3.speakWord(w); }, 300);
  },

  reward: function (q) { return Settings.get('rewards') ? DATA.REWARD[q.word] : null; },

  model: function (q, host) {
    host.el.appendChild(el('div', 'prompt', 'It spells…'));
    const row = el('div', 'word-row');
    q.word.split('').forEach(function (c) { row.appendChild(el('div', 'wbox', c)); });
    host.el.appendChild(row);
    return Audio3.sound(q.word, 'separate').then(function () {
      return Audio3.speakWord(q.word);
    });
  }
};

/* Blending by ear comes before blending print, on purpose. */
const MODE_ORDER = ['find', 'say', 'match', 'hear', 'blend', 'build'];
