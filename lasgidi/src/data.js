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
    status: { name: 'WhatsApp status', cost: 3000, mult: 1.6 },
    insta:  { name: 'Instagram boost', cost: 12000, mult: 2.6 },
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
    { id: 'danforun',    icon: '🚐', title: 'Drive a Danfo Run',     hint: 'Ojuelegba danfo park, Surulere', reward: 2000, go: 'map' }
  ];

  var CITIES = {
    lagos: { name: 'Lagos', airport: 'ikeja', park: 'oshodi', hospital: 'island', hospitalName: 'General Hospital, Lagos Island' },
    abuja: { name: 'Abuja', airport: 'abj_airport', park: 'abj_nyanya', hospital: 'abj_garki', hospitalName: 'National Hospital, Garki' },
    ph:    { name: 'Port Harcourt', airport: 'ph_airport', park: 'ph_rumuokoro', hospital: 'ph_choba', hospitalName: 'the teaching hospital near Choba' }
  };
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
    vi_penthouse: { name: 'Penthouse, Victoria Island', district: 'vi', rent: 260000, power: 0.98, sleep: 1.15, type: 'luxury', x: 20.8, y: 25.4, daily: { stress: -4, fun: 3 }, perk: '24-hour power, a gym and a view of the Atlantic.' },
    abj_kubwa_selfcon: { name: 'Self-con, Kubwa', district: 'abj_kubwa', rent: 6000, power: 0.55, sleep: 0.9, type: 'selfcon', x: 5.2, y: 2.6 },
    abj_nyanya_room:   { name: 'Room in Nyanya', district: 'abj_nyanya', rent: 3000, power: 0.45, sleep: 0.85, type: 'room', x: 27.2, y: 17.0 },
    abj_wuse_flat:     { name: '2-bed flat, Wuse 2', district: 'abj_wuse', rent: 45000, power: 0.8, sleep: 1, type: 'flat2', x: 11.8, y: 9.8 },
    abj_maitama_duplex:{ name: 'Duplex, Maitama', district: 'abj_maitama', rent: 140000, power: 0.92, sleep: 1.1, type: 'duplex', x: 14.8, y: 5.8, daily: { stress: -3 } },
    abj_asokoro_mansion:{ name: 'Mansion, Asokoro', district: 'abj_asokoro', rent: 450000, power: 0.99, sleep: 1.2, type: 'mansion', x: 23.0, y: 12.0, daily: { stress: -6, fun: 4 } },
    ph_rumuokoro_room: { name: 'Room in Rumuokoro', district: 'ph_rumuokoro', rent: 2800, power: 0.4, sleep: 0.85, type: 'room', x: 13.6, y: 4.8 },
    ph_dline_selfcon:  { name: 'Self-con, D-Line', district: 'ph_dline', rent: 7000, power: 0.5, sleep: 0.9, type: 'selfcon', x: 8.2, y: 16.0 },
    ph_gra_flat:       { name: '3-bed flat, GRA Phase 2', district: 'ph_gra', rent: 40000, power: 0.75, sleep: 1.05, type: 'flat3', x: 12.4, y: 9.8 },
    ph_oldgra_duplex:  { name: 'Duplex, Old GRA', district: 'ph_oldgra', rent: 90000, power: 0.85, sleep: 1.1, type: 'duplex', x: 14.6, y: 16.2, daily: { stress: -3 } },
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
    fitness:  { name: 'Fitness', district: 'lekki', skill: 'fitness', start: 6, end: 12, days: [0,1,2,3,4,5],
      titles: ['Gym Assistant', 'Trainer', 'Head Coach', 'Gym Owner', 'Fitness Icon'],
      pay: [5000, 8000, 13500, 24000, 45000], req: [1, 3, 5, 7, 9] }
  };

  // Effects: needs deltas (hunger, energy, fun, social, hygiene, stress), xp, earn, cost.
  // when: {days:[...], from:h, to:h} — action allowed only then.
  var PLACE_ACTIONS = {
    abj_kubwa: [
      { id: 'abj_kubwa_food', label: 'Buy foodstuff at Kubwa market (7 meals)', mins: 60, cost: 4500, special: 'pantry7', when: { from: 7, to: 19 } },
      { id: 'abj_kubwa_gig', label: 'Carry loads at Kubwa market', mins: 180, earn: 2400, fx: { energy: -20, hygiene: -12 }, xp: { hustle: 2, fitness: 1 }, gig: true, when: { from: 7, to: 18 } }
    ],
    abj_maitama: [
      { id: 'abj_millennium', label: 'Walk in Millennium Park', mins: 90, fx: { fun: 18, stress: -12 }, when: { from: 7, to: 19 } },
      { id: 'abj_maitama_gig', label: 'Run errands for Maitama households', mins: 150, earn: 3500, fx: { energy: -12 }, xp: { hustle: 2, charisma: 1 }, gig: true, when: { from: 8, to: 19 } }
    ],
    abj_wuse: [
      { id: 'abj_suya', label: 'Eat suya in Wuse 2', mins: 45, cost: 2500, fx: { hunger: 35, fun: 10 }, when: { from: 17, to: 24 } },
      { id: 'abj_night', label: 'Night out in Wuse 2', mins: 240, cost: 15000, fx: { fun: 55, social: 40, energy: -35, hygiene: -15 }, special: 'club', when: { days: [4,5], from: 21, to: 24 } },
      { id: 'abj_wuse_gig', label: 'Sell at Wuse Market', mins: 180, earn: 3000, fx: { energy: -15 }, xp: { hustle: 3 }, gig: true, when: { days: [0,1,2,3,4,5], from: 8, to: 18 } }
    ],
    abj_jabi: [
      { id: 'abj_jabi_film', label: 'Watch a film at Jabi Lake Mall', mins: 150, cost: 5000, fx: { fun: 40, social: 10, stress: -10 }, when: { from: 11, to: 23 } },
      { id: 'abj_jabi_boat', label: 'Boat ride on Jabi Lake', mins: 60, cost: 3000, fx: { fun: 25, stress: -10 }, when: { from: 9, to: 18 } },
      { id: 'abj_jabi_gig', label: 'Wash cars by the lake', mins: 180, earn: 2800, fx: { energy: -15, hygiene: -10 }, xp: { hustle: 2 }, gig: true, when: { from: 8, to: 18 } }
    ],
    abj_asokoro: [
      { id: 'abj_aso', label: 'Watch the sun set on Aso Rock', mins: 60, fx: { fun: 15, stress: -10 }, when: { from: 16, to: 19 } },
      { id: 'abj_asokoro_gig', label: 'Security shift at an Asokoro gate', mins: 240, earn: 4000, fx: { energy: -18, fun: -8 }, xp: { fitness: 1 }, gig: true }
    ],
    abj_garki: [
      { id: 'abj_carnival', label: 'Abuja Carnival at Eagle Square', mins: 240, cost: 2000, fx: { fun: 50, social: 30, energy: -20 }, event: true, when: { months: [10], days: [5,6], from: 10, to: 20 } },
      { id: 'abj_eagle', label: 'Stroll round Eagle Square', mins: 45, fx: { fun: 10, stress: -5 }, when: { from: 7, to: 19 } },
      { id: 'abj_garki_gig', label: 'Type documents at a business centre', mins: 120, earn: 3200, fx: { energy: -8 }, xp: { tech: 2 }, gig: true, when: { days: [0,1,2,3,4], from: 8, to: 18 } }
    ],
    abj_nyanya: [
      { id: 'abj_nyanya_buka', label: 'Eat at a Nyanya buka', mins: 30, cost: 1300, fx: { hunger: 45 } },
      { id: 'abj_nyanya_gig', label: 'Load buses at Nyanya park', mins: 180, earn: 2600, fx: { energy: -20, hygiene: -12 }, xp: { hustle: 2 }, gig: true, when: { from: 5, to: 20 } }
    ],
    abj_airport: [
      { id: 'abj_air_lounge', label: 'Premium lounge: shower, buffet, quiet', mins: 60, cost: 25000, fx: { hunger: 40, hygiene: 25, energy: 10, stress: -12, fun: 6 } },
      { id: 'abj_air_spot', label: 'Plane-spotting at the apron window', mins: 30, fx: { fun: 6, stress: -3 } },
      { id: 'abj_air_eat', label: 'Eat at the airport', mins: 45, cost: 6000, fx: { hunger: 50 } },
      { id: 'abj_air_gig', label: 'Help travellers with bags', mins: 120, earn: 2500, fx: { energy: -12 }, xp: { charisma: 1 }, gig: true, when: { from: 6, to: 22 } }
    ],
    ph_airport: [
      { id: 'ph_air_lounge', label: 'Premium lounge: shower, buffet, quiet', mins: 60, cost: 22000, fx: { hunger: 40, hygiene: 25, energy: 10, stress: -12, fun: 6 } },
      { id: 'ph_air_spot', label: 'Plane-spotting at the apron window', mins: 30, fx: { fun: 6, stress: -3 } },
      { id: 'ph_air_eat', label: 'Eat at the airport', mins: 45, cost: 5500, fx: { hunger: 50 } },
      { id: 'ph_air_gig', label: 'Help travellers with bags', mins: 120, earn: 2400, fx: { energy: -12 }, xp: { charisma: 1 }, gig: true, when: { from: 6, to: 22 } }
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
      { id: 'ph_gra_gig', label: 'Valet parking in GRA', mins: 180, earn: 3500, fx: { energy: -12 }, xp: { charisma: 1 }, gig: true, when: { from: 17, to: 24 } }
    ],
    ph_transamadi: [
      { id: 'ph_canteen', label: 'Eat at a yard canteen', mins: 30, cost: 1500, fx: { hunger: 45 } },
      { id: 'ph_yard_gig', label: 'Day labour at a Trans-Amadi yard', mins: 300, earn: 4500, fx: { energy: -30, hygiene: -15 }, xp: { craft: 2, fitness: 1 }, gig: true, when: { days: [0,1,2,3,4,5], from: 6, to: 15 } }
    ],
    ph_dline: [
      { id: 'ph_mile1_food', label: 'Buy foodstuff at Mile 1 (7 meals)', mins: 60, cost: 6000, special: 'pantry7', when: { from: 7, to: 19 } },
      { id: 'ph_mile1_gig', label: 'Carry loads at Mile 1 market', mins: 180, earn: 2500, fx: { energy: -20, hygiene: -12 }, xp: { hustle: 2, fitness: 1 }, gig: true, when: { from: 7, to: 18 } }
    ],
    ph_oldgra: [
      { id: 'ph_bole', label: 'Eat bole and fish', mins: 45, cost: 2500, fx: { hunger: 50, fun: 10 } },
      { id: 'ph_isaac', label: 'Walk in Isaac Boro Park', mins: 60, fx: { fun: 12, stress: -8 }, when: { from: 7, to: 19 } },
      { id: 'ph_oldgra_gig', label: 'Run errands in Old GRA', mins: 150, earn: 2700, fx: { energy: -12 }, xp: { hustle: 2 }, gig: true, when: { from: 8, to: 19 } }
    ],
    ph_borokiri: [
      { id: 'ph_waterfront', label: 'Watch the boats at the waterfront', mins: 60, fx: { fun: 15, stress: -8 }, when: { from: 6, to: 19 } },
      { id: 'ph_fish_gig', label: 'Help fishermen land the catch', mins: 180, earn: 2600, fx: { energy: -20, hygiene: -15 }, xp: { fitness: 1, hustle: 1 }, gig: true, when: { from: 5, to: 12 } }
    ],
    mushin: [
      { id: 'mushin_market', label: 'Buy foodstuff at the local market (7 meals)', mins: 45, cost: 4800, special: 'pantry7', when: { from: 7, to: 20 } },
      { id: 'mushin_mamaput', label: 'Eat at Mama Put', mins: 30, cost: 1200, fx: { hunger: 45 } },
      { id: 'mushin_barber', label: 'Gist at the barbershop', mins: 60, fx: { social: 20, fun: 5 }, xp: { charisma: 2 } },
      { id: 'mushin_water', label: 'Sell pure water in go-slow', mins: 120, earn: 1800, fx: { energy: -15, hygiene: -10 }, xp: { hustle: 3 }, gig: true, when: { from: 7, to: 20 } },
      { id: 'mushin_football', label: 'Street football', mins: 60, fx: { fun: 25, energy: -15, hygiene: -20, stress: -8 }, xp: { fitness: 3 }, when: { from: 6, to: 19 } }
    ],
    yaba: [
      { id: 'yaba_typing', label: 'Type assignments for students', mins: 120, earn: 2000, fx: { energy: -8 }, xp: { tech: 2 }, gig: true, when: { from: 8, to: 22 } },
      { id: 'yaba_tejuosho', label: 'Buy foodstuff at Tejuosho (7 meals)', mins: 60, cost: 5000, special: 'pantry7', when: { from: 7, to: 19 } },
      { id: 'yaba_buka', label: 'Eat at a Yaba buka', mins: 30, cost: 1500, fx: { hunger: 45 } },
      { id: 'yaba_library', label: 'Study at the library', mins: 120, cost: 500, fx: { energy: -10, fun: -5 }, xp: { tech: 4 }, when: { from: 8, to: 20 } },
      { id: 'yaba_enrol', label: 'Enrol at UNILAG (part-time)', mins: 60, cost: 150000, special: 'enrol' },
      { id: 'yaba_lecture', label: 'Attend lectures', mins: 180, fx: { energy: -15, fun: -5 }, xp: { tech: 2, charisma: 1 }, special: 'lecture', when: { days: [0,1,2,3,4], from: 8, to: 17 } },
      { id: 'yaba_ielts', label: 'IELTS prep class', mins: 120, cost: 3000, fx: { energy: -10 }, xp: { charisma: 2 }, special: 'ielts_prep', when: { from: 9, to: 19 } },
      { id: 'yaba_hackathon', label: 'Weekend hackathon', mins: 240, fx: { social: 25, energy: -25, fun: 15 }, xp: { tech: 8 }, special: 'hackathon', when: { days: [5,6], from: 9, to: 18 } },
      { id: 'yaba_cchub', label: 'Startup meetup at CcHub', mins: 150, fx: { social: 20, fun: 10, energy: -10 }, xp: { tech: 3, charisma: 2 }, when: { days: [1,3], from: 17, to: 21 } },
    ],
    surulere: [
      { id: 'suru_danfo', label: 'Drive a danfo: the Ojuelegba run (mini-game)', mins: 180, fx: { energy: -18, stress: 8, hygiene: -10 }, xp: { hustle: 2 }, gig: true, minigame: 'danfo', when: { from: 6, to: 21 } },
      { id: 'suru_match', label: 'Super Eagles match at the National Stadium', mins: 180, cost: 3000, fx: { fun: 40, social: 25, stress: -10 }, event: true, when: { days: [5], from: 15, to: 19 } },
      { id: 'suru_recharge', label: 'Sell recharge cards by the stadium', mins: 180, earn: 2300, fx: { energy: -10, social: 5 }, xp: { hustle: 3 }, gig: true, when: { from: 7, to: 21 } },
      { id: 'suru_market', label: 'Buy foodstuff at the market (7 meals)', mins: 45, cost: 5000, special: 'pantry7', when: { from: 7, to: 19 } },
      { id: 'suru_amala', label: 'Eat amala and ewedu', mins: 45, cost: 1800, fx: { hunger: 55, fun: 5 } },
      { id: 'suru_stadium', label: 'Train at the National Stadium', mins: 90, fx: { energy: -20, fun: 10, hygiene: -25, stress: -10 }, xp: { fitness: 5 }, when: { from: 6, to: 19 } },
      { id: 'suru_studio', label: 'Book studio time', mins: 120, cost: 5000, fx: { fun: 15, energy: -10 }, xp: { music: 6 }, when: { from: 10, to: 23 } },
      { id: 'suru_theatre', label: 'See a play at the National Theatre', mins: 150, cost: 3000, fx: { fun: 35, social: 10, stress: -8 }, xp: { charisma: 1 }, when: { days: [4,5,6], from: 15, to: 22 } },
      { id: 'suru_owambe', label: 'Attend an owambe', mins: 240, cost: 3000, fx: { fun: 40, social: 40, hunger: 60, energy: -20 }, xp: { charisma: 2 }, special: 'owambe', when: { days: [5], from: 12, to: 19 } }
    ],
    ikeja: [
      { id: 'ikeja_air_lounge', label: 'Premium lounge: shower, buffet, quiet', mins: 60, cost: 30000, fx: { hunger: 40, hygiene: 25, energy: 10, stress: -12, fun: 6 } },
      { id: 'ikeja_air_spot', label: 'Plane-spotting at the apron window', mins: 30, fx: { fun: 6, stress: -3 } },
      { id: 'ikeja_felabration', label: 'Felabration night at the Shrine', mins: 300, cost: 5000, fx: { fun: 70, social: 40, energy: -25, stress: -15 }, xp: { music: 3 }, special: 'club', event: true, when: { months: [9], from: 19, to: 24 } },
      { id: 'ikeja_cv_learn', label: 'Learn repairs at Computer Village', mins: 120, cost: 1000, fx: { energy: -10 }, xp: { craft: 5 }, when: { days: [0,1,2,3,4,5], from: 9, to: 18 } },
      { id: 'ikeja_cv_gig', label: 'Fix phones for walk-ins', mins: 120, earn: 2600, fx: { energy: -10 }, xp: { craft: 3 }, gig: true, req: { craft: 2 }, when: { from: 9, to: 19 } },
      { id: 'ikeja_cinema', label: 'Watch a film at the mall', mins: 150, cost: 4000, fx: { fun: 40, social: 10, stress: -10 }, when: { from: 11, to: 23 } },
      { id: 'ikeja_ielts', label: 'Sit the IELTS exam', mins: 240, cost: 320000, special: 'ielts_exam', when: { days: [5], from: 8, to: 12 } },
      { id: 'ikeja_super', label: 'Supermarket shop at the mall (7 meals)', mins: 60, cost: 7000, special: 'pantry7', when: { from: 9, to: 21 } },
      { id: 'ikeja_dubai', label: 'Weekend in Dubai on your private jet', mins: 2880, cost: 2500000, fx: { fun: 80, social: 40, stress: -40 }, needsVehicle: 'jet' },
      { id: 'ikeja_shrine', label: 'Live Afrobeat at the New Afrika Shrine', mins: 180, cost: 2000, fx: { fun: 40, social: 25, stress: -10, energy: -15 }, when: { days: [3,4,5,6], from: 20, to: 24 } },
      { id: 'ikeja_park', label: 'Picnic at Ndubuisi Kanu Park', mins: 90, fx: { fun: 15, social: 10, stress: -12 }, when: { from: 7, to: 19 } },
      { id: 'ikeja_suya', label: 'Suya by the roadside', mins: 30, cost: 1500, fx: { hunger: 35, fun: 5 }, when: { from: 17, to: 24 } }
    ],
    oshodi: [
      { id: 'oshodi_hawk', label: 'Hawk in traffic', mins: 180, earn: 2800, fx: { energy: -20, hygiene: -15, stress: 6 }, xp: { hustle: 4 }, gig: true, when: { from: 6, to: 21 } },
      { id: 'oshodi_market', label: 'Buy foodstuff (7 meals)', mins: 60, cost: 4500, special: 'pantry7' },
      { id: 'oshodi_bukka', label: 'Eat at a bukka', mins: 30, cost: 1000, fx: { hunger: 40 } }
    ],
    island: [
      { id: 'island_eyo', label: 'Watch the Eyo festival procession', mins: 240, fx: { fun: 45, social: 25, energy: -15 }, event: true, when: { months: [0], days: [5], from: 8, to: 16 } },
      { id: 'island_balogun', label: 'Haggle at Balogun market', mins: 60, fx: { fun: 5, energy: -5 }, xp: { hustle: 3, charisma: 1 }, when: { days: [0,1,2,3,4,5], from: 8, to: 18 } },
      { id: 'island_worship', label: 'Worship at church or mosque', mins: 90, fx: { stress: -25, social: 15 } },
      { id: 'island_checkup', label: 'Check-up at General Hospital', mins: 120, cost: 8000, fx: { stress: -10, energy: 10 } },
      { id: 'island_welfare', label: 'Free meal at the church or mosque welfare', mins: 60, fx: { hunger: 40, stress: 5 }, special: 'welfare', when: { from: 7, to: 19 } },
      { id: 'island_alaaru', label: 'Carry loads at Balogun (alaaru)', mins: 180, earn: 2200, fx: { energy: -22, hygiene: -15 }, xp: { hustle: 3, fitness: 1 }, gig: true, when: { days: [0,1,2,3,4,5], from: 7, to: 18 } },
      { id: 'island_freedom', label: 'Live music at Freedom Park', mins: 120, cost: 1000, fx: { fun: 30, social: 20, stress: -10 }, when: { from: 16, to: 23 } },
      { id: 'island_museum', label: 'Visit the National Museum', mins: 90, cost: 500, fx: { fun: 12, stress: -5 }, xp: { charisma: 1 }, when: { days: [0,1,2,3,4,5], from: 9, to: 17 } },
      { id: 'island_ewa', label: 'Ewa agoyin and bread', mins: 30, cost: 1300, fx: { hunger: 45 } }
    ],
    vi: [
      { id: 'vi_dec_festival', label: 'Detty December festival on the beach', mins: 360, cost: 40000, fx: { fun: 85, social: 55, energy: -40, hygiene: -20 }, special: 'club', event: true, when: { months: [11], days: [5,6], from: 16, to: 24 } },
      { id: 'vi_carwash', label: 'Wash cars outside the banks', mins: 180, earn: 2800, fx: { energy: -15, hygiene: -10 }, xp: { hustle: 2 }, gig: true, when: { days: [0,1,2,3,4,5], from: 8, to: 18 } },
      { id: 'vi_lounge', label: 'Network at a lounge', mins: 120, cost: 8000, fx: { social: 25, fun: 10 }, xp: { charisma: 5 }, when: { from: 17, to: 24 } },
      { id: 'vi_club', label: 'Club night', mins: 240, cost: 15000, fx: { fun: 60, social: 40, energy: -40, hygiene: -20 }, special: 'club', when: { days: [4,5], from: 21, to: 24 } },
      { id: 'vi_restaurant', label: 'Eat at a restaurant', mins: 60, cost: 12000, fx: { hunger: 60, fun: 15 } },
      { id: 'vi_park', label: 'Relax at Muri Okunola Park', mins: 60, fx: { fun: 10, stress: -10 }, when: { from: 6, to: 20 } },
      { id: 'vi_beach', label: 'Walk Bar Beach at dusk', mins: 60, fx: { fun: 15, stress: -12 }, when: { from: 16, to: 20 } },
      { id: 'vi_quilox', label: 'VIP table at Quilox', mins: 300, cost: 250000, fx: { fun: 80, social: 55, energy: -45, hygiene: -20 }, xp: { charisma: 3 }, special: 'club', when: { days: [4,5,6], from: 22, to: 24 } },
      { id: 'vi_quilox_door', label: 'Queue at the Quilox door', mins: 120, cost: 20000, fx: { fun: 30, social: 20, energy: -20 }, special: 'club', when: { days: [4,5], from: 22, to: 24 } },
    ],
    ikoyi: [
      { id: 'ikoyi_garden', label: 'Tend a madam\'s garden', mins: 180, earn: 3000, fx: { energy: -15, hygiene: -10 }, xp: { craft: 2 }, gig: true, when: { days: [0,1,2,3,4,5], from: 7, to: 17 } },
      { id: 'ikoyi_jog', label: 'Jog around the park', mins: 60, fx: { energy: -12, fun: 10, hygiene: -15, stress: -12 }, xp: { fitness: 3 }, when: { from: 6, to: 19 } },
      { id: 'ikoyi_gallery', label: 'Visit an art gallery', mins: 90, cost: 2000, fx: { fun: 20, social: 10, stress: -8 }, when: { from: 10, to: 18 } },
      { id: 'ikoyi_dine', label: 'Fine dining', mins: 90, cost: 25000, fx: { hunger: 70, fun: 25, social: 10 }, when: { from: 12, to: 23 } }
    ],
    lekki: [
      { id: 'lekki_dec_concert', label: 'Detty December beach concert at Elegushi', mins: 300, cost: 25000, fx: { fun: 80, social: 50, energy: -35, hygiene: -15 }, special: 'club', event: true, when: { months: [11], days: [4,5,6], from: 18, to: 24 } },
      { id: 'lekki_errands', label: 'Run errands in the estate', mins: 120, earn: 2200, fx: { energy: -10 }, xp: { hustle: 2, charisma: 1 }, gig: true, when: { from: 8, to: 20 } },
      { id: 'lekki_beach', label: 'Beach day', mins: 180, cost: 2000, fx: { fun: 45, social: 20, hygiene: -15, stress: -15 }, when: { from: 9, to: 18 } },
      { id: 'lekki_palms_film', label: 'Watch a film at The Palms', mins: 150, cost: 5000, fx: { fun: 40, social: 10, stress: -10 }, when: { from: 11, to: 23 } },
      { id: 'lekki_palms_shop', label: 'Window shop and eat at The Palms', mins: 90, cost: 6000, fx: { hunger: 40, fun: 20, stress: -8 }, when: { from: 10, to: 21 } },
      { id: 'lekki_island', label: 'Day on a private island (by your own boat)', mins: 480, cost: 5000000, fx: { fun: 90, social: 40, stress: -50, energy: -10 }, needsVehicle: 'boat', when: { from: 7, to: 15 } },
      { id: 'lekki_elegushi', label: 'Beach party at Elegushi', mins: 240, cost: 5000, fx: { fun: 55, social: 35, stress: -15, hygiene: -15, energy: -15 }, when: { days: [5,6], from: 12, to: 22 } },
      { id: 'lekki_lcc', label: 'Canopy walk at the Conservation Centre', mins: 150, cost: 3000, fx: { fun: 35, stress: -15, energy: -10 }, xp: { fitness: 1 }, when: { from: 8, to: 17 } },
      { id: 'lekki_gym', label: 'Gym class', mins: 90, cost: 3000, fx: { energy: -18, hygiene: -20, stress: -10 }, xp: { fitness: 6 }, when: { from: 6, to: 21 } },
      { id: 'lekki_content', label: 'Shoot content', mins: 120, fx: { fun: 10, energy: -8 }, xp: { charisma: 3, music: 1 }, special: 'content', when: { from: 8, to: 20 } },
      { id: 'lekki_super', label: 'Supermarket shop (7 meals)', mins: 45, cost: 7500, special: 'pantry7', when: { from: 8, to: 21 } },
      { id: 'lekki_cafe', label: 'Brunch at a café', mins: 60, cost: 6000, fx: { hunger: 50, fun: 10 } }
    ],
    ajah: [
      { id: 'ajah_market', label: 'Buy foodstuff at Ajah market (7 meals)', mins: 45, cost: 5000, special: 'pantry7', when: { from: 7, to: 19 } },
      { id: 'ajah_spot', label: 'Eat at a local spot', mins: 30, cost: 1500, fx: { hunger: 45 } },
      { id: 'ajah_shop', label: "Help at a cousin's shop", mins: 180, earn: 2400, fx: { energy: -12 }, xp: { hustle: 3 }, gig: true, when: { days: [0,1,2,3,4,5], from: 8, to: 19 } }
    ],
    ikorodu: [
      { id: 'iko_market', label: 'Buy farm foodstuff (7 meals)', mins: 60, cost: 3500, special: 'pantry7' },
      { id: 'iko_sawmill', label: 'Help at the sawmill', mins: 180, earn: 2400, fx: { energy: -22, hygiene: -20 }, xp: { craft: 4 }, gig: true, when: { days: [0,1,2,3,4,5], from: 7, to: 17 } },
      { id: 'iko_eat', label: 'Eat at a canteen', mins: 30, cost: 1000, fx: { hunger: 40 } }
    ],
    festac: [
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
    { id: 'oshodi_market', icon: '🛒', name: 'Oshodi market', type: 'food', glyph: 'basket', district: 'oshodi', x: 9.3, y: 8.6, acts: ['oshodi_market', 'oshodi_bukka', 'oshodi_hawk'], text: 'Buy foodstuff in bulk, eat cheap, hawk in the go-slow.' },
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
    { id: 'owambe_hall', icon: '🎉', name: 'Event hall', type: 'nightlife', glyph: 'note', district: 'surulere', x: 9.5, y: 18.6, acts: ['suru_owambe'], text: 'Saturday owambes: jollof, small chops, money spraying.' },
    { id: 'amala', icon: '🍲', name: 'Amala Shitta', type: 'food', glyph: 'bowl', district: 'surulere', x: 10.4, y: 18.7, acts: ['suru_amala'], text: 'Amala, ewedu and gbegiri, eaten with your hand.' },
    { id: 'unilag', icon: '🎓', name: 'University of Lagos', type: 'learn', glyph: 'cap', district: 'yaba', x: 15.6, y: 16.1, acts: ['yaba_enrol', 'yaba_lecture'], text: 'Part-time degrees on weekdays. 30 lectures to graduate.' },
    { id: 'hub', icon: '💡', name: 'CcHub, Yaba', type: 'learn', glyph: 'laptop', district: 'yaba', x: 14.5, y: 14.6, acts: ['yaba_cchub', 'yaba_hackathon', 'yaba_typing'], text: 'The tech hub on Herbert Macaulay Way. Tuesday and Thursday meetups, weekend hackathons, freelance typing gigs.' },
    { id: 'library', icon: '📚', name: 'Yaba library', type: 'learn', glyph: 'cap', district: 'yaba', x: 15.5, y: 14.4, acts: ['yaba_library', 'yaba_ielts'], text: 'Quiet study, and IELTS prep classes.' },
    { id: 'tejuosho', icon: '🛍️', name: 'Tejuosho market', type: 'food', glyph: 'basket', district: 'yaba', x: 14.4, y: 15.5, acts: ['yaba_tejuosho', 'yaba_buka'], text: 'Fabric, foodstuff and a busy buka.' },
    { id: 'balogun', icon: '🛍️', name: 'Balogun market', type: 'food', glyph: 'basket', district: 'island', x: 15.6, y: 21.6, acts: ['island_balogun', 'island_alaaru'], text: 'The biggest market on the Island. Haggle, or carry loads for cash.' },
    { id: 'freedom', icon: '🎶', name: 'Freedom Park', type: 'culture', glyph: 'note', district: 'island', x: 16.4, y: 22.6, acts: ['island_eyo', 'island_freedom'], text: 'A former colonial prison turned open-air arts venue. Live music in the evenings.' },
    { id: 'museum', icon: '🏛️', name: 'National Museum, Onikan', type: 'culture', glyph: 'mask', district: 'island', x: 16.9, y: 21.6, acts: ['island_museum'], text: 'Bronzes, masks and Nigerian history.' },
    { id: 'gen_hosp', icon: '🏥', name: 'General Hospital', type: 'services', glyph: 'cross', district: 'island', x: 15.8, y: 22.9, acts: ['island_checkup', 'island_welfare'], text: 'Check-ups, and where you wake up if you collapse.' },
    { id: 'worship', icon: '🛐', name: 'Cathedral and Central Mosque', type: 'services', glyph: 'dome', district: 'island', x: 16.6, y: 21.0, acts: ['island_worship'], text: 'Prayer, peace and free welfare meals when you are broke.' },
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
    { id: 'quilox', icon: '🌐', name: 'Quilox', type: 'nightlife', glyph: 'glass', district: 'vi', x: 18.0, y: 24.9, acts: ['vi_quilox', 'vi_quilox_door'], text: 'The most famous club on the Island. VIP tables, bottle sparklers and celebrity sightings, Friday to Sunday.' },
    { id: 'palms', icon: '🛍️', name: 'The Palms', type: 'culture', glyph: 'film', district: 'lekki', x: 26.1, y: 23.5, acts: ['lekki_palms_film', 'lekki_palms_shop'], text: 'The big Lekki mall: cinema, food court and shops.' },
    { id: 'vip_jetty', icon: '🏝️', name: 'Lekki VIP jetty', type: 'outdoors', glyph: 'boat', district: 'lekki', x: 25.9, y: 24.4, acts: ['lekki_island'], text: 'Private boats leave from here for the islands off Lagos. You need your own boat.' },
    { id: 'elegushi', icon: '🏖️', name: 'Elegushi beach', type: 'outdoors', glyph: 'wave', district: 'lekki', x: 27.3, y: 25.8, acts: ['lekki_dec_concert', 'lekki_elegushi'], text: 'Weekend beach parties with DJs, horses and suya by the waves.' },
    { id: 'lekki_motors', icon: '🏎️', name: 'Lekki luxury motors', type: 'services', glyph: 'car', district: 'lekki', x: 27.1, y: 24.9, acts: [], dealer: true, text: 'Glass showroom of SUVs, supercars and boats. Helicopters and jets by appointment.' },
    { id: 'lekki_beach', icon: '🏖️', name: 'Lekki beach', type: 'outdoors', glyph: 'wave', district: 'lekki', x: 28.4, y: 25.7, acts: ['lekki_beach', 'lekki_content'], text: 'Weekend crowds, horses and content shoots.' },
    { id: 'lcc', icon: '🐒', name: 'Lekki Conservation Centre', type: 'outdoors', glyph: 'tree', district: 'lekki', x: 26.6, y: 24.2, acts: ['lekki_lcc'], text: 'Monkeys, mangroves and a long canopy walkway.' },
    { id: 'lekki_gym', icon: '🏋️', name: 'Lekki gym', type: 'outdoors', glyph: 'dumbbell', district: 'lekki', x: 28.7, y: 23.6, acts: ['lekki_gym'], text: 'Classes all day. Zainab trains here.' },
    { id: 'lekki_cafe', icon: '☕', name: 'Lekki cafés', type: 'food', glyph: 'bowl', district: 'lekki', x: 27.6, y: 23.7, acts: ['lekki_cafe', 'lekki_super', 'lekki_errands'], text: 'Brunch, a supermarket and errands for estate residents.' },
    { id: 'ajah_market', icon: '🧺', name: 'Ajah market', type: 'food', glyph: 'basket', district: 'ajah', x: 38.6, y: 24.6, acts: ['ajah_market', 'ajah_spot', 'ajah_shop'], text: 'Foodstuff, a local spot and your cousin\'s shop.' },
    { id: 'abj_aso', icon: '⛰️', name: 'Aso Rock', type: 'outdoors', glyph: 'tree', district: 'abj_asokoro', x: 21.4, y: 9.4, acts: ['abj_aso'], text: 'The granite rock behind the seat of government. Best at sunset.' },
    { id: 'abj_millennium', icon: '🌳', name: 'Millennium Park', type: 'outdoors', glyph: 'tree', district: 'abj_maitama', x: 15.4, y: 8.2, acts: ['abj_millennium'], text: 'Abuja\'s biggest park, with lawns, a river and picnics.' },
    { id: 'abj_jabi_mall', icon: '🎬', name: 'Jabi Lake Mall', type: 'culture', glyph: 'film', district: 'abj_jabi', x: 7.2, y: 10.0, acts: ['abj_jabi_film'], text: 'Shops, a cinema and a terrace over the lake.' },
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
    { id: 'ph_bole', icon: '🐟', name: 'Bole and fish spot', type: 'food', glyph: 'bowl', district: 'ph_oldgra', x: 13.4, y: 15.8, acts: ['ph_bole'], text: 'Roasted plantain and fish with pepper sauce. A PH classic.' },
    { id: 'ph_isaac', icon: '🌳', name: 'Isaac Boro Park', type: 'outdoors', glyph: 'tree', district: 'ph_oldgra', x: 15.0, y: 14.0, acts: ['ph_isaac', 'ph_oldgra_gig'], text: 'Old trees and quiet paths in the old town.' },
    { id: 'ph_waterfront', icon: '⛵', name: 'Port Harcourt waterfront', type: 'outdoors', glyph: 'wave', district: 'ph_borokiri', x: 16.6, y: 19.6, acts: ['ph_waterfront', 'ph_fish_gig'], text: 'Boats, fishermen and the Bonny River.' },
    { id: 'ojuelegba_park', icon: '🚐', name: 'Ojuelegba danfo park', type: 'transport', glyph: 'bus', district: 'surulere', x: 12.2, y: 16.8, acts: ['suru_danfo'], nogem: true, text: 'Under the bridge, conductors shout routes and danfos fill up. Rent one from the owner for a run to Yaba and back.' }
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
    fan:       { name: 'Standing fan', icon: '🌀', cat: 'Comfort', price: 35000, w: 1, d: 1, h: 10, color: '#d0d4da', shape: 'pole', fx: { stress: -1 }, needsPower: true },
    ac:        { name: 'Split AC', icon: '❄️', cat: 'Comfort', price: 650000, w: 1, d: 1, h: 14, color: '#f2f4f6', shape: 'wallbox', fx: { stress: -3, sleep: 0.06 }, needsPower: true, status: 2 },
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
    umbrella:   { name: 'Umbrella', slot: 'acc', fabric: 'plain', color: '#2f6fa0', price: 4500, tags: ['rain'] }
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
    jet:       { name: 'Private jet', icon: '🛩️', kind: 'jet', price: 45000000000, speed: 0, fuel: 0, upkeep: 60000000, status: 250, color: '#f4f3ec' }
  };

  // Mainland Estate: a grid of house plots north of the Lagoon. Plots marked
  // taken by hash() are lived in already; the rest are for sale, one per player.
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
    ['LEKKI', 33.0, 24.8, 0.9], ['MAINLAND ESTATE', 18.0, 3.7, 0.55], ['AIRPORT', 6.4, 1.9, 0.5],
    ['ABUJA', 19.0, 20.5, 1.2, 'abuja'], ['JABI LAKE', 6.6, 13.6, 0.45, 'abuja'], ['ASO ROCK', 22.6, 7.6, 0.5, 'abuja'], ['AIRPORT', 6.2, 25.6, 0.5, 'abuja'],
    ['PORT HARCOURT', 17.0, 6.0, 1.0, 'ph'], ['BONNY RIVER', 15.0, 23.4, 0.7, 'ph'], ['AIRPORT', 4.2, -0.2, 0.5, 'ph']
  ];

  // Ad boards at high-traffic spots. Players rent them with in-game naira.
  var BILLBOARDS = [
    { id: 'tmb', traffic: 1.8, name: 'Third Mainland Bridge, Yaba end', district: 'yaba', x: 16.3, y: 16.8 },
    { id: 'oshodi', traffic: 1.5, name: 'Oshodi interchange', district: 'oshodi', x: 9.6, y: 9.9 },
    { id: 'allen', traffic: 1.3, name: 'Allen roundabout, Ikeja', district: 'ikeja', x: 10.2, y: 5.4 },
    { id: 'ikorodu_rd', traffic: 0.8, name: 'Ikorodu Road', district: 'ikorodu', x: 23.5, y: 4.3 },
    { id: 'ojuelegba', traffic: 1.1, name: 'Ojuelegba, Surulere', district: 'surulere', x: 12.0, y: 17.3 },
    { id: 'festac_link', traffic: 0.8, name: 'Festac link road', district: 'festac', x: 4.2, y: 16.9 },
    { id: 'marina', traffic: 1.2, name: 'Marina, Lagos Island', district: 'island', x: 16.1, y: 23.5 },
    { id: 'ozumba', traffic: 1.6, name: 'Ozumba Mbadiwe, VI', district: 'vi', x: 20.4, y: 24.2 },
    { id: 'lekki_toll', traffic: 1.7, name: 'Lekki toll gate', district: 'lekki', x: 25.6, y: 22.9 },
    { id: 'ajah_rb', traffic: 0.9, name: 'Ajah roundabout', district: 'ajah', x: 36.7, y: 24.3 }
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
    pos:      { name: 'POS kiosk', price: 150000, daily: 4200, power: false },
    buka:     { name: 'Buka', price: 600000, daily: 15000, power: false },
    barber:   { name: 'Barbershop', price: 900000, daily: 21000, power: true },
    laundry:  { name: 'Laundry', price: 1500000, daily: 33000, power: true },
    danfo:    { name: 'Danfo bus', price: 4000000, daily: 80000, power: false, risky: true },
    event:    { name: 'Event centre', price: 25000000, daily: 420000, power: true, weekend: true },
    shortlet: { name: 'Short-let flat, Lekki', price: 60000000, daily: 900000, power: true, december: 2 }
  };

  // Where you build a business: a payout factor and weekly shop rent.
  var BUSINESS_SITES = {
    ikeja: { mult: 1.1, rent: 15000 }, ikorodu: { mult: 0.85, rent: 4000 }, oshodi: { mult: 1.05, rent: 8000 },
    mushin: { mult: 0.9, rent: 5000 }, festac: { mult: 0.95, rent: 7000 }, surulere: { mult: 1.0, rent: 9000 },
    yaba: { mult: 1.05, rent: 12000 }, island: { mult: 1.1, rent: 14000 }, ikoyi: { mult: 1.2, rent: 35000 },
    vi: { mult: 1.25, rent: 40000 }, lekki: { mult: 1.25, rent: 30000 }, ajah: { mult: 0.95, rent: 8000 }
  };
  // Upgrades: what each business becomes at levels 2 and 3, and its emoji on the map.
  var BUSINESS_GROWTH = {
    pos:      { icon: '🏧', names: ['POS kiosk', 'POS and bill-pay shop', 'Agent banking hub'] },
    buka:     { icon: '🍲', names: ['Buka', 'Restaurant', 'Restaurant chain'] },
    barber:   { icon: '💈', names: ['Barbershop', 'Grooming lounge', 'Salon franchise'] },
    laundry:  { icon: '🧺', names: ['Laundry', 'Dry cleaner', 'Laundry chain'] },
    danfo:    { icon: '🚌', names: ['Danfo bus', 'Danfo fleet', 'Transport company'] },
    event:    { icon: '🎉', names: ['Event centre', 'Banquet hall', 'Events empire'] },
    shortlet: { icon: '🏙️', names: ['Short-let flat, Lekki', 'Short-let block', 'Serviced apartments'] }
  };
  var BUSINESS_LEVEL = { cost: [0, 0.8, 1.6], mult: [1, 1.6, 2.4] };

  var PROPERTIES = {
    iko_plot:  { name: 'Plot of land, Ikorodu', price: 6000000, weekly: 0, house: false },
    iko_house: { name: 'Bungalow, Ikorodu', price: 35000000, weekly: 90000, house: true },
    lekki_terrace: { name: 'Terrace, Lekki', price: 150000000, weekly: 450000, house: true },
    estate_house: { name: 'House in Mainland Estate', price: 12000000, weekly: 0, house: true, plot: true }
  };

  var CAR = { name: 'Tokunbo Corolla', price: 8000000 };

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

  var ORIGINS = {
    lapo: { name: 'LAPO Baby', cash: 8000, home: 'mushin_room', text: 'You start with ₦8,000 and a room in Mushin. A microfinance officer has your number.' },
    mid:  { name: 'Ajepako', cash: 60000, home: 'yaba_selfcon', text: 'Your parents scraped together ₦60,000 and paid for a self-con in Yaba.' },
    nepo: { name: 'Nepo Baby', cash: 800000, home: 'lekki_studio', allowance: 25000, allowanceWeeks: 8, text: 'Daddy paid for a Lekki studio, put ₦800,000 in your account and sends ₦25,000 a week. For now.' }
  };

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  var DATA = {
    DISTRICTS: DISTRICTS, ROADS: ROADS, FERRY_STOPS: FERRY_STOPS, BRT_STOPS: BRT_STOPS,
    OKADA_BAN: OKADA_BAN, MODES: MODES, HOMES: HOMES, HOME_TYPES: HOME_TYPES, SKILLS: SKILLS, SKILL_XP: SKILL_XP,
    CAREERS: CAREERS, PLACE_ACTIONS: PLACE_ACTIONS, HOME_ACTIONS: HOME_ACTIONS, NPCS: NPCS,
    ROOM_SIZES: ROOM_SIZES, FURNITURE: FURNITURE, VEHICLES: VEHICLES, LOOKS: LOOKS, CLOTHES: CLOTHES,
    ESTATE: ESTATE, ROAD_NAMES: ROAD_NAMES, MAJOR_ROADS: MAJOR_ROADS, STREETS: STREETS, AREA_LABELS: AREA_LABELS,
    PLACES: PLACES, PLACE_TYPES: PLACE_TYPES, BILLBOARDS: BILLBOARDS, AD_EMOJI: AD_EMOJI, AD_SLOGANS: AD_SLOGANS, AD_COLORS: AD_COLORS, PSAS: PSAS, BILLBOARD_RENT: BILLBOARD_RENT, AD_PLANS: AD_PLANS, BUSINESSES: BUSINESSES, BUSINESS_SITES: BUSINESS_SITES, BUSINESS_GROWTH: BUSINESS_GROWTH, BUSINESS_LEVEL: BUSINESS_LEVEL, PROPERTIES: PROPERTIES, CAR: CAR, POLICIES: POLICIES, CBN: CBN, CITIES: CITIES, INTERCITY: INTERCITY, GIFTS: GIFTS, QUESTS: QUESTS, STOCKS: STOCKS, PARTIES: PARTIES, PARTY_ACTS: PARTY_ACTS, PLANNER_FACTOR: PLANNER_FACTOR, STAFF: STAFF, STAFF_ROOM: STAFF_ROOM, PETS: PETS, YARD_HOMES: YARD_HOMES, HMO: HMO, SHOP_NICHES: SHOP_NICHES, SHOP_ADS: SHOP_ADS, PHONES: PHONES, TITLES: TITLES, JAPA_DESTS: JAPA_DESTS, WEATHER_MONTHS: WEATHER_MONTHS, HARMATTAN_MONTHS: HARMATTAN_MONTHS,
    GOALS: GOALS, ORIGINS: ORIGINS, MONTHS: MONTHS, DAYS: DAYS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.LASGIDI_DATA = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
