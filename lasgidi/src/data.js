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
    ajah:    { name: 'Ajah',         x: 38, y: 25, side: 'island',   blurb: 'Island address, mainland rent, long commute.' }
  };

  // Drawn on the map only; travel uses straight-line distance x 1.3.
  var ROADS = [
    ['ikeja', 'oshodi'], ['oshodi', 'mushin'], ['mushin', 'surulere'], ['mushin', 'yaba'],
    ['surulere', 'festac'], ['surulere', 'yaba'], ['yaba', 'island'], ['ikeja', 'ikorodu'],
    ['oshodi', 'festac'], ['island', 'ikoyi'], ['ikoyi', 'vi'], ['island', 'vi'],
    ['ikoyi', 'lekki'], ['vi', 'lekki'], ['lekki', 'ajah'], ['ikorodu', 'yaba']
  ];
  var FERRY_STOPS = ['ikorodu', 'island', 'ikoyi', 'lekki'];
  var BRT_STOPS = ['ikorodu', 'ikeja', 'oshodi', 'yaba', 'island'];
  // 2022 commercial okada ban LGAs, mapped onto our districts.
  var OKADA_BAN = ['ikeja', 'surulere', 'yaba', 'island', 'ikoyi', 'vi', 'lekki'];

  var MODES = {
    trek:  { name: 'Trek',  speed: 5,  wait: 0,  perKm: 0,   min: 0,    maxKm: 12, road: false, energyPerKm: 4 },
    keke:  { name: 'Keke',  speed: 20, wait: 5,  perKm: 90,  min: 200,  maxKm: 8,  road: true,  noBridge: true },
    okada: { name: 'Okada', speed: 30, wait: 3,  perKm: 150, min: 300,  maxKm: 20, road: true,  weave: 0.35 },
    danfo: { name: 'Danfo', speed: 26, wait: 10, perKm: 60,  min: 300,  maxKm: 99, road: true,  stress: 6 },
    brt:   { name: 'BRT',   speed: 30, wait: 15, perKm: 40,  min: 400,  maxKm: 99, road: true,  weave: 0.3, stops: 'brt' },
    ferry: { name: 'Ferry', speed: 24, wait: 20, perKm: 0,   min: 1500, maxKm: 99, road: false, stops: 'ferry' },
    cab:   { name: 'Cab',   speed: 32, wait: 8,  perKm: 350, min: 1500, maxKm: 99, road: true },
    car:   { name: 'Own car', speed: 32, wait: 0, perKm: 120, min: 0,   maxKm: 99, road: true, needsCar: true }
  };

  // Weekly rent. Move-in costs 4 weeks upfront + 10% agent fee (Lagos style).
  var HOMES = {
    squat:    { name: "Squatting with a friend", district: 'mushin', rent: 0, power: 0.3, sleep: 0.6, hidden: true },
    ikorodu_room: { name: 'Room in Ikorodu', district: 'ikorodu', rent: 2000, power: 0.4, sleep: 0.85 },
    mushin_room:  { name: 'Face-me-I-face-you, Mushin', district: 'mushin', rent: 2500, power: 0.35, sleep: 0.8 },
    yaba_selfcon: { name: 'Self-con, Yaba', district: 'yaba', rent: 7000, power: 0.5, sleep: 0.9 },
    festac_flat:  { name: 'Mini-flat, Festac', district: 'festac', rent: 9000, power: 0.55, sleep: 0.95 },
    suru_flat:    { name: 'Mini-flat, Surulere', district: 'surulere', rent: 12000, power: 0.55, sleep: 0.95 },
    ajah_2bed:    { name: '2-bed, Ajah', district: 'ajah', rent: 18000, power: 0.6, sleep: 1 },
    lekki_studio: { name: 'Studio, Lekki Phase 1', district: 'lekki', rent: 40000, power: 0.75, sleep: 1 },
    ikoyi_apt:    { name: 'Serviced flat, Ikoyi', district: 'ikoyi', rent: 150000, power: 0.95, sleep: 1.1 }
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
    fitness:  { name: 'Fitness', district: 'lekki', skill: 'fitness', start: 6, end: 12, days: [0,1,2,3,4,5],
      titles: ['Gym Assistant', 'Trainer', 'Head Coach', 'Gym Owner', 'Fitness Icon'],
      pay: [5000, 8000, 13500, 24000, 45000], req: [1, 3, 5, 7, 9] }
  };

  // Effects: needs deltas (hunger, energy, fun, social, hygiene, stress), xp, earn, cost.
  // when: {days:[...], from:h, to:h} — action allowed only then.
  var PLACE_ACTIONS = {
    mushin: [
      { id: 'mushin_mamaput', label: 'Eat at Mama Put', mins: 30, cost: 1200, fx: { hunger: 45 } },
      { id: 'mushin_barber', label: 'Gist at the barbershop', mins: 60, fx: { social: 20, fun: 5 }, xp: { charisma: 2 } },
      { id: 'mushin_water', label: 'Sell pure water in go-slow', mins: 120, earn: 1800, fx: { energy: -15, hygiene: -10 }, xp: { hustle: 3 }, gig: true, when: { from: 7, to: 20 } },
      { id: 'mushin_football', label: 'Street football', mins: 60, fx: { fun: 25, energy: -15, hygiene: -20, stress: -8 }, xp: { fitness: 3 }, when: { from: 6, to: 19 } }
    ],
    yaba: [
      { id: 'yaba_buka', label: 'Eat at a Yaba buka', mins: 30, cost: 1500, fx: { hunger: 45 } },
      { id: 'yaba_library', label: 'Study at the library', mins: 120, cost: 500, fx: { energy: -10, fun: -5 }, xp: { tech: 4 }, when: { from: 8, to: 20 } },
      { id: 'yaba_enrol', label: 'Enrol at UNILAG (part-time)', mins: 60, cost: 150000, special: 'enrol' },
      { id: 'yaba_lecture', label: 'Attend lectures', mins: 180, fx: { energy: -15, fun: -5 }, xp: { tech: 2, charisma: 1 }, special: 'lecture', when: { days: [0,1,2,3,4], from: 8, to: 17 } },
      { id: 'yaba_ielts', label: 'IELTS prep class', mins: 120, cost: 3000, fx: { energy: -10 }, xp: { charisma: 2 }, special: 'ielts_prep', when: { from: 9, to: 19 } },
      { id: 'yaba_hackathon', label: 'Weekend hackathon', mins: 240, fx: { social: 25, energy: -25, fun: 15 }, xp: { tech: 8 }, special: 'hackathon', when: { days: [5,6], from: 9, to: 18 } }
    ],
    surulere: [
      { id: 'suru_amala', label: 'Eat amala and ewedu', mins: 45, cost: 1800, fx: { hunger: 55, fun: 5 } },
      { id: 'suru_stadium', label: 'Train at the National Stadium', mins: 90, fx: { energy: -20, fun: 10, hygiene: -25, stress: -10 }, xp: { fitness: 5 }, when: { from: 6, to: 19 } },
      { id: 'suru_studio', label: 'Book studio time', mins: 120, cost: 5000, fx: { fun: 15, energy: -10 }, xp: { music: 6 }, when: { from: 10, to: 23 } },
      { id: 'suru_owambe', label: 'Attend an owambe', mins: 240, cost: 3000, fx: { fun: 40, social: 40, hunger: 60, energy: -20 }, xp: { charisma: 2 }, special: 'owambe', when: { days: [5], from: 12, to: 19 } }
    ],
    ikeja: [
      { id: 'ikeja_cv_learn', label: 'Learn repairs at Computer Village', mins: 120, cost: 1000, fx: { energy: -10 }, xp: { craft: 5 }, when: { days: [0,1,2,3,4,5], from: 9, to: 18 } },
      { id: 'ikeja_cv_gig', label: 'Fix phones for walk-ins', mins: 120, earn: 2600, fx: { energy: -10 }, xp: { craft: 3 }, gig: true, req: { craft: 2 }, when: { from: 9, to: 19 } },
      { id: 'ikeja_cinema', label: 'Watch a film at the mall', mins: 150, cost: 4000, fx: { fun: 40, social: 10, stress: -10 }, when: { from: 11, to: 23 } },
      { id: 'ikeja_ielts', label: 'Sit the IELTS exam', mins: 240, cost: 320000, special: 'ielts_exam', when: { days: [5], from: 8, to: 12 } },
      { id: 'ikeja_suya', label: 'Suya by the roadside', mins: 30, cost: 1500, fx: { hunger: 35, fun: 5 }, when: { from: 17, to: 24 } }
    ],
    oshodi: [
      { id: 'oshodi_hawk', label: 'Hawk in traffic', mins: 180, earn: 2800, fx: { energy: -20, hygiene: -15, stress: 6 }, xp: { hustle: 4 }, gig: true, when: { from: 6, to: 21 } },
      { id: 'oshodi_market', label: 'Buy foodstuff (7 meals)', mins: 60, cost: 4500, special: 'pantry7' },
      { id: 'oshodi_bukka', label: 'Eat at a bukka', mins: 30, cost: 1000, fx: { hunger: 40 } }
    ],
    island: [
      { id: 'island_balogun', label: 'Haggle at Balogun market', mins: 60, fx: { fun: 5, energy: -5 }, xp: { hustle: 3, charisma: 1 }, when: { days: [0,1,2,3,4,5], from: 8, to: 18 } },
      { id: 'island_worship', label: 'Worship at church or mosque', mins: 90, fx: { stress: -25, social: 15 } },
      { id: 'island_checkup', label: 'Check-up at General Hospital', mins: 120, cost: 8000, fx: { stress: -10, energy: 10 } },
      { id: 'island_welfare', label: 'Free meal at the church or mosque welfare', mins: 60, fx: { hunger: 40, stress: 5 }, special: 'welfare', when: { from: 7, to: 19 } },
      { id: 'island_ewa', label: 'Ewa agoyin and bread', mins: 30, cost: 1300, fx: { hunger: 45 } }
    ],
    vi: [
      { id: 'vi_lounge', label: 'Network at a lounge', mins: 120, cost: 8000, fx: { social: 25, fun: 10 }, xp: { charisma: 5 }, when: { from: 17, to: 24 } },
      { id: 'vi_club', label: 'Club night', mins: 240, cost: 15000, fx: { fun: 60, social: 40, energy: -40, hygiene: -20 }, special: 'club', when: { days: [4,5], from: 21, to: 24 } },
      { id: 'vi_restaurant', label: 'Eat at a restaurant', mins: 60, cost: 12000, fx: { hunger: 60, fun: 15 } },
      { id: 'vi_beach', label: 'Walk Bar Beach at dusk', mins: 60, fx: { fun: 15, stress: -12 }, when: { from: 16, to: 20 } }
    ],
    ikoyi: [
      { id: 'ikoyi_jog', label: 'Jog around the park', mins: 60, fx: { energy: -12, fun: 10, hygiene: -15, stress: -12 }, xp: { fitness: 3 }, when: { from: 6, to: 19 } },
      { id: 'ikoyi_gallery', label: 'Visit an art gallery', mins: 90, cost: 2000, fx: { fun: 20, social: 10, stress: -8 }, when: { from: 10, to: 18 } },
      { id: 'ikoyi_dine', label: 'Fine dining', mins: 90, cost: 25000, fx: { hunger: 70, fun: 25, social: 10 }, when: { from: 12, to: 23 } }
    ],
    lekki: [
      { id: 'lekki_beach', label: 'Beach day', mins: 180, cost: 2000, fx: { fun: 45, social: 20, hygiene: -15, stress: -15 }, when: { from: 9, to: 18 } },
      { id: 'lekki_gym', label: 'Gym class', mins: 90, cost: 3000, fx: { energy: -18, hygiene: -20, stress: -10 }, xp: { fitness: 6 }, when: { from: 6, to: 21 } },
      { id: 'lekki_content', label: 'Shoot content', mins: 120, fx: { fun: 10, energy: -8 }, xp: { charisma: 3, music: 1 }, special: 'content', when: { from: 8, to: 20 } },
      { id: 'lekki_cafe', label: 'Brunch at a café', mins: 60, cost: 6000, fx: { hunger: 50, fun: 10 } }
    ],
    ajah: [
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
      { id: 'festac_eat', label: 'Eat at a Festac buka', mins: 30, cost: 1300, fx: { hunger: 45 } }
    ]
  };

  var HOME_ACTIONS = [
    { id: 'home_sleep', label: 'Sleep (8h)', mins: 480, special: 'sleep' },
    { id: 'home_nap', label: 'Nap (2h)', mins: 120, special: 'nap' },
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

  var PROPERTIES = {
    iko_plot:  { name: 'Plot of land, Ikorodu', price: 6000000, weekly: 0, house: false },
    iko_house: { name: 'Bungalow, Ikorodu', price: 35000000, weekly: 90000, house: true },
    lekki_terrace: { name: 'Terrace, Lekki', price: 150000000, weekly: 450000, house: true }
  };

  var CAR = { name: 'Tokunbo Corolla', price: 8000000 };

  var POLICIES = {
    fares:   { name: 'Transport fare subsidy', text: 'All fares 20% cheaper.' },
    okada:   { name: 'Okada ban expansion', text: 'Okada banned in every district except Mushin, Oshodi, Festac, Ikorodu and Ajah.' },
    tenancy: { name: 'Tenancy reform', text: 'No rent increases. Move-in fees halved.' },
    power:   { name: 'Power levy', text: '₦1,000 weekly levy. Light is far more steady everywhere.' }
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
    OKADA_BAN: OKADA_BAN, MODES: MODES, HOMES: HOMES, SKILLS: SKILLS, SKILL_XP: SKILL_XP,
    CAREERS: CAREERS, PLACE_ACTIONS: PLACE_ACTIONS, HOME_ACTIONS: HOME_ACTIONS, NPCS: NPCS,
    BUSINESSES: BUSINESSES, PROPERTIES: PROPERTIES, CAR: CAR, POLICIES: POLICIES,
    GOALS: GOALS, ORIGINS: ORIGINS, MONTHS: MONTHS, DAYS: DAYS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.LASGIDI_DATA = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
