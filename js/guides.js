/* Parent-facing coaching guides.

   Written for the adult sitting next to the child, not the child. The most
   useful thing a guide can give a parent is the exact words to say, so every
   one of these leads with a script rather than a description.

   Kept out of the play screen on purpose: the task screen stays close to
   empty, and this opens from the "?" on a mode card or from the grown-up
   panel. */

const GUIDES = {

  /* Shown once before the very first game, and listed first in the panel. */
  start: {
    emoji: '🌱',
    title: 'Before you start',
    lead: 'Five minutes of this, done well, beats twenty minutes of grinding. A few things that make the difference.',
    sections: [
      { kind: 'do', head: 'Sit next to them',
        body: 'Two of the five games need you to tap Got it or Not yet, and all of them go better with you there. At this age an adult alongside is worth more than any feature in the app.' },
      { kind: 'do', head: 'Stop while they still want more',
        body: 'Every game is a fixed length with a visible “6 left” counter, so there is always a natural stopping point. Ending on a win is what makes them willing to come back. If they are flagging, drop the session length in settings rather than pushing through.' },
      { kind: 'say', head: 'Praise the work, not the child',
        body: '“You sounded that out” lands better than “you’re so smart.” Naming the thing they did tells them what to do again next time.' },
      { kind: 'avoid', head: 'Don’t add a penalty the app removed',
        body: 'There is no buzzer, no red, no lost points, and a wrong answer never ends a turn. Sighing or saying “no, try again” puts the cost straight back in. When they miss, the app plays the right answer and asks again — let it do that work.' },
      { kind: 'tip', head: 'If it is silent',
        body: 'Check the iPad’s physical mute switch. It silences this kind of audio even with the volume turned up.' }
    ]
  },

  find: {
    emoji: '👂',
    title: 'Find the Letter',
    lead: 'Hearing a sound and finding the letter that makes it.',
    sections: [
      { kind: 'say', head: 'Say this',
        body: '“Which one says /s/?” Press the speaker as many times as they want — it is there to be pressed, and re-listening is not cheating.' },
      { kind: 'do', head: 'What it builds',
        body: 'The link from sound to written letter. Everything else in reading sits on top of this one connection.' },
      { kind: 'watch', head: 'Watch for slapping at answers',
        body: 'With two choices a child can score well by guessing. If they answer before the sound finishes, cover the tiles with your hand, play it again, and say “listen first.”' },
      { kind: 'avoid', head: 'Don’t answer for them',
        body: 'Resist “it’s the s, look.” If they miss, the app shows the letter and says the sound on its own, then asks again with fewer choices.' },
      { kind: 'tip', head: 'It gets harder by itself',
        body: 'Two choices to begin with, three or four once a letter is solid, and the wrong answers start being ones that are genuinely easy to mix up. You do not need to manage difficulty.' }
    ]
  },

  say: {
    emoji: '🗣️',
    title: 'Say the Sound',
    lead: 'They see the letter and say the sound out loud. You judge it.',
    sections: [
      { kind: 'say', head: 'Say this',
        body: '“What sound?” — not “what letter is this?” You are asking for /mmm/, not “em”. The name of the letter is a different piece of knowledge and it is not the one that unlocks reading.' },
      { kind: 'avoid', head: 'Clip the consonant',
        body: 'Say /mmm/, /t/, /p/ — never “muh”, “tuh”, “puh”. It matters more than it sounds: “muh-a-tuh” does not blend into “mat”, and a child taught the extra vowel has to unlearn it before they can blend anything.' },
      { kind: 'do', head: 'Be generous with Got it',
        body: 'Quiet, mumbled or half-hearted still counts if the sound is right. Tap Not yet only when it is wrong or they have no idea — then the app says it twice and asks again.' },
      { kind: 'avoid', head: 'Don’t drill a correct answer',
        body: 'Once they say it right, move on. Making them repeat it three more times turns a win into a chore.' }
    ]
  },

  match: {
    emoji: '🔠',
    title: 'Big & Little',
    lead: 'Matching the two forms of the same letter.',
    sections: [
      { kind: 'say', head: 'Say this',
        body: '“Find the little one.” Then once they have it: “Both of them say /a/.” That second sentence is the whole point of the game — the two shapes share a sound.' },
      { kind: 'do', head: 'It skips the easy half',
        body: 'Cc, Oo, Ss, Vv, Ww, Xx, Zz, Pp, Uu, Kk and Jj are the same shape at two sizes and are close to free. The app weights practice toward the fourteen that genuinely differ — Aa, Bb, Dd, Ee, Gg, Hh, Ii, Ll, Mm, Nn, Qq, Rr, Tt, Yy.' },
      { kind: 'watch', head: 'b and d will get mixed up',
        body: 'That is ordinary at five and is not, on its own, a sign of dyslexia. The teaching order deliberately puts them levels apart so they are never being learned at the same time.' },
      { kind: 'tip', head: 'Lowercase matters more',
        body: 'Around 95% of the text he will meet is lowercase. Capitals are mostly for names and the starts of sentences, so do not worry if they lag.' }
    ]
  },

  blend: {
    emoji: '🌊',
    title: 'Blend It',
    lead: 'Sounding out a word and pushing the sounds together. This is the one that matters most.',
    sections: [
      { kind: 'say', head: 'Say this',
        body: '“Sound it out… now say it fast.”' },
      { kind: 'avoid', head: 'Never pause between the sounds',
        body: '“/m/ … /a/ … /t/” with gaps is exactly where a child loses the word — by the third sound the first one is gone. Slide them together instead: “mmmaaat”. The Blend it button does this properly, with no gaps at all. Copy how it sounds.' },
      { kind: 'do', head: 'When they are stuck: I do it, we do it, you do it',
        body: 'Press Blend it and let them hear it. Say it together. Then let them say it alone. That sequence is worth more than three more attempts on their own.' },
      { kind: 'watch', head: 'Guessing from the first letter',
        body: 'If they see “mat” and say “mouse”, that is a guess off the /m/, not reading. Do not say no — just press Blend it again and let the whole word arrive.' },
      { kind: 'tip', head: 'Why there is no picture',
        body: 'Deliberate. A picture next to a word teaches a child to read the picture, which works until the books get harder and then stops working. The picture here shows up after they read it, as the reward.' }
    ]
  },

  build: {
    emoji: '🧱',
    title: 'Build It',
    lead: 'They hear a word and spell it out of the letters.',
    sections: [
      { kind: 'say', head: 'Say this',
        body: '“What’s the first sound in mat?” Get the sound first, then go looking for the letter. Working in that order is the whole skill.' },
      { kind: 'do', head: 'Why spelling is in a reading app',
        body: 'Building a word out of sounds strengthens reading it more than another round of reading does. It is the same knowledge, used in the harder direction.' },
      { kind: 'watch', head: 'Tapping at random',
        body: 'A wrong tap only bounces — it does not end the turn or take anything away — so there is no penalty for hammering. Slow them down and do it one sound at a time.' },
      { kind: 'tip', head: 'It will help on its own',
        body: 'After two wrong taps the app plays the sound they need next and nudges the slot. Give it a moment before you step in.' }
    ]
  }
};

const GUIDE_ORDER = ['start', 'find', 'say', 'match', 'blend', 'build'];

const GUIDE_KIND = {
  say:   { label: 'Say this',  icon: '💬' },
  do:    { label: '',          icon: '✅' },
  watch: { label: 'Watch for', icon: '👀' },
  avoid: { label: 'Avoid',     icon: '⚠️' },
  tip:   { label: 'Tip',       icon: '💡' }
};
