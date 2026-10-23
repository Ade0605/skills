const test = require('node:test'), assert = require('node:assert');
const C = require('../src/chat.js');

test('chat: ordinary messages pass, cleaned and trimmed', () => {
  for (const m of ['Hello! 👋', 'How far?', 'Where you dey?', 'We were at the beach', 'The ode to Lagos', 'I dey die for laugh 😂', 'Ewu nkwobi at the joint', 'Lekki strip is busy', 'Graduated summa cum laude', 'You are killing it', 'I hate traffic', ...C.QUICK]) {
    const r = C.clean(m); assert.ok(r.ok, m + ': ' + r.why);
  }
  assert.equal(C.clean('  hi   there  ').text, 'hi there');
});

test('chat: sexual content, abuse, links and numbers are refused, even disguised', () => {
  for (const m of ['send nudes', 'you are s3xy', 's e x', 'fvck', 'f.u.c.k you', 'FUUUCK', 'you are a b1tch', 'mumu', 'werey', 'olodo', 'idiot!!', 'I will kill you', 'go kill yourself', 'ashawo', 'n1gga']) {
    const r = C.clean(m); assert.ok(!r.ok, m + ' should be refused');
  }
  assert.match(C.clean('see www.example.com').why, /links/);
  assert.match(C.clean('call 08012345678').why, /phone/);
  assert.match(C.clean('me@mail.com').why, /email/);
  assert.match(C.clean('x'.repeat(141)).why, /under/);
  assert.equal(C.clean('   ').ok, false);
});

test('chat: handles and pacing', () => {
  assert.equal(C.handle('Ade Bola!'), '@adebola');
  assert.equal(C.handle(''), '@lagosian');
  assert.equal(C.canSend([], 10000), '');
  assert.match(C.canSend([9000], 10000), /Slow/);
  assert.match(C.canSend(Array.from({ length: 12 }, (_, i) => 1000 + i * 3000), 40000), /lot/);
});
test('chat: invisible characters, full-width digits and look-alike letters do not slip past the filter', () => {
  const C = require('../src/chat.js');
  assert.equal(C.clean('I want s­e­x now').ok, false);
  assert.equal(C.clean('call 0８0３1234567').ok, false);
  assert.equal(C.clean('ѕех tonight').ok, false);
  assert.equal(C.clean('see you at the beach').ok, true);
});

test('chat: safety phrases (age, photos, personal details, moving off the game, scams, threats) are refused', () => {
  const bad = ['how old are you?', 'how old r u', 'send me a pic', 'show me your photos', 'where do you live', 'are you alone', 'what is your real name',
    'dm me', 'add me on whatsapp', 'my snap is cool', 'meet me irl', 'come to my house', 'send me money', 'double your money', 'tell me your otp',
    'i will hurt you', 'i know where you live', 'go die'];
  for (const m of bad) assert.ok(!C.clean(m).ok, m + ' should be refused');
  assert.match(C.clean('i want to die').why, /talk to someone/);
});

test('chat: everyday Lagos chat with the same words still passes', () => {
  for (const m of ['Nice house!', 'My house is in Yaba', 'I sent the money for the rent', 'I will find you at the party', 'Who won the match',
    'See you at the beach', 'The photo booth at the fest is fun', 'Meet the governor at the rally', 'You are killing it']) {
    const r = C.clean(m); assert.ok(r.ok, m + ': ' + r.why);
  }
});

test('chat: three refused messages in ten minutes pause chat, then it opens again', () => {
  const now = 1e7;
  assert.equal(C.canSend([], now, [now - 1000, now - 2000]), '');
  assert.match(C.canSend([], now, [now - 1000, now - 2000, now - 3000]), /paused/);
  assert.equal(C.canSend([], now + 601000, [now - 1000, now - 2000, now - 3000]), '');
});
