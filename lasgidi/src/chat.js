/* Lasgidi: player-to-player chat rules.
   Pure and shared by the sender and the receiver: a message is checked before it is sent,
   and again when it arrives, because what comes over the room is untrusted.
   No links, no phone numbers or emails, no sexual content, no insults or slurs. */
(function (root) {
  'use strict';

  var MAX = 140;
  // Ready-made lines for a quick, safe hello.
  var QUICK = ['Hello! 👋', 'How far?', 'Where you dey?', 'See you at the beach 🏖️', 'Nice house! 🏠', 'Wetin you dey do today?', 'Join my party 🎉', 'Safe journey ✈️', 'Well done! 👏', 'Thank you 🙏'];

  // Matched against a normalized copy (lower case, look-alike digits and symbols mapped to letters,
  // repeated letters squeezed, separators removed). Kept to whole tokens or clear stems to avoid
  // flagging ordinary words. Includes English and common Nigerian Pidgin and Yoruba insults.
  var SEXUAL = ['sex', 'sexy', 'nude', 'nudes', 'naked', 'porn', 'boob', 'boobs', 'tits', 'titty', 'dick', 'cock', 'pussy', 'penis', 'vagina', 'horny', 'blowjob', 'handjob', 'orgasm', 'milf', 'onlyfans', 'hookup', 'knack', 'kpekus', 'ashawo', 'prostitute', 'stripper', 'shag', 'boner', 'thong', 'nsfw', 'xxx', 'fuckme', 'sendpic', 'sendpics'];
  var ABUSE = ['fuck', 'fucker', 'fucking', 'fuk', 'fvck', 'fck', 'fcuk', 'phuck', 'fk', 'stfu', 'mf', 'shit', 'bitch', 'bastard', 'asshole', 'arse', 'cunt', 'whore', 'slut', 'dumb', 'idiot', 'stupid', 'moron', 'retard', 'loser', 'ugly', 'fool', 'mumu', 'werey', 'olodo', 'oloshi', 'mugu', 'agbaya', 'oponu', 'didirin', 'yeye', 'rape', 'nigger', 'nigga', 'fag', 'faggot', 'kys', 'ashewo', 'ndiabe', 'tribalist'];
  var MAP = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '8': 'b', '9': 'g', '+': 't' };

  function squeeze(w) { return w.replace(/(.)\1+/g, '$1'); }
  // Cyrillic and Greek letters that look Latin, so 'ѕех' is read as 'sex'.
  var LOOK = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'к': 'k', 'і': 'i', 'ѕ': 's', 'м': 'm', 'т': 't', 'н': 'h', 'в': 'b', 'α': 'a', 'ο': 'o', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'τ': 't', 'χ': 'x' };
  function norm(s) {
    return String(s).toLowerCase().replace(/[аеорсухкіѕмтнвαοειкντχ]/g, function (c) { return LOOK[c] || c; }).replace(/[0-9!@$+]/g, function (c) { return MAP[c] || c; });
  }
  var SEX = {}, AB = {};
  SEXUAL.forEach(function (w) { SEX[squeeze(w)] = 1; });
  ABUSE.forEach(function (w) { AB[squeeze(w)] = 1; });

  // Phrases, matched on the normalized text with words kept apart (" how old are you "). Safety first: grooming and
  // personal details, moving off the game, scams, threats, and self-harm (answered kindly, with where to get help).
  var PHRASES = [
    [/\b(how old (are|r) (you|u)|what (is|s) (your|ur) age|ur age|your age|are (you|u) (a )?(kid|child|minor|underage)|(you|u) (in|go to) (school|primary|jss|ss[1-3]))\b/, 'For your safety: no asking about age.'],
    [/\b(send|show|share|drop) (me )?(a |your |ur |some )?(pic|pics|picture|pictures|photo|photos|selfie|selfies|video|vid|snap)\b/, 'For your safety: no asking for photos.'],
    [/\b(are (you|u) alone|where do (you|u) (live|stay)|(your|ur) (house|home) address|(your|ur) address|which school|(your|ur) (real|full) name|(your|ur) (number|phone|location))\b/, 'For your safety: no asking for personal details.'],
    [/\b(meet (me|up)( irl| in person| outside| tonight)?|come to my (house|place|room|hotel)|let (us|s) meet|link up (irl|outside)|(dm|inbox|pm) me|add me on|my (snap|snapchat|insta|instagram|ig|telegram|whatsapp|wa|tiktok|facebook|fb|discord)|on (snap|snapchat|telegram|whatsapp|discord))\b/, 'For your safety: keep chat in the game.'],
    [/\b(send (me )?(money|cash|credit|airtime|data)|(bitcoin|btc|crypto|usdt|forex) (invest|trade|plan|signal)|double (your|ur) money|investment plan|giveaway|gift ?card|(bank|account) details|(your|ur) (otp|pin|bvn|password|passcode))\b/, 'No money requests or scams in chat.'],
    [/\b(i (will|go|wan|want to|gonna) (kill|beat|stab|shoot|hurt|slap) (you|u)|kill (yo)?urself|go die|(you|u) (will|go) die|i know where (you|u) (live|stay))\b/, 'No threats. Be kind.'],
    [/\b(kill myself|end my life|want to die|wanna die|suicide|self harm|cut myself)\b/, 'If you are struggling, please talk to someone you trust, or call your local emergency number. In Nigeria: 112.']
  ];
  function phraseWhy(raw) {
    var n = ' ' + norm(raw).replace(/[^a-z]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ', sq = n.split(' ').map(squeeze).join(' ');
    for (var i = 0; i < PHRASES.length; i++) if (PHRASES[i][0].test(n) || PHRASES[i][0].test(sq)) return PHRASES[i][1];
    return '';
  }
  function why(text) {
    var raw = String(text == null ? '' : text); raw = raw.replace(/[аеорсухкіѕмтнвαοειкντχАЕОРСУХКІЅМТНВ]/g, function (c) { return LOOK[c.toLowerCase()] || c; });
    if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(raw)) return 'No emails in chat.';
    if (/(https?:|www\.|\.(com|net|org|ng|io|me|xyz|link)\b|t\.me|wa\.me)/i.test(raw)) return 'No links in chat.';
    if ((raw.replace(/[^0-9]/g, '').length >= 7)) return 'No phone numbers or account numbers in chat.';
    var pw = phraseWhy(raw); if (pw) return pw;
    var n = norm(raw);
    var words = n.split(/[^a-z]+/).concat(raw.toLowerCase().split(/[^a-z]+/)).filter(Boolean).map(squeeze);
    // Joined runs catch spaced-out words: "s e x", "f.u.c.k".
    var letters = n.replace(/[^a-z\s]/g, '').split(/\s+/), joined = [], run = '';
    letters.forEach(function (w) { if (w.length === 1) run += w; else { if (run.length > 1) joined.push(squeeze(run)); run = ''; } });
    if (run.length > 1) joined.push(squeeze(run));
    var all = words.concat(joined, [squeeze(n.replace(/[^a-z]/g, ''))]);
    for (var i = 0; i < all.length; i++) {
      var w = all[i];
      if (SEX[w]) return 'Keep it clean: no sexual messages.';
      if (AB[w]) return 'Be kind: no insults or abuse.';
      if (i === all.length - 1) { // the whole message with no spaces: stems that are never innocent
        if (/(fuck|fuk|fvck|fcuk|phuck|cunt|nigg|faggot|blowjob|porn|nudes|pussy|kpekus|sendnude|kilyou|kilurself|kilyourself|iwilkil|gokil|kilu\b)/.test(w)) return 'Keep it clean.';
      }
    }
    return '';
  }
  // Returns { ok, text } with the cleaned text, or { ok: false, why }.
  function clean(text) {
    var t0 = String(text == null ? '' : text); try { t0 = t0.normalize('NFKC').replace(/\p{Cf}/gu, ''); } catch (e) { /* old browsers */ } // full-width digits become digits; invisible joiners go
    var t = t0.replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
    if (!t) return { ok: false, why: 'Type a message.' };
    if (t.length > MAX) return { ok: false, why: 'Keep it under ' + MAX + ' characters.' };
    if (/(.)\1{9,}/.test(t)) return { ok: false, why: 'No spam.' };
    var w = why(t);
    return w ? { ok: false, why: w } : { ok: true, text: t };
  }
  // A display handle from a profile name: "@" plus letters and digits, never the email.
  function handle(name) {
    var h = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
    return '@' + (h || 'lagosian');
  }
  // Sender-side pacing: at most one message every 2 seconds and 12 a minute. Three blocked messages in ten minutes
  // mean a ten-minute cool-off (blocked: the times of messages the filter refused).
  function canSend(times, now, blocked) {
    var bad = (blocked || []).filter(function (t) { return now - t < 600000; });
    if (bad.length >= 3) return 'Chat is paused for a few minutes. Keep it friendly when you come back.';
    var recent = (times || []).filter(function (t) { return now - t < 60000; });
    if (recent.length && now - recent[recent.length - 1] < 2000) return 'Slow down a little.';
    if (recent.length >= 12) return 'You are sending a lot. Take a breath.';
    return '';
  }

  var api = { clean: clean, handle: handle, canSend: canSend, QUICK: QUICK, MAX: MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LasgidiChat = api;
})(this);
