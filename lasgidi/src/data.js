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
    trek:  { name: 'Trek',  speed: 5,  wait: 0,  perKm: 0,   min: 0,    maxKm: 45, road: false, energyPerKm: 4 },
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
      { id: 'yaba_hackathon', label: 'Weekend hackathon', mins: 240, fx: { social: 25, energy: -25, fun: 15 }, xp: { tech: 8 }, special: 'hackathon', when: { days: [5,6], from: 9, to: 18 } }
    ],
    surulere: [
      { id: 'suru_recharge', label: 'Sell recharge cards by the stadium', mins: 180, earn: 2300, fx: { energy: -10, social: 5 }, xp: { hustle: 3 }, gig: true, when: { from: 7, to: 21 } },
      { id: 'suru_market', label: 'Buy foodstuff at the market (7 meals)', mins: 45, cost: 5000, special: 'pantry7', when: { from: 7, to: 19 } },
      { id: 'suru_amala', label: 'Eat amala and ewedu', mins: 45, cost: 1800, fx: { hunger: 55, fun: 5 } },
      { id: 'suru_stadium', label: 'Train at the National Stadium', mins: 90, fx: { energy: -20, fun: 10, hygiene: -25, stress: -10 }, xp: { fitness: 5 }, when: { from: 6, to: 19 } },
      { id: 'suru_studio', label: 'Book studio time', mins: 120, cost: 5000, fx: { fun: 15, energy: -10 }, xp: { music: 6 }, when: { from: 10, to: 23 } },
      { id: 'suru_theatre', label: 'See a play at the National Theatre', mins: 150, cost: 3000, fx: { fun: 35, social: 10, stress: -8 }, xp: { charisma: 1 }, when: { days: [4,5,6], from: 15, to: 22 } },
      { id: 'suru_owambe', label: 'Attend an owambe', mins: 240, cost: 3000, fx: { fun: 40, social: 40, hunger: 60, energy: -20 }, xp: { charisma: 2 }, special: 'owambe', when: { days: [5], from: 12, to: 19 } }
    ],
    ikeja: [
      { id: 'ikeja_cv_learn', label: 'Learn repairs at Computer Village', mins: 120, cost: 1000, fx: { energy: -10 }, xp: { craft: 5 }, when: { days: [0,1,2,3,4,5], from: 9, to: 18 } },
      { id: 'ikeja_cv_gig', label: 'Fix phones for walk-ins', mins: 120, earn: 2600, fx: { energy: -10 }, xp: { craft: 3 }, gig: true, req: { craft: 2 }, when: { from: 9, to: 19 } },
      { id: 'ikeja_cinema', label: 'Watch a film at the mall', mins: 150, cost: 4000, fx: { fun: 40, social: 10, stress: -10 }, when: { from: 11, to: 23 } },
      { id: 'ikeja_ielts', label: 'Sit the IELTS exam', mins: 240, cost: 320000, special: 'ielts_exam', when: { days: [5], from: 8, to: 12 } },
      { id: 'ikeja_super', label: 'Supermarket shop at the mall (7 meals)', mins: 60, cost: 7000, special: 'pantry7', when: { from: 9, to: 21 } },
      { id: 'ikeja_park', label: 'Picnic at Ndubuisi Kanu Park', mins: 90, fx: { fun: 15, social: 10, stress: -12 }, when: { from: 7, to: 19 } },
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
      { id: 'island_alaaru', label: 'Carry loads at Balogun (alaaru)', mins: 180, earn: 2200, fx: { energy: -22, hygiene: -15 }, xp: { hustle: 3, fitness: 1 }, gig: true, when: { days: [0,1,2,3,4,5], from: 7, to: 18 } },
      { id: 'island_freedom', label: 'Live music at Freedom Park', mins: 120, cost: 1000, fx: { fun: 30, social: 20, stress: -10 }, when: { from: 16, to: 23 } },
      { id: 'island_museum', label: 'Visit the National Museum', mins: 90, cost: 500, fx: { fun: 12, stress: -5 }, xp: { charisma: 1 }, when: { days: [0,1,2,3,4,5], from: 9, to: 17 } },
      { id: 'island_ewa', label: 'Ewa agoyin and bread', mins: 30, cost: 1300, fx: { hunger: 45 } }
    ],
    vi: [
      { id: 'vi_carwash', label: 'Wash cars outside the banks', mins: 180, earn: 2800, fx: { energy: -15, hygiene: -10 }, xp: { hustle: 2 }, gig: true, when: { days: [0,1,2,3,4,5], from: 8, to: 18 } },
      { id: 'vi_lounge', label: 'Network at a lounge', mins: 120, cost: 8000, fx: { social: 25, fun: 10 }, xp: { charisma: 5 }, when: { from: 17, to: 24 } },
      { id: 'vi_club', label: 'Club night', mins: 240, cost: 15000, fx: { fun: 60, social: 40, energy: -40, hygiene: -20 }, special: 'club', when: { days: [4,5], from: 21, to: 24 } },
      { id: 'vi_restaurant', label: 'Eat at a restaurant', mins: 60, cost: 12000, fx: { hunger: 60, fun: 15 } },
      { id: 'vi_park', label: 'Relax at Muri Okunola Park', mins: 60, fx: { fun: 10, stress: -10 }, when: { from: 6, to: 20 } },
      { id: 'vi_beach', label: 'Walk Bar Beach at dusk', mins: 60, fx: { fun: 15, stress: -12 }, when: { from: 16, to: 20 } }
    ],
    ikoyi: [
      { id: 'ikoyi_garden', label: 'Tend a madam\'s garden', mins: 180, earn: 3000, fx: { energy: -15, hygiene: -10 }, xp: { craft: 2 }, gig: true, when: { days: [0,1,2,3,4,5], from: 7, to: 17 } },
      { id: 'ikoyi_jog', label: 'Jog around the park', mins: 60, fx: { energy: -12, fun: 10, hygiene: -15, stress: -12 }, xp: { fitness: 3 }, when: { from: 6, to: 19 } },
      { id: 'ikoyi_gallery', label: 'Visit an art gallery', mins: 90, cost: 2000, fx: { fun: 20, social: 10, stress: -8 }, when: { from: 10, to: 18 } },
      { id: 'ikoyi_dine', label: 'Fine dining', mins: 90, cost: 25000, fx: { hunger: 70, fun: 25, social: 10 }, when: { from: 12, to: 23 } }
    ],
    lekki: [
      { id: 'lekki_errands', label: 'Run errands in the estate', mins: 120, earn: 2200, fx: { energy: -10 }, xp: { hustle: 2, charisma: 1 }, gig: true, when: { from: 8, to: 20 } },
      { id: 'lekki_beach', label: 'Beach day', mins: 180, cost: 2000, fx: { fun: 45, social: 20, hygiene: -15, stress: -15 }, when: { from: 9, to: 18 } },
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
    { id: 'kanu_park', icon: '🌳', name: 'Ndubuisi Kanu Park', type: 'outdoors', glyph: 'tree', district: 'ikeja', x: 10.7, y: 3.1, acts: ['ikeja_park'], text: 'Green lawns in Alausa, busy with picnics at weekends.' },
    { id: 'ielts', icon: '📝', name: 'IELTS test centre', type: 'learn', glyph: 'cap', district: 'ikeja', x: 9.3, y: 4.9, acts: ['ikeja_ielts'], text: 'Saturday morning sittings. The first step to Japa.' },
    { id: 'allen', icon: '🍢', name: 'Allen Avenue suya spots', type: 'food', glyph: 'bowl', district: 'ikeja', x: 11.3, y: 4.0, acts: ['ikeja_suya'], text: 'Smoky suya after dark.' },
    { id: 'airport', icon: '✈️', name: 'Murtala Muhammed Airport', type: 'transport', glyph: 'plane', district: 'ikeja', x: 6.6, y: 0.9, acts: [], text: 'International flights. Not in this game yet: you need IELTS and proof of funds first.' },
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
    { id: 'stadium', icon: '🏟️', name: 'National Stadium', type: 'outdoors', glyph: 'ball', district: 'surulere', x: 9.2, y: 16.6, acts: ['suru_stadium', 'suru_recharge'], text: 'Run the tracks for free. Sell recharge cards to the crowd.' },
    { id: 'theatre', icon: '🎭', name: 'National Theatre', type: 'culture', glyph: 'mask', district: 'surulere', x: 11.4, y: 18.9, acts: ['suru_theatre'], text: 'The famous military-cap building at Iganmu. Plays Friday to Sunday.' },
    { id: 'studio', icon: '🎙️', name: 'Recording studio', type: 'learn', glyph: 'note', district: 'surulere', x: 10.6, y: 17.4, acts: ['suru_studio'], text: 'Where Afrobeats careers start.' },
    { id: 'owambe_hall', icon: '🎉', name: 'Event hall', type: 'nightlife', glyph: 'note', district: 'surulere', x: 9.5, y: 18.6, acts: ['suru_owambe'], text: 'Saturday owambes: jollof, small chops, money spraying.' },
    { id: 'amala', icon: '🍲', name: 'Amala joint', type: 'food', glyph: 'bowl', district: 'surulere', x: 10.4, y: 18.7, acts: ['suru_amala'], text: 'Amala, ewedu and gbegiri, eaten with your hand.' },
    { id: 'unilag', icon: '🎓', name: 'University of Lagos', type: 'learn', glyph: 'cap', district: 'yaba', x: 15.6, y: 16.1, acts: ['yaba_enrol', 'yaba_lecture'], text: 'Part-time degrees on weekdays. 30 lectures to graduate.' },
    { id: 'hub', icon: '💻', name: 'Yaba tech hub', type: 'learn', glyph: 'laptop', district: 'yaba', x: 14.5, y: 14.6, acts: ['yaba_hackathon', 'yaba_typing'], text: 'Weekend hackathons and freelance typing gigs.' },
    { id: 'library', icon: '📚', name: 'Yaba library', type: 'learn', glyph: 'cap', district: 'yaba', x: 15.5, y: 14.4, acts: ['yaba_library', 'yaba_ielts'], text: 'Quiet study, and IELTS prep classes.' },
    { id: 'tejuosho', icon: '🛍️', name: 'Tejuosho market', type: 'food', glyph: 'basket', district: 'yaba', x: 14.4, y: 15.5, acts: ['yaba_tejuosho', 'yaba_buka'], text: 'Fabric, foodstuff and a busy buka.' },
    { id: 'balogun', icon: '🛍️', name: 'Balogun market', type: 'food', glyph: 'basket', district: 'island', x: 15.6, y: 21.6, acts: ['island_balogun', 'island_alaaru'], text: 'The biggest market on the Island. Haggle, or carry loads for cash.' },
    { id: 'freedom', icon: '🎶', name: 'Freedom Park', type: 'culture', glyph: 'note', district: 'island', x: 16.4, y: 22.6, acts: ['island_freedom'], text: 'A former colonial prison turned open-air arts venue. Live music in the evenings.' },
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
    { id: 'bar_beach', icon: '🏖️', name: 'Bar Beach', type: 'outdoors', glyph: 'wave', district: 'vi', x: 19.5, y: 26.1, acts: ['vi_beach'], text: 'Atlantic breeze at dusk.' },
    { id: 'muri_park', icon: '🌴', name: 'Muri Okunola Park', type: 'outdoors', glyph: 'tree', district: 'vi', x: 18.3, y: 25.4, acts: ['vi_park'], text: 'A green pocket among the towers.' },
    { id: 'vi_food', icon: '🍽️', name: 'VI restaurants', type: 'food', glyph: 'bowl', district: 'vi', x: 19.9, y: 25.2, acts: ['vi_restaurant'], text: 'Continental, Asian and very expensive jollof.' },
    { id: 'banks', icon: '🏦', name: 'Bank headquarters', type: 'services', glyph: 'naira', district: 'vi', x: 18.9, y: 25.7, acts: ['vi_carwash'], text: 'Where bankers work. Wash cars outside for cash. Deposits are on the Money tab.' },
    { id: 'lekki_beach', icon: '🏖️', name: 'Lekki beach', type: 'outdoors', glyph: 'wave', district: 'lekki', x: 28.4, y: 25.7, acts: ['lekki_beach', 'lekki_content'], text: 'Weekend crowds, horses and content shoots.' },
    { id: 'lcc', icon: '🐒', name: 'Lekki Conservation Centre', type: 'outdoors', glyph: 'tree', district: 'lekki', x: 26.6, y: 24.2, acts: ['lekki_lcc'], text: 'Monkeys, mangroves and a long canopy walkway.' },
    { id: 'lekki_gym', icon: '🏋️', name: 'Lekki gym', type: 'outdoors', glyph: 'dumbbell', district: 'lekki', x: 28.7, y: 23.6, acts: ['lekki_gym'], text: 'Classes all day. Zainab trains here.' },
    { id: 'lekki_cafe', icon: '☕', name: 'Lekki cafés', type: 'food', glyph: 'bowl', district: 'lekki', x: 27.6, y: 23.7, acts: ['lekki_cafe', 'lekki_super', 'lekki_errands'], text: 'Brunch, a supermarket and errands for estate residents.' },
    { id: 'ajah_market', icon: '🧺', name: 'Ajah market', type: 'food', glyph: 'basket', district: 'ajah', x: 38.6, y: 24.6, acts: ['ajah_market', 'ajah_spot', 'ajah_shop'], text: 'Foodstuff, a local spot and your cousin\'s shop.' }
  ];

  // Ad boards at high-traffic spots. Players rent them with in-game naira.
  var BILLBOARDS = [
    { id: 'tmb', name: 'Third Mainland Bridge, Yaba end', district: 'yaba', x: 16.3, y: 16.8 },
    { id: 'oshodi', name: 'Oshodi interchange', district: 'oshodi', x: 9.6, y: 9.9 },
    { id: 'allen', name: 'Allen roundabout, Ikeja', district: 'ikeja', x: 10.2, y: 5.4 },
    { id: 'ikorodu_rd', name: 'Ikorodu Road', district: 'ikorodu', x: 23.5, y: 4.3 },
    { id: 'ojuelegba', name: 'Ojuelegba, Surulere', district: 'surulere', x: 12.0, y: 17.3 },
    { id: 'festac_link', name: 'Festac link road', district: 'festac', x: 4.2, y: 16.9 },
    { id: 'marina', name: 'Marina, Lagos Island', district: 'island', x: 16.1, y: 23.5 },
    { id: 'ozumba', name: 'Ozumba Mbadiwe, VI', district: 'vi', x: 20.4, y: 24.2 },
    { id: 'lekki_toll', name: 'Lekki toll gate', district: 'lekki', x: 25.6, y: 22.9 },
    { id: 'ajah_rb', name: 'Ajah roundabout', district: 'ajah', x: 36.7, y: 24.3 }
  ];
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
    PLACES: PLACES, PLACE_TYPES: PLACE_TYPES, BILLBOARDS: BILLBOARDS, AD_EMOJI: AD_EMOJI, AD_SLOGANS: AD_SLOGANS, AD_COLORS: AD_COLORS, PSAS: PSAS, BILLBOARD_RENT: BILLBOARD_RENT, BUSINESSES: BUSINESSES, PROPERTIES: PROPERTIES, CAR: CAR, POLICIES: POLICIES,
    GOALS: GOALS, ORIGINS: ORIGINS, MONTHS: MONTHS, DAYS: DAYS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.LASGIDI_DATA = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
