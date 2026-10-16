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

There is no build step to play. It is plain HTML, CSS and JavaScript, about 1.3 MB as source (around 420 KB gzipped), including 48 small icon images (64px WebP, about 2.4 KB each). Served over HTTPS (or from localhost), it installs as a PWA, caches everything on first load and then works offline.

`npm run build` writes the single-file version to `dist/lasgidi.html` (the one published as a claude.ai artifact). After `npm install` it is minified with terser: about 930 KB, or 350 KB gzipped. Without terser it still builds, just unminified. Only local variable names are shortened; globals and property names stay as written.

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

- **The playground:** an isometric Lagos drawn live on a canvas, with no 3D library. It shows the mainland, the Lagoon, the Island strip to Ajah, the harbour and the Atlantic.
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
- **Key places:** 56 real Lagos landmarks and venues on the map as emoji badges, colour-coded by category. They include the New Afrika Shrine, the Surulere amala joint, the Yaba tech hub, the Lekki shopping mall, Elegushi beach, the Adeola Odeku club strip, the Ikeja cinema, the National Theatre, Freedom Park, the National Museum, Ndubuisi Kanu and Muri Okunola parks, Bar Beach and Lekki beach, the Lekki Conservation Centre, Balogun and Tejuosho markets, Computer Village, UNILAG, General Hospital, the jetties and the airport. Filter them by category, and tap one to see its hours, prices and activities. You can do them on the spot, or plan a trip there.
- **Billboards:** 10 ad boards at high-traffic spots, from the Third Mainland Bridge to the Lekki toll gate. Rent one for 1, 3 or 7 real days, paid in in-game naira. Busier boards cost more (Third Mainland Bridge costs ×1.8, Festac ×0.8), and longer runs are cheaper per day. Tick **Subscribe** and the ad renews itself the next time you open the game after it ends. Your ad rotates with up to 2 others.
  - **Picture ads:** you can also upload your own picture: a flyer, a product or your business. The game crops it to the board's shape and re-encodes it in your browser. Every player's picture waits for the owner's approval, and you pay only once it is approved. Editors can approve pictures, or post one straight away as a sponsored ad. Ads are built from an emoji, a Lagos slogan (or your own business) and a colour. There is no free text, so nobody can post phone numbers, scam links or abuse. Empty boards show public-service messages such as "Your bank will never ask for your OTP". The owner can fill clearly labelled sponsored slots.
- **Daily gem hunt:** each real-world day hides the same five gems for everyone, at places around Lagos, shown as blue pins on the map. Go to the place and pick a gem up. Prizes grow through the day, from ₦3,000 to ₦20,000. You can hunt one day's gems per game day, so you can't farm old dates.
- **Weekly Lagos:** each real-world week, everyone gets the same Lagos (one shared seed, with the same start and the same events) for a 4-week run. It has its own save slot, so your life is untouched. At the end you get your net worth and a Wordle-style row of squares to share, for example `Lasgidi Weekly 2026-W41 · ₦412,300 · 🟩🟩🟨🟥`. The weekly board ranks only finished runs that other players' browsers replay to the same result.
- **Birth lottery:** LAPO Baby (50%), Ajepako (35%) or Nepo Baby (15%). This sets your starting cash and home. A Nepo Baby's allowance ends after 8 weeks.
- **Goals:** Japa (IELTS plus ₦15m proof of funds), Landlord (own a house), Odogwu (top of a career) or Freestyle.
- **Needs:** Belle, energy, enjoyment, social, hygiene and calm. Neglect them and you end up in General Hospital.
- **What's on:** a Phone app listing the festivals, concerts and matches across the three cities, each a real action at its venue:
  - Felabration at the Shrine in October;
  - Saturday Super Eagles matches at the National Stadium;
  - Detty December concerts at Elegushi and on the beach;
  - the Eyo procession in January;
  - the Abuja Carnival in November;
  - the Port Harcourt carnival in December.
- **HUD:** your Lagosian's face beside the six need bars. Tap it to open your wardrobe.
- **Stocks:** a 📈 Stocks app on the phone, an exchange with eight fictional companies, among them Eko Cement, Lagoon Bank, Delta Oil & Gas and Jollof Tech.
  - Prices follow a daily random walk seeded by your life, with a market-wide swing shared by all the companies.
  - You can trade 10:00–14:30 on weekdays. Every buy and sale costs a 1.5% broker fee, with a ₦500 minimum.
  - Some companies pay a dividend every 13 weeks.
  - Prices can fall, and a retail account is capped at ₦20m invested.
- **Chieftaincy:** an endgame status ladder on the Me tab, taken in order:

  | Title | Cost | Net worth needed |
  |---|---|---|
  | Baale | ₦2m | ₦20m |
  | Chief | ₦15m | ₦150m |
  | Otunba | ₦80m | ₦800m |
  | Aare | ₦400m | ₦4bn |

  A title earns nothing, but it adds status and goes in front of your name, on the Me tab, in My story and in your share text.
- **Creator:** a 📸 Creator phone app.
  - **Followers:** every post adds followers, from shooting content at Lekki beach or a new "Film a skit at home" action. Charisma, your phone's camera, a club or owambe outfit and your existing reach all help, and a viral post brings thousands at once.
  - **Phones:** budget, mid-range, flagship or "Pro Max", with a 30% trade-in on upgrades and no downgrades for cash.
  - **Brand deals:** from 2,000 followers you earn weekly brand deals of ₦1,200 per thousand followers (rules 9), as long as you post that week. A quiet week loses 3% of your followers.
- **My story:** a 📖 phone app with your life at a glance. It shows lifetime totals (earned, spent, trips, shifts, gems, festivals, online sales, shares, vehicles, pets, staff), a timeline of every milestone with its week and day, and the share card.
- **Weather (rules 9, new lives only):** each life has its own seeded sky.
  - **Rainy season:** April to October, peaking in June and July, with a break in August. Rain falls from about 11:00 to 18:00.
  - **Rain:** roads are about 35% slower, trekking is harder, and you arrive soaked (−hygiene, +stress) on foot, okada, keke, danfo, BRT or ferry unless you wear an umbrella.
  - **Storms:** roads are about 70% slower, okadas and kekes park, and boats stop sailing.
  - **Harmattan:** dust and haze in December and January.
  - **On screen:** the map shows rain streaks or a haze, and the 🌦️ Weather phone app has a 7-day forecast.
  - Lives started under rules 5–8 keep a clear sky and replay unchanged.
- **Online shop:** a 🛍️ Shop app on the phone. Pick a niche: okrika thrift clothes, phone accessories, hair and wigs, or small chops trays.
  - Buy stock wholesale, up to 500 at a time.
  - Pick a weekly ad plan, from none through a chat-app status post and a social media boost to an influencer shout-out.
  - Sales land every week. The app takes 5%, dispatch riders cost ₦500 an order, and about 6% of orders come back.
  - Unsold small chops spoil each week.
  - The shop shows next week's expected profit once the stock is paid for. Over-spending on ads loses money.
- **Ride-hailing:** if you own a car, a keke or a bike, a "Drive ride-hail" action appears anywhere you are.
  - The app keeps 25% of the fares, and you pay for your own fuel.
  - Rush hour brings more trips, and night fares are higher.
  - Luxury cars earn premium fares but burn so much fuel that a supercar usually loses money.
- **🗳️ Town Hall:** one Lagos question each real-world week, voted on by every player, with a live tally. Examples: okadas on the bridges, the next BRT line, free WiFi in danfo parks. You can change your vote until the week ends. It is social only and never touches money.
- **Settings (Me tab):**
  - **🗣️ Naija Pidgin:** tabs, app names, headings and buttons, such as "Wetin dey", "Owo", "Mission", "Work wey dey" and "Buy am".
  - **🔠 Large text.**
  - **🪶 Lite mode:** fewer animations and no moving traffic, for cheap phones.
- **Interactive map:** zoom with the mouse wheel, by pinching, or by double-tapping, up to 6×. Drag to pan. The ⛶ button enlarges the map to full screen (Esc or ✕ to exit), and **+**/**-** zoom when the map has focus.
- **🌊 Sea Plots:** a grid of 1,152 plots in the Atlantic below Victoria Island and Lekki, shared by every player, like a million-naira homepage.
  - **Buying:** tap a spot (or the 🌊 Sea Plots chip) and pick a block size, up to 12×12. A block costs ₦5,000 a plot. Moving or enlarging charges only for the extra plots.
  - **Pictures:** upload a picture for your block. An editor approves it first, then it shows on the water for everyone.
  - **Claims:** the oldest claim wins any overlap. Tap someone's block to see who owns it, their picture, and a link to visit their home. A "Biggest blocks" list ranks the largest owners.
- **🎖️ NYSC:** the service year after your UNILAG degree, run from a Phone app.
  - **Register:** a ₦5k call-up letter gives you a posting, fixed by your life's seed, to one of six PPAs. They range from a secondary school in Ikorodu (no stipend) to an oil services firm in Port Harcourt.
  - **Camp:** three camp days at the orientation camp in Kubwa, Abuja (the gate is open 05:00–20:00). Each day has drills, lectures and Mammy market, then a night in the camp hostel. The swearing-in gives you the NYSC khaki, which is free and never sold.
  - **Service:** 12 weeks. Weekdays at your PPA pay its small daily stipend, and CDS meets on Thursdays (10:00–14:00) in your posting city.
  - **Allawee:** ₦77k every 4 weeks, but only if you signed the CDS register at least 3 times that month. Passing out unlocks "Corper wee!".
  - **Retention:** the bank, oil firm, tech hub and ministry retain corpers who worked at least 20 PPA days there. You get a level-0 job offer to accept within 14 days.
- **🛏️ Somewhere to sleep:** away from your home district, the Do tab lists beds for the night.
  - **Tiers:** a guest house (₦8k, in budget areas, on NEPA light only), a hotel room (₦35k, with a generator), a short-let apartment (₦90k, Lagos and Abuja only) and a five-star hotel (₦180k, with breakfast; VI, Ikoyi, Maitama, Asokoro and PH GRA only).
  - **Waking up:** you wake at 06:30.
  - **Advisor:** if you are stranded in another city late at night or exhausted, it suggests the cheapest bed you can pay for.
- **Japa:** the life's ending, at Murtala Muhammed Airport's international departures.
  - **Requirements:** pass IELTS, have ₦15m proof of funds plus the visa and ticket, and owe no debts.
  - **Destinations:** Toronto, London, Houston or Dubai.
  - **What happens:** boarding the flight completes the life (and the Japa goal). You get an ending screen with a share card, and can post the life to the Hall of Fame and start a new one. The finished life is frozen, and nothing more is recorded.
- **Haggling at Balogun:** at Balogun market (Lagos Island, Monday to Saturday, 08:00–18:00), every item in the clothes shop has a **Haggle** button.
  - The trader opens at 130% of the shop price and has a secret last price, 70–95% of it, that changes daily and drops a little for a good hustler.
  - Offer low and they counter ("Customer, add small!").
  - You get three offers per item a day. Accept the right one and you pay less than the shop price.
- **How the mini-games pay (rules 10, new lives):** you pay for a game when you press Play. The entry, the tray, the owner's returns and fuel, the time and the effort are all spent up front, so quitting a bad run forfeits it and every try is a fresh run. Collecting at the end only pays out. Lives begun on rules 9 or earlier keep paying on collect. All five games run in one overlay: Esc quits (it asks first), focus stays inside it, and screen readers hear the score and the result. Lite mode keeps the lights steady and turns off the screen shake.
- **Go-slow hawker (mini-game):** at Oshodi market, 06:00–21:00. A 45-second shift in the go-slow under the bridge.
  - **Selling:** when a driver raises a hand for 💧 water, 🌭 gala, 📱 airtime or 🍌 plantain chips, pick the item (or press 1–4) and tap the car before the light turns green.
  - **Task force:** hold 🙈 HIDE when the task force van comes, or they seize your goods.
  - **Pay:** the tray of 30 items costs ₦4k, and sales are capped at ₦10k, so a perfect shift nets about ₦3k.
- **Naija Quiz (mini-game, Abuja):** on the Millennium Park stage, Friday to Sunday from 15:00, once a game day.
  - **Questions:** ten, 12 seconds each, drawn from 24 on Nigeria (Zuma Rock, Eyo, Felabration, Garden City…) and on how life in Lasgidi works.
  - **Prizes:** these start at 5 right and rise to ₦8k for a perfect 10, which also unlocks "Quiz champion".
- **Bole grill (mini-game, Port Harcourt):** at the Old GRA bole and fish spot, 11:00–22:00.
  - **Grilling:** pick plantain, fish or yam and lay it on the grill, then serve it to whoever ordered it while it's golden. Leave it too long and it burns.
  - **Pay:** Mama keeps half the takings and charges for anything burnt. Your share is capped at ₦9k.
- **Owambe dance-off (mini-game):** on Saturdays at the Surulere event hall. A 40-second rhythm game: notes fall in four lanes to a 112-bpm beat, and you tap the lane (or press ←↓↑→ / D F J K) as each one hits the line.
  - **Spraying:** every 10 in a row brings guests out to spray money across the screen.
  - **Pay:** the ₦3k entry buys a spray scaled by your accuracy, capped at ₦4k, with a bonus for an owambe outfit.
  - **Achievement:** 90% on the beat unlocks "Dance-off champion".
- **Danfo Run (mini-game):** rent a danfo at the new Ojuelegba danfo park (Surulere) and drive a 90-second arcade run in the spirit of the viral *Lagos Run*.
  - **Driving:** change lanes with ◀ ▶ or a swipe, and hold BRAKE at a 🚏 in the left lane to drop passengers and load new ones while the conductor shouts the route.
  - **Hazards:** dodge potholes, okadas and cars, and never stop in a yellow LASTMA zone.
  - **Pay:** the result becomes a shift's pay, minus ₦4k owner's returns, fuel, and any fines or settlements. Takings are capped at ₦12k, so a skilled run nets a few thousand naira and a careless one loses money.
  - Serving 50 passengers unlocks "Agbero approved". My story shows your best run and total passengers, and there is a "Drive a Danfo Run" starter quest.
  - **Own a danfo:** buy a ₦18m danfo bus from the dealers (Commercial tab). Your own runs then pay no owner's returns. Or hire a driver and it brings weekly returns, with an 8% chance of a crash repair bill and a 5% chance the driver "travels to the village" with the money.
- **Airports:** Lagos, Abuja and Port Harcourt airports each have a **premium lounge** (shower, buffet and quiet: big boosts to hygiene, hunger and stress), **plane-spotting** at the apron window, and a **🛫 Departures** board with three tabs:
  - **Air:** pick a city (LOS, ABV, PHC) and a cabin: Economy, Premium Economy (×1.8), Business (×4) or First Class (×9). Fares cost ×1.5 in the 6–9am rush. A cab to the airport is included when you book from elsewhere in the city. Optional travel insurance costs 6% of the fare; without it, a lost bag (8% chance) costs you ₦25k. A boarding pass shows every line, the total and your wallet before you book. Better cabins arrive fed and rested; First Class unlocks an achievement.
  - **My jet:** your private hangar lists your jets. Flying one costs ₦5m in fuel and crew. No jet? Charter one for ₦12m a trip.
  - **Chopper:** search any place in any city and land at the door: ₦1.5m within a city, ₦4m between cities.
  - **🛬 Live airport view:** an animated scene with:
    - the runway (09/27), with a plane landing and another taking off;
    - five gates with airliners on the apron;
    - a private-jet apron, two helipads with parked choppers, the hangar, fuel tanks and the control tower;
    - the terminal, car parks full of cars, traffic moving round the kerb and the access road, an airport bus, and passengers walking in.
    - **Boards:** Departures and Arrivals (fictional airlines, a flight about every 25 minutes, with statuses from the game clock).
    - **Taps:** the gates open Air booking, the jets open My jet, the helipads open Chopper.
    - **Photo:** the 📷 button snaps the scene.
  - The map shows the private-jet hangar and a helipad at the east end of the Ikeja runway. All three are new recorded moves, so older lives replay unchanged.
- **Now passing:** after each trip, a note names the landmarks you passed on the way. On the map, your danfo, cab, keke, okada, car, boat or helicopter rides from district to district ("On the way to Lekki…").
- **House parties with real players:** when you host, you can add an **event decorator** for half the party's cost again. It turns the house festive, and guests spray 25% more.
  - For 30 real minutes, Lagosians online get a 💌 **party invite** on their Do tab.
  - **Guests:** they walk into your home and see the decorations and a live guest count. Guest faces line the party bar. They can **🔔 Ring bell** (you get a toast), **💃 Dance** or **🥂 Socialise**.
  - **Mood only:** guest actions only lift mood. No money moves between lives.
  - **Host:** a banner on your Do tab shows how many guests are in.
  - **Weddings:** getting married opens a 💍 wedding reception the same way. An owambe or big wedding comes decorated.
- **Domestic staff:** hire a house help, a cook, a driver (you need a car) or a gateman from the Home tab.
  - Each helps every day: fresh hygiene, a ready breakfast, rest instead of driving yourself, or easier sleep.
  - Each costs a weekly salary, from ₦30k to ₦60k. Staff you can't pay pack up and leave.
  - How many you can have depends on your home: none in a room or flat share, 1 in a self-con, up to 4 in a duplex or a mansion.
- **Pets:** a cat, an African grey parrot, a dog or a Boerboel guard dog, up to 3. Each gives a small boost to fun or stress every day and costs food and vet bills every week. Dogs need a compound, which a 2-bedroom flat or bigger has. A pet you can't feed goes to a neighbour.
- **Health plan (HMO):**
  - Basic: ₦2k a week. It covers the hospital bill when you collapse, and check-ups are half price.
  - Premium: ₦7k a week. It also gets you a private ward, with a shorter and calmer stay, and free check-ups.
  - If a premium bounces, the plan lapses.
- **Host a party:** on Saturdays, from the Home tab. Choose small chops and drinks (25 guests), a full owambe (120 guests, which needs a 2-bedroom flat) or a society party (400 guests, which needs a duplex). Guests spray more money for a well-dressed, well-connected host, but a party never pays for itself. Your friends remember it, and you can host once every 4 weeks.
- **Daily streak:** claim a reward each real day you come back, from ₦1,000 on day 1 up to ₦10,000 on day 7. Miss a day and it starts again. You can claim once per game day, and there is no streak in Weekly Lagos.
- **Quests:** starter goals as chips over the map, such as "Get a job", "Daily gem hunt", "Sleep like Oba" and "Visit another city". Each pays once (₦1,500 to ₦20,000). A quest that's ready to claim shows first; tap an unfinished one to jump to the right screen. All of them are listed in the Quests phone app.
- **Faces on the map:** your Lagosian's face sits over your district pin. Other players in the same city show as small faces beside their pins.
- **City boards:** the Hall of Fame filters to All Nigeria, Lagos, Abuja or Port Harcourt by where each life lived. It also names the richest verified player in your district.
- **First-run tour:** four short tips inline on the Do tab. It never blocks a tap, and you can skip it.
- **Phone:** a 📱 Phone tab with a ❓ Guide (how to play, with a button to each feature), and apps for Messages (with an unread count), Quests, Jobs, Bank, Stocks, Shop, Creator, Games, Dealers, the Gem hunt, Travel, the Hall of Fame and your Wardrobe.
- **Cities:** Lagos, Abuja and Port Harcourt, each with its own map, districts, landmarks, homes and jobs.
  - **Abuja:** Aso Rock, Millennium Park, Jabi Lake, Wuse Market and Eagle Square, plus the civil service and consulting careers.
  - **Port Harcourt:** Uniport, Pleasure Park, Mile 1 market, the waterfront and the Trans-Amadi yards, plus oil-services jobs.
  - **Getting there:** fly from the airport (about ₦150k, or free in your own jet) or take the long-distance bus from the motor park. The bus is cheaper, takes 11 to 12 hours, and doesn't run at night.
- **Districts:** 12 in Lagos. Ikeja, Ikorodu, Oshodi, Mushin, Festac, Surulere and Yaba are on the mainland. Lagos Island, Ikoyi, VI, Lekki and Ajah are on the Island.
- **Transport:** 9 modes, including the **🚆 Lagos rail**: the Blue Line (Lagos Island, Surulere, Mile 2/Festac) and the Red Line (Ikeja, Oshodi, Mushin, Yaba). Trains run 06:00–21:00 at a flat ₦750, with no go-slow and no rain. Both lines are drawn on the map. Keke cannot cross the bridges, BRT and the ferry run only between their stops, and okada carries task-force risk in the ban areas. Go-slow peaks 06–10 and 16–21.
- **Careers:** 9 careers × 5 levels, from Dispatch Rider to Logistics Boss and from Backup Singer to Afrobeats Giant.
- **Design your home:** buy 30 pieces of furniture and place, rotate or store them on a tile grid inside your home. Bigger homes are split into a bedroom, guest room, kitchen, living room and bathroom. Beds help sleep, solar and inverters help with light, and an AC or a pool table lifts your mood. Furniture moves house with you.
- **Garage, hangar and car dealers:** buy from 9 cars (tokunbo saloon to supercar and limousine), 6 boats (from a ₦15m jet ski to a houseboat and a ₦25bn superyacht), a helicopter, or 4 jets (from a light jet to a ₦150bn VIP airliner). My garage groups them into a Garage, a Marina and a Hangar, each with its weekly upkeep and resale value. A boat unlocks a private-island day from the Lekki VIP jetty, and a houseboat moored by an Island home helps you sleep; at the Berger car mart, at Lekki luxury motors, or from your home. **My garage** lists each vehicle, what the dealer would pay for it, and lets you pick which car you **Drive**. Cars set your own-car speed. Boats skip the ferry queue, a helicopter flies anywhere in Lagos, and the jet unlocks weekends in Dubai. Everything has weekly upkeep.
- **Your Lagosian and wardrobe:** pick a skin tone, hair and build, then dress in 27 outfits, from ankara and aso-oke to agbada, gele, office wear and gym kit. Dress codes matter: aso-ebi improves owambes, office wear improves banking and tech shifts, and club fits improve club nights.
- **Build businesses:** pick a site in any of the 12 districts. Lekki and VI pay the most but charge the most shop rent. Each business grows through 3 levels, for example Buka → Restaurant → Restaurant chain, or Danfo bus → Danfo fleet → Transport company. Hire a manager for a weekly salary and a 10% cut, and you no longer need weekly visits to stop the staff stealing. Your businesses show on the map as emoji pins.
- **Bank:** a wallet card (cash), Eko Reserve Bank savings at 0.3% a week, and 7-day treasury bills that pay 1% at maturity. Top up your wallet from savings. Quick amount chips go from ₦10,000 to ₦10m.
- **Money:** cash and bank, ajo, three kinds of loan, businesses that need your attention, property and a car. Every transaction shows as a bank alert and lands on a sealed statement.
- **Events:** grid collapse, fuel scarcity, floods, black tax, BVN scam texts, Ponzi schemes, landlord hikes, owambe aso-ebi, checkpoints and area boys. Detty December arrives in week 9.
- **Policy vote:** every 4 weeks you vote on a governorship policy that changes the rules for a month.
- **CBN governor race:** two weeks after each policy vote, three candidates compete for the Central Bank, and you can vote for one. The Hawk raises savings and bill rates, makes new loans dearer and slows inflation. The Dove does the opposite. The Builder boosts businesses and cooperative loans. The winner's stance lasts 4 weeks, and its rates show on the bank card.
- **Making money is hard.** New lives start on rules 11: everything in rules 8, plus weather (rules 9), mini-games paid for at the start (rules 10), malaria (rules 11) car wear (rules 12), job interviews (rules 13), the full Detty December (rules 14) and once-a-day live-room limits that survive leaving and re-entering (rules 15).
- **Turn your home:** the home designer has ⟲ ⟳ buttons that turn the room in 90° steps, so you can place furniture from any side. The two walls drawn are always the far ones, the driveway turns with the room, and taps and drags land on the tile under your finger in every view. Your choice is remembered.
- **Spin, spread and zoom:** the land is drawn twice as big while buildings, trees and pins keep their size, so places stand well apart (distances, fares and travel times in the game are unchanged). Turn the city to any angle: twist with two fingers, Shift-drag or right-drag with a mouse, or tap ⟲ ⟳ (or press Q and E) for a smooth 90° turn. Buildings, shoreline cliffs and draw order follow the angle, and it is remembered. The map opens zoomed in at 4× and zooms to 24×.
- **Map pop-ups:** the map fills the window. A 📋 Do here button on the map opens "Wetin I go do?" and everything you can do in the district, and tapping any pin (a place, a home or a billboard) opens its card as a pop-up over the map, with its activities and buttons. ✕ closes it. Both work in full screen too.
- **More to do in Abuja and Port Harcourt:** seven new careers (Abuja: market trading in Wuse, ministry driving in Garki, hospitality in Maitama; PH: port work in Borokiri, the fishing cooperative in D-Line, hospitality in GRA, and teaching in Choba, which needs a degree and an interview), six more homes (a Kubwa room and parlour, a Garki flat, a mini flat by Jabi Lake, a Choba student room, a D-Line flat and an Old GRA bungalow), and business sites in Wuse, Garki, Kubwa, GRA, D-Line and Rumuokoro, so you can open a business outside Lagos. Pay sits at or below the Lagos equivalents.
- **Rules 16 (an audit of older features):** a stock buy over the ₦20m cap is refused before any money moves; firing a manager no longer counts as a business visit, and hiring one pays the first part-week; a loan repaid inside its first week still pays one week's interest; each tournament can be entered once a day and the bole, hawking and danfo games pay twice a day; gem hunts can't go back to earlier dates; re-boarding the cruise the same day gives no fresh boost; a gift must have a real sender key, opening one takes 10 minutes, and only your first two gifts sent each day lift your mood; and quitting and re-applying for a job keeps today's shift and your missed-shift strikes. Lives begun under rules 15 or earlier replay as they were played.
  New lives start on rules 16. Lives begun under rules 7 keep their rules 7 numbers: PAYE income tax comes off every shift. The first ₦4,000 is free, the next ₦16,000 is taxed at 10%, and anything above at 20%. Gigs pay 15% less, and state and council levies take 12% of business payouts. Each tax is a separate line on your statement. Rules 8 makes this steeper:
  - PAYE starts at ₦3,000 and goes up to 25% on big pay.
  - Every 4 weeks the landlord reviews your rent in line with prices.
  - Vehicle upkeep is 1.5×, and vehicles costing over ₦100m pay 0.2% insurance a week.
  - Promotions take 30% more shifts.

  Lives started earlier keep their old rules.
- **🎉 Detty December:** the city goes into full party mode from the start of December to New Year's Eve.
  - **On the Do tab:** a season card says which phase you're in (warm-up, build-up, Christmas week, the New Year countdown) and what's on right now.
  - **Concerts:**
    - a headline Afrobeats concert at Eko Convention Centre, with a ₦450k VIP table with bottle service;
    - a homecoming concert at Tafawa Balewa Square.
  - **Beach and water:** a day-into-night beach rave on the Ajah coast, lagoon boat cruises and yacht parties.
  - **Parties and food:** rooftop pool parties every night, after-parties till 5 a.m., December wedding owambes and a food village of jollof, suya, ofada and small chops.
  - **New Year's Eve:** fireworks at the Lekki–Ikoyi Link Bridge, on the last night only.
  - **Rules 14, new lives only:**
    - "December rates": Lagos hotels and short-lets cost 60% more, on top of the 15% December rise in every price.
    - Traffic is heavier, gigs pay 20% more, and creators gain 50% more followers.
    - IJGB relatives turn up from Houston, London or Toronto and want to "see the real Lagos". Show them around and they may leave you dollars.
    - Six December events in one season unlocks "Detty legend".
- **🌴 Island life all year (VI, Oniru, Ikoyi, Lekki):**
  - **Clubs:** club nights after midnight (Amapiano till 5 a.m.), money spraying with bottle service, and car-meet flexing outside the club. Flexing needs a car worth ₦40m or more and gets creators followers.
  - **Days out:** brunch and day drinks; the Oniru beach club with cabanas, a seafood grill and jet skis; boat day trips to Ilashe.
  - **Lekki:** shisha lounges, rooftop DJ sessions, and a glam studio. Getting "outside" ready with hair, make-up and nails makes your next night out or owambe land better.
  - **Food and markets:** late-night suya, pepper soup and asun, and a fashion pop-up and art market.
  - **Area boys (rules 14):** they collect "ground money" when you drive to busy spots such as Oshodi, the Island, VI, Lekki, Surulere and Ikeja.
- **🎬 Skits and 🔴 live streaming (Phone → Creator):**
  - **Skits:** pick a theme: area boys and agberos, "outside" culture, family wahala, relationships, hustle and NEPA, or Detty December in December.
    - One theme trends each week and doubles followers.
    - Filming in the right place helps (×1.4): the Island for "outside", Oshodi for hustle.
  - **Going live:** viewers and gifts grow with your followers. Prime time is 20:00–01:00, and December crowds are bigger.
    - Data costs ₦1.5k a stream, and gifts are capped.
    - At home, NEPA drops the stream unless you have an inverter or solar.
    - 1,000 viewers unlocks "Streamer".
  - **Appearances:** from 20k followers, VI promoters pay for club appearances.
- **🗺️ Sightseeing (Phone → Sightseeing):** the tourist sights, grouped by area so you can plan around the traffic.
  - **Lekki and the coast:** Lekki Conservation Centre, the Lekki art gallery, the Lekki Arts and Crafts Market, Elegushi beach and Eleko beach.
  - **The Island:** Freedom Park, the National Museum and the J. Randle Centre (Onikan), Balogun market, Tarkwa Bay by boat, the Oniru beach club and the VI arts centre.
  - **The Mainland and beyond:** the New Afrika Shrine and the Kalakuta Republic Museum, JJT Park, Giwa Gardens water park, a respectful canoe tour of Makoko, and a day trip to Badagry (the Point of No Return).
  - **Explorer:** visiting 8 sights unlocks "Lagos explorer" (rules 14).
- **🏅 Sports (Phone → Sports):** 23 sports where Lagos plays them.
  - **Most popular:** football from street and five-a-side to NPFL matches, basketball, athletics, table tennis, tennis, volleyball and handball, and boxing.
  - **Widely played:** swimming, cricket, badminton, beach volleyball, and wrestling with judo and weightlifting.
  - **Traditional:** ayo olopon, ludo and draughts, chess and Scrabble.
  - **Emerging:** flag football, polo, golf, e-sports, snooker, cycling, arm wrestling and darts.
  - **Tournaments:** five-a-side, a FIFA e-sports cup, Scrabble and arm wrestling pay capped prizes if your skill wins. Eight different sports unlocks "All-rounder".
- **🗣️ Lagos labels:** the Me tab shows what Lagos calls you, and the Guide explains each label.
  - **Your labels:** from your background and play: LAPO baby, Ajepako, NEPO baby, Ajebo/Ajebutter, JJC for newcomers, "area boy" street-smarts, and Omo ile for heirs.
  - **Your children:** each child carries a label too (Butty, Ajebo, Ajepako, Omo ile).
- **🏪 Businesses by tier:** 25 businesses to build, ranked as Lagos ranks them.
  - **Entry level:** POS, recharge and data, small chops, a market stall, phone repair, laundry, okadas on hire purchase.
  - **Mid-range:** buka, barber, car wash, beauty salon, mini importation, owambe catering, delivery riders, a private school (term days only), building materials.
  - **High income:** event centre, short-lets, a digital and fintech agency, import/export wholesale, luxury car rental, haulage, a VI nightclub share, oil and gas supply.
  - **December:** it lifts hospitality, events, transport and luxury (car rental ×2.5).
- **🏗️ Build your own house:** own the plot of land in Ikorodu and you can build on it from the Money tab, one stage at a time.
  - **The omo-onile:** before the foundation, they come to "greet" the land and you pay their ₦250k development levy.
  - **Five stages:** foundation, blocks to lintel level, roofing, plastering with windows and doors, then finishing. They cost ₦12.5m in all and take about five and a half weeks, and you must visit the site in Ikorodu to start each one.
  - **When it's finished:** the plot becomes your house and unlocks "Builder". Move in for no rent ever, or let tenants pay you ₦70k a week while you live elsewhere.
- **🎤 Job interviews (rules 13, new lives only):** Banking, the Civil Service and Consulting interview before they hire.
  - **The questions:** three a day per career, taken from the life's seed with the answer order shuffled. The engine marks your answers, so a result can't be faked.
  - **Passing:** two right gets the job, or one if your Charisma is 4 or more. Fail and they "get back to you" in 3 days.
  - **Who skips it:** a connect (a friend at 60+ who works there) gets you in without an interview, and so does an NYSC retention offer.
- **🔧 Car wear and Ladipo (rules 12, new lives only):**
  - **Wear:** every kilometre you drive wears your car. Each trip in a worn car risks a breakdown, which costs 90 minutes, a roadside mechanic and stress.
  - **Which cars:** cheap cars break down more often than luxury SUVs.
  - **Servicing:** the garage shows each car's wear and risk. A service at Ladipo auto market in Mushin (Monday to Saturday, 08:00–18:00) resets the wear on all your cars.
- **👪 The next generation:** when you end a life that has children, the start screen lists every child. Choose who carries the family on.
  - **Inheritance:** the heir gets their share of the estate, which is net worth after debts, minus 10% for estate costs, divided among the children. It is capped at ₦50m, and the size of the share decides where they start living.
  - **Schooling:** an international school counts as a degree, private school gives Charisma, and straight-A report cards give Tech. A close bond means they start calm.
  - **Dynasty:** each heir carries the family line and its generation number.
    - My story shows a 🌳 family tree.
    - The Hall of Fame and your past lives show a "Gen N" chip.
    - The third generation unlocks "Dynasty".
  - **Fair ranking:** heir lives replay like any other. The Hall of Fame checks their wealth against what they inherited, and forged inheritances are refused.
- **🦟 Malaria (rules 11, new lives only):**
  - **Catching it:** a night without light (so no fan or AC) and no mosquito net can give you malaria. It is likelier in the rainy season. A ₦6k mosquito net from the furniture shop, a running fan or AC, or a hotel with a generator keeps most mosquitoes off.
  - **Being sick:** the fever drains energy and enjoyment, raises stress and lowers your work performance. After three untreated days it gets worse.
  - **Treatment:** antimalarials from a chemist (₦4.5k, or ₦2k with an HMO, 07:00–21:00) cure it in two days.
  - **Collapsing:** if you collapse, the hospital treats it for ₦15k.
- **Children (Me tab):** each child has a name and a bond with you.
  - **Homework:** help on school nights (Monday to Friday, 17:00–21:00, at home).
  - **Outings:** take them out at weekends (₦5k, once a week).
  - **Report cards:** once you get involved, a report card arrives every term. The grade follows the school, the homework and your bond. An A unlocks "Straight A"; an F means the teacher wants to see you.
- **Advisor ("Wetin I go do?"):** up to three next moves, each one tap away. It tells you when to leave so you're on time, picks the cheapest ride that still arrives on time, warns when a shift would make you collapse, and suggests a gig when rent is due and you're short.
- **Sleep with alarm:** wakes you in time to commute to your next shift.
- **Weekly report card:** every Monday you see money in and out by category, the change in your net worth and a chart of it by week. A one-tap share text is ready for X or WhatsApp.
- **Every district has a hustle,** so a broke player is never stranded.
- **Love and family:** meet someone, keep the relationship alive with calls and dates around Lagos, pay the family introduction "list", then marry at the registry, at an owambe, or at a big Lagos wedding. A spouse pays half the rent. Children cost money every week, and school fees (public, private or international) come due each term.
- **Hall of lives:** ending a life scores it (net worth, weeks survived, achievements, career level and goal) and keeps your best runs on the start screen.
- **Sound (optional):** a bank-alert ding for money in, a low tone for money out, and a danfo horn when you travel.
- **Keyboard:** number keys switch tabs, and A runs the advisor's top suggestion.
- **Multiplayer life:** see the other players in your district.
  - **Wave:** a wave is fixed text, never free text.
  - **@usernames on the map:** every online player in your city stands on the map as a small figure with their face and an **@handle** floating over their head. Yours is highlighted. A red dot marks unread messages. Under each handle, a short label says what they're up to (at work, at the beach, partying, at the club, eating out, shopping, working out, sightseeing, on the move, at home). The label is a code from a fixed list, set from your last activity and checked on arrival, so it's never free text.
  - **Chat:** tap a player (on the map, or 💬 Chat in "Lagosians here") to open their card: who they are, where they are, Wave, Visit, Go to them, Mute, and a chat with quick replies. Messages are checked before sending and **again on arrival** (`src/chat.js`, tested in `test/chat.test.js`). No sexual content, no insults or slurs (English, Pidgin and Yoruba, including disguised spellings), no links, emails or phone numbers, at most 140 characters, and a send limit. Chat lives only in the room while you're online: nothing is stored, and muting is remembered on your device.
  - **Visit:** visit their home read-only. You see their furniture and garage, checked against the game's own data before it's drawn.
  - **Gifts:** send a gift such as suya, flowers, a cake or aso-ebi fabric. Gifts lift the receiver's mood but never move money, so a second account can't feed cash into a Hall of Fame life.
- **Lagos online (inside claude.ai):** a shared **Hall of Fame** of everyone's best lives, plus live presence showing how many other players are online and which district they're in. Player chat is filtered and never stored (see Multiplayer life). Every life records its seed and every move, so other players' browsers **replay each entry move by move** and rank only lives that reproduce the same ledger seal and score. To fake a top score, you'd have to actually play it. Outside claude.ai, the game runs single-player as before.

- **Profile photos:** add a photo of yourself on the Me tab so other players can recognise you on the map, in their district and in the Hall of Fame. An editor approves each photo before anyone else sees it, and you can hide yours at any time.
- **Prime homes:** buy a home in Lagos's top addresses: a detached duplex in Nicon Town (Lekki Phase 1) for ₦250m, a luxury apartment in Victoria Island for ₦400m, a penthouse in Eko Atlantic for ₦900m, a mansion in Parkview, Ikoyi for ₦1.5bn, or a waterfront mansion on Banana Island for ₦4bn. You can live in it or let it out, and either way you pay a weekly estate service charge. Each one adds status, and Banana Island unlocks an achievement.
- **White wedding:** plan it from Love and family once the families have met.
  - **Choices:** a venue (a Yaba community hall up to the Eko Atlantic grand hall, 200 to 1,500 guests), a planner, aso-ebi, vendors priced per guest (catering, photo and video, DJ, MC, makeup and gele), a colour theme, hall decoration (simple, elegant or grand), extras (floral arch, cold sparks, photo booth, drone, live band, fireworks) and an after-party (lounge, beach or yacht).
  - **Preview:** a live drawing shows the hall in your colours, with drapes and fairy lights, chandeliers, the flower-wall stage, tables and centrepieces, the arch and the sparks.
  - **Booking:** pay 30% to book a Saturday at least four weeks out. On the day, between 9am and 1pm at the venue, pay the balance and walk down the aisle for the church service, the reception and the after-party.
  - **Money:** guests' gifts and spraying help, but never cover the cost. Miss the date and the venue keeps your deposit. New recorded calls `ww` and `wh`.
- **Phone and bottom bar:** the Phone tab is a phone in a frame, with a status bar (time, 4G or E when the light is off, battery from your energy), a lock-screen clock and date, a scrolling news ticker from your story, and a wallpaper that turns to night after 7pm. New apps:
  - **Home:** your interior and needs;
  - **Careers:** jobs and work;
  - **Money**;
  - **Assets:** net worth, broken down with bars;
  - **Houses:** where you live, what you own, Lekki Hyde Park, rentals and prime homes.
  - **Bottom bar:** on phones, a bar at the bottom switches between **Home**, **Buy** (a launcher for cars, jets and yachts, houses, clothes, furniture, shares and businesses), **Map** and **Phone**.
- **New-player setup, step by step:**
  1. **Profile:** your name in the game (others see an @handle) and an 18+ check. Identity is your claude.ai account, so **there is no password or email field anywhere**.
  2. **Look:** skin tone, hairstyle, body and a free first outfit: a top in plain, Ankara, Adire or Aso-oke, and jeans, chinos or a wrapper. There's a live avatar preview and a Shuffle button.
  3. **Personality:** pick exactly two of ten traits, each a small head start (a skill boost or calmer needs).
  4. **Dream:** pick exactly one goal.
  5. **Birth lottery:** one random roll per life.
  6. **Home:** choose a first home your start can pay for, then **Move in**.
  - Traits, home and look go into the replay header, so the life replays to the same seal. Older lives have none of them and replay as before.
- **Lekki Hyde Park:** a new gated estate on the lagoon side of the Lekki–Epe Expressway, with its own gate and access road. Inside are a boulevard, a central park with a pool and tennis courts, private jetties and a lagoon promenade. It has five zones (descriptive names only, no real residents):
  - **Garden Row:** terraces for the low-class rich (₦120m);
  - **Park Crescent:** semis for the middle-class rich (₦280m);
  - **Celebrity Row:** gated villas with home studios (₦1.8bn);
  - **Billionaire Row:** lagoon-front mansions (₦3bn);
  - **The Islet:** a super-luxury private island reached by a bridge (₦8bn).
  - **Buy or build:** buy ready-built, or buy the zone's plot (30%) and build it yourself in three stages (foundation and piling, structure and roof, finishing and landscaping). That costs about 72% of the price on top of the plot, and you must visit the site to start each stage.
  - **Running costs:** every home and plot pays a weekly estate service charge. Each home adds status and can be let out.
- **Luxury catalogue** at Lekki luxury motors, grouped by tier. Every make and model has an original name (no real makers), and weekly upkeep covers insurance, servicing and the hangar, berth and crew. Each one adds status.
  - **Cars, ultra-luxury:** the Sovereign Grand Saloon, Highland SUV and Silver Saloon; Wingate Estate SUV and Grand Tourer; Corsa Hybrid hypercar, Coupé and four-door; Toro Super SUV and V12 supercar; Albion luxury SUV; Velocita 750 supercar; Hyperion W16 hypercar.
  - **Cars, premium:** Kaiser executive saloon, Boxer 4x4 and grand limousine; Isar Seven saloon and X SUV; Ringstar A saloon and Q SUV; Zuffen flat-six coupé and sport SUV; Highlander Autograph SUV; Kyoto grand SUV; Detroit full-size SUV.
  - **Jets:**
    - light: Swift 300, Meridian midsize, Alpine 24;
    - midsize: Swift 600;
    - heavy: Longreach 650, Horizon 6500;
    - ultra-long-range: Longreach 700 and 800, Horizon 7500 and 8000, Kestrel 6, 8 and 10;
    - VIP airliners: a narrowbody and a corporate airliner.
  - **Yachts:**
    - motor yachts: a mahogany runabout, Adriatica 30 and 780, Solent 76, Plymouth 85, Arrow GTX;
    - superyachts: Tuscan, Dutch-built, Ligurian, North Sea, Bremen and an ocean giga-yacht;
    - sailing yachts: Frisian and Mediterranean.
- **More live rooms:** eleven venues use the cruise's deck renderer, with their own layouts, crews and spots, plus the same filtered room chat, 📷, fold and Leave.
  - **White Sand Beach (₦3,000, 7am–7pm):** beach bar, volleyball, loungers under umbrellas, a jet-ski dock, and a bonfire after 5pm. You can also fish here.
  - **Tidewater House (members only, 4pm–midnight):** a DJ booth, a wood-fired pizza oven, the jetty, the lounge and the bar.
  - **The VI club strip (₦10,000, 10pm–4am):** an LED dance floor under moving beams, the DJ booth, the bar, a roped-off VIP table (₦80,000), and money spraying (₦20,000). It is always night inside.
  - **Balogun market (free, 8am–6pm):** fabric and phone stalls under coloured awnings, a buka for lunch, shoe sellers, and the alaaru at the gate.
  - **Freedom Park (₦1,000, 4pm–11pm):** a highlife band on the stage, the steps, a suya stand, an art corner, and benches under the trees.
  - **Abuja:** Wuse 2 nights (₦8,000, 10pm–4am), Wuse Market (free, 8am–6pm) and Millennium Park (free, 7am–7pm).
  - **Port Harcourt:** Garden City nights in GRA (₦8,000, 10pm–4am), Mile 1 market (free, 7am–6pm) and Isaac Boro Park (free, 7am–7pm).
  - These reuse the club, market and park scenes with their own sign, spot names, prices and crew (a hype man, a mai shayi, a bole mama, an ogene band).
  - **Live rooms list:** the People app opens with every live room (the cruise included), grouped by city with yours first, how many players are in each right now, and a Go button. A room in another city tells you which city to travel to.
  - **Name tags:** names are drawn after every figure, so no one stands in front of one. A tag that would overlap another tag or a venue sign moves up, down or sideways, and never sits under the toasts at the top.
  - **Friends in rooms:** game friends hang out in Lagos rooms: Mama Bisi at the Balogun buka, Femi Beatz on the Freedom Park stage, Kunle in the Tidewater lounge, Zainab at beach volleyball and Chiamaka on the VI dance floor. Their tags are green. Tap one, or the 👋 chip, to catch up once a day: friendship goes up by 6 plus your charisma, with some social and fun. It costs nothing and pays nothing. New recorded call `rh`.
  - **Local friends:** the Abuja and Port Harcourt rooms have their own regulars: Hauwa (Wuse Market), Musa (Millennium Park), Kachi (Wuse 2 nights), Ibiere (Mile 1 market), Tamuno (Garden City nights) and Ebiere (Isaac Boro Park). You catch up with them the same way, once a day. At friendship 40 or more (rules 15 lives only), Kachi and Tamuno get you in free, and the others treat you to one plate a day. They are kept apart from the Lagos friends list and from random events, so older lives replay unchanged. The People app lists them under the passport.
  - **Rules 15:** catch-ups, room nights, a room's entry boost and the six-move boost limit are all counted per room per day for the whole life, so walking out and back in does not reset them. Lives begun under rules 14 keep the old per-visit limits, so their recorded scores still verify.
- **Room nights:** every live room has one weekly event on a fixed day: Amapiano Saturday on the VI strip, Friday poetry and highlife at Freedom Park, the Sunday beach jam, Tidewater's Sunday day party, Friday jollof at Wuse 2, Picnic Sunday at Millennium Park, Garden City Saturday, the Saturday ogene evening at Isaac Boro Park, and market days at Balogun, Wuse and Mile 1. While it is on, the room gets bunting, confetti and an extra performer, and a "Tonight" bar lets you join once (₦0–15,000) for a bigger boost than the spots. Nights that start late run past midnight. New recorded call `rn`.
  - **What's on:** the What's on app lists all eleven room nights first: what's on now, then your city, then the soonest, with a countdown and a Go button. When a night starts in your city, you get one reminder toast.
- **Room passport:** the People app's Live rooms list shows your passport: rooms stamped out of 12, nights joined and catch-ups with friends, plus five badges (Lagos after dark, Three-city regular, Passport full, Night owl, Social butterfly). Each room shows ✓ or New, and a venue card says "First visit" until you go in. The passport is kept apart from achievements and the money ledger, so it never changes a life's score, its seal or a Hall of Fame check.
  - **Rules:** room chat only reaches people in the same room, and a player only counts as present if their district matches the venue. New recorded calls `rme`, `rms` and `rml`.
- **People app:** everyone online in every city, with their district, city and what they're up to (on the cruise, at a room, or their activity), and a Chat button for each. Blocked players are hidden.
- **Map layers:** buttons above the map show or hide 🏷️ **Names** (place names), 🪧 **Billboards** and 👥 **Players**, and the device remembers your choice. To keep the city readable, billboards only appear once you zoom in a little, or when the Billboards filter is on.
- **Fishing:** buy a rod once (₦12,000), then cast a line at a waterfront (Ikoyi, Lekki, Ajah, the Island, Festac, Borokiri in PH) or from the cruise rail.
  - Each cast takes 45 minutes, with three casts a day. Most bring tilapia or catfish, some nothing (or an old slipper), and rarely a barracuda or tarpon ("Big catch").
  - Sell the bag to fish buyers at a waterfront for 80% of its value, or take it home as pantry meals.
  - New recorded calls `fr`, `fi`, `fsl` and `fk`.
- **Photos:** a 📷 button on the cruise deck and on the map snaps the scene with a "Lasgidi · place" caption, then **Save to phone** (through the page's downloads permission, which asks you first) or Retake.
- **Deck panel:** the cruise panel folds down to a slim bar, so you can watch the deck.
- **CV:** a CV built only from the game's own records, so it can't be typed or padded.
  - **Contents:** current and past jobs (title, employer, shifts, and "let go" if dismissed), education (UNILAG degree or studying, NYSC, IELTS), top skills, and the criminal record.
  - **Where:** on the Me tab, and in Work, where "your CV goes with every application".
  - **Sharing:** share it and other players can open it from your player card. A shared CV holds only ids and numbers, and it's checked against the game's data before it's drawn.
  - **History:** past jobs are kept from this version on, as state only, so nothing changes a seal.
- **Lagoon Boat Cruise:** board at Five Cowries Creek in Ikoyi (₦8,000, or ₦20,000 in December, 9am–9pm) and step onto a full-screen deck.
  - **The deck:** a wooden boat on the lagoon with a deck bar, the captain's wheelhouse under a "LAGOON CRUISE" sign, sun-deck loungers, a colour-changing dance floor, speakers and a stern rail.
  - **Who's there:** online players aboard stand at their spot with their @handle, with a crew of captain, bartender and DJ.
  - **Moving around:** tap a spot (Captain's helm, Sun deck, Deck bar, Party deck, The rail) to move there, or tap a player to chat.
  - **Deck chat:** say something to everyone aboard. It shows as speech bubbles, uses the same filter as player chat, and only accepts messages from people actually on deck.
  - **Recording:** new recorded calls `cb`, `cs` and `cl`. The deck's mood boosts taper off after six moves.
- **Members-only waterfront clubs:** four clubs by the water, each with a gold membership card, a joining fee and a **weekly** membership. There are two ways in: **high net worth** (₦80m–₦500m depending on the club), or a **referral**, where a member vouches for you once your status points or Charisma are high enough. Once you're a member, the club's own activities open up. Renewing costs just the week; let it lapse and the doors close.
  - **Tidewater House:** by the water on Ademola Street, Ikoyi. House music, wood-fired pizza, boats tying up at the jetty, the pregame before the clubs, and a Sunday day party on the deck.
  - **Five Cowries Jet Ski Club:** in Ikoyi. Club skis on the lagoon and a Saturday race night.
  - **Atlantic Marina Yacht Club:** in Eko Atlantic. Sunset cruises along the sea wall, yacht days to the Lekki coast and a weekend regatta.
  - **Harbour Powerboat Club:** in Eko Atlantic. Timed laps and race days from the pit pontoon.
  - Each club has a timber jetty with boats tied up on the map.
- **Ride view:** every trip plays a short journey scene for your mode (danfo, keke, okada, cab, BRT, train, ferry, speedboat, chopper, flight, private jet, or **VIP chauffeur** when you have a driver). The sky follows the time of day, the city scrolls past, green **"Now passing"** signs name the landmarks on your route, and a progress bar runs to arrival. Tap Arrive to skip. With reduced motion, the scene holds still.
- **Bigger Abuja and Port Harcourt:** 17 new landmarks with their own activities and 3D drawings.
  - **Abuja:** the National Mosque (golden dome and four minarets), the National Christian Centre spire, the Millennium Tower, the Arts and Crafts Village, a cinema galleria in Wuse, the Three Arms Zone, the City Gate arch and the national stadium on the airport road. Aso Rock and Zuma Rock are drawn as rock massifs.
  - **Port Harcourt:** the stadium on the Omagwa road, the cultural centre, Garrison junction, Brick House, the tourist beach, the Bonny boat jetty, the zoo and the river-port cranes on Amadi Creek.
- **Live airport (Lagos, Abuja, Port Harcourt):** open it from the airport's card. It is real 3D (WebGL through three.js r158, MIT, in `vendor/`, loaded only when the airport first opens): every airliner, business jet, helicopter, car, person, palm, building and the tower is built from 3D shapes with lighting and shadows, not images; drag to orbit, scroll or pinch to zoom, or use + − ⟲ ⟳. Without WebGL it falls back to the 2D scene. A fenced plot with green land and palms: runway 50 · 22 with piano keys, touchdown bars and edge lights; five gates with jet bridges and airliners; six private jets (yours in your colour); a heliport of four helipads with choppers (yours too); a hangar, fuel farm and a tall control tower with a blinking beacon; a terminal with a glass front under a wave roof and a green name band (Murtala Muhammed International Airport II in Lagos); a plaza with a fountain and flags; two car parks of twenty marked bays and a taxi rank. Men and women walk between the car parks and the doors, live players appear by @handle, and cabs and a bus circle the kerb. A departures board on the plaza shows live Lagos · Port Harcourt · Abuja flights, jets and helicopter shuttles marked apart, and flips to arrivals. The board drives the scene: a gate empties once its flight departs, boarding gates show passengers on the bridge, the next departure takes off (or a chopper lifts off) labelled with its flight, and arrivals land. The panel has Departures, Arrivals and Inside the terminal (live counts at check-in, security, the lounge, boarding, the heliport lounge and the arrivals hall, worked out from the board, plus players at the airport), and rotating announcements, read aloud after a chime when sound is on. On the map, the main runway is marked 50 · 22 with airliners, private jets and helipads on its apron.
- **Tap anywhere in a place:** a place opens from anywhere inside its area, not just its pin: the big landmarks use their drawn shape (all of White Sand Beach with its houses and sand, the refinery yard, both airports, the stadium, Eko Atlantic), and every other place a circle round its pin. The open place's area is outlined with a dashed gold line. Tap the open place again, or empty map, to close it.
- **Beaches in real 3D:** walking in at any beach opens it in WebGL (three.js), built from shapes and generated textures, no photos: a hazy golden-hour sky with the sun's glow, reflections baked from it, an animated sea from turquoise shallows to deep blue with a foam line washing in, rippled white sand and a lawn, feathery palms swaying, umbrellas and loungers, people walking the shore, a jet ski and a sailing boat, and Eko Atlantic's towers in the haze. White Sand Beach opens from a villa terrace: a timber deck and an infinity pool with rippled light, turquoise umbrellas and daybeds, with white modern villas either side; public beaches get thatched beach bars. Signs float over their spots (tap to do them), the gem and the regulars are there, rain and harmattan thicken the haze, and at night the pools glow. Drag to look around, pinch to zoom, 📷 for a photo. Without WebGL it falls back to the drawn yard.
- **Lekki Hyde Park in real 3D:** walking in opens the lakeside estate from a villa terrace with a wider lens: the deck and infinity pool with turquoise umbrellas below, golf lawns mown in stripes rolling down to a lake with a pebble rim and a fountain throwing spray, a white stone bridge with three arches and a balustrade (a second lake and bridge further off), paths round the water, a golf green with its flag and a bunker, palms, clumps of shade trees, a row of lakeside homes on the far bank and the city skyline in the haze beyond.
- **Harbour Live:** a new island just off the harbour, between the mainland, Lagos Island and Eko Atlantic. It is joined to all three by cable-stayed link bridges, whose cables and deck lamps shift through colours after dark. In 3D, the walk-in has:
  - a big musical fountain with three rings of coloured jets;
  - a concert lawn facing a stage with a LED wall, LIVE side screens, speakers and sweeping light beams;
  - a crowd of several hundred that jumps on concert nights;
  - lamp posts, palms, and lit billboards for ads (one says ADVERTISE HERE);
  - a glass and gold skyline over the water.

  Headline concerts run Friday and Saturday nights, from 8pm. Only then is the full crowd there, with the beams and the headliner on the LED wall. Other nights, a few people drift about, the screen shows the next show and ads in turn, and the fountain plays its full show from 7 to 11pm. The headliners are fictional (Kayode Blaze, Amara Sol, DJ Tidewave, Big Temi, Zino); no real artists are shown. Other things to do: the fountain show, a night walk over the bridges and suya at the food court. There are three new billboard spots.
- **The Harbour private club:** a members' lounge behind the stage, looking onto the lagoon, with a glass front that glows at night, an infinity-pool deck with umbrellas and a lit jetty. It is not a gem spot.
- **Nightlife in real 3D:** the club strips and lounges (Crown Lounge, Adeola Odeku, the VI strip, Wuse 2, Garden City and Tidewater House) open as a club room in 3D. Each club has its own colours, room size and number of booths, picked from its name. Inside are:
  - an LED dance floor that ripples with the beat;
  - a DJ on a riser in front of a LED wall with the club's name;
  - a laser fan, moving-head beams, and haze;
  - a bar with a back-lit bottle shelf and stools;
  - VIP booths with sparkler bottles;
  - a dancing crowd.

  By day the club is closed: house lights on, an empty floor, and DOORS OPEN 10PM on the wall. The rooftop lounge and the Lekki lounges are an open deck above the city instead, with festoon bulbs, low sofas, a fire pit, a pool strip, a bar and a DJ corner, and towers all round that light up after dark.
- **Every place has an INSIDE page (rules 17):** walking into any place opens tabs.
  - **🎯 Do:** the place's own activities, then 3–4 everyday ones for its kind of place. For example:
    - markets: haggle for foodstuff, look through the ankara stalls, eat at the buka;
    - jetties: buy fish off a canoe, watch the boats;
    - churches and mosques: pray, give, join the choir or study circle;
    - gyms: workout, sauna;
    - hospitals: a free blood pressure check;
    - and so on for all 25 kinds of place.

    They cost a little or nothing and never pay out, so money stays hard to make.
  - **🔑 Buy · sell rides:** the car dealers sell everything, jetties sell boats, airports sell helicopters and jets, and motor parks sell keke, bikes and danfo buses. Everywhere else shows your own rides, to drive or sell. Selling still pays half of what you paid.
  - **🏢 Here:** the place's desks and boards (departures, clubs, the cruise, rooms, the estate office, HR desks and shares).
- **Trekking is free and open (rules 17):** walking costs nothing and is never "too far" within a city. You are never "too tired" to set off either: a long walk on low energy takes half again as long, you rest on the way (energy never drops below 5, so you don't collapse) and arrive stressed. Between cities you still fly or take a bus. Lives started before rules 17 keep their old limits and replay to the same seals.
- **Something moves every 20 seconds at the airport:** the live airport runs a two-minute loop of six movements, each 20 seconds long:
  1. an airliner lands (final approach, a puff of tyre smoke at touchdown, roll-out);
  2. an airliner takes off;
  3. a private jet lands and taxis to the jet apron;
  4. a private jet taxis out and takes off;
  5. a helicopter comes in over the lagoon and settles on helipad 4 as its rotor winds down;
  6. a helicopter lifts off.

  Each one carries a label (code, and where it is from or going to) and the tower announces it in a banner at the top, for example "Ladies and gentlemen, Green Air flight GA 210 from Port Harcourt is now landing on runway 22." With sound on, the announcement is read out after a chime. Flight codes and cities come from the live departures and arrivals board. The 2D airport (when 3D is unavailable) runs the same schedule.
- **Airport follow-cam:** on by default (🎥). The camera flies in low behind each aircraft as it lands or takes off, then drifts back to the whole airport between movements. Any drag, zoom or turn hands the camera back to you, and 🎥 resumes following.
- **Stadiums in real 3D:** the National Stadium (and the stadiums in Abuja and Port Harcourt) open as a floodlit bowl:
  - green and white seat bands and a running track;
  - goals with nets;
  - a canopy over the far stand and four floodlight masts;
  - a scoreboard.

  From 4pm to 10pm there's a live match between two fictional sides, Lagos Lions and Eko Rangers: 22 players keep their shape and pass the ball, a goal goes in every 90 seconds, the score ticks up and the crowd of 1,400 jumps. Floodlights come on after dark. At other times it's training, with a few players jogging laps round empty stands. The street football pitch is a fenced, dusty five-a-side ground among low buildings, with a game always on and neighbours watching from the benches.
- **Markets in real 3D:** all 11 markets (Oshodi, Balogun, Mushin, Tejuosho, Ajah, Festac, Ikorodu, Wuse, Kubwa, Mile 1, and the Lekki Arts and Crafts Market) open as a busy open-air market:
  - six rows of stalls under rusty zinc roofs and faded umbrellas;
  - tables piled with tomatoes, peppers, onions, yams, plantain and stacked ankara (carvings and fabrics at the crafts market);
  - a trader behind every stall, and shoppers and tray-carrying hawkers flowing down the aisles;
  - the market's name on an arch over the entrance, a danfo and a keke on the road, overhead wires, and the city's blocks all round.

  Markets trade from 6am to 8pm. After that most traders have gone home and a few stalls stay open by lantern light.
- **Jetties and marinas in real 3D:** all 12 water places open on the lagoon:
  - a concrete quay with a ticket kiosk, benches and a life-jacket rack;
  - a timber pier on pilings out to a T-head, lit by lamps at night;
  - painted canoes and boats moored alongside, yachts at the marinas and clubs, and stilt houses standing in the water at Makoko;
  - the city skyline across the water.

  On a one-minute round, a ferry comes in from Ikorodu, CMS, Falomo, Ebute-Ero or Tarkwa Bay, ties up at the T-head while the queue boards, then pulls away with its wake behind it. Its label shows Arriving, Boarding or Departed. A water taxi zips past and a paddler works along the shore.
- **Parks in real 3D:** the 13 parks and viewpoints all have:
  - a looping path with joggers and strollers going round;
  - a pond with a fountain, a red-roofed gazebo, flower beds and benches;
  - families on picnic blankets, palms, lamps that light up at night, and the city's towers beyond.

  Each place has its own landmark:
  - **Aso Rock and Zuma Rock:** a great granite dome looms over the park.
  - **Abuja City Gate:** the gate's arch.
  - **Lekki Conservation Centre:** the canopy walkway's platforms strung between tall trunks.
  - **Port Harcourt zoo:** fenced enclosures with animals.
- **Grand squares in real 3D:** the places of worship and of state open onto a paved plaza with a line of green-white-green flags waving, a fountain, palms and lamps, and the city beyond.
  - **Lagos's Cathedral and Central Mosque:** both stand side by side. The cathedral has twin spires, a rose window and arched doors; the mosque has a golden dome, four minarets with green bands, small domes and an arcade.
  - **National Mosque and National Christian Centre:** each stands alone.
  - **Eagle Square:** tiered stands under a green canopy, and an eagle on a plinth.
  - **Tafawa Balewa Square:** the same stands, with bronze horses.
  - **Three Arms Zone:** a white colonnaded state house with a green dome.
  - **Government House:** the state house without the dome.

  After dark the buildings are floodlit, the rose window glows and the dome shines. The plaza fills on worship days: Fridays at the mosques, Sundays at the churches.
- **Culture in real 3D:**
  - **Galleries, arts centres and museums:** a white-cube hall. Paintings hang round the walls in frames under track spotlights, sculptures turn slowly on plinths, and visitors drift from work to work and stop to look. The museums (the National Museum, Badagry and the Cultural centre) have wooden floors and bronze and carved heads in glass cases.
  - **The National Theatre:** its ribbed drum stands over the plaza.
  - **Millennium Tower:** its three steel legs, saucer and needle tower over the plaza.
  - **Abuja Arts and Crafts Village:** opens as a crafts market.
- **Every place is now in real 3D.** The rest open as one of three kinds of scene.
  - **A Lagos street:** a road with danfos, cars and kekes going by, walkers on the kerb, and neighbouring blocks. Each place has its own building:
    - **Buka:** a zinc awning over plastic tables and chairs, pots on the fire and smoke rising.
    - **Workshops:** the sawmill's log piles and spinning blade, the tailor's sewing tables and fabric rolls, and Ladipo's cars on jacks with stacks of tyres.
    - **Motor parks:** a long shed full of danfos under a destination board.
    - **Barber:** a shopfront with a spinning pole.
    - **Bank:** a glass tower with an ATM gallery.
    - **Hospitals:** a white block with an emergency canopy and an ambulance with a flashing siren.
    - **Car dealers:** a glass showroom with turning cars and flags.
    - **Refinery yards:** tanks, columns, pipe racks and a burning flare.
    - **Airports:** a kerbside departures terminal under a wave roof, with taxis and the control tower.
  - **An interior hall:**
    - **Tech hubs:** a co-working floor with desks, glowing monitors, beanbags and a whiteboard.
    - **Gym:** treadmills, squat racks, dumbbells and a mirror wall.
    - **Malls:** an atrium with two levels of lit shopfronts, an escalator and the cinema's NOW SHOWING screen.
  - **A scene used elsewhere:**
    - **Music venues** (the studio, the Shrine, event halls, the convention centre, Kalakuta): the club hall, with the venue's name on the LED wall.
    - **Campuses and the NYSC camp:** a faculty building over a plaza.
    - **Freedom Park:** opens as a park.
- **Weather in every 3D scene:** the game's own weather now shows outdoors.
  - **Rain:** slanting streaks fall and the sky greys over.
  - **Storm:** heavier, more slanted rain under a dark sky, with flashes of lightning.
  - **Harmattan:** the sky goes hazy beige and fine dust drifts through the air.

  Indoor halls and clubs stay dry.
- **Lighter 3D on phones:** on small screens and machines with four cores or fewer, the 3D scenes and the airport render at a lower pixel ratio with smaller shadow maps, to keep the frame rate smooth.
- **The city map in real 3D:** the Map tab now opens a 3D city you can fly over, built from the same world as the 2D map:
  - the land and lagoons, with ground tinted by district;
  - every block (low roofs on the mainland, glass towers on the Island and Eko Atlantic whose windows light up at night) and the trees;
  - the roads between districts, raised onto bridge decks over water, with streetlights;
  - danfos and cars driving, ferries crossing the lagoon, a plane taking off from the airport runway;
  - the stadium bowl, the refinery's flare, and the harbour bridges' LED cables;
  - Aso and Zuma Rock and Jabi Lake in Abuja.

  Every place has a pin with its icon, and names appear as you zoom in. Tap a pin (or a landmark's area) to open its pop-up, or tap a district to pick it. A blue marker shows where you are, and 📍 flies there. Drag to move, pinch or scroll to zoom, two fingers or right-drag to turn. The view tilts lower as you zoom in. Day, night and the weather show here too. Switch to the 2D map with 🗺 and back with 🌐. If 3D isn't available, the 2D map is used.
- **The 3D map's live layer:**
  - **Billboards:** stand on their posts with the current ad on the face, rotating every few seconds as in 2D. Tap one to open it.
  - **Gems:** today's gems spin as glowing cyan diamonds over their places.
  - **Home, businesses and players:** your home shows as a little red-roofed house, and your businesses as their icons over their sites. Other online players stand in their districts with their handles (and a red dot for unread messages); tap them to chat.
  - **Selection:** the district you pick gets a pulsing yellow ring.
  - **Trips:** your danfo, keke, okada, car, ferry, boat, helicopter or jet travels from where you were to where you're going, with the camera following.
- **Walk in anywhere:** every pin on the map has a 🚪 Walk in button that opens the place as a small 3D yard, drawn to fit its kind, in 24 sets: a refinery (columns, tanks, a lit flare, a loading gantry), an airport (terminal, tower, a parked jet), a motor park, a buka or market, a club, a gallery, a park with a fountain, a school, an office, a beach (palms, umbrellas, loungers, a beach bar, the surf), a jetty (boats bobbing at a timber pier), a stadium (pitch, stands, floodlights, goals), a mall (glass front and a car park), a mosque (gold dome, minarets), a church (pitched roof, spire, pews), a government house (dome, columns, the flag), a hospital (red cross, ambulance), a bank (columns, ATMs, a queue), a mechanic's yard (a car on the lift, tyres), a car showroom, a barbershop (striped pole, chairs), a gym, a music stage, a university campus, a tech hub (beanbags) and a gated estate (houses, a pool). Each set has its own crew and lines: lifeguards and boatmen in vests, mechanics in hard hats, nurses, tellers, ushers, coaches. Each thing you can do there stands as a sign in the yard (tap it to do it), and the panel below lists them in full. Strangers dressed from the wardrobe stand about; refinery and yard crews wear hard hats and vests; tap one to hear a line. Live players in the same district stand there under their @handles. A staff bus, cab, danfo, keke or okada keeps pulling up at the gate to drop workers and visitors. Ride there from the scene and, when the journey view closes, your own danfo, keke, okada, cab or car pulls up and you walk in. Every career has a workplace: the airport for logistics, Computer Village for phone repair, Balogun for trading, the bank headquarters, the Yaba hub, the studio, the refinery, the Trans-Amadi yards, the Bonny jetty and so on. Its HR desk hires for that career, the Work tab has a 🚪 See your workplace button, and when your shift is open a 💼 Clock in sign stands first in the yard. You wear your job title over your head with a vest (and a hard hat at the refinery and the yards), and after the shift your pay shows in a bubble. Scenes carry the rest of the city too: today's hidden gem sparkles in its yard (tap it to pick it up), the named regulars stand at their places (Tunde the barber at Mama Put, Kunle the banker at the bank and the rest; tap one to gist for an hour and ₦500), the room locals show where their room is, rain and storms fall over the yard, harmattan hazes it, and lamp posts at the gate glow after dark. 🧹 clears the signs and names for a clean view and 📷 takes a captioned photo to save or share. Arrivals follow how you came: road rides pull up at the gate, ferries and boats tie up at the pier (or the shore at a beach), a chopper drops onto a helipad and lifts off again, and your own car arrives in its colour, with your chauffeur at the door if you have one. With sound on, each scene has a quiet ambience made in the browser: surf at beaches and jetties, a crowd murmur at markets, malls, stadiums and motor parks, a bass pulse at clubs and stages, a low hum at the refinery, airport and yards. On phones the yard leads and ▾ folds the panel to its header. Turn the yard with ⟲ ⟳ (a smooth quarter turn; props are drawn back to front at every angle). When you are there, a chat box under the scene talks to players in the same district: messages show as bubbles over your head and theirs, are filtered like all chat, and are never stored. It is drawing only: the signs run the place's usual actions, so it changes no rules or replays.
- **Refinery and new airport:** east of Ajah in Ibeju-Lekki, the oil refinery is running: eight tanks, three distillation columns, lit flare stacks, a cooling tower, a lorry loading gantry and a tanker ship at the jetty. In Ikeja, beside Murtala Muhammed, the new international airport is finished: a full-length runway with threshold bars, a taxiway and apron, two glass terminal halls joined by a concourse, jet bridges with planes at the stands, a control tower, hangars, a fuel farm, a car park and a gateway sign. The refinery contractors and the airport apron crew each take day hands at the gate before 9am for ₦4,500 a day; the refinery viewing point and the terminal viewing deck cost ₦1,000. The refinery's card also has a hard-hat plant tour (₦3,500, +Craft), the flare stacks at night, tankers berthing at the jetty, unpaid shadowing at the loading gantry (+Craft, no pay), a staff canteen, an HR desk that hires Plant Hands (₦6,500 a shift, Craft 1, up to Refinery Director) and a Delta Oil & Gas shares card that opens the Stocks app.
- **State government:** Lasgidi elects a Governor and Deputy Governor every week, on a joint ticket. The cycle follows real days (UTC):
  - **Party primaries (Mon–Tue):** join one of four parties (EPP, PHC, LYP, ODF). You need 20 status points to declare for governor. Each candidate picks a slogan and three priorities, such as security, the economy, roads, education, health, transport, flooding or youth and tech. Party members vote, and the winner is the nominee.
  - **Campaign (Wed–Fri):** the nominee chooses a running mate from the party, who must accept. The ticket then holds town halls, rallies, road shows, media appearances, debates, policy presentations, community visits and voter mobilisation. Each counts once a day toward "buzz", which is for bragging rights only.
  - **Election (Sat–Sun):** each player gets one vote, cast at their polling unit (the district of their home). Votes are collated by district and then for the state. The winner needs the most valid votes and at least 25% in two-thirds of the districts that voted. If no ticket meets that spread, the Election Tribunal returns the ticket with the most votes.
  - **Government House (the next week):** the winners govern, with their names and slogan on the green banner over the map. The Governor appoints eight Commissioners and two Special Advisers. Everyone who voted sits in the State House of Assembly and confirms or rejects the Commissioners.
  - **Money:** none of this touches money, and all of it is checked by `src/gov.js` (tested in `test/gov.test.js`).
- **Victoria Island skyline:** towers along Ozumba Mbadiwe stand apart with streets between them. Each is drawn in full 3D: a ground shadow, shaded glass faces with a mullion grid and a sky reflection, edge highlights, a set-back crown and a mast with a red light, in mixed glass and stone tints.
- **Eko Atlantic:** its own island of reclaimed land south of VI, joined to it by a cable-stayed bridge. A row of glass towers stands on the waterfront, with a boulevard of palms, streets of villas and the sea wall promenade behind. You can rent an apartment there for ₦320k a week, walk the sea wall at sunset, or have weekend brunch on the boulevard. The Sea Plots grid moved east, off Lekki, to make room.
- **White Sand Beach (Ibeju-Lekki):** fine white sand and clear turquoise shallows, east of the Sea Plots, with palms, umbrellas and a surf line. There are ten fully equipped beach houses to rent, from ₦150k to ₦400k a week, each with AC, solar and a backup gen, a private pool, a deck, Wi-Fi, a cook and a guard. On the beach you can spend a beach day, ride a horse, take a quad bike on the dunes, jet ski, ride a banana boat, parasail (weekends), or kayak and paddleboard. The sea and the Lagos Lagoon are now a deeper, clearer blue.
- **More billboards:** 19 boards to rent, including Eko Atlantic boulevard, the Eko bridge, Obalende, Ikoyi Link Bridge, Admiralty Way, the National Stadium, Sabo, Airport Road and Idi-Araba.
- **Real 3D icons:** 48 AI-generated 3D icons (Higgsfield, `gpt_image_2_5`), cut out to 64px WebP in `src/icons.js`. They cover 24 kinds of place, 8 home types, 8 ways to travel and 8 new landmarks (club, yacht, jet, estate, rings, mosque, stadium, beach), and appear on map pins, place cards, travel options and the trip animation. Pins that would overlap are spaced apart, with a line back to their real spot.
- **Place cards:** every place opens a sheet with its icon, its district, a share link and activity chips. When you're elsewhere it adds a transport picker (Trek, Keke, Danfo, Okada, Cab and so on, each with its fare), a go-slow warning, and a big Go button showing the fare and the time.
- **3D icons and a roomier city:** places, homes and districts on the map use glossy 3D pins with ground shadows, and the pin you pick bobs. Phone apps sit on glossy colour tiles that press in when tapped. Every district has fewer, slimmer blocks, so streets and yards show between them.
- **Look:** Plus Jakarta Sans for text, pill buttons that press in when tapped, colour-coded need bars, an emoji on every action row, and soft shadowed cards. On phones the game opens on the map.

## Pictures

Place, home, vehicle and business cards can show AI-generated illustrations (Higgsfield, `gpt_image_2_5`). They are not photographs of the real venues. `img/manifest.json` lists all 93 images, and `node tools/fetch-images.js` downloads them, converts them to 640×400 WebP in `img/` and writes `src/images.js`. Any card without a picture falls back to its emoji.

## Layout

```
lasgidi/
  index.html            app shell
  src/data.js           content: districts, homes, careers, actions, NPCs, businesses
  src/engine.js         pure game engine (no DOM), shared by browser and tests
  src/playground.js     the isometric city view (canvas)
  src/danfo.js, src/danceoff.js, src/hawker.js, src/bole.js, src/quiz.js   the five mini-games (canvas, plus buttons for the quiz)
  src/ui.js             rendering and input
  src/styles.css        design tokens, light and dark themes
  sw.js, manifest.webmanifest, icon.svg   offline PWA
  tools/build-single.js bundle to one HTML file
  test/engine.test.js   node:test suite (107 tests) and test/gov.test.js (4 tests)
  docs/REVIEW.md        Lagos Life deep review and the case against it
```

The engine is deterministic: all randomness comes from a seeded PRNG kept in the save. Each life also records the **rules version** it started under, so a life recorded under older rules replays identically after updates add new systems. `test/fixtures/v0.5-life.json` is a golden replay from the real v0.5 engine that every later version must still verify. Only `post()` can change cash or bank. That makes the engine ready to run on a server for a future multiplayer version (see the roadmap in the review).

## Safety

- **Identity:** your claude.ai account. There are no passwords and no emails, and setup includes an 18+ check.
- **What's shared:** your display name and @handle, district, avatar look, a fixed activity label, and party, cruise or visit status.
- **Chat:** one-to-one and deck chat are filtered on send **and** on receipt, and never stored.
- **Block and report:** Block hides a player at once. Report sends the player and a reason from a fixed list to the editors (`reports/<you>`, one row per reporter, readable only by editors). Candidates in the governor race can be reported too.
- **Money:** no gambling, no betting, no real investments, no cash-out. Billboards are labelled as player ads.
- **Where to read it:** a Safety and privacy card on the start screen and in the Guide app spells all of this out.
- **Background:** `docs/REVIEW.md` section 6 compares this with a field review of Lagos Life.

## Real-cash cosmetics: the Style shop (self-hosted only)

Real money buys **cosmetics only**, in three kinds, and you wear one of each: name-tag colours for your @handle in live rooms and on the cruise; accessories drawn over your own avatar on your phone, in rooms and on the cruise (dark shades, a gold rope chain, a snapback cap, studio headphones); and house paint for your home's walls in the home designer and your home pin on the map (sage, terracotta, sky blue). Prices run from ₦1,500 to ₦3,000 ($1.99 to $3.99). What you wear is kept in this browser (`lasgidi.wear.v1`), never in a life's state. They never buy naira, status, skills or anything that changes a life, so the Hall of Fame and Weekly Lagos stay fair and money stays hard to make. The claude.ai artifact build has no shop at all.

- **Run it:** `npm run shop` serves the game and the shop from `server/` (Node 18+, no dependencies). Settings are environment variables; keys never go in the code:
  - `PORT`, `PUBLIC_URL` (the address players use, for payment return links), `DATA_DIR` (default `server/data/`, ignored by git);
  - Flutterwave (naira): `FLW_SECRET_KEY`, `FLW_SECRET_HASH` (the webhook secret hash set in the Flutterwave dashboard, with the webhook pointed at `/api/flutterwave/webhook`), and `FLW_RECEIPT_EMAIL`. Flutterwave needs an email on every payment, and the game never asks players for one, so the shop owner's receipts address is used;
  - PayPal (US dollars): `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`;
  - `SHOP_MODE=live` switches PayPal to live. Leave it unset for sandbox, and use Flutterwave test keys, until everything has been tried with test cards.
- **How a payment is checked:** the server creates the payment, then unlocks the item only after it asks the provider itself: Flutterwave's transaction verify call (amount, currency and reference must match), or a completed PayPal capture of the exact amount. Webhooks without the right secret hash are refused, and one payment can never unlock twice.
- **In the game:** the 🎨 Style shop app only appears when the game is served by this server. Players must tick "I am 18 or over", prices show in ₦ and $, a receipt reference is shown on return, purchases are listed in the shop and on the Me tab, and terms and refunds are at `/terms.html` (the shop owner fills in their business details there before going live).
- **Identity:** a random shop key is made on the device and kept in the browser. It is never typed and is not a password. The Style shop shows it under "Your shop key", with a Copy button.
- **Restoring items:** a player on a new device (or who cleared site data) sends the owner their receipt reference and their new shop key. The owner runs `SHOP_ADMIN_TOKEN=... PORT=... npm run shop:restore -- <receipt> <new key>` on the server machine. It only works from that machine, only with the admin token set in `SHOP_ADMIN_TOKEN` (with no token set there is no admin endpoint at all), and it moves the item, so the old key loses it and items can't be shared.
- **Replays:** owned cosmetics live outside a life's state, like profile photos, so buying one never changes a ledger seal.
- **Security (reviewed 15 Oct 2026):**
  - every page carries a strict Content-Security-Policy (scripts only from the game itself), `X-Frame-Options: DENY` and `Referrer-Policy: same-origin`;
  - `/api/` is rate-limited per address (30 a minute, `SHOP_RATE_LIMIT`); behind a reverse proxy set `SHOP_TRUST_PROXY=1` so the limit uses the forwarded client address;
  - POSTs must be JSON; each shop key can have at most five unfinished payments a day;
  - provider references and PayPal tokens are format-checked before any call to the provider;
  - the admin restore endpoint refuses anything a proxy forwarded, so run `shop:restore` against the server's own port on the same machine;
  - purchases are written with an fsync and an atomic rename, and a damaged `shop.json` stops the server rather than starting empty and wiping purchases. Back up `server/data/` regularly.
- **Not done:** the tag colour shows on your own screen only (self-hosted copies have no live players), and refunds go through the Flutterwave or PayPal dashboard.

## Disclaimer

Lasgidi is fiction and is not affiliated with Lagos Life or its developer. In-game naira has no real-world value and cannot be bought or cashed out. Place names refer to real Lagos districts. Businesses and people are invented.
