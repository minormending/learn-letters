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

    const row = el('div', 'word-row');
    const boxes = w.split('').map(function (c) {
      const b = el('button', 'wbox', c);
      b.onclick = function () {
        b.classList.add('lit');
        Audio3.say(c).then(function () { b.classList.remove('lit'); });
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

    const ctrls = el('div', 'ctrl-row');
    const sep = el('button', 'btn btn-soft', 'Each sound');
    sep.onclick = function () { Audio3.sound(w, 'separate', light).then(clear); };
    const bl = el('button', 'btn btn-accent', 'Blend it →');
    bl.onclick = function () {
      row.classList.add('blending');
      Audio3.sound(w, 'blend', light).then(function () {
        clear(); row.classList.remove('blending');
      });
    };
    ctrls.appendChild(sep); ctrls.appendChild(bl);
    host.el.appendChild(ctrls);

    host.el.appendChild(graderRow(host,
      function () { host.resolve(true); },
      function () { host.resolve(false, w); }));

    setTimeout(function () {
      Audio3.sound(w, 'blend', light).then(clear);
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

const MODE_ORDER = ['find', 'say', 'match', 'blend', 'build'];
