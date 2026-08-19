/* Audio engine.

   Phonemes come from real recordings, never speech synthesis: every TTS
   voice reads "a" as the letter name "ay", which is the opposite of what
   we are teaching. Whole words are the one place TTS is reliable, so they
   use it with a blended fallback.

   Uses Web Audio rather than <audio> so that blending can be scheduled on
   a sample clock. Gapped playback ("/m/ ... /a/ ... /t/") is where a child
   with a small working memory drops the word; continuous blending
   ("mmmaaat") is the technique that actually lands. */

const Audio3 = (function () {
  let ctx = null;
  const buffers = {};   // name -> AudioBuffer
  const trims   = {};   // name -> {start, end} seconds of actual sound
  let unlocked  = false;

  /* Clips carry a little leading/trailing silence. For blending we need to
     know where the sound really starts and stops, otherwise the gaps creep
     back in even when we schedule back-to-back. */
  function analyzeTrim(buf) {
    const d = buf.getChannelData(0);
    const win = Math.floor(buf.sampleRate * 0.005);   // 5ms windows
    const thresh = 0.015;
    let start = 0, end = buf.length;

    for (let i = 0; i < buf.length; i += win) {
      let peak = 0;
      for (let j = i; j < Math.min(i + win, buf.length); j++) {
        const v = Math.abs(d[j]);
        if (v > peak) peak = v;
      }
      if (peak > thresh) { start = Math.max(0, i - win); break; }
    }
    for (let i = buf.length - win; i > start; i -= win) {
      let peak = 0;
      for (let j = i; j < Math.min(i + win, buf.length); j++) {
        const v = Math.abs(d[j]);
        if (v > peak) peak = v;
      }
      if (peak > thresh) { end = Math.min(buf.length, i + win * 2); break; }
    }
    return { start: start / buf.sampleRate, end: end / buf.sampleRate };
  }

  /* Must be called from inside a real touch/click handler -- iOS will not
     start an AudioContext any other way. */
  function unlock() {
    if (unlocked) return Promise.resolve();
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, 22050);
    s.connect(ctx.destination);
    s.start(0);
    unlocked = true;
    return ctx.resume();
  }

  /* iOS suspends the context whenever the tab is backgrounded or the iPad
     sleeps, and a suspended context has a frozen clock -- everything
     scheduled against currentTime silently never plays while the wait()
     promises still resolve on their setTimeout. The game would keep
     advancing with no sound and no visible symptom. */
  function ensureRunning() {
    if (!ctx) return Promise.resolve();
    if (ctx.state === 'running') return Promise.resolve();
    return ctx.resume().catch(function () {});
  }

  function load(names) {
    return Promise.all(names.map(function (n) {
      if (buffers[n]) return Promise.resolve();
      return fetch('audio/' + n + '.mp3')
        .then(r => r.arrayBuffer())
        .then(ab => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
        .then(function (buf) { buffers[n] = buf; trims[n] = analyzeTrim(buf); })
        .catch(function (e) { console.warn('audio load failed: ' + n, e); });
    }));
  }

  /* Schedule one clip at an absolute context time. Returns when it ends. */
  function schedule(name, at, rate) {
    const buf = buffers[name];
    if (!buf) return at;
    const t = trims[name];
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate || 1;
    const gain = ctx.createGain();
    /* Tiny fades stop the click you get from cutting into a waveform. */
    const dur = (t.end - t.start) / (rate || 1);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(1, at + 0.012);
    gain.gain.setValueAtTime(1, at + dur - 0.02);
    gain.gain.linearRampToValueAtTime(0, at + dur);
    src.connect(gain).connect(ctx.destination);
    src.start(at, t.start, t.end - t.start);
    return at + dur;
  }

  function wait(sec) {
    return new Promise(r => setTimeout(r, Math.max(0, sec * 1000)));
  }

  /* One letter's sound. Multi-file letters (q, x) play as a tight pair. */
  function say(letter) {
    return ensureRunning().then(function () {
      const names = DATA.PHONEME[letter] || [letter];
      let t = ctx.currentTime + 0.05;
      names.forEach(function (n) { t = schedule(n, t, 1); });
      return wait(t - ctx.currentTime + 0.05);
    });
  }

  function sayName(name) {
    return ensureRunning().then(function () {
      const t = schedule(name, ctx.currentTime + 0.05, 1);
      return wait(t - ctx.currentTime + 0.05);
    });
  }

  /* Sound out a word.
     'separate' -- distinct phonemes with a clear gap, for isolating sounds
     'blend'    -- continuous, no gap: this is the one that teaches reading */
  function sound(word, style, onEach) {
    return ensureRunning().then(function () { return soundNow(word, style, onEach); });
  }

  function soundNow(word, style, onEach) {
    const letters = word.split('');
    const gap = style === 'separate' ? 0.45 : 0;
    let t = ctx.currentTime + 0.08;
    const marks = [];

    letters.forEach(function (ch, idx) {
      marks.push({ idx: idx, at: t });
      const names = DATA.PHONEME[ch] || [ch];
      /* Stretch continuants a little when blending so the sounds run into
         each other the way a teacher would hold them. */
      const rate = style === 'blend' && 'mnslfrvz'.indexOf(ch) >= 0 ? 0.9 : 1;
      names.forEach(function (n) { t = schedule(n, t, rate); });
      t += gap;
    });

    if (onEach) {
      marks.forEach(function (m) {
        setTimeout(function () { onEach(m.idx); },
                   (m.at - ctx.currentTime) * 1000);
      });
    }
    return wait(t - ctx.currentTime + 0.1);
  }

  /* Whole words are the one case where speech synthesis is accurate --
     it says "mat" correctly, it just cannot say /m/. Falls back to a fast
     blend if no voice is available. */
  function speakWord(word) {
    if (!window.speechSynthesis || Settings.get('blendOnly')) {
      return sound(word, 'blend');
    }
    return new Promise(function (res) {
      let started = false, done = false;

      const finish = function () { if (!done) { done = true; res(); } };
      /* Cancel before blending so a late-arriving voice cannot talk over the
         fallback we just started. */
      const fallback = function () {
        if (done) return;
        done = true;
        try { speechSynthesis.cancel(); } catch (e) {}
        sound(word, 'blend').then(res);
      };

      const u = new SpeechSynthesisUtterance(word);
      u.rate = 0.75;
      u.pitch = 1.05;
      const uk = speechSynthesis.getVoices().filter(v => /en-GB/i.test(v.lang));
      if (uk.length) u.voice = uk[0];
      u.onstart = function () { started = true; };
      u.onend = finish;
      u.onerror = fallback;

      try {
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      } catch (e) { return fallback(); }

      /* Speech synthesis can refuse silently: no onstart, no onerror, no
         audio. It happens on iOS outside a user gesture, and it is what makes
         a mode whose whole prompt is a spoken word play nothing at all. If it
         has not begun shortly after being asked, it is not going to. */
      setTimeout(function () { if (!started) fallback(); }, 700);
      /* And if it starts but never reports finishing, do not hang the item. */
      setTimeout(function () { if (started) finish(); }, 3500);
    });
  }

  /* Non-verbal feedback tones, synthesised so there are no extra assets.
     Deliberately soft: an error must never sound like a buzzer. */
  function tone(freqs, dur, vol) {
    if (!ctx) return;
    let t = ctx.currentTime;
    freqs.forEach(function (f, i) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + dur);
      t += dur * 0.55;
    });
  }

  const chime  = () => tone([660, 880, 1320], 0.16, 0.16);
  const nudge  = () => tone([392, 392], 0.14, 0.09);
  const fanfare= () => tone([523, 659, 784, 1047], 0.22, 0.18);

  function allPhonemeFiles() {
    const set = {};
    Object.keys(DATA.PHONEME).forEach(function (l) {
      DATA.PHONEME[l].forEach(function (n) { set[n] = 1; });
    });
    return Object.keys(set);
  }

  return { unlock, load, say, sayName, sound, speakWord, ensureRunning,
           chime, nudge, fanfare, allPhonemeFiles,
           get ready() { return unlocked; } };
})();
