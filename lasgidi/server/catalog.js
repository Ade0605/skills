'use strict';
// Cosmetics only. Nothing here changes a life's money, skills or status, and none of it is part of a replay.
// Name-tag colours show on your @handle in live rooms and on the cruise. You wear one item of each kind.
const COSMETICS = {
  tag_emerald: { name: 'Emerald name tag', kind: 'tag', color: '#1f9d55', ink: '#ffffff', ngn: 1500, usd: '1.99' },
  tag_lagoon:  { name: 'Lagoon blue name tag', kind: 'tag', color: '#1d7fa3', ink: '#ffffff', ngn: 1500, usd: '1.99' },
  tag_ankara:  { name: 'Ankara pink name tag', kind: 'tag', color: '#c2417f', ink: '#ffffff', ngn: 1500, usd: '1.99' },
  tag_night:   { name: 'Midnight purple name tag', kind: 'tag', color: '#4b2f8f', ink: '#ffffff', ngn: 1500, usd: '1.99' },
  // Accessories drawn over your own avatar (on your phone, in rooms and on the cruise). look picks the drawing.
  acc_shades:  { name: 'Dark shades', kind: 'acc', look: 'shades', color: '#17181a', ink: '#ffffff', ngn: 2000, usd: '2.49' },
  acc_chain:   { name: 'Gold rope chain', kind: 'acc', look: 'chain', color: '#d4a017', ink: '#17181a', ngn: 3000, usd: '3.99' },
  acc_cap:     { name: 'Snapback cap', kind: 'acc', look: 'cap', color: '#c0392b', ink: '#ffffff', ngn: 2000, usd: '2.49' },
  acc_phones:  { name: 'Studio headphones', kind: 'acc', look: 'phones', color: '#2f6fa0', ink: '#ffffff', ngn: 2500, usd: '2.99' },
  // House paint: the wall colour of your home in the home designer, and your home pin on the map.
  paint_sage:  { name: 'Sage green house paint', kind: 'paint', color: '#9cbf9a', ink: '#17181a', ngn: 1500, usd: '1.99' },
  paint_terra: { name: 'Terracotta house paint', kind: 'paint', color: '#c8714e', ink: '#ffffff', ngn: 1500, usd: '1.99' },
  paint_sky:   { name: 'Sky blue house paint', kind: 'paint', color: '#8fc3e3', ink: '#17181a', ngn: 1500, usd: '1.99' }
};
const KINDS = { tag: 'Name tags', acc: 'Accessories', paint: 'House paint' };
module.exports = { COSMETICS, KINDS };
