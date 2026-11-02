// Builds the public game guide (guide.html) from the game's own data, so it is never out of date.
// Usage: node tools/build-guide.js [out.html]   (the Pages workflow writes it next to index.html)
const fs = require('fs'), path = require('path');
const L = require(path.join(__dirname, '..', 'src', 'engine.js')), D = L.DATA;
const out = process.argv[2] || path.join(__dirname, '..', 'dist', 'guide.html');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const naira = (n) => '₦' + Math.round(n).toLocaleString('en');
const cityOf = (d) => (D.DISTRICTS[d] && D.DISTRICTS[d].city) || 'lagos';
const cityName = (c) => (D.CITIES[c] || { name: c }).name;
const MONTHS = D.MONTHS || ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Counts.
const acts = new Set();
Object.values(D.PLACE_ACTIONS).forEach((l) => l.forEach((a) => acts.add(a.id)));
Object.values(D.CIVIC_ACTS || {}).forEach((l) => (Array.isArray(l) ? l : []).forEach((a) => acts.add(a.id)));
Object.values(D.FESTIVALS || {}).forEach((l) => l.forEach((a) => acts.add(a.id)));
Object.values(D.INSIDE || {}).forEach((l) => l.forEach((a) => acts.add(a.id)));
(D.HOME_ACTIONS || []).forEach((a) => acts.add(a.id));
const byCity = {}; D.PLACES.forEach((p) => { const c = cityOf(p.district); (byCity[c] = byCity[c] || []).push(p); });
const stats = [['Cities', Object.keys(D.CITIES).length], ['Places', D.PLACES.length], ['Careers', Object.keys(D.CAREERS).length], ['Things to do', acts.size], ['Homes', Object.keys(D.HOMES).filter((k) => !D.HOMES[k].hidden).length], ['Vehicles, boats and jets', Object.keys(D.VEHICLES).length]];

const sec = (id, title, body, note) => `<section id="${id}"><h2>${esc(title)}</h2>${note ? `<p class="note">${esc(note)}</p>` : ''}${body}</section>`;
const table = (head, rows) => `<div class="tw"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

const parts = [];
parts.push(sec('cities', 'Cities and places', Object.keys(D.CITIES).map((c) => `<details${c === 'lagos' ? ' open' : ''}><summary>${esc(cityName(c))} · ${(byCity[c] || []).length} places</summary><ul class="cols">${(byCity[c] || []).map((p) => `<li>${esc(p.icon || '📍')} ${esc(p.name)} <small>${esc((D.DISTRICTS[p.district] || {}).name || '')}</small></li>`).join('')}</ul></details>`).join(''), 'Every place you can walk into, by city. Real landmarks keep their names; businesses have made-up ones.'));
parts.push(sec('careers', 'Careers', table(['Career', 'Workplace', 'Skill', 'Levels', 'Pay per shift'], Object.keys(D.CAREERS).map((k) => { const c = D.CAREERS[k]; return [esc(c.name), esc(((D.DISTRICTS[c.district] || {}).name || '') + ', ' + cityName(cityOf(c.district))), esc(D.SKILLS[c.skill] || c.skill), esc((c.titles || []).join(' → ')), esc((c.pay || []).map(naira).join(' · '))]; })), 'Each career has five levels; you rise with skill and good shifts. Pay is the base before prices move.'));
parts.push(sec('homes', 'Homes', table(['Home', 'Area', 'Rent a week', 'Light'], Object.keys(D.HOMES).filter((k) => !D.HOMES[k].hidden).map((k) => { const h = D.HOMES[k]; return [esc(h.name), esc(((D.DISTRICTS[h.district] || {}).name || '') + ', ' + cityName(cityOf(h.district))), h.rent ? naira(h.rent) : 'Owned', Math.round((h.power || 0) * 100) + '%']; })), 'Rent is collected on Saturdays at noon. "Light" is how often the house has power.'));
parts.push(sec('food', 'Groceries and recipes', table(['Foodstuff', 'Pack', 'Portions', 'List price'], Object.keys(D.GROCERIES).map((k) => { const g = D.GROCERIES[k]; return [esc(g.icon + ' ' + g.name), esc(g.pack), g.portions, naira(g.price)]; })) + table(['Recipe', 'Needs', 'Time', 'Belle'], Object.keys(D.RECIPES).map((k) => { const r = D.RECIPES[k]; return [esc(r.icon + ' ' + r.name), esc(Object.keys(r.needs).map((g) => r.needs[g] + ' ' + D.GROCERIES[g].name.toLowerCase()).join(', ')), r.mins + ' min', '+' + r.fx.hunger]; })), 'Markets sell foodstuff 20% under the list price; supermarkets at the malls charge 15% more.'));
parts.push(sec('moodlets', 'Moodlets', table(['Moodlet', 'Mood', 'How long', 'Why'], Object.keys(D.MOODLETS).map((k) => { const m = D.MOODLETS[k]; return [esc(m.icon + ' ' + m.name), (m.mood > 0 ? '+' : '') + m.mood, m.hrs ? m.hrs + ' h' : 'while it lasts', esc(m.text)]; }))));
parts.push(sec('wishes', 'Wishes and perks', '<ul class="cols">' + D.WISHES.map((w) => `<li>${esc(w.icon + ' ' + w.text)} <small>+${w.pts} pts</small></li>`).join('') + '</ul>' + table(['Perk', 'Points', 'What it does'], Object.keys(D.PERKS).map((k) => { const p = D.PERKS[k]; return [esc(p.icon + ' ' + p.name), p.pts, esc(p.text)]; })), 'Three wishes a day; all three earn 20 bonus points.'));
parts.push(sec('decor', 'Walls and floors', table(['Walls', 'From', 'Calm a day'], Object.keys(D.WALLS).map((k) => [esc(D.WALLS[k].name), D.WALLS[k].price ? naira(D.WALLS[k].price) : 'Free', '+' + D.WALLS[k].calm])) + table(['Floor', 'From', 'Calm a day'], Object.keys(D.FLOORS).map((k) => [esc(D.FLOORS[k].name), D.FLOORS[k].price ? naira(D.FLOORS[k].price) : 'Free', '+' + D.FLOORS[k].calm])), 'Prices grow with the size of your home.'));
const fests = []; Object.keys(D.FESTIVALS || {}).forEach((pid) => D.FESTIVALS[pid].forEach((a) => { if (a.when && a.when.months && a.event) fests.push([a.when.months[0], a.label, (D.PLACES.find((p) => p.id === pid) || { name: pid }).name]); }));
fests.sort((a, b) => a[0] - b[0]);
parts.push(sec('events', 'Festivals and events', table(['Month', 'Event', 'Where'], fests.map((f) => [esc(MONTHS[f[0]]), esc(f[1]), esc(f[2])])), 'The game year has twelve four-week months.'));
parts.push(sec('vehicles', 'Cars, boats and jets', table(['Vehicle', 'Kind', 'Price'], Object.keys(D.VEHICLES).map((k) => { const v = D.VEHICLES[k]; return [esc((v.icon || '') + ' ' + v.name), esc(v.kind), naira(v.price)]; })), 'All names are made up.'));
parts.push(sec('radio', 'FM stations', table(['Station', 'Style', 'Shows'], (D.FM || []).map((st) => [esc(st.name + ' ' + st.freq), esc(st.blurb), esc(st.shows.map((x) => String(x[0]).padStart(2, '0') + ':00 ' + x[2] + ' (' + x[3] + ')').join(' · '))]))));
parts.push(sec('boards', 'Board games', '<ul><li><b>Ludo</b>: 2–4 players; a six brings a token out and rolls again; land on a rival to send them home; exact rolls to finish.</li><li><b>Ayò Ọlọ́pọ́n</b>: sow anticlockwise; capture 2s and 3s on your opponent\'s side, chaining backwards; feed an empty side; 25 seeds wins.</li><li><b>Draughts</b>: English rules; jumps are compulsory and continue; kings on the far row.</li></ul>', 'Play the computer or open an online table from 📱 Phone → 🎲 Board games.'));

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lasgidi game guide</title>
<meta name="description" content="Every city, place, career, home, recipe, festival and more in Lasgidi, the free West African life game.">
<style>
:root{--bg:#f4f3ec;--ink:#17181a;--card:#fff;--muted:#5c6066;--line:rgba(0,0,0,.1);--acc:#f2b600}
@media (prefers-color-scheme:dark){:root{--bg:#121417;--ink:#ecebe4;--card:#1b1e22;--muted:#a3a7ad;--line:rgba(255,255,255,.12)}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
header{background:var(--acc);color:#17181a;padding:22px 16px 18px}header h1{margin:0;font-size:28px;letter-spacing:-.01em}header p{margin:4px 0 0}
main{max-width:980px;margin:0 auto;padding:16px}nav{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 4px}nav a{color:inherit;background:rgba(0,0,0,.08);border-radius:999px;padding:4px 10px;text-decoration:none;font-weight:600;font-size:13px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:14px 0}.stat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}.stat b{display:block;font-size:26px}
section{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin:14px 0}h2{margin:0 0 6px;font-size:20px}.note{color:var(--muted);margin:0 0 10px}
details{border-top:1px solid var(--line);padding:6px 0}summary{cursor:pointer;font-weight:700}.cols{columns:3 220px;padding-left:18px}.cols li{break-inside:avoid}small{color:var(--muted)}
.tw{overflow-x:auto}table{border-collapse:collapse;width:100%;margin:6px 0 10px;font-size:14px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.cta{display:inline-block;background:#17181a;color:#fff;border-radius:999px;padding:10px 18px;font-weight:800;text-decoration:none;margin-top:10px}
input{width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:inherit;font:inherit}
</style></head><body><header><h1>Lasgidi game guide</h1><p>Everything in the game, straight from its data. Updated every time the game is.</p><a class="cta" href="./">▶ Play Lasgidi free</a></header>
<main><div class="stats">${stats.map((s) => `<div class="stat"><b>${s[1].toLocaleString('en')}</b>${esc(s[0])}</div>`).join('')}</div>
<input id="q" type="search" placeholder="Search the guide (a place, a job, a dish…)" aria-label="Search the guide">
<nav>${[['cities', 'Places'], ['careers', 'Careers'], ['homes', 'Homes'], ['food', 'Food'], ['moodlets', 'Moodlets'], ['wishes', 'Wishes'], ['decor', 'Decor'], ['events', 'Events'], ['vehicles', 'Vehicles'], ['radio', 'Radio'], ['boards', 'Board games']].map((n) => `<a href="#${n[0]}">${n[1]}</a>`).join('')}</nav>
${parts.join('\n')}
<p class="note">Lasgidi is a free game. All business, brand, station and person names are made up.</p></main>
<script>document.getElementById('q').addEventListener('input',function(e){var q=e.target.value.trim().toLowerCase();document.querySelectorAll('section li, section tbody tr').forEach(function(el){el.style.display=!q||el.textContent.toLowerCase().indexOf(q)>=0?'':'none';});document.querySelectorAll('details').forEach(function(d){if(q)d.open=true;});});</script>
</body></html>`;
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html);
console.log('Wrote ' + out + ' (' + Math.round(html.length / 1024) + ' KB): ' + stats.map((s) => s[1] + ' ' + s[0].toLowerCase()).join(', '));
