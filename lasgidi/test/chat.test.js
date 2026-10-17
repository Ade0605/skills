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
