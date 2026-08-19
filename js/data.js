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
              'tin','tip','tan','nip','nap','man','mat','map','mad','mid',
              'dip','dim','did','dad'] },

    { id: 3, letters: ['g','o','c','k'],
      words: ['on','got','gap','gas','dog','cog','cot','cop','cod','can',
              'cap','cat','kid','kit','top','pot','pop','pod','not','nod',
              'nag','mop','dot','tag','pig','dig'] },

    { id: 4, letters: ['e','u','r'],
      words: ['up','us','get','pet','pen','ten','den','men','met','set',
              'net','peg','red','rat','rap','rim','rid','run','rug','rot',
              'cup','cut','mud','sun','nut','gum','pup','tug','dug','mug'] },

    { id: 5, letters: ['h','b','f','l'],
      words: ['hat','ham','had','hit','hip','hop','hot','hug','hen','bat',
              'bad','bag','bed','beg','bet','big','bin','bit','bug','bun',
              'but','fan','fat','fit','fig','fin','fun','fed','fog','lap',
              'leg','let','lid','lip','lit','log','lot','lug'] },

    { id: 6, letters: ['j','v','w','y','z','q','x'],
      words: ['jam','jet','jog','job','jug','van','vet','wag','web','wet',
              'win','wig','yes','yet','yap','zip','zap','box','fox','six',
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
           lettersUpTo, wordsUpTo, MAX_LEVEL: LEVELS.length };
})();
