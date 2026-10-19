/* Lasgidi — game content. Pure data, no logic.
 * Money is whole naira (integers). Time is minutes. Distances are km on a
 * simplified map of Lagos (x east, y south). */
(function (root) {
  'use strict';

  var DISTRICTS = {
    ikeja:   { name: 'Ikeja',        x: 10, y: 4,  side: 'mainland', blurb: 'State capital. Computer Village, the airport and the mall.' },
    ikorodu: { name: 'Ikorodu',      x: 28, y: 3,  side: 'mainland', blurb: 'Far, cheap and growing. The ferry beats the road.' },
    oshodi:  { name: 'Oshodi',       x: 10, y: 9,  side: 'mainland', blurb: 'The interchange. Every danfo passes here eventually.' },
    mushin:  { name: 'Mushin',       x: 11, y: 13, side: 'mainland', blurb: 'Face-me-I-face-you rooms, strong buka, stronger area boys.' },
    festac:  { name: 'Festac',       x: 2,  y: 17, side: 'mainland', blurb: 'Planned estate, wide roads, quiet evenings.' },
    surulere:{ name: 'Surulere',     x: 10, y: 18, side: 'mainland', blurb: 'National Stadium, studios and every weekend owambe.' },
    yaba:    { name: 'Yaba',         x: 15, y: 15, side: 'mainland', blurb: 'UNILAG, the tech hubs and Tejuosho market.' },
    island:  { name: 'Lagos Island', x: 16, y: 22, side: 'island',   blurb: 'Balogun market, CMS, General Hospital and the jetty.' },
    ikoyi:   { name: 'Ikoyi',        x: 20, y: 21, side: 'island',   blurb: 'Old money. Quiet streets and steady light.' },
    vi:      { name: 'Victoria Island', x: 19, y: 25, side: 'island', blurb: 'Banks, towers, lounges and clubs on the Atlantic.' },
    lekki:   { name: 'Lekki',        x: 28, y: 24, side: 'island',   blurb: 'Estates, startups, the beach. Floods when it rains.' },
    ajah:    { name: 'Ajah',         x: 38, y: 25, side: 'island',   blurb: 'Island address, mainland rent, long commute.' },
    // Abuja and Port Harcourt each sit in their own map frame (km, x east, y south).
    abj_kubwa:   { city: 'abuja', name: 'Kubwa',    x: 4,  y: 2,  side: 'mainland', blurb: 'Satellite town on the expressway. Cheap rooms, long commute.' },
    abj_maitama: { city: 'abuja', name: 'Maitama',  x: 14, y: 7,  side: 'mainland', blurb: 'Embassies, big compounds and Millennium Park.' },
    abj_wuse:    { city: 'abuja', name: 'Wuse',     x: 11, y: 11, side: 'mainland', blurb: 'Wuse Market by day, Wuse 2 suya and lounges by night.' },
    abj_jabi:    { city: 'abuja', name: 'Jabi',     x: 6,  y: 11, side: 'mainland', blurb: 'The lake, the mall and the weekend crowd.' },
    abj_asokoro: { city: 'abuja', name: 'Asokoro',  x: 22, y: 11, side: 'mainland', blurb: 'In the shadow of Aso Rock. Quiet, guarded and expensive.' },
    abj_garki:   { city: 'abuja', name: 'Garki',    x: 16, y: 15, side: 'mainland', blurb: 'Ministries, the business district and Eagle Square.' },
    abj_nyanya:  { city: 'abuja', name: 'Nyanya',   x: 28, y: 16, side: 'mainland', blurb: 'Busy motor park on the Keffi road. Buses to Lagos and PH.' },
    abj_airport: { city: 'abuja', name: 'Abuja Airport', x: 8, y: 24, side: 'mainland', blurb: 'Nnamdi Azikiwe International. Flights to Lagos and PH.' },
    ph_airport:  { city: 'ph', name: 'PH Airport', x: 6,  y: 1,  side: 'mainland', blurb: 'Omagwa, far north of town. Flights to Lagos and Abuja.' },
    ph_choba:    { city: 'ph', name: 'Choba',      x: 3,  y: 6,  side: 'mainland', blurb: 'Uniport students, cheap food, the teaching hospital nearby.' },
    ph_rumuokoro:{ city: 'ph', name: 'Rumuokoro',  x: 13, y: 6,  side: 'mainland', blurb: 'The big junction and motor park. Buses to Lagos and Abuja.' },
    ph_gra:      { city: 'ph', name: 'GRA',        x: 12, y: 11, side: 'mainland', blurb: 'Garden City nightlife, malls and oil money.' },
    ph_transamadi:{ city: 'ph', name: 'Trans-Amadi', x: 21, y: 11, side: 'mainland', blurb: 'Industrial yards and oil-service companies.' },
    ph_dline:    { city: 'ph', name: 'D-Line',     x: 9,  y: 15, side: 'mainland', blurb: 'Mile 1 market and crowded streets.' },
    ph_oldgra:   { city: 'ph', name: 'Old GRA',    x: 14, y: 15, side: 'mainland', blurb: 'Old colonial streets, Isaac Boro Park, fish and bole.' },
    ph_borokiri: { city: 'ph', name: 'Borokiri',   x: 16, y: 19, side: 'mainland', blurb: 'The waterfront on the Bonny River.' }
  };

  // Cities you can live in. Travel between them is by plane or long-distance bus.
  // Where you can japa to, once IELTS is passed and the funds are there.
  var JAPA_DESTS = {
    toronto:    { name: 'Toronto, Canada', icon: '🇨🇦', ticket: 3200000, text: 'Snow, Tim Hortons and a cousin in Brampton.' },
    london:     { name: 'London, UK', icon: '🇬🇧', ticket: 3600000, text: 'Peckham is waiting. So is the rain.' },
    houston:    { name: 'Houston, USA', icon: '🇺🇸', ticket: 4200000, text: 'Big roads, big church, big Naija community.' },
    dubai:      { name: 'Dubai, UAE', icon: '🇦🇪', ticket: 2400000, text: 'Tax-free pay and long hours.' }
  };

  // Town Hall: one question a real-world week, voted on by every player. Social only.
  // Governor race: players run with one of these slogans (no free text, so nothing needs checking).
  var GOV_MOTTOS = ['Light for every street, 24/7', 'No more go-slow on Third Mainland', 'Eko o ni baje!', 'Money speaks, but work speaks louder', 'Jobs for every graduate', 'Clean gutters, no more flood', 'Owambe every Saturday, on the state', 'Fix the roads, then we talk', 'Hustle hard, Lagos go pay', 'More BRT, less danfo wahala', 'Detty December all year', 'Island and Mainland, one Lagos'];
  var GOV_MIN_STATUS = 20;
  var TOWNHALL = [
    { q: 'Should okadas be allowed back on the bridges?', a: ['Yes, we need them', 'Only with helmets', 'No, keep the ban'] },
    { q: 'What should the next BRT line serve?', a: ['Lekki–Ajah', 'Ikorodu–Ojota', 'Badagry Road'] },
    { q: 'Monthly sanitation Saturdays: bring them back?', a: ['Yes, every month', 'Once a quarter', 'No'] },
    { q: 'Free WiFi in danfo parks?', a: ['Yes, everywhere', 'Only the big parks', 'Fix the roads first'] },
    { q: 'Which should the city fix first?', a: ['Flooding drains', 'Potholes', 'Street lights'] },
    { q: 'Should the ferries run all night?', a: ['Yes', 'Weekends only', 'No'] },
    { q: 'Detty December: should clubs close by 3am?', a: ['No, party on', '3am is fine', 'Midnight'] },
    { q: 'Where should the next big park be built?', a: ['Mainland', 'The Island', 'Lekki'] },
    { q: 'Should every market get a cooling shed?', a: ['Yes', 'Only the big ones', 'Let traders decide'] },
    { q: 'Cashless danfos: card and transfer only?', a: ['Yes', 'Both cash and card', 'Cash only'] }
  ];

  // Chieftaincy titles: an installation ceremony and a cheque for the palace.
  // Taken in order; each needs a minimum net worth. Pure status: a title earns nothing.
  var TITLES = [
    { id: 'baale',  prefix: 'Baale',  name: 'Baale of your street', icon: '🪶', cost: 2000000,   worth: 20000000,   status: 8,  text: 'The landlords\' association asks you to settle quarrels on your street.' },
    { id: 'chief',  prefix: 'Chief',  name: 'Chief',                icon: '🎖️', cost: 15000000,  worth: 150000000,  status: 18, text: 'A community title, a cap with a feather, and a seat at every owambe high table.' },
    { id: 'otunba', prefix: 'Otunba', name: 'Otunba',               icon: '👑', cost: 80000000,  worth: 800000000,  status: 40, text: 'A title from the palace. MCs announce you when you walk in.' },
    { id: 'aare',   prefix: 'Aare',   name: 'Aare',                 icon: '🦁', cost: 400000000, worth: 4000000000, status: 80, text: 'The highest title the palace gives. Everybody knows your name.' }
  ];

  // Phones: a better camera grows your following faster. status adds to your flex.
  var PHONES = {
    budget:   { name: 'Budget Android',   icon: '📱', price: 90000,   cam: 1,   status: 0 },
    mid:      { name: 'Mid-range Android', icon: '📱', price: 350000,  cam: 1.6, status: 1 },
    flagship: { name: 'Flagship Android', icon: '📲', price: 1400000, cam: 2.4, status: 3 },
    promax:   { name: '"Pro Max" phone',  icon: '📲', price: 2800000, cam: 3,   status: 6 }
  };

  // Chance of rain on a day, by month (Jan..Dec). The rainy season peaks in June
  // and July, with the "August break". Harmattan dust in December and January.
  var WEATHER_MONTHS = [0.05, 0.1, 0.25, 0.45, 0.55, 0.7, 0.7, 0.45, 0.6, 0.5, 0.2, 0.05];
  var HARMATTAN_MONTHS = { 11: 0.45, 0: 0.5, 1: 0.2 };

  // An online shop run from your phone: buy stock, pay for ads, ship by dispatch rider.
  // demand: orders a week with no ads. spoils: unsold stock is lost at the week's end.
  var SHOP_NICHES = {
    okrika: { name: 'Okrika thrift clothes', icon: '👕', unit: 'piece', cost: 1800, price: 3400, demand: 30, text: 'Bales from Yaba and Katangua, washed, ironed and posted.' },
    gadget: { name: 'Phone accessories', icon: '🔌', unit: 'item', cost: 2500, price: 4400, demand: 24, text: 'Chargers, cases and earpieces from Computer Village.' },
    wigs:   { name: 'Hair and wigs', icon: '💇🏾‍♀️', unit: 'wig', cost: 25000, price: 38000, demand: 3, text: 'Bone straight and frontals. Few orders, big tickets.' },
    chops:  { name: 'Small chops trays', icon: '🍢', unit: 'tray', cost: 6000, price: 10000, demand: 12, spoils: true, text: 'Puff-puff, samosa and spring rolls for parties. Unsold trays spoil.' }
  };
  var SHOP_ADS = {
    none:   { name: 'No ads', cost: 0, mult: 1 },
    status: { name: 'Chat-app status post', cost: 3000, mult: 1.6 },
    insta:  { name: 'Social media boost', cost: 12000, mult: 2.6 },
    influ:  { name: 'Influencer shout-out', cost: 50000, mult: 4 }
  };

  // Pets: a one-off price, then food and vet every week. Dogs need a compound.
  var PETS = {
    cat:      { name: 'Cat',                 icon: '🐈', price: 15000,  weekly: 2500,  daily: { fun: 4, stress: -2 } },
    parrot:   { name: 'African grey parrot', icon: '🦜', price: 120000, weekly: 2000,  daily: { fun: 3, social: 3 } },
    dog:      { name: 'Dog',                 icon: '🐕', price: 80000,  weekly: 6000,  daily: { fun: 5, stress: -3 }, yard: true },
    boerboel: { name: 'Boerboel guard dog',  icon: '🐕‍🦺', price: 450000, weekly: 15000, daily: { stress: -5, fun: 2 }, yard: true }
  };
  var YARD_HOMES = ['flat2', 'flat3', 'duplex', 'luxury', 'mansion'];
  // HMO health plans: a weekly premium; covers the hospital when you collapse.
  var HMO = {
    basic:   { name: 'Basic HMO',   icon: '🩺', weekly: 2000, checkup: 0.5, text: 'Hospital bills covered. Check-ups half price.' },
    premium: { name: 'Premium HMO', icon: '🏥', weekly: 7000, checkup: 0,   text: 'Bills covered, a private ward (shorter, calmer stays) and free check-ups.' }
  };

  // Live-in and daily staff. Paid every week; unpaid staff leave.
  var STAFF = {
    help:   { name: 'House help', icon: '🧹', pay: 35000, daily: { hygiene: 12, stress: -3 }, text: 'Cleans, washes and runs errands. Your home stays fresh.' },
    cook:   { name: 'Cook',       icon: '🍲', pay: 50000, daily: { hunger: 30, fun: 3 },     text: 'Breakfast is ready every morning, from the cook\'s own market run.' },
    driver: { name: 'Driver',     icon: '🧢', pay: 60000, daily: { stress: -6, energy: 4 },  needsCar: true, text: 'Drives you, so you rest in traffic instead of fighting it.' },
    guard:  { name: 'Gateman',    icon: '💂', pay: 30000, daily: { stress: -3 },             text: 'Watches the gate at night. You sleep easier.' }
  };
  // How many staff each home type has room for.
  var STAFF_ROOM = { room: 0, share: 0, selfcon: 1, miniflat: 1, flat2: 2, flat3: 2, duplex: 4, luxury: 3, mansion: 4 };

  // Parties you host at home (Saturdays). Guests spray money, but a party never pays for itself.
  var PARTIES = {
    small:  { name: 'Small chops and drinks', icon: '🥤', guests: 25,  cost: 120000,   mins: 240, fx: { social: 30, fun: 25, stress: -8 },  types: null },
    owambe: { name: 'Full owambe: DJ, jollof, canopy', icon: '🎉', guests: 120, cost: 1200000,  mins: 360, fx: { social: 50, fun: 45, stress: -12 }, types: ['flat2', 'flat3', 'duplex', 'luxury', 'mansion'] },
    grand:  { name: 'Society party: live band, MC, aso-ebi', icon: '🎷', guests: 400, cost: 12000000, mins: 420, fx: { social: 70, fun: 60, stress: -15 }, types: ['duplex', 'luxury', 'mansion'] }
  };

  // What a guest can do at another player's party. Mood only, never money.
  var PARTY_ACTS = {
    dance:     { name: 'Dance', icon: '💃', fx: { fun: 15, energy: -6 } },
    socialise: { name: 'Socialise', icon: '🥂', fx: { social: 15, stress: -3 } }
  };
  var PLANNER_FACTOR = 0.5; // an event decorator costs half the party again

  // The Lagos stock exchange. Fictional companies; prices follow a seeded random walk.
  // base: opening price in naira; drift/vol: daily; div: yearly dividend yield, paid quarterly.
  var STOCKS = {
    ekocem:  { ticker: 'EKOCEM',  name: 'Eko Cement',          icon: '🏗️', sector: 'Industrial', base: 420,  drift: 0.0009, vol: 0.012, div: 0.06 },
    naijatel:{ ticker: 'NAIJATEL',name: 'Naija Telecom',       icon: '📶', sector: 'Telecoms',   base: 210,  drift: 0.0008, vol: 0.014, div: 0.05 },
    lagoonbk:{ ticker: 'LAGOONBK',name: 'Lagoon Bank',         icon: '🏦', sector: 'Banking',    base: 38,   drift: 0.0011, vol: 0.017, div: 0.08 },
    deltaoil:{ ticker: 'DELTAOIL',name: 'Delta Oil & Gas',     icon: '🛢️', sector: 'Oil and gas',base: 1150, drift: 0.0007, vol: 0.022, div: 0.04 },
    ofada:   { ticker: 'OFADA',   name: 'Ofada Foods',         icon: '🍚', sector: 'Consumer',   base: 64,   drift: 0.0007, vol: 0.011, div: 0.05 },
    tmbrew:  { ticker: 'TMBREW',  name: 'Third Mainland Breweries', icon: '🍺', sector: 'Consumer', base: 52, drift: 0.0003, vol: 0.013, div: 0.03 },
    jollof:  { ticker: 'JOLLOFT', name: 'Jollof Tech',         icon: '💻', sector: 'Technology', base: 18,   drift: 0.0016, vol: 0.03, div: 0 },
    afrobeat:{ ticker: 'AFROMED', name: 'Afrobeat Media',      icon: '🎧', sector: 'Media',      base: 9,    drift: 0.0012, vol: 0.034, div: 0 }
  };

  // Starter quests, shown as chips on the map. check names a rule in engine questDone().
  // NYSC: places of primary assignment (PPA). pay is the PPA's own stipend per day
  // worked; the federal allowance (allawee) is paid every 4 weeks of service.
  var NYSC_PPAS = [
    { id: 'school',   name: 'Community Secondary School', icon: '🏫', district: 'ikorodu',       pay: 0,    text: 'Teach Basic Science to 60 students in one class.' },
    { id: 'hospital', name: 'General Hospital, Garki',    icon: '🏥', district: 'abj_garki',     pay: 600,  text: 'Records and outpatients. Long queues, kind nurses.' },
    { id: 'ministry', name: 'Federal Ministry, Maitama',  icon: '🏛️', district: 'abj_maitama',   pay: 400,  text: 'File movement and tea. Oga is always at a meeting.' },
    { id: 'bank',     name: 'Bank branch, VI',            icon: '🏦', district: 'vi',            pay: 1200, text: 'Sell accounts and count cash. Targets, targets.' },
    { id: 'oil',      name: 'Oil services firm',          icon: '🛢️', district: 'ph_transamadi', pay: 2000, text: 'The posting everyone prays for. Safety boots and a canteen.' },
    { id: 'tech',     name: 'Tech hub, Yaba',             icon: '💻', district: 'yaba',          pay: 1000, text: 'Help run a startup bootcamp. Free Wi-Fi, free jollof on Fridays.' }
  ];
  // Job interviews (rules 13) for the degree careers: [question, options, right answer].
  var INTERVIEWS = {
    ph_teacher: [
      ['Half the class failed the test. What do you do first?', ['Find out which topics they missed and reteach them', 'Give the same test again tomorrow', 'Report the class to the principal'], 0],
      ['A pupil is always sleeping in class. You…', ['Talk to them and their parents to find out why', 'Make them stand outside', 'Ignore it'], 0],
      ['What is a lesson note for?', ['Planning what to teach, how, and how to check they learnt it', 'Showing the inspector you came to work', 'Copying from the textbook'], 0],
      ['A parent offers you money to raise their child\'s grade. You…', ['Refuse politely and tell the head teacher', 'Take it this once', 'Ask for more'], 0],
      ['There are 60 pupils and 20 textbooks. You…', ['Group them to share, and put key notes on the board', 'Teach only those with books', 'Send the rest home'], 0],
      ['Why do continuous assessments matter?', ['They show progress during the term, not only at exams', 'They fill the report card', 'They do not matter'], 0]
    ],
    bank: [
      ['A customer wants to open an account. What do you ask for first?', ['A valid ID and BVN', 'Their salary slip', 'A reference letter from their pastor'], 0],
      ['A customer is shouting about a failed transfer. You…', ['Calm them, check the transaction and log a complaint', 'Tell them to go home and come back tomorrow', 'Call security at once'], 0],
      ['What does KYC stand for?', ['Know Your Customer', 'Keep Your Cash', 'Kindly Yield Collateral'], 0],
      ['Your target is 20 new accounts this month. Where do you start?', ['Markets and offices near the branch', 'Your family WhatsApp group only', 'Wait for walk-ins'], 0],
      ['A friend asks you to "flag" a big cash deposit as normal. You…', ['Refuse and follow the anti-money-laundering rules', 'Do it this once', 'Ask for a cut'], 0],
      ['Why do banks pay interest on savings?', ['They lend the money out at a higher rate', 'The government pays it', 'It is a gift'], 0]
    ],
    civil: [
      ['A file has sat on your desk for a week. You…', ['Process it or move it on with a note', 'Wait for the owner to "see" you', 'Put it under the pile'], 0],
      ['What is the Federal Capital Territory\'s seat of government?', ['Abuja', 'Lagos', 'Kaduna'], 0],
      ['A memo should be…', ['Short, clear and addressed to the right office', 'As long as possible', 'Written in Pidgin'], 0],
      ['A contractor offers you "something for the weekend". You…', ['Decline and report it', 'Accept, it is normal', 'Ask for more'], 0],
      ['Who signs off a new federal law?', ['The President, after the National Assembly passes it', 'The Chief Justice', 'The Inspector-General of Police'], 0],
      ['Your Oga is at a meeting and a minister calls. You…', ['Take a clear message and pass it on at once', 'Say nobody is in', 'Hang up'], 0]
    ],
    consult: [
      ['A client\'s sales fell 20%. Where do you start?', ['Ask questions and look at the data', 'Recommend a new logo', 'Blame the economy'], 0],
      ['What goes first in a client presentation?', ['The answer, then the evidence', 'Your team\'s photos', 'A long history of the company'], 0],
      ['Revenue is ₦10m and costs are ₦7m. The profit margin is…', ['30%', '70%', '3%'], 0],
      ['The deadline is tomorrow and the analysis is not done. You…', ['Tell the manager early and agree what to cut', 'Say nothing and hope', 'Copy last year\'s report'], 0],
      ['A good recommendation is…', ['Specific, costed and doable', 'Vague, so nobody can disagree', 'As many ideas as possible'], 0],
      ['Market size: Lagos has about 20m people and 1 in 10 buys your product monthly. Monthly buyers?', ['About 2 million', 'About 200,000', 'About 20 million'], 0]
    ]
  };
  // Lagos labels for kids and young people (shown in the Guide and on your profile).
  var SLANG = {
    ajebo:    ['Ajebo / Ajebutter', 'A privileged, soft kid: from "ajẹbọta", eating butter. Good schools, comfort, little hardship, and not much street sense.'],
    butty:    ['Butty', 'Short for Ajebutter: the same soft, privileged vibe.'],
    nepo:     ['NEPO baby', 'Opportunities from Mummy and Daddy\'s money, name or connections rather than their own effort.'],
    lapo:     ['LAPO baby', 'The opposite of a NEPO baby: little money and no connections (after LAPO, the microfinance bank).'],
    ajepako:  ['Ajepako', 'The opposite of Ajebo: tough, street-raised, hardened by hardship. "Kpako" means solid, rough.'],
    areaboy:  ['Area boy', 'A street hustler or tout (agbero) at motor parks and junctions. Very street-smart; may collect "ground money".'],
    jjc:      ['JJC (Johnny Just Come)', 'A newcomer who does not know the unwritten rules yet, how to move, or how not to get played.'],
    ijgb:     ['IJGB (I Just Got Back)', 'Diaspora kids home from the UK or US: a bit soft, a bit flashy, not fully tuned to Lagos yet.'],
    omoile:   ['Omo ile', '"House child": raised mostly at home, sheltered and protected by family.']
  };
  // Sports in Lagos, grouped as people talk about them. id: [name, icon, group]
  var SPORTS = {
    football: ['Football', '⚽', 'Most popular'], basketball: ['Basketball', '🏀', 'Most popular'], athletics: ['Athletics', '🏃', 'Most popular'],
    tabletennis: ['Table tennis', '🏓', 'Most popular'], tennis: ['Tennis', '🎾', 'Most popular'], handball: ['Volleyball and handball', '🏐', 'Most popular'], boxing: ['Boxing', '🥊', 'Most popular'],
    swimming: ['Swimming', '🏊', 'Widely played'], cricket: ['Cricket', '🏏', 'Widely played'], badminton: ['Badminton', '🏸', 'Widely played'], beachvolley: ['Beach volleyball', '🏖️', 'Widely played'],
    wrestling: ['Wrestling, judo and weightlifting', '🤼', 'Widely played'],
    ayo: ['Ayo olopon, ludo and draughts', '🎲', 'Traditional and local'], chess: ['Chess', '♟️', 'Traditional and local'], scrabble: ['Scrabble', '🔤', 'Traditional and local'],
    flagfootball: ['Flag football', '🏈', 'Emerging'], polo: ['Polo', '🐎', 'Emerging'], golf: ['Golf', '⛳', 'Emerging'], esports: ['E-sports', '🎮', 'Emerging'],
    snooker: ['Snooker and pool', '🎱', 'Emerging'], cycling: ['Cycling', '🚴', 'Emerging'], armwrestling: ['Arm wrestling', '💪', 'Emerging'], darts: ['Darts', '🎯', 'Emerging']
  };
  // Skit themes: one trends each week (from the seed); some land better where you film them.
  var SKIT_THEMES = {
    area:     { name: 'Area boys and agberos', icon: '🚏', at: ['oshodi', 'mushin', 'island'] },
    outside:  { name: '"Outside" culture', icon: '🕶️', at: ['vi', 'lekki', 'ikoyi'] },
    family:   { name: 'Nigerian parents and family wahala', icon: '👨‍👩‍👧', at: ['home'] },
    love:     { name: 'Relationships and talking stages', icon: '💔', at: [] },
    hustle:   { name: 'Hustle, traffic and NEPA', icon: '🚦', at: ['oshodi', 'ikeja', 'yaba'] },
    detty:    { name: 'Detty December and IJGBs', icon: '🎉', at: ['vi', 'lekki'], december: true }
  };
  // A PPA that pays a stipend can retain a corper who showed up: the career it offers.
  // Children's names come from the life's seed (display only).
  var KID_NAMES = ['Tobi', 'Ada', 'Emeka', 'Zainab', 'Tolu', 'Chioma', 'Ibrahim', 'Funmi', 'Kelechi', 'Amina', 'Seun', 'Ngozi', 'Femi', 'Hauwa', 'Obinna', 'Yetunde'];
  var NYSC_RETAIN = { bank: 'bank', oil: 'oil', tech: 'tech', ministry: 'civil' };
  // Somewhere to sleep away from home. where: which districts offer each tier.
  var LODGING = {
    guest:    { name: 'Guest house',         icon: '🛏️', price: 8000,   sleep: 0.8,  where: ['ikorodu', 'mushin', 'oshodi', 'festac', 'ajah', 'abj_nyanya', 'abj_kubwa', 'ph_borokiri', 'ph_dline', 'ph_rumuokoro', 'ph_choba'] },
    hotel:    { name: 'Hotel room',          icon: '🏨', price: 35000,  sleep: 1.0,  gen: true, fx: { hygiene: 30 }, where: ['ikeja', 'surulere', 'yaba', 'island', 'ikoyi', 'vi', 'lekki', 'abj_maitama', 'abj_wuse', 'abj_jabi', 'abj_asokoro', 'abj_garki', 'abj_airport', 'ph_airport', 'ph_gra', 'ph_transamadi', 'ph_oldgra'] },
    shortlet: { name: 'Short-let apartment', icon: '🏙️', price: 90000,  sleep: 1.1,  gen: true, fx: { hygiene: 35, stress: -10 }, where: ['ikoyi', 'vi', 'lekki', 'abj_maitama', 'abj_wuse', 'abj_jabi'] },
    luxury:   { name: 'Five-star hotel',     icon: '⭐', price: 180000, sleep: 1.15, gen: true, fx: { hygiene: 40, stress: -15, hunger: 35 }, where: ['vi', 'ikoyi', 'abj_maitama', 'abj_asokoro', 'ph_gra'] }
  };
  var NYSC = { callup: 5000, allowance: 77000, campDays: 3, weeks: 12, cdsDay: 3 };

  var QUESTS = [
    { id: 'get_job',     icon: '💼', title: 'Get a job',             hint: 'Open Phone → Jobs',           reward: 3000,  go: 'jobs' },
    { id: 'first_shift', icon: '⏰', title: 'Work your first shift', hint: 'Go to work in hours',          reward: 2000,  go: 'jobs' },
    { id: 'pantry',      icon: '🛒', title: 'Stock your pantry',     hint: 'Buy foodstuff at a market',    reward: 1500,  go: 'do' },
    { id: 'gem',         icon: '💎', title: 'Daily gem hunt',        hint: 'Phone → Gems',                 reward: 2000,  go: 'gems' },
    { id: 'save_100k',   icon: '🏦', title: 'Save ₦100k in the bank', hint: 'Phone → Bank',                reward: 5000,  go: 'bank' },
    { id: 'event',       icon: '🎉', title: 'Go to a festival',      hint: 'Phone → Events',               reward: 5000,  go: 'events' },
    { id: 'sleep_oba',   icon: '👑', title: 'Sleep like Oba',        hint: 'Buy a king-size bed',          reward: 10000, go: 'home' },
    { id: 'promoted',    icon: '📈', title: 'Get promoted',          hint: 'Keep working shifts',          reward: 10000, go: 'jobs' },
    { id: 'car',         icon: '🚗', title: 'Buy your first car',    hint: 'Phone → Dealers',              reward: 15000, go: 'dealers' },
    { id: 'fly',         icon: '✈️', title: 'Visit another city',    hint: 'Phone → Travel',               reward: 10000, go: 'travel' },
    { id: 'business',    icon: '🏪', title: 'Build a business',      hint: 'Money tab → Businesses',       reward: 20000, go: 'business' },
    { id: 'shares',      icon: '📈', title: 'Buy your first shares', hint: 'Phone → Stocks',               reward: 3000,  go: 'stocks' },
    { id: 'party',       icon: '🎉', title: 'Host an owambe',        hint: 'Home tab, on a Saturday',      reward: 5000,  go: 'home' },
    { id: 'shop',        icon: '🛍️', title: 'Open an online shop',   hint: 'Phone → Shop',                 reward: 3000,  go: 'shop' },
    { id: 'creator',     icon: '📸', title: 'Reach 1,000 followers', hint: 'Shoot content, or film skits at home', reward: 5000, go: 'creator' },
    { id: 'danforun',    icon: '🚐', title: 'Drive a Danfo Run',     hint: 'Ojuelegba danfo park, Surulere', reward: 2000, go: 'map' },
    { id: 'nysc',        icon: '🎖️', title: 'Serve your fatherland', hint: 'Graduate, then Phone → NYSC', reward: 3000, go: 'nysc' }
  ];

  var CITIES = {
    lagos: { name: 'Lagos', airport: 'ikeja', park: 'oshodi', hospital: 'island', hospitalName: 'General Hospital, Lagos Island' },
    abuja: { name: 'Abuja', airport: 'abj_airport', park: 'abj_nyanya', hospital: 'abj_garki', hospitalName: 'National Hospital, Garki' },
    ph:    { name: 'Port Harcourt', airport: 'ph_airport', park: 'ph_rumuokoro', hospital: 'ph_choba', hospitalName: 'the teaching hospital near Choba' }
  };
  // Airport departures: cabin classes (fare multiples and how you arrive), city codes, jets, charters, choppers.
  var CABINS = {
    economy: { name: 'Economy', icon: '💺', mult: 1, perk: 'Your seat, a drink and a small chops pack', fx: { energy: -10, stress: 4 } },
    premium: { name: 'Premium Economy', icon: '🛋️', mult: 1.8, perk: 'More legroom, priority boarding and a hot meal', fx: { energy: -6, stress: 1, hunger: 15 } },
    business: { name: 'Business', icon: '🥂', mult: 4, perk: 'The lounge, a flat seat and a proper meal', fx: { energy: -2, stress: -6, hunger: 30, fun: 4 } },
    first: { name: 'First Class', icon: '👑', mult: 9, perk: 'A private suite, champagne and a chauffeur at the other end', fx: { energy: 6, stress: -12, hunger: 35, fun: 8 } }
  };
  // Members-only waterfront clubs. Get in by net worth or by a member vouching for you, then pay by the week.
  var CLUBS = {
    tidewater: { name: 'Tidewater House', icon: '🍕', district: 'ikoyi', place: 'club_tidewater', where: 'Ademola Street, Ikoyi', join: 1500000, weekly: 250000, minWorth: 150000000, referStatus: 40, referCharisma: 3,
      text: 'Members only, on the water off Ademola Street. House music, wood-fired pizza, boats tying up at the jetty, and the pregame before the clubs.',
      acts: [
        { id: 'pregame', label: 'Pregame: house music and wood-fired pizza', mins: 120, cost: 35000, fx: { fun: 35, social: 25, hunger: 40, stress: -10 }, when: { from: 17, to: 23 } },
        { id: 'jetty', label: 'Sundowners as the boats tie up at the jetty', mins: 90, cost: 25000, fx: { fun: 25, social: 18, stress: -14 }, when: { from: 16, to: 20 } },
        { id: 'sunday', label: 'Sunday day party on the deck', mins: 240, cost: 60000, fx: { fun: 50, social: 35, energy: -18 }, when: { days: [6], from: 13, to: 21 } }
      ] },
    jetski: { name: 'Five Cowries Jet Ski Club', icon: '🌊', district: 'ikoyi', place: 'club_jetski', where: 'Ikoyi lagoon front', join: 800000, weekly: 150000, minWorth: 80000000, referStatus: 30, referCharisma: 3,
      text: 'A members\' pontoon on the lagoon. Club skis, a safety boat and a bar for after.',
      acts: [
        { id: 'ride', label: 'Take a club jet ski out on the lagoon', mins: 60, cost: 40000, fx: { fun: 40, stress: -12, energy: -10 }, xp: { fitness: 1 }, when: { from: 8, to: 18 } },
        { id: 'race', label: 'Saturday jet ski race night', mins: 150, cost: 70000, fx: { fun: 55, social: 25, energy: -18 }, when: { days: [5], from: 16, to: 21 } }
      ] },
    yacht: { name: 'Atlantic Marina Yacht Club', icon: '🛥️', district: 'vi', place: 'club_yacht', where: 'Eko Atlantic marina', join: 5000000, weekly: 600000, minWorth: 500000000, referStatus: 70, referCharisma: 4,
      text: 'Berths, a clubhouse and a sea wall view. Charter a member\'s yacht or crew in the regatta.',
      acts: [
        { id: 'cruise', label: 'Sunset cruise along the sea wall', mins: 180, cost: 150000, fx: { fun: 45, social: 25, stress: -20 }, when: { from: 16, to: 20 } },
        { id: 'day', label: 'Yacht day out to the Lekki coast', mins: 360, cost: 400000, fx: { fun: 70, social: 35, stress: -30, energy: -15 }, when: { from: 9, to: 12 } },
        { id: 'regatta', label: 'Crew in the weekend regatta', mins: 240, cost: 120000, fx: { fun: 55, social: 30, energy: -20 }, xp: { fitness: 1 }, when: { days: [5, 6], from: 9, to: 14 } }
      ] },
    // Rules 19: the Ikoyi Golf Club. The Saturday Club Cup is six holes played shot by shot (events); the prizes are big
    // for one morning but small next to the ₦1bn net worth it takes to get through the gate, and only once a week.
    golf: { name: 'Ikoyi Golf Club', icon: '⛳', district: 'ikoyi', place: 'golf_ikoyi', where: 'Ikoyi', join: 10000000, weekly: 1000000, minWorth: 1000000000, referStatus: 90, referCharisma: 6, rules: 19,
      text: 'Members only: a net worth of ₦1bn gets you through the gate. Six championship holes, single malts, quiet deals, and the ₦1bn bottle.',
      acts: [
        { id: 'play', label: 'Play a round', mins: 240, cost: 150000, fx: { fun: 40, stress: -25, energy: -20 }, xp: { fitness: 1 }, when: { from: 6, to: 17 } },
        { id: 'lesson', label: 'Lesson with the Club Pro', mins: 60, cost: 80000, fx: { energy: -6 }, xp: { fitness: 1 }, golf: 'lesson', when: { from: 7, to: 17 } },
        { id: 'malt', label: 'Single malt at the clubhouse', mins: 30, cost: 60000, fx: { fun: 8, stress: -6 }, when: { from: 12, to: 23 } },
        { id: 'round', label: 'Buy the members a round', mins: 30, cost: 400000, fx: { social: 30, fun: 10 }, when: { from: 12, to: 23 } },
        { id: 'gist', label: 'Quiet gist with old money', mins: 60, fx: { social: 18, stress: -4 }, xp: { charisma: 1 }, when: { from: 10, to: 22 } },
        { id: 'deals', label: 'Talk billion-naira deals on the terrace', mins: 120, fx: { social: 15, stress: 6 }, xp: { charisma: 1 }, when: { from: 10, to: 20 } },
        { id: 'champagne', label: 'Vintage champagne on the terrace', mins: 60, cost: 900000, fx: { fun: 25, social: 20 }, when: { from: 16, to: 23 } },
        { id: 'diamond', label: 'Order the ₦1bn diamond bottle', mins: 60, cost: 1000000000, fx: { fun: 100, social: 100 }, when: { from: 19, to: 24 } },
        { id: 'cup', label: 'Enter the Saturday Club Cup (6 holes)', mins: 30, cost: 1000000, golf: 'cup', when: { days: [5], from: 7, to: 12 } }
      ] },
    // Rules 19: the same members' course in Abuja, on the Maitama hills. One Club Cup a week across both clubs.
    abjgolf: { name: 'Abuja Hills Golf Club', icon: '⛳', district: 'abj_maitama', place: 'golf_abuja', where: 'Maitama, Abuja', join: 10000000, weekly: 1000000, minWorth: 1000000000, referStatus: 90, referCharisma: 6, rules: 19,
      text: 'Members only: a net worth of ₦1bn gets you through the gate. Six holes under the hills, single malts, quiet deals with the capital\'s old money.', acts: null },
    powerboat: { name: 'Harbour Powerboat Club', icon: '🚤', district: 'vi', place: 'club_powerboat', where: 'Eko Atlantic harbour', join: 3000000, weekly: 400000, minWorth: 300000000, referStatus: 55, referCharisma: 4,
      text: 'Race-tuned powerboats, a pit lane on the water and a timing board in the bar.',
      acts: [
        { id: 'laps', label: 'Timed laps in a club powerboat', mins: 90, cost: 120000, fx: { fun: 50, stress: -10, energy: -12 }, when: { from: 9, to: 17 } },
        { id: 'raceday', label: 'Race day: watch from the pit pontoon', mins: 240, cost: 80000, fx: { fun: 45, social: 30, energy: -10 }, when: { days: [5, 6], from: 11, to: 18 } }
      ] }
  };
  CLUBS.abjgolf.acts = CLUBS.golf.acts.map(function (a) { return JSON.parse(JSON.stringify(a)); });
  var CITY_CODES = { lagos: 'LOS', abuja: 'ABV', ph: 'PHC' };
  var AIR = { rushFrom: 6, rushTo: 9, rush: 1.5, insure: 0.06, lostBag: 25000, lostOdds: 0.08, jetFuel: 5000000, charter: 12000000, chopperCity: 1500000, chopperIntercity: 4000000 };
  // Flight and bus times (minutes) and base fares between cities.
  var INTERCITY = {
    flight: { name: 'Flight', mins: 180, fare: 150000 },
    bus:    { name: 'Long-distance bus', fare: 30000, mins: { 'lagos-abuja': 720, 'abuja-lagos': 720, 'lagos-ph': 660, 'ph-lagos': 660, 'abuja-ph': 690, 'ph-abuja': 690 } }
  };

  // Drawn on the map only; travel uses straight-line distance x 1.3.
  var ROADS = [
    ['ikeja', 'oshodi'], ['oshodi', 'mushin'], ['mushin', 'surulere'], ['mushin', 'yaba'],
    ['surulere', 'festac'], ['surulere', 'yaba'], ['yaba', 'island'], ['ikeja', 'ikorodu'],
    ['oshodi', 'festac'], ['island', 'ikoyi'], ['ikoyi', 'vi'], ['island', 'vi'],
    ['ikoyi', 'lekki'], ['vi', 'lekki'], ['lekki', 'ajah'], ['ikorodu', 'yaba'],
    ['abj_kubwa', 'abj_maitama'], ['abj_maitama', 'abj_wuse'], ['abj_wuse', 'abj_jabi'], ['abj_wuse', 'abj_garki'], ['abj_maitama', 'abj_asokoro'],
    ['abj_asokoro', 'abj_garki'], ['abj_asokoro', 'abj_nyanya'], ['abj_garki', 'abj_airport'], ['abj_jabi', 'abj_airport'], ['abj_kubwa', 'abj_jabi'],
    ['ph_airport', 'ph_choba'], ['ph_airport', 'ph_rumuokoro'], ['ph_choba', 'ph_rumuokoro'], ['ph_rumuokoro', 'ph_gra'], ['ph_gra', 'ph_dline'],
    ['ph_gra', 'ph_transamadi'], ['ph_dline', 'ph_oldgra'], ['ph_oldgra', 'ph_borokiri'], ['ph_transamadi', 'ph_oldgra'], ['ph_gra', 'ph_oldgra']
  ];
  var FERRY_STOPS = ['ikorodu', 'island', 'ikoyi', 'lekki'];
  var BRT_STOPS = ['ikorodu', 'ikeja', 'oshodi', 'yaba', 'island'];
  // Lagos rail: the Blue Line (Marina to Mile 2) and the Red Line (Ikeja to Oyingbo).
  // You ride within one line; trains run 06:00 to 21:00 at a flat fare.
  var RAIL_LINES = {
    blue: { name: 'Blue Line', color: '#2f6fa0', stops: ['island', 'surulere', 'festac'] },
    red:  { name: 'Red Line',  color: '#c0392b', stops: ['ikeja', 'oshodi', 'mushin', 'yaba'] }
  };
  // 2022 commercial okada ban LGAs, mapped onto our districts.
  var OKADA_BAN = ['ikeja', 'surulere', 'yaba', 'island', 'ikoyi', 'vi', 'lekki'];

  var MODES = {
    trek:  { name: 'Trek',  speed: 5,  wait: 0,  perKm: 0,   min: 0,    maxKm: 45, road: false, energyPerKm: 4 },
    keke:  { name: 'Keke',  speed: 20, wait: 5,  perKm: 90,  min: 200,  maxKm: 8,  road: true,  noBridge: true },
    okada: { name: 'Okada', speed: 30, wait: 3,  perKm: 150, min: 300,  maxKm: 20, road: true,  weave: 0.35 },
    danfo: { name: 'Danfo', speed: 26, wait: 10, perKm: 60,  min: 300,  maxKm: 99, road: true,  stress: 6 },
    brt:   { name: 'BRT',   speed: 30, wait: 15, perKm: 40,  min: 400,  maxKm: 99, road: true,  weave: 0.3, stops: 'brt' },
    ferry: { name: 'Ferry', speed: 24, wait: 20, perKm: 0,   min: 1500, maxKm: 99, road: false, stops: 'ferry' },
    cab:   { name: 'Cab',   speed: 32, wait: 8,  perKm: 350, min: 1500, maxKm: 99, road: true },
    car:   { name: 'Own car', speed: 32, wait: 0, perKm: 120, min: 0,   maxKm: 99, road: true, needsCar: true },
    boat:  { name: 'Own boat', speed: 45, wait: 5, perKm: 600, min: 0, maxKm: 99, road: false, stops: 'ferry', needsKind: 'boat' },
    rail:  { name: 'Train', speed: 45, wait: 12, perKm: 0, min: 750, maxKm: 99, road: false, stops: 'rail', flat: true },
    heli:  { name: 'Helicopter', speed: 200, wait: 15, perKm: 0, min: 250000, maxKm: 99, road: false, needsKind: 'heli' }
  };

  // Weekly rent. Move-in costs 4 weeks upfront + 10% agent fee (Lagos style).
  // Weekly rent. Move-in costs 4 weeks upfront + 10% agent fee (Lagos style).
  // type and x/y place each home's estate on the map. Only homes added in
  // later versions carry a daily perk, so older lives replay unchanged.
  var HOME_TYPES = {
    room:     { name: 'Single room' },
    share:    { name: 'Flat share' },
    selfcon:  { name: 'Self-contained' },
    miniflat: { name: 'Mini flat' },
    flat2:    { name: '2-bedroom flat' },
    flat3:    { name: '3-bedroom flat' },
    duplex:   { name: 'Duplex' },
    luxury:   { name: 'Luxury apartment' },
    mansion:  { name: 'Mansion' }
  };
  var HOMES = {
    squat:    { name: "Squatting with a friend", district: 'mushin', rent: 0, power: 0.3, sleep: 0.6, hidden: true, type: 'room' },
    ikorodu_room: { name: 'Room in Ikorodu', district: 'ikorodu', rent: 2000, power: 0.4, sleep: 0.85, type: 'room', x: 29.6, y: 2.4 },
    mushin_room:  { name: 'Face-me-I-face-you, Mushin', district: 'mushin', rent: 2500, power: 0.35, sleep: 0.8, type: 'room', x: 12.4, y: 12.9, perk: 'One room off a shared corridor. Shared toilet, shared kitchen, shared everything.' },
    festac_room:  { name: 'Single room, Festac', district: 'festac', rent: 3000, power: 0.5, sleep: 0.85, type: 'room', x: 2.2, y: 18.4 },
    suru_share:   { name: 'Flat-share room, Surulere', district: 'surulere', rent: 4000, power: 0.5, sleep: 0.85, type: 'share', x: 11.0, y: 17.0, daily: { social: 6 }, perk: 'Housemates: a little social life every day.' },
    yaba_share:   { name: 'Flat-share room, Yaba', district: 'yaba', rent: 4500, power: 0.5, sleep: 0.85, type: 'share', x: 15.0, y: 16.6, daily: { social: 6 }, perk: 'Housemates from UNILAG and the tech hubs: a little social life every day.' },
    suru_selfcon: { name: 'Self-con, Surulere', district: 'surulere', rent: 6000, power: 0.5, sleep: 0.9, type: 'selfcon', x: 8.8, y: 17.4 },
    yaba_selfcon: { name: 'Self-con, Yaba', district: 'yaba', rent: 7000, power: 0.5, sleep: 0.9, type: 'selfcon', x: 13.9, y: 16.3 },
    ikeja_selfcon:{ name: 'Self-con, Ikeja', district: 'ikeja', rent: 8000, power: 0.6, sleep: 0.9, type: 'selfcon', x: 12.0, y: 5.2 },
    festac_flat:  { name: 'Mini-flat, Festac', district: 'festac', rent: 9000, power: 0.55, sleep: 0.95, type: 'miniflat', x: 1.2, y: 16.0 },
    suru_flat:    { name: 'Mini-flat, Surulere', district: 'surulere', rent: 12000, power: 0.55, sleep: 0.95, type: 'miniflat', x: 8.6, y: 19.2 },
    ajah_2bed:    { name: '2-bed, Ajah', district: 'ajah', rent: 18000, power: 0.6, sleep: 1, type: 'flat2', x: 37.6, y: 25.6 },
    yaba_2bed:    { name: '2-bed flat, Yaba', district: 'yaba', rent: 20000, power: 0.6, sleep: 1, type: 'flat2', x: 13.6, y: 14.6 },
    ikeja_gra:    { name: '3-bed flat, Ikeja GRA', district: 'ikeja', rent: 30000, power: 0.75, sleep: 1.05, type: 'flat3', x: 8.4, y: 4.4 },
    lekki_studio: { name: 'Studio, Lekki Phase 1', district: 'lekki', rent: 40000, power: 0.75, sleep: 1, type: 'flat2', x: 29.4, y: 24.6 },
    lekki_3bed:   { name: '3-bed flat, Lekki', district: 'lekki', rent: 60000, power: 0.8, sleep: 1.05, type: 'flat3', x: 30.0, y: 23.4, daily: { stress: -2 } },
    ikeja_duplex: { name: 'Duplex, Ikeja GRA', district: 'ikeja', rent: 80000, power: 0.85, sleep: 1.1, type: 'duplex', x: 8.6, y: 2.6, daily: { stress: -3 }, perk: 'A quiet compound with its own generator.' },
    lekki_duplex: { name: '4-bed duplex, Lekki', district: 'lekki', rent: 110000, power: 0.85, sleep: 1.1, type: 'duplex', x: 31.2, y: 24.4, daily: { stress: -3 }, perk: 'Gated estate with security and an inverter.' },
    ikoyi_apt:    { name: 'Serviced flat, Ikoyi', district: 'ikoyi', rent: 150000, power: 0.95, sleep: 1.1, type: 'luxury', x: 19.2, y: 20.6 },
    beach_house_1: { beach: true, x: 41.9, y: 27.35, name: 'Beach house Coral, Ibeju-Lekki', district: 'ajah', rent: 150000, power: 1, sleep: 1.2, type: 'duplex', daily: { stress: -6, fun: 3 }, perk: 'Fully equipped: AC in every room, solar with a backup gen, a private pool, a deck on the white sand, Wi-Fi, a cook and a security guard.' },
    beach_house_2: { beach: true, x: 42.73, y: 27.35, name: 'Beach house Palm Grove, Ibeju-Lekki', district: 'ajah', rent: 160000, power: 1, sleep: 1.2, type: 'duplex', daily: { stress: -6, fun: 3 }, perk: 'Fully equipped: AC in every room, solar with a backup gen, a private pool, a deck on the white sand, Wi-Fi, a cook and a security guard.' },
    beach_house_3: { beach: true, x: 43.56, y: 27.35, name: 'Beach house Sunset, Ibeju-Lekki', district: 'ajah', rent: 180000, power: 1, sleep: 1.2, type: 'duplex', daily: { stress: -6, fun: 3 }, perk: 'Fully equipped: AC in every room, solar with a backup gen, a private pool, a deck on the white sand, Wi-Fi, a cook and a security guard.' },
    beach_house_4: { beach: true, x: 44.39, y: 27.35, name: 'Beach house Driftwood, Ibeju-Lekki', district: 'ajah', rent: 190000, power: 1, sleep: 1.2, type: 'duplex', daily: { stress: -6, fun: 3 }, perk: 'Fully equipped: AC in every room, solar with a backup gen, a private pool, a deck on the white sand, Wi-Fi, a cook and a security guard.' },
    beach_house_5: { beach: true, x: 45.22, y: 27.35, name: 'Beach house Seashell, Ibeju-Lekki', district: 'ajah', rent: 210000, power: 1, sleep: 1.2, type: 'duplex', daily: { stress: -6, fun: 3 }, perk: 'Fully equipped: AC in every room, solar with a backup gen, a private pool, a deck on the white sand, Wi-Fi, a cook and a security guard.' },
    beach_house_6: { beach: true, x: 46.05, y: 27.35, name: 'Beach house Lagoon View, Ibeju-Lekki', district: 'ajah', rent: 230000, power: 1, sleep: 1.2, type: 'duplex', daily: { stress: -6, fun: 3 }, perk: 'Fully equipped: AC in every room, solar with a backup gen, a private pool, a deck on the white sand, Wi-Fi, a cook and a security guard.' },
    beach_house_7: { beach: true, x: 46.88, y: 27.35, name: 'Beach house High Tide, Ibeju-Lekki', district: 'ajah', rent: 250000, power: 1, sleep: 1.2, type: 'duplex', daily: { stress: -6, fun: 3 }, perk: 'Fully equipped: AC in every room, solar with a backup gen, a private pool, a deck on the white sand, Wi-Fi, a cook and a security guard.' },
    beach_house_8: { beach: true, x: 47.71, y: 27.35, name: 'Beach house Sea Breeze, Ibeju-Lekki', district: 'ajah', rent: 280000, power: 1, sleep: 1.2, type: 'duplex', daily: { stress: -6, fun: 3 }, perk: 'Fully equipped: AC in every room, solar with a backup gen, a private pool, a deck on the white sand, Wi-Fi, a cook and a security guard.' },
    beach_house_9: { beach: true, x: 48.54, y: 27.35, name: 'Beach house Sandpiper, Ibeju-Lekki', district: 'ajah', rent: 320000, power: 1, sleep: 1.2, type: 'duplex', daily: { stress: -6, fun: 3 }, perk: 'Fully equipped: AC in every room, solar with a backup gen, a private pool, a deck on the white sand, Wi-Fi, a cook and a security guard.' },
    beach_house_10: { beach: true, x: 49.37, y: 27.35, name: 'Beach house Atlantic, Ibeju-Lekki', district: 'ajah', rent: 400000, power: 1, sleep: 1.2, type: 'duplex', daily: { stress: -6, fun: 3 }, perk: 'Fully equipped: AC in every room, solar with a backup gen, a private pool, a deck on the white sand, Wi-Fi, a cook and a security guard.' },
    eko_apartment: { name: 'Apartment, Eko Atlantic', district: 'vi', rent: 320000, power: 1, sleep: 1.15, type: 'luxury', x: 15.6, y: 29.7, daily: { stress: -5, fun: 2 }, perk: 'Steady power, wide streets that don\'t flood, and the sea wall promenade at your door.' },
    vi_penthouse: { name: 'Penthouse, Victoria Island', district: 'vi', rent: 260000, power: 0.98, sleep: 1.15, type: 'luxury', x: 20.8, y: 25.4, daily: { stress: -4, fun: 3 }, perk: '24-hour power, a gym and a view of the Atlantic.' },
    abj_kubwa_selfcon: { name: 'Self-con, Kubwa', district: 'abj_kubwa', rent: 6000, power: 0.55, sleep: 0.9, type: 'selfcon', x: 5.2, y: 2.6 },
    abj_nyanya_room:   { name: 'Room in Nyanya', district: 'abj_nyanya', rent: 3000, power: 0.45, sleep: 0.85, type: 'room', x: 27.2, y: 17.0 },
    abj_wuse_flat:     { name: '2-bed flat, Wuse 2', district: 'abj_wuse', rent: 45000, power: 0.8, sleep: 1, type: 'flat2', x: 11.8, y: 9.8 },
    abj_maitama_duplex:{ name: 'Duplex, Maitama', district: 'abj_maitama', rent: 140000, power: 0.92, sleep: 1.1, type: 'duplex', x: 14.8, y: 5.8, daily: { stress: -3 } },
    abj_asokoro_mansion:{ name: 'Mansion, Asokoro', district: 'abj_asokoro', rent: 450000, power: 0.99, sleep: 1.2, type: 'mansion', x: 23.0, y: 12.0, daily: { stress: -6, fun: 4 } },
    ph_rumuokoro_room: { name: 'Room in Rumuokoro', district: 'ph_rumuokoro', rent: 2800, power: 0.4, sleep: 0.85, type: 'room', x: 13.6, y: 4.8 },
    ph_dline_selfcon:  { name: 'Self-con, D-Line', district: 'ph_dline', rent: 7000, power: 0.5, sleep: 0.9, type: 'selfcon', x: 8.2, y: 16.0 },
    ph_gra_flat:       { name: '3-bed flat, GRA Phase 2', district: 'ph_gra', rent: 40000, power: 0.75, sleep: 1.05, type: 'flat3', x: 12.4, y: 9.8 },
    abj_kubwa_rp:      { name: 'Room and parlour, Kubwa', district: 'abj_kubwa', rent: 9000, power: 0.55, sleep: 0.95, type: 'miniflat', x: 4.4, y: 3.4 },
    abj_garki_flat:    { name: '2-bed flat, Garki Area 11', district: 'abj_garki', rent: 38000, power: 0.8, sleep: 1, type: 'flat2', x: 15.8, y: 15.4 },
    abj_jabi_flat:     { name: 'Mini flat by Jabi Lake', district: 'abj_jabi', rent: 22000, power: 0.7, sleep: 1, type: 'miniflat', x: 6.0, y: 11.6, daily: { stress: -1 } },
    ph_choba_room:     { name: 'Student room, Choba', district: 'ph_choba', rent: 3500, power: 0.45, sleep: 0.85, type: 'room', x: 2.6, y: 6.6 },
    ph_dline_flat:     { name: '2-bed flat, D-Line', district: 'ph_dline', rent: 18000, power: 0.6, sleep: 1, type: 'flat2', x: 9.0, y: 15.2 },
    ph_oldgra_bungalow:{ name: 'Bungalow, Old GRA', district: 'ph_oldgra', rent: 45000, power: 0.75, sleep: 1.05, type: 'flat3', x: 13.8, y: 15.0 },
    ph_oldgra_duplex:  { name: 'Duplex, Old GRA', district: 'ph_oldgra', rent: 90000, power: 0.85, sleep: 1.1, type: 'duplex', x: 14.6, y: 16.2, daily: { stress: -3 } },
    // Lekki Hyde Park: a gated estate on the lagoon side of the Lekki–Epe Expressway, in five zones.
    hp_terrace_own: { name: 'Your terrace, Garden Row, Lekki Hyde Park', district: 'lekki', rent: 0, power: 0.9, sleep: 1.1, type: 'duplex', owned: true, ownedBy: 'hp_terrace', hydepark: true, x: 31.4, y: 23.7, daily: { stress: -3 }, perk: 'Garden Row: neat terraces by the estate park. Rich, quietly.' },
    hp_semi_own: { name: 'Your semi-detached, Park Crescent, Lekki Hyde Park', district: 'lekki', rent: 0, power: 0.93, sleep: 1.15, type: 'duplex', owned: true, ownedBy: 'hp_semi', hydepark: true, x: 32.5, y: 23.4, daily: { stress: -4 }, perk: 'Park Crescent: semis around the pool and tennis courts.' },
    hp_vip_own: { name: 'Your villa, Celebrity Row, Lekki Hyde Park', district: 'lekki', rent: 0, power: 0.98, sleep: 1.25, type: 'luxury', owned: true, ownedBy: 'hp_vip', hydepark: true, x: 32.5, y: 22.9, daily: { stress: -6, fun: 4 }, perk: 'Celebrity Row: gated villas with a home studio, a pool and a lagoon view. Fans wait at the gate.' },
    hp_billionaire_own: { name: 'Your mansion, Billionaire Row, Lekki Hyde Park', district: 'lekki', rent: 0, power: 1, sleep: 1.3, type: 'mansion', owned: true, ownedBy: 'hp_billionaire', hydepark: true, x: 31.4, y: 22.9, daily: { stress: -8 }, perk: 'Billionaire Row: lagoon-front mansions with private jetties.' },
    hp_island_own: { name: 'Your private island, Lekki Hyde Park', district: 'lekki', rent: 0, power: 1, sleep: 1.35, type: 'mansion', owned: true, ownedBy: 'hp_island', hydepark: true, x: 32.4, y: 21.95, daily: { stress: -10, fun: 4 }, perk: 'Super-luxury: your own islet in the lagoon, reached by a private bridge.' },
    lekki_nicon_own:  { name: 'Your duplex, Nicon Town', district: 'lekki', rent: 0, power: 0.92, sleep: 1.15, type: 'duplex', owned: true, ownedBy: 'lekki_nicon', daily: { stress: -4 }, perk: 'A gated estate popular with young professionals and families: upscale, but not the Ikoyi axis.' },
    vi_luxapt_own:    { name: 'Your luxury apartment, VI', district: 'vi', rent: 0, power: 0.98, sleep: 1.15, type: 'luxury', owned: true, ownedBy: 'vi_luxapt', daily: { stress: -4, social: 2 }, perk: 'High floors, a concierge and the city\'s offices, lounges and nightlife on your doorstep.' },
    eko_atlantic_own: { name: 'Your penthouse, Eko Atlantic', district: 'vi', rent: 0, power: 1, sleep: 1.2, type: 'luxury', owned: true, ownedBy: 'eko_atlantic', daily: { stress: -6, fun: 2 }, perk: 'The new master-planned city on reclaimed land: steady power, wide roads and an ocean view.' },
    ikoyi_parkview_own: { name: 'Your mansion, Parkview Estate', district: 'ikoyi', rent: 0, power: 0.99, sleep: 1.2, type: 'mansion', owned: true, ownedBy: 'ikoyi_parkview', daily: { stress: -7 }, perk: 'Old money and leafy streets: diplomats, executives and long-standing families, quieter than VI.' },
    banana_island_own: { name: 'Your waterfront mansion, Banana Island', district: 'ikoyi', rent: 0, power: 1, sleep: 1.25, type: 'mansion', owned: true, ownedBy: 'banana_island', daily: { stress: -10, fun: 3 }, perk: 'Number one in Nigeria: a gated island off Ikoyi with private power, extreme security and billionaire neighbours.' },
    built_own:    { name: 'Your own house, Ikorodu', district: 'ikorodu', rent: 0, power: 0.55, sleep: 1.05, type: 'flat3', owned: true, ownedBy: 'built_house', perk: 'You built it, block by block: no rent, no landlord, and the C of O is real.' },
    estate_own:   { name: 'Your house, Mainland Estate', district: 'ikeja', rent: 0, power: 0.65, sleep: 1.05, type: 'duplex', owned: true, perk: 'Your own house: no rent, no landlord, an estate transformer.' },
    banana:       { name: 'Mansion, Banana Island', district: 'ikoyi', rent: 600000, power: 0.99, sleep: 1.2, type: 'mansion', x: 22.4, y: 20.6, daily: { stress: -6, fun: 4 }, perk: 'Pool, staff quarters and 24-hour power on Lagos\'s most exclusive island.' }
  };

  var SKILLS = {
    hustle:   'Hustle',
    tech:     'Tech',
    cooking:  'Cooking',
    music:    'Music',
    fitness:  'Fitness',
    charisma: 'Charisma',
    craft:    'Craft'
  };
  var SKILL_XP = [0, 10, 25, 45, 70, 100, 140, 190, 250, 320, 400];

  // days: 0=Mon ... 6=Sun. pay is per shift at each level.
  var CAREERS = {
    dispatch: { name: 'Logistics', district: 'ikeja', skill: 'hustle', start: 8, end: 16, days: [0,1,2,3,4,5],
      titles: ['Dispatch Rider', 'Senior Rider', 'Fleet Lead', 'Hub Manager', 'Logistics Boss'],
      pay: [5000, 7500, 11000, 17000, 28000], req: [0, 2, 4, 6, 8] },
    trader:   { name: 'Trading', district: 'island', skill: 'hustle', start: 7, end: 17, days: [0,1,2,3,4,5],
      titles: ['Apprentice', 'Shop Hand', 'Stall Owner', 'Wholesaler', 'Iya/Baba Oja'],
      pay: [4500, 7000, 11500, 19000, 35000], req: [0, 2, 4, 6, 9] },
    buka:     { name: 'Food', district: 'mushin', skill: 'cooking', start: 6, end: 14, days: [0,1,2,3,4,5,6],
      titles: ['Dishwasher', 'Line Cook', 'Head Cook', 'Restaurant Owner', 'Food Mogul'],
      pay: [4200, 6500, 10000, 16000, 30000], req: [0, 2, 4, 6, 8] },
    danfo:    { name: 'Transport', district: 'oshodi', skill: 'hustle', start: 5, end: 13, days: [0,1,2,3,4,5],
      titles: ['Conductor', 'Driver', 'Owner-Driver', 'Fleet Owner', 'Union Chairman'],
      pay: [4800, 7200, 11000, 18000, 33000], req: [0, 3, 5, 7, 9] },
    phones:   { name: 'Phone Repair', district: 'ikeja', skill: 'craft', start: 9, end: 18, days: [0,1,2,3,4,5],
      titles: ['Apprentice', 'Technician', 'Shop Owner', 'Importer', 'Gadget Merchant'],
      pay: [4500, 8000, 12500, 21000, 38000], req: [0, 2, 4, 6, 8] },
    tech:     { name: 'Tech', district: 'yaba', skill: 'tech', start: 9, end: 17, days: [0,1,2,3,4],
      titles: ['Intern', 'Junior Dev', 'Mid Dev', 'Senior Engineer', 'CTO'],
      pay: [7000, 13000, 22000, 40000, 75000], req: [2, 3, 5, 7, 9] },
    bank:     { name: 'Banking', district: 'vi', skill: 'charisma', start: 8, end: 18, days: [0,1,2,3,4], degree: true,
      titles: ['Teller', 'Relationship Officer', 'Branch Lead', 'Regional Head', 'Executive Director'],
      pay: [9000, 14000, 24000, 45000, 90000], req: [1, 3, 5, 7, 9] },
    music:    { name: 'Music', district: 'surulere', skill: 'music', start: 18, end: 24, days: [3,4,5,6],
      titles: ['Backup Singer', 'Hypeman', 'Club Act', 'Headliner', 'Afrobeats Giant'],
      pay: [5000, 9000, 17000, 40000, 99000], req: [1, 3, 5, 7, 10] },
    civil:    { name: 'Civil Service', district: 'abj_garki', skill: 'charisma', start: 8, end: 16, days: [0,1,2,3,4], degree: true,
      titles: ['Clerk', 'Executive Officer', 'Senior Officer', 'Deputy Director', 'Permanent Secretary'],
      pay: [8000, 12500, 20000, 36000, 70000], req: [1, 3, 5, 7, 9] },
    consult:  { name: 'Consulting', district: 'abj_maitama', skill: 'tech', start: 9, end: 18, days: [0,1,2,3,4], degree: true,
      titles: ['Analyst', 'Associate', 'Manager', 'Partner', 'Managing Partner'],
      pay: [10000, 18000, 32000, 60000, 120000], req: [2, 4, 6, 8, 10] },
    oil:      { name: 'Oil Services', district: 'ph_transamadi', skill: 'craft', start: 6, end: 16, days: [0,1,2,3,4,5],
      titles: ['Roustabout', 'Technician', 'Supervisor', 'Rig Manager', 'Oilfield Contractor'],
      pay: [7500, 13000, 22000, 42000, 85000], req: [1, 3, 5, 7, 9] },
    // The Ibeju-Lekki refinery: plant work in Ajah. Pays a little under the Port Harcourt oil-service yards.
    ajah_refinery: { name: 'Lagos Oil Refinery', district: 'ajah', skill: 'craft', start: 6, end: 14, days: [0,1,2,3,4,5],
      titles: ['Plant Hand', 'Process Operator', 'Shift Supervisor', 'Plant Manager', 'Refinery Director'],
      pay: [6500, 11000, 19000, 36000, 72000], req: [1, 3, 5, 7, 9] },
    fitness:  { name: 'Fitness', district: 'lekki', skill: 'fitness', start: 6, end: 12, days: [0,1,2,3,4,5],
      titles: ['Gym Assistant', 'Trainer', 'Head Coach', 'Gym Owner', 'Fitness Icon'],
      pay: [5000, 8000, 13500, 24000, 45000], req: [1, 3, 5, 7, 9] },
    // Abuja and Port Harcourt careers. Pay sits at or below the Lagos equivalents.
    abj_trader:  { name: 'Market Trading (Abuja)', district: 'abj_wuse', skill: 'hustle', start: 7, end: 17, days: [0,1,2,3,4,5],
      titles: ['Market Boy/Girl', 'Stall Hand', 'Stall Owner', 'Wholesaler', 'Market Chief'],
      pay: [4200, 6500, 10500, 17500, 32000], req: [0, 2, 4, 6, 9] },
    abj_driver:  { name: 'Ministry Driving', district: 'abj_garki', skill: 'hustle', start: 7, end: 16, days: [0,1,2,3,4],
      titles: ['Pool Driver', 'Director\'s Driver', 'Head of Transport', 'Fleet Manager', 'Logistics Contractor'],
      pay: [4800, 7000, 11000, 18000, 30000], req: [1, 3, 5, 7, 9] },
    abj_hotel:   { name: 'Hospitality (Abuja)', district: 'abj_maitama', skill: 'charisma', start: 14, end: 23, days: [0,2,3,4,5,6],
      titles: ['Waiter', 'Front Desk', 'Events Lead', 'Hotel Manager', 'Hotelier'],
      pay: [4500, 7500, 12000, 21000, 38000], req: [0, 2, 4, 6, 9] },
    ph_docks:    { name: 'Port Work', district: 'ph_borokiri', skill: 'fitness', start: 6, end: 15, days: [0,1,2,3,4,5],
      titles: ['Dock Hand', 'Crane Banksman', 'Shift Foreman', 'Terminal Supervisor', 'Shipping Agent'],
      pay: [4500, 7200, 11500, 19000, 34000], req: [0, 2, 4, 6, 9] },
    ph_fishing:  { name: 'Fishing Cooperative', district: 'ph_dline', skill: 'craft', start: 5, end: 13, days: [0,1,2,3,4,5,6],
      titles: ['Net Mender', 'Boat Crew', 'Boat Captain', 'Cold Room Owner', 'Fish Merchant'],
      pay: [3800, 6000, 9500, 16000, 28000], req: [0, 2, 4, 6, 8] },
    ph_hotel:    { name: 'Hospitality (PH)', district: 'ph_gra', skill: 'charisma', start: 14, end: 23, days: [0,2,3,4,5,6],
      titles: ['Waiter', 'Front Desk', 'Events Lead', 'Hotel Manager', 'Hotelier'],
      pay: [4500, 7500, 12000, 21000, 38000], req: [0, 2, 4, 6, 9] },
    ph_teacher:  { name: 'Teaching', district: 'ph_choba', skill: 'tech', degree: true, start: 7, end: 15, days: [0,1,2,3,4],
      titles: ['Classroom Teacher', 'Senior Teacher', 'Head of Department', 'Vice Principal', 'Principal'],
      pay: [6000, 9000, 14000, 22000, 36000], req: [1, 3, 5, 7, 9] }
  };

  // Effects: needs deltas (hunger, energy, fun, social, hygiene, stress), xp, earn, cost.
  // when: {days:[...], from:h, to:h} — action allowed only then.
  var PLACE_ACTIONS = {
    abj_kubwa: [
      { id: 'abj_kubwa_food', label: 'Buy foodstuff at Kubwa market (7 meals)', mins: 60, cost: 4500, special: 'pantry7', when: { from: 7, to: 19 } },
      { id: 'abj_kubwa_gig', label: 'Carry loads at Kubwa market', mins: 180, earn: 2400, fx: { energy: -20, hygiene: -12 }, xp: { hustle: 2, fitness: 1 }, gig: true, when: { from: 7, to: 18 } },
      { id: 'abj_zuma', label: 'Day trip to see Zuma Rock', mins: 240, cost: 6000, fx: { fun: 30, stress: -12, energy: -10 }, when: { from: 7, to: 13 } }
    ],
    abj_maitama: [
      { id: 'abj_millennium', label: 'Walk in Millennium Park', mins: 90, fx: { fun: 18, stress: -12 }, when: { from: 7, to: 19 } },
      { id: 'abj_quiz', label: 'Naija Quiz show at the park stage (mini-game)', mins: 60, fx: { fun: 15, social: 10, stress: -4 }, xp: { charisma: 1, tech: 1 }, minigame: 'quiz', when: { days: [4, 5, 6], from: 15, to: 20 } },
      { id: 'abj_maitama_gig', label: 'Run errands for Maitama households', mins: 150, earn: 3500, fx: { energy: -12 }, xp: { hustle: 2, charisma: 1 }, gig: true, when: { from: 8, to: 19 } }
    ],
    abj_wuse: [
      { id: 'abj_suya', label: 'Eat suya in Wuse 2', mins: 45, cost: 2500, fx: { hunger: 35, fun: 10 }, when: { from: 17, to: 24 } },
      { id: 'abj_night', label: 'Night out in Wuse 2', mins: 240, cost: 15000, fx: { fun: 55, social: 40, energy: -35, hygiene: -15 }, special: 'club', when: { days: [4,5], from: 21, to: 24 } },
      { id: 'abj_wuse_gig', label: 'Sell at Wuse Market', mins: 180, earn: 3000, fx: { energy: -15 }, xp: { hustle: 3 }, gig: true, when: { days: [0,1,2,3,4,5], from: 8, to: 18 } },
      { id: 'abj_galleria', label: 'Catch a film at the Wuse cinema galleria', mins: 150, cost: 4500, fx: { fun: 30, social: 8 }, when: { from: 11, to: 23 } }
    ],
    abj_jabi: [
      { id: 'abj_jabi_film', label: 'Watch a film at the Jabi lakeside mall', mins: 150, cost: 5000, fx: { fun: 40, social: 10, stress: -10 }, when: { from: 11, to: 23 } },
      { id: 'abj_jabi_boat', label: 'Boat ride on Jabi Lake', mins: 60, cost: 3000, fx: { fun: 25, stress: -10 }, when: { from: 9, to: 18 } },
      { id: 'abj_jabi_gig', label: 'Wash cars by the lake', mins: 180, earn: 2800, fx: { energy: -15, hygiene: -10 }, xp: { hustle: 2 }, gig: true, when: { from: 8, to: 18 } }
    ],
    abj_asokoro: [
      { id: 'abj_aso', label: 'Watch the sun set on Aso Rock', mins: 60, fx: { fun: 15, stress: -10 }, when: { from: 16, to: 19 } },
      { id: 'abj_asokoro_gig', label: 'Security shift at an Asokoro gate', mins: 240, earn: 4000, fx: { energy: -18, fun: -8 }, xp: { fitness: 1 }, gig: true },
      { id: 'abj_threearms', label: 'Walk past the Three Arms Zone', mins: 45, fx: { fun: 8, stress: -4 }, when: { from: 8, to: 17 } }
    ],
    abj_garki: [
      { id: 'abj_carnival', label: 'Abuja Carnival at Eagle Square', mins: 240, cost: 2000, fx: { fun: 50, social: 30, energy: -20 }, event: true, when: { months: [10], days: [5,6], from: 10, to: 20 } },
      { id: 'abj_eagle', label: 'Stroll round Eagle Square', mins: 45, fx: { fun: 10, stress: -5 }, when: { from: 7, to: 19 } },
      { id: 'abj_garki_gig', label: 'Type documents at a business centre', mins: 120, earn: 3200, fx: { energy: -8 }, xp: { tech: 2 }, gig: true, when: { days: [0,1,2,3,4], from: 8, to: 18 } },
      { id: 'abj_mosque', label: 'Visit the National Mosque grounds', mins: 45, fx: { stress: -10, fun: 6 }, when: { from: 8, to: 18 } },
      { id: 'abj_ecumenical', label: 'Sit in at the National Christian Centre', mins: 60, fx: { stress: -10, social: 6 }, when: { from: 8, to: 18 } },
      { id: 'abj_tower', label: 'Ride up the Millennium Tower', mins: 60, cost: 5000, fx: { fun: 22, stress: -6 }, when: { from: 10, to: 20 } },
      { id: 'abj_crafts', label: 'Browse the Arts and Crafts Village', mins: 60, cost: 1500, fx: { fun: 14, social: 6 }, when: { from: 9, to: 18 } },
      { id: 'abj_crafts_gig', label: 'Sell beads at the Crafts Village', mins: 180, earn: 3800, fx: { energy: -12 }, xp: { hustle: 2 }, gig: true, when: { days: [5, 6], from: 10, to: 17 } }
    ],
    abj_nyanya: [
      { id: 'abj_nyanya_buka', label: 'Eat at a Nyanya buka', mins: 30, cost: 1300, fx: { hunger: 45 } },
      { id: 'abj_nyanya_gig', label: 'Load buses at Nyanya park', mins: 180, earn: 2600, fx: { energy: -20, hygiene: -12 }, xp: { hustle: 2 }, gig: true, when: { from: 5, to: 20 } }
    ],
    abj_airport: [
      { id: 'abj_air_lounge', label: 'Premium lounge: shower, buffet, quiet', mins: 60, cost: 25000, fx: { hunger: 40, hygiene: 25, energy: 10, stress: -12, fun: 6 } },
      { id: 'abj_air_spot', label: 'Plane-spotting at the apron window', mins: 30, fx: { fun: 6, stress: -3 } },
      { id: 'abj_air_eat', label: 'Eat at the airport', mins: 45, cost: 6000, fx: { hunger: 50 } },
      { id: 'abj_air_gig', label: 'Help travellers with bags', mins: 120, earn: 2500, fx: { energy: -12 }, xp: { charisma: 1 }, gig: true, when: { from: 6, to: 22 } },
      { id: 'abj_gate', label: 'Take a photo at the City Gate', mins: 15, fx: { fun: 10 }, when: { from: 7, to: 18 } },
      { id: 'abj_stadium', label: 'Watch a match at the national stadium', mins: 150, cost: 2000, fx: { fun: 32, social: 12, energy: -8 }, when: { days: [5, 6], from: 15, to: 20 } },
      { id: 'abj_stadium_gig', label: 'Sell drinks at the stadium gates', mins: 180, earn: 3400, fx: { energy: -14 }, xp: { hustle: 2 }, gig: true, when: { days: [5, 6], from: 14, to: 20 } }
    ],
    ph_airport: [
      { id: 'ph_air_lounge', label: 'Premium lounge: shower, buffet, quiet', mins: 60, cost: 22000, fx: { hunger: 40, hygiene: 25, energy: 10, stress: -12, fun: 6 } },
      { id: 'ph_air_spot', label: 'Plane-spotting at the apron window', mins: 30, fx: { fun: 6, stress: -3 } },
      { id: 'ph_air_eat', label: 'Eat at the airport', mins: 45, cost: 5500, fx: { hunger: 50 } },
      { id: 'ph_air_gig', label: 'Help travellers with bags', mins: 120, earn: 2400, fx: { energy: -12 }, xp: { charisma: 1 }, gig: true, when: { from: 6, to: 22 } },
      { id: 'ph_stadium', label: 'Watch a match at the stadium', mins: 150, cost: 1500, fx: { fun: 30, social: 12, energy: -8 }, when: { days: [5, 6], from: 15, to: 20 } }
    ],
    ph_choba: [
      { id: 'ph_uniport_lib', label: 'Study at the Uniport library', mins: 120, cost: 300, fx: { energy: -10, fun: -5 }, xp: { tech: 4 }, when: { from: 8, to: 20 } },
      { id: 'ph_choba_eat', label: 'Eat at a Choba student canteen', mins: 30, cost: 1200, fx: { hunger: 45 } },
      { id: 'ph_choba_gig', label: 'Type projects for students', mins: 120, earn: 2200, fx: { energy: -8 }, xp: { tech: 2 }, gig: true, when: { from: 8, to: 22 } }
    ],
    ph_rumuokoro: [
      { id: 'ph_carniriv', label: 'Port Harcourt carnival (Carniriv)', mins: 300, cost: 5000, fx: { fun: 60, social: 35, energy: -25 }, event: true, when: { months: [11], days: [4,5,6], from: 14, to: 24 } },
      { id: 'ph_pleasure', label: 'Relax at Pleasure Park', mins: 120, cost: 1000, fx: { fun: 25, social: 10, stress: -10 }, when: { from: 9, to: 19 } },
      { id: 'ph_rumu_gig', label: 'Conduct buses at Rumuokoro park', mins: 180, earn: 2800, fx: { energy: -18, hygiene: -10 }, xp: { hustle: 2 }, gig: true, when: { from: 5, to: 21 } }
    ],
    ph_gra: [
      { id: 'ph_night', label: 'Night out in GRA', mins: 240, cost: 12000, fx: { fun: 55, social: 40, energy: -35, hygiene: -15 }, special: 'club', when: { days: [4,5], from: 21, to: 24 } },
      { id: 'ph_gra_film', label: 'Watch a film at the PH mall', mins: 150, cost: 4500, fx: { fun: 40, social: 10, stress: -10 }, when: { from: 11, to: 23 } },
      { id: 'ph_gra_gig', label: 'Valet parking in GRA', mins: 180, earn: 3500, fx: { energy: -12 }, xp: { charisma: 1 }, gig: true, when: { from: 17, to: 24 } },
      { id: 'ph_obiwali', label: 'See a show at the cultural centre', mins: 120, cost: 3000, fx: { fun: 26, social: 10 }, when: { from: 16, to: 22 } },
      { id: 'ph_garrison', label: 'Buy roasted corn and ube at Garrison junction', mins: 30, cost: 900, fx: { hunger: 30, fun: 4 }, when: { from: 10, to: 22 } }
    ],
    ph_transamadi: [
      { id: 'ph_canteen', label: 'Eat at a yard canteen', mins: 30, cost: 1500, fx: { hunger: 45 } },
      { id: 'ph_yard_gig', label: 'Day labour at a Trans-Amadi yard', mins: 300, earn: 4500, fx: { energy: -30, hygiene: -15 }, xp: { craft: 2, fitness: 1 }, gig: true, when: { days: [0,1,2,3,4,5], from: 6, to: 15 } },
      { id: 'ph_zoo', label: 'Visit the zoo', mins: 90, cost: 1500, fx: { fun: 20, stress: -6 }, when: { from: 9, to: 17 } },
      { id: 'ph_cranes', label: 'Watch the cranes at the river port', mins: 45, fx: { fun: 8 }, when: { from: 7, to: 18 } }
    ],
    ph_dline: [
      { id: 'ph_mile1_food', label: 'Buy foodstuff at Mile 1 (7 meals)', mins: 60, cost: 6000, special: 'pantry7', when: { from: 7, to: 19 } },
      { id: 'ph_mile1_gig', label: 'Carry loads at Mile 1 market', mins: 180, earn: 2500, fx: { energy: -20, hygiene: -12 }, xp: { hustle: 2, fitness: 1 }, gig: true, when: { from: 7, to: 18 } }
    ],
    ph_oldgra: [
      { id: 'ph_bole', label: 'Eat bole and fish', mins: 45, cost: 2500, fx: { hunger: 50, fun: 10 } },
      { id: 'ph_bolegame', label: 'Work the bole grill (mini-game)', mins: 180, fx: { energy: -18, hygiene: -12, stress: 5, hunger: 20 }, xp: { cooking: 3, hustle: 1 }, gig: true, minigame: 'bole', when: { from: 11, to: 22 } },
      { id: 'ph_isaac', label: 'Walk in Isaac Boro Park', mins: 60, fx: { fun: 12, stress: -8 }, when: { from: 7, to: 19 } },
      { id: 'ph_oldgra_gig', label: 'Run errands in Old GRA', mins: 150, earn: 2700, fx: { energy: -12 }, xp: { hustle: 2 }, gig: true, when: { from: 8, to: 19 } },
      { id: 'ph_govhouse', label: 'Walk past Brick House, the Government House', mins: 30, fx: { fun: 6 }, when: { from: 8, to: 17 } }
    ],
    ph_borokiri: [
      { id: 'ph_waterfront', label: 'Watch the boats at the waterfront', mins: 60, fx: { fun: 15, stress: -8 }, when: { from: 6, to: 19 } },
      { id: 'ph_fish_gig', label: 'Help fishermen land the catch', mins: 180, earn: 2600, fx: { energy: -20, hygiene: -15 }, xp: { fitness: 1, hustle: 1 }, gig: true, when: { from: 5, to: 12 } },
      { id: 'ph_beach', label: 'Relax at the tourist beach', mins: 120, cost: 1000, fx: { fun: 26, stress: -14, hygiene: -6 }, when: { from: 8, to: 18 } },
      { id: 'ph_bonny', label: 'Take the boat to Bonny Island and back', mins: 300, cost: 12000, fx: { fun: 34, stress: -10, energy: -18 }, when: { from: 7, to: 12 } }
    ],
    mushin: [
      { id: 'mushin_boxing', label: 'Train at a boxing gym', mins: 90, cost: 1500, fx: { energy: -22, hygiene: -20, stress: -12, fun: 10 }, xp: { fitness: 4 }, sport: 'boxing', when: { from: 6, to: 20 } },
      { id: 'mushin_snooker', label: 'Snooker and pool at the joint', mins: 90, cost: 1000, fx: { fun: 25, social: 20 }, sport: 'snooker', when: { from: 12, to: 24 } },
      { id: 'mushin_arm', label: 'Arm-wrestling challenge at the bar (stake ₦2,000, win ₦5,000)', mins: 30, cost: 2000, fx: { fun: 15, social: 15, energy: -5 }, sport: 'armwrestling', special: 'compete', compete: { skill: 'fitness', prize: 5000, name: 'arm-wrestling' }, when: { from: 18, to: 24 } },
      { id: 'mushin_market', label: 'Buy foodstuff at the local market (7 meals)', mins: 45, cost: 4800, special: 'pantry7', when: { from: 7, to: 20 } },
      { id: 'mushin_mamaput', label: 'Eat at Mama Put', mins: 30, cost: 1200, fx: { hunger: 45 } },
      { id: 'mushin_barber', label: 'Gist at the barbershop', mins: 60, fx: { social: 20, fun: 5 }, xp: { charisma: 2 } },
      { id: 'mushin_water', label: 'Sell pure water in go-slow', mins: 120, earn: 1800, fx: { energy: -15, hygiene: -10 }, xp: { hustle: 3 }, gig: true, when: { from: 7, to: 20 } },
      { id: 'mushin_football', label: 'Street football', mins: 60, fx: { fun: 25, energy: -15, hygiene: -20, stress: -8 }, xp: { fitness: 3 }, when: { from: 6, to: 19 } }
    ],
    yaba: [
      { id: 'yaba_makoko', label: 'Boat tour of Makoko, the floating community, with a resident guide (visit respectfully)', mins: 150, cost: 5000, fx: { fun: 15, social: 15, stress: -5 }, xp: { charisma: 1 }, sight: true, when: { from: 9, to: 16 } },
      { id: 'yaba_esports', label: 'E-sports: FIFA tournament at a gaming lounge (₦3,000 entry)', mins: 240, cost: 3000, fx: { fun: 40, social: 20, energy: -10 }, xp: { tech: 1 }, sport: 'esports', special: 'compete', compete: { skill: 'tech', prize: 25000, name: 'FIFA tournament' }, when: { days: [5], from: 14, to: 20 } },
      { id: 'yaba_chess', label: 'Chess and Scrabble club', mins: 120, fx: { fun: 15, social: 15, stress: -5 }, xp: { tech: 2, charisma: 1 }, sport: 'chess', when: { days: [2, 5], from: 16, to: 20 } },
      { id: 'yaba_scrabble', label: 'Scrabble tournament (₦1,000 entry)', mins: 180, cost: 1000, fx: { fun: 20, social: 15 }, xp: { tech: 1 }, sport: 'scrabble', special: 'compete', compete: { skill: 'tech', prize: 15000, name: 'Scrabble tournament' }, when: { days: [6], from: 11, to: 17 } },
      { id: 'yaba_basketball', label: 'Pickup basketball at the court', mins: 90, fx: { fun: 25, social: 15, energy: -20, hygiene: -20 }, xp: { fitness: 3 }, sport: 'basketball', when: { from: 16, to: 20 } },
      { id: 'yaba_typing', label: 'Type assignments for students', mins: 120, earn: 2000, fx: { energy: -8 }, xp: { tech: 2 }, gig: true, when: { from: 8, to: 22 } },
      { id: 'yaba_tejuosho', label: 'Buy foodstuff at Tejuosho (7 meals)', mins: 60, cost: 5000, special: 'pantry7', when: { from: 7, to: 19 } },
      { id: 'yaba_buka', label: 'Eat at a Yaba buka', mins: 30, cost: 1500, fx: { hunger: 45 } },
      { id: 'yaba_library', label: 'Study at the library', mins: 120, cost: 500, fx: { energy: -10, fun: -5 }, xp: { tech: 4 }, when: { from: 8, to: 20 } },
      { id: 'yaba_enrol', label: 'Enrol at UNILAG (part-time)', mins: 60, cost: 150000, special: 'enrol' },
      { id: 'yaba_lecture', label: 'Attend lectures', mins: 180, fx: { energy: -15, fun: -5 }, xp: { tech: 2, charisma: 1 }, special: 'lecture', when: { days: [0,1,2,3,4], from: 8, to: 17 } },
      { id: 'yaba_ielts', label: 'IELTS prep class', mins: 120, cost: 3000, fx: { energy: -10 }, xp: { charisma: 2 }, special: 'ielts_prep', when: { from: 9, to: 19 } },
      { id: 'yaba_hackathon', label: 'Weekend hackathon', mins: 240, fx: { social: 25, energy: -25, fun: 15 }, xp: { tech: 8 }, special: 'hackathon', when: { days: [5,6], from: 9, to: 18 } },
      { id: 'yaba_cchub', label: 'Startup meetup at the Yaba tech hub', mins: 150, fx: { social: 20, fun: 10, energy: -10 }, xp: { tech: 3, charisma: 2 }, when: { days: [1,3], from: 17, to: 21 } },
    ],
    surulere: [
      { id: 'suru_npfl', label: 'Watch an NPFL league match at Teslim Balogun Stadium', mins: 150, cost: 2000, fx: { fun: 35, social: 25, stress: -8 }, sport: 'football', when: { days: [6], from: 15, to: 19 } },
      { id: 'suru_5aside', label: 'Five-a-side tournament (team entry ₦2,000)', mins: 150, cost: 2000, fx: { fun: 35, social: 25, energy: -25, hygiene: -25 }, xp: { fitness: 3 }, sport: 'football', special: 'compete', compete: { skill: 'fitness', prize: 20000, name: 'five-a-side' }, when: { days: [5], from: 9, to: 14 } },
      { id: 'suru_track', label: 'Athletics: sprints on the Teslim Balogun track', mins: 90, fx: { energy: -22, hygiene: -20, stress: -10 }, xp: { fitness: 4 }, sport: 'athletics', when: { from: 6, to: 10 } },
      { id: 'suru_wrestling', label: 'Wrestling, judo and weightlifting at the youth centre', mins: 90, cost: 1000, fx: { energy: -22, hygiene: -20, stress: -8 }, xp: { fitness: 4 }, sport: 'wrestling', when: { days: [0, 1, 2, 3, 4, 5], from: 15, to: 20 } },
      { id: 'suru_danfo', label: 'Drive a danfo: the Ojuelegba run (mini-game)', mins: 180, fx: { energy: -18, stress: 8, hygiene: -10 }, xp: { hustle: 2 }, gig: true, minigame: 'danfo', when: { from: 6, to: 21 } },
      { id: 'suru_match', label: 'Super Eagles match at the National Stadium', mins: 180, cost: 3000, fx: { fun: 40, social: 25, stress: -10 }, event: true, when: { days: [5], from: 15, to: 19 } },
      { id: 'suru_recharge', label: 'Sell recharge cards by the stadium', mins: 180, earn: 2300, fx: { energy: -10, social: 5 }, xp: { hustle: 3 }, gig: true, when: { from: 7, to: 21 } },
      { id: 'suru_market', label: 'Buy foodstuff at the market (7 meals)', mins: 45, cost: 5000, special: 'pantry7', when: { from: 7, to: 19 } },
      { id: 'suru_amala', label: 'Eat amala and ewedu', mins: 45, cost: 1800, fx: { hunger: 55, fun: 5 } },
      { id: 'suru_stadium', label: 'Train at the National Stadium', mins: 90, fx: { energy: -20, fun: 10, hygiene: -25, stress: -10 }, xp: { fitness: 5 }, when: { from: 6, to: 19 } },
      { id: 'suru_studio', label: 'Book studio time', mins: 120, cost: 5000, fx: { fun: 15, energy: -10 }, xp: { music: 6 }, when: { from: 10, to: 23 } },
      { id: 'suru_theatre', label: 'See a play at the National Theatre', mins: 150, cost: 3000, fx: { fun: 35, social: 10, stress: -8 }, xp: { charisma: 1 }, when: { days: [4,5,6], from: 15, to: 22 } },
      { id: 'suru_danceoff', label: 'Owambe dance-off (mini-game)', mins: 120, cost: 3000, fx: { fun: 35, social: 30, hunger: 40, energy: -25 }, xp: { charisma: 2, fitness: 1 }, minigame: 'dance', when: { days: [5], from: 12, to: 20 } },
      { id: 'suru_peppersoup', label: 'Pepper soup and asun at the joint', mins: 60, cost: 4000, fx: { hunger: 50, social: 15, fun: 10 }, when: { from: 17, to: 24 } },
      { id: 'suru_dec_wedding', label: 'December wedding owambe (aso-ebi season)', mins: 300, cost: 10000, fx: { fun: 55, social: 55, hunger: 70, energy: -25 }, xp: { charisma: 2 }, special: 'owambe', event: true, dec: true, when: { months: [11], days: [5, 6], from: 11, to: 20 } },
      { id: 'suru_owambe', label: 'Attend an owambe', mins: 240, cost: 3000, fx: { fun: 40, social: 40, hunger: 60, energy: -20 }, xp: { charisma: 2 }, special: 'owambe', when: { days: [5], from: 12, to: 19 } }
    ],
    ikeja: [
      { id: 'ikeja_newair_labour', label: 'Day shift on the apron crew at the new international airport', mins: 540, earn: 4500, fx: { energy: -45, hygiene: -30, stress: 10 }, xp: { hustle: 2 }, gig: true, when: { days: [1,2,3,4,5,6], from: 7, to: 9 } },
      { id: 'ikeja_newair_tour', label: 'Watch the planes from the new terminal viewing deck', mins: 90, cost: 1000, fx: { fun: 10, stress: -5 }, when: { from: 9, to: 17 } },
      { id: 'ikeja_kalakuta', label: 'Kalakuta Republic Museum: Fela\'s home and the story of Afrobeat', mins: 90, cost: 2000, fx: { fun: 25, stress: -8 }, xp: { music: 2 }, sight: true, when: { from: 10, to: 18 } },
      { id: 'ikeja_jjt', label: 'Unwind at Johnson Jakande Tinubu (JJT) Park', mins: 60, fx: { fun: 12, stress: -12 }, sight: true, when: { from: 9, to: 19 } },
      { id: 'ikeja_tabletennis', label: 'Table tennis at the community centre', mins: 60, cost: 500, fx: { fun: 20, social: 15, energy: -8 }, xp: { fitness: 2 }, sport: 'tabletennis', when: { from: 10, to: 20 } },
      { id: 'ikeja_badminton', label: 'Badminton at the indoor hall', mins: 60, cost: 1500, fx: { fun: 20, energy: -12, hygiene: -10 }, xp: { fitness: 2 }, sport: 'badminton', when: { from: 9, to: 20 } },
      { id: 'ikeja_ayo', label: 'Ayo olopon, ludo and draughts with the elders', mins: 60, fx: { fun: 15, social: 25, stress: -8 }, xp: { charisma: 1 }, sport: 'ayo', when: { from: 10, to: 19 } },
      { id: 'ikeja_air_lounge', label: 'Premium lounge: shower, buffet, quiet', mins: 60, cost: 30000, fx: { hunger: 40, hygiene: 25, energy: 10, stress: -12, fun: 6 } },
      { id: 'ikeja_air_spot', label: 'Plane-spotting at the apron window', mins: 30, fx: { fun: 6, stress: -3 } },
      { id: 'ikeja_felabration', label: 'Felabration night at the Shrine', mins: 300, cost: 5000, fx: { fun: 70, social: 40, energy: -25, stress: -15 }, xp: { music: 3 }, special: 'club', event: true, when: { months: [9], from: 19, to: 24 } },
      { id: 'ikeja_cv_learn', label: 'Learn repairs at Computer Village', mins: 120, cost: 1000, fx: { energy: -10 }, xp: { craft: 5 }, when: { days: [0,1,2,3,4,5], from: 9, to: 18 } },
      { id: 'ikeja_cv_gig', label: 'Fix phones for walk-ins', mins: 120, earn: 2600, fx: { energy: -10 }, xp: { craft: 3 }, gig: true, req: { craft: 2 }, when: { from: 9, to: 19 } },
      { id: 'ikeja_cinema', label: 'Watch a film at the mall', mins: 150, cost: 4000, fx: { fun: 40, social: 10, stress: -10 }, when: { from: 11, to: 23 } },
      { id: 'ikeja_ielts', label: 'Sit the IELTS exam', mins: 240, cost: 320000, special: 'ielts_exam', when: { days: [5], from: 8, to: 12 } },
      { id: 'ikeja_super', label: 'Supermarket shop at the mall (7 meals)', mins: 60, cost: 7000, special: 'pantry7', when: { from: 9, to: 21 } },
      { id: 'ikeja_dubai', label: 'Weekend in Dubai on your private jet', mins: 2880, cost: 2500000, fx: { fun: 80, social: 40, stress: -40 }, needsVehicle: 'jet' },
      { id: 'ikeja_shrine', sight: true, label: 'Live Afrobeat at the New Afrika Shrine', mins: 180, cost: 2000, fx: { fun: 40, social: 25, stress: -10, energy: -15 }, when: { days: [3,4,5,6], from: 20, to: 24 } },
      { id: 'ikeja_park', label: 'Picnic at Ndubuisi Kanu Park', mins: 90, fx: { fun: 15, social: 10, stress: -12 }, when: { from: 7, to: 19 } },
      { id: 'ikeja_suya', label: 'Suya by the roadside', mins: 30, cost: 1500, fx: { hunger: 35, fun: 5 }, when: { from: 17, to: 24 } }
    ],
    oshodi: [
      { id: 'oshodi_hawkgame', label: 'Hawk in the go-slow (mini-game)', mins: 180, fx: { energy: -20, hygiene: -15, stress: 6 }, xp: { hustle: 4 }, gig: true, minigame: 'hawk', when: { from: 6, to: 21 } },
      { id: 'oshodi_hawk', label: 'Hawk in traffic', mins: 180, earn: 2800, fx: { energy: -20, hygiene: -15, stress: 6 }, xp: { hustle: 4 }, gig: true, when: { from: 6, to: 21 } },
      { id: 'oshodi_market', label: 'Buy foodstuff (7 meals)', mins: 60, cost: 4500, special: 'pantry7' },
      { id: 'oshodi_bukka', label: 'Eat at a bukka', mins: 30, cost: 1000, fx: { hunger: 40 } }
    ],
    island: [
      { id: 'island_jrandle', label: 'J. Randle Centre for Yoruba Culture and History', mins: 90, cost: 2500, fx: { fun: 22, stress: -8 }, xp: { charisma: 1 }, sight: true, when: { days: [1, 2, 3, 4, 5, 6], from: 10, to: 18 } },
      { id: 'island_cricket', label: 'Cricket at the Onikan ground', mins: 180, cost: 2000, fx: { fun: 25, social: 20, energy: -15 }, xp: { fitness: 2 }, sport: 'cricket', when: { days: [5, 6], from: 9, to: 16 } },
      { id: 'island_handball', label: 'Handball and volleyball at Mobolaji Johnson Arena', mins: 90, cost: 500, fx: { fun: 25, social: 20, energy: -18, hygiene: -15 }, xp: { fitness: 3 }, sport: 'handball', when: { from: 15, to: 20 } },
      { id: 'island_eyo', label: 'Watch the Eyo festival procession', mins: 240, fx: { fun: 45, social: 25, energy: -15 }, event: true, when: { months: [0], days: [5], from: 8, to: 16 } },
      { id: 'island_balogun', sight: true, label: 'Haggle at Balogun market', mins: 60, fx: { fun: 5, energy: -5 }, xp: { hustle: 3, charisma: 1 }, when: { days: [0,1,2,3,4,5], from: 8, to: 18 } },
      { id: 'island_worship', label: 'Worship at church or mosque', mins: 90, fx: { stress: -25, social: 15 } },
      { id: 'island_checkup', label: 'Check-up at General Hospital', mins: 120, cost: 8000, fx: { stress: -10, energy: 10 } },
      { id: 'island_welfare', label: 'Free meal at the church or mosque welfare', mins: 60, fx: { hunger: 40, stress: 5 }, special: 'welfare', when: { from: 7, to: 19 } },
      { id: 'island_alaaru', label: 'Carry loads at Balogun (alaaru)', mins: 180, earn: 2200, fx: { energy: -22, hygiene: -15 }, xp: { hustle: 3, fitness: 1 }, gig: true, when: { days: [0,1,2,3,4,5], from: 7, to: 18 } },
      { id: 'island_freedom', sight: true, label: 'Live music at Freedom Park', mins: 120, cost: 1000, fx: { fun: 30, social: 20, stress: -10 }, when: { from: 16, to: 23 } },
      { id: 'island_museum', sight: true, label: 'Visit the National Museum', mins: 90, cost: 500, fx: { fun: 12, stress: -5 }, xp: { charisma: 1 }, when: { days: [0,1,2,3,4,5], from: 9, to: 17 } },
      { id: 'island_dec_tbs', label: 'Homecoming concert at Tafawa Balewa Square', mins: 300, cost: 30000, fx: { fun: 85, social: 50, energy: -35, hygiene: -15 }, xp: { music: 1 }, special: 'club', event: true, dec: true, when: { months: [11], days: [4, 5, 6], from: 18, to: 24 } },
      { id: 'island_dec_food', label: 'December food village: jollof, suya, ofada and small chops', mins: 90, cost: 7000, fx: { hunger: 70, fun: 25, social: 15 }, event: true, dec: true, when: { months: [11], from: 12, to: 22 } },
      { id: 'island_ewa', label: 'Ewa agoyin and bread', mins: 30, cost: 1300, fx: { hunger: 45 } },
      // Harbour Live: the fountain and concert ground on its own island in the harbour (linked by three bridges).
      { id: 'isl_harbour_concert', label: 'Headline concert at Harbour Live', mins: 240, cost: 35000, fx: { fun: 35, social: 15, stress: -10, energy: -20 }, when: { days: [4, 5], from: 20, to: 24 } },
      { id: 'isl_harbour_fountain', label: 'Watch the musical fountain show', mins: 30, fx: { fun: 10, stress: -6 }, when: { from: 19, to: 23 } },
      { id: 'isl_harbour_bridges', label: 'Walk the lit link bridges at night', mins: 60, fx: { fun: 8, stress: -5, energy: -5 }, when: { from: 18, to: 24 } },
      { id: 'isl_harbour_food', label: 'Suya and chapman at the Harbour food court', mins: 45, cost: 4500, fx: { hunger: 35, fun: 4 } },
      { id: 'isl_harbour_club', label: 'Lagoon-view lounge at the Harbour private club', mins: 120, cost: 60000, fx: { fun: 20, social: 20, stress: -12 }, when: { from: 18, to: 24 } }
    ],
    vi: [
      { id: 'vi_eko_walk', label: 'Walk the Eko Atlantic sea wall at sunset', mins: 90, cost: 0, fx: { fun: 18, stress: -14, energy: -6 }, sight: true, when: { from: 16, to: 19 } },
      { id: 'vi_eko_brunch', label: 'Brunch on the Eko Atlantic boulevard', mins: 120, cost: 25000, fx: { fun: 22, social: 25, hunger: 50 }, when: { days: [5, 6], from: 11, to: 15 } },
      { id: 'vi_terra', label: 'VI arts centre: an exhibition, a play and Nigerian food', mins: 180, cost: 9000, fx: { fun: 35, hunger: 45, social: 15 }, xp: { charisma: 1 }, sight: true, when: { from: 11, to: 22 } },
      { id: 'vi_beachvolley', label: 'Beach volleyball on Bar Beach', mins: 90, fx: { fun: 30, social: 20, energy: -15, hygiene: -15 }, xp: { fitness: 2 }, sport: 'beachvolley', when: { from: 15, to: 19 } },
      { id: 'vi_darts', label: 'Darts and the match on the big screen at a sports bar', mins: 120, cost: 4000, fx: { fun: 30, social: 25 }, sport: 'darts', when: { from: 17, to: 24 } },
      { id: 'vi_club_late', label: 'Club after midnight: Amapiano till 5 a.m.', mins: 240, cost: 15000, fx: { fun: 60, social: 40, energy: -45, hygiene: -20 }, special: 'club', when: { days: [5, 6], from: 0, to: 4 } },
      { id: 'vi_spray', label: 'Spray money at the club (bottle service and a VIP table)', mins: 240, cost: 120000, fx: { fun: 75, social: 60, energy: -40, hygiene: -15 }, xp: { charisma: 2 }, special: 'spray', when: { days: [4, 5, 6], from: 22, to: 24 } },
      { id: 'vi_flex', label: 'Car meet: park and flex outside the club', mins: 90, fx: { social: 30, fun: 20 }, special: 'flex', when: { days: [4, 5, 6], from: 21, to: 24 } },
      { id: 'vi_appearance', label: 'Paid appearance at a club night (creators with 20k+ followers)', mins: 180, fx: { social: 35, fun: 25, energy: -25 }, xp: { charisma: 2 }, special: 'appearance', when: { days: [4, 5], from: 21, to: 24 } },
      { id: 'vi_brunch', label: 'Brunch and day drinks', mins: 180, cost: 18000, fx: { hunger: 55, fun: 30, social: 30 }, when: { days: [5, 6], from: 11, to: 16 } },
      { id: 'vi_suya', label: 'Late-night suya by the roadside', mins: 30, cost: 3000, fx: { hunger: 40, fun: 10 }, when: { from: 20, to: 24 } },
      { id: 'vi_landmark', sight: true, label: 'Beach day at the Oniru beach club: cabana and seafood grill', mins: 300, cost: 20000, fx: { fun: 50, social: 30, hunger: 45, stress: -20, hygiene: -10 }, when: { from: 11, to: 19 } },
      { id: 'vi_jetski', label: 'Jet ski ride off Oniru', mins: 60, cost: 25000, fx: { fun: 40, stress: -10, energy: -10 }, xp: { fitness: 1 }, when: { from: 11, to: 18 } },
      { id: 'vi_fashion', label: 'Fashion pop-up and art market', mins: 120, cost: 5000, fx: { fun: 25, social: 25 }, xp: { charisma: 1 }, when: { days: [5], from: 12, to: 19 } },
      { id: 'vi_dec_headline', label: 'Headline Afrobeats concert at Eko Convention Centre', mins: 300, cost: 60000, fx: { fun: 90, social: 55, energy: -40, hygiene: -15 }, xp: { music: 1 }, special: 'club', event: true, dec: true, when: { months: [11], days: [4, 5, 6], from: 19, to: 24 } },
      { id: 'vi_dec_vip', label: 'VIP table at the headline concert (bottle service)', mins: 300, cost: 450000, fx: { fun: 95, social: 70, energy: -40, hygiene: -15 }, xp: { charisma: 3 }, special: 'club', event: true, dec: true, when: { months: [11], days: [4, 5, 6], from: 19, to: 24 } },
      { id: 'vi_dec_afterparty', label: 'After-party till 5 a.m.', mins: 240, cost: 20000, fx: { fun: 50, social: 35, energy: -45, hygiene: -20 }, special: 'club', event: true, dec: true, when: { months: [11], from: 1, to: 4 } },
      { id: 'vi_dec_festival', label: 'Detty December festival on the beach', mins: 360, cost: 40000, fx: { fun: 85, social: 55, energy: -40, hygiene: -20 }, special: 'club', event: true, when: { months: [11], days: [5,6], from: 16, to: 24 } },
      { id: 'vi_carwash', label: 'Wash cars outside the banks', mins: 180, earn: 2800, fx: { energy: -15, hygiene: -10 }, xp: { hustle: 2 }, gig: true, when: { days: [0,1,2,3,4,5], from: 8, to: 18 } },
      { id: 'vi_lounge', label: 'Network at a lounge', mins: 120, cost: 8000, fx: { social: 25, fun: 10 }, xp: { charisma: 5 }, when: { from: 17, to: 24 } },
      { id: 'vi_club', label: 'Club night', mins: 240, cost: 15000, fx: { fun: 60, social: 40, energy: -40, hygiene: -20 }, special: 'club', when: { days: [4,5], from: 21, to: 24 } },
      { id: 'vi_restaurant', label: 'Eat at a restaurant', mins: 60, cost: 12000, fx: { hunger: 60, fun: 15 } },
      { id: 'vi_park', label: 'Relax at Muri Okunola Park', mins: 60, fx: { fun: 10, stress: -10 }, when: { from: 6, to: 20 } },
      { id: 'vi_beach', label: 'Walk Bar Beach at dusk', mins: 60, fx: { fun: 15, stress: -12 }, when: { from: 16, to: 20 } },
      { id: 'vi_quilox', label: 'VIP table at Crown Lounge', mins: 300, cost: 250000, fx: { fun: 80, social: 55, energy: -45, hygiene: -20 }, xp: { charisma: 3 }, special: 'club', when: { days: [4,5,6], from: 22, to: 24 } },
      { id: 'vi_quilox_door', label: 'Queue at the Crown Lounge door', mins: 120, cost: 20000, fx: { fun: 30, social: 20, energy: -20 }, special: 'club', when: { days: [4,5], from: 22, to: 24 } },
    ],
    ikoyi: [
      { id: 'ikoyi_tarkwa', label: 'Boat to Tarkwa Bay: a calm beach reachable only by water', mins: 360, cost: 8000, fx: { fun: 50, stress: -25, social: 15, hygiene: -10 }, sight: true, when: { from: 9, to: 14 } },
      { id: 'ikoyi_tennis', label: 'Tennis at the Ikoyi club courts', mins: 90, cost: 8000, fx: { fun: 20, social: 15, energy: -15, hygiene: -15 }, xp: { fitness: 3, charisma: 1 }, sport: 'tennis', when: { from: 7, to: 19 } },
      { id: 'ikoyi_swim', label: 'Swim laps at the club pool', mins: 60, cost: 5000, fx: { fun: 15, stress: -12, energy: -12, hygiene: 10 }, xp: { fitness: 3 }, sport: 'swimming', when: { from: 7, to: 19 } },
      { id: 'ikoyi_golf', label: 'A round of golf at Ikoyi', mins: 300, cost: 35000, fx: { fun: 25, social: 25, stress: -15, energy: -15 }, xp: { charisma: 3 }, sport: 'golf', when: { from: 7, to: 14 } },
      { id: 'ikoyi_polo', label: 'Watch polo at the polo grounds', mins: 180, cost: 15000, fx: { fun: 30, social: 30 }, xp: { charisma: 2 }, sport: 'polo', when: { days: [5, 6], from: 14, to: 18 } },
      { id: 'ikoyi_ilashe', label: 'Boat to a private beach at Ilashe (day trip)', mins: 480, cost: 60000, fx: { fun: 70, social: 40, stress: -30, hunger: 40, hygiene: -10 }, when: { days: [5, 6], from: 9, to: 12 } },
      { id: 'ikoyi_dec_yacht', label: 'Lagoon yacht party', mins: 300, cost: 150000, fx: { fun: 80, social: 60, energy: -25, stress: -15 }, xp: { charisma: 2 }, event: true, dec: true, when: { months: [11], days: [5, 6], from: 13, to: 20 } },
      { id: 'ikoyi_dec_cruise', label: 'Lagoon boat cruise', mins: 120, cost: 20000, fx: { fun: 45, social: 30, stress: -15 }, event: true, dec: true, when: { months: [11], from: 10, to: 18 } },
      { id: 'ikoyi_garden', label: 'Tend a madam\'s garden', mins: 180, earn: 3000, fx: { energy: -15, hygiene: -10 }, xp: { craft: 2 }, gig: true, when: { days: [0,1,2,3,4,5], from: 7, to: 17 } },
      { id: 'ikoyi_jog', label: 'Jog around the park', mins: 60, fx: { energy: -12, fun: 10, hygiene: -15, stress: -12 }, xp: { fitness: 3 }, when: { from: 6, to: 19 } },
      { id: 'ikoyi_gallery', label: 'Visit an art gallery', mins: 90, cost: 2000, fx: { fun: 20, social: 10, stress: -8 }, when: { from: 10, to: 18 } },
      { id: 'ikoyi_dine', label: 'Fine dining', mins: 90, cost: 25000, fx: { hunger: 70, fun: 25, social: 10 }, when: { from: 12, to: 23 } }
    ],
    lekki: [
      { id: 'lekki_nike', label: 'Lekki art gallery: five floors of Nigerian paintings, textiles and sculpture', mins: 120, fx: { fun: 25, stress: -10 }, xp: { charisma: 1 }, sight: true, when: { from: 10, to: 18 } },
      { id: 'lekki_crafts', label: 'Souvenirs at the Lekki Arts and Crafts Market', mins: 90, cost: 3000, fx: { fun: 20, social: 10 }, sight: true, when: { from: 9, to: 18 } },
      { id: 'lekki_flagfootball', label: 'Flag football league game', mins: 150, cost: 3000, fx: { fun: 35, social: 25, energy: -22, hygiene: -20 }, xp: { fitness: 4 }, sport: 'flagfootball', when: { days: [5], from: 9, to: 13 } },
      { id: 'lekki_cycling', label: 'Weekend ride down the Lekki–Epe expressway', mins: 150, fx: { fun: 20, stress: -15, energy: -25, hygiene: -20 }, xp: { fitness: 4 }, sport: 'cycling', when: { days: [6], from: 6, to: 10 } },
      { id: 'lekki_shisha', label: 'Shisha lounge and Amapiano', mins: 180, cost: 12000, fx: { fun: 40, social: 35, energy: -15 }, when: { from: 19, to: 24 } },
      { id: 'lekki_rooftop', label: 'Rooftop session with a DJ', mins: 240, cost: 20000, fx: { fun: 55, social: 40, energy: -30 }, special: 'club', when: { days: [4, 5], from: 21, to: 24 } },
      { id: 'lekki_glam', label: 'Get "outside" ready: hair, make-up and nails', mins: 150, cost: 25000, fx: { stress: -5, fun: 10 }, special: 'glam', when: { from: 9, to: 19 } },
      { id: 'lekki_dec_pool', label: 'Rooftop pool party (every night in December)', mins: 240, cost: 30000, fx: { fun: 65, social: 45, energy: -30, hygiene: -5 }, special: 'club', event: true, dec: true, when: { months: [11], from: 20, to: 24 } },
      { id: 'lekki_dec_nye', label: 'New Year\'s Eve fireworks at the Lekki–Ikoyi Link Bridge', mins: 240, fx: { fun: 70, social: 45, energy: -20, stress: -20 }, event: true, dec: true, when: { months: [11], lastDay: true, from: 20, to: 24 } },
      { id: 'lekki_dec_concert', label: 'Detty December beach concert at Elegushi', mins: 300, cost: 25000, fx: { fun: 80, social: 50, energy: -35, hygiene: -15 }, special: 'club', event: true, when: { months: [11], days: [4,5,6], from: 18, to: 24 } },
      { id: 'lekki_errands', label: 'Run errands in the estate', mins: 120, earn: 2200, fx: { energy: -10 }, xp: { hustle: 2, charisma: 1 }, gig: true, when: { from: 8, to: 20 } },
      { id: 'lekki_beach', label: 'Beach day', mins: 180, cost: 2000, fx: { fun: 45, social: 20, hygiene: -15, stress: -15 }, when: { from: 9, to: 18 } },
      { id: 'lekki_palms_film', label: 'Watch a film at the Lekki mall', mins: 150, cost: 5000, fx: { fun: 40, social: 10, stress: -10 }, when: { from: 11, to: 23 } },
      { id: 'lekki_palms_shop', label: 'Window shop and eat at the Lekki mall', mins: 90, cost: 6000, fx: { hunger: 40, fun: 20, stress: -8 }, when: { from: 10, to: 21 } },
      { id: 'lekki_island', label: 'Day on a private island (by your own boat)', mins: 480, cost: 5000000, fx: { fun: 90, social: 40, stress: -50, energy: -10 }, needsVehicle: 'boat', when: { from: 7, to: 15 } },
      { id: 'lekki_elegushi', sight: true, label: 'Beach party at Elegushi', mins: 240, cost: 5000, fx: { fun: 55, social: 35, stress: -15, hygiene: -15, energy: -15 }, when: { days: [5,6], from: 12, to: 22 } },
      { id: 'lekki_lcc', sight: true, label: 'Canopy walk at the Conservation Centre', mins: 150, cost: 3000, fx: { fun: 35, stress: -15, energy: -10 }, xp: { fitness: 1 }, when: { from: 8, to: 17 } },
      { id: 'lekki_gym', label: 'Gym class', mins: 90, cost: 3000, fx: { energy: -18, hygiene: -20, stress: -10 }, xp: { fitness: 6 }, when: { from: 6, to: 21 } },
      { id: 'lekki_content', label: 'Shoot content', mins: 120, fx: { fun: 10, energy: -8 }, xp: { charisma: 3, music: 1 }, special: 'content', when: { from: 8, to: 20 } },
      { id: 'lekki_super', label: 'Supermarket shop (7 meals)', mins: 45, cost: 7500, special: 'pantry7', when: { from: 8, to: 21 } },
      { id: 'lekki_cafe', label: 'Brunch at a café', mins: 60, cost: 6000, fx: { hunger: 50, fun: 10 } },
      { id: 'lekki_hp_walk', label: 'Walk the Lekki Hyde Park lagoon promenade', mins: 45, fx: { fun: 10, stress: -8 }, when: { from: 6, to: 19 } },
      { id: 'lekki_hp_tennis', label: 'Play tennis at the Hyde Park courts', mins: 60, cost: 8000, fx: { fun: 18, energy: -12, stress: -6 }, xp: { fitness: 1 }, when: { from: 6, to: 20 } }
    ],
    ajah: [
      { id: 'ajah_eleko', label: 'Beach day at Eleko beach, out on the Lekki–Epe coast', mins: 420, cost: 4000, fx: { fun: 45, stress: -25, energy: -15, hygiene: -15 }, sight: true, when: { from: 8, to: 14 } },
      { id: 'ajah_dec_rave', label: 'Beach rave at a beach resort (day into night)', mins: 360, cost: 15000, fx: { fun: 75, social: 50, energy: -35, hygiene: -25, stress: -10 }, special: 'club', event: true, dec: true, when: { months: [11], from: 12, to: 23 } },
      { id: 'ajah_market', label: 'Buy foodstuff at Ajah market (7 meals)', mins: 45, cost: 5000, special: 'pantry7', when: { from: 7, to: 19 } },
      { id: 'ajah_spot', label: 'Eat at a local spot', mins: 30, cost: 1500, fx: { hunger: 45 } },
      { id: 'ajah_sand_day', label: 'Beach day on the white sand, Ibeju-Lekki', mins: 300, cost: 3000, fx: { fun: 40, stress: -25, energy: -10, hygiene: -12 }, sight: true, when: { from: 8, to: 16 } },
      { id: 'ajah_horse', label: 'Horse ride along the beach', mins: 60, cost: 8000, fx: { fun: 30, stress: -12, energy: -8 }, when: { from: 8, to: 17 } },
      { id: 'ajah_quad', label: 'Quad bike on the dunes', mins: 60, cost: 15000, fx: { fun: 38, stress: -10, energy: -10, hygiene: -10 }, when: { from: 9, to: 17 } },
      { id: 'ajah_jetski', label: 'Jet ski on the clear water', mins: 30, cost: 25000, fx: { fun: 42, stress: -10, energy: -8 }, when: { from: 9, to: 17 } },
      { id: 'ajah_banana', label: 'Banana boat with your crew', mins: 30, cost: 6000, fx: { fun: 28, social: 20, hygiene: -10 }, when: { from: 9, to: 17 } },
      { id: 'ajah_parasail', label: 'Parasail over the Atlantic', mins: 45, cost: 35000, fx: { fun: 50, stress: -15 }, when: { days: [5, 6], from: 10, to: 16 } },
      { id: 'ajah_kayak', label: 'Kayak or paddleboard in the shallows', mins: 60, cost: 5000, fx: { fun: 22, stress: -14, energy: -12 }, when: { from: 8, to: 17 } },
      { id: 'ajah_ref_labour', label: 'Day shift as a plant hand at the refinery', mins: 540, earn: 4500, fx: { energy: -45, hygiene: -30, stress: 10 }, xp: { hustle: 2 }, gig: true, when: { days: [1,2,3,4,5,6], from: 7, to: 9 } },
      { id: 'ajah_ref_tour', label: 'Watch the tankers come in from the refinery viewing point', mins: 90, cost: 1000, fx: { fun: 10, stress: -5 }, when: { from: 9, to: 17 } },
      { id: 'ajah_ref_plant', label: 'Plant tour in a hard hat: the columns and the control room', mins: 120, cost: 3500, fx: { fun: 12, stress: -4 }, xp: { craft: 1 }, when: { days: [0,1,2,3,4], from: 9, to: 15 } },
      { id: 'ajah_ref_flare', label: 'Watch the flare stacks light up the evening', mins: 30, fx: { fun: 6, stress: -3 }, when: { from: 18, to: 22 } },
      { id: 'ajah_ref_jetty', label: 'Watch a tanker berth at the jetty', mins: 45, fx: { fun: 6, stress: -2 }, when: { from: 7, to: 18 } },
      { id: 'ajah_ref_shadow', label: 'Shadow a crew at the loading gantry (unpaid)', mins: 240, fx: { energy: -25, hygiene: -15 }, xp: { craft: 2 }, when: { days: [0,1,2,3,4,5], from: 7, to: 13 } },
      { id: 'ajah_ref_canteen', label: 'Staff canteen: rice, stew and plantain', mins: 30, cost: 1800, fx: { hunger: 45 } },
      // The airport site moved to Ikeja; these stay (hidden) so lives that used them still replay.
      { id: 'ajah_air_labour', retired: true, label: 'Day labour on the new airport site', mins: 540, earn: 4500, fx: { energy: -45, hygiene: -30, stress: 10 }, xp: { hustle: 2 }, gig: true, when: { days: [1,2,3,4,5,6], from: 7, to: 9 } },
      { id: 'ajah_air_tour', retired: true, label: 'Watch the new airport go up from the viewing point', mins: 90, cost: 1000, fx: { fun: 10, stress: -5 }, when: { from: 9, to: 17 } },
      { id: 'ajah_shop', label: "Help at a cousin's shop", mins: 180, earn: 2400, fx: { energy: -12 }, xp: { hustle: 3 }, gig: true, when: { days: [0,1,2,3,4,5], from: 8, to: 19 } }
    ],
    ikorodu: [
      { id: 'iko_giwa', label: 'Water slides and pools at Giwa Gardens water park', mins: 300, cost: 10000, fx: { fun: 55, social: 20, energy: -20, stress: -15 }, sight: true, when: { days: [4, 5, 6], from: 10, to: 17 } },
      { id: 'iko_market', label: 'Buy farm foodstuff (7 meals)', mins: 60, cost: 3500, special: 'pantry7' },
      { id: 'iko_sawmill', label: 'Help at the sawmill', mins: 180, earn: 2400, fx: { energy: -22, hygiene: -20 }, xp: { craft: 4 }, gig: true, when: { days: [0,1,2,3,4,5], from: 7, to: 17 } },
      { id: 'iko_eat', label: 'Eat at a canteen', mins: 30, cost: 1000, fx: { hunger: 40 } }
    ],
    festac: [
      { id: 'festac_badagry', label: 'Day trip to Badagry: the Point of No Return, the slave trade museums and Nigeria\'s first storey building', mins: 600, cost: 15000, fx: { fun: 15, stress: -5, energy: -20 }, xp: { charisma: 2 }, sight: true, when: { from: 7, to: 10 } },
      { id: 'festac_park', label: 'Hang out at the park', mins: 90, fx: { social: 20, fun: 15, stress: -8 } },
      { id: 'festac_tailor', label: "Tailor's apprentice", mins: 180, earn: 2200, fx: { energy: -10 }, xp: { craft: 4 }, gig: true, when: { days: [0,1,2,3,4,5], from: 8, to: 18 } },
      { id: 'festac_market', label: 'Buy foodstuff at the market (7 meals)', mins: 45, cost: 5000, special: 'pantry7', when: { from: 7, to: 19 } },
      { id: 'festac_eat', label: 'Eat at a Festac buka', mins: 30, cost: 1300, fx: { hunger: 45 } }
    ]
  };

  // Key places on the map. Public landmarks by their own names; venues are
  // described, never branded. x/y are km on the same map as DISTRICTS.
  var PLACE_TYPES = {
    nightlife: { name: 'Nightlife', color: '#c2417f' },
    culture:   { name: 'Culture', color: '#6b4fbf' },
    outdoors:  { name: 'Parks and beaches', color: '#3f8f55' },
    food:      { name: 'Food and markets', color: '#d9822b' },
    learn:     { name: 'Work and learning', color: '#2f6fa0' },
    services:  { name: 'Services', color: '#c44b3a' },
    transport: { name: 'Transport', color: '#0f6f78' }
  };
  var PLACES = [
    { id: 'cv', icon: '📱', name: 'Computer Village', type: 'learn', glyph: 'phone', district: 'ikeja', x: 10.8, y: 4.6, acts: ['ikeja_cv_learn', 'ikeja_cv_gig'], text: 'West Africa\'s biggest phone and gadget market. Learn repairs or fix phones for cash.' },
    { id: 'ikeja_mall', icon: '🎬', name: 'Ikeja mall and cinema', type: 'culture', glyph: 'film', district: 'ikeja', x: 9.2, y: 3.4, acts: ['ikeja_cinema', 'ikeja_super'], text: 'Films, air-conditioning and a supermarket under one roof.' },
    { id: 'shrine', icon: '🎷', name: 'New Afrika Shrine', type: 'nightlife', glyph: 'note', district: 'ikeja', x: 11.7, y: 3.2, acts: ['ikeja_felabration', 'ikeja_shrine'], text: 'The home of Afrobeat, built in memory of Fela. Live bands Thursday to Sunday nights.' },
    { id: 'kanu_park', icon: '🌳', name: 'Ndubuisi Kanu Park', type: 'outdoors', glyph: 'tree', district: 'ikeja', x: 10.7, y: 3.1, acts: ['ikeja_park'], text: 'Green lawns in Alausa, busy with picnics at weekends.' },
    { id: 'ielts', icon: '📝', name: 'IELTS test centre', type: 'learn', glyph: 'cap', district: 'ikeja', x: 9.3, y: 4.9, acts: ['ikeja_ielts'], text: 'Saturday morning sittings. The first step to Japa.' },
    { id: 'berger_cars', icon: '🚗', name: 'Berger car mart', type: 'services', glyph: 'car', district: 'ikeja', x: 9.6, y: 5.8, acts: [], dealer: true, text: 'Rows of tokunbo cars, bikes and kekes. Haggle, then drive it home.' },
    { id: 'allen', icon: '🍢', name: 'Allen Avenue suya spots', type: 'food', glyph: 'bowl', district: 'ikeja', x: 11.3, y: 4.0, acts: ['ikeja_suya'], text: 'Smoky suya after dark.' },
    { id: 'airport', icon: '✈️', name: 'Murtala Muhammed Airport', type: 'transport', glyph: 'plane', district: 'ikeja', x: 6.6, y: 0.9, acts: ['ikeja_air_lounge', 'ikeja_air_spot'], text: 'Domestic flights to Abuja and Port Harcourt, and international departures: japa once you pass IELTS and show ₦15m proof of funds.' },
    { id: 'iko_jetty', icon: '⛴️', name: 'Ikorodu ferry terminal', type: 'transport', glyph: 'boat', district: 'ikorodu', x: 27.4, y: 3.9, acts: [], text: 'Ferries to Lagos Island, Ikoyi and Lekki. Beats the road at rush hour.' },
    { id: 'iko_market', icon: '🧺', name: 'Ikorodu farm market', type: 'food', glyph: 'basket', district: 'ikorodu', x: 28.6, y: 2.6, acts: ['iko_market', 'iko_eat'], text: 'The cheapest foodstuff in Lagos, fresh from the farms.' },
    { id: 'sawmill', icon: '🪚', name: 'Ikorodu sawmill', type: 'learn', glyph: 'tool', district: 'ikorodu', x: 29.2, y: 3.4, acts: ['iko_sawmill'], text: 'Hard work, steady cash.' },
    { id: 'oshodi_hub', icon: '🚌', name: 'Oshodi transport interchange', type: 'transport', glyph: 'bus', district: 'oshodi', x: 10.7, y: 9.4, acts: [], text: 'Every danfo, BRT and keke route meets here.' },
    { id: 'oshodi_market', icon: '🛒', name: 'Oshodi market', type: 'food', glyph: 'basket', district: 'oshodi', x: 9.3, y: 8.6, acts: ['oshodi_market', 'oshodi_bukka', 'oshodi_hawk', 'oshodi_hawkgame'], text: 'Buy foodstuff in bulk, eat cheap, hawk in the go-slow.' },
    { id: 'mushin_market', icon: '🧺', name: 'Mushin market', type: 'food', glyph: 'basket', district: 'mushin', x: 10.5, y: 12.4, acts: ['mushin_market', 'mushin_water'], text: 'Local market. Pure water sells fast in the traffic outside.' },
    { id: 'mamaput', icon: '🍲', name: 'Mama Put row', type: 'food', glyph: 'bowl', district: 'mushin', x: 11.7, y: 12.6, acts: ['mushin_mamaput'], text: 'Rice, beans and stew at the price of a danfo ride.' },
    { id: 'barber', icon: '💈', name: 'Barbershop', type: 'services', glyph: 'scissors', district: 'mushin', x: 10.4, y: 13.5, acts: ['mushin_barber'], text: 'Where all the gist happens.' },
    { id: 'pitch', icon: '⚽', name: 'Street football pitch', type: 'outdoors', glyph: 'ball', district: 'mushin', x: 11.4, y: 13.9, acts: ['mushin_football'], text: 'Evening matches, sandals for goalposts.' },
    { id: 'luth', icon: '🏥', name: 'LUTH, Idi-Araba', type: 'services', glyph: 'cross', district: 'mushin', x: 12.1, y: 14.3, acts: [], text: 'Teaching hospital. When you collapse, you wake up at General Hospital on the Island instead.' },
    { id: 'festac_park', icon: '🌳', name: 'Festac park', type: 'outdoors', glyph: 'tree', district: 'festac', x: 2.6, y: 16.4, acts: ['festac_park'], text: 'Quiet green space in the planned town.' },
    { id: 'festac_market', icon: '🧺', name: 'Festac market', type: 'food', glyph: 'basket', district: 'festac', x: 1.6, y: 17.6, acts: ['festac_market', 'festac_eat'], text: 'Foodstuff and a buka on the corner.' },
    { id: 'tailor', icon: '🧵', name: 'Tailor\'s shop', type: 'learn', glyph: 'tool', district: 'festac', x: 2.9, y: 17.6, acts: ['festac_tailor'], text: 'Aso-ebi season keeps the machines running.' },
    { id: 'stadium', icon: '🏟️', name: 'National Stadium', type: 'outdoors', glyph: 'ball', district: 'surulere', x: 9.2, y: 16.6, acts: ['suru_match', 'suru_stadium', 'suru_recharge'], text: 'Run the tracks for free. Sell recharge cards to the crowd.' },
    { id: 'theatre', icon: '🎭', name: 'National Theatre', type: 'culture', glyph: 'mask', district: 'surulere', x: 11.4, y: 18.9, acts: ['suru_theatre'], text: 'The famous military-cap building at Iganmu. Plays Friday to Sunday.' },
    { id: 'studio', icon: '🎙️', name: 'Recording studio', type: 'learn', glyph: 'note', district: 'surulere', x: 10.6, y: 17.4, acts: ['suru_studio'], text: 'Where Afrobeats careers start.' },
    { id: 'owambe_hall', icon: '🎉', name: 'Event hall', type: 'nightlife', glyph: 'note', district: 'surulere', x: 9.5, y: 18.6, acts: ['suru_owambe', 'suru_danceoff', 'suru_dec_wedding'], text: 'Saturday owambes: jollof, small chops, money spraying. Win the dance-off and the guests spray you.' },
    { id: 'amala', icon: '🍲', name: 'Surulere amala joint', type: 'food', glyph: 'bowl', district: 'surulere', x: 10.4, y: 18.7, acts: ['suru_amala'], text: 'Amala, ewedu and gbegiri, eaten with your hand.' },
    { id: 'unilag', icon: '🎓', name: 'University of Lagos', type: 'learn', glyph: 'cap', district: 'yaba', x: 15.6, y: 16.1, acts: ['yaba_enrol', 'yaba_lecture'], text: 'Part-time degrees on weekdays. 30 lectures to graduate.' },
    { id: 'hub', icon: '💡', name: 'Yaba tech hub', type: 'learn', glyph: 'laptop', district: 'yaba', x: 14.5, y: 14.6, acts: ['yaba_cchub', 'yaba_hackathon', 'yaba_typing'], text: 'The tech hub on Herbert Macaulay Way. Tuesday and Thursday meetups, weekend hackathons, freelance typing gigs.' },
    { id: 'library', icon: '📚', name: 'Yaba library', type: 'learn', glyph: 'cap', district: 'yaba', x: 15.5, y: 14.4, acts: ['yaba_library', 'yaba_ielts'], text: 'Quiet study, and IELTS prep classes.' },
    { id: 'tejuosho', icon: '🛍️', name: 'Tejuosho market', type: 'food', glyph: 'basket', district: 'yaba', x: 14.4, y: 15.5, acts: ['yaba_tejuosho', 'yaba_buka'], text: 'Fabric, foodstuff and a busy buka.' },
    { id: 'balogun', icon: '🛍️', name: 'Balogun market', type: 'food', glyph: 'basket', district: 'island', x: 15.6, y: 21.6, acts: ['island_balogun', 'island_alaaru'], text: 'The biggest market on the Island. Haggle, or carry loads for cash.' },
    { id: 'freedom', icon: '🎶', name: 'Freedom Park', type: 'culture', glyph: 'note', district: 'island', x: 16.4, y: 22.6, acts: ['island_eyo', 'island_freedom'], text: 'A former colonial prison turned open-air arts venue. Live music in the evenings.' },
    { id: 'museum', icon: '🏛️', name: 'National Museum, Onikan', type: 'culture', glyph: 'mask', district: 'island', x: 16.9, y: 21.6, acts: ['island_museum'], text: 'Bronzes, masks and Nigerian history.' },
    { id: 'gen_hosp', icon: '🏥', name: 'General Hospital', type: 'services', glyph: 'cross', district: 'island', x: 15.8, y: 22.9, acts: ['island_checkup', 'island_welfare'], text: 'Check-ups, and where you wake up if you collapse.' },
    { id: 'worship', icon: '🛐', name: 'Cathedral and Central Mosque', type: 'services', glyph: 'dome', district: 'island', x: 16.6, y: 21.0, acts: ['island_worship'], text: 'Prayer, peace and free welfare meals when you are broke.' },
    { id: 'harbour_live', icon: '⛲', name: 'Harbour Live: fountain and concert ground', type: 'nightlife', glyph: 'note', district: 'island', x: 12.2, y: 24.6, acts: ['isl_harbour_concert', 'isl_harbour_fountain', 'isl_harbour_bridges', 'isl_harbour_food'], nogem: true, text: 'A new island in the harbour with a musical fountain, an open-air concert ground and a food court, linked to the mainland, Lagos Island and Eko Atlantic by three lit cable-stayed bridges. Big Afrobeats headliners on Friday and Saturday nights.' },
    { id: 'harbour_club', icon: '🥂', name: 'The Harbour private club', type: 'nightlife', glyph: 'glass', district: 'island', x: 12.5, y: 26.0, acts: ['isl_harbour_club'], nogem: true, text: 'Members and their guests, on the far side of Harbour Live: a glass lounge, a pool deck and a jetty looking out over the lagoon.' },
    { id: 'cms', icon: '⛴️', name: 'CMS jetty', type: 'transport', glyph: 'boat', district: 'island', x: 15.0, y: 22.3, acts: [], text: 'Ferries to Ikorodu and Lekki.' },
    { id: 'ewa', icon: '🫘', name: 'Ewa agoyin stall', type: 'food', glyph: 'bowl', district: 'island', x: 15.4, y: 21.1, acts: ['island_ewa'], text: 'Mashed beans and pepper sauce with agege bread.' },
    { id: 'falomo', icon: '⛴️', name: 'Falomo jetty', type: 'transport', glyph: 'boat', district: 'ikoyi', x: 20.8, y: 20.4, acts: [], text: 'Ferry stop for Ikorodu and Lekki.' },
    { id: 'gallery', icon: '🖼️', name: 'Ikoyi art gallery', type: 'culture', glyph: 'frame', district: 'ikoyi', x: 19.4, y: 21.4, acts: ['ikoyi_gallery'], text: 'Contemporary Nigerian art, free wine at openings.' },
    { id: 'ikoyi_park', icon: '🌳', name: 'Ikoyi park', type: 'outdoors', glyph: 'tree', district: 'ikoyi', x: 20.5, y: 21.7, acts: ['ikoyi_jog', 'ikoyi_garden'], text: 'Jogging trails under old trees.' },
    { id: 'dine', icon: '🍽️', name: 'Fine-dining restaurant', type: 'food', glyph: 'bowl', district: 'ikoyi', x: 21.1, y: 21.1, acts: ['ikoyi_dine'], text: 'Small plates, big bills.' },
    { id: 'clubs', icon: '🪩', name: 'Adeola Odeku club strip', type: 'nightlife', glyph: 'glass', district: 'vi', x: 18.5, y: 24.6, acts: ['vi_club'], text: 'Friday and Saturday nights until the sun comes up.' },
    { id: 'lounge', icon: '🍸', name: 'Rooftop lounge', type: 'nightlife', glyph: 'glass', district: 'vi', x: 19.6, y: 24.4, acts: ['vi_lounge'], text: 'After-work drinks and networking.' },
    { id: 'bar_beach', icon: '🏖️', name: 'Bar Beach', type: 'outdoors', glyph: 'wave', district: 'vi', x: 19.5, y: 26.1, acts: ['vi_dec_festival', 'vi_beach'], text: 'Atlantic breeze at dusk.' },
    { id: 'muri_park', icon: '🌴', name: 'Muri Okunola Park', type: 'outdoors', glyph: 'tree', district: 'vi', x: 18.3, y: 25.4, acts: ['vi_park'], text: 'A green pocket among the towers.' },
    { id: 'vi_food', icon: '🍽️', name: 'VI restaurants', type: 'food', glyph: 'bowl', district: 'vi', x: 19.9, y: 25.2, acts: ['vi_restaurant'], text: 'Continental, Asian and very expensive jollof.' },
    { id: 'banks', icon: '🏦', name: 'Bank headquarters', type: 'services', glyph: 'naira', district: 'vi', x: 18.9, y: 25.7, acts: ['vi_carwash'], text: 'Where bankers work. Wash cars outside for cash. Deposits are on the Money tab.' },
    { id: 'quilox', icon: '🌐', name: 'Crown Lounge', type: 'nightlife', glyph: 'glass', district: 'vi', x: 18.0, y: 24.9, acts: ['vi_quilox', 'vi_quilox_door'], text: 'The most famous club on the Island. VIP tables, bottle sparklers and celebrity sightings, Friday to Sunday.' },
    { id: 'palms', icon: '🛍️', name: 'Lekki shopping mall', type: 'culture', glyph: 'film', district: 'lekki', x: 26.1, y: 23.5, acts: ['lekki_palms_film', 'lekki_palms_shop'], text: 'The big Lekki mall: cinema, food court and shops.' },
    { id: 'vip_jetty', icon: '🏝️', name: 'Lekki VIP jetty', type: 'outdoors', glyph: 'boat', district: 'lekki', x: 25.9, y: 24.4, acts: ['lekki_island'], text: 'Private boats leave from here for the islands off Lagos. You need your own boat.' },
    { id: 'elegushi', icon: '🏖️', name: 'Elegushi beach', type: 'outdoors', glyph: 'wave', district: 'lekki', x: 27.3, y: 25.8, acts: ['lekki_dec_concert', 'lekki_elegushi'], text: 'Weekend beach parties with DJs, horses and suya by the waves.' },
    { id: 'lekki_motors', icon: '🏎️', name: 'Lekki luxury motors', type: 'services', glyph: 'car', district: 'lekki', x: 27.1, y: 24.9, acts: [], dealer: true, text: 'Glass showroom of SUVs, supercars and boats. Helicopters and jets by appointment.' },
    { id: 'lekki_beach', icon: '🏖️', name: 'Lekki beach', type: 'outdoors', glyph: 'wave', district: 'lekki', x: 28.4, y: 25.7, acts: ['lekki_beach', 'lekki_content'], text: 'Weekend crowds, horses and content shoots.' },
    { id: 'lcc', icon: '🐒', name: 'Lekki Conservation Centre', type: 'outdoors', glyph: 'tree', district: 'lekki', x: 26.6, y: 24.2, acts: ['lekki_lcc'], text: 'Monkeys, mangroves and a long canopy walkway.' },
    { id: 'lekki_gym', icon: '🏋️', name: 'Lekki gym', type: 'outdoors', glyph: 'dumbbell', district: 'lekki', x: 28.7, y: 23.6, acts: ['lekki_gym'], text: 'Classes all day. Zainab trains here.' },
    { id: 'lekki_cafe', icon: '☕', name: 'Lekki cafés', type: 'food', glyph: 'bowl', district: 'lekki', x: 27.6, y: 23.7, acts: ['lekki_cafe', 'lekki_super', 'lekki_errands'], text: 'Brunch, a supermarket and errands for estate residents.' },
    { id: 'ajah_market', icon: '🧺', name: 'Ajah market', type: 'food', glyph: 'basket', district: 'ajah', x: 38.6, y: 24.6, acts: ['ajah_market', 'ajah_spot', 'ajah_shop'], text: 'Foodstuff, a local spot and your cousin\'s shop.' },
    { id: 'abj_aso', icon: '⛰️', name: 'Aso Rock', type: 'outdoors', glyph: 'tree', district: 'abj_asokoro', x: 21.4, y: 9.4, acts: ['abj_aso'], text: 'The granite rock behind the seat of government. Best at sunset.' },
    { id: 'abj_millennium', icon: '🌳', name: 'Millennium Park', type: 'outdoors', glyph: 'tree', district: 'abj_maitama', x: 15.4, y: 8.2, acts: ['abj_millennium', 'abj_quiz'], text: 'Abuja\'s biggest park, with lawns, a river and picnics. A quiz show runs on the park stage Friday to Sunday.' },
    { id: 'abj_jabi_mall', icon: '🎬', name: 'Jabi lakeside mall', type: 'culture', glyph: 'film', district: 'abj_jabi', x: 7.2, y: 10.0, acts: ['abj_jabi_film'], text: 'Shops, a cinema and a terrace over the lake.' },
    { id: 'abj_jabi_lake', icon: '🚣', name: 'Jabi Lake', type: 'outdoors', glyph: 'wave', district: 'abj_jabi', x: 5.0, y: 12.2, acts: ['abj_jabi_boat', 'abj_jabi_gig'], text: 'Boat rides, joggers and car washes by the water.' },
    { id: 'abj_wuse_market', icon: '🧺', name: 'Wuse Market', type: 'food', glyph: 'basket', district: 'abj_wuse', x: 11.8, y: 12.2, acts: ['abj_wuse_gig'], text: 'The big market of the capital. Everything, all day.' },
    { id: 'abj_wuse2', icon: '🍢', name: 'Wuse 2 strip', type: 'nightlife', glyph: 'glass', district: 'abj_wuse', x: 10.0, y: 10.2, acts: ['abj_suya', 'abj_night'], text: 'Suya spots, lounges and clubs. Busy Friday and Saturday.' },
    { id: 'abj_eagle', icon: '🦅', name: 'Eagle Square', type: 'culture', glyph: 'dome', district: 'abj_garki', x: 17.4, y: 14.0, acts: ['abj_carnival', 'abj_eagle'], text: 'The big parade ground by the National Assembly.' },
    { id: 'abj_cbd', icon: '🏢', name: 'Central Business District', type: 'learn', glyph: 'laptop', district: 'abj_garki', x: 15.0, y: 16.0, acts: ['abj_garki_gig'], text: 'Ministries and business centres. The civil service hires here.' },
    { id: 'abj_kubwa_mkt', icon: '🛍️', name: 'Kubwa market', type: 'food', glyph: 'basket', district: 'abj_kubwa', x: 4.8, y: 3.0, acts: ['abj_kubwa_food', 'abj_kubwa_gig'], text: 'Cheap foodstuff for the satellite towns.' },
    { id: 'abj_nyanya_park', icon: '🚌', name: 'Nyanya motor park', type: 'transport', glyph: 'bus', district: 'abj_nyanya', x: 28.6, y: 15.2, acts: ['abj_nyanya_gig', 'abj_nyanya_buka'], text: 'Long-distance buses to Lagos and Port Harcourt.' },
    { id: 'abj_airport_pl', icon: '✈️', name: 'Nnamdi Azikiwe Airport', type: 'transport', glyph: 'plane', district: 'abj_airport', x: 8.6, y: 23.0, acts: ['abj_air_lounge', 'abj_air_spot', 'abj_air_eat', 'abj_air_gig'], text: 'Flights to Lagos and Port Harcourt. Check-in desks, a premium lounge and a long apron window.' },
    { id: 'ph_airport_pl', icon: '✈️', name: 'Port Harcourt Airport', type: 'transport', glyph: 'plane', district: 'ph_airport', x: 6.6, y: 2.2, acts: ['ph_air_lounge', 'ph_air_spot', 'ph_air_eat', 'ph_air_gig'], text: 'Omagwa. Flights to Lagos and Abuja. A premium lounge for the big men.' },
    { id: 'ph_uniport', icon: '🎓', name: 'University of Port Harcourt', type: 'learn', glyph: 'cap', district: 'ph_choba', x: 3.2, y: 7.2, acts: ['ph_uniport_lib', 'ph_choba_gig', 'ph_choba_eat'], text: 'Uniport campus, the library and student canteens.' },
    { id: 'ph_pleasure', icon: '🎡', name: 'Pleasure Park', type: 'outdoors', glyph: 'tree', district: 'ph_rumuokoro', x: 13.8, y: 7.4, acts: ['ph_carniriv', 'ph_pleasure'], text: 'Rides, lawns and a lake for weekend families.' },
    { id: 'ph_park', icon: '🚌', name: 'Rumuokoro motor park', type: 'transport', glyph: 'bus', district: 'ph_rumuokoro', x: 12.2, y: 5.4, acts: ['ph_rumu_gig'], text: 'Long-distance buses to Lagos and Abuja.' },
    { id: 'ph_garden', icon: '🍸', name: 'Garden City nightlife', type: 'nightlife', glyph: 'glass', district: 'ph_gra', x: 12.8, y: 12.0, acts: ['ph_night', 'ph_gra_gig'], text: 'Lounges and clubs where the oil money comes out to play.' },
    { id: 'ph_mall', icon: '🎬', name: 'Port Harcourt mall', type: 'culture', glyph: 'film', district: 'ph_gra', x: 11.0, y: 10.6, acts: ['ph_gra_film'], text: 'Cinema, food court and air-conditioning.' },
    { id: 'ph_yards', icon: '🛢️', name: 'Trans-Amadi yards', type: 'learn', glyph: 'tool', district: 'ph_transamadi', x: 21.6, y: 12.0, acts: ['ph_yard_gig', 'ph_canteen'], text: 'Oil-service companies. Day labour and real careers.' },
    { id: 'ph_mile1', icon: '🧺', name: 'Mile 1 market', type: 'food', glyph: 'basket', district: 'ph_dline', x: 9.6, y: 14.0, acts: ['ph_mile1_food', 'ph_mile1_gig'], text: 'The busiest market in Port Harcourt.' },
    { id: 'ph_bole', icon: '🐟', name: 'Bole and fish spot', type: 'food', glyph: 'bowl', district: 'ph_oldgra', x: 13.4, y: 15.8, acts: ['ph_bole', 'ph_bolegame'], text: 'Roasted plantain and fish with pepper sauce. A PH classic. Mama lets you work the grill for a share of sales.' },
    { id: 'ph_isaac', icon: '🌳', name: 'Isaac Boro Park', type: 'outdoors', glyph: 'tree', district: 'ph_oldgra', x: 15.0, y: 14.0, acts: ['ph_isaac', 'ph_oldgra_gig'], text: 'Old trees and quiet paths in the old town.' },
    { id: 'lekki_hyde_park', icon: '🏡', name: 'Lekki Hyde Park', type: 'outdoors', glyph: 'estate', district: 'lekki', x: 31.6, y: 23.85, acts: ['lekki_hp_walk', 'lekki_hp_tennis'], hydepark: true, nogem: true, text: 'A gated estate by the lagoon, off the Lekki–Epe Expressway: terraces, semis, Celebrity Row, Billionaire Row and a private islet. Buy ready-built or build your own.' },
    { id: 'lagoon_cruise', icon: '🛳️', name: 'Lagoon Boat Cruise', type: 'outdoors', glyph: 'yacht', district: 'ikoyi', x: 20.2, y: 21.05, acts: [], cruise: true, nogem: true, text: 'A party boat out of Five Cowries Creek: a deck bar, a sun deck, a dance floor and the captain at the helm. Board, then move around the deck with other players.' },
    { id: 'club_tidewater', icon: '🍕', name: 'Tidewater House (members only)', type: 'nightlife', glyph: 'club', district: 'ikoyi', x: 21.4, y: 20.6, acts: [], club: 'tidewater', nogem: true, text: 'Members only, by the water on Ademola Street.' },
    { id: 'club_jetski', icon: '🌊', name: 'Five Cowries Jet Ski Club', type: 'outdoors', glyph: 'club', district: 'ikoyi', x: 19.9, y: 20.7, acts: [], club: 'jetski', nogem: true, text: 'A members\' pontoon on the lagoon.' },
    { id: 'club_yacht', icon: '🛥️', name: 'Atlantic Marina Yacht Club', type: 'outdoors', glyph: 'yacht', district: 'vi', x: 14.2, y: 29.4, acts: [], club: 'yacht', nogem: true, text: 'Members only, at the Eko Atlantic marina.' },
    { id: 'golf_ikoyi', icon: '⛳', name: 'Ikoyi Golf Club', type: 'outdoors', glyph: 'tree', district: 'ikoyi', x: 20.4, y: 21.2, acts: [], club: 'golf', nogem: true, text: 'Members only: six holes, the lake, the clubhouse terrace and the Saturday Club Cup.' },
    { id: 'golf_abuja', icon: '⛳', name: 'Abuja Hills Golf Club', type: 'outdoors', glyph: 'tree', district: 'abj_maitama', x: 13.2, y: 6.2, acts: [], club: 'abjgolf', nogem: true, text: 'Members only: six holes under the Maitama hills, the clubhouse terrace and the Saturday Club Cup.' },
    { id: 'club_powerboat', icon: '🚤', name: 'Harbour Powerboat Club', type: 'outdoors', glyph: 'club', district: 'vi', x: 18.9, y: 29.6, acts: [], club: 'powerboat', nogem: true, text: 'Members only, on the Eko Atlantic harbour.' },
    { id: 'ph_waterfront', icon: '⛵', name: 'Port Harcourt waterfront', type: 'outdoors', glyph: 'wave', district: 'ph_borokiri', x: 16.6, y: 19.6, acts: ['ph_waterfront', 'ph_fish_gig'], text: 'Boats, fishermen and the Bonny River.' },
    { id: 'abj_mosque_pl', icon: '🕌', name: 'National Mosque', type: 'culture', glyph: 'mosque', district: 'abj_garki', x: 18.0, y: 13.0, acts: ['abj_mosque'], text: 'Golden dome and four minarets on the edge of the Central Area.' },
    { id: 'abj_ecumenical_pl', icon: '⛪', name: 'National Christian Centre', type: 'culture', glyph: 'hall', district: 'abj_garki', x: 13.6, y: 14.8, acts: ['abj_ecumenical'], text: 'A white spire you can see from the expressway.' },
    { id: 'abj_tower_pl', icon: '🗼', name: 'Millennium Tower', type: 'culture', glyph: 'frame', district: 'abj_garki', x: 16.2, y: 13.0, acts: ['abj_tower'], text: 'The tallest tower in the capital, with a view deck at the top.' },
    { id: 'abj_crafts_pl', icon: '🎨', name: 'Arts and Crafts Village', type: 'culture', glyph: 'mask', district: 'abj_garki', x: 17.8, y: 17.0, acts: ['abj_crafts', 'abj_crafts_gig'], text: 'Bronze, beads, adire and carvings from all over the country.' },
    { id: 'abj_galleria_pl', icon: '🎞️', name: 'Wuse cinema galleria', type: 'culture', glyph: 'film', district: 'abj_wuse', x: 12.6, y: 9.6, acts: ['abj_galleria'], text: 'Cinemas, arcade and food court under one roof.' },
    { id: 'abj_threearms_pl', icon: '🏛️', name: 'Three Arms Zone', type: 'culture', glyph: 'dome', district: 'abj_asokoro', x: 20.2, y: 12.6, acts: ['abj_threearms'], text: 'The Presidency, the National Assembly and the Supreme Court, side by side.' },
    { id: 'abj_gate_pl', icon: '🏟️', name: 'Abuja City Gate', type: 'outdoors', glyph: 'frame', district: 'abj_airport', x: 10.8, y: 21.6, acts: ['abj_gate'], text: 'The arch that welcomes you in from the airport road.' },
    { id: 'abj_stadium_pl', icon: '⚽', name: 'National stadium, Abuja', type: 'outdoors', glyph: 'stadium', district: 'abj_airport', x: 11.6, y: 20.4, acts: ['abj_stadium', 'abj_stadium_gig'], text: 'The big bowl off the airport road. Match days are loud.' },
    { id: 'abj_zuma_pl', icon: '⛰️', name: 'Zuma Rock viewpoint', type: 'outdoors', glyph: 'tree', district: 'abj_kubwa', x: 1.0, y: 0.6, acts: ['abj_zuma'], text: 'The giant rock with a face, on the road out of town. Printed on the ₦100 note.' },
    { id: 'ph_obiwali_pl', icon: '🎭', name: 'Cultural centre, GRA', type: 'culture', glyph: 'mask', district: 'ph_gra', x: 10.8, y: 12.2, acts: ['ph_obiwali'], text: 'Plays, dance troupes and concerts in a big hall.' },
    { id: 'ph_garrison_pl', icon: '🌽', name: 'Garrison junction', type: 'food', glyph: 'bowl', district: 'ph_gra', x: 13.8, y: 9.8, acts: ['ph_garrison'], text: 'The flyover junction where traffic meets roasted corn.' },
    { id: 'ph_govhouse_pl', icon: '🏛️', name: 'Brick House (Government House)', type: 'culture', glyph: 'dome', district: 'ph_oldgra', x: 12.6, y: 13.6, acts: ['ph_govhouse'], text: 'Rivers State Government House, behind tall gates.' },
    { id: 'ph_beach_pl', icon: '🏖️', name: 'Port Harcourt tourist beach', type: 'outdoors', glyph: 'umbrella', district: 'ph_borokiri', x: 18.6, y: 18.8, acts: ['ph_beach'], text: 'A river beach with music, fish and Sunday crowds.' },
    { id: 'ph_bonny_pl', icon: '🚤', name: 'Bonny boat jetty', type: 'transport', glyph: 'boat', district: 'ph_borokiri', x: 14.6, y: 20.4, acts: ['ph_bonny'], text: 'Speedboats down the river to Bonny Island.' },
    { id: 'ph_zoo_pl', icon: '🦁', name: 'Port Harcourt zoo', type: 'outdoors', glyph: 'tree', district: 'ph_transamadi', x: 19.4, y: 9.4, acts: ['ph_zoo'], text: 'Lions, monkeys and a lot of school trips.' },
    { id: 'ph_port_pl', icon: '🏗️', name: 'River port cranes', type: 'learn', glyph: 'tool', district: 'ph_transamadi', x: 23.8, y: 12.2, acts: ['ph_cranes'], text: 'Container cranes over Amadi Creek.' },
    { id: 'ph_stadium_pl', icon: '⚽', name: 'Stadium, Omagwa road', type: 'outdoors', glyph: 'stadium', district: 'ph_airport', x: 8.6, y: 3.2, acts: ['ph_stadium'], text: 'The big stadium near the airport. Rivers fans sing all match.' },
    { id: 'ojuelegba_park', icon: '🚐', name: 'Ojuelegba danfo park', type: 'transport', glyph: 'bus', district: 'surulere', x: 12.2, y: 16.8, acts: ['suru_danfo'], nogem: true, text: 'Under the bridge, conductors shout routes and danfos fill up. Rent one from the owner for a run to Yaba and back.' },
    { id: 'tarkwa', icon: '⛱️', name: 'Tarkwa Bay', type: 'outdoors', glyph: 'boat', district: 'ikoyi', x: 20.8, y: 21.6, acts: ['ikoyi_tarkwa'], nogem: true, text: 'A sheltered beach by the harbour mouth, reachable only by boat from the VI and Ikoyi jetties. Calm water, good for a swim.' },
    { id: 'eleko', icon: '🌊', name: 'Eleko beach', type: 'outdoors', glyph: 'wave', district: 'ajah', x: 39.2, y: 25.4, acts: ['ajah_eleko'], nogem: true, text: 'A long, open stretch of sand far out on the Lekki–Epe coast. Bring a cooler; it is a full day out.' },
    { id: 'giwa', icon: '💦', name: 'Giwa Gardens', type: 'outdoors', glyph: 'wave', district: 'ikorodu', x: 28.2, y: 3.4, acts: ['iko_giwa'], nogem: true, text: 'A big water park with slides, pools and gardens, busiest on weekends.' },
    { id: 'nike', icon: '🖼️', name: 'Lekki art gallery', type: 'culture', glyph: 'frame', district: 'lekki', x: 26.4, y: 23.8, acts: ['lekki_nike'], nogem: true, text: 'One of the largest private art galleries in Africa: Nigerian paintings, adire and other textiles, sculpture and crafts, five floors of it.' },
    { id: 'crafts', icon: '🪘', name: 'Lekki Arts and Crafts Market', type: 'food', glyph: 'basket', district: 'lekki', x: 27.6, y: 24.3, acts: ['lekki_crafts'], nogem: true, text: 'Carvings, beads, talking drums and fabric. Haggle with a smile.' },
    { id: 'kalakuta', icon: '🎺', name: 'Kalakuta Republic Museum', type: 'culture', glyph: 'note', district: 'ikeja', x: 11.2, y: 4.2, acts: ['ikeja_kalakuta'], nogem: true, text: 'Fela Kuti\'s former home, now a museum of his life, music and politics. Close to the Shrine.' },
    { id: 'jjt', icon: '🌳', name: 'JJT Park, Alausa', type: 'outdoors', glyph: 'tree', district: 'ikeja', x: 9.6, y: 3.0, acts: ['ikeja_jjt'], nogem: true, text: 'Johnson Jakande Tinubu Park: lawns, a lake and shade in the middle of the state secretariat.' },
    { id: 'jrandle', icon: '🗿', name: 'J. Randle Centre, Onikan', type: 'culture', glyph: 'mask', district: 'island', x: 16.6, y: 21.9, acts: ['island_jrandle'], nogem: true, text: 'A modern centre for Yoruba history, art and culture, by the old Onikan swimming pool.' },
    { id: 'terra', icon: '🎭', name: 'VI arts centre', type: 'culture', glyph: 'mask', district: 'vi', x: 19.4, y: 24.8, acts: ['vi_terra'], nogem: true, text: 'Exhibitions, theatre and a restaurant serving Nigerian food, all under one roof.' },
    { id: 'badagry', icon: '⛓️', name: 'Badagry day trips', type: 'culture', glyph: 'mask', district: 'festac', x: 2.2, y: 17.0, acts: ['festac_badagry'], nogem: true, text: 'An hour or more west of Lagos: the Point of No Return, slave trade museums and the first storey building in Nigeria. A sobering, important trip.' },
    { id: 'makoko', icon: '🛶', name: 'Makoko', type: 'culture', glyph: 'boat', district: 'yaba', x: 14.9, y: 15.8, acts: ['yaba_makoko'], nogem: true, text: 'A floating community on the lagoon. Tours are by canoe with a resident guide; it is people\'s home, so visit respectfully.' },
    { id: 'landmark_beach', icon: '🏖️', name: 'Oniru beach club', type: 'outdoors', glyph: 'wave', district: 'vi', x: 20.6, y: 26.3, acts: ['vi_landmark', 'vi_jetski'], nogem: true, text: 'Cabanas, seafood grilled on the sand, jet skis off the shore, and beach parties that start in the afternoon and go late.' },
    { id: 'vi_strip', icon: '🍾', name: 'The VI club strip', type: 'nightlife', glyph: 'glass', district: 'vi', x: 18.9, y: 24.4, acts: ['vi_club_late', 'vi_spray', 'vi_flex', 'vi_appearance'], nogem: true, text: 'Peak time is after midnight. Bottle service, money spraying, Amapiano till 5 a.m., and a car park where big SUVs line up to be seen.' },
    { id: 'lekki_lounges', icon: '💨', name: 'Lekki lounges and rooftops', type: 'nightlife', glyph: 'glass', district: 'lekki', x: 28.9, y: 23.6, acts: ['lekki_shisha', 'lekki_rooftop', 'lekki_glam'], nogem: true, text: 'Shisha, DJs and rooftop views, and a glam studio downstairs to get you "outside" ready.' },
    { id: 'eko_convention', icon: '🎤', name: 'Eko Convention Centre', type: 'nightlife', glyph: 'note', district: 'vi', x: 18.4, y: 26.0, acts: ['vi_dec_headline', 'vi_dec_vip', 'vi_dec_afterparty'], nogem: true, text: 'The big December stage. Homecoming headliners, international guests and a crowd of thousands. Tickets climb as Christmas gets closer.' },
    { id: 'tbs', icon: '🏟️', name: 'Tafawa Balewa Square', type: 'culture', glyph: 'dome', district: 'island', x: 16.6, y: 22.7, acts: ['island_dec_tbs', 'island_dec_food'], nogem: true, text: 'The old parade ground fills with December concerts and a food village of jollof, suya and ofada.' },
    { id: 'refinery_site', icon: '🛢️', name: 'Lagos oil refinery', type: 'services', glyph: 'tool', district: 'ajah', x: 47.6, y: 23.9, acts: ['ajah_ref_plant', 'ajah_ref_flare', 'ajah_ref_jetty', 'ajah_ref_shadow', 'ajah_ref_canteen', 'ajah_ref_labour', 'ajah_ref_tour'], nogem: true, text: 'Running in Ibeju-Lekki: a tank farm, distillation columns, lit flare stacks, a cooling tower, a lorry loading gantry and a tanker jetty. The plant takes day hands at the gate before 9am, and HR hires plant hands.', hr: 'ajah_refinery', shares: 'deltaoil' },
    { id: 'new_airport_site', icon: '🛫', name: 'New Lagos international airport', type: 'transport', glyph: 'plane', district: 'ikeja', x: 4.4, y: 3.2, acts: ['ikeja_newair_labour', 'ikeja_newair_tour'], nogem: true, text: 'Open beside Murtala Muhammed: a second runway, two glass halls joined by a concourse, jet bridges, a control tower and hangars. The apron crew takes day hands at the staff gate before 9am.' },
    { id: 'eko_atlantic_city', icon: '🌆', name: 'Eko Atlantic City', type: 'outdoors', glyph: 'wave', district: 'vi', x: 16.9, y: 30.2, acts: ['vi_eko_walk', 'vi_eko_brunch'], nogem: true, text: 'The new city on land won back from the Atlantic: glass towers on the waterfront, villas behind, and the sea wall promenade. Cross the bridge from VI.' },
    { id: 'white_sand_beach', icon: '🏖️', name: 'White Sand Beach, Ibeju-Lekki', type: 'outdoors', glyph: 'umbrella', district: 'ajah', x: 45.6, y: 28.7, acts: ['ajah_sand_day', 'ajah_horse', 'ajah_quad', 'ajah_jetski', 'ajah_banana', 'ajah_parasail', 'ajah_kayak'], nogem: true, text: 'Fine white sand and clear blue water past the Sea Plots, with ten fully equipped beach houses to rent. Horses, quad bikes, jet skis, banana boats, parasailing and kayaks.' },
    { id: 'ajah_resort', icon: '🏝️', name: 'Beach resort, Ajah coast', type: 'outdoors', glyph: 'wave', district: 'ajah', x: 38.8, y: 26.0, acts: ['ajah_dec_rave'], nogem: true, text: 'DJs from noon, swimming, lounging and a beach rave that runs into the night all December.' },
    { id: 'lagoon_jetty', icon: '🛥️', name: 'Lagoon jetty', type: 'transport', glyph: 'boat', district: 'ikoyi', x: 20.6, y: 21.8, acts: ['ikoyi_dec_cruise', 'ikoyi_dec_yacht', 'ikoyi_ilashe'], nogem: true, text: 'Boat cruises across the lagoon in December, with yacht parties for the big spenders.' },
    { id: 'link_bridge', icon: '🎆', name: 'Lekki–Ikoyi Link Bridge', type: 'outdoors', glyph: 'wave', district: 'lekki', x: 26.8, y: 23.4, acts: ['lekki_dec_nye', 'lekki_dec_pool'], nogem: true, text: 'The cable-stayed bridge where Lagos counts down to the New Year with fireworks.' },
    { id: 'ladipo', icon: '🔧', name: 'Ladipo auto market', type: 'services', glyph: 'tool', district: 'mushin', x: 12.9, y: 12.2, acts: [], nogem: true, text: 'Spare parts for every car ever made, and a mechanic for each one. Service your car here (Garage, Monday to Saturday, 08:00–18:00).' },
    { id: 'nysc_camp', icon: '🎖️', name: 'NYSC Orientation Camp, Kubwa', type: 'learn', glyph: 'hall', district: 'abj_kubwa', x: 3.4, y: 1.6, acts: [], nogem: true, text: 'The FCT orientation camp. Three weeks of 5 am drills, Man O\'War, lectures and Mammy market, squeezed into three camp days. Register in Phone → NYSC.' }
  ];

  // Interiors: floor size (in furniture tiles) for each kind of home.
  var ROOM_SIZES = {
    room: [4, 3], share: [4, 3], selfcon: [5, 4], miniflat: [6, 5], flat2: [8, 6], flat3: [9, 7],
    duplex: [10, 8], luxury: [10, 7], mansion: [14, 10]
  };
  // Furniture you buy, place and keep when you move. fx are what an item does
  // while placed in your current home: sleep (added to sleep quality), power
  // (added to the chance of light), gen (generator cost cut), daily needs, status.
  var FURNITURE = {
    foam:      { name: 'Foam mattress', icon: '🛏️', cat: 'Bedroom', price: 25000, w: 2, d: 1, h: 3, color: '#d8cbb0', shape: 'bed', fx: { sleep: 0.05 } },
    ortho:     { name: 'Orthopaedic bed', icon: '🛏️', cat: 'Bedroom', price: 350000, w: 2, d: 2, h: 5, color: '#7a5bd0', shape: 'bed', fx: { sleep: 0.12 }, status: 2 },
    king:      { name: 'King-size bed', icon: '👑', cat: 'Bedroom', price: 1200000, w: 3, d: 2, h: 6, color: '#6b3fa0', shape: 'bed', fx: { sleep: 0.2 }, status: 5 },
    wardrobe:  { name: 'Wardrobe', icon: '🚪', cat: 'Bedroom', price: 180000, w: 2, d: 1, h: 16, color: '#8a6a4a', shape: 'box', status: 1 },
    plastic:   { name: 'Plastic chairs', icon: '🪑', cat: 'Living room', price: 8000, w: 1, d: 1, h: 5, color: '#e2463f', shape: 'chair' },
    sofa:      { name: '3-seater sofa', icon: '🛋️', cat: 'Living room', price: 450000, w: 3, d: 1, h: 6, color: '#a02b2b', shape: 'sofa', fx: { fun: 2 }, status: 2 },
    sectional: { name: 'Leather sectional', icon: '🛋️', cat: 'Living room', price: 2500000, w: 3, d: 2, h: 6, color: '#2b2b2f', shape: 'sofa', fx: { fun: 3, stress: -2 }, status: 6 },
    table:     { name: 'Centre table', icon: '🟫', cat: 'Living room', price: 90000, w: 2, d: 1, h: 3, color: '#c9a77a', shape: 'table' },
    rug:       { name: 'Ankara rug', icon: '🟥', cat: 'Living room', price: 60000, w: 3, d: 2, h: 0, color: '#c0392b', shape: 'rug', fx: { stress: -1 }, status: 1 },
    persian:   { name: 'Persian rug', icon: '🧶', cat: 'Living room', price: 1200000, w: 3, d: 2, h: 0, color: '#8e1b2b', shape: 'rug', fx: { stress: -2 }, status: 4 },
    fan:       { name: 'Standing fan', icon: '🌀', cat: 'Comfort', price: 35000, w: 1, d: 1, h: 10, color: '#d0d4da', shape: 'pole', fx: { stress: -1, mosquito: 0.4 }, needsPower: true },
    ac:        { name: 'Split AC', icon: '❄️', cat: 'Comfort', price: 650000, w: 1, d: 1, h: 14, color: '#f2f4f6', shape: 'wallbox', fx: { stress: -3, sleep: 0.06, mosquito: 0.9 }, needsPower: true, status: 2 },
    net:       { name: 'Mosquito net', icon: '🦟', cat: 'Comfort', price: 6000, w: 1, d: 1, h: 6, color: '#eef2f0', shape: 'box', fx: { mosquito: 0.8 } },
    plant:     { name: 'Potted plant', icon: '🪴', cat: 'Comfort', price: 15000, w: 1, d: 1, h: 8, color: '#3f8f55', shape: 'plant', fx: { stress: -1 } },
    tv:        { name: '43-inch TV', icon: '📺', cat: 'Entertainment', price: 280000, w: 2, d: 1, h: 9, color: '#1c1d20', shape: 'tv', fx: { fun: 3 }, needsPower: true, status: 1 },
    oled:      { name: '75-inch OLED TV', icon: '📺', cat: 'Entertainment', price: 3500000, w: 3, d: 1, h: 12, color: '#0c0d10', shape: 'tv', fx: { fun: 6 }, needsPower: true, status: 5 },
    console:   { name: 'Game console', icon: '🎮', cat: 'Entertainment', price: 900000, w: 1, d: 1, h: 3, color: '#2b2f3a', shape: 'box', fx: { fun: 4 }, needsPower: true, status: 2 },
    speaker:   { name: 'Sound system', icon: '🔊', cat: 'Entertainment', price: 600000, w: 1, d: 1, h: 12, color: '#222326', shape: 'box', fx: { fun: 3, social: 2 }, needsPower: true, status: 2 },
    pool_tbl:  { name: 'Pool table', icon: '🎱', cat: 'Entertainment', price: 2200000, w: 3, d: 2, h: 6, color: '#1e7a43', shape: 'table', fx: { fun: 4, social: 3 }, status: 5 },
    piano:     { name: 'Grand piano', icon: '🎹', cat: 'Entertainment', price: 18000000, w: 2, d: 2, h: 9, color: '#111214', shape: 'box', fx: { fun: 4, stress: -3 }, status: 12 },
    cooker:    { name: 'Gas cooker', icon: '🔥', cat: 'Kitchen', price: 120000, w: 1, d: 1, h: 8, color: '#c8ccd2', shape: 'box', fx: { hunger: 2 } },
    fridge:    { name: 'Fridge', icon: '🧊', cat: 'Kitchen', price: 450000, w: 1, d: 1, h: 16, color: '#e8ebee', shape: 'box', fx: { hunger: 3 }, needsPower: true, status: 1 },
    dining:    { name: 'Dining set', icon: '🍽️', cat: 'Kitchen', price: 700000, w: 3, d: 2, h: 6, color: '#7a5a3a', shape: 'table', fx: { social: 2 }, status: 2 },
    inverter:  { name: 'Inverter and batteries', icon: '🔋', cat: 'Power', price: 1800000, w: 1, d: 1, h: 10, color: '#2f6fa0', shape: 'box', fx: { power: 0.25 }, status: 2 },
    solar:     { name: 'Solar system (roof panels)', icon: '☀️', cat: 'Power', price: 4500000, w: 1, d: 1, h: 6, color: '#1f3e5a', shape: 'box', fx: { power: 0.35, gen: 0.5 }, status: 4 },
    gen_small: { name: '"I better pass my neighbour" gen', icon: '⛽', cat: 'Power', price: 250000, w: 1, d: 1, h: 7, color: '#d9a520', shape: 'box', fx: { gen: 0.4 } },
    art:       { name: 'Ankara art print', icon: '🖼️', cat: 'Decor', price: 60000, w: 1, d: 1, h: 12, color: '#d9822b', shape: 'wallbox', fx: { stress: -1 }, status: 1 },
    bronze:    { name: 'Benin-style bronze', icon: '🗿', cat: 'Decor', price: 1500000, w: 1, d: 1, h: 12, color: '#9a6a2a', shape: 'pole', status: 5 },
    aquarium:  { name: 'Aquarium', icon: '🐠', cat: 'Decor', price: 900000, w: 2, d: 1, h: 10, color: '#3fb6d8', shape: 'box', fx: { stress: -2 }, needsPower: true, status: 3 },
    chandelier:{ name: 'Crystal chandelier', icon: '💡', cat: 'Decor', price: 3000000, w: 1, d: 1, h: 20, color: '#f2e6b8', shape: 'pole', needsPower: true, status: 7 },
    treadmill: { name: 'Treadmill', icon: '🏃', cat: 'Comfort', price: 1100000, w: 1, d: 2, h: 8, color: '#3a3d44', shape: 'box', fx: { stress: -2, energy: 2 }, needsPower: true, status: 2 }
  };

  // Your Lagosian: looks you choose, and clothes you buy and wear.
  var LOOKS = {
    skin: ['#f1c9a5', '#d9a47a', '#b97b52', '#8d5a3b', '#6b4029', '#4a2c1d'],
    hair: ['Low cut', 'Afro', 'Braids', 'Cornrows', 'Bantu knots', 'Locs', 'Bald', 'Short twists'],
    shape: ['Slim', 'Average', 'Broad']
  };
  // slot: top | bottom | dress (covers top and bottom) | shoes | head | acc.
  // fabric: plain | ankara | asooke | lace | denim. tags change what an outfit
  // does: owambe, club, office, gym. Effects only apply while worn.
  var CLOTHES = {
    // Starter clothes: free, picked once during new-player setup, never sold.
    st_tee:     { name: 'Plain tee', slot: 'top', fabric: 'plain', color: '#f4f3ec', price: 0, tags: [], gift: true, starter: true },
    st_ankara:  { name: 'Ankara shirt (starter)', slot: 'top', fabric: 'ankara', color: '#2f6fa0', alt: '#f2b600', price: 0, tags: [], gift: true, starter: true },
    st_adire:   { name: 'Adire top', slot: 'top', fabric: 'adire', color: '#1f3a6b', alt: '#cfe0f0', price: 0, tags: [], gift: true, starter: true },
    st_asooke:  { name: 'Aso-oke top', slot: 'top', fabric: 'asooke', color: '#7a1f2b', alt: '#d4af37', price: 0, tags: [], gift: true, starter: true },
    st_jeans:   { name: 'Jeans (starter)', slot: 'bottom', fabric: 'denim', color: '#3d5a80', price: 0, tags: [], gift: true, starter: true },
    st_chinos:  { name: 'Khaki chinos', slot: 'bottom', fabric: 'plain', color: '#b59a6a', price: 0, tags: [], gift: true, starter: true },
    st_wrapper: { name: 'Ankara wrapper (starter)', slot: 'bottom', fabric: 'ankara', color: '#c0392b', alt: '#f2b600', price: 0, tags: [], gift: true, starter: true },
    tee:        { name: 'Plain T-shirt', slot: 'top', fabric: 'plain', color: '#f4f3ec', price: 4000, tags: [] },
    jersey:     { name: 'Super Eagles jersey', slot: 'top', fabric: 'plain', color: '#1d7a43', price: 15000, tags: ['gym'] },
    ankara_sh:  { name: 'Ankara shirt', slot: 'top', fabric: 'ankara', color: '#d9822b', alt: '#2f6fa0', price: 25000, tags: ['owambe'] },
    shirt:      { name: 'Office shirt', slot: 'top', fabric: 'plain', color: '#cfe0f0', price: 18000, tags: ['office'] },
    blazer:     { name: 'Tailored blazer', slot: 'top', fabric: 'plain', color: '#1f2a44', price: 120000, tags: ['office', 'club'], status: 2 },
    lace_top:   { name: 'Lace blouse', slot: 'top', fabric: 'lace', color: '#f2e6c9', price: 60000, tags: ['owambe'], status: 1 },
    crop:       { name: 'Sequin top', slot: 'top', fabric: 'plain', color: '#c2417f', price: 45000, tags: ['club'], status: 1 },
    jeans:      { name: 'Jeans', slot: 'bottom', fabric: 'denim', color: '#3d5a80', price: 20000, tags: [] },
    trousers:   { name: 'Office trousers', slot: 'bottom', fabric: 'plain', color: '#2b2f3a', price: 22000, tags: ['office'] },
    joggers:    { name: 'Joggers', slot: 'bottom', fabric: 'plain', color: '#4b4f55', price: 12000, tags: ['gym'] },
    wrapper:    { name: 'Ankara wrapper', slot: 'bottom', fabric: 'ankara', color: '#c0392b', alt: '#f2b600', price: 18000, tags: ['owambe'] },
    skirt:      { name: 'Pencil skirt', slot: 'bottom', fabric: 'plain', color: '#17181a', price: 25000, tags: ['office'] },
    agbada:     { name: 'Aso-oke agbada', slot: 'dress', fabric: 'asooke', color: '#6b3fa0', alt: '#f2b600', price: 250000, tags: ['owambe'], status: 4 },
    kaftan:     { name: 'Senator kaftan', slot: 'dress', fabric: 'plain', color: '#f4f3ec', price: 70000, tags: ['owambe', 'office'], status: 2 },
    iro_buba:   { name: 'Lace iro and buba', slot: 'dress', fabric: 'lace', color: '#1d7a43', alt: '#f2e6c9', price: 220000, tags: ['owambe'], status: 4 },
    gown:       { name: 'Ankara gown', slot: 'dress', fabric: 'ankara', color: '#0f6f78', alt: '#f2b600', price: 85000, tags: ['owambe', 'club'], status: 2 },
    designer:   { name: 'Designer suit', slot: 'dress', fabric: 'plain', color: '#111214', price: 2500000, tags: ['office', 'club'], status: 15 },
    slides:     { name: 'Slides', slot: 'shoes', fabric: 'plain', color: '#17181a', price: 3000, tags: [] },
    sneakers:   { name: 'Sneakers', slot: 'shoes', fabric: 'plain', color: '#f4f3ec', price: 35000, tags: ['gym', 'club'], status: 1 },
    loafers:    { name: 'Leather loafers', slot: 'shoes', fabric: 'plain', color: '#5a3b22', price: 60000, tags: ['office', 'owambe'], status: 1 },
    heels:      { name: 'Heels', slot: 'shoes', fabric: 'plain', color: '#c0392b', price: 55000, tags: ['club', 'owambe'], status: 1 },
    gele:       { name: 'Gele', slot: 'head', fabric: 'asooke', color: '#f2b600', alt: '#c2417f', price: 30000, tags: ['owambe'], status: 1 },
    fila:       { name: 'Fila cap', slot: 'head', fabric: 'asooke', color: '#6b3fa0', alt: '#f2b600', price: 15000, tags: ['owambe'] },
    cap:        { name: 'Face cap', slot: 'head', fabric: 'plain', color: '#17181a', price: 6000, tags: ['gym'] },
    beads:      { name: 'Coral beads', slot: 'acc', fabric: 'plain', color: '#e2463f', price: 150000, tags: ['owambe'], status: 3 },
    watch:      { name: 'Luxury watch', slot: 'acc', fabric: 'plain', color: '#c9a77a', price: 4000000, tags: ['office', 'club'], status: 20 },
    chain:      { name: 'Iced-out chain', slot: 'acc', fabric: 'plain', color: '#d8dce2', price: 6500000, tags: ['club'], status: 25 },
    umbrella:   { name: 'Umbrella', slot: 'acc', fabric: 'plain', color: '#2f6fa0', price: 4500, tags: ['rain'] },
    // Issued free at NYSC camp, never sold.
    nysc_khaki: { name: 'NYSC khaki', slot: 'top', fabric: 'plain', color: '#a8976b', price: 0, tags: ['office'], gift: true }
  };

  // Vehicles: road cars use the "Own car" travel mode with their own speed and
  // fuel; boats use the jetties; helicopters fly anywhere. Upkeep is weekly.
  var VEHICLES = {
    danfo_bus: { name: 'Danfo bus', icon: '🚐', kind: 'bus', price: 18000000, speed: 28, fuel: 0, upkeep: 15000, status: 2, color: '#f2b600' },
    tokunbo:   { name: 'Tokunbo saloon', icon: '🚗', kind: 'car', price: 8000000, speed: 32, fuel: 120, upkeep: 6000, status: 2, color: '#c9ccd2' },
    keke_own:  { name: 'Your own keke', icon: '🛺', kind: 'car', price: 3500000, speed: 22, fuel: 60, upkeep: 3000, status: 1, color: '#f2b600' },
    muscle:    { name: '"Muscle" saloon', icon: '🚘', kind: 'car', price: 14000000, speed: 34, fuel: 140, upkeep: 12000, status: 4, color: '#1c1d20' },
    powerbike: { name: 'Power bike', icon: '🏍️', kind: 'car', price: 12000000, speed: 40, fuel: 90, upkeep: 9000, status: 5, color: '#c0392b' },
    suv:       { name: 'Luxury SUV', icon: '🚙', kind: 'car', price: 45000000, speed: 34, fuel: 200, upkeep: 40000, status: 8, color: '#f4f3ec' },
    cruiser:   { name: 'Full-size 4x4', icon: '🚙', kind: 'car', price: 180000000, speed: 35, fuel: 260, upkeep: 120000, status: 14, color: '#2b2b2f' },
    gclass:    { name: 'Boxy German 4x4', icon: '🚙', kind: 'car', price: 350000000, speed: 36, fuel: 300, upkeep: 240000, status: 22, color: '#17181a' },
    supercar:  { name: 'Supercar', icon: '🏎️', kind: 'car', price: 600000000, speed: 42, fuel: 380, upkeep: 400000, status: 30, color: '#e5b400' },
    limo:      { name: 'Ultra-luxury limousine', icon: '🚘', kind: 'car', price: 900000000, speed: 34, fuel: 340, upkeep: 600000, status: 40, color: '#3d2b4f' },
    speedboat: { name: 'Speedboat', icon: '🚤', kind: 'boat', price: 60000000, speed: 50, fuel: 600, upkeep: 60000, status: 12, color: '#ffffff' },
    yacht:     { name: 'Yacht', icon: '🛥️', kind: 'boat', price: 3500000000, speed: 40, fuel: 1500, upkeep: 2500000, status: 80, color: '#f4f3ec' },
    heli:      { name: 'Helicopter', icon: '🚁', kind: 'heli', price: 2800000000, speed: 200, fuel: 0, trip: 250000, upkeep: 3000000, status: 90, color: '#2f6fa0' },
    jetski:    { name: 'Jet ski', icon: '🌊', kind: 'boat', price: 15000000, speed: 55, fuel: 300, upkeep: 20000, status: 4, color: '#2f6fa0' },
    houseboat: { name: 'Houseboat', icon: '🏠', kind: 'boat', price: 1800000000, speed: 20, fuel: 1200, upkeep: 1500000, status: 45, color: '#efe9dc', sleep: 0.1 },
    catamaran: { name: 'Luxury catamaran', icon: '⛵', kind: 'boat', price: 900000000, speed: 45, fuel: 1000, upkeep: 800000, status: 35, color: '#f4f3ec' },
    superyacht:{ name: 'Superyacht', icon: '🛳️', kind: 'boat', price: 25000000000, speed: 38, fuel: 5000, upkeep: 20000000, status: 180, color: '#ffffff' },
    light_jet: { name: 'Light jet', icon: '🛩️', kind: 'jet', price: 9000000000, speed: 0, fuel: 0, upkeep: 15000000, status: 120, color: '#e9e6df' },
    jumbo:     { name: 'VIP airliner', icon: '✈️', kind: 'jet', price: 150000000000, speed: 0, fuel: 0, upkeep: 200000000, status: 400, color: '#f4f3ec' },
    bizjet:    { name: 'Business jet', icon: '🛩️', kind: 'jet', price: 20000000000, speed: 0, fuel: 0, upkeep: 30000000, status: 160, color: '#f4f3ec' },
    jet:       { name: 'Private jet', icon: '🛩️', kind: 'jet', price: 45000000000, speed: 0, fuel: 0, upkeep: 60000000, status: 250, color: '#f4f3ec' },
    // The luxury catalogue: real makes and models named as items for sale. No affiliation with the makers.
    rr_phantom: { name: 'Sovereign Grand Saloon', icon: '🚘', kind: 'car', tier: 'ultra', price: 750000000, speed: 34, fuel: 360, upkeep: 520000, status: 32, color: '#1c1d20' },
    rr_cullinan: { name: 'Sovereign Highland SUV', icon: '🚙', kind: 'car', tier: 'ultra', price: 600000000, speed: 35, fuel: 380, upkeep: 420000, status: 30, color: '#e9e6df' },
    rr_ghost: { name: 'Sovereign Silver Saloon', icon: '🚘', kind: 'car', tier: 'ultra', price: 520000000, speed: 35, fuel: 340, upkeep: 360000, status: 28, color: '#3d4a52' },
    bentley_bentayga: { name: 'Wingate Estate SUV', icon: '🚙', kind: 'car', tier: 'ultra', price: 380000000, speed: 36, fuel: 320, upkeep: 270000, status: 24, color: '#2f4f3f' },
    bentley_gt: { name: 'Wingate Grand Tourer', icon: '🏎️', kind: 'car', tier: 'ultra', price: 400000000, speed: 40, fuel: 300, upkeep: 280000, status: 25, color: '#7a1f2b' },
    ferrari_sf90: { name: 'Corsa Hybrid hypercar', icon: '🏎️', kind: 'car', tier: 'ultra', price: 850000000, speed: 44, fuel: 420, upkeep: 600000, status: 36, color: '#c0392b' },
    ferrari_roma: { name: 'Corsa Coupé', icon: '🏎️', kind: 'car', tier: 'ultra', price: 420000000, speed: 42, fuel: 340, upkeep: 290000, status: 26, color: '#c9ccd2' },
    ferrari_purosangue: { name: 'Corsa four-door', icon: '🚙', kind: 'car', tier: 'ultra', price: 700000000, speed: 40, fuel: 400, upkeep: 490000, status: 32, color: '#17181a' },
    lambo_urus: { name: 'Toro Super SUV', icon: '🚙', kind: 'car', tier: 'ultra', price: 420000000, speed: 40, fuel: 380, upkeep: 290000, status: 27, color: '#e5b400' },
    lambo_revuelto: { name: 'Toro V12 supercar', icon: '🏎️', kind: 'car', tier: 'ultra', price: 1000000000, speed: 45, fuel: 460, upkeep: 700000, status: 42, color: '#2fa36b' },
    aston_dbx: { name: 'Albion luxury SUV', icon: '🚙', kind: 'car', tier: 'ultra', price: 380000000, speed: 38, fuel: 340, upkeep: 270000, status: 24, color: '#1f4d3c' },
    mclaren_750s: { name: 'Velocita 750 supercar', icon: '🏎️', kind: 'car', tier: 'ultra', price: 550000000, speed: 45, fuel: 380, upkeep: 380000, status: 30, color: '#e67e22' },
    bugatti_chiron: { name: 'Hyperion W16 hypercar', icon: '🏎️', kind: 'car', tier: 'ultra', price: 5000000000, speed: 48, fuel: 700, upkeep: 3500000, status: 90, color: '#1f3a6b' },
    merc_s: { name: 'Kaiser executive saloon', icon: '🚘', kind: 'car', tier: 'premium', price: 220000000, speed: 35, fuel: 260, upkeep: 150000, status: 16, color: '#17181a' },
    merc_g63: { name: 'Kaiser Boxer 4x4', icon: '🚙', kind: 'car', tier: 'premium', price: 300000000, speed: 36, fuel: 320, upkeep: 210000, status: 20, color: '#4b4f55' },
    maybach_s680: { name: 'Kaiser grand limousine', icon: '🚘', kind: 'car', tier: 'premium', price: 400000000, speed: 35, fuel: 300, upkeep: 280000, status: 26, color: '#3d2b4f' },
    bmw_7: { name: 'Isar Seven saloon', icon: '🚘', kind: 'car', tier: 'premium', price: 190000000, speed: 35, fuel: 250, upkeep: 130000, status: 14, color: '#2b2b2f' },
    bmw_x7: { name: 'Isar X SUV', icon: '🚙', kind: 'car', tier: 'premium', price: 170000000, speed: 34, fuel: 280, upkeep: 120000, status: 13, color: '#f4f3ec' },
    audi_a8: { name: 'Ringstar A saloon', icon: '🚘', kind: 'car', tier: 'premium', price: 170000000, speed: 35, fuel: 240, upkeep: 120000, status: 13, color: '#8fa2b3' },
    audi_q8: { name: 'Ringstar Q SUV', icon: '🚙', kind: 'car', tier: 'premium', price: 140000000, speed: 35, fuel: 260, upkeep: 98000, status: 11, color: '#17181a' },
    porsche_911: { name: 'Zuffen flat-six coupé', icon: '🏎️', kind: 'car', tier: 'premium', price: 250000000, speed: 42, fuel: 280, upkeep: 180000, status: 18, color: '#f5c518' },
    porsche_cayenne: { name: 'Zuffen sport SUV', icon: '🚙', kind: 'car', tier: 'premium', price: 160000000, speed: 37, fuel: 270, upkeep: 110000, status: 12, color: '#c9ccd2' },
    rr_autobiography: { name: 'Highlander Autograph SUV', icon: '🚙', kind: 'car', tier: 'premium', price: 350000000, speed: 35, fuel: 320, upkeep: 240000, status: 22, color: '#17181a' },
    lexus_lx: { name: 'Kyoto grand SUV', icon: '🚙', kind: 'car', tier: 'premium', price: 250000000, speed: 34, fuel: 320, upkeep: 180000, status: 16, color: '#efe9dc' },
    escalade: { name: 'Detroit full-size SUV', icon: '🚙', kind: 'car', tier: 'premium', price: 200000000, speed: 34, fuel: 330, upkeep: 140000, status: 14, color: '#17181a' },
    phenom_300: { name: 'Swift 300 light jet', icon: '🛩️', kind: 'jet', tier: 'light', price: 17000000000, speed: 0, fuel: 0, upkeep: 14000000, status: 130, color: '#e9e6df' },
    citation_latitude: { name: 'Meridian midsize jet', icon: '🛩️', kind: 'jet', tier: 'light', price: 28000000000, speed: 0, fuel: 0, upkeep: 22000000, status: 145, color: '#f4f3ec' },
    pc24: { name: 'Alpine 24 jet', icon: '🛩️', kind: 'jet', tier: 'light', price: 17000000000, speed: 0, fuel: 0, upkeep: 14000000, status: 130, color: '#e9e6df' },
    praetor_600: { name: 'Swift 600 jet', icon: '🛩️', kind: 'jet', tier: 'mid', price: 34000000000, speed: 0, fuel: 0, upkeep: 27000000, status: 170, color: '#f4f3ec' },
    g650er: { name: 'Longreach 650', icon: '🛩️', kind: 'jet', tier: 'heavy', price: 110000000000, speed: 0, fuel: 0, upkeep: 88000000, status: 300, color: '#f4f3ec' },
    global_6500: { name: 'Horizon 6500', icon: '🛩️', kind: 'jet', tier: 'heavy', price: 90000000000, speed: 0, fuel: 0, upkeep: 72000000, status: 280, color: '#f4f3ec' },
    g700: { name: 'Longreach 700', icon: '🛩️', kind: 'jet', tier: 'ulr', price: 125000000000, speed: 0, fuel: 0, upkeep: 100000000, status: 340, color: '#f4f3ec' },
    g800: { name: 'Longreach 800', icon: '🛩️', kind: 'jet', tier: 'ulr', price: 115000000000, speed: 0, fuel: 0, upkeep: 92000000, status: 330, color: '#f4f3ec' },
    global_7500: { name: 'Horizon 7500', icon: '🛩️', kind: 'jet', tier: 'ulr', price: 120000000000, speed: 0, fuel: 0, upkeep: 96000000, status: 335, color: '#f4f3ec' },
    global_8000: { name: 'Horizon 8000', icon: '🛩️', kind: 'jet', tier: 'ulr', price: 125000000000, speed: 0, fuel: 0, upkeep: 100000000, status: 345, color: '#f4f3ec' },
    falcon_6x: { name: 'Kestrel 6', icon: '🛩️', kind: 'jet', tier: 'ulr', price: 75000000000, speed: 0, fuel: 0, upkeep: 60000000, status: 260, color: '#f4f3ec' },
    falcon_8x: { name: 'Kestrel 8', icon: '🛩️', kind: 'jet', tier: 'ulr', price: 85000000000, speed: 0, fuel: 0, upkeep: 68000000, status: 275, color: '#f4f3ec' },
    falcon_10x: { name: 'Kestrel 10', icon: '🛩️', kind: 'jet', tier: 'ulr', price: 120000000000, speed: 0, fuel: 0, upkeep: 96000000, status: 335, color: '#f4f3ec' },
    bbj: { name: 'VIP narrowbody airliner', icon: '✈️', kind: 'jet', tier: 'airliner', price: 160000000000, speed: 0, fuel: 0, upkeep: 130000000, status: 420, color: '#f4f3ec' },
    acj: { name: 'Corporate airliner', icon: '✈️', kind: 'jet', tier: 'airliner', price: 160000000000, speed: 0, fuel: 0, upkeep: 130000000, status: 420, color: '#f4f3ec' },
    riva_aquariva: { name: 'Mahogany runabout', icon: '🚤', kind: 'boat', tier: 'motor', price: 1600000000, speed: 50, fuel: 700, upkeep: 1400000, status: 30, color: '#a0522d' },
    azimut_grande: { name: 'Adriatica 30 motor yacht', icon: '🛥️', kind: 'boat', tier: 'motor', price: 8000000000, speed: 42, fuel: 1800, upkeep: 7200000, status: 70, color: '#ffffff' },
    ferretti_780: { name: 'Adriatica 780', icon: '🛥️', kind: 'boat', tier: 'motor', price: 6000000000, speed: 42, fuel: 1600, upkeep: 5400000, status: 60, color: '#ffffff' },
    sunseeker_76: { name: 'Solent 76 yacht', icon: '🛥️', kind: 'boat', tier: 'motor', price: 7000000000, speed: 44, fuel: 1700, upkeep: 6300000, status: 65, color: '#ffffff' },
    princess_y85: { name: 'Plymouth 85 yacht', icon: '🛥️', kind: 'boat', tier: 'motor', price: 9000000000, speed: 42, fuel: 1900, upkeep: 8100000, status: 72, color: '#ffffff' },
    pershing_gtx: { name: 'Arrow GTX sport yacht', icon: '🚤', kind: 'boat', tier: 'motor', price: 8000000000, speed: 52, fuel: 2000, upkeep: 7200000, status: 70, color: '#4b4f55' },
    benetti: { name: 'Tuscan superyacht', icon: '🛳️', kind: 'boat', tier: 'super', price: 60000000000, speed: 36, fuel: 6000, upkeep: 54000000, status: 220, color: '#ffffff' },
    heesen: { name: 'Dutch-built superyacht', icon: '🛳️', kind: 'boat', tier: 'super', price: 50000000000, speed: 38, fuel: 5500, upkeep: 45000000, status: 210, color: '#ffffff' },
    sanlorenzo: { name: 'Ligurian superyacht', icon: '🛳️', kind: 'boat', tier: 'super', price: 45000000000, speed: 36, fuel: 5200, upkeep: 40000000, status: 200, color: '#ffffff' },
    feadship: { name: 'North Sea superyacht', icon: '🛳️', kind: 'boat', tier: 'super', price: 200000000000, speed: 34, fuel: 9000, upkeep: 180000000, status: 360, color: '#ffffff' },
    lurssen: { name: 'Bremen superyacht', icon: '🛳️', kind: 'boat', tier: 'super', price: 400000000000, speed: 32, fuel: 12000, upkeep: 360000000, status: 480, color: '#ffffff' },
    oceanco: { name: 'Ocean giga-yacht', icon: '🛳️', kind: 'boat', tier: 'super', price: 350000000000, speed: 32, fuel: 11000, upkeep: 320000000, status: 450, color: '#ffffff' },
    royal_huisman: { name: 'Frisian sailing yacht', icon: '⛵', kind: 'boat', tier: 'sail', price: 120000000000, speed: 24, fuel: 1500, upkeep: 110000000, status: 300, color: '#efe9dc' },
    perini_navi: { name: 'Mediterranean sailing yacht', icon: '⛵', kind: 'boat', tier: 'sail', price: 60000000000, speed: 24, fuel: 1200, upkeep: 54000000, status: 230, color: '#efe9dc' }
  };
  var VEHICLE_TIERS = { ultra: 'Ultra-luxury', premium: 'Premium luxury', light: 'Light jets', mid: 'Midsize jets', heavy: 'Heavy jets', ulr: 'Ultra-long-range', airliner: 'VIP airliners', motor: 'Luxury motor yachts', super: 'Superyachts', sail: 'Sailing yachts' };

  // Mainland Estate: a grid of house plots north of the Lagoon. Plots marked
  // taken by hash() are lived in already; the rest are for sale, one per player.
  // Sea Plots: a grid of small plots in the water off Lagos Island. Players buy
  // a block and fill it with a picture (after review), like a million-naira homepage.
  var SEA = { name: 'Sea Plots', x0: 21.2, y0: 27.6, cols: 64, rows: 18, gap: 0.3, price: 5000, rent: 500, rentDays: 7, maxSide: 12 }; // rent: rules 19, per plot for 7 real days
  var ESTATE = { name: 'Mainland Estate', district: 'ikeja', x0: 13.6, y0: 0.4, cols: 18, rows: 6, gap: 0.5, home: 'estate_own', property: 'estate_house' };

  // Named roads (by district pair) and streets inside districts.
  var ROAD_NAMES = {
    'ikeja-oshodi': 'Agege Motor Road', 'oshodi-mushin': 'Agege Motor Road', 'mushin-surulere': 'Funsho Williams Avenue',
    'mushin-yaba': 'Herbert Macaulay Way', 'surulere-festac': 'Badagry Expressway', 'surulere-yaba': 'Ojuelegba Road',
    'yaba-island': 'Third Mainland Bridge', 'ikeja-ikorodu': 'Kudirat Abiola Way', 'oshodi-festac': 'Apapa–Oshodi Expressway',
    'island-ikoyi': 'Awolowo Road', 'ikoyi-vi': 'Falomo Bridge', 'island-vi': 'Ahmadu Bello Way', 'ikoyi-lekki': 'Lekki–Ikoyi Link Bridge',
    'vi-lekki': 'Ozumba Mbadiwe Avenue', 'lekki-ajah': 'Lekki–Epe Expressway', 'ikorodu-yaba': 'Ikorodu Road'
  };
  var MAJOR_ROADS = ['Third Mainland Bridge', 'Lekki–Epe Expressway', 'Ikorodu Road'];
  var STREETS = [
    { name: 'Allen Avenue', a: [10.6, 4.4], b: [12.0, 3.9] },
    { name: 'Obafemi Awolowo Way', a: [9.2, 2.6], b: [11.6, 2.4] },
    { name: 'Herbert Macaulay Way', a: [14.2, 14.0], b: [15.8, 16.4] },
    { name: 'Bode Thomas Street', a: [9.0, 17.6], b: [11.0, 18.4] },
    { name: 'Broad Street', a: [15.0, 22.0], b: [17.0, 22.4] },
    { name: 'Adeola Odeku Street', a: [18.0, 24.4], b: [20.0, 24.9] },
    { name: 'Admiralty Way', a: [26.6, 23.0], b: [28.6, 23.2] },
    { name: 'Bourdillon Road', a: [19.6, 20.4], b: [20.6, 22.0] }
  ];
  // Big names painted on the ground: [text, x, y, size in km].
  var AREA_LABELS = [
    ['MAINLAND', 6.5, 12.5, 1.2], ['THE ISLAND', 15.0, 25.6, 0.8], ['IKOYI', 20.6, 22.6, 0.55], ['BANANA ISLAND', 23.6, 21.2, 0.45],
    ['LEKKI', 33.0, 24.8, 0.9], ['SEA PLOTS · ₦5,000 A PLOT', 30.8, 27.25, 0.42], ['EKO ATLANTIC', 16.6, 31.2, 0.7], ['WHITE SAND BEACH', 45.6, 32.0, 0.6], ['MAINLAND ESTATE', 18.0, 3.7, 0.55], ['AIRPORT', 6.4, 1.9, 0.5], ['IBEJU-LEKKI', 47.6, 22.3, 0.6],
    ['ABUJA', 19.0, 20.5, 1.2, 'abuja'], ['JABI LAKE', 6.6, 13.6, 0.45, 'abuja'], ['ASO ROCK', 22.6, 7.6, 0.5, 'abuja'], ['AIRPORT', 6.2, 25.6, 0.5, 'abuja'],
    ['PORT HARCOURT', 17.0, 6.0, 1.0, 'ph'], ['BONNY RIVER', 15.0, 23.4, 0.7, 'ph'], ['AIRPORT', 4.2, -0.2, 0.5, 'ph']
  ];

  // Ad boards at high-traffic spots. Players rent them with in-game naira.
  var BILLBOARDS = [
    { id: 'tmb', traffic: 1.8, name: 'Third Mainland Bridge, Yaba end', district: 'yaba', x: 16.3, y: 16.8 },
    { id: 'harbour_n', traffic: 2.0, name: 'Harbour Live, mainland bridge', district: 'island', x: 11.4, y: 23.7 },
    { id: 'harbour_e', traffic: 2.0, name: 'Harbour Live, Island bridge', district: 'island', x: 13.7, y: 24.1 },
    { id: 'harbour_s', traffic: 1.9, name: 'Harbour Live, Eko Atlantic bridge', district: 'island', x: 13.3, y: 26.2 },
    { id: 'oshodi', traffic: 1.5, name: 'Oshodi interchange', district: 'oshodi', x: 9.6, y: 9.9 },
    { id: 'allen', traffic: 1.3, name: 'Allen roundabout, Ikeja', district: 'ikeja', x: 10.2, y: 5.4 },
    { id: 'ikorodu_rd', traffic: 0.8, name: 'Ikorodu Road', district: 'ikorodu', x: 23.5, y: 4.3 },
    { id: 'ojuelegba', traffic: 1.1, name: 'Ojuelegba, Surulere', district: 'surulere', x: 12.0, y: 17.3 },
    { id: 'festac_link', traffic: 0.8, name: 'Festac link road', district: 'festac', x: 4.2, y: 16.9 },
    { id: 'marina', traffic: 1.2, name: 'Marina, Lagos Island', district: 'island', x: 16.1, y: 23.5 },
    { id: 'ozumba', traffic: 1.6, name: 'Ozumba Mbadiwe, VI', district: 'vi', x: 20.4, y: 24.2 },
    { id: 'lekki_toll', traffic: 1.7, name: 'Lekki toll gate', district: 'lekki', x: 25.6, y: 22.9 },
    { id: 'ajah_rb', traffic: 0.9, name: 'Ajah roundabout', district: 'ajah', x: 36.7, y: 24.3 },
    { id: 'eko_blvd', traffic: 1.6, name: 'Eko Atlantic boulevard', district: 'vi', x: 16.4, y: 28.75 },
    { id: 'eko_bridge', traffic: 1.5, name: 'Eko Atlantic bridge, VI end', district: 'vi', x: 17.9, y: 26.4 },
    { id: 'obalende', traffic: 1.3, name: 'Obalende motor park', district: 'island', x: 17.2, y: 21.4 },
    { id: 'ikoyi_link', traffic: 1.4, name: 'Ikoyi Link Bridge', district: 'ikoyi', x: 21.6, y: 21.4 },
    { id: 'admiralty', traffic: 1.5, name: 'Admiralty Way, Lekki Phase 1', district: 'lekki', x: 27.0, y: 23.4 },
    { id: 'stadium_rd', traffic: 1.0, name: 'National Stadium, Surulere', district: 'surulere', x: 10.4, y: 17.0 },
    { id: 'sabo', traffic: 1.1, name: 'Sabo, Yaba', district: 'yaba', x: 14.6, y: 14.2 },
    { id: 'airport_rd', traffic: 1.2, name: 'Airport Road, Ikeja', district: 'ikeja', x: 9.0, y: 6.0 },
    { id: 'idi_araba', traffic: 0.9, name: 'Idi-Araba, Mushin', district: 'mushin', x: 11.8, y: 12.2 },
    { id: 'kudirat_1', traffic: 1.4, name: 'Kudirat Abiola Way, Ikeja Along', district: 'ikeja', x: 10.7, y: 6.0 },
    { id: 'kudirat_2', traffic: 1.5, name: 'Kudirat Abiola Way, Alausa Secretariat', district: 'ikeja', x: 11.1, y: 5.43 },
    { id: 'kudirat_3', traffic: 1.3, name: 'Kudirat Abiola Way, NNPC junction', district: 'ikeja', x: 11.5, y: 4.87 },
    { id: 'kudirat_4', traffic: 1.4, name: 'Kudirat Abiola Way, Oregun', district: 'ikeja', x: 11.9, y: 4.3 },
    { id: 'kudirat_5', traffic: 1.2, name: 'Kudirat Abiola Way, Olusosun', district: 'ikeja', x: 12.3, y: 3.73 },
    { id: 'kudirat_6', traffic: 1.3, name: 'Kudirat Abiola Way, Ojota link', district: 'ikeja', x: 12.7, y: 3.17 },
    { id: 'kudirat_7', traffic: 1.5, name: 'Kudirat Abiola Way, by the Ikeja mall', district: 'ikeja', x: 13.1, y: 2.6 },
    { id: 'airport_1', traffic: 1.8, name: 'Murtala Muhammed Airport, arrivals', district: 'ikeja', x: 4.2, y: -0.3 },
    { id: 'airport_2', traffic: 1.8, name: 'Murtala Muhammed Airport, departures', district: 'ikeja', x: 6.0, y: -0.4 },
    { id: 'airport_3', traffic: 1.6, name: 'Airport terminal car park', district: 'ikeja', x: 8.0, y: -0.5 },
    { id: 'airport_4', traffic: 1.6, name: 'Airport Road roundabout', district: 'ikeja', x: 9.4, y: 1.7 },
    { id: 'lekki_epe_1', traffic: 1.4, name: 'Lekki–Epe Expressway, Jakande', district: 'lekki', x: 30.6, y: 24.2 },
    { id: 'lekki_epe_2', traffic: 1.2, name: 'Lekki–Epe Expressway, Sangotedo', district: 'ajah', x: 35.2, y: 24.7 },
    { id: 'lekki_epe_3', traffic: 1.1, name: 'Lekki–Epe Expressway, Abraham Adesanya', district: 'ajah', x: 39.5, y: 25.2 }
  ];
  // How long an ad runs and the price multiple (longer runs are cheaper per day).
  var AD_PLANS = {
    day:   { name: '1 day', days: 1, mult: 1 },
    three: { name: '3 days', days: 3, mult: 2.6 },
    week:  { name: '7 days', days: 7, mult: 5.5 }
  };
  // Ads are built from these parts only: no free text, so nothing to moderate.
  var AD_EMOJI = ['🔥', '💯', '🎉', '💼', '🍲', '📱', '🎶', '⚽', '💪', '🙏', '👑', '🚌', '🏠', '💡', '❤️', '🇳🇬'];
  var AD_SLOGANS = [
    'Hustle no dey sleep', 'Shine your eye', 'Eko o ni baje', 'Soft life loading', 'Japa? Not today',
    'Owambe this Saturday', 'Hiring sharp people', 'Fresh jollof daily', 'Fix your phone here', 'Danfo seats available',
    'Save small small', 'Ajo members wanted', 'Lekki traffic? Take the ferry', 'Vote wisely this week', 'Make your money work',
    'Gym till you drop', 'Your landlord is calling', 'Good morning, Lagos', 'God when?', 'We move'
  ];
  var AD_COLORS = [
    { bg: '#f2b600', fg: '#1a1500' }, { bg: '#17181a', fg: '#f2b600' }, { bg: '#0f6f78', fg: '#ffffff' },
    { bg: '#c2417f', fg: '#ffffff' }, { bg: '#1d7a43', fg: '#ffffff' }, { bg: '#f4f3ec', fg: '#17181a' }
  ];
  // Shown when a board has no paid ads: practical Lagos advice.
  var PSAS = [
    { emoji: '🔐', text: 'Your bank will never ask for your OTP' },
    { emoji: '🏠', text: 'Rent is due Saturday, 12 noon' },
    { emoji: '🚩', text: 'Too good to be true? It is a Ponzi' },
    { emoji: '🧺', text: 'Ajo: save small small' },
    { emoji: '🏍️', text: 'Okada is banned on the Island' },
    { emoji: '⛴️', text: 'Take the ferry, beat the traffic' },
    { emoji: '💡', text: 'No light? Gen fuel costs extra' },
    { emoji: '📵', text: 'Loan apps shame you to your contacts' },
    { emoji: '🗳️', text: 'Policy vote every 4 weeks' },
    { emoji: '🎓', text: 'Night classes at UNILAG' }
  ];
  var BILLBOARD_RENT = 100000;

  var HOME_ACTIONS = [
    { id: 'home_sleep', label: 'Sleep (8h)', mins: 480, special: 'sleep' },
    { id: 'home_alarm', label: 'Sleep with alarm set for work', mins: 480, special: 'sleep', alarm: true },
    { id: 'home_nap', label: 'Nap (2h)', mins: 120, special: 'nap' },
    { id: 'home_skit', label: 'Film a skit at home', mins: 90, fx: { fun: 6, energy: -6 }, xp: { charisma: 2 }, special: 'content', skit: true, when: { from: 8, to: 23 } },
    { id: 'home_bath', label: 'Bucket bath', mins: 30, fx: { hygiene: 60 } },
    { id: 'home_cook', label: 'Cook a meal', mins: 45, fx: { hunger: 55, fun: 3 }, xp: { cooking: 3 }, special: 'cook' },
    { id: 'home_nollywood', label: 'Watch Nollywood', mins: 120, fx: { fun: 30, stress: -10 }, power: true },
    { id: 'home_scroll', label: 'Scroll social media', mins: 60, cost: 200, fx: { fun: 12, social: 10, stress: 3 } },
    { id: 'home_youtube', label: 'Learn coding on YouTube', mins: 120, cost: 500, fx: { energy: -8 }, xp: { tech: 3 }, power: true },
    { id: 'home_practice', label: 'Practise music', mins: 60, fx: { fun: 8 }, xp: { music: 2 } },
    { id: 'home_freelance', label: 'Freelance gig online', mins: 180, earn: 12000, fx: { energy: -15, stress: 5 }, xp: { tech: 2 }, power: true, gig: true, req: { tech: 4 } },
    { id: 'home_neighbour', label: 'Ask a neighbour for food', mins: 30, fx: { hunger: 30, stress: 10, social: -5 }, special: 'welfare' },
    { id: 'home_pushups', label: 'Home workout', mins: 45, fx: { energy: -10, hygiene: -10, stress: -5 }, xp: { fitness: 2 } }
  ];

  // NPCs — make friends; a strong friendship is a "connect" into their career.
  var NPCS = {
    tunde:    { name: 'Tunde',      role: 'barber',          district: 'mushin',   career: 'buka' },
    chiamaka: { name: 'Chiamaka',   role: 'software engineer', district: 'yaba',   career: 'tech' },
    kunle:    { name: 'Kunle',      role: 'banker',          district: 'vi',       career: 'bank' },
    bisi:     { name: 'Mama Bisi',  role: 'fabric trader',   district: 'island',   career: 'trader' },
    emeka:    { name: 'Emeka',      role: 'phone engineer',  district: 'ikeja',    career: 'phones' },
    zainab:   { name: 'Zainab',     role: 'fitness coach',   district: 'lekki',    career: 'fitness' },
    femi:     { name: 'Femi Beatz', role: 'music producer',  district: 'surulere', career: 'music' },
    sule:     { name: 'Alhaji Sule', role: 'danfo owner',    district: 'oshodi',   career: 'danfo' }
  };

  // Daily payout at 18:00 after running costs. upkeep: needs a visit every 7 days.
  var BUSINESSES = {
    // tier: how Lagos ranks the trade, from low capital and thin margins to big capital and big profit.
    pos:      { name: 'POS kiosk', price: 150000, daily: 4200, power: false, tier: 'low' },
    buka:     { name: 'Buka', price: 600000, daily: 15000, power: false, tier: 'mid' },
    barber:   { name: 'Barbershop', price: 900000, daily: 21000, power: true, tier: 'mid' },
    laundry:  { name: 'Laundry', price: 1500000, daily: 33000, power: true, tier: 'low' },
    danfo:    { name: 'Danfo bus', price: 4000000, daily: 80000, power: false, risky: true, tier: 'mid' },
    event:    { name: 'Event centre', price: 25000000, daily: 420000, power: true, weekend: true, tier: 'high' },
    shortlet: { name: 'Short-let flat, Lekki', price: 60000000, daily: 900000, power: true, december: 2, tier: 'high' },
    // Low capital, daily cash, heavy competition.
    recharge: { name: 'Recharge card and data kiosk', price: 60000, daily: 1600, power: false, tier: 'low' },
    smallchops: { name: 'Small chops and street food stand', price: 120000, daily: 3200, power: false, tier: 'low', december: 1.3 },
    stall:    { name: 'Market stall (Balogun or Computer Village)', price: 250000, daily: 6000, power: false, tier: 'low', december: 1.3 },
    phonefix: { name: 'Phone repair corner', price: 180000, daily: 4500, power: true, tier: 'low' },
    okada:    { name: 'Okadas and kekes on hire purchase', price: 900000, daily: 18000, power: false, risky: true, tier: 'low' },
    // Steady middle-class demand.
    carwash:  { name: 'Car wash', price: 700000, daily: 16000, power: true, tier: 'mid', december: 1.4 },
    salon:    { name: 'Beauty salon and nail bar', price: 1200000, daily: 26000, power: true, tier: 'mid', december: 1.5 },
    reseller: { name: 'Mini importation (online reseller)', price: 800000, daily: 17000, power: false, tier: 'mid', december: 1.4 },
    catering: { name: 'Catering for owambes', price: 2000000, daily: 42000, power: false, weekend: true, tier: 'mid', december: 1.5 },
    delivery: { name: 'Delivery riders (last-mile logistics)', price: 3000000, daily: 60000, power: false, risky: true, tier: 'mid', december: 1.3 },
    school:   { name: 'Private nursery and primary school', price: 15000000, daily: 260000, power: true, weekdays: true, tier: 'mid' },
    construction: { name: 'Building materials and contracting', price: 8000000, daily: 150000, power: false, risky: true, tier: 'mid' },
    // Big capital, location and networks.
    tech:     { name: 'Digital agency and fintech app', price: 30000000, daily: 450000, power: true, tier: 'high' },
    import:   { name: 'Import/export wholesale (Apapa port)', price: 50000000, daily: 700000, power: false, risky: true, tier: 'high' },
    carrental: { name: 'Luxury car rental', price: 70000000, daily: 900000, power: false, tier: 'high', december: 2.5 },
    haulage:  { name: 'Haulage trucks and freight', price: 60000000, daily: 800000, power: false, risky: true, tier: 'high' },
    nightclub: { name: 'Nightclub share, VI', price: 90000000, daily: 1100000, power: true, weekend: true, tier: 'high', december: 2 },
    oilgas:   { name: 'Oil and gas supply services', price: 150000000, daily: 1800000, power: false, risky: true, tier: 'high' }
  };
  var BUSINESS_TIERS = { high: 'High income: big capital, location and networks', mid: 'Mid-range: steady demand, good margins if well run', low: 'Entry level: little capital, daily cash, thin margins' };

  // Where you build a business: a payout factor and weekly shop rent.
  var BUSINESS_SITES = {
    ikeja: { mult: 1.1, rent: 15000 }, ikorodu: { mult: 0.85, rent: 4000 }, oshodi: { mult: 1.05, rent: 8000 },
    mushin: { mult: 0.9, rent: 5000 }, festac: { mult: 0.95, rent: 7000 }, surulere: { mult: 1.0, rent: 9000 },
    yaba: { mult: 1.05, rent: 12000 }, island: { mult: 1.1, rent: 14000 }, ikoyi: { mult: 1.2, rent: 35000 },
    vi: { mult: 1.25, rent: 40000 }, lekki: { mult: 1.25, rent: 30000 }, ajah: { mult: 0.95, rent: 8000 },
    abj_wuse: { mult: 1.1, rent: 16000 }, abj_garki: { mult: 1.05, rent: 14000 }, abj_kubwa: { mult: 0.85, rent: 4500 },
    ph_gra: { mult: 1.1, rent: 15000 }, ph_dline: { mult: 1.0, rent: 8000 }, ph_rumuokoro: { mult: 0.9, rent: 5000 }
  };
  // Upgrades: what each business becomes at levels 2 and 3, and its emoji on the map.
  var BUSINESS_GROWTH = {
    pos:      { icon: '🏧', names: ['POS kiosk', 'POS and bill-pay shop', 'Agent banking hub'] },
    buka:     { icon: '🍲', names: ['Buka', 'Restaurant', 'Restaurant chain'] },
    barber:   { icon: '💈', names: ['Barbershop', 'Grooming lounge', 'Salon franchise'] },
    laundry:  { icon: '🧺', names: ['Laundry', 'Dry cleaner', 'Laundry chain'] },
    danfo:    { icon: '🚌', names: ['Danfo bus', 'Danfo fleet', 'Transport company'] },
    event:    { icon: '🎉', names: ['Event centre', 'Banquet hall', 'Events empire'] },
    shortlet: { icon: '🏙️', names: ['Short-let flat, Lekki', 'Short-let block', 'Serviced apartments'] },
    recharge: { icon: '📶', names: ['Recharge card and data kiosk', 'Data and bill-pay shop', 'Airtime distributor'] },
    smallchops: { icon: '🍢', names: ['Small chops and street food stand', 'Small chops kitchen', 'Party trays company'] },
    stall:    { icon: '🧺', names: ['Market stall', 'Market shop', 'Wholesale shop'] },
    phonefix: { icon: '🔧', names: ['Phone repair corner', 'Gadget clinic', 'Phone repair chain'] },
    okada:    { icon: '🛺', names: ['Okadas and kekes on hire purchase', 'Keke fleet', 'Transport finance company'] },
    carwash:  { icon: '🫧', names: ['Car wash', 'Car wash and detailing', 'Auto spa chain'] },
    salon:    { icon: '💅', names: ['Beauty salon and nail bar', 'Beauty studio', 'Beauty franchise'] },
    reseller: { icon: '📦', names: ['Mini importation (online reseller)', 'Online store and warehouse', 'E-commerce brand'] },
    catering: { icon: '🍛', names: ['Catering for owambes', 'Catering company', 'Events catering group'] },
    delivery: { icon: '🛵', names: ['Delivery riders', 'Delivery fleet', 'Logistics company'] },
    school:   { icon: '🏫', names: ['Private nursery and primary school', 'Primary and secondary school', 'School group'] },
    construction: { icon: '🏗️', names: ['Building materials and contracting', 'Construction company', 'Developer'] },
    tech:     { icon: '💻', names: ['Digital agency and fintech app', 'Fintech startup', 'Fintech unicorn'] },
    import:   { icon: '🚢', names: ['Import/export wholesale', 'Trading house', 'Import conglomerate'] },
    carrental: { icon: '🏎️', names: ['Luxury car rental', 'Luxury fleet', 'Chauffeur and fleet company'] },
    haulage:  { icon: '🚛', names: ['Haulage trucks', 'Haulage fleet', 'Freight company'] },
    nightclub: { icon: '🍾', names: ['Nightclub share, VI', 'Nightclub', 'Nightlife group'] },
    oilgas:   { icon: '🛢️', names: ['Oil and gas supply services', 'Oilfield services', 'Energy group'] }
  };
  var BUSINESS_LEVEL = { cost: [0, 0.8, 1.6], mult: [1, 1.6, 2.4] };

  var PROPERTIES = {
    iko_plot:  { name: 'Plot of land, Ikorodu', price: 6000000, weekly: 0, house: false },
    iko_house: { name: 'Bungalow, Ikorodu', price: 35000000, weekly: 90000, house: true },
    lekki_terrace: { name: 'Terrace, Lekki', price: 150000000, weekly: 450000, house: true },
    estate_house: { name: 'House in Mainland Estate', price: 12000000, weekly: 0, house: true, plot: true },
    // Built by you on your Ikorodu plot (never sold). Tenants pay only while you live elsewhere.
    // Prime Lagos addresses, from accessible-upscale to the very top. Live in one (no rent) or let it.
    // charge: the estate's weekly service charge (security, power, water), paid whatever you do.
    lekki_nicon:  { name: 'Detached duplex, Nicon Town, Lekki Phase 1', price: 250000000, weekly: 700000, charge: 60000, house: true, home: 'lekki_nicon_own', status: 15, prime: 5 },
    vi_luxapt:    { name: 'Luxury apartment, Victoria Island', price: 400000000, weekly: 1100000, charge: 90000, house: true, home: 'vi_luxapt_own', status: 20, prime: 4 },
    eko_atlantic: { name: 'Penthouse, Eko Atlantic', price: 900000000, weekly: 2200000, charge: 180000, house: true, home: 'eko_atlantic_own', status: 35, prime: 3 },
    ikoyi_parkview: { name: 'Mansion, Parkview Estate, Ikoyi', price: 1500000000, weekly: 3500000, charge: 250000, house: true, home: 'ikoyi_parkview_own', status: 50, prime: 2 },
    banana_island: { name: 'Waterfront mansion, Banana Island', price: 4000000000, weekly: 8000000, charge: 600000, house: true, home: 'banana_island_own', status: 100, prime: 1 },
    hp_terrace: { name: 'Terrace, Garden Row, Lekki Hyde Park', price: 120000000, weekly: 380000, charge: 45000, house: true, home: 'hp_terrace_own', status: 10, hydepark: 'low' },
    hp_semi: { name: 'Semi-detached, Park Crescent, Lekki Hyde Park', price: 280000000, weekly: 800000, charge: 75000, house: true, home: 'hp_semi_own', status: 18, hydepark: 'middle' },
    hp_vip: { name: 'Gated villa, Celebrity Row, Lekki Hyde Park', price: 1800000000, weekly: 4200000, charge: 350000, house: true, home: 'hp_vip_own', status: 60, hydepark: 'vip' },
    hp_billionaire: { name: 'Lagoon-front mansion, Billionaire Row, Lekki Hyde Park', price: 3000000000, weekly: 6500000, charge: 500000, house: true, home: 'hp_billionaire_own', status: 80, hydepark: 'billionaire' },
    hp_island: { name: 'Private island lot, Lekki Hyde Park', price: 8000000000, weekly: 15000000, charge: 1200000, house: true, home: 'hp_island_own', status: 150, hydepark: 'super' },
    // Empty plots in each zone, to build on yourself (cheaper, slower).
    hp_plot_low: { name: 'Plot, Garden Row, Lekki Hyde Park', price: 36000000, weekly: 0, charge: 15000, house: false, hpZone: 'low' },
    hp_plot_middle: { name: 'Plot, Park Crescent, Lekki Hyde Park', price: 84000000, weekly: 0, charge: 25000, house: false, hpZone: 'middle' },
    hp_plot_vip: { name: 'Plot, Celebrity Row, Lekki Hyde Park', price: 540000000, weekly: 0, charge: 100000, house: false, hpZone: 'vip' },
    hp_plot_billionaire: { name: 'Plot, Billionaire Row, Lekki Hyde Park', price: 900000000, weekly: 0, charge: 150000, house: false, hpZone: 'billionaire' },
    hp_plot_super: { name: 'Islet plot, Lekki Hyde Park', price: 2400000000, weekly: 0, charge: 350000, house: false, hpZone: 'super' },
    built_house: { name: 'Your own house, Ikorodu', price: 0, weekly: 70000, house: true, hidden: true, home: 'built_own' }
  };
  // Lekki Hyde Park zones, from the expressway gate to the lagoon. Build stages are shares of the ready-built price.
  var HYDE_PARK = {
    name: 'Lekki Hyde Park', district: 'lekki', box: [30.9, 22.6, 33.1, 24.0], gate: [32.0, 24.0],
    zones: {
      low: { name: 'Garden Row', tier: 'Low-class rich', house: 'hp_terrace', plot: 'hp_plot_low', style: 'Terraces' },
      middle: { name: 'Park Crescent', tier: 'Middle-class rich', house: 'hp_semi', plot: 'hp_plot_middle', style: 'Semi-detached houses' },
      vip: { name: 'Celebrity Row', tier: 'VIP and celebrity', house: 'hp_vip', plot: 'hp_plot_vip', style: 'Gated villas with home studios' },
      billionaire: { name: 'Billionaire Row', tier: 'Billionaires', house: 'hp_billionaire', plot: 'hp_plot_billionaire', style: 'Lagoon-front mansions' },
      super: { name: 'The Islet', tier: 'Super-luxury', house: 'hp_island', plot: 'hp_plot_super', style: 'A private island' }
    },
    approval: 0.02,
    stages: [
      { name: 'Foundation and piling', share: 0.15, days: 4, icon: '🧱' },
      { name: 'Structure and roof', share: 0.3, days: 8, icon: '🏗️' },
      { name: 'Finishing and landscaping', share: 0.25, days: 6, icon: '🌴' }
    ]
  };
  // Building on your Ikorodu plot, one stage at a time (days each).
  var BUILD = {
    levy: 250000, // the omo-onile "development levy", paid before the foundation
    stages: [
      { name: 'Foundation', cost: 1500000, days: 5, icon: '🧱' },
      { name: 'Blocks to lintel level', cost: 3000000, days: 10, icon: '🏗️' },
      { name: 'Roofing', cost: 2000000, days: 5, icon: '🏠' },
      { name: 'Plastering, windows and doors', cost: 3500000, days: 10, icon: '🪟' },
      { name: 'Finishing, tiles and paint', cost: 2500000, days: 7, icon: '🎨' }
    ]
  };

  var CAR = { name: 'Tokunbo saloon', price: 8000000 };

  var POLICIES = {
    fares:   { name: 'Transport fare subsidy', text: 'All fares 20% cheaper.' },
    okada:   { name: 'Okada ban expansion', text: 'Okada banned in every district except Mushin, Oshodi, Festac, Ikorodu and Ajah.' },
    tenancy: { name: 'Tenancy reform', text: 'No rent increases. Move-in fees halved.' },
    power:   { name: 'Power levy', text: '₦1,000 weekly levy. Light is far more steady everywhere.' }
  };

  // CBN governor race (rules 7+): every 4 weeks, two weeks after the
  // governorship vote. The winner's monetary stance lasts 4 weeks.
  var CBN = {
    hawk:    { name: 'The Hawk', icon: '🦅', text: 'Tight money. Savings 0.6% a week, treasury bills 2%, new loans 50% dearer, and inflation slows by half.', save: 0.006, bill: 0.02, loan: 1.5, infl: 0.5 },
    dove:    { name: 'The Dove', icon: '🕊️', text: 'Cheap money. Savings 0.1% a week, treasury bills 0.5%, new loans 40% cheaper, and inflation runs 50% faster.', save: 0.001, bill: 0.005, loan: 0.6, infl: 1.5 },
    builder: { name: 'The Builder', icon: '🏗️', text: 'Development finance. Businesses earn 15% more and cooperative loans go 50% higher. Rates stay where they are.', save: 0.003, bill: 0.01, loan: 1, infl: 1, biz: 1.15, coop: 1.5 }
  };

  // Gifts between players are symbolic: the sender pays, the receiver's mood lifts. No cash changes hands.
  var GIFTS = {
    suya:    { name: 'Tray of suya', icon: '🍢', price: 3000, fx: { fun: 10, social: 10, hunger: 15 } },
    flowers: { name: 'Bouquet of flowers', icon: '💐', price: 8000, fx: { social: 15, stress: -5 } },
    cake:    { name: 'Birthday cake', icon: '🎂', price: 15000, fx: { fun: 15, social: 15 } },
    fabric:  { name: 'Aso-ebi fabric', icon: '🧵', price: 40000, fx: { social: 25, stress: -8 } }
  };

  var GOALS = {
    japa:     { name: 'Japa', text: 'Pass IELTS and show ₦15m proof of funds for a visa.' },
    landlord: { name: 'Landlord', text: 'Own a house in Lagos.' },
    odogwu:   { name: 'Odogwu', text: 'Reach the top of any career.' },
    freestyle:{ name: 'Freestyle', text: 'No goal. Just survive Lagos.' }
  };

  // Fishing: buy a rod once, then cast at the cruise rail or a waterfront. Three casts a day; the lagoon is not a bank.
  var FISHING = {
    rod: 12000, castsPerDay: 3, mins: 45, fx: { stress: -8, energy: -6 },
    spots: { ikoyi: 'Five Cowries Creek', lekki: 'the Lekki lagoon front', ajah: 'the Ajah coast', island: 'the Marina waterfront', ph_borokiri: 'the Bonny River', festac: 'the Festac creek' },
    catch: [
      { id: 'none', name: 'Nothing bites', icon: '🌊', w: 30, value: 0 },
      { id: 'boot', name: 'An old slipper', icon: '🩴', w: 8, value: 0 },
      { id: 'tilapia', name: 'Tilapia', icon: '🐟', w: 28, value: 1500 },
      { id: 'catfish', name: 'Catfish', icon: '🐟', w: 18, value: 3000 },
      { id: 'croaker', name: 'Croaker', icon: '🐠', w: 11, value: 4500 },
      { id: 'barracuda', name: 'Barracuda', icon: '🐡', w: 4, value: 9000 },
      { id: 'tarpon', name: 'Tarpon', icon: '🦈', w: 1, value: 20000 }
    ],
    sellRate: 0.8
  };
  // Live rooms on the shared deck renderer (the cruise has its own calls). Entry buys two hours there.
  var ROOMS = {
    beach: { name: 'White Sand Beach', place: 'white_sand_beach', where: 'Ibeju-Lekki coast', fee: 3000, mins: 120, from: 7, to: 19, fx: { fun: 20, stress: -10 },
      spots: {
        bar: { name: 'Beach bar', icon: '🍹', cost: 2000, fx: { hunger: 15, fun: 8 }, text: 'Coconut water straight from the shell.' },
        volley: { name: 'Volleyball', icon: '🏐', cost: 0, fx: { fun: 15, social: 10, energy: -10 }, xp: { fitness: 1 }, text: 'Two-touch volleyball with strangers.' },
        loungers: { name: 'Loungers', icon: '⛱️', cost: 1500, fx: { stress: -12, energy: 6 }, text: 'An umbrella, a lounger and the Atlantic breeze.' },
        jetski: { name: 'Jet ski dock', icon: '🌊', cost: 15000, fx: { fun: 30, stress: -6, energy: -8 }, text: 'Fifteen minutes flat out over the waves.' },
        bonfire: { name: 'Bonfire', icon: '🔥', cost: 0, fx: { social: 14, fun: 10 }, text: 'Guitars and gist round the fire.' }
      } },
    tidewater: { name: 'Tidewater House', place: 'club_tidewater', where: 'Ademola Street, Ikoyi', fee: 0, club: 'tidewater', mins: 180, from: 16, to: 24, fx: { social: 15, fun: 15 },
      spots: {
        dj: { name: 'DJ booth', icon: '🎧', cost: 0, fx: { fun: 20, social: 12, energy: -10 }, text: 'Deep house as the sun goes down.' },
        oven: { name: 'Pizza oven', icon: '🍕', cost: 12000, fx: { hunger: 40, fun: 6 }, text: 'Suya pizza out of the wood-fired oven.' },
        jetty: { name: 'Jetty', icon: '🛥️', cost: 0, fx: { fun: 10, stress: -8 }, text: 'Boats tie up and members climb aboard.' },
        lounge: { name: 'Lounge', icon: '🛋️', cost: 0, fx: { social: 14, stress: -8 }, text: 'Low sofas and the pregame before the clubs.' },
        bar: { name: 'Bar', icon: '🥂', cost: 9000, fx: { fun: 12, social: 8 }, text: 'A long drink with a lagoon view.' }
      } },
    club: { name: 'The VI club strip', place: 'vi_strip', where: 'Victoria Island', fee: 10000, mins: 180, from: 22, to: 28, fx: { fun: 20, social: 15, energy: -10 },
      spots: {
        floor: { name: 'Dance floor', icon: '🪩', cost: 0, fx: { fun: 25, social: 12, energy: -14 }, text: 'Amapiano drop. The whole floor bounces.' },
        dj: { name: 'DJ booth', icon: '🎧', cost: 0, fx: { fun: 12, social: 6 }, text: 'The DJ shouts out your name. Small celebrity.' },
        bar: { name: 'Bar', icon: '🍸', cost: 6000, fx: { fun: 10, social: 8 }, text: 'Two shots and a chaser.' },
        vip: { name: 'VIP booth', icon: '🍾', cost: 80000, fx: { fun: 30, social: 25, stress: -8 }, text: 'Sparklers on the bottle. Everyone looks over.' },
        spray: { name: 'Spray money', icon: '💸', cost: 20000, fx: { fun: 20, social: 18 }, text: 'Crisp naira notes rain on the dance floor.' }
      } },
    market: { name: 'Balogun market', place: 'balogun', where: 'Lagos Island', fee: 0, mins: 120, from: 8, to: 18, fx: { energy: -6 },
      spots: {
        fabric: { name: 'Fabric lane', icon: '🧵', cost: 0, fx: { fun: 6 }, xp: { craft: 1 }, text: 'Ankara, lace and aso-oke stacked to the roof.' },
        phones: { name: 'Phone stalls', icon: '📱', cost: 0, fx: { fun: 5 }, xp: { tech: 1 }, text: 'Screen guards, chargers and big talk.' },
        buka: { name: 'Buka', icon: '🍛', cost: 1500, fx: { hunger: 40 }, text: 'Amala, ewedu and gbegiri, eaten standing.' },
        shoes: { name: 'Shoe sellers', icon: '👟', cost: 0, fx: { fun: 4 }, xp: { hustle: 1, charisma: 1 }, text: 'You haggle the price down by half. Respect.' },
        gate: { name: 'Market gate', icon: '🚪', cost: 0, fx: { social: 6 }, text: 'Alaaru with loads on their heads push past.' }
      } },
    park: { name: 'Freedom Park', place: 'freedom', where: 'Lagos Island', fee: 1000, mins: 150, from: 16, to: 23, fx: { fun: 15, stress: -6 },
      spots: {
        stage: { name: 'Main stage', icon: '🎤', cost: 0, fx: { fun: 25, social: 10 }, text: 'Live highlife and afrobeat under the lights.' },
        seats: { name: 'Amphitheatre', icon: '🪑', cost: 0, fx: { stress: -10, fun: 8 }, text: 'You find a seat on the stone steps.' },
        food: { name: 'Food court', icon: '🍢', cost: 2500, fx: { hunger: 35, fun: 4 }, text: 'Suya, asun and a cold drink.' },
        art: { name: 'Art stalls', icon: '🎨', cost: 0, fx: { fun: 10 }, xp: { craft: 1 }, text: 'Paintings and beadwork by young artists.' },
        trees: { name: 'Under the trees', icon: '🌳', cost: 0, fx: { stress: -12, social: 6 }, text: 'Old prison walls, new conversations.' }
      } },
    // Abuja and Port Harcourt rooms reuse the club, market and park layouts (same spot ids) with local names.
    wuse2: { name: 'Wuse 2 nights', place: 'abj_wuse2', layout: 'club', sign: 'WUSE 2', where: 'Wuse, Abuja', fee: 8000, mins: 180, from: 22, to: 28, fx: { fun: 18, social: 14, energy: -10 },
      spots: {
        floor: { name: 'Dance floor', icon: '🪩', cost: 0, fx: { fun: 22, social: 12, energy: -14 }, text: 'Afrobeats and a few civil servants letting loose.' },
        dj: { name: 'DJ booth', icon: '🎧', cost: 0, fx: { fun: 12, social: 6 }, text: 'The DJ plays your request. Nobody else likes it.' },
        bar: { name: 'Bar', icon: '🍸', cost: 5000, fx: { fun: 10, social: 8 }, text: 'Chilled stout and a plate of peppered gizzard.' },
        vip: { name: 'VIP booth', icon: '🍾', cost: 70000, fx: { fun: 28, social: 24, stress: -8 }, text: 'A table full of contractors. You nod like you belong.' },
        spray: { name: 'Spray money', icon: '💸', cost: 20000, fx: { fun: 20, social: 18 }, text: 'New notes fly. The hype man shouts your name.' }
      } },
    wuse_mkt: { name: 'Wuse Market', place: 'abj_wuse_market', layout: 'market', sign: 'WUSE MARKET', where: 'Wuse, Abuja', fee: 0, mins: 120, from: 8, to: 18, fx: { energy: -6 },
      spots: {
        fabric: { name: 'Cloth section', icon: '🧵', cost: 0, fx: { fun: 6 }, xp: { craft: 1 }, text: 'Atampa, ankara and northern embroidery.' },
        phones: { name: 'Phone plaza', icon: '📱', cost: 0, fx: { fun: 5 }, xp: { tech: 1 }, text: 'UK-used phones and a man who fixes anything.' },
        buka: { name: 'Mama Put', icon: '🍛', cost: 1500, fx: { hunger: 40 }, text: 'Tuwo shinkafa and miyan kuka.' },
        shoes: { name: 'Shoe line', icon: '👟', cost: 0, fx: { fun: 4 }, xp: { hustle: 1, charisma: 1 }, text: 'You talk the price down. The seller laughs.' },
        gate: { name: 'Market gate', icon: '🚪', cost: 0, fx: { social: 6 }, text: 'Wheelbarrow boys shout for loads to carry.' }
      } },
    millennium: { name: 'Millennium Park', place: 'abj_millennium', layout: 'park', sign: 'MILLENNIUM PARK', where: 'Maitama, Abuja', fee: 0, mins: 150, from: 7, to: 19, fx: { fun: 12, stress: -8 },
      spots: {
        stage: { name: 'Park stage', icon: '🎤', cost: 0, fx: { fun: 18, social: 10 }, text: 'A church choir rehearses for Sunday.' },
        seats: { name: 'Steps', icon: '🪑', cost: 0, fx: { stress: -10, fun: 6 }, text: 'You sit by the river and watch the joggers.' },
        food: { name: 'Picnic stand', icon: '🍢', cost: 2000, fx: { hunger: 30, fun: 4 }, text: 'Suya, kilishi and a cold zobo.' },
        art: { name: 'Photo corner', icon: '📸', cost: 0, fx: { fun: 10, social: 4 }, text: 'Wedding couples queue for the same fountain shot.' },
        trees: { name: 'Under the trees', icon: '🌳', cost: 0, fx: { stress: -14, social: 6 }, text: 'Cool shade and the hum of the capital.' }
      } },
    garden_city: { name: 'Garden City nights', place: 'ph_garden', layout: 'club', sign: 'GARDEN CITY', where: 'GRA, Port Harcourt', fee: 8000, mins: 180, from: 22, to: 28, fx: { fun: 20, social: 14, energy: -10 },
      spots: {
        floor: { name: 'Dance floor', icon: '🪩', cost: 0, fx: { fun: 24, social: 12, energy: -14 }, text: 'Owerri bongo into amapiano. PH does not sleep.' },
        dj: { name: 'DJ booth', icon: '🎧', cost: 0, fx: { fun: 12, social: 6 }, text: 'The DJ greets everyone from Rumuola.' },
        bar: { name: 'Bar', icon: '🍸', cost: 5000, fx: { fun: 10, social: 8 }, text: 'Palm wine cocktails. Strong.' },
        vip: { name: 'VIP booth', icon: '🍾', cost: 75000, fx: { fun: 28, social: 24, stress: -8 }, text: 'Oil-service men order bottles by the crate.' },
        spray: { name: 'Spray money', icon: '💸', cost: 20000, fx: { fun: 20, social: 18 }, text: 'Notes rain down. The hype man calls you chairman.' }
      } },
    mile1: { name: 'Mile 1 market', place: 'ph_mile1', layout: 'market', sign: 'MILE 1 MARKET', where: 'D-Line, Port Harcourt', fee: 0, mins: 120, from: 7, to: 18, fx: { energy: -6 },
      spots: {
        fabric: { name: 'Wrapper lane', icon: '🧵', cost: 0, fx: { fun: 6 }, xp: { craft: 1 }, text: 'George wrappers and Kalabari prints.' },
        phones: { name: 'Phone stalls', icon: '📱', cost: 0, fx: { fun: 5 }, xp: { tech: 1 }, text: 'Chargers, cases and arguments about football.' },
        buka: { name: 'Fish and bole', icon: '🐟', cost: 2000, fx: { hunger: 40 }, text: 'Roast plantain, catfish and pepper sauce.' },
        shoes: { name: 'Fish sellers', icon: '🦐', cost: 0, fx: { fun: 4 }, xp: { hustle: 1, charisma: 1 }, text: 'Periwinkle, crayfish and loud bargaining.' },
        gate: { name: 'Market gate', icon: '🚪', cost: 0, fx: { social: 6 }, text: 'Keke riders call out for Rumuokoro.' }
      } },
    isaac_boro: { name: 'Isaac Boro Park', place: 'ph_isaac', layout: 'park', sign: 'ISAAC BORO PARK', where: 'Old GRA, Port Harcourt', fee: 0, mins: 150, from: 7, to: 19, fx: { fun: 12, stress: -8 },
      spots: {
        stage: { name: 'Bandstand', icon: '🎤', cost: 0, fx: { fun: 18, social: 10 }, text: 'An ogene band warms up for the weekend.' },
        seats: { name: 'Steps', icon: '🪑', cost: 0, fx: { stress: -10, fun: 6 }, text: 'Old men argue politics on the steps.' },
        food: { name: 'Corn and ube', icon: '🌽', cost: 1000, fx: { hunger: 25, fun: 4 }, text: 'Roast corn and ube from the woman by the gate.' },
        art: { name: 'Memorial', icon: '🗿', cost: 0, fx: { fun: 6 }, xp: { craft: 1 }, text: 'You read the plaques under the old statue.' },
        trees: { name: 'Under the trees', icon: '🌳', cost: 0, fx: { stress: -14, social: 6 }, text: 'Old trees, quiet paths, a cool breeze from the creek.' }
      } }
  };
  // Friends who hang out in a live room (NPC id -> spot). Lagos people stay in Lagos rooms.
  var ROOM_NPCS = {
    market: { bisi: 'buka' }, park: { femi: 'stage' }, tidewater: { kunle: 'lounge' },
    beach: { zainab: 'volley' }, club: { chiamaka: 'floor' }
  };
  // Local friends in Abuja and Port Harcourt rooms. Kept apart from NPCS (and its random pool) so old lives replay unchanged.
  // perk at friendship 40+ (rules 15): free entry, or one free plate a day at a spot.
  var LOCALS = {
    hauwa:  { name: 'Hauwa',  role: 'civil servant',          room: 'wuse_mkt',    spot: 'buka',  perk: { spot: 'buka' },  text: 'She buys lunch for the whole office here.' },
    musa:   { name: 'Musa',   role: 'mai shayi (tea seller)',  room: 'millennium',  spot: 'food',  perk: { spot: 'food' },  text: 'Sweet tea and gist by the river.' },
    kachi:  { name: 'Kachi',  role: 'party promoter',          room: 'wuse2',       spot: 'bar',   perk: { entry: true },   text: 'Knows every bouncer on the strip.' },
    ibiere: { name: 'Ibiere', role: 'fish trader',             room: 'mile1',       spot: 'shoes', perk: { spot: 'buka' },  text: 'Her boats come in from the creeks before dawn.' },
    tamuno: { name: 'Tamuno', role: 'oil-service engineer',    room: 'garden_city', spot: 'vip',   perk: { entry: true },   text: 'Two weeks offshore, two weeks in GRA.' },
    ebiere: { name: 'Ebiere', role: 'teacher',                 room: 'isaac_boro',  spot: 'seats', perk: { spot: 'food' },  text: 'Marks homework on the park steps.' }
  };
  // Weekly room nights: one event per venue on a fixed weekday (0 Mon … 6 Sun), joined once inside the room.
  var ROOM_NIGHTS = {
    beach:       { spot: 'bonfire', dow: 6, from: 12, to: 18, name: 'Sunday beach jam', icon: '🥁', fee: 3000, fx: { fun: 25, social: 20, stress: -10 }, crew: 'Drummers', text: 'Talking drums, sand dancing and suya by the waves.' },
    tidewater:   { spot: 'dj', dow: 6, from: 16, to: 22, name: 'Sunday day party', icon: '🌅', fee: 15000, fx: { fun: 25, social: 25, stress: -8 }, crew: 'Guest DJ', text: 'The deck fills up and the DJ plays into the sunset.' },
    club:        { spot: 'dj', dow: 5, from: 23, to: 27, name: 'Amapiano Saturday', icon: '🎹', fee: 15000, fx: { fun: 30, social: 22, energy: -15 }, crew: 'Log drummer', text: 'The log drum hits and the whole strip moves as one.' },
    market:      { spot: 'gate', dow: 3, from: 9, to: 15, name: 'Thursday fabric day', icon: '🧵', fee: 0, fx: { fun: 8, social: 10 }, xp: { craft: 1, hustle: 1 }, crew: 'Lace trader', text: 'New lace arrives from the warehouse. You learn which bales are real.' },
    park:        { spot: 'stage', dow: 4, from: 18, to: 23, name: 'Friday poetry and highlife', icon: '📜', fee: 2000, fx: { fun: 22, social: 15, stress: -10 }, xp: { charisma: 1 }, crew: 'Poet', text: 'Spoken word, then a highlife band until late.' },
    wuse2:       { spot: 'spray', dow: 4, from: 22, to: 27, name: 'Friday jollof and afrobeats', icon: '🍛', fee: 10000, fx: { fun: 25, social: 20, hunger: 25 }, crew: 'Hype man', text: 'Party jollof at midnight and the DJ never stops.' },
    wuse_mkt:    { spot: 'gate', dow: 1, from: 9, to: 15, name: 'Tuesday grain day', icon: '🌾', fee: 0, fx: { social: 10 }, xp: { hustle: 1 }, crew: 'Grain trader', text: 'Lorries from the north unload. Prices move by the hour.' },
    millennium:  { spot: 'stage', dow: 6, from: 10, to: 17, name: 'Picnic Sunday', icon: '🧺', fee: 2000, fx: { fun: 20, social: 15, stress: -12 }, crew: 'Choir', text: 'Families, picnic mats and a choir by the river.' },
    garden_city: { spot: 'dj', dow: 5, from: 23, to: 27, name: 'Garden City Saturday', icon: '🎷', fee: 12000, fx: { fun: 28, social: 22, energy: -15 }, crew: 'Saxophonist', text: 'Live sax over the beats. PH shows Lagos how it is done.' },
    mile1:       { spot: 'gate', dow: 2, from: 7, to: 13, name: 'Wednesday fish market', icon: '🐟', fee: 0, fx: { social: 10, hunger: 10 }, xp: { hustle: 1 }, crew: 'Boat woman', text: 'The boats come in from the creeks before the sun is high.' },
    isaac_boro:  { spot: 'stage', dow: 5, from: 15, to: 19, name: 'Saturday ogene evening', icon: '🔔', fee: 1000, fx: { fun: 20, social: 14, stress: -10 }, crew: 'Ogene band', text: 'Ogene bells and masquerade dancers under the old trees.' }
  };
  // Lagoon Boat Cruise: board at the Ikoyi jetty, then move between spots on deck (a shared scene).
  var CRUISE = {
    place: 'lagoon_cruise', district: 'ikoyi', fare: 8000, decFare: 20000, mins: 120, fx: { fun: 30, social: 20, stress: -12 },
    spots: {
      helm: { name: "Captain's helm", icon: '☸️', cost: 0, fx: { fun: 10 }, text: 'The captain lets you hold the wheel for a minute.' },
      sun: { name: 'Sun deck', icon: '☀️', cost: 0, fx: { stress: -8, energy: 5 }, text: 'You stretch out on a lounger in the breeze.' },
      bar: { name: 'Deck bar', icon: '🍹', cost: 2500, fx: { hunger: 15, fun: 8 }, text: 'Chapman with plenty of ice.' },
      party: { name: 'Party deck', icon: '🪩', cost: 0, fx: { fun: 18, social: 12, energy: -10 }, text: 'Afrobeats on the speakers, everyone dancing.' },
      rail: { name: 'The rail', icon: '🌊', cost: 0, fx: { stress: -5, fun: 5 }, text: 'The skyline slides past over the water.' }
    },
    sights: ['A superyacht just sailed past', 'Fishermen wave from a canoe', 'The Third Mainland Bridge glows in the distance', 'A jet ski races the boat', 'Banana Island mansions line the shore']
  };
  // A Lagos white wedding: plan it (book a Saturday at least four weeks out, pay 30%), then hold it on the day.
  var WHITE_WEDDING = {
    leadDays: 28, deposit: 0.3,
    venues: {
      yaba_hall: { name: 'Community hall, Yaba', district: 'yaba', cost: 1200000, guests: 200 },
      ikeja_centre: { name: 'Events centre, Ikeja', district: 'ikeja', cost: 3500000, guests: 400 },
      lekki_marquee: { name: 'Lagoon marquee, Lekki', district: 'lekki', cost: 8000000, guests: 500 },
      vi_ballroom: { name: 'Hotel ballroom, Victoria Island', district: 'vi', cost: 18000000, guests: 800 },
      eko_hall: { name: 'Grand hall, Eko Atlantic', district: 'vi', cost: 40000000, guests: 1500 }
    },
    planners: { none: { name: 'Plan it yourselves', cost: 0, q: 0, stress: 25 }, standard: { name: 'Wedding planner', cost: 800000, q: 1, stress: 8 }, premium: { name: 'Celebrity-grade planner', cost: 3000000, q: 2, stress: 0 } },
    asoebi: { none: { name: 'No aso-ebi', cost: 0, q: 0 }, family: { name: 'Aso-ebi for both families', cost: 400000, q: 1 }, full: { name: 'Aso-ebi for family and friends', cost: 1500000, q: 2 } },
    // Vendors are priced per guest: catering (jollof, small chops, cake), photo and video, DJ or band, MC, makeup and gele.
    vendors: { basic: { name: 'Basic vendors', perGuest: 6000, q: 0 }, classic: { name: 'Classic vendors', perGuest: 12000, q: 1 }, luxury: { name: 'Luxury vendors', perGuest: 25000, q: 2 } },
    themes: {
      gold_white: { name: 'Gold and white', a: '#d4af37', b: '#ffffff' }, blush: { name: 'Blush and champagne', a: '#f4c2c2', b: '#f7e7ce' },
      emerald: { name: 'Emerald and gold', a: '#1f6f4a', b: '#d4af37' }, royal: { name: 'Royal blue and silver', a: '#1f3a8a', b: '#c0c6cc' },
      burgundy: { name: 'Burgundy and gold', a: '#7a1f2b', b: '#d4af37' }, lilac: { name: 'Lilac and silver', a: '#b49ad8', b: '#dfe3e8' }
    },
    decor: { simple: { name: 'Simple', cost: 600000, q: 0, text: 'Chair covers, table flowers and a ribbon entrance.' }, elegant: { name: 'Elegant', cost: 2500000, q: 1, text: 'Ceiling drapes with fairy lights, a flower-wall stage and tall centrepieces.' }, grand: { name: 'Grand', cost: 8000000, q: 2, text: 'Crystal chandeliers, a mirrored aisle, a floral arch entrance and a raised stage.' } },
    extras: { arch: { name: 'Floral entrance arch', cost: 400000 }, sparks: { name: 'Cold sparks for the first dance', cost: 300000 }, booth: { name: 'Photo booth', cost: 250000 }, drone: { name: 'Drone video', cost: 350000 }, band: { name: 'Live highlife band', cost: 900000 }, fireworks: { name: 'Fireworks at the send-off', cost: 600000 } },
    afterparty: { none: { name: 'No after-party', cost: 0, fun: 0 }, lounge: { name: 'Lounge after-party', cost: 1000000, fun: 15 }, beach: { name: 'Beach after-party', cost: 2500000, fun: 25 }, yacht: { name: 'Yacht after-party', cost: 6000000, fun: 35 } }
  };
  // New-player setup: pick exactly two traits (a small head start), and a first home your origin can afford.
  var TRAITS = {
    streetwise: { name: 'Street-smart', icon: '🧠', text: 'You know which bus stop has wahala and which one has deals.', xp: { hustle: 12 } },
    techie: { name: 'Tech-head', icon: '💻', text: 'You fix everyone\'s phone and you can code a little.', xp: { tech: 12 } },
    smooth: { name: 'Smooth talker', icon: '😎', text: 'You can talk your way into most rooms and out of most trouble.', xp: { charisma: 12 } },
    chef: { name: 'Kitchen magic', icon: '🍲', text: 'Your jollof has settled family arguments.', xp: { cooking: 12 } },
    performer: { name: 'Born performer', icon: '🎤', text: 'Music, skits, the dance floor: you light it up.', xp: { music: 12 } },
    gymrat: { name: 'Gym rat', icon: '💪', text: 'Up before the sun for a run on the bridge.', xp: { fitness: 12 } },
    maker: { name: 'Good with hands', icon: '🛠️', text: 'Tailoring, carpentry, wiring: you can make it or mend it.', xp: { craft: 12 } },
    cool: { name: 'Cool head', icon: '🧊', text: 'Go-slow, NEPA, landlord: nothing shakes you.', needs: { stress: -15 } },
    social: { name: 'Life of the party', icon: '🎉', text: 'You know somebody at every owambe.', needs: { social: 20, fun: 10 } },
    earlybird: { name: 'Early bird', icon: '🌅', text: 'Awake at 5am without an alarm, full of energy.', needs: { energy: 10, hunger: 5 } }
  };
  var START_HOMES = { lapo: ['mushin_room', 'ikorodu_room', 'festac_room'], mid: ['yaba_selfcon', 'suru_selfcon', 'yaba_share', 'ikeja_selfcon'], nepo: ['lekki_studio', 'yaba_2bed', 'ajah_2bed'] };
  var ORIGINS = {
    lapo: { name: 'LAPO Baby', cash: 8000, home: 'mushin_room', text: 'You start with ₦8,000 and a room in Mushin. A microfinance officer has your number.' },
    mid:  { name: 'Ajepako', cash: 60000, home: 'yaba_selfcon', text: 'Your parents scraped together ₦60,000 and paid for a self-con in Yaba.' },
    // Not in the birth lottery: chosen when a life with children ends (the next generation).
    heir: { name: 'Heir', cash: 0, home: 'yaba_selfcon', text: 'The family meeting is over and the estate is shared. Your parent\'s story is done; yours starts now.' },
    nepo: { name: 'Nepo Baby', cash: 800000, home: 'lekki_studio', allowance: 25000, allowanceWeeks: 8, text: 'Daddy paid for a Lekki studio, put ₦800,000 in your account and sends ₦25,000 a week. For now.' }
  };

  // Pulse Fitness & Pilates (fictional): seven branches around Lagos. Same rooms everywhere, but the Island
  // costs more and Eko Atlantic the most. Their acts come in with rules 18 (BRANCH_ACTS, keyed by place).
  var PULSE_BRANCHES = [
    ['pulse_ikoyi', 'ikoyi', 20.7, 20.3, 1.8, 'Ikoyi'], ['pulse_vi', 'vi', 19.9, 25.9, 1.8, 'Victoria Island'], ['pulse_eko', 'vi', 17.7, 29.4, 2.5, 'Eko Atlantic'],
    ['pulse_lekki', 'lekki', 27.5, 23.2, 1.8, 'Lekki'], ['pulse_ikeja', 'ikeja', 10.8, 4.7, 1, 'Ikeja'], ['pulse_yaba', 'yaba', 15.7, 14.4, 1, 'Yaba'], ['pulse_surulere', 'surulere', 10.7, 18.8, 1, 'Surulere']
  ];
  var BRANCH_ACTS = {};
  function pulseActs(b) {
    var id = b[0], f = b[4], c = function (v) { return Math.round(v * f / 100) * 100; };
    return [
      { id: id + '_weights', label: 'Weights session', mins: 60, cost: c(2500), fx: { energy: -12, stress: -6, hygiene: -10 }, xp: { fitness: 1 }, when: { from: 5, to: 23 } },
      { id: id + '_tread', label: 'Run on the treadmills', mins: 45, cost: c(2000), fx: { energy: -10, stress: -5, hygiene: -8 }, xp: { fitness: 1 }, when: { from: 5, to: 23 } },
      { id: id + '_pilates', label: 'Pilates class', mins: 60, cost: c(4000), fx: { energy: -8, stress: -10, hygiene: -6 }, xp: { fitness: 1 }, when: { from: 7, to: 20 } },
      { id: id + '_yoga', label: 'Yoga studio session', mins: 60, cost: c(3500), fx: { stress: -12, energy: -4 }, when: { from: 6, to: 21 } },
      { id: id + '_smoothie', label: 'Smoothie bar', mins: 15, cost: c(2500), fx: { hunger: 12, fun: 2 }, when: { from: 6, to: 22 } },
      { id: id + '_shower', label: 'Showers and changing room', mins: 15, cost: c(500), fx: { hygiene: 28 }, when: { from: 5, to: 23 } },
      { id: id + '_desk', label: 'Front-desk shift (sign members in)', mins: 240, earn: 2600, fx: { energy: -10 }, xp: { charisma: 1 }, gig: true, fest: true, when: { from: 6, to: 20 } }
    ];
  }
  var PULSE_PLACES = PULSE_BRANCHES.map(function (b) { BRANCH_ACTS[b[0]] = pulseActs(b); return { id: b[0], icon: '🧘', name: 'Pulse Fitness & Pilates, ' + b[5], type: 'outdoors', glyph: 'dumbbell', district: b[1], x: b[2], y: b[3], acts: [], chain: 'pulse', tier: b[4], text: 'One of seven Pulse branches: weights, treadmills, a Pilates and yoga studio, a smoothie bar and showers.' + (b[4] > 2 ? ' Eko Atlantic prices.' : b[4] > 1 ? ' Island prices.' : ' Mainland prices.') }; });

  // Letter hunts: a fictional headliner's new single, its letters hidden around Lagos. Solve a riddle, go there,
  // catch the glowing letter in the walk-in. One hunt a real week, in turn. A badge only: no money, no game state.
  PULSE_PLACES.forEach(function (p) { p.nogem = true; PLACES.push(p); });

  // Rules 19: police divisions, polling units and hospital rooms (CIVIC_ACTS, keyed by place, like BRANCH_ACTS).
  // Cases, the cell and the hospital doctor are engine specials; the live boards and the ballot itself are drawing and
  // the shared election (gov.js), so nothing here pays well: the only gigs are small, once a day.
  var CIVIC_ACTS = {};
  var POLICE_DIVS = [['police_ikeja', 'ikeja', 9.3, 4.9, 'Ikeja'], ['police_oshodi', 'oshodi', 10.9, 9.6, 'Oshodi'], ['police_surulere', 'surulere', 9.4, 18.5, 'Surulere'],
    ['police_yaba', 'yaba', 14.4, 15.6, 'Yaba'], ['police_island', 'island', 16.7, 21.4, 'Lagos Island'], ['police_lekki', 'lekki', 27.0, 24.6, 'Lekki'],
    ['police_garki', 'abj_garki', 16.6, 15.4, 'Garki'], ['police_phgra', 'ph_gra', 12.6, 11.4, 'GRA Port Harcourt']];
  var CIVIC_PLACES = POLICE_DIVS.map(function (b) {
    var id = b[0];
    CIVIC_ACTS[id] = [
      { id: id + '_report', label: 'Report a case at the front desk', mins: 45, fx: { stress: 4 }, special: 'report', fest: true, when: { from: 0, to: 24 } },
      { id: id + '_check', label: 'Ask the IPO about your case', mins: 30, fx: { stress: 3 }, special: 'casecheck', when: { from: 8, to: 18 } },
      { id: id + '_mobilise', label: 'Give the IPO "mobilisation" (fuel for the investigation)', mins: 15, cost: 3000, special: 'mobilise', when: { from: 8, to: 18 } },
      { id: id + '_bench', label: 'Sit on the waiting bench and watch', mins: 30, fx: { stress: 2, fun: 2 } },
      { id: id + '_food', label: 'Bring food to someone in the cell', mins: 30, cost: 1500, fx: { social: 8, stress: -2 }, when: { from: 9, to: 18 } },
      { id: id + '_watch', label: 'Neighbourhood watch patrol (night)', mins: 180, earn: 2000, fx: { energy: -12, stress: 4 }, xp: { fitness: 1 }, gig: true, fest: true, when: { from: 19, to: 24 } }
    ];
    return { id: id, icon: '🚓', name: b[4] + ' Police Division', type: 'services', glyph: 'badge', district: b[1], x: b[2], y: b[3], acts: [], civic: 'police',
      text: 'Front desk, the IPOs\' office, the cell and a long bench. Report a case, follow it up, or wait for someone. Bail is free, says the sign.' };
  });
  var POLL_AT = { ikeja: [10.7, 3.4], ikorodu: [28.8, 3.6], oshodi: [9.4, 9.4], mushin: [11.8, 12.4], festac: [2.9, 17.4], surulere: [10.6, 17.2],
    yaba: [15.9, 15.9], island: [15.2, 21.6], ikoyi: [20.0, 21.8], vi: [18.4, 25.5], lekki: [28.9, 24.8], ajah: [38.6, 24.4] };
  Object.keys(POLL_AT).forEach(function (d, i) {
    var id = 'poll_' + d;
    CIVIC_ACTS[id] = [
      { id: id + '_accredit', label: 'Queue and get accredited', mins: 45, fx: { stress: 4, social: 3 }, special: 'accredit', fest: true },
      { id: id + '_board', label: 'Watch the count at the results board', mins: 30, fx: { fun: 4, social: 3 } },
      { id: id + '_educate', label: 'Help at the voter education stand', mins: 60, fx: { social: 6, energy: -4 }, xp: { charisma: 1 } },
      { id: id + '_water', label: 'Sell pure water to the queue', mins: 120, earn: 1800, fx: { energy: -8, hygiene: -4 }, gig: true, fest: true, when: { from: 8, to: 18 } }
    ];
    CIVIC_PLACES.push({ id: id, icon: '🗳️', name: 'Polling Unit ' + String(i * 7 + 3).padStart(3, '0') + ', ' + DISTRICTS[d].name, type: 'services', glyph: 'ballot', district: d, x: POLL_AT[d][0], y: POLL_AT[d][1], acts: [], civic: 'polling',
      text: 'Voting cubicles, the accreditation desk, the ballot box and the live results board. On election weekend this is where your district votes.' });
  });
  // Every hospital gets the same rooms: reception, the doctor, the pharmacy, a ward bed, the waiting area and a zobo kiosk.
  PLACES.filter(function (p) { return p.glyph === 'cross'; }).forEach(function (p) {
    var id = 'hosp_' + p.id;
    CIVIC_ACTS[p.id] = [
      { id: id + '_card', label: 'Open a hospital card at reception', mins: 30, cost: 1000, fx: { stress: 3 } },
      { id: id + '_doctor', label: 'See the doctor', mins: 90, cost: 6000, fx: { stress: -4 }, special: 'doctor', when: { from: 8, to: 20 } },
      { id: id + '_ward', label: 'Rest on a ward bed (drip and fan)', mins: 180, cost: 4000, fx: { energy: 22, stress: -8, hygiene: -4 } },
      { id: id + '_wait', label: 'Wait in the waiting area', mins: 45, fx: { stress: 5, energy: -2 } },
      { id: id + '_zobo', label: 'Zobo and chin-chin at the kiosk', mins: 15, cost: 600, fx: { hunger: 8, fun: 2 } },
      { id: id + '_porter', label: 'Porter shift (push trolleys, run errands)', mins: 240, earn: 2400, fx: { energy: -12, hygiene: -6 }, xp: { fitness: 1 }, gig: true, fest: true, when: { from: 7, to: 19 } }
    ];
  });
  // Rules 19: the High Court, a city library, a grand hotel, a casino (the house always wins over time) and an office tower.
  CIVIC_PLACES.push(
    { id: 'high_court', icon: '⚖️', name: 'Lagos High Court, Island', type: 'services', glyph: 'gavel', district: 'island', x: 16.3, y: 22.3, acts: [], civic: 'court', text: 'The judge\'s bench, the dock, the witness box, lawyers in wigs and a public gallery. Court is in session from 9.' },
    { id: 'city_library', icon: '📚', name: 'Lagos City Library, Yaba', type: 'learn', glyph: 'book', district: 'yaba', x: 15.0, y: 15.3, acts: [], civic: 'library', text: 'Rows of shelves, reading tables, a computer room and a strict librarian.' },
    { id: 'grand_hotel', icon: '🏨', name: 'Marina Grand Hotel, Victoria Island', type: 'nightlife', glyph: 'hotel', district: 'vi', x: 19.5, y: 25.4, acts: [], civic: 'hotel', text: 'A marble lobby, a chandelier, the pool atrium, the spa and the buffet. Rooms by the night.' },
    { id: 'lagoon_casino', icon: '🎰', name: 'Lagoon Casino, Victoria Island', type: 'nightlife', glyph: 'dice', district: 'vi', x: 18.5, y: 24.9, acts: [], civic: 'casino', text: 'Slots, roulette and blackjack under a gold dome. 18 and over. The house always wins in the end.' },
    { id: 'office_tower', icon: '🏢', name: 'Marina Office Towers, Island', type: 'services', glyph: 'tower', district: 'island', x: 15.5, y: 23.4, acts: [], civic: 'office', text: 'Glass towers on the Marina: a co-working floor, meeting rooms and the building\'s canteen.' }
  );
  CIVIC_ACTS.high_court = [
    { id: 'court_gallery', label: 'Watch a case from the public gallery', mins: 90, fx: { fun: 6, stress: 2 }, when: { days: [0, 1, 2, 3, 4], from: 9, to: 16 } },
    { id: 'court_affidavit', label: 'Swear an affidavit at the registry', mins: 45, cost: 1500, fx: { stress: 3 }, when: { days: [0, 1, 2, 3, 4], from: 8, to: 15 } },
    { id: 'court_lawyer', label: 'Pay a lawyer for an hour of advice', mins: 60, cost: 25000, fx: { stress: -8 }, xp: { charisma: 1 }, when: { days: [0, 1, 2, 3, 4], from: 9, to: 17 } },
    { id: 'court_bench', label: 'Sit on the corridor bench and wait for your matter', mins: 120, fx: { stress: 6, energy: -4 }, when: { days: [0, 1, 2, 3, 4], from: 8, to: 16 } },
    { id: 'court_errands', label: 'Run errands for the court clerks', mins: 180, earn: 1800, fx: { energy: -8 }, gig: true, fest: true, when: { days: [0, 1, 2, 3, 4], from: 8, to: 16 } }
  ];
  CIVIC_ACTS.city_library = [
    { id: 'lib_read', label: 'Read at a quiet table', mins: 90, fx: { stress: -5, energy: -4 }, xp: { tech: 1 }, when: { from: 8, to: 20 } },
    { id: 'lib_borrow', label: 'Borrow two books (library card)', mins: 15, cost: 300, fx: { fun: 3 }, when: { from: 8, to: 20 } },
    { id: 'lib_pc', label: 'An hour in the computer room', mins: 60, cost: 500, fx: { energy: -3 }, xp: { tech: 1 }, when: { from: 8, to: 20 } },
    { id: 'lib_exam', label: 'Study for an exam in the reading room', mins: 180, fx: { energy: -12, stress: 4 }, xp: { tech: 1 }, when: { from: 8, to: 20 } },
    { id: 'lib_story', label: 'Read stories to the children (Saturday)', mins: 120, earn: 1500, fx: { social: 8, energy: -5 }, xp: { charisma: 1 }, gig: true, fest: true, when: { days: [5], from: 10, to: 14 } }
  ];
  CIVIC_ACTS.grand_hotel = [
    { id: 'hotel_coffee', label: 'Coffee and croissant in the lobby', mins: 30, cost: 6000, fx: { hunger: 10, fun: 4 }, when: { from: 6, to: 23 } },
    { id: 'hotel_buffet', label: 'The Sunday buffet', mins: 90, cost: 28000, fx: { hunger: 60, fun: 15, social: 8 }, when: { days: [6], from: 11, to: 16 } },
    { id: 'hotel_pool', label: 'Pool day pass in the atrium', mins: 180, cost: 15000, fx: { fun: 18, stress: -14, hygiene: 6 }, when: { from: 8, to: 19 } },
    { id: 'hotel_spa', label: 'Massage at the spa', mins: 90, cost: 45000, fx: { stress: -30, energy: 10 }, when: { from: 9, to: 21 } },
    { id: 'hotel_night', label: 'Book a room for the night (sleep in luxury)', mins: 480, cost: 130000, fx: { energy: 70, hygiene: 40, stress: -25 }, when: { from: 20, to: 24 } },
    { id: 'hotel_bell', label: 'Bellhop shift (bags, doors, smiles)', mins: 240, earn: 2600, fx: { energy: -12 }, xp: { charisma: 1 }, gig: true, fest: true, when: { from: 7, to: 22 } }
  ];
  CIVIC_ACTS.lagoon_casino = [
    { id: 'casino_slots', label: 'Slot machines (₦5,000 a pull)', mins: 15, cost: 5000, fx: { fun: 6, stress: 2 }, special: 'slots', fest: true, when: { from: 12, to: 24 } },
    { id: 'casino_roulette', label: 'Roulette: ₦20,000 on red', mins: 15, cost: 20000, fx: { fun: 8, stress: 4 }, special: 'roulette', fest: true, when: { from: 18, to: 24 } },
    { id: 'casino_blackjack', label: 'Blackjack: a ₦20,000 hand', mins: 15, cost: 20000, fx: { fun: 8, stress: 4 }, special: 'blackjack', fest: true, when: { from: 18, to: 24 } },
    { id: 'casino_highroller', label: 'The high-roller table: ₦2m on one spin', mins: 30, cost: 2000000, fx: { fun: 20, stress: 15 }, special: 'highroller', fest: true, when: { from: 21, to: 24 } },
    { id: 'casino_bar', label: 'Cocktail at the casino bar', mins: 15, cost: 8000, fx: { fun: 6 }, when: { from: 12, to: 24 } }
  ];
  CIVIC_ACTS.office_tower = [
    { id: 'office_cowork', label: 'Co-working day pass', mins: 240, cost: 8000, fx: { energy: -10, stress: 3 }, xp: { tech: 1 }, when: { days: [0, 1, 2, 3, 4], from: 8, to: 18 } },
    { id: 'office_network', label: 'After-work networking drinks', mins: 120, cost: 6000, fx: { social: 15, fun: 6 }, xp: { charisma: 1 }, when: { days: [3], from: 17, to: 21 } },
    { id: 'office_canteen', label: 'Lunch at the building canteen', mins: 30, cost: 2500, fx: { hunger: 30 }, when: { from: 11, to: 15 } },
    { id: 'office_view', label: 'Take the lift to the sky lobby view', mins: 30, fx: { fun: 6, stress: -3 }, when: { from: 8, to: 19 } },
    { id: 'office_clean', label: 'Evening cleaning shift', mins: 240, earn: 2400, fx: { energy: -14, hygiene: -8 }, gig: true, fest: true, when: { from: 17, to: 23 } }
  ];
  // Rules 19 in Abuja and Port Harcourt: a hospital, a hotel, a casino and a court in each city, with the same rooms and
  // acts as Lagos under their own ids (the Lagos tables are copied, never changed). Polling units stay in Lagos, where the election is.
  function cloneActs(list, from, to) { return list.map(function (a) { var b = JSON.parse(JSON.stringify(a)); b.id = to + a.id.slice(from.length); return b; }); }
  [
    ['abj_hospital', '🏥', 'Abuja City Hospital, Garki', 'services', 'cross', 'abj_garki', 15.4, 15.6, 'hospital', 'Reception, the nurses\' station, the doctor, a ward and the pharmacy.'],
    ['ph_hospital', '🏥', 'Garden City Hospital, Old GRA', 'services', 'cross', 'ph_oldgra', 14.6, 15.4, 'hospital', 'Reception, the nurses\' station, the doctor, a ward and the pharmacy.'],
    ['abj_hotel', '🏨', 'Maitama Grand Hotel', 'nightlife', 'hotel', 'abj_maitama', 14.6, 7.4, 'hotel', 'Marble lobby, chandelier, a pool atrium, the spa and the buffet.'],
    ['ph_hotel', '🏨', 'Garden City Grand Hotel, GRA', 'nightlife', 'hotel', 'ph_gra', 11.4, 11.6, 'hotel', 'Marble lobby, chandelier, a pool atrium, the spa and the buffet.'],
    ['abj_casino', '🎰', 'Wuse Casino', 'nightlife', 'dice', 'abj_wuse', 11.6, 11.4, 'casino', 'Slots, roulette and blackjack. 18 and over. The house always wins in the end.'],
    ['ph_casino', '🎰', 'Trans-Amadi Casino', 'nightlife', 'dice', 'ph_transamadi', 21.6, 11.4, 'casino', 'Slots, roulette and blackjack. 18 and over. The house always wins in the end.'],
    ['abj_court', '⚖️', 'FCT High Court, Garki', 'services', 'gavel', 'abj_garki', 16.4, 14.6, 'court', 'The bench, the dock, the witness box and a public gallery.'],
    ['ph_court', '⚖️', 'Rivers High Court, Old GRA', 'services', 'gavel', 'ph_oldgra', 13.6, 14.6, 'court', 'The bench, the dock, the witness box and a public gallery.'],
    ['abj_library', '📚', 'Wuse Public Library', 'learn', 'book', 'abj_wuse', 12.8, 11.0, 'library', 'Rows of shelves, reading tables, a computer room and a strict librarian.'],
    ['ph_library', '📚', 'Garden City Library, GRA', 'learn', 'book', 'ph_gra', 12.2, 10.6, 'library', 'Rows of shelves, reading tables, a computer room and a strict librarian.'],
    ['abj_office', '🏢', 'Garki Office Towers', 'services', 'tower', 'abj_garki', 14.2, 16.8, 'office', 'Glass towers by the business district: a co-working floor, meeting rooms and the canteen.'],
    ['ph_office', '🏢', 'Trans-Amadi Business Tower', 'services', 'tower', 'ph_transamadi', 22.6, 12.6, 'office', 'Glass towers on the industrial layout: a co-working floor, meeting rooms and the canteen.']
  ].forEach(function (q) {
    var pfx = q[0].split('_')[0];
    CIVIC_PLACES.push({ id: q[0], icon: q[1], name: q[2], type: q[3], glyph: q[4], district: q[5], x: q[6], y: q[7], acts: [], civic: q[8], text: q[9] });
    CIVIC_ACTS[q[0]] = q[8] === 'hospital' ? cloneActs(CIVIC_ACTS.gen_hosp, 'hosp_gen_hosp_', 'hosp_' + q[0] + '_')
      : q[8] === 'hotel' ? cloneActs(CIVIC_ACTS.grand_hotel, 'hotel_', 'hotel_' + pfx + '_')
      : q[8] === 'casino' ? cloneActs(CIVIC_ACTS.lagoon_casino, 'casino_', 'casino_' + pfx + '_')
      : q[8] === 'library' ? cloneActs(CIVIC_ACTS.city_library, 'lib_', 'lib_' + pfx + '_')
      : q[8] === 'office' ? cloneActs(CIVIC_ACTS.office_tower, 'office_', 'office_' + pfx + '_')
      : cloneActs(CIVIC_ACTS.high_court, 'court_', 'court_' + pfx + '_');
  });
  // Wallet top-ups sold by the self-hosted shop (rules 19): the naira here is what a verified purchase credits.
  // Taking one marks the life Boosted: it can never go on the Hall of Fame or the weekly board.
  var TOPUP_PACKS = { topup_jollof: { name: 'Jollof pack', naira: 50000 }, topup_owambe: { name: 'Owambe pack', naira: 300000 }, topup_bigboy: { name: 'Big boy pack', naira: 700000 }, topup_odogwu: { name: 'Odogwu pack', naira: 1600000 } };
  // Rules 19: more of the capital, each with an inside and its own acts. Public landmarks keep their names; the businesses are made up.
  function act(id, label, mins, cost, earn, fx, xp, when) { var a = { id: id, label: label, mins: mins, fx: fx }; if (cost) a.cost = cost; if (earn) { a.earn = earn; a.gig = true; a.fest = true; } if (xp) a.xp = xp; if (when) a.when = when; return a; }
  var WK = [0, 1, 2, 3, 4], CAMPUS_CLONES = [];
  [
    ['abj_jabi_park', '🚌', 'Jabi Motor Park', 'transport', 'bus', 'abj_jabi', 6.2, 9.0, null, 'Ticket office, the loading shed, a tea and bread stall, the drivers\' bench, and coaches to Lagos, PH and the north.', [
      act('jpark_tea', 'Tea and bread at the mai shayi stall', 15, 700, 0, { hunger: 18, fun: 2 }, null, { from: 5, to: 23 }),
      act('jpark_bench', 'Gist with the drivers on the bench', 30, 0, 0, { social: 8, fun: 4 }, null, { from: 6, to: 21 }),
      act('jpark_load', 'Load bags onto the coaches (park boy shift)', 180, 0, 2000, { energy: -14, hygiene: -8 }, { fitness: 1 }, { from: 5, to: 20 }),
      act('jpark_tout', 'Call passengers for a driver', 120, 0, 1400, { energy: -8, social: 4 }, { charisma: 1 }, { from: 6, to: 20 }),
      act('jpark_board', 'Read the timetable board and price the routes', 15, 0, 0, { stress: -1 }, null, null)
    ]],
    ['abj_garki_mkt', '🧺', 'Garki Market', 'food', 'basket', 'abj_garki', 18.8, 15.8, null, 'Fabric lanes, foodstuff, phone stalls and the meat section, all under zinc.', [
      act('gmkt_food', 'Buy the week\'s foodstuff', 45, 6000, 0, { hunger: 30 }, null, { from: 7, to: 18 }),
      act('gmkt_fabric', 'Bargain for ankara in the fabric lane', 60, 9000, 0, { fun: 10, social: 4 }, { charisma: 1 }, { from: 8, to: 18 }),
      act('gmkt_suya', 'Suya and zobo by the gate', 15, 1500, 0, { hunger: 18, fun: 4 }, null, { from: 16, to: 22 }),
      act('gmkt_porter', 'Carry loads for traders (truck pusher)', 180, 0, 1800, { energy: -16, hygiene: -8 }, { fitness: 1 }, { from: 7, to: 17 })
    ]],
    ['abj_assembly', '🏛️', 'National Assembly', 'outdoors', 'dome', 'abj_asokoro', 19.4, 11.4, null, 'The green dome, the two chambers and the public gallery. Bring ID.', [
      act('nass_tour', 'Join the guided tour of the chambers', 90, 0, 0, { fun: 8 }, { charisma: 1 }, { days: WK, from: 10, to: 15 }),
      act('nass_plenary', 'Watch a plenary from the public gallery', 120, 0, 0, { fun: 6, stress: 3 }, null, { days: [1, 2, 3], from: 10, to: 14 }),
      act('nass_photo', 'Photo by the dome', 15, 0, 0, { fun: 5 }, null, { from: 8, to: 18 }),
      act('nass_lobby', 'Wait in the lobby to see your rep', 120, 0, 0, { stress: 8, social: 4 }, null, { days: WK, from: 9, to: 16 })
    ]],
    ['abj_secretariat', '🏢', 'Federal Secretariat', 'services', 'tower', 'abj_garki', 14.6, 13.6, null, 'The ministries\' blocks: long corridors, file rooms and the canteen.', [
      act('fsec_file', 'Chase your file from desk to desk', 120, 0, 0, { stress: 12, energy: -6 }, null, { days: WK, from: 8, to: 16 }),
      act('fsec_canteen', 'Rice and moi moi at the staff canteen', 30, 1500, 0, { hunger: 28 }, null, { days: WK, from: 11, to: 15 }),
      act('fsec_messenger', 'Messenger shift (files and tea)', 240, 0, 2200, { energy: -10 }, null, { days: WK, from: 8, to: 16 }),
      act('fsec_typing', 'Type letters at the business centre', 120, 0, 1600, { energy: -6 }, { tech: 1 }, { days: WK, from: 8, to: 17 })
    ]],
    ['abj_conference', '🎤', 'International Conference Centre', 'services', 'tower', 'abj_garki', 13.2, 16.0, 'conference', 'The big hall: tiered seats, the stage and podium, flags and the screens.', [
      act('icc_summit', 'Sit in on a summit session', 120, 0, 0, { fun: 6, stress: 2 }, { charisma: 1 }, { days: WK, from: 9, to: 17 }),
      act('icc_expo', 'Walk the trade expo stands', 60, 2000, 0, { fun: 8, social: 6 }, null, { days: [3, 4, 5], from: 10, to: 18 }),
      act('icc_usher', 'Usher at the conference', 240, 0, 2600, { energy: -12, social: 6 }, { charisma: 1 }, { days: WK, from: 8, to: 18 }),
      act('icc_network', 'Network at the coffee break', 30, 0, 0, { social: 10 }, { charisma: 1 }, { days: WK, from: 10, to: 16 })
    ]],
    ['abj_zoo', '🦒', 'Children\'s Park and Zoo, Asokoro', 'outdoors', 'tree', 'abj_asokoro', 22.6, 11.0, null, 'Animal pens under the trees, a play area and picnic lawns.', [
      act('zoo_visit', 'See the animals', 60, 1000, 0, { fun: 12, stress: -6 }, null, { from: 9, to: 18 }),
      act('zoo_feed', 'Feeding time at the monkey pen', 30, 500, 0, { fun: 8 }, null, { from: 10, to: 16 }),
      act('zoo_picnic', 'Picnic on the lawn', 60, 3000, 0, { hunger: 24, social: 6, fun: 6 }, null, { from: 10, to: 17 }),
      act('zoo_keeper', 'Help the keepers clean the pens', 180, 0, 1600, { energy: -12, hygiene: -12 }, null, { from: 7, to: 15 })
    ]],
    ['abj_uni', '🎓', 'University of Abuja', 'learn', 'cap', 'abj_airport', 6.4, 20.6, null, 'The Senate building, lecture theatre, library, a buka and the halls.', 'uniabj_'],
    ['abj_chu', '🎓', 'Capital Heights University, Kubwa', 'learn', 'cap', 'abj_kubwa', 6.4, 4.2, null, 'A private campus: neat lawns, a glass library and a strict dress code.', 'chu_'],
    ['abj_funpark', '🎡', 'Capital Fun Park, Jabi', 'outdoors', 'tree', 'abj_jabi', 8.4, 11.6, 'funpark', 'A Ferris wheel, a carousel, bumper cars and candy floss.', [
      act('fun_wheel', 'Ride the Ferris wheel', 15, 2000, 0, { fun: 14 }, null, { from: 11, to: 22 }),
      act('fun_bumper', 'Bumper cars', 15, 1500, 0, { fun: 12, stress: -4 }, null, { from: 11, to: 22 }),
      act('fun_carousel', 'Carousel with the kids', 15, 1000, 0, { fun: 8, social: 6 }, null, { from: 11, to: 20 }),
      act('fun_candy', 'Candy floss and popcorn', 15, 1200, 0, { hunger: 10, fun: 4 }, null, { from: 11, to: 22 }),
      act('fun_ops', 'Run a ride for the evening', 240, 0, 2200, { energy: -10 }, null, { from: 15, to: 22 })
    ]],
    ['abj_sky_lounge', '🍸', 'Skyline Rooftop Lounge, Wuse 2', 'nightlife', 'glass', 'abj_wuse', 9.0, 11.2, null, 'A rooftop over Wuse 2: city lights, a DJ, mocktails and cocktails.', [
      act('sky_sunset', 'Sundowner on the roof', 60, 9000, 0, { fun: 14, social: 8, stress: -6 }, null, { from: 17, to: 20 }),
      act('sky_dj', 'Friday DJ night', 180, 15000, 0, { fun: 30, social: 18, energy: -12 }, null, { days: [4, 5], from: 21, to: 24 }),
      act('sky_mock', 'Mocktail at the bar', 15, 4000, 0, { fun: 5 }, null, { from: 16, to: 24 }),
      act('sky_wait', 'Waiter shift on the roof', 240, 0, 2600, { energy: -12 }, null, { from: 17, to: 24 })
    ]],
    ['abj_motors', '🚗', 'Capital Motors, Wuse', 'services', 'car', 'abj_wuse', 10.4, 13.0, null, 'A glass showroom of saloons and SUVs, and a finance desk.', [
      act('cmot_browse', 'Browse the showroom', 30, 0, 0, { fun: 5 }, null, { from: 9, to: 18 }),
      act('cmot_test', 'Test drive a new SUV', 45, 0, 0, { fun: 14 }, null, { days: WK, from: 10, to: 17 }),
      act('cmot_wash', 'Wash and polish the showroom cars', 180, 0, 1800, { energy: -10, hygiene: -6 }, null, { from: 8, to: 17 })
    ]],
    ['abj_idu_rail', '🚆', 'Idu Rail Station', 'transport', 'bus', 'abj_jabi', 4.4, 9.6, 'rail', 'The light rail terminus: platforms under a long canopy, the ticket gate and trains to the airport line.', [
      act('idu_card', 'Buy a rail card and top it up', 15, 1000, 0, { stress: -2 }, null, { from: 6, to: 21 }),
      act('idu_ride', 'Ride the train out to the airport and back', 90, 1500, 0, { fun: 12, stress: -6 }, null, { from: 6, to: 20 }),
      act('idu_watch', 'Watch the trains come in', 15, 0, 0, { fun: 5 }, null, { from: 6, to: 21 }),
      act('idu_recharge', 'Sell recharge cards on the concourse', 180, 0, 1600, { energy: -6, social: 4 }, null, { from: 7, to: 20 }),
      act('idu_clean', 'Platform cleaning shift', 240, 0, 2200, { energy: -12, hygiene: -6 }, null, { from: 5, to: 21 })
    ]],
    ['abj_polo', '🐎', 'Capital Polo Grounds, Maitama', 'outdoors', 'tree', 'abj_maitama', 16.4, 6.4, 'polo', 'A green polo field, the stand, the members\' pavilion and ponies in the lines.', [
      act('polo_chukka', 'Watch a chukka from the stand', 60, 2000, 0, { fun: 14, social: 6 }, null, { days: [4, 5, 6], from: 15, to: 18 }),
      act('polo_pavilion', 'Mocktail on the pavilion lawn', 30, 6000, 0, { fun: 8, social: 8 }, null, { from: 12, to: 20 }),
      act('polo_lesson', 'Riding lesson on a club pony', 60, 40000, 0, { fun: 16, energy: -10 }, { fitness: 1 }, { from: 7, to: 11 }),
      act('polo_groom', 'Groom and water the ponies', 180, 0, 1800, { energy: -12, hygiene: -10 }, { fitness: 1 }, { from: 6, to: 12 })
    ]],
    // Port Harcourt, the same way.
    ['ph_mile3_park', '🚌', 'Mile 3 Motor Park', 'transport', 'bus', 'ph_dline', 8.2, 12.6, null, 'Ticket office, the loading shed, a tea and bread stall, the drivers\' bench, and coaches to Lagos, Aba and Abuja.', [
      act('m3park_tea', 'Tea and bread at the stall', 15, 700, 0, { hunger: 18, fun: 2 }, null, { from: 5, to: 23 }),
      act('m3park_bench', 'Gist with the drivers on the bench', 30, 0, 0, { social: 8, fun: 4 }, null, { from: 6, to: 21 }),
      act('m3park_load', 'Load bags onto the buses (park boy shift)', 180, 0, 2000, { energy: -14, hygiene: -8 }, { fitness: 1 }, { from: 5, to: 20 }),
      act('m3park_tout', 'Call passengers for a driver', 120, 0, 1400, { energy: -8, social: 4 }, { charisma: 1 }, { from: 6, to: 20 })
    ]],
    ['ph_creek_mkt', '🧺', 'Creek Road Market', 'food', 'basket', 'ph_borokiri', 15.4, 18.0, null, 'Fresh and smoked fish, periwinkle, crayfish and foodstuff by the creek.', [
      act('creek_fish', 'Buy fresh fish and periwinkle', 30, 5000, 0, { hunger: 26 }, null, { from: 6, to: 18 }),
      act('creek_barter', 'Haggle for crayfish and stockfish', 45, 7000, 0, { hunger: 20, fun: 6 }, { charisma: 1 }, { from: 7, to: 18 }),
      act('creek_soup', 'Native soup and starch at a mama put', 30, 2000, 0, { hunger: 34 }, null, { from: 11, to: 20 }),
      act('creek_porter', 'Carry fish baskets from the boats', 180, 0, 1800, { energy: -16, hygiene: -12 }, { fitness: 1 }, { from: 5, to: 15 })
    ]],
    ['ph_assembly', '🏛️', 'Rivers State House of Assembly', 'outdoors', 'dome', 'ph_oldgra', 11.6, 14.4, null, 'The state assembly: the chamber, the public gallery and the lawns.', [
      act('rsha_tour', 'Join the guided tour of the chamber', 60, 0, 0, { fun: 6 }, { charisma: 1 }, { days: WK, from: 10, to: 15 }),
      act('rsha_sitting', 'Watch a sitting from the gallery', 120, 0, 0, { fun: 5, stress: 3 }, null, { days: [1, 2, 3], from: 10, to: 14 }),
      act('rsha_photo', 'Photo by the assembly gate', 15, 0, 0, { fun: 4 }, null, { from: 8, to: 18 })
    ]],
    ['ph_secretariat', '🏢', 'Rivers State Secretariat', 'services', 'tower', 'ph_oldgra', 15.6, 13.2, null, 'The state ministries: long corridors, file rooms and the canteen.', [
      act('rss_file', 'Chase your file from desk to desk', 120, 0, 0, { stress: 12, energy: -6 }, null, { days: WK, from: 8, to: 16 }),
      act('rss_canteen', 'Rice and plantain at the staff canteen', 30, 1500, 0, { hunger: 28 }, null, { days: WK, from: 11, to: 15 }),
      act('rss_messenger', 'Messenger shift (files and tea)', 240, 0, 2200, { energy: -10 }, null, { days: WK, from: 8, to: 16 })
    ]],
    ['ph_conference', '🎤', 'Garden City Conference Hall, GRA', 'services', 'tower', 'ph_gra', 10.4, 11.0, 'conference', 'The big hall: tiered seats, the stage and podium, flags and the screens.', [
      act('gcc_summit', 'Sit in on an oil and gas summit', 120, 0, 0, { fun: 5, stress: 2 }, { charisma: 1 }, { days: WK, from: 9, to: 17 }),
      act('gcc_expo', 'Walk the trade expo stands', 60, 2000, 0, { fun: 8, social: 6 }, null, { days: [3, 4, 5], from: 10, to: 18 }),
      act('gcc_usher', 'Usher at the conference', 240, 0, 2600, { energy: -12, social: 6 }, { charisma: 1 }, { days: WK, from: 8, to: 18 })
    ]],
    ['ph_funpark', '🎡', 'Riverside Fun Park, Rumuokoro', 'outdoors', 'tree', 'ph_rumuokoro', 14.8, 6.2, 'funpark', 'A Ferris wheel, a carousel, bumper cars and candy floss.', [
      act('rfun_wheel', 'Ride the Ferris wheel', 15, 2000, 0, { fun: 14 }, null, { from: 11, to: 22 }),
      act('rfun_bumper', 'Bumper cars', 15, 1500, 0, { fun: 12, stress: -4 }, null, { from: 11, to: 22 }),
      act('rfun_carousel', 'Carousel with the kids', 15, 1000, 0, { fun: 8, social: 6 }, null, { from: 11, to: 20 }),
      act('rfun_ops', 'Run a ride for the evening', 240, 0, 2200, { energy: -10 }, null, { from: 15, to: 22 })
    ]],
    ['ph_sky_lounge', '🍸', 'Rooftop Lounge, GRA Phase 2', 'nightlife', 'glass', 'ph_gra', 13.2, 10.8, null, 'A rooftop over GRA: city lights, a DJ, mocktails and cocktails.', [
      act('phsky_sunset', 'Sundowner on the roof', 60, 9000, 0, { fun: 14, social: 8, stress: -6 }, null, { from: 17, to: 20 }),
      act('phsky_dj', 'Friday DJ night', 180, 15000, 0, { fun: 30, social: 18, energy: -12 }, null, { days: [4, 5], from: 21, to: 24 }),
      act('phsky_wait', 'Waiter shift on the roof', 240, 0, 2600, { energy: -12 }, null, { from: 17, to: 24 })
    ]],
    ['ph_motors', '🚗', 'Garden City Motors, Trans-Amadi', 'services', 'car', 'ph_transamadi', 20.4, 12.8, null, 'A glass showroom of saloons, SUVs and pickups for the oil field.', [
      act('gcm_browse', 'Browse the showroom', 30, 0, 0, { fun: 5 }, null, { from: 9, to: 18 }),
      act('gcm_test', 'Test drive a new pickup', 45, 0, 0, { fun: 14 }, null, { days: WK, from: 10, to: 17 }),
      act('gcm_wash', 'Wash and polish the showroom cars', 180, 0, 1800, { energy: -10, hygiene: -6 }, null, { from: 8, to: 17 })
    ]],
    ['ph_rsu', '🎓', 'Rivers State University', 'learn', 'cap', 'ph_rumuokoro', 11.0, 7.0, null, 'The Senate building, lecture theatre, library, a buka and the halls.', 'rsu_'],
    // Lagos, more of it.
    ['lag_alaba', '🧺', 'Alaba International Market', 'food', 'basket', 'festac', 1.4, 16.4, null, 'Lanes and lanes of electronics: TVs, sound systems, generators and spare parts.', [
      act('alaba_browse', 'Price TVs and sound systems down the lanes', 60, 0, 0, { fun: 6, stress: 3 }, null, { days: [0, 1, 2, 3, 4, 5], from: 8, to: 18 }),
      act('alaba_haggle', 'Haggle for a cheap Bluetooth speaker', 30, 9000, 0, { fun: 10 }, { charisma: 1 }, { days: [0, 1, 2, 3, 4, 5], from: 8, to: 18 }),
      act('alaba_rice', 'Ofada rice at a lane buka', 30, 1800, 0, { hunger: 32 }, null, { from: 10, to: 18 }),
      act('alaba_carry', 'Carry cartons for a trader', 180, 0, 1800, { energy: -16, hygiene: -8 }, { fitness: 1 }, { days: [0, 1, 2, 3, 4, 5], from: 8, to: 17 })
    ]],
    ['lag_night_mkt', '🌙', 'Lekki Night Market', 'food', 'basket', 'lekki', 26.0, 25.2, null, 'Food stalls, thrift racks, a DJ and fairy lights after dark.', [
      act('nmkt_food', 'Asun, suya and boli from the stalls', 30, 4000, 0, { hunger: 30, fun: 6 }, null, { from: 18, to: 24 }),
      act('nmkt_thrift', 'Dig through the thrift racks', 45, 6000, 0, { fun: 10 }, null, { from: 18, to: 24 }),
      act('nmkt_dj', 'Dance by the DJ booth', 60, 0, 0, { fun: 14, social: 10, energy: -8 }, null, { days: [4, 5], from: 20, to: 24 }),
      act('nmkt_stall', 'Help run a food stall for the night', 240, 0, 2600, { energy: -12, hygiene: -8 }, null, { from: 17, to: 24 })
    ]],
    ['lag_waterpark', '🌊', 'Lekki Leisure Waterpark', 'outdoors', 'tree', 'lekki', 29.4, 25.6, 'waterpark', 'Slides, a wave pool, a lazy river and loungers under umbrellas.', [
      act('wpk_slides', 'Day pass: the slides and the wave pool', 180, 12000, 0, { fun: 30, stress: -12, energy: -12, hygiene: -4 }, { fitness: 1 }, { from: 10, to: 18 }),
      act('wpk_kids', 'Splash pad with the kids', 60, 5000, 0, { fun: 12, social: 8 }, null, { from: 10, to: 18 }),
      act('wpk_lounger', 'Rent a lounger and an umbrella', 60, 4000, 0, { stress: -10, fun: 4 }, null, { from: 10, to: 18 }),
      act('wpk_guard', 'Pool attendant shift', 240, 0, 2600, { energy: -10 }, { fitness: 1 }, { from: 9, to: 18 })
    ]],
    ['lag_bowling', '🎳', 'Strike Zone Bowling, VI', 'nightlife', 'tower', 'vi', 18.2, 24.2, 'bowling', 'Ten lanes, glow-in-the-dark nights, a snack bar and arcade machines.', [
      act('bowl_game', 'Bowl two games', 60, 7000, 0, { fun: 16, social: 8 }, null, { from: 12, to: 24 }),
      act('bowl_glow', 'Glow bowling night', 90, 10000, 0, { fun: 22, social: 12 }, null, { days: [4, 5], from: 20, to: 24 }),
      act('bowl_snack', 'Hot dog and a milkshake at the snack bar', 15, 4500, 0, { hunger: 18, fun: 3 }, null, { from: 12, to: 24 }),
      act('bowl_shoes', 'Shoe desk and lane cleaning shift', 240, 0, 2400, { energy: -10 }, null, { from: 12, to: 24 })
    ]],
    ['lag_assembly', '🏛️', 'Lagos State House of Assembly, Alausa', 'outdoors', 'dome', 'ikeja', 11.0, 5.4, null, 'The state assembly at Alausa: the chamber, the public gallery and the lawns.', [
      act('lsha_tour', 'Join the guided tour of the chamber', 60, 0, 0, { fun: 6 }, { charisma: 1 }, { days: WK, from: 10, to: 15 }),
      act('lsha_sitting', 'Watch a sitting from the gallery', 120, 0, 0, { fun: 5, stress: 3 }, null, { days: [1, 2, 3], from: 10, to: 14 }),
      act('lsha_photo', 'Photo by the assembly gate', 15, 0, 0, { fun: 4 }, null, { from: 8, to: 18 })
    ]],
    ['lag_secretariat', '🏢', 'Alausa Secretariat', 'services', 'tower', 'ikeja', 9.0, 5.2, null, 'The state ministries at Alausa: long corridors, file rooms and the canteen.', [
      act('lsec_file', 'Chase your file from desk to desk', 120, 0, 0, { stress: 12, energy: -6 }, null, { days: WK, from: 8, to: 16 }),
      act('lsec_canteen', 'Amala and ewedu at the staff canteen', 30, 1500, 0, { hunger: 28 }, null, { days: WK, from: 11, to: 15 }),
      act('lsec_messenger', 'Messenger shift (files and tea)', 240, 0, 2200, { energy: -10 }, null, { days: WK, from: 8, to: 16 })
    ]],
    ['lag_lasu', '🎓', 'Lagos State University (LASU), Ojo', 'learn', 'cap', 'festac', 1.0, 18.2, null, 'The Senate building, lecture theatre, library, a buka and the halls.', 'lasu_'],
    ['lag_yabatech', '🎓', 'Yaba College of Technology', 'learn', 'cap', 'yaba', 16.2, 15.0, null, 'Workshops, lecture halls, the library, a buka and the hostels.', 'ytech_'],
    ['lag_sky_lounge', '🍸', 'Skyfall Rooftop Lounge, Ikoyi', 'nightlife', 'glass', 'ikoyi', 21.6, 21.4, null, 'A rooftop over Ikoyi: the lagoon lights, a DJ, mocktails and cocktails.', [
      act('lsky_sunset', 'Sundowner over the lagoon', 60, 12000, 0, { fun: 14, social: 8, stress: -6 }, null, { from: 17, to: 20 }),
      act('lsky_dj', 'Friday DJ night', 180, 20000, 0, { fun: 30, social: 18, energy: -12 }, null, { days: [4, 5], from: 21, to: 24 }),
      act('lsky_wait', 'Waiter shift on the roof', 240, 0, 2600, { energy: -12 }, null, { from: 17, to: 24 })
    ]],
    ['lag_epe_fish', '🐟', 'Epe Fish Market', 'food', 'basket', 'ajah', 46.2, 23.0, null, 'Fresh catch from the lagoon: tilapia, catfish, croaker and smoked fish.', [
      act('epe_fish', 'Buy fresh catfish and croaker', 30, 6000, 0, { hunger: 28 }, null, { from: 6, to: 16 }),
      act('epe_smoked', 'Smoked fish for the soup pot', 15, 3500, 0, { hunger: 16 }, null, { from: 6, to: 17 }),
      act('epe_pepper', 'Point-and-kill pepper soup', 45, 4000, 0, { hunger: 34, fun: 6 }, null, { from: 11, to: 20 }),
      act('epe_clean', 'Clean and gut fish for the sellers', 180, 0, 1800, { energy: -12, hygiene: -14 }, null, { from: 6, to: 15 })
    ]],
    ['ph_jetty_fish', '🛶', 'Borokiri Fishing Jetty', 'outdoors', 'boat', 'ph_borokiri', 17.6, 20.6, null, 'Wooden boats, nets drying on the rails and fish smoking in drums.', [
      act('bfj_watch', 'Watch the boats come in', 30, 0, 0, { fun: 6, stress: -4 }, null, { from: 6, to: 18 }),
      act('bfj_smoked', 'Buy smoked fish off the drums', 15, 3000, 0, { hunger: 20 }, null, { from: 7, to: 18 }),
      act('bfj_nets', 'Mend nets with the fishermen', 180, 0, 1800, { energy: -10, hygiene: -6 }, null, { from: 6, to: 16 }),
      act('bfj_canoe', 'Paddle a canoe round the creek', 45, 1500, 0, { fun: 12, energy: -6 }, { fitness: 1 }, { from: 7, to: 17 })
    ]]
  ].forEach(function (q) {
    var p = { id: q[0], icon: q[1], name: q[2], type: q[3], glyph: q[4], district: q[5], x: q[6], y: q[7], acts: [], civic: q[8] || (/^ph_/.test(q[5]) ? 'ph' : /^abj_/.test(q[5]) ? 'abuja' : 'lagos'), text: q[9] };
    if (q[8]) p.inside = q[8];
    CIVIC_PLACES.push(p);
    if (typeof q[10] === 'string') CAMPUS_CLONES.push([q[0], q[10]]); else CIVIC_ACTS[q[0]] = q[10];
  });
  // Rules 21: the daily goals (three a day; the first is always 'do 3 activities') and the reward for all three.
  var DAILY_GOALS = [
    { k: 'acts', n: 3, icon: '✅', label: 'Do 3 activities' },
    { k: 'eat', n: 1, icon: '🍲', label: 'Eat out somewhere' },
    { k: 'gig', n: 1, icon: '💼', label: 'Do one small gig' },
    { k: 'social', n: 1, icon: '🗣️', label: 'Do something social' },
    { k: 'travel', n: 1, icon: '🚌', label: 'Take a ride across town' },
    { k: 'sight', n: 1, icon: '📸', label: 'See a sight' },
    { k: 'newplace', n: 1, icon: '📍', label: 'Do an activity at one of the new places' },
    { k: 'shop', n: 1, icon: '🏪', label: 'Check in on your shops' }
  ], GOAL_REWARD = 5000;
  // Rules 21: weekend events on a four-week rotation (when.wk is the week of the month), at their places.
  var EVENT_ACTS = {
    abj_polo: [
      { id: 'ev_polo_final', label: 'Polo final: watch from the stand (Saturday, week 1)', mins: 180, cost: 8000, fx: { fun: 30, social: 18 }, when: { wk: [0], days: [5], from: 14, to: 19 } },
      { id: 'ev_polo_usher', label: 'Polo final: usher in the stand', mins: 240, earn: 2600, fx: { energy: -12, social: 6 }, gig: true, fest: true, when: { wk: [0], days: [5], from: 12, to: 20 } }
    ],
    ph_jetty_fish: [
      { id: 'ev_regatta_watch', label: 'River regatta: watch the canoe races (Saturday, week 2)', mins: 120, cost: 2000, fx: { fun: 26, social: 14 }, when: { wk: [1], days: [5], from: 10, to: 17 } },
      { id: 'ev_regatta_paddle', label: 'River regatta: paddle in the open race', mins: 120, cost: 5000, fx: { fun: 30, energy: -18 }, xp: { fitness: 1 }, when: { wk: [1], days: [5], from: 10, to: 15 } }
    ],
    lag_night_mkt: [
      { id: 'ev_nmkt_fest', label: 'Night market special: the street-food festival (Fri–Sat, week 3)', mins: 120, cost: 7000, fx: { hunger: 40, fun: 24, social: 14 }, when: { wk: [2], days: [4, 5], from: 18, to: 24 } },
      { id: 'ev_nmkt_stall', label: 'Night market special: work a festival stall', mins: 240, earn: 2800, fx: { energy: -14, hygiene: -8 }, gig: true, fest: true, when: { wk: [2], days: [4, 5], from: 17, to: 24 } }
    ]
  };
  // Places added after the gem hunt began stay out of its pool, so old lives' gems (and their seals) replay.
  CIVIC_PLACES.forEach(function (p) { p.nogem = true; PLACES.push(p); });
  // Rules 19: the Lagoon party boat moored at the island jetties.
  ['cms', 'lagoon_cruise', 'lagoon_jetty', 'ph_bonny_pl'].forEach(function (pid) {
    var id = 'boat_' + pid;
    CIVIC_ACTS[pid] = [
      { id: id + '_party', label: 'Party cruise on the deck (two hours round the ' + (pid === 'ph_bonny_pl' ? 'river' : 'lagoon') + ')', mins: 120, cost: 15000, fx: { fun: 30, social: 20, energy: -10 }, when: { from: 16, to: 24 } },
      { id: id + '_deckbar', label: 'Chapman at the deck bar', mins: 15, cost: 3500, fx: { fun: 4, hunger: 3 }, when: { from: 12, to: 24 } },
      { id: id + '_sundeck', label: 'Lie on the sun deck', mins: 60, cost: 5000, fx: { stress: -12, fun: 5 }, when: { from: 9, to: 18 } },
      { id: id + '_helm', label: 'Stand with the captain at the helm', mins: 30, fx: { fun: 8 }, when: { from: 9, to: 20 } },
      { id: id + '_deckhand', label: 'Deckhand shift (tie up, sweep, serve)', mins: 240, earn: 2600, fx: { energy: -12, hygiene: -6 }, gig: true, fest: true, when: { from: 10, to: 22 } }
    ];
  });
  // Rules 19: UNILAG, the whole campus. Small student hustles only (once a day each), cheap food at Mama B's.
  (function () {
    var U = [
      ['tutorial', 'Evening tutorial class', 90, 2000, 0, { energy: -6 }, { tech: 1 }, { from: 17, to: 21 }],
      ['portal', 'Check results on the portal', 15, 0, 0, { stress: 4 }, null, null],
      ['tdb', 'Night reading (TDB)', 120, 0, 0, { energy: -12, stress: 3 }, { tech: 1 }, { from: 21, to: 24 }],
      ['pastq', 'Photocopy past questions', 15, 500, 0, { stress: -3 }, null, { from: 8, to: 19 }],
      ['typing', 'Type coursemates\' assignments', 120, 0, 1500, { energy: -8 }, { tech: 1 }, { from: 9, to: 22 }],
      ['tutor', 'Tutor 100L students', 120, 0, 2500, { energy: -8, social: 4 }, { charisma: 1 }, { from: 15, to: 21 }],
      ['fiveside', 'Five-a-side at the Sports Centre', 60, 0, 0, { fun: 12, energy: -14, hygiene: -10 }, { fitness: 1 }, { from: 16, to: 20 }],
      ['track', 'Jog round the track', 45, 0, 0, { energy: -10, stress: -6, hygiene: -8 }, { fitness: 1 }, { from: 6, to: 19 }],
      ['interhall', 'Inter-hall games', 180, 0, 0, { fun: 25, social: 15, energy: -15 }, null, { days: [5], from: 10, to: 18 }],
      ['yarn', 'Yarn with coursemates', 30, 0, 0, { social: 8, fun: 4 }, null, null],
      ['groupstudy', 'Group study under the tree', 90, 0, 0, { social: 5, energy: -5 }, { tech: 1 }, { from: 9, to: 19 }],
      ['sug', 'SUG campaign rally', 60, 0, 0, { fun: 8, social: 8 }, { charisma: 1 }, { from: 12, to: 19 }],
      ['whot', 'Play Whot', 30, 0, 0, { fun: 8, social: 4 }, null, null],
      ['ricebeans', 'Rice, beans and dodo at Mama B\'s', 30, 1200, 0, { hunger: 32 }, null, { from: 7, to: 13 }],
      ['spag', 'Jollof spaghetti and egg', 15, 900, 0, { hunger: 24 }, null, { from: 11, to: 21 }],
      ['akara', 'Bread and akara', 15, 500, 0, { hunger: 16 }, null, { from: 6, to: 11 }],
      ['gala', 'Pure water and gala', 15, 250, 0, { hunger: 8 }, null, null],
      ['mamab', 'Help Mama B serve the lunch rush', 180, 0, 1500, { energy: -10, hunger: 15 }, null, { from: 11, to: 15 }],
      ['nap', 'Nap on your bunk', 60, 0, 0, { energy: 18 }, null, null],
      ['hallgist', 'Late-night hall gist', 60, 0, 0, { social: 10, fun: 8, energy: -6 }, null, { from: 21, to: 24 }],
      ['bucket', 'Bucket bath in the hall', 15, 0, 0, { hygiene: 25 }, null, null],
      ['braid', 'Barb and braid in the hall', 60, 1500, 0, { hygiene: 6, fun: 4 }, null, { from: 9, to: 21 }],
      ['recharge', 'Sell recharge cards and data', 180, 0, 1800, { energy: -6, social: 4 }, null, { from: 8, to: 20 }],
      ['puffpuff', 'Fry puff-puff to sell', 150, 1500, 2800, { energy: -10, hygiene: -6 }, null, { from: 7, to: 18 }],
      ['sunset', 'Watch the lagoon at sunset', 30, 0, 0, { stress: -8, fun: 4 }, null, { from: 17, to: 20 }],
      ['date', 'Lagoon front date', 60, 2000, 0, { fun: 10, social: 10, stress: -5 }, null, { from: 16, to: 21 }],
      ['shoot', 'Lagoon front photoshoot', 45, 3000, 0, { fun: 8, social: 4 }, null, { from: 9, to: 18 }]
    ];
    CIVIC_ACTS.unilag = U.map(function (u) { var a = { id: 'uni_' + u[0], label: u[1], mins: u[2], fx: u[5] }; if (u[3]) a.cost = u[3]; if (u[4]) { a.earn = u[4]; a.gig = true; a.fest = true; } if (u[6]) a.xp = u[6]; if (u[7]) a.when = u[7]; return a; });
    // and the University of Port Harcourt, the same campus life under its own ids (Mama Ngozi runs the buka there).
    CIVIC_ACTS.ph_uniport = cloneActs(CIVIC_ACTS.unilag, 'uni_', 'uniport_').map(function (a) { a.label = a.label.replace(/Mama B/g, 'Mama Ngozi').replace(/Lagoon front/g, 'Riverside').replace(/lagoon/g, 'river'); return a; });
    // and the Abuja campuses (Mama Hauwa's buka; lawns and hills where Lagos has the lagoon).
    CAMPUS_CLONES.forEach(function (c) { var ph = /^ph_/.test(c[0]), lag = /^lag_/.test(c[0]), mama = c[0] === 'lag_lasu' ? 'Mama Toyin' : 'Mama Kemi'; CIVIC_ACTS[c[0]] = cloneActs(CIVIC_ACTS.unilag, 'uni_', c[1]).map(function (a) { a.label = lag ? a.label.replace(/Mama B/g, mama).replace(/Lagoon front/g, 'Campus field').replace(/the lagoon/g, 'the campus').replace(/lagoon/g, 'campus') : ph ? a.label.replace(/Mama B/g, 'Mama Ibiere').replace(/Lagoon front/g, 'Riverside').replace(/lagoon/g, 'river') : a.label.replace(/Mama B/g, 'Mama Hauwa').replace(/Lagoon front/g, 'Campus lawn').replace(/the lagoon/g, 'the hills').replace(/lagoon/g, 'lawn'); return a; }); });
  })();
  // Rules 19: Lekki Conservation Centre, close up.
  CIVIC_ACTS.lcc = [
    { id: 'lcc_trail', label: 'Walk the nature trail through the mangroves', mins: 60, cost: 1000, fx: { stress: -10, energy: -6, fun: 6 }, xp: { fitness: 1 }, when: { from: 8, to: 17 } },
    { id: 'lcc_treehouse', label: 'Climb up to the tree house', mins: 30, fx: { fun: 8, energy: -4 }, when: { from: 8, to: 17 } },
    { id: 'lcc_monkeys', label: 'Watch the monkeys in the canopy', mins: 30, fx: { fun: 7, stress: -5 }, when: { from: 7, to: 18 } },
    { id: 'lcc_picnic', label: 'Picnic on the lawn (jollof in a cooler)', mins: 60, cost: 4500, fx: { hunger: 30, social: 8, fun: 6 }, when: { from: 9, to: 17 } },
    { id: 'lcc_guide', label: 'Guide a school group round the trail', mins: 180, earn: 2200, fx: { energy: -10, social: 5 }, xp: { charisma: 1 }, gig: true, fest: true, when: { from: 9, to: 15 } }
  ];
  // Rules 19, inside the clubs: the bar, bottle service, a VIP booth, raining money, and shutting the club down
  // (the whole night on you, once a week). All spending: none of it pays, and the bills are Island bills.
  ['clubs', 'quilox', 'vi_strip', 'lekki_lounges', 'club_tidewater', 'lounge', 'abj_wuse2', 'ph_garden'].forEach(function (pid) {
    var id = 'club_' + pid;
    CIVIC_ACTS[pid] = [
      { id: id + '_cocktail', label: 'Cocktail at the bar', mins: 15, cost: 7000, fx: { fun: 6, hunger: 2 }, when: { from: 18, to: 24 } },
      { id: id + '_bottle', label: 'Order a bottle of champagne (sparklers and the parade)', mins: 60, cost: 180000, fx: { fun: 25, social: 20 }, special: 'bottle', when: { from: 21, to: 24 } },
      { id: id + '_vip', label: 'Book a VIP booth for the night', mins: 180, cost: 450000, fx: { fun: 35, social: 30, energy: -20 }, special: 'vip', when: { from: 21, to: 24 } },
      { id: id + '_rain', label: 'Make it rain on the dance floor (₦50k in new notes)', mins: 30, cost: 50000, fx: { fun: 20, social: 15 }, special: 'rain', when: { from: 21, to: 24 } },
      { id: id + '_shutdown', label: 'Shut down the club: the whole night on you', mins: 240, cost: 25000000, fx: { fun: 80, social: 80, energy: -40, hygiene: -15 }, xp: { charisma: 3 }, special: 'shutdown', when: { from: 22, to: 24 } }
    ];
  });
  var HUNTS = [
    { id: 'blaze', title: 'BLAZE!', artist: 'Kayode Blaze', color: '#d0453a', style: 'afro', pieces: [
      { ch: 'B', place: 'balogun', riddle: 'Where the whole Island haggles over every yard of ankara and lace. The first letter is folded in the fabric.' },
      { ch: 'L', place: 'link_bridge', riddle: 'A bridge that links two rich shores across the lagoon. Walk out to the middle when the sun goes down.' },
      { ch: 'A', place: 'theatre', riddle: 'A concrete general\'s cap in Iganmu, where plays and dancers have met since the festival of \'77.' },
      { ch: 'Z', place: 'ojuelegba_park', riddle: 'The park where conductors shout the loudest and every danfo is full in a minute. Zigzag in.' },
      { ch: 'E', place: 'eko_atlantic_city', riddle: 'A new city standing on sand taken back from the sea. The last letter waits on the boulevard.' }
    ] },
    { id: 'solar', title: 'SOLAR', artist: 'Amara Sol', color: '#f2a516', style: 'highlife', pieces: [
      { ch: 'S', place: 'stadium', riddle: 'The old national arena in Surulere, where the whole country once held its breath for a penalty.' },
      { ch: 'O', place: 'owambe_hall', riddle: 'Saturday jollof, aso-ebi and naira raining on the dance floor. The O is spinning in the spray.' },
      { ch: 'L', place: 'freedom', riddle: 'Once a colonial prison, now a garden of music and poetry on the Island.' },
      { ch: 'A', place: 'crafts', riddle: 'Carvings, beads and paintings piled high in Lekki. Look among the masks.' },
      { ch: 'R', place: 'tbs', riddle: 'The square where the flag went up in 1960 and the parades still march.' }
    ] },
    { id: 'tides', title: 'TIDES', artist: 'DJ Tidewave', color: '#2f8fd0', style: 'afro', pieces: [
      { ch: 'T', place: 'tejuosho', riddle: 'Yaba\'s market that was rebuilt in the sky: shoes, fabrics and phone cases on many floors.' },
      { ch: 'I', place: 'ikoyi_park', riddle: 'A green, quiet corner where Ikoyi takes a slow walk under the trees.' },
      { ch: 'D', place: 'palms', riddle: 'The big Lekki mall where December shopping starts and the cinema never sleeps.' },
      { ch: 'E', place: 'eleko', riddle: 'A beach far east past Ajah, where the road ends and the Atlantic begins.' },
      { ch: 'S', place: 'worship', riddle: 'A cathedral and a central mosque standing side by side on the Island.' }
    ] }
  ];
  // Festivals and big days (rules 18), keyed by place: they show at that place, and only in their month.
  // when.wk is the week of the (4-week) month, 0–3. Paid work here is small, once a day, and the prizes are capped.
  var FESTIVALS = {
    worship: [
      { id: 'fest_xmas_carols', label: 'Christmas carol night at the cathedral', mins: 120, fx: { fun: 12, social: 10, stress: -8 }, event: true, dec: true, fest: true, when: { months: [11], wk: [3], from: 18, to: 22 } },
      { id: 'fest_eid_prayer', label: 'Eid prayers at the praying ground (Sallah)', mins: 120, fx: { social: 12, stress: -10, fun: 4 }, event: true, fest: true, when: { months: [3], wk: [1], days: [5, 6], from: 7, to: 11 } }
    ],
    ikeja_mall: [
      { id: 'fest_xmas_santa', label: 'Play Father Christmas at the mall grotto', mins: 240, earn: 3000, fx: { energy: -14, fun: 4 }, xp: { charisma: 1 }, req: { charisma: 1 }, gig: true, fest: true, when: { months: [11], wk: [2, 3], from: 10, to: 18 } }
    ],
    palms: [
      { id: 'fest_xmas_shop', label: 'Christmas shopping for the family', mins: 90, cost: 15000, fx: { social: 15, fun: 6, stress: 3 }, dec: true, fest: true, when: { months: [11], from: 10, to: 21 } }
    ],
    oshodi_market: [
      { id: 'fest_xmas_rice', label: 'Buy a live chicken and the Christmas rice things', mins: 120, cost: 12000, fx: { hunger: 40, social: 20, fun: 10 }, dec: true, fest: true, when: { months: [11], wk: [3], from: 7, to: 19 } },
      { id: 'fest_eid_ram', label: 'Help at the Sallah ram market', mins: 240, earn: 2500, fx: { energy: -20, hygiene: -10 }, xp: { hustle: 2 }, gig: true, fest: true, when: { months: [3], wk: [0, 1], from: 7, to: 18 } }
    ],
    mushin_market: [
      { id: 'fest_eid_meat', label: 'Share Sallah meat with the neighbours', mins: 90, cost: 4000, fx: { social: 18, fun: 6, hunger: 10 }, fest: true, when: { months: [3], wk: [1], from: 9, to: 19 } }
    ],
    theatre: [
      { id: 'fest_yam_festival', label: 'Iri Ji: the New Yam festival', mins: 180, cost: 2000, fx: { fun: 14, social: 12, hunger: 15 }, event: true, fest: true, when: { months: [7], days: [5], from: 10, to: 18 } },
      { id: 'fest_yam_dance', label: 'Dance to the ogene drums', mins: 60, fx: { fun: 10, energy: -8 }, xp: { fitness: 1 }, fest: true, when: { months: [7], days: [5], from: 10, to: 18 } }
    ],
    tbs: [
      { id: 'fest_marathon_run', label: 'Run the Eko City Marathon', mins: 300, cost: 5000, fx: { energy: -45, stress: -10, fun: 10, hygiene: -20 }, xp: { fitness: 3 }, special: 'marathon', event: true, sport: 'marathon', fest: true, when: { months: [1], wk: [1], days: [5], from: 6, to: 9 } }
    ],
    link_bridge: [
      { id: 'fest_marathon_water', label: 'Hand out water at a marathon station', mins: 240, fx: { social: 12, energy: -10 }, xp: { charisma: 1 }, fest: true, when: { months: [1], wk: [1], days: [5], from: 6, to: 12 } },
      { id: 'fest_marathon_cheer', label: 'Cheer the runners on the bridge', mins: 60, fx: { fun: 6, social: 4 }, fest: true, when: { months: [1], wk: [1], days: [5], from: 6, to: 12 } }
    ],
    eko_convention: [
      { id: 'fest_style_watch', label: 'Watch the Eko Style Week runway', mins: 180, cost: 8000, fx: { fun: 14, social: 8 }, event: true, fest: true, when: { months: [10], days: [0, 1, 2, 3, 4], from: 18, to: 23 } },
      { id: 'fest_style_dresser', label: 'Work backstage as a dresser', mins: 300, earn: 3500, fx: { energy: -16 }, xp: { craft: 1 }, req: { craft: 1 }, gig: true, fest: true, when: { months: [10], days: [0, 1, 2, 3, 4], from: 14, to: 20 } },
      { id: 'fest_style_casting', label: 'Go to the runway model casting', mins: 120, fx: { stress: 6, energy: -6 }, xp: { charisma: 1 }, req: { charisma: 2 }, special: 'casting', fest: true, when: { months: [10], days: [0, 2], from: 10, to: 16 } }
    ]
  };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // INSIDE (rules 17): everyday things to do once you walk into a place, by the kind of place. They cost a little
  // or nothing and pay nothing out, so they make the city fuller without making money easier.
  var INSIDE = {
    eatery:    [{ label: 'Order a plate of rice and stew', mins: 30, cost: 2500, fx: { hunger: 35, fun: 2 } }, { label: 'Buy a cold zobo to go', mins: 15, cost: 500, fx: { hunger: 5, stress: -2 } }, { label: 'Gist with the cook', mins: 15, fx: { social: 5, fun: 2 } }],
    market:    [{ label: 'Haggle for foodstuff', mins: 45, cost: 3000, fx: { hunger: 20, stress: 2 }, xp: { hustle: 1 } }, { label: 'Look through the ankara stalls', mins: 30, fx: { fun: 4, energy: -3 } }, { label: 'Eat at the buka inside', mins: 30, cost: 1800, fx: { hunger: 30 } }, { label: 'Help a trader pack up', mins: 30, fx: { social: 6, energy: -5 } }],
    cinema:    [{ label: 'Buy popcorn and a drink', mins: 15, cost: 2500, fx: { hunger: 8, fun: 3 } }, { label: 'Watch the trailers in the lobby', mins: 15, fx: { fun: 3 } }, { label: 'Play the arcade machines', mins: 30, cost: 1500, fx: { fun: 8, stress: -3 } }],
    culture:   [{ label: 'Walk the gallery rooms', mins: 45, fx: { fun: 6, stress: -4 } }, { label: 'Join a guided talk', mins: 60, cost: 1000, fx: { fun: 5, social: 4 } }, { label: 'Buy a print at the gift shop', mins: 15, cost: 3000, fx: { fun: 3 } }],
    music:     [{ label: 'Catch the soundcheck', mins: 30, fx: { fun: 6, stress: -3 } }, { label: 'Dance at the front', mins: 60, fx: { fun: 10, energy: -8 }, xp: { fitness: 1 }, when: { from: 18, to: 24 } }, { label: 'Buy a drink at the bar', mins: 15, cost: 2000, fx: { fun: 3, social: 2 } }],
    park:      [{ label: 'Take a slow walk round', mins: 30, fx: { stress: -6, energy: -3 } }, { label: 'Sit in the shade and people-watch', mins: 30, fx: { stress: -5, fun: 2 } }, { label: 'Picnic with a meat pie', mins: 30, cost: 1200, fx: { hunger: 12, fun: 4 } }],
    campus:    [{ label: 'Read in the library', mins: 60, fx: { stress: -2, energy: -4 }, xp: { tech: 1 } }, { label: 'Sit in on a lecture', mins: 90, fx: { energy: -6 }, xp: { charisma: 1 } }, { label: 'Eat at the cafeteria', mins: 30, cost: 1200, fx: { hunger: 28 } }],
    tech:      [{ label: 'Work from the hot desks', mins: 60, cost: 1500, fx: { energy: -4 }, xp: { tech: 1 } }, { label: 'Join a meetup talk', mins: 60, fx: { social: 6, fun: 3 }, xp: { tech: 1 } }, { label: 'Free coffee at the pantry', mins: 15, fx: { energy: 4 } }],
    workshop:  [{ label: 'Watch the artisans at work', mins: 30, fx: { fun: 3 }, xp: { craft: 1 } }, { label: 'Get your phone screen fixed', mins: 45, cost: 4000, fx: { stress: -4 } }, { label: 'Lend a hand for an hour', mins: 60, fx: { energy: -6, social: 4 }, xp: { craft: 1 } }],
    dealer:    [{ label: 'Test-sit the new arrivals', mins: 30, fx: { fun: 5 } }, { label: 'Talk prices with a salesman', mins: 30, fx: { social: 3 }, xp: { hustle: 1 } }, { label: 'Free water and AC in the lounge', mins: 15, fx: { stress: -3 } }],
    airport:   [{ label: 'Watch the planes from the gallery', mins: 30, fx: { fun: 5, stress: -2 } }, { label: 'Coffee at the terminal café', mins: 15, cost: 2500, fx: { energy: 4 } }, { label: 'Browse duty-free', mins: 30, fx: { fun: 3 } }],
    jetty:     [{ label: 'Watch the boats come in', mins: 30, fx: { stress: -5 } }, { label: 'Buy fresh fish off a canoe', mins: 30, cost: 3500, fx: { hunger: 10 } }, { label: 'Chat with the boatmen', mins: 15, fx: { social: 5 } }],
    motorpark: [{ label: 'Buy gala and a sachet of water', mins: 15, cost: 400, fx: { hunger: 10 } }, { label: 'Listen to the touts and preachers', mins: 15, fx: { fun: 3, stress: 2 } }, { label: 'Ask about the next bus out', mins: 15, fx: { social: 2 } }],
    salon:     [{ label: 'Wash and blow-dry', mins: 60, cost: 3500, fx: { hygiene: 25, stress: -4 } }, { label: 'Get a quick shape-up', mins: 30, cost: 1500, fx: { hygiene: 10, fun: 2 } }, { label: 'Catch up on the gist under the dryer', mins: 30, fx: { social: 6 } }],
    stadium:   [{ label: 'Jog the track', mins: 30, fx: { energy: -8, stress: -5 }, xp: { fitness: 1 } }, { label: 'Play five-a-side with the boys', mins: 60, fx: { energy: -12, fun: 8, social: 5 }, xp: { fitness: 1 } }, { label: 'Buy a jersey from the stand', mins: 15, cost: 6000, fx: { fun: 4 } }],
    hospital:  [{ label: 'Free blood pressure check', mins: 30, fx: { stress: -2 } }, { label: 'Buy vitamins at the pharmacy', mins: 15, cost: 2500, fx: { energy: 3 } }, { label: 'Visit the sick ward', mins: 30, fx: { social: 5, stress: 2 } }],
    church:    [{ label: 'Pray quietly', mins: 30, fx: { stress: -8 } }, { label: 'Give an offering', mins: 15, cost: 1000, fx: { stress: -3, social: 2 } }, { label: 'Sit in on choir practice', mins: 60, fx: { fun: 4, social: 5 }, xp: { music: 1 } }],
    mosque:    [{ label: 'Pray in the hall', mins: 30, fx: { stress: -8 } }, { label: 'Give sadaqah at the gate', mins: 15, cost: 1000, fx: { stress: -3, social: 2 } }, { label: 'Join the study circle', mins: 60, fx: { social: 5 }, xp: { charisma: 1 } }],
    govt:      [{ label: 'Queue to renew your documents', mins: 90, cost: 2000, fx: { stress: 6, energy: -5 } }, { label: 'Read the notice boards', mins: 15, fx: { fun: 1 } }, { label: 'Tour the old building', mins: 45, fx: { fun: 5 } }],
    bank:      [{ label: 'Update your account details', mins: 45, fx: { stress: 3 } }, { label: 'Ask about savings plans', mins: 30, fx: { stress: -1 }, xp: { hustle: 1 } }, { label: 'Cool off in the banking hall AC', mins: 15, fx: { stress: -2 } }],
    gym:       [{ label: 'Do a full workout', mins: 60, cost: 2000, fx: { energy: -12, stress: -6, hygiene: -10 }, xp: { fitness: 1 } }, { label: 'Use the sauna', mins: 30, cost: 1500, fx: { stress: -6, hygiene: 5 } }, { label: 'Buy a protein shake', mins: 15, cost: 2500, fx: { hunger: 12 } }],
    lounge:    [{ label: 'Order small chops', mins: 30, cost: 6000, fx: { hunger: 18, fun: 3 } }, { label: 'Take a table with a view', mins: 60, cost: 8000, fx: { fun: 8, social: 6 }, when: { from: 17, to: 24 } }, { label: 'Dance by the DJ', mins: 60, fx: { fun: 10, energy: -8 }, when: { from: 20, to: 24 } }],
    beach:     [{ label: 'Walk barefoot on the sand', mins: 30, fx: { stress: -7, energy: -3 } }, { label: 'Hire a chair and umbrella', mins: 60, cost: 3000, fx: { stress: -8, fun: 4 } }, { label: 'Eat roasted corn and coconut', mins: 15, cost: 1000, fx: { hunger: 12 } }, { label: 'Paddle in the shallows', mins: 30, fx: { fun: 6, hygiene: -4 } }],
    estate:    [{ label: 'Stroll the boulevard', mins: 30, fx: { stress: -5 } }, { label: 'Look round the show home', mins: 45, fx: { fun: 5 } }, { label: 'Sit by the lagoon', mins: 30, fx: { stress: -6 } }],
    refinery:  [{ label: 'Take the visitors\' tour', mins: 60, fx: { fun: 5, energy: -4 }, xp: { craft: 1 } }, { label: 'Eat at the canteen', mins: 30, cost: 1500, fx: { hunger: 28 } }, { label: 'Read the safety boards', mins: 15, fx: { stress: 1 } }]
  };
  var INSIDE_BY_GLYPH = { bowl: 'eatery', basket: 'market', film: 'cinema', mask: 'culture', frame: 'culture', note: 'music', tree: 'park', cap: 'campus', phone: 'tech', laptop: 'tech', tool: 'workshop', car: 'dealer', plane: 'airport', boat: 'jetty', yacht: 'jetty', bus: 'motorpark', scissors: 'salon', ball: 'stadium', stadium: 'stadium', cross: 'hospital', mosque: 'mosque', hall: 'church', naira: 'bank', dumbbell: 'gym', badge: 'police', ballot: 'polling', gavel: 'court', book: 'library', hotel: 'hotel', dice: 'casino', tower: 'office', glass: 'lounge', club: 'lounge', wave: 'beach', umbrella: 'beach', estate: 'estate' };
  function insideKind(pl) {
    if (pl.inside) return pl.inside; // a few rules-19 places name their own inside
    if (/refinery|yards|docks|ph_port/.test(pl.id)) return 'refinery';
    if (pl.glyph === 'dome') return pl.type === 'services' ? 'church' : 'govt';
    if (pl.glyph === 'club' && pl.type === 'outdoors') return 'jetty';
    if (pl.glyph === 'hall' && pl.type === 'learn') return 'campus';
    if (pl.glyph === 'frame' && pl.type === 'outdoors') return 'park';
    return INSIDE_BY_GLYPH[pl.glyph] || 'park';
  }
  Object.keys(INSIDE).forEach(function (k) { INSIDE[k].forEach(function (a, i) { a.id = 'in_' + k + '_' + (i + 1); a.inside = k; }); });
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  var DATA = {
    DISTRICTS: DISTRICTS, ROADS: ROADS, FERRY_STOPS: FERRY_STOPS, BRT_STOPS: BRT_STOPS, RAIL_LINES: RAIL_LINES,
    OKADA_BAN: OKADA_BAN, MODES: MODES, HOMES: HOMES, HOME_TYPES: HOME_TYPES, SKILLS: SKILLS, SKILL_XP: SKILL_XP,
    CAREERS: CAREERS, PLACE_ACTIONS: PLACE_ACTIONS, HOME_ACTIONS: HOME_ACTIONS, NPCS: NPCS,
    ROOM_SIZES: ROOM_SIZES, FURNITURE: FURNITURE, VEHICLES: VEHICLES, VEHICLE_TIERS: VEHICLE_TIERS, LOOKS: LOOKS, CLOTHES: CLOTHES,
    ESTATE: ESTATE, SEA: SEA, ROAD_NAMES: ROAD_NAMES, MAJOR_ROADS: MAJOR_ROADS, STREETS: STREETS, AREA_LABELS: AREA_LABELS,
    NYSC_PPAS: NYSC_PPAS, NYSC: NYSC, NYSC_RETAIN: NYSC_RETAIN, SKIT_THEMES: SKIT_THEMES, SPORTS: SPORTS, SLANG: SLANG, INTERVIEWS: INTERVIEWS, KID_NAMES: KID_NAMES, LODGING: LODGING, PLACES: PLACES, PLACE_TYPES: PLACE_TYPES, BILLBOARDS: BILLBOARDS, AD_EMOJI: AD_EMOJI, AD_SLOGANS: AD_SLOGANS, AD_COLORS: AD_COLORS, PSAS: PSAS, BILLBOARD_RENT: BILLBOARD_RENT, AD_PLANS: AD_PLANS, BUSINESSES: BUSINESSES, BUSINESS_TIERS: BUSINESS_TIERS, BUSINESS_SITES: BUSINESS_SITES, BUSINESS_GROWTH: BUSINESS_GROWTH, BUSINESS_LEVEL: BUSINESS_LEVEL, TRAITS: TRAITS, START_HOMES: START_HOMES, WHITE_WEDDING: WHITE_WEDDING, CRUISE: CRUISE, FISHING: FISHING, ROOMS: ROOMS, ROOM_NIGHTS: ROOM_NIGHTS, ROOM_NPCS: ROOM_NPCS, LOCALS: LOCALS, PROPERTIES: PROPERTIES, BUILD: BUILD, HYDE_PARK: HYDE_PARK, CAR: CAR, POLICIES: POLICIES, CBN: CBN, CITIES: CITIES, INTERCITY: INTERCITY, CLUBS: CLUBS, CABINS: CABINS, CITY_CODES: CITY_CODES, AIR: AIR, GIFTS: GIFTS, QUESTS: QUESTS, STOCKS: STOCKS, PARTIES: PARTIES, PARTY_ACTS: PARTY_ACTS, PLANNER_FACTOR: PLANNER_FACTOR, STAFF: STAFF, STAFF_ROOM: STAFF_ROOM, PETS: PETS, YARD_HOMES: YARD_HOMES, HMO: HMO, SHOP_NICHES: SHOP_NICHES, SHOP_ADS: SHOP_ADS, PHONES: PHONES, TITLES: TITLES, JAPA_DESTS: JAPA_DESTS, TOWNHALL: TOWNHALL, GOV_MOTTOS: GOV_MOTTOS, GOV_MIN_STATUS: GOV_MIN_STATUS, WEATHER_MONTHS: WEATHER_MONTHS, HARMATTAN_MONTHS: HARMATTAN_MONTHS,
    GOALS: GOALS, ORIGINS: ORIGINS, MONTHS: MONTHS, DAYS: DAYS, INSIDE: INSIDE, FESTIVALS: FESTIVALS, HUNTS: HUNTS, BRANCH_ACTS: BRANCH_ACTS, CIVIC_ACTS: CIVIC_ACTS, TOPUP_PACKS: TOPUP_PACKS, DAILY_GOALS: DAILY_GOALS, GOAL_REWARD: GOAL_REWARD, EVENT_ACTS: EVENT_ACTS, insideKind: insideKind
  };

  // Keyed tables have no prototype, so an id like 'constructor' or '__proto__' from a save, a replay or another player's
  // doc never finds an entry (Object.keys, for-in, JSON and lookups behave exactly as before).
  Object.keys(DATA).forEach(function (k) { var v = DATA[k]; if (v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype) Object.setPrototypeOf(v, null); });
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.LASGIDI_DATA = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
