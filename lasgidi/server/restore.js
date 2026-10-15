#!/usr/bin/env node
'use strict';
// Shop owner tool: give a player's paid item back on a new device.
//   SHOP_ADMIN_TOKEN=... PORT=8080 node server/restore.js <receipt lsg_...> <new shop key>
// The player finds both in the Style shop (receipt under "Your purchases", key under "Your shop key").
const [ref, account] = process.argv.slice(2);
const token = process.env.SHOP_ADMIN_TOKEN, port = +process.env.PORT || 8080;
if (!ref || !account || !token) { console.error('Usage: SHOP_ADMIN_TOKEN=... [PORT=8080] node server/restore.js <receipt> <shop key>'); process.exit(2); }
fetch('http://127.0.0.1:' + port + '/api/admin/restore', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: JSON.stringify({ ref, account }) })
  .then(r => r.json().then(j => { if (r.ok) console.log('Restored ' + ref + ' to ' + account + '.'); else { console.error('Not restored: ' + (j.error || r.status)); process.exit(1); } }))
  .catch(e => { console.error('Could not reach the shop server on port ' + port + ': ' + e.message); process.exit(1); });
