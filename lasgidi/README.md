# Lasgidi

A Lagos life simulator that runs in any browser, on any phone, even offline.

Work shifts, hustle gigs, sleep through NEPA, take the danfo or the ferry, join an ajo, dodge the loan apps and the Ponzi schemes. Rent is due every Saturday at noon.

Lasgidi is an original game inspired by the viral *Lagos Life*. It is designed to fix that game's weak spots: a broken economy, chat that would not scale, weak retention and a heavy 3D world. The full analysis is in [`docs/REVIEW.md`](docs/REVIEW.md).

## Play

```sh
cd lasgidi
python3 -m http.server 8080      # or: npm run serve
# open http://localhost:8080
```

There is no build step. It is plain HTML, CSS and JavaScript at about 120 KB. Served over HTTPS (or from localhost), it installs as a PWA and works offline.

To get a single self-contained file:

```sh
node tools/build-single.js       # writes dist/lasgidi.html
```

## Test

```sh
npm test
```

The test suite runs the engine under Node. It covers rent and eviction, travel rules, rush hour, jobs and promotion, getting sacked, connects, ajo, loan compounding, overdraft guards, save round-trips and tamper detection, choice events and hospital collapse. It includes a **30-week bot playthrough for each birth-lottery origin** that checks after every step that the ledger reconciles and that the economy stays bounded. A second bot plays only by following the advisor and must survive and get promoted.

## How it plays

- **The playground:** an isometric Lagos drawn live on a canvas, with no images and no 3D library. It shows the mainland, the Lagoon, the Island strip to Ajah, the harbour and the Atlantic.
  - **District character:** VI towers, dense low Mushin, Oshodi market roofs, Lekki estates, the Ikeja airstrip and the National Stadium.
  - **Day and night:** night falls with the game clock, and at night **windows light up only where there is power**. Your home follows your actual NEPA state; elsewhere, the grid, generators and darkness vary by district.
  - **Traffic:** danfos crawl at rush hour and ferries cross the Lagoon. Floods tint the Island. Other players appear as bubbles.
  - **Controls:** tap a district to plan a trip, drag to pan, and use the zoom buttons. A row of district buttons keeps it usable by keyboard and screen reader. Movement stops if you've set reduced motion.
- **Homes and estates:** 21 homes across Lagos, each drawn on the map as its own estate:
  - The ladder: a face-me-I-face-you room, flat-share rooms in Yaba and Surulere, single rooms, self-cons, mini flats, 2- and 3-bed flats, Ikeja GRA and Lekki duplexes, a VI penthouse and a Banana Island mansion with a pool.
  - Tap an estate for its listing: rent, move-in cost, light, sleep and perks. Housemates boost your social life; luxury homes lower stress.
  - Listings show how many other players live there.
  - **Mainland Estate** has 108 plots north of the Lagoon. Buy one, your house appears for everyone, and you live rent-free. It counts toward the Landlord goal.
- **Roads and streets:** named roads such as the Third Mainland Bridge, Ikorodu Road, Agege Motor Road, the Lekki–Ikoyi Link Bridge and the Lekki–Epe Expressway. Street names (Allen Avenue, Adeola Odeku, Admiralty Way, Bode Thomas and more) appear when you zoom in. Area names (MAINLAND, THE ISLAND, IKOYI, BANANA ISLAND, LEKKI, AIRPORT) are painted on the ground.
- **Key places:** 56 real Lagos landmarks and venues on the map as emoji badges, colour-coded by category. They include the New Afrika Shrine, Quilox, Amala Shitta, CcHub, The Palms, Elegushi beach, the Adeola Odeku club strip, the Ikeja cinema, the National Theatre, Freedom Park, the National Museum, Ndubuisi Kanu and Muri Okunola parks, Bar Beach and Lekki beach, the Lekki Conservation Centre, Balogun and Tejuosho markets, Computer Village, UNILAG, General Hospital, the jetties and the airport. Filter them by category, and tap one to see its hours, prices and activities. You can do them on the spot, or plan a trip there.
- **Billboards:** 10 ad boards at high-traffic spots, from the Third Mainland Bridge to the Lekki toll gate. Rent one for in-game naira, and your ad runs for 24 real hours, rotating with up to 2 others. Ads are built from an emoji, a Lagos slogan (or your own business) and a colour. There is no free text, so nobody can post phone numbers, scam links or abuse. Empty boards show public-service messages such as "Your bank will never ask for your OTP". The owner can fill clearly labelled sponsored slots.
- **Weekly Lagos:** each real-world week, everyone gets the same Lagos (one shared seed, with the same start and the same events) for a 4-week run. It has its own save slot, so your life is untouched. At the end you get your net worth and a Wordle-style row of squares to share, for example `Lasgidi Weekly 2026-W41 · ₦412,300 · 🟩🟩🟨🟥`. The weekly board ranks only finished runs that other players' browsers replay to the same result.
- **Birth lottery:** LAPO Baby (50%), Ajepako (35%) or Nepo Baby (15%). This sets your starting cash and home. A Nepo Baby's allowance ends after 8 weeks.
- **Goals:** Japa (IELTS plus ₦15m proof of funds), Landlord (own a house), Odogwu (top of a career) or Freestyle.
- **Needs:** Belle, energy, enjoyment, social, hygiene and calm. Neglect them and you end up in General Hospital.
- **Districts:** 12 in total. Ikeja, Ikorodu, Oshodi, Mushin, Festac, Surulere and Yaba are on the mainland. Lagos Island, Ikoyi, VI, Lekki and Ajah are on the Island.
- **Transport:** 8 modes. Keke cannot cross the bridges, BRT and the ferry run only between their stops, and okada carries task-force risk in the ban areas. Go-slow peaks 06–10 and 16–21.
- **Careers:** 9 careers × 5 levels, from Dispatch Rider to Logistics Boss and from Backup Singer to Afrobeats Giant.
- **Design your home:** buy 30 pieces of furniture and place, rotate or store them on a tile grid inside your home. Bigger homes are split into a bedroom, guest room, kitchen, living room and bathroom. Beds help sleep, solar and inverters help with light, and an AC or a pool table lifts your mood. Furniture moves house with you.
- **Garage, hangar and car dealers:** buy from 9 cars (tokunbo saloon to supercar and limousine), boats, a helicopter or a private jet, at the Berger car mart, at Lekki luxury motors, or from your home. **My garage** lists each vehicle, what the dealer would pay for it, and lets you pick which car you **Drive**. Cars set your own-car speed. Boats skip the ferry queue, a helicopter flies anywhere in Lagos, and the jet unlocks weekends in Dubai. Everything has weekly upkeep.
- **Your Lagosian and wardrobe:** pick a skin tone, hair and build, then dress in 27 outfits, from ankara and aso-oke to agbada, gele, office wear and gym kit. Dress codes matter: aso-ebi improves owambes, office wear improves banking and tech shifts, and club fits improve club nights.
- **Bank:** a wallet card (cash), Eko Reserve Bank savings at 0.3% a week, and 7-day treasury bills that pay 1% at maturity. Top up your wallet from savings. Quick amount chips go from ₦10,000 to ₦10m.
- **Money:** cash and bank, ajo, three kinds of loan, businesses that need your attention, property and a car. Every transaction shows as a bank alert and lands on a sealed statement.
- **Events:** grid collapse, fuel scarcity, floods, black tax, BVN scam texts, Ponzi schemes, landlord hikes, owambe aso-ebi, checkpoints and area boys. Detty December arrives in week 9.
- **Policy vote:** every 4 weeks you vote on a governorship policy that changes the rules for a month.
- **Advisor ("Wetin I go do?"):** up to three next moves, each one tap away. It tells you when to leave so you're on time, picks the cheapest ride that still arrives on time, warns when a shift would make you collapse, and suggests a gig when rent is due and you're short.
- **Sleep with alarm:** wakes you in time to commute to your next shift.
- **Weekly report card:** every Monday you see money in and out by category, the change in your net worth and a chart of it by week. A one-tap share text is ready for X or WhatsApp.
- **Every district has a hustle,** so a broke player is never stranded.
- **Love and family:** meet someone, keep the relationship alive with calls and dates around Lagos, pay the family introduction "list", then marry at the registry, at an owambe, or at a big Lagos wedding. A spouse pays half the rent. Children cost money every week, and school fees (public, private or international) come due each term.
- **Hall of lives:** ending a life scores it (net worth, weeks survived, achievements, career level and goal) and keeps your best runs on the start screen.
- **Sound (optional):** a bank-alert ding for money in, a low tone for money out, and a danfo horn when you travel.
- **Keyboard:** number keys switch tabs, and A runs the advisor's top suggestion.
- **Lagos online (inside claude.ai):** a shared **Hall of Fame** of everyone's best lives, plus live presence showing how many other players are online and which district they're in. There's no chat and no free text between players. Every life records its seed and every move, so other players' browsers **replay each entry move by move** and rank only lives that reproduce the same ledger seal and score. To fake a top score, you'd have to actually play it. Outside claude.ai, the game runs single-player as before.

## Layout

```
lasgidi/
  index.html            app shell
  src/data.js           content: districts, homes, careers, actions, NPCs, businesses
  src/engine.js         pure game engine (no DOM), shared by browser and tests
  src/playground.js     the isometric city view (canvas)
  src/ui.js             rendering and input
  src/styles.css        design tokens, light and dark themes
  sw.js, manifest.webmanifest, icon.svg   offline PWA
  tools/build-single.js bundle to one HTML file
  test/engine.test.js   node:test suite
  docs/REVIEW.md        Lagos Life deep review and the case against it
```

The engine is deterministic: all randomness comes from a seeded PRNG kept in the save. Each life also records the **rules version** it started under, so a life recorded under older rules replays identically after updates add new systems. `test/fixtures/v0.5-life.json` is a golden replay from the real v0.5 engine that every later version must still verify. Only `post()` can change cash or bank. That makes the engine ready to run on a server for a future multiplayer version (see the roadmap in the review).

## Disclaimer

Lasgidi is fiction and is not affiliated with Lagos Life or its developer. In-game naira has no real-world value and cannot be bought or cashed out. Place names refer to real Lagos districts. Businesses and people are invented.
