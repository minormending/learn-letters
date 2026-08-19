/* Letter, phoneme and word data.
   Sequence follows Letters & Sounds Phase 2/3 order, NOT alphabetical:
   it front-loads letters that immediately build real words, and keeps
   the visually confusable pairs (b/d, p/q, m/n) far apart. */

const DATA = (function () {

  /* Which mp3(s) voice each letter.
     k, q and x have no unique phoneme file because they have no unique
     phoneme: k is /k/, qu is /k/+/w/, x is /k/+/s/. Sequencing them is
     also how they are taught. */
  const PHONEME = {
    a:['a'], b:['b'], c:['c'], d:['d'], e:['e'], f:['f'], g:['g'],
    h:['h'], i:['i'], j:['j'], k:['c'], l:['l'], m:['m'], n:['n'],
    o:['o'], p:['p'], q:['c','w'], r:['r'], s:['s'], t:['t'], u:['u'],
    v:['v'], w:['w'], x:['c','s'], y:['y'], z:['z']
  };

  /* Progressive levels. Words at each level use only letters introduced
     at that level or earlier, so nothing is ever unreadable. */
  const LEVELS = [
    { id: 1, letters: ['s','a','t','p'],
      words: ['at','sat','pat','tap','sap'] },

    { id: 2, letters: ['i','n','m','d'],
      words: ['it','in','am','an','sit','sip','sad','pin','pit','pan','pad',
 'tin','tip','tan','nip','nap','man','mat','map','mad',
 'dip','dim','did','dad'] },

    { id: 3, letters: ['g','o','c','k'],
      words: ['on','got','gap','gas','dog','cot','cop','can',
 'cap','cat','kid','kit','top','pot','pop','not','nod',
 'mop','dot','tag','pig','dig'] },

    { id: 4, letters: ['e','u','r'],
      words: ['up','us','get','pet','pen','ten','den','men','met','set',
 'net','peg','red','rat','rap','rim','run','rug',
 'cup','cut','mud','sun','nut','gum','pup','tug','dug','mug'] },

    { id: 5, letters: ['h','b','f','l'],
      words: ['hat','ham','had','hit','hip','hop','hot','hug','hen','bat',
 'bad','bag','bed','beg','bet','big','bin','bit','bug','bun',
 'but','fan','fat','fit','fig','fin','fun','fed','fog','lap',
 'leg','let','lid','lip','lit','log','lot'] },

    { id: 6, letters: ['j','v','w','y','z','q','x'],
      words: ['jam','jet','jog','job','jug','van','vet','wag','web','wet',
 'win','wig','yes','yet','zip','zap','box','fox','six',
 'fix','mix','wax','ox'] }
  ];

  /* Uppercase/lowercase pairs where the two forms are essentially the same
     shape at different sizes. These are close to free and should not eat
     practice time. Everything else gets weighted up in the matching game. */
  const SAME_SHAPE = ['c','o','s','v','w','x','z','p','u','k','j'];

  /* Letters that get mistaken for each other, by sight or by sound.
     Used as distractors only once a letter is already fairly solid --
     confusable choices are good practice but bad scaffolding. */
  const CONFUSABLE = {
    b:['d','p','q'], d:['b','p','q'], p:['q','b','d'], q:['p','b','g'],
    m:['n','w'],     n:['m','u','r'], u:['n','v'],     w:['m','v'],
    f:['t','v'],     v:['w','u','f'], e:['a','i'],     a:['e','o','u'],
    i:['l','j','e'], l:['i','t','j'], g:['q','j','y'], j:['g','y','i'],
    y:['v','g','j'], s:['z','c'],     z:['s','n'],     c:['e','o','s'],
    o:['a','c','e'], r:['n','v'],     t:['f','l'],     h:['n','b'],
    k:['x','h'],     x:['k','y']
  };

  /* Shown only AFTER a word is read correctly, never during. A picture on
     screen while decoding teaches the child to read the picture. */
  const REWARD = {
    cat:'🐱', dog:'🐕', pig:'🐷', sun:'☀️', bus:'🚌', hat:'🎩', bed:'🛏️',
    box:'📦', fox:'🦊', jam:'🍯', web:'🕸️', bug:'🐛', cup:'🥤', mug:'☕',
    log:'🪵', leg:'🦵', pen:'🖊️', ten:'🔟', six:'6️⃣', fan:'🪭', map:'🗺️',
    mop:'🧹', pot:'🍲', nut:'🌰', net:'🥅', bag:'👜', van:'🚐', jet:'✈️',
    hen:'🐔', bat:'🦇', rat:'🐀', pup:'🐶', gum:'🍬', lid:'🥫', lip:'👄',
    zip:'🤐', vet:'🩺', wig:'💇', kid:'🧒', man:'👨', dad:'👨‍🍼', tag:'🏷️',
    top:'🔝', mud:'🟤', red:'🟥', big:'🐘', jug:'🧉', fig:'🫐', kit:'🧰',
    ham:'🍖', hug:'🤗', run:'🏃', sit:'🪑', tap:'🚰', pin:'📌', can:'🥫',
    tin:'🥫', rug:'🧶', cot:'🛏️', fin:'🐟', yes:'👍', wet:'💧', hop:'🐰'
  };

  /* Words for blending by ear.

     Deliberately NOT gated by level. Blending is a listening skill and it has
     to run ahead of letter knowledge, not behind it -- a child who cannot
     merge /m/ /a/ /t/ by ear will not manage it with print in the way, and
     level 1 only has five words to practise on anyway.

     Every entry is three phonemes, every letter is a single grapheme, and
     every picture has to be unmistakable on its own and distinct from all the
     others. That rules out plenty of otherwise fine words: "mud" and "red"
     are colours rather than things, and can/tin/lid all want the same tin. */
  const HEARD = [
    { w: 'cat', pic: '🐱' }, { w: 'dog', pic: '🐕' }, { w: 'pig', pic: '🐷' },
    { w: 'sun', pic: '☀️' }, { w: 'bus', pic: '🚌' }, { w: 'hat', pic: '🎩' },
    { w: 'bed', pic: '🛏️' }, { w: 'jam', pic: '🍯' }, { w: 'bug', pic: '🐛' },
    { w: 'log', pic: '🪵' }, { w: 'pen', pic: '🖊️' }, { w: 'fan', pic: '🪭' },
    { w: 'map', pic: '🗺️' }, { w: 'pot', pic: '🍲' }, { w: 'nut', pic: '🌰' },
    { w: 'net', pic: '🥅' }, { w: 'bag', pic: '👜' }, { w: 'van', pic: '🚐' },
    { w: 'jet', pic: '✈️' }, { w: 'hen', pic: '🐔' }, { w: 'bat', pic: '🦇' },
    { w: 'rat', pic: '🐀' }, { w: 'pup', pic: '🐶' }, { w: 'lip', pic: '👄' },
    { w: 'zip', pic: '🤐' }, { w: 'kid', pic: '🧒' }, { w: 'man', pic: '👨' },
    { w: 'ham', pic: '🍖' }, { w: 'pin', pic: '📌' }, { w: 'web', pic: '🕸️' },
    { w: 'mop', pic: '🧹' }, { w: 'cup', pic: '🥤' },
    /* These earn their place by completing minimal-pair families rather than
       on their own merits: cat/cap/can, pen/pin/pan, hen/pen/ten, jam/ham/ram.
       Without them the hardest tier has almost nothing to draw on. */
    { w: 'pan', pic: '🍳' }, { w: 'cap', pic: '🧢' }, { w: 'ram', pic: '🐏' },
    { w: 'ten', pic: '🔟' }, { w: 'can', pic: '🥫' }
  ];

  function heardPic(word) {
    const hit = HEARD.filter(function (h) { return h.w === word; })[0];
    return hit ? hit.pic : null;
  }

  /* Distractors for blending by ear, graded.

     'far'   shares nothing -- a child can win on the first sound alone
     'onset' differs only in the first sound (cat / bat / hat)
     'inner' differs only in the vowel or the last sound (cat / cot / can)

     The inner ones are what force real blending: guessing from the opening
     sound gets you the wrong answer, so the whole word has to be held. */
  function heardRivals(word, tier) {
    const pool = HEARD.map(function (h) { return h.w; })
                      .filter(function (w) { return w !== word && w.length === word.length; });
    if (tier === 'far') {
      return pool.filter(function (w) {
        return w.split('').every(function (c, i) { return c !== word[i]; });
      });
    }
    const diffAt = function (w, i) {
      return w.split('').filter(function (c, j) { return c !== word[j]; }).length === 1
          && w[i] !== word[i];
    };
    if (tier === 'onset') return pool.filter(function (w) { return diffAt(w, 0); });
    return pool.filter(function (w) { return diffAt(w, 1) || diffAt(w, 2); });
  }

  /* Every letter in teaching order, flattened. */
  const ORDER = LEVELS.reduce((a, l) => a.concat(l.letters), []);

  function lettersUpTo(level) {
    return LEVELS.filter(l => l.id <= level)
                 .reduce((a, l) => a.concat(l.letters), []);
  }

  function wordsUpTo(level) {
    return LEVELS.filter(l => l.id <= level)
                 .reduce((a, l) => a.concat(l.words), []);
  }

  return { PHONEME, LEVELS, SAME_SHAPE, CONFUSABLE, REWARD, ORDER,
           HEARD, heardPic, heardRivals,
           lettersUpTo, wordsUpTo, MAX_LEVEL: LEVELS.length };
})();
