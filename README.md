# Letter Sounds

A small, deliberately quiet phonics practice game for a beginning reader.
Static site, no build step, no accounts, no network calls. Runs offline once
loaded and installs to an iPad home screen.

## Why it is built this way

Most letter apps are built to hold attention with stimulation. That backfires
for a child with ADHD, and several of the common design choices actively teach
habits that have to be undone later. The rules below are load-bearing — if you
change the app, keep them.

**No picture on screen while decoding.** This is the big one. Showing a cow
next to the word "cow" trains the child to read the picture, which is the core
of the discredited three-cueing / MSV model (guess from picture, context and
first letter). It works on predictable early texts and collapses around grade
three. Pictures here appear only *after* a correct read, as the payoff. See
the National Reading Panel (2000) and Castles, Rastle & Nation, *Ending the
Reading Wars* (2018).

**Real recorded phonemes, never speech synthesis.** Every TTS voice reads `a`
as the letter name "ay". Whole words are the one place TTS is accurate, so
those use it, with a blended fallback and a switch to turn it off entirely.

**No schwa.** "muh-a-tuh" does not blend into "mat". The recordings are clipped
consonants, and the app never appends a vowel.

**Continuous blending, not gapped.** The blend button plays *mmmaaat* with the
sounds running together, scheduled on the Web Audio clock with silence trimmed
off each clip. The pause in "/m/ … /a/ … /t/" is where a small working memory
drops the word.

**Teaching order, not alphabetical.** Levels follow Letters & Sounds Phase 2/3:
`s a t p` first, because those four letters immediately make real words. The
confusable pairs are kept far apart — `d` arrives at level 2, `b` at level 5.

**Two or three choices, never a wall of them.** Choice count scales with how
solid the letter already is, and always drops to two after a miss.

**Errors cost nothing.** No buzzer, no red, no lost points, no broken streak.
A miss dims and steps back, the correct answer is modelled with audio, and the
item is re-presented. Only the first attempt moves mastery, so a child cannot
dig a hole. In Build It a stray tap just bounces — fat fingers on a tablet are
not a reading error.

**The session is built to end.** Fixed length with a visible "6 left" counter,
not infinite play. Ending while they still want more is the goal, and a visible
endpoint removes the transition fight.

**Celebration is fenced off in time.** Reward animation fires *after* the
answer, never beside the prompt. Irrelevant motion next to a task competes for
exactly the attention you are asking for (Mayer's coherence principle), and the
cost is highest for kids with attention difficulties.

**No scoreboard for the child.** The done screen shows stars earned and nothing
else. Ratios and miss-marks live in the grown-up panel — a number to be bad at
is response cost.

**Two modes are co-play on purpose.** Saying the sound out loud beats tapping
it, but speech recognition is unreliable on a five-year-old's voice, so the
grown-up taps Got it / Not yet. That also puts an adult next to the child,
which is what the early-literacy guidance actually favours at this age.

## Modes

| Mode | Skill | Scored by |
|---|---|---|
| Find the Letter | hear a phoneme → pick the grapheme | app |
| Say the Sound   | see a grapheme → produce the phoneme | grown-up |
| Big & Little    | uppercase ↔ lowercase | app |
| Blend It        | sound out and blend a CVC word | grown-up |
| Build It        | hear a word → spell it (encoding) | app |

Encoding (Build It) is in there because spelling a word reinforces decoding it
more than another round of tapping.

## Grown-up panel

Press and hold the title on the home screen for about 1.5 seconds. Shows
per-letter mastery bars, last session result, and controls for session length,
level pinning (auto-advance or stay put), and the two audio/reward switches.

## Levels

| Level | New letters |
|---|---|
| 1 | s a t p |
| 2 | i n m d |
| 3 | g o c k |
| 4 | e u r |
| 5 | h b f l |
| 6 | j v w y z q x |

A level unlocks when every letter in the current one reaches a mastery score of
3. Word lists at each level use only letters already introduced, so nothing is
ever unreadable.

## Deploying to GitHub Pages

```bash
git remote add origin git@github.com:USERNAME/learn-letters.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source: Deploy from a branch → main /
(root)**. It lands at `https://USERNAME.github.io/learn-letters/`.

`.nojekyll` is already present so GitHub serves the folders as-is.

On the iPad, open that URL in Safari and use **Share → Add to Home Screen**.
It then launches fullscreen with no browser chrome and works with no signal.

## Running locally

```bash
python3 -m http.server 8099
```

A plain `file://` open will not work — the service worker and `fetch()` of the
audio need an origin.

## Customising

- **Words and levels** — `js/data.js`. Keep the rule that a level's words only
  use letters from that level or earlier.
- **Reward pictures** — the `REWARD` map in `js/data.js`. Words with no entry
  just show a star.
- **Session length / levels** — the grown-up panel, no code needed.

## Audio

`audio/` holds a 44-phoneme UK chart set, one clip per phoneme, originally named
`<phoneme>_sound_female_UK.mp3` and renamed here to `<phoneme>.mp3`.

`k`, `q` and `x` have no file because they have no unique phoneme: `k` reuses
`c` (/k/), `qu` plays `c`+`w`, `x` plays `c`+`s`. That is also how they are
taught.

**The r-controlled files (`ar`, `or`, `air`, `ear`, `ur`, `ure`) are non-rhotic
UK** — "car" with no audible r — and will sound wrong to an American child.
They are unused by the current levels, which cover only the 26 single letters
and short vowels, where UK and US pronunciation is effectively identical. If
you extend to Phase 3 digraphs, re-record those six.

## Licences

- Andika (`fonts/`) — SIL Open Font License. Chosen because it is drawn for
  beginning readers: single-storey `a` and `g`, matching the letterforms a
  child is taught to write.
- Audio — from the public-use phoneme set supplied with the project.
