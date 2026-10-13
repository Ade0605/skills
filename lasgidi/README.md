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
  - Pick a weekly ad plan, from none through WhatsApp status and an Instagram boost to an influencer shout-out.
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
- **Airports:** Lagos, Abuja and Port Harcourt airports each have a **premium lounge** (shower, buffet and quiet: big boosts to hygiene, hunger and stress), **plane-spotting** at the apron window, and a **🛫 Check in** button that opens flights.
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
- **Making money is hard.** New lives start on rules 11: everything in rules 8, plus weather (rules 9), mini-games paid for at the start (rules 10), malaria (rules 11) car wear (rules 12) and job interviews (rules 13).
  New lives start on rules 13. Lives begun under rules 7 keep their rules 7 numbers: PAYE income tax comes off every shift. The first ₦4,000 is free, the next ₦16,000 is taxed at 10%, and anything above at 20%. Gigs pay 15% less, and state and council levies take 12% of business payouts. Each tax is a separate line on your statement. Rules 8 makes this steeper:
  - PAYE starts at ₦3,000 and goes up to 25% on big pay.
  - Every 4 weeks the landlord reviews your rent in line with prices.
  - Vehicle upkeep is 1.5×, and vehicles costing over ₦100m pay 0.2% insurance a week.
  - Promotions take 30% more shifts.

  Lives started earlier keep their old rules.
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
  - **Visit:** visit their home read-only. You see their furniture and garage, checked against the game's own data before it's drawn.
  - **Gifts:** send a gift such as suya, flowers, a cake or aso-ebi fabric. Gifts lift the receiver's mood but never move money, so a second account can't feed cash into a Hall of Fame life.
- **Lagos online (inside claude.ai):** a shared **Hall of Fame** of everyone's best lives, plus live presence showing how many other players are online and which district they're in. There's no chat and no free text between players. Every life records its seed and every move, so other players' browsers **replay each entry move by move** and rank only lives that reproduce the same ledger seal and score. To fake a top score, you'd have to actually play it. Outside claude.ai, the game runs single-player as before.

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
  test/engine.test.js   node:test suite (98 tests)
  docs/REVIEW.md        Lagos Life deep review and the case against it
```

The engine is deterministic: all randomness comes from a seeded PRNG kept in the save. Each life also records the **rules version** it started under, so a life recorded under older rules replays identically after updates add new systems. `test/fixtures/v0.5-life.json` is a golden replay from the real v0.5 engine that every later version must still verify. Only `post()` can change cash or bank. That makes the engine ready to run on a server for a future multiplayer version (see the roadmap in the review).

## Disclaimer

Lasgidi is fiction and is not affiliated with Lagos Life or its developer. In-game naira has no real-world value and cannot be bought or cashed out. Place names refer to real Lagos districts. Businesses and people are invented.
