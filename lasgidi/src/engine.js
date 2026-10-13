/* Lasgidi — game engine. Pure functions over a plain JSON state object.
 * No DOM access here, so the whole game runs (and is tested) under Node.
 *
 * Design rules that answer the problems seen in Lagos Life:
 *  - Every naira moves through post(), which writes a hash-chained ledger
 *    line. No other code touches cash or bank directly.
 *  - Money is whole naira (integers). No floats, no rounding drift.
 *  - All randomness comes from a seeded PRNG stored in the state, so a save
 *    plus its action log can be replayed and verified.
 *  - Money has sinks (inflation, rent, upkeep, neglect, fines, fraud) so the
 *    economy cannot inflate to "everyone is a billionaire". */
(function (root) {
  'use strict';

  var D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.LASGIDI_DATA;

  var NEEDS = ['hunger', 'energy', 'fun', 'social', 'hygiene'];
  var DECAY = { hunger: 4.5, energy: 4, fun: 3, social: 2.5, hygiene: 3 }; // per hour awake
  var STEP = 15;           // minutes per simulation step
  var START_MONTH = 9;     // October, so Detty December arrives in week 9
  var BANK_RATE = 0.003;   // weekly savings interest
  var BOND_RATE = 0.01;    // a 7-day treasury bill pays 1% at maturity
  var BOND_DAYS = 7;
  var LEDGER_KEEP = 300;
  var LOG_KEEP = 80;
  var VERSION = 1;        // save-code format
  var SCHEMA = 12;         // state shape; migrate() upgrades older saves
  // Game RULES version. A life plays by the rules it started under, so a
  // recorded life replays identically after later updates add new systems.
  // 5 = v0.5 rules; 6 adds love and family; 7 adds the CBN governor race,
  // PAYE and levies; 8 is harder still (steeper PAYE, rent reviews, luxury
  // upkeep and insurance, slower promotions).
  // 9 adds weather; 10 charges mini-games when they start, so quitting forfeits;
  // 11 adds malaria (nights without light or a net can give you a fever);
  // 12 adds car wear and breakdowns (service at Ladipo);
  // 13 adds job interviews for the degree careers (a connect still gets you in);
  // 14 adds the full Detty December: December rates, traffic, IJGB relatives, a hustle boom.
  var RULES = 14;

  var LOANS = {
    lapo: { name: 'Microfinance loan', rate: 0.04, weeks: 8, max: 50000 },
    app:  { name: 'QuickCash loan app', rate: 0.12, weeks: 4, max: 100000 },
    coop: { name: 'Staff cooperative loan', rate: 0.02, weeks: 12, max: 0 }
  };

  var AJO_SIZES = [2000, 5000, 10000, 50000];
  var AJO_MEMBERS = 6;

  var ACHIEVEMENTS = {
    first_pay:   'First alert: got paid for a shift',
    millionaire: 'Millionaire: ₦1m net worth',
    sharp:       'Sharp guy: ignored a scam text',
    ponzi_burn:  'Lesson learnt: lost money to a Ponzi',
    ponzi_win:   'Lucky escape: a Ponzi actually paid out',
    commuter:    'Commuter: 50 trips across Lagos',
    ferry:       'Water way: took the ferry',
    punctual:    'Never late: 10 on-time shifts',
    evicted:     'Quit notice: got evicted',
    connected:   'Connected: a friend at 80+',
    graduate:    'Graduate: earned your degree',
    landlord:    'Landlord: own a house',
    ajo:         'Esusu complete: finished an ajo cycle',
    viral:       'Viral: your content blew up',
    detty:       'Survived Detty December',
    promoted:    'Promoted at work',
    traveller:   'Travelled to another city',
    first_class: 'First class: flew in a private suite',
    private_jet: 'Wheels up: flew private',
    chopper:     'Straight to the door: took a VIP chopper',
    members_club: 'Members only: joined a waterfront club',
    hyde_park:   'Lagoon living: a home in Lekki Hyde Park',
    white_wedding: 'White wedding: church, reception and after-party',
    cruise:      'All aboard: took the Lagoon Boat Cruise',
    gifted:      'Received a gift from another Lagosian',
    gems:        'Found all five of a day\'s gems',
    debt_free:   'Debt free: cleared every loan',
    top:         'Top of the ladder in a career',
    wedding:     'Wedding bells: got married',
    parent:      'Proud parent: welcomed a child',
    billboard:   'On the billboard: rented an ad board',
    investor:    'Investor: bought shares on the exchange',
    host:        'Owambe host: threw a party at home',
    streak7:     'Seven-day streak',
    oga:         'Oga at the top: hired domestic staff',
    pet:         'Best friend: adopted a pet',
    chief:       'Chieftaincy: took a title',
    danfo:       'Agbero approved: served 50 danfo passengers',
    japa:        'Japa: left Nigeria for a new life abroad',
    seaplot:     'Sea Plots: own a block in the water',
    dancer:      'Dance-off champion: 90% on the beat',
    quiz:        'Quiz champion: 10 out of 10',
    vendor:      'Online vendor: sold 100 items',
    corper:      'Corper wee! Finished your NYSC service year',
    scholar:     'Straight A: a child brought home an A',
    dynasty:     'Dynasty: the third generation of your family in Lagos',
    builder:     'Builder: built your own house, block by block',
    detty_legend: 'Detty legend: six December events in one season',
    streamer:    'Streamer: 1,000 people watched you live',
    allrounder:  'All-rounder: played 8 different sports in Lagos',
    explorer:    'Lagos explorer: visited 8 tourist sights',
    banana:      'Banana Island: bought a waterfront mansion'
  };

  /* ---------- small helpers ---------- */

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function roundTo(v, step) { return Math.round(v / step) * step; }
  function ceilTo(v, step) { return Math.ceil(v / step) * step; }

  // mulberry32, state kept in s.rng so saves are deterministic.
  function rand(s) {
    s.rng = (s.rng + 0x6D2B79F5) | 0;
    var t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function pick(s, arr) { return arr[Math.floor(rand(s) * arr.length)]; }

  function fnv(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  function naira(n) {
    var neg = n < 0;
    var s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-₦' : '₦') + s;
  }

  /* ---------- clock ---------- */

  function day(s) { return Math.floor(s.t / 1440); }
  function dow(s) { return day(s) % 7; }
  function minuteOfDay(s) { return s.t % 1440; }
  function hour(s) { return Math.floor(minuteOfDay(s) / 60); }
  function week(s) { return Math.floor(day(s) / 7); }
  function monthIndex(s) { return (START_MONTH + Math.floor(week(s) / 4)) % 12; }
  function isDecember(s) { return monthIndex(s) === 11; }
  function isRainy(s) { var m = monthIndex(s); return m >= 3 && m <= 9; }

  function clockLabel(s) {
    var m = minuteOfDay(s);
    var hh = String(Math.floor(m / 60)).padStart(2, '0');
    var mm = String(m % 60).padStart(2, '0');
    return D.DAYS[dow(s)] + ' ' + hh + ':' + mm;
  }
  function dateLabel(s) {
    return 'Week ' + (week(s) + 1) + ' · ' + D.MONTHS[monthIndex(s)];
  }

  /* ---------- logging & money ---------- */

  function log(s, text, kind) {
    s.log.unshift({ t: s.t, text: text, kind: kind || 'info' });
    if (s.log.length > LOG_KEEP) s.log.length = LOG_KEEP;
  }

  // The only function that changes cash or bank.
  function post(s, acct, amt, memo) {
    if (amt !== Math.round(amt)) throw new Error('Non-integer amount: ' + amt);
    if (acct !== 'cash' && acct !== 'bank') throw new Error('Unknown account ' + acct);
    if (amt === 0) return;
    s[acct] += amt;
    if (s[acct] < 0) throw new Error('Overdraft on ' + acct + ' (' + memo + ')');
    var line = { t: s.t, acct: acct, amt: amt, bal: s[acct], memo: memo };
    s.ledgerHash = fnv(s.ledgerHash + '|' + line.t + '|' + acct + '|' + amt + '|' + memo);
    line.h = s.ledgerHash;
    s.ledger.unshift(line);
    if (s.ledger.length > LEDGER_KEEP) s.ledger.length = LEDGER_KEEP;
    s.ledgerCount++;
    s.ledgerSum[acct] += amt;
    if (memo !== 'Transfer') {
      var cat = category(memo, amt), side = amt > 0 ? 'inc' : 'out';
      s.wk[side][cat] = (s.wk[side][cat] || 0) + Math.abs(amt);
    }
    if (amt > 0 && memo !== 'Transfer') s.stats.earned += amt;
    if (amt < 0 && memo !== 'Transfer') s.stats.spent -= amt;
    s.alerts.push({ amt: amt, memo: memo, acct: acct });
    if (s.alerts.length > 6) s.alerts.shift();
  }

  // Spending and income categories for the weekly report.
  var FOOD_LABELS = {}, GIG_LABELS = {};
  [D.HOME_ACTIONS].concat(Object.keys(D.PLACE_ACTIONS).map(function (k) { return D.PLACE_ACTIONS[k]; })).forEach(function (list) {
    list.forEach(function (a) {
      if ((a.fx && a.fx.hunger > 0) || a.special === 'pantry7') FOOD_LABELS[a.label] = true;
      if (a.gig) GIG_LABELS[a.label] = true;
    });
  });
  var CATEGORY_NAMES = {
    wages: 'Wages', gigs: 'Gigs and side hustles', business: 'Business and property', savings: 'Ajo, loans and interest',
    family: 'Family', housing: 'Rent and housing', food: 'Food', transport: 'Transport', losses: 'Fines, scams and theft',
    health: 'Health', lifestyle: 'Fun and lifestyle', tax: 'Tax and levies', other: 'Other'
  };
  function category(memo, amt) {
    var m = memo.replace(/ \(incl\. gen fuel\)$/, '');
    if (/^(PAYE income tax|Business levies)/.test(m)) return 'tax';
    if (/^Shift pay/.test(m)) return 'wages';
    if (GIG_LABELS[m] || /^(Brand deal|Hackathon prize|Gem hunt|Ride-hail fares|Danfo fares|Daily streak|Quest:|Party: guests|Dance-off: guests|Hawking sales|Bole grill share|Quiz show prize)/.test(m)) return 'gigs';
    if (/^(Rent|Move-in|Staff:)/.test(m)) return 'housing';
    if (FOOD_LABELS[m] || m === 'Aso-ebi') return 'food';
    if (/ to [A-Z]/.test(m) && /^(Trek|Keke|Okada|Danfo|BRT|Ferry|Cab|Own car|Flight|Long-distance bus)/.test(m) || /^(Car maintenance|Ride-hail fuel)/.test(m)) return 'transport';
    if (/snatched|Unauthorised|Taken by|CryptoDoubla|Owo ijoko|fine|settlement|Power levy/i.test(m)) return 'losses';
    if (/Business|^Bought|^Sold|Tenant rent|^Shop rent|^Manager salary|^Shop |^Dispatch|^Sea Plots|^Danfo (owner|fuel|repairs|returns)|^Hawking stock/.test(m)) return 'business';
    if (/Ajo|loan|Repay|Overdue|Cooperative|interest|Microfinance|QuickCash|Treasury bill|^Shares|^Dividend|Broker/i.test(m)) return 'savings';
    if (/^NYSC (allawee|PPA)/.test(m)) return 'wages';
    if (/^Lodging: /.test(m)) return 'housing';
    if (m === 'Family outing') return 'family';
    if (/^Chemist/.test(m)) return 'health';
    if (/^(Ladipo|Roadside mechanic)/.test(m)) return 'transport';
    if (/^(Building: |Omo-onile|Estate service charge)/.test(m)) return 'housing';
    if (/^IJGB gift/.test(m)) return 'family';
    if (/^Ground money/.test(m)) return 'losses';
    if (/^(Live stream gifts|Event appearance fee|Prize: )/.test(m)) return 'gigs';
    if (/^Data for a live/.test(m)) return 'lifestyle';
    if (/IJGB/.test(m)) return 'lifestyle';
    if (/Allowance|Aunty/.test(m)) return 'family';
    if (/Hospital|Check-up|HMO/.test(m)) return 'health';
    if (/^(Chieftaincy|Party: |Phone: |Pet)/.test(m)) return 'lifestyle';
    if (/^Japa/.test(m)) return 'transport';
    return amt < 0 ? 'lifestyle' : 'other';
  }

  function canAfford(s, amount) { return s.cash + s.bank >= amount; }

  // Pay from cash first, then bank (POS/transfer). Returns false if short.
  function pay(s, amount, memo) {
    amount = Math.round(amount);
    if (amount <= 0) return true;
    if (!canAfford(s, amount)) return false;
    var fromCash = Math.min(s.cash, amount);
    if (fromCash > 0) post(s, 'cash', -fromCash, memo);
    if (amount - fromCash > 0) post(s, 'bank', -(amount - fromCash), memo);
    return true;
  }
  // Take as much as possible; return what was actually taken.
  function payPartial(s, amount, memo) {
    var take = Math.min(amount, s.cash + s.bank);
    pay(s, take, memo);
    return take;
  }
  function earn(s, amount, memo) { post(s, 'cash', Math.round(amount), memo); }

  function priceFactor(s) {
    var f = s.econ.infl;
    if (isDecember(s)) f *= 1.15;
    return f;
  }
  function price(s, base) {
    if (!base) return 0;
    var v = base * priceFactor(s);
    return v >= 1000 ? roundTo(v, 50) : roundTo(v, 10);
  }

  /* ---------- skills & needs ---------- */

  function skillLevel(s, k) {
    var xp = s.skills[k] || 0, lvl = 0;
    for (var i = 0; i < D.SKILL_XP.length; i++) if (xp >= D.SKILL_XP[i]) lvl = i;
    return lvl;
  }
  function addXp(s, xp) {
    if (!xp) return;
    Object.keys(xp).forEach(function (k) {
      var before = skillLevel(s, k);
      // Learning is slower when exhausted or stressed.
      var mult = (s.needs.energy < 20 ? 0.5 : 1) * (s.needs.stress > 80 ? 0.6 : 1);
      s.skills[k] = Math.round(((s.skills[k] || 0) + xp[k] * mult) * 10) / 10;
      var after = skillLevel(s, k);
      if (after > before) log(s, D.SKILLS[k] + ' is now level ' + after + '.', 'good');
    });
  }
  function applyFx(s, fx, scale) {
    if (!fx) return;
    scale = scale == null ? 1 : scale;
    Object.keys(fx).forEach(function (k) {
      s.needs[k] = clamp(s.needs[k] + fx[k] * scale, 0, 100);
    });
  }
  function mood(s) {
    var sum = 0;
    NEEDS.forEach(function (k) { sum += s.needs[k]; });
    return sum / NEEDS.length;
  }
  function performance(s) {
    return clamp((mood(s) / 100 * (1 - s.needs.stress / 250) + 0.25) * (s.sick ? 0.8 : 1), 0.3, 1.15);
  }

  /* ---------- world state ---------- */

  function homeDef(s) { return D.HOMES[s.home]; }
  function homeDistrict(s) { return homeDef(s).district; }

  function rollPower(s) {
    var p = homeDef(s).power + furniturePower(s);
    if (s.econ.policy === 'power') p += 0.25;
    if (s.econ.gridDown > 0) p *= 0.3;
    s.power = rand(s) < clamp(p, 0, 0.98);
  }

  function okadaBanned(s, d) {
    if (s.econ.policy === 'okada') return ['mushin', 'oshodi', 'festac', 'ikorodu', 'ajah'].indexOf(d) < 0;
    return D.OKADA_BAN.indexOf(d) >= 0;
  }

  /* ---------- new game ---------- */
  function cleanTraits(t) {
    if (!Array.isArray(t) || t.length !== 2 || t[0] === t[1] || !D.TRAITS[t[0]] || !D.TRAITS[t[1]]) return null;
    return [String(t[0]), String(t[1])];
  }
  function cleanStarter(o) {
    if (!o || typeof o !== 'object') return null;
    var C = D.CLOTHES, t = C[o.top], b = C[o.bottom];
    return t && b && t.starter && b.starter && t.slot === 'top' && b.slot === 'bottom' ? { top: o.top, bottom: o.bottom } : null;
  }
  function cleanLook0(l) {
    if (!l || typeof l !== 'object') return null;
    var okn = function (v, arr) { return typeof v === 'number' && v >= 0 && v < arr.length && Math.round(v) === v; };
    return okn(l.skin, D.LOOKS.skin) && okn(l.hair, D.LOOKS.hair) && okn(l.shape, D.LOOKS.shape) ? { skin: l.skin, hair: l.hair, shape: l.shape } : null;
  }

  function newGame(opts) {
    opts = opts || {};
    // A weekly challenge derives its seed from its id, so everyone who plays
    // that week gets the same Lagos.
    if (opts.challenge != null && !CHALLENGE_ID.test(opts.challenge)) throw new Error('Bad challenge id');
    var seed = (opts.challenge ? parseInt(fnv('lasgidi-weekly:' + opts.challenge), 16) : opts.seed == null ? Date.now() : opts.seed) | 0;
    var s = {
      v: VERSION, seed: seed, rng: seed, t: 6 * 60,
      name: (opts.name || 'Ade').slice(0, 24), goal: opts.goal || 'freestyle',
      origin: null, home: null, rentRate: 0, loc: null,
      cash: 0, bank: 0,
      needs: { hunger: 80, energy: 90, fun: 60, social: 55, hygiene: 80, stress: 20 },
      skills: {}, job: null,
      edu: { enrolled: false, lectures: 0, degree: false, ielts: 0, ieltsPassed: false },
      pantry: 2, friends: {}, loans: [], arrears: 0, rentLate: 0,
      ajo: null, businesses: [], properties: [], car: false, power: true,
      allowanceWeeks: 0, allowance: 0, asoebi: false, ponzi: null,
      welfareDay: -1, viralWeek: -1, hospitalWeek: -1,
      rules: opts.rules || RULES, partner: null, kids: [], babyPause: -1, items: [], vehicles: [], driving: -1, bonds: [], gems: {}, giftsOpened: {}, wardrobe: [], outfit: {}, look: { skin: 2, hair: 0, shape: 1 }, quests: {}, stocks: {}, streak: null, staff: [], pets: [], hmo: null, shop: null, creator: { followers: 0, posts: 0, lastPost: -1 }, phone: null, title: null, partyJoins: {}, danfoDriver: false, haggles: {}, sea: null, mini: null, nysc: null, sick: null, heir: null, interviews: {}, build: null,
      econ: { infl: 1, wage: 1, fuel: 1, fuelDays: 0, flood: 0, gridDown: 0, policy: null, policyWeeks: 0, cbn: null, cbnWeeks: 0 },
      pending: [], log: [], alerts: [], ledger: [], ledgerHash: '0', ledgerCount: 0,
      ledgerSum: { cash: 0, bank: 0 }, opening: { cash: 0, bank: 0 },
      stats: { trips: 0, shifts: 0, onTime: 0, earned: 0, spent: 0, peakWorth: 0, weekStartWorth: 0 },
      ach: {}, won: null,
      sv: SCHEMA, wk: { inc: {}, out: {} }, history: [], report: null
    };
    Object.keys(D.SKILLS).forEach(function (k) { s.skills[k] = 0; });
    Object.keys(D.NPCS).forEach(function (k) { s.friends[k] = { lvl: 0, seen: -1 }; });

    var originId = opts.origin;
    if (!originId) {
      var r = rand(s);
      originId = r < 0.5 ? 'lapo' : r < 0.85 ? 'mid' : 'nepo';
    }
    var o = D.ORIGINS[originId];
    var heir = originId === 'heir' ? cleanHeir(opts.heir) : null;
    if (originId === 'heir' && !heir) { originId = 'mid'; o = D.ORIGINS.mid; }
    s.origin = originId;
    s.home = heir ? (heir.inherit >= 3000000 ? 'lekki_studio' : heir.inherit >= 300000 ? 'yaba_selfcon' : 'mushin_room') : o.home;
    s.rentRate = D.HOMES[o.home].rent;
    s.loc = D.HOMES[o.home].district;
    // Optional setup choices (newer starts only): a first home your origin allows, exactly two traits, and a look.
    var startHome = !heir && opts.startHome && (D.START_HOMES[originId] || []).indexOf(opts.startHome) >= 0 ? opts.startHome : null;
    if (startHome) { s.home = startHome; s.rentRate = D.HOMES[startHome].rent; s.loc = D.HOMES[startHome].district; }
    var traits = cleanTraits(opts.traits);
    // Opening balance is the one deposit that is not an in-game action.
    var startCash = heir ? heir.inherit : o.cash;
    s.bank = startCash; s.opening.bank = startCash;
    if (heir) {
      s.heir = heir; s.name = opts.name || heir.name;
      // What your parent gave you before money: schooling.
      if (heir.school === 'intl') s.edu.degree = true;
      if (heir.school === 'private' || heir.school === 'intl') addXp(s, { charisma: heir.school === 'intl' ? 25 : 12 });
      if (heir.as > 0) addXp(s, { tech: Math.min(25, heir.as * 10) });
      if (heir.bond >= 60) s.needs.stress = Math.max(0, s.needs.stress - 15);
      if (heir.gen >= 3) unlock(s, 'dynasty');
    }
    if (traits) {
      s.traits = traits;
      traits.forEach(function (k) { var T = D.TRAITS[k]; addXp(s, T.xp); if (T.needs) Object.keys(T.needs).forEach(function (n) { s.needs[n] = clamp(s.needs[n] + T.needs[n], 0, 100); }); });
    }
    var look = cleanLook0(opts.look); if (look) s.look = look;
    var outfit = cleanStarter(opts.outfit);
    if (outfit) { ['top', 'bottom'].forEach(function (k) { s.wardrobe.push({ id: outfit[k] }); s.outfit[k] = outfit[k]; }); }
    if (o.allowance) { s.allowance = o.allowance; s.allowanceWeeks = o.allowanceWeeks; }
    if (originId === 'nepo') s.friends.kunle.lvl = 60; // Daddy's banker friend
    rollPower(s);
    s.stats.weekStartWorth = netWorth(s);
    // Everything needed to rebuild this life from scratch: the seed, the
    // starting choices, and every player call in order (see recorded()).
    if (opts.challenge) { s.challenge = { id: opts.challenge, weeks: CHALLENGE_WEEKS }; s.over = false; s.goal = 'freestyle'; }
    s.replay = { seed: seed, goal: s.goal, origin: opts.origin || null, rules: s.rules, challenge: opts.challenge || null, acts: [] };
    if (heir) s.replay.heir = heir;
    if (traits) s.replay.traits = traits;
    if (startHome) s.replay.home = startHome;
    if (look) s.replay.look = look;
    if (outfit) s.replay.outfit = outfit;
    log(s, o.text, 'story');
    if (startHome) log(s, 'You chose to start in ' + D.HOMES[startHome].name + '.', 'story');
    if (heir) log(s, 'You are ' + s.name + ', child of ' + heir.parent + '. Your share of the estate: ' + naira(heir.inherit) + '.' + (heir.school === 'intl' ? ' Your international school education counts as a degree.' : ''), 'story');
    log(s, 'Rent is due every Saturday at noon. Lagos no dey carry last.', 'info');
    return s;
  }

  /* ---------- time ---------- */

  function advance(s, mins, mode) {
    mode = mode || {};
    var steps = Math.max(1, Math.round(mins / STEP));
    var h = STEP / 60;
    for (var i = 0; i < steps; i++) {
      s.t += STEP;
      if (mode.sleep) {
        s.needs.energy = clamp(s.needs.energy + 12.5 * h * mode.sleep, 0, 100);
        s.needs.hunger = clamp(s.needs.hunger - 3 * h, 0, 100);
        s.needs.hygiene = clamp(s.needs.hygiene - 1 * h, 0, 100);
        s.needs.stress = clamp(s.needs.stress - 2 * h, 0, 100);
      } else {
        NEEDS.forEach(function (k) { s.needs[k] = clamp(s.needs[k] - DECAY[k] * h, 0, 100); });
      }
      var m = minuteOfDay(s);
      if (m % 60 === 0) onHour(s);
      if (m === 18 * 60) businessPayout(s);
      if (m === 0) onNewDay(s);
      if (m === 12 * 60 && dow(s) === 5) collectRent(s);
      if (s.challenge && m === 0 && dow(s) === 0 && week(s) >= s.challenge.weeks) {
        // Time is up: freeze the life exactly at the start of the final Monday.
        s.over = true;
        s.pending = [];
        log(s, 'Time up! Your Weekly Lagos ended with a net worth of ' + naira(netWorth(s)) + '.', 'ach');
        break;
      }
    }
  }

  function onHour(s) {
    if (hour(s) % 3 === 0) rollPower(s);
    if (s.sick) malariaHour(s);
    var low = 0;
    NEEDS.forEach(function (k) { if (s.needs[k] < 25) low++; });
    s.needs.stress = clamp(s.needs.stress + (low ? low * 2 : -0.5), 0, 100);
  }

  function onNewDay(s) {
    if (s.build) buildTick(s);
    if (s.hpBuild) hpBuildTick(s);
    var hd = homeDef(s);
    if (hd.daily) applyFx(s, hd.daily); // perks of homes added after v0.6
    var fd = furnitureDaily(s);
    if (fd) applyFx(s, fd);
    (s.staff || []).forEach(function (id) { var St = D.STAFF[id]; if (!St.needsCar || rideCar(s)) applyFx(s, St.daily); });
    (s.pets || []).forEach(function (id) { applyFx(s, D.PETS[id].daily); });
    matureBonds(s);
    var d = day(s), yesterday = d - 1, yDow = yesterday % 7;
    // Missed shift check.
    if (s.job) {
      var c = D.CAREERS[s.job.id];
      if (c.days.indexOf(yDow) >= 0 && s.job.lastShift !== yesterday && s.job.since < yesterday * 1440 + c.start * 60) {
        s.job.missed++;
        log(s, 'You missed your ' + c.titles[s.job.level] + ' shift. (' + s.job.missed + '/3 strikes)', 'bad');
        if (s.job.missed >= 3) {
          log(s, 'Oga don sack you. Three no-shows is the limit.', 'bad');
          s.job = null;
        }
      }
    }
    if (s.econ.fuelDays > 0 && --s.econ.fuelDays === 0) { s.econ.fuel = 1; log(s, 'Fuel queues are gone. Fares are back to normal.', 'good'); }
    if (s.econ.flood > 0) s.econ.flood--;
    if (s.econ.gridDown > 0) s.econ.gridDown--;
    Object.keys(s.friends).forEach(function (k) {
      var f = s.friends[k];
      if (f.lvl > 0 && f.seen >= 0 && d - f.seen > 3) f.lvl = Math.max(0, f.lvl - 1);
    });
    if (dow(s) === 0) onNewWeek(s);
    if (s.rules >= 6) dailyLove(s);
    dailyEvent(s);
  }

  function onNewWeek(s) {
    var w = week(s);
    var prevMonth = (START_MONTH + Math.floor((w - 1) / 4)) % 12;
    // Inflation: 0.4%–1.2% a week. Wages chase it at half speed.
    var inf = (0.004 + rand(s) * 0.008) * cbnOf(s, 'infl', 1);
    s.econ.infl = Math.round(s.econ.infl * (1 + inf) * 10000) / 10000;
    s.econ.wage = Math.round(s.econ.wage * (1 + inf / 2) * 10000) / 10000;

    var interest = Math.floor(s.bank * savingsRate(s));
    if (interest > 0) post(s, 'bank', interest, 'Savings interest');

    if (s.allowanceWeeks > 0) {
      post(s, 'bank', s.allowance, 'Allowance from Daddy');
      if (--s.allowanceWeeks === 0) log(s, 'Daddy: "You are an adult now." The allowance has stopped.', 'story');
    }
    if (s.econ.policy === 'power') pay(s, price(s, 1000), 'Power levy') || addDebt(s, price(s, 1000), 'Power levy');
    if (s.car) pay(s, price(s, 5000), 'Car maintenance') || addDebt(s, price(s, 5000), 'Mechanic');
    (s.vehicles || []).forEach(function (v) {
      var V = D.VEHICLES[v.id], fee = vehicleUpkeep(s, v.id);
      pay(s, fee, 'Upkeep: ' + V.name) || addDebt(s, fee, 'Upkeep: ' + V.name);
      if (s.rules >= 8 && v.paid > 100000000) { var ins = roundTo(v.paid * 0.002, 1000); pay(s, ins, 'Insurance: ' + V.name) || addDebt(s, ins, 'Insurance: ' + V.name); }
    });
    if (s.rules >= 8 && w > 0 && w % 4 === 0) rentReview(s);

    weeklyStaff(s);
    weeklyPets(s);
    weeklyShop(s);
    weeklyCreator(s);
    weeklyDanfo(s);
    weeklyNysc(s);
    weeklyBusinessCosts(s);
    weeklyAjo(s);
    weeklyLoans(s);
    weeklyProperty(s);
    payDividends(s, w);
    if (s.rules >= 6) weeklyFamily(s);
    if (s.rules >= 14) weeklyDetty(s);
    resolvePonzi(s);

    if (s.econ.policyWeeks > 0 && --s.econ.policyWeeks === 0) {
      log(s, 'The ' + D.POLICIES[s.econ.policy].name + ' has ended.', 'info');
      s.econ.policy = null;
    }
    if (w > 0 && w % 4 === 0) queueVote(s);
    if (s.econ.cbnWeeks > 0 && --s.econ.cbnWeeks === 0) { log(s, D.CBN[s.econ.cbn].name + '\'s term at the CBN has ended. Rates are back to normal.', 'info'); s.econ.cbn = null; }
    if (s.rules >= 7 && w % 4 === 2) queueCbn(s);

    var m = monthIndex(s);
    if (m !== prevMonth) {
      if (m === 11) log(s, 'Detty December is here. Prices are up, parties are everywhere, short-lets are booked out.', 'story');
      if (m === 0) {
        if (prevMonth === 11) unlock(s, 'detty');
        log(s, 'January. Everybody is broke. Gig pay is down this month.', 'story');
      }
    }
    var worth = netWorth(s);
    log(s, 'Week ' + w + ' report: net worth ' + naira(worth) + ' (' + (worth >= s.stats.weekStartWorth ? '+' : '') + naira(worth - s.stats.weekStartWorth) + ').', 'report');
    var rep = { w: w, worth: worth, delta: worth - s.stats.weekStartWorth, inc: s.wk.inc, out: s.wk.out };
    s.history.push({ w: w, worth: worth });
    if (s.history.length > 104) s.history.shift();
    s.report = rep;
    s.wk = { inc: {}, out: {} };
    s.stats.weekStartWorth = worth;
  }

  /* ---------- rent & housing ---------- */

  function rentShare(s) {
    // A spouse pays half the rent.
    return s.rules >= 6 && s.partner && s.partner.stage === 'married' ? roundTo(s.rentRate / 2, 50) : s.rentRate;
  }

  function collectRent(s) {
    if (!s.rentRate) return;
    var due = rentShare(s);
    if (pay(s, due, 'Rent: ' + homeDef(s).name + (due < s.rentRate ? ' (your half)' : ''))) {
      s.rentLate = 0;
      log(s, 'Rent paid. Landlord is smiling.', 'info');
      return;
    }
    s.arrears += due;
    s.rentLate++;
    s.needs.stress = clamp(s.needs.stress + 20, 0, 100);
    if (s.rentLate >= 3) {
      log(s, 'Quit notice. The landlord has changed the locks. You are squatting with a friend in Mushin. You still owe ' + naira(s.arrears) + '.', 'bad');
      s.home = 'squat'; s.rentRate = 0; s.rentLate = 0;
      unlock(s, 'evicted');
    } else {
      log(s, 'You could not pay rent. Arrears: ' + naira(s.arrears) + '. Strike ' + s.rentLate + ' of 3 before eviction.', 'bad');
    }
  }

  function payArrears(s) {
    if (!s.arrears) return fail('You do not owe any rent.');
    var paid = payPartial(s, s.arrears, 'Rent arrears');
    if (!paid) return fail('You have no money to pay arrears.');
    s.arrears -= paid;
    if (!s.arrears) s.rentLate = 0;
    return ok('Paid ' + naira(paid) + ' towards arrears.');
  }

  function ownsHome(s, homeId) {
    var h = D.HOMES[homeId];
    var need = h && (h.ownedBy || D.ESTATE.property);
    return !!(h && h.owned && s.properties.some(function (p) { return p.id === need; }));
  }

  // Rules 8: every 4 weeks the landlord moves rent up with inflation.
  function rentReview(s) {
    var h = D.HOMES[s.home];
    if (!h || h.owned || !s.rentRate || s.econ.policy === 'tenancy') return;
    var target = roundTo(h.rent * s.econ.infl, 50);
    if (target <= s.rentRate) return;
    log(s, 'Rent review: your landlord has raised the rent from ' + naira(s.rentRate) + ' to ' + naira(target) + ' a week, in line with prices.', 'bad');
    s.rentRate = target;
  }
  function moveInCost(s, homeId) {
    if (D.HOMES[homeId].owned) return { rent: 0, total: 0 };
    var rent = price(s, D.HOMES[homeId].rent);
    var cost = rent * 4 + roundTo(rent * 4 * 0.1, 50);
    if (s.econ.policy === 'tenancy') cost = roundTo(cost / 2, 50);
    return { rent: rent, total: cost };
  }

  function moveHouse(s, homeId) {
    var h = D.HOMES[homeId];
    if (!h || h.hidden) return fail('That place is not on the market.');
    if (homeId === s.home) return fail('You already live here.');
    if (h.owned && !ownsHome(s, homeId)) return fail(h.ownedBy ? 'Build your house first.' : 'Buy a plot in ' + D.ESTATE.name + ' first.');
    if (s.arrears) return fail('Clear your rent arrears first. No landlord will take you with debt.');
    var c = moveInCost(s, homeId);
    if (c.total && !pay(s, c.total, 'Move-in: 4 weeks rent + agent fee')) return fail('Move-in needs ' + naira(c.total) + ' (4 weeks upfront plus agent fee).');
    s.home = homeId; s.rentRate = c.rent; s.rentLate = 0;
    var stored = relayout(s);
    if (stored) log(s, stored + ' item' + (stored === 1 ? '' : 's') + ' did not fit in the new place and went into storage.', 'info');
    rollPower(s);
    log(s, 'You moved into ' + h.name + '. Weekly rent ' + naira(c.rent) + '.', 'good');
    return ok('Welcome to ' + D.DISTRICTS[h.district].name + '.');
  }

  function addDebt(s, amount, why) {
    s.loans.push({ kind: 'debt', name: why, bal: amount, rate: 0, weeksLeft: 4 });
    log(s, why + ': ' + naira(amount) + ' added to your debts.', 'bad');
    return true;
  }

  /* ---------- actions ---------- */

  function inWindow(s, when) {
    if (!when) return true;
    if (when.days && when.days.indexOf(dow(s)) < 0) return false;
    if (when.months && when.months.indexOf(monthIndex(s)) < 0) return false;
    if (when.lastDay && !(week(s) % 4 === 3 && dow(s) === 6)) return false; // the month's last day
    var h = hour(s);
    if (when.from != null && h < when.from) return false;
    if (when.to != null && h >= when.to) return false;
    return true;
  }
  function windowLabel(when) {
    if (!when) return '';
    var parts = [];
    if (when.months) parts.push(when.months.map(function (m) { return D.MONTHS[m]; }).join('/'));
    if (when.days) parts.push(when.days.map(function (d) { return D.DAYS[d]; }).join('/'));
    if (when.from != null) parts.push(String(when.from).padStart(2, '0') + ':00–' + String(when.to).padStart(2, '0') + ':00');
    return parts.join(' ');
  }

  function genCost(s) { return price(s, 1500 * s.econ.fuel * (1 - furnitureGen(s))); }

  function npcActions(s) {
    return Object.keys(D.NPCS).filter(function (k) { return D.NPCS[k].district === s.loc; }).map(function (k) {
      var n = D.NPCS[k];
      return { id: 'npc_' + k, label: 'Gist with ' + n.name + ' (' + n.role + ')', mins: 60, cost: 500, fx: { social: 18, fun: 8 }, special: 'npc', npc: k };
    });
  }

  function shiftAction(s) {
    if (!s.job) return null;
    var c = D.CAREERS[s.job.id];
    if (c.district !== s.loc) return null;
    var a = { id: 'work_shift', label: 'Clock in: ' + c.titles[s.job.level], special: 'shift', mins: 0, isWork: true };
    var m = minuteOfDay(s), st = c.start * 60, en = c.end * 60;
    if (c.days.indexOf(dow(s)) < 0) { a.disabled = 'No shift today'; a.mins = (c.end - c.start) * 60; return a; }
    if (s.job.lastShift === day(s)) { a.disabled = 'Already worked today'; a.mins = (c.end - c.start) * 60; return a; }
    if (m < st - 60) { a.disabled = 'Opens ' + String(c.start - 1).padStart(2, '0') + ':00'; a.mins = (c.end - c.start) * 60; return a; }
    if (m > st + 60) { a.disabled = 'Too late, shift started ' + String(c.start).padStart(2, '0') + ':00'; a.mins = (c.end - c.start) * 60; return a; }
    a.mins = en - m;
    a.late = m > st + 15;
    a.earnEst = shiftPay(s, a.late, 1);
    return a;
  }

  // Rules 7: PAYE on each shift. The first ₦4,000 (inflation-adjusted) is
  // free, the next ₦16,000 is taxed at 10% and everything above at 20%.
  function payeTax(s, got) {
    if (s.rules < 7) return 0;
    var w = s.econ.wage;
    function band(lo, hi, r) { return Math.max(0, Math.min(got, hi * w) - lo * w) * r; }
    var t = s.rules >= 8
      ? band(3000, 15000, 0.1) + band(15000, 50000, 0.2) + band(50000, Infinity, 0.25)
      : band(4000, 20000, 0.1) + band(20000, Infinity, 0.2);
    return roundTo(t, 50);
  }
  function shiftPay(s, late, perf) {
    var c = D.CAREERS[s.job.id];
    var v = c.pay[s.job.level] * s.econ.wage * (late ? 0.7 : 1) * perf;
    return roundTo(v, 50);
  }

  // retired actions are hidden from players but still run, so lives that used them replay.
  function availableActions(s, withRetired) {
    var list = [];
    var shift = shiftAction(s);
    if (shift) list.push(shift);
    (D.PLACE_ACTIONS[s.loc] || []).forEach(function (a) {
      if (a.retired && !withRetired) return;
      if (a.needsVehicle && !(s.vehicles || []).some(function (v) { return D.VEHICLES[v.id].kind === a.needsVehicle; })) return;
      list.push(a);
    });
    list = list.concat(npcActions(s)).concat(loveActions(s));
    var rh = rideAction(s); if (rh) list.push(rh);
    if (homeDistrict(s) === s.loc) D.HOME_ACTIONS.forEach(function (a) { list.push(Object.assign({ atHome: true }, a)); });
    return list.map(function (a) { return describe(s, a); });
  }

  /* ---------- ride-hailing with your own car ---------- */
  var RIDE_KM = 60, RIDE_FARE = 3500, RIDE_CUT = 0.25;
  function rideCar(s) {
    var V = bestCar(s);
    if (V) return V;
    return s.car ? { name: D.CAR.name, icon: '🚗', fuel: 120, status: 2 } : null;
  }
  function rideTerms(s) {
    var V = rideCar(s); if (!V) return null;
    var h = hour(s), rush = (h >= 6 && h < 10) || (h >= 16 && h < 21), night = h >= 22 || h < 5;
    var premium = V.status >= 8, keke = V.name === D.VEHICLES.keke_own.name;
    var trips = (rush ? 7 : night ? 3 : 5) * (premium ? 0.6 : 1);
    var fare = RIDE_FARE * (premium ? 2.2 : keke ? 0.5 : 1) * (night ? 1.3 : 1);
    var fuel = price(s, V.fuel * RIDE_KM * s.econ.fuel * (keke ? 0.6 : 1));
    return { V: V, trips: trips, fare: fare, fuel: fuel, gross: gigPay(s, trips * fare, 1) };
  }
  function rideAction(s) {
    var T = rideTerms(s); if (!T) return null;
    var net = roundTo(T.gross * (1 - RIDE_CUT) - T.fuel, 50);
    return { id: 'ride_hail', label: 'Drive ride-hail in your ' + T.V.name.replace(/^Your own /, '') + ' (3 hrs)', mins: 180, fx: { energy: -14, stress: 6 }, xp: { charisma: 1 }, gig: true, special: 'ridehail',
      note: 'About ' + naira(net) + ' after the app\'s 25% cut and ' + naira(T.fuel) + ' of fuel. Busier at rush hour; night fares are higher.' };
  }

  // Needs at the end of an action if nothing else happens on the way.
  function project(s, a) {
    if (a.special === 'sleep' || a.special === 'nap') return { hunger: s.needs.hunger - 3 * a.mins / 60, energy: 100 };
    var h = a.mins / 60, fx = a.fx || {};
    var shift = a.special === 'shift' ? -12 : 0;
    return {
      hunger: s.needs.hunger - DECAY.hunger * h + (fx.hunger || 0),
      energy: s.needs.energy - DECAY.energy * h + (fx.energy || 0) + shift
    };
  }

  // Minutes from now until the next shift start, or null.
  function nextShiftStart(s) {
    if (!s.job) return null;
    var c = D.CAREERS[s.job.id];
    for (var i = 0; i < 8; i++) {
      var d = day(s) + i, t = d * 1440 + c.start * 60;
      if (c.days.indexOf(d % 7) >= 0 && t > s.t && !(i === 0 && s.job.lastShift === d)) return t - s.t;
    }
    return null;
  }

  function alarmMins(s) {
    var until = nextShiftStart(s);
    if (until == null) return null;
    var c = D.CAREERS[s.job.id];
    var commute = homeDistrict(s) === c.district ? 0 : Math.round(distance(homeDistrict(s), c.district) / 26 * 60 * 1.6) + 30;
    var mins = Math.floor((until - commute - 30) / STEP) * STEP;
    return mins >= 60 ? Math.min(mins, 600) : null;
  }

  function describe(s, a) {
    var out = Object.assign({}, a);
    if (a.alarm) {
      var am = alarmMins(s);
      if (am == null) { out.mins = 60; out.disabled = s.job ? 'Your shift is too soon for a proper sleep' : 'You have no job to wake up for'; }
      else { out.mins = am; out.label = 'Sleep, alarm for work (' + fmtMins(am) + ')'; }
    }
    out.price = price(s, a.cost);
    if (s.hmo && /checkup$/.test(a.id)) out.price = roundTo(out.price * D.HMO[s.hmo].checkup, 50);
    if (a.power && out.atHome && !s.power) { out.price += genCost(s); out.gen = true; }
    if (a.earn) out.earnEst = gigPay(s, a.earn, 1);
    if (a.when) out.whenLabel = windowLabel(a.when);
    if (!out.disabled) out.disabled = blocker(s, a, out.price);
    var p = project(s, a);
    if (p.energy <= 0 || p.hunger <= 0) {
      // Optional effort you cannot finish is blocked; a shift is your call.
      if (!out.disabled && a.special !== 'shift' && (a.fx && a.fx.energy < 0 || a.gig) && p.energy <= 0) out.disabled = 'Too tired for this';
      else out.collapseRisk = p.energy <= 0 ? 'You will collapse from exhaustion before this ends' : 'You will collapse from hunger before this ends';
    }
    return out;
  }

  function blocker(s, a, cost) {
    if (s.over) return 'This Weekly Lagos is over';
    if (s.japa) return 'You have japa-ed. Start a new life to play again';
    if (s.pending.length) return 'Decide on the open event first';
    if (!inWindow(s, a.when)) return 'Only ' + windowLabel(a.when);
    if (a.req) {
      for (var k in a.req) if (skillLevel(s, k) < a.req[k]) return 'Needs ' + D.SKILLS[k] + ' ' + a.req[k];
    }
    if (a.fx && a.fx.hunger > 0 && s.needs.hunger >= 90 && a.special !== 'owambe') return 'You are full';
    if (cost && !canAfford(s, cost)) return 'Costs ' + naira(cost);
    if (a.minigame === 'quiz' && s.quizDay === day(s)) return 'One show a day: come back tomorrow';
    switch (a.special) {
      case 'cook': if (s.pantry <= 0) return 'No foodstuff at home'; break;
      case 'flex': if (!luxuryCar(s)) return 'Bring a luxury car (₦40m or more) to flex here'; break;
      case 'appearance': if (!s.creator || s.creator.followers < 20000) return 'Promoters book creators with 20,000+ followers'; if (s.creator.appearWeek === week(s)) return 'One appearance a week'; break;
      case 'enrol': if (s.edu.enrolled || s.edu.degree) return 'Already enrolled'; break;
      case 'lecture': if (!s.edu.enrolled) return 'Enrol at UNILAG first'; break;
      case 'ielts_exam': if (s.edu.ieltsPassed) return 'Already passed'; break;
      case 'sleep': if (s.needs.energy > 85) return 'You are not tired'; break;
      case 'welfare':
        if (s.cash + s.bank >= price(s, 3000)) return 'Only when you are broke';
        if (s.welfareDay === day(s)) return 'Once a day';
        break;
    }
    return null;
  }

  function gigPay(s, base, spread) {
    var f = s.econ.infl;
    if (monthIndex(s) === 0) f *= 0.8; // January sapa
    if (s.rules >= 7) f *= 0.85;       // rules 7: customers price you down
    if (s.rules >= 14 && isDecember(s)) f *= 1.2; // Detty December: everybody is spending
    return roundTo(base * f * spread, 50);
  }

  function ok(msg, extra) { return Object.assign({ ok: true, msg: msg }, extra || {}); }
  function fail(msg) { return { ok: false, msg: msg }; }

  function doAction(s, id) {
    s.alerts = [];
    var a = availableActions(s, true).filter(function (x) { return x.id === id; })[0];
    if (!a) return fail('You cannot do that here.');
    if (a.disabled) return fail(a.disabled);
    if (a.special === 'shift') return workShift(s, a);
    if (a.minigame) return fail('Play the run first.');
    if (a.alarm) a.label = 'Sleep';
    if (a.price && !pay(s, a.price, a.label + (a.gen ? ' (incl. gen fuel)' : ''))) return fail('Not enough money.');

    var msg = a.label + '.';
    if (a.special === 'sleep' || a.special === 'nap') {
      var q = homeDef(s).sleep * (s.power ? 1 : 0.8) + furnitureSleep(s), bite = a.special === 'sleep' ? malariaChance(s, fxSum(s, 'mosquito')) : 0;
      advance(s, a.mins, { sleep: q });
      if (bite) catchMalaria(s, bite);
      msg = s.power ? 'You slept well.' : 'NEPA took light. Heat and mosquitoes, you slept badly.';
    } else {
      advance(s, a.mins);
      applyFx(s, a.fx);
    }
    if (a.event) s.stats.events = (s.stats.events || 0) + 1;
    // Sights count on rules 14 only, so older lives that visited them unlock nothing new.
    if (a.sight && s.rules >= 14) { var sg = s.stats.sights = s.stats.sights || {}; sg[a.id] = 1; if (Object.keys(sg).length >= 8) unlock(s, 'explorer'); }
    if (a.sport) { var sp = s.stats.sports = s.stats.sports || {}; sp[a.sport] = (sp[a.sport] || 0) + 1; if (Object.keys(sp).length >= 8) unlock(s, 'allrounder'); }
    if (a.dec && s.rules >= 14 && isDecember(s)) { s.stats.decEvents = (s.stats.decEvents || 0) + 1; if (s.stats.decEvents >= 6) unlock(s, 'detty_legend'); }
    addXp(s, a.xp);
    if (a.xp && a.xp.fitness && outfitTags(s).gym) addXp(s, { fitness: 1 }); // gym kit

    if (a.earn) {
      var got = gigPay(s, a.earn, 0.8 + rand(s) * 0.4);
      earn(s, got, a.label);
      msg = 'You made ' + naira(got) + '.';
      if ((s.loc === 'oshodi' || s.loc === 'mushin') && rand(s) < 0.2) queueAreaBoys(s);
    }
    var sp = specials[a.special];
    if (sp) msg = sp(s, a) || msg;
    return finish(s, ok(msg));
  }

  var specials = {
    ridehail: function (s) {
      var T = rideTerms(s);
      var gross = gigPay(s, T.trips * T.fare, 0.75 + rand(s) * 0.5), cut = Math.round(gross * RIDE_CUT);
      earn(s, gross - cut, 'Ride-hail fares');
      pay(s, T.fuel, 'Ride-hail fuel') || addDebt(s, T.fuel, 'Ride-hail fuel');
      var extra = '';
      if (rand(s) < 0.06) { var fine = price(s, 3000); payPartial(s, fine, 'Checkpoint "settlement"'); extra = ' A checkpoint collected ' + naira(fine) + ' "for the boys".'; }
      var net = gross - cut - T.fuel;
      return 'Fares ' + naira(gross) + ', the app kept ' + naira(cut) + ', fuel ' + naira(T.fuel) + '. You ' + (net >= 0 ? 'made ' + naira(net) : 'lost ' + naira(-net)) + '.' + extra;
    },
    welfare: function (s) { s.welfareDay = day(s); return 'Somebody fed you. Lagos is hard, but people still look out for each other.'; },
    cook: function (s) { s.pantry--; return 'Home-cooked. ' + s.pantry + ' meals of foodstuff left.'; },
    pantry7: function (s) { s.pantry += 7; return 'Foodstuff for 7 meals is in the kitchen.'; },
    enrol: function (s) { s.edu.enrolled = true; log(s, 'You are now a part-time UNILAG student. 30 lectures to graduate.', 'good'); return 'Enrolled. Lectures run on weekdays.'; },
    lecture: function (s) {
      s.edu.lectures++;
      if (s.edu.lectures >= 30) {
        s.edu.enrolled = false; s.edu.degree = true; unlock(s, 'graduate');
        log(s, 'Convocation. You have a degree now.', 'good');
        return 'You graduated.';
      }
      return 'Lecture ' + s.edu.lectures + ' of 30.';
    },
    ielts_prep: function (s) { s.edu.ielts = Math.min(20, s.edu.ielts + 1); return 'IELTS prep: ' + s.edu.ielts + ' sessions.'; },
    ielts_exam: function (s) {
      var chance = Math.min(0.95, 0.2 + s.edu.ielts * 0.04 + skillLevel(s, 'charisma') * 0.03);
      if (rand(s) < chance) { s.edu.ieltsPassed = true; log(s, 'IELTS result: Band 7.5. You passed.', 'good'); return 'You passed IELTS.'; }
      log(s, 'IELTS result: Band 5.5. Not enough. More prep, then try again.', 'bad');
      return 'You did not pass. Pass chance was ' + Math.round(chance * 100) + '%.';
    },
    hackathon: function (s) {
      if (rand(s) < 0.2) { var prize = price(s, 100000); earn(s, prize, 'Hackathon prize'); return 'Your team won ' + naira(prize) + '.'; }
      return 'No prize, but you learnt a lot.';
    },
    owambe: function (s) {
      if (s.asoebi) {
        s.asoebi = false;
        applyFx(s, { fun: 20, social: 20 });
        var k = pick(s, Object.keys(s.friends));
        befriend(s, k, 10);
        return 'Your aso-ebi was the talk of the party. You bonded with ' + D.NPCS[k].name + '.' + dressBonus(s, 'owambe');
      }
      return 'Jollof, small chops and plenty spraying.' + glamBonus(s) + dressBonus(s, 'owambe');
    },
    // Island flex culture (new actions only, so older lives never reach these).
    spray: function (s) {
      var g = glamBonus(s);
      return 'Naira notes in the air, the DJ shouted your name, and the whole club saw you.' + g + dressBonus(s, 'club');
    },
    flex: function (s) {
      var v = luxuryCar(s), V = D.VEHICLES[v.id];
      if (s.creator) { var n = Math.round(followerGain(s) * 0.5); s.creator.followers += n; }
      return 'You parked the ' + V.name + ' right by the entrance. Phones came out.' + (s.creator ? ' Your Story got you new followers.' : '');
    },
    // Amateur tournaments: your skill against the field, with a capped prize (new actions only).
    compete: function (s, a) {
      var C = a.compete, score = skillLevel(s, C.skill) * 8 + rand(s) * 60;
      if (score >= 50) { var prize = price(s, C.prize); earn(s, prize, 'Prize: ' + C.name); s.stats.wins = (s.stats.wins || 0) + 1; return '🏆 You won the ' + C.name + ': ' + naira(prize) + '!'; }
      return 'You lost the ' + C.name + '. Train more and come back.';
    },
    appearance: function (s) {
      var c = s.creator, fee = Math.min(price(s, 400000), roundTo(price(s, c.followers * 1.5), 1000));
      c.appearWeek = week(s);
      earn(s, fee, 'Event appearance fee');
      return 'You walked in, waved, took 200 selfies and hyped the DJ. The promoter paid ' + naira(fee) + '.';
    },
    glam: function (s) {
      s.glamUntil = s.t + 24 * 60;
      return 'Hair laid, face beat, nails done. You are "outside" ready for the next 24 hours: your next night out or owambe will hit different.';
    },
    club: function (s) {
      if (rand(s) < 0.06) {
        var lost = Math.min(s.cash, price(s, 20000));
        if (lost) post(s, 'cash', -lost, 'Phone and wallet snatched');
        return 'Someone snatched your wallet outside the club.';
      }
      return 'Great night.' + glamBonus(s) + dressBonus(s, 'club');
    },
    content: function (s) {
      var chance = 0.03 + skillLevel(s, 'charisma') * 0.01, viral = false, msg;
      if (week(s) !== s.viralWeek && rand(s) < chance) {
        s.viralWeek = week(s);
        var pay2 = price(s, roundTo(15000 + rand(s) * 35000, 1000)) * (1 + Math.floor(skillLevel(s, 'charisma') / 3));
        earn(s, pay2, 'Brand deal from viral post');
        applyFx(s, { social: 20, fun: 10 });
        unlock(s, 'viral');
        viral = true;
        msg = 'Your video went viral. A brand paid ' + naira(pay2) + '.';
      }
      // Followers: no money and no rng draw, so older lives replay unchanged.
      var got = followerGain(s, viral);
      if (!s.creator) s.creator = { followers: 0, posts: 0, lastPost: -1 };
      s.creator.followers += got; s.creator.posts++; s.creator.lastPost = day(s);
      return (msg || 'Posted. A few hundred views.') + ' +' + got.toLocaleString('en') + ' followers (' + s.creator.followers.toLocaleString('en') + ').';
    },
    npc: function (s, a) {
      var gain = 5 + skillLevel(s, 'charisma');
      befriend(s, a.npc, gain);
      return 'You and ' + D.NPCS[a.npc].name + ' are closer (' + s.friends[a.npc].lvl + '/100).';
    }
  };

  function befriend(s, k, gain) {
    var f = s.friends[k];
    f.lvl = Math.min(100, f.lvl + gain);
    f.seen = day(s);
    if (f.lvl >= 80) unlock(s, 'connected');
  }

  /* ---------- work ---------- */

  function jobEligibility(s, cid) {
    var c = D.CAREERS[cid];
    if (!c) return { ok: false, reason: 'No such job' };
    var connect = connectFor(s, cid);
    if (s.job && s.job.id === cid) return { ok: false, reason: 'This is your job' };
    if (skillLevel(s, c.skill) < c.req[0] && !connect) return { ok: false, reason: 'Needs ' + D.SKILLS[c.skill] + ' ' + c.req[0] + ' or a connect' };
    if (c.degree && !s.edu.degree && !connect) return { ok: false, reason: 'Needs a degree or a connect' };
    if (s.loc !== c.district) return { ok: false, reason: 'Apply in person at ' + D.DISTRICTS[c.district].name };
    return { ok: true, connect: connect };
  }

  /* ---------- job interviews (rules 13) ---------- */
  // Questions come from the seed and the day (no random draw); the engine marks the answers.
  function needsInterview(s, cid) { return s.rules >= 13 && !!D.INTERVIEWS[cid] && !connectFor(s, cid); }
  function interviewPicks(s, cid) {
    var bank = D.INTERVIEWS[cid], out = [], h = parseInt(fnv(s.seed + ':iv:' + cid + ':' + day(s)), 16);
    for (var k = 0; out.length < 3 && k < 12; k++) { var j = (h + k * 5) % bank.length; if (out.indexOf(j) < 0) out.push(j); h = Math.floor(h / 7); }
    for (var x = 0; out.length < 3; x++) if (out.indexOf(x) < 0) out.push(x);
    return out;
  }
  // Options are rotated per question and day, so the right answer is not always first.
  function ivRot(s, cid, j) { return parseInt(fnv(s.seed + ':ivo:' + cid + ':' + day(s) + ':' + j), 16) % 3; }
  function interviewQuestions(s, cid) {
    if (!D.INTERVIEWS[cid]) return [];
    return interviewPicks(s, cid).map(function (j) { var q = D.INTERVIEWS[cid][j], r = ivRot(s, cid, j); return { q: q[0], opts: [0, 1, 2].map(function (k) { return q[1][(k + r) % 3]; }) }; });
  }
  function interviewBlock(s, cid) {
    if (!needsInterview(s, cid)) return 'No interview needed for this job';
    var e = jobEligibility(s, cid); if (!e.ok) return e.reason;
    if ((s.interviews[cid] || -1) > day(s)) return 'They said they will call you. Try again in ' + (s.interviews[cid] - day(s)) + ' day' + (s.interviews[cid] - day(s) === 1 ? '' : 's');
    var c = D.CAREERS[cid], h = hour(s); if (h < c.start || h >= Math.min(c.end, 17)) return 'Interviews are held during office hours';
    return busyBlock(s);
  }
  function interviewJob(s, cid, a0, a1, a2) {
    var why = interviewBlock(s, cid); if (why) return fail(why + '.');
    var ans = [a0, a1, a2].map(function (v) { return Math.floor(v); });
    if (ans.some(function (v) { return !(v >= 0 && v <= 2); })) return fail('Answer all three questions.');
    var picks = interviewPicks(s, cid), right = 0;
    picks.forEach(function (j, i) { if (D.INTERVIEWS[cid][j][2] === (ans[i] + ivRot(s, cid, j)) % 3) right++; });
    var need = skillLevel(s, 'charisma') >= 4 ? 1 : 2; // confidence carries a weak answer
    s.alerts = [];
    advance(s, 60); applyFx(s, { stress: 8, energy: -5 });
    s.stats.interviews = (s.stats.interviews || 0) + 1;
    if (right >= need) { log(s, '🎤 Interview at ' + D.CAREERS[cid].name + ': ' + right + ' of 3. You got the job!', 'good'); return applyJob(s, cid, true); }
    s.interviews[cid] = day(s) + 3;
    log(s, '🎤 Interview at ' + D.CAREERS[cid].name + ': ' + right + ' of 3. "We will get back to you."', 'bad');
    return finish(s, ok('🎤 ' + right + ' of 3. "Thank you for coming. We will get back to you." Try again in 3 days.'));
  }

  function connectFor(s, cid) {
    var keys = Object.keys(D.NPCS);
    for (var i = 0; i < keys.length; i++) {
      if (D.NPCS[keys[i]].career === cid && s.friends[keys[i]].lvl >= 60) return keys[i];
    }
    return null;
  }

  function applyJob(s, cid, force) {
    var e = jobEligibility(s, cid);
    if (!e.ok && !force) return fail(e.reason);
    if (!force && needsInterview(s, cid)) { var nf = fail('This job needs an interview: three questions in the panel above.'); nf.interview = cid; return nf; }
    var c = D.CAREERS[cid];
    if (s.job) log(s, 'You resigned as ' + D.CAREERS[s.job.id].titles[s.job.level] + '.', 'info');
    s.job = { id: cid, level: 0, shifts: 0, perfSum: 0, missed: 0, lastShift: -1, since: s.t };
    var via = e.connect ? ' ' + D.NPCS[e.connect].name + ' put in a word for you.' : '';
    log(s, 'Hired: ' + c.titles[0] + ' (' + c.name + ').' + via, 'good');
    return finish(s, ok('You start as ' + c.titles[0] + '. Shifts ' + String(c.start).padStart(2, '0') + ':00–' + String(c.end).padStart(2, '0') + ':00, ' + c.days.map(function (d) { return D.DAYS[d]; }).join(' ') + '.'));
  }

  function quitJob(s) {
    if (!s.job) return fail('You have no job.');
    log(s, 'You resigned as ' + D.CAREERS[s.job.id].titles[s.job.level] + '.', 'info');
    s.job = null;
    return ok('You resigned.');
  }

  function workShift(s, a) {
    var c = D.CAREERS[s.job.id];
    var perf = performance(s);
    if ((s.job.id === 'bank' || s.job.id === 'tech') && outfitTags(s).office) perf = Math.min(1.2, perf * 1.06); // dressed for the office
    var late = a.late;
    // Mark the shift before advancing: a shift ending at midnight must not
    // count as missed by the midnight check it crosses.
    s.job.lastShift = day(s);
    advance(s, a.mins);
    applyFx(s, { energy: -12, hygiene: -10, stress: 6, fun: -5 });
    var got = shiftPay(s, late, perf);
    // Cooperative loan repayments come straight out of wages.
    var coop = s.loans.filter(function (l) { return l.kind === 'coop' && l.bal > 0; })[0];
    var deduct = coop ? Math.min(coop.bal, roundTo(got * 0.25, 50)) : 0;
    earn(s, got, 'Shift pay: ' + c.titles[s.job.level]);
    var tax = payeTax(s, got);
    if (tax) post(s, 'cash', -tax, 'PAYE income tax');
    if (deduct) { pay(s, deduct, 'Cooperative deduction'); coop.bal -= deduct; }
    addXp(s, (function () { var x = {}; x[c.skill] = 4 + s.job.level; return x; })());
    s.job.shifts++;
    s.job.perfSum += perf;
    s.job.missed = 0;
    s.stats.shifts++;
    if (!late) s.stats.onTime++;
    unlock(s, 'first_pay');
    if (s.stats.onTime >= 10) unlock(s, 'punctual');
    var msg = (late ? 'You were late, so 30% was docked. ' : '') + 'Earned ' + naira(got) + (deduct ? ' (' + naira(deduct) + ' went to the cooperative)' : '') + '.';
    var promo = checkPromotion(s);
    if (promo) msg += ' ' + promo;
    return finish(s, ok(msg));
  }

  function promotionNeeds(s) {
    var c = D.CAREERS[s.job.id], L = s.job.level;
    if (L >= 4) return null;
    var shiftsNeeded = 4 + 2 * L - (connectFor(s, s.job.id) && s.friends[connectFor(s, s.job.id)].lvl >= 80 ? 2 : 0);
    if (s.rules >= 8) shiftsNeeded = Math.ceil(shiftsNeeded * 1.3);
    return { shifts: shiftsNeeded, skill: c.req[L + 1], skillName: D.SKILLS[c.skill], perf: 0.55 };
  }

  function checkPromotion(s) {
    var need = promotionNeeds(s);
    if (!need) return null;
    var c = D.CAREERS[s.job.id];
    var avg = s.job.perfSum / s.job.shifts;
    if (s.job.shifts >= need.shifts && skillLevel(s, c.skill) >= need.skill && avg >= need.perf) {
      s.job.level++;
      s.job.shifts = 0; s.job.perfSum = 0;
      unlock(s, 'promoted');
      if (s.job.level === 4) unlock(s, 'top');
      log(s, 'Promoted to ' + c.titles[s.job.level] + '!', 'good');
      return 'Promoted to ' + c.titles[s.job.level] + '!';
    }
    return null;
  }

  /* ---------- travel ---------- */

  /* ---------- cities ---------- */
  function districtCity(k) { return (D.DISTRICTS[k] && D.DISTRICTS[k].city) || 'lagos'; }
  function cityOf(s) { return districtCity(s.loc); }
  function intercityOptions(s, city) {
    var here = cityOf(s), C = D.CITIES[city];
    if (!C) return [];
    if (city === here) return [];
    var jet = (s.vehicles || []).some(function (v) { return D.VEHICLES[v.id].kind === 'jet'; });
    var F = D.INTERCITY.flight, B = D.INTERCITY.bus, from = D.CITIES[here], h = hour(s);
    var fl = { mode: 'flight', name: jet ? 'Your private jet' : F.name, mins: jet ? 120 : F.mins, cost: jet ? 0 : price(s, F.fare), from: from.airport, to: C.airport };
    var bus = { mode: 'bus', name: B.name, mins: B.mins[here + '-' + city], cost: price(s, B.fare), from: from.park, to: C.park };
    [fl, bus].forEach(function (o) {
      if (s.loc !== o.from) o.disabled = 'Leaves from ' + D.DISTRICTS[o.from].name;
      else if (o.mode === 'bus' && (h >= 20 || h < 5)) o.disabled = 'No night buses: the roads are not safe after dark';
      else if (s.pending.length) o.disabled = 'Decide on the open event first';
      else if (s.over) o.disabled = 'This Weekly Lagos is over';
      else if (o.cost && !canAfford(s, o.cost)) o.disabled = 'Fare is ' + naira(o.cost);
    });
    return [fl, bus];
  }
  function intercity(s, city, mode) {
    var o = intercityOptions(s, city).filter(function (x) { return x.mode === mode; })[0];
    if (!o) return fail(D.CITIES[city] ? 'You are already in ' + D.CITIES[city].name + '.' : 'Unknown city.');
    if (o.disabled) return fail(o.disabled);
    s.alerts = [];
    if (o.cost && !pay(s, o.cost, o.name + ' to ' + D.CITIES[city].name)) return fail('Not enough for the fare.');
    var mins = o.mins, msg;
    if (mode === 'bus') {
      var r = rand(s);
      if (r < 0.15) { mins += 180; msg = 'A breakdown on the expressway added three hours.'; }
      else if (r < 0.25) { payPartial(s, price(s, 2000), 'Checkpoint "settlement"'); msg = 'Checkpoints all the way. You "settled" one of them.'; }
      advance(s, mins);
      applyFx(s, { energy: -25, hygiene: -25, stress: 12, hunger: -20 });
    } else {
      advance(s, mins);
      applyFx(s, { energy: -10, stress: 4 });
    }
    s.loc = o.to;
    s.stats.trips++;
    unlock(s, 'traveller');
    log(s, 'You arrived in ' + D.CITIES[city].name + ' (' + D.DISTRICTS[o.to].name + ').', 'good');
    return finish(s, ok('Welcome to ' + D.CITIES[city].name + '. ' + (msg || '')));
  }

  /* ---------- members-only waterfront clubs (new recorded calls jc and ca) ---------- */
  function clubMember(s, id) { var m = s.clubs && s.clubs[id]; return !!(m && m.until > s.t); }
  function clubQuote(s, id, via) {
    var C = D.CLUBS[id]; if (!C) return { disabled: 'No such club' };
    var m = s.clubs && s.clubs[id], first = !(m && m.joined);
    var q = { club: id, via: via, fee: first ? price(s, C.join) : 0, weekly: price(s, C.weekly) };
    q.total = q.fee + q.weekly;
    var worthOk = netWorth(s) >= price(s, C.minWorth), referOk = statusPoints(s) >= C.referStatus || skillLevel(s, 'charisma') >= C.referCharisma;
    q.worthOk = worthOk; q.referOk = referOk;
    if (first && via === 'worth' && !worthOk) q.disabled = 'Net worth of ' + naira(price(s, C.minWorth)) + ' needed';
    else if (first && via === 'referral' && !referOk) q.disabled = 'No member will vouch for you yet: status ' + C.referStatus + '+ or Charisma level ' + C.referCharisma + '+';
    else if (first && via !== 'worth' && via !== 'referral') q.disabled = 'Pick how you get in';
    else if (s.pending.length) q.disabled = 'Decide on the open event first';
    else if (s.over) q.disabled = 'This Weekly Lagos is over';
    else if (!canAfford(s, q.total)) q.disabled = 'You need ' + naira(q.total);
    return q;
  }
  function joinClub(s, id, via) {
    var q = clubQuote(s, id, via);
    if (q.disabled) return fail(q.disabled);
    s.alerts = [];
    var C = D.CLUBS[id];
    if (!pay(s, q.total, (q.fee ? 'Joining fee and first week, ' : 'Weekly membership, ') + C.name)) return fail('Not enough money.');
    s.clubs = s.clubs || {};
    var m = s.clubs[id] || {};
    s.clubs[id] = { joined: true, via: m.via || via, until: Math.max(m.until || 0, s.t) + 7 * 1440 };
    unlock(s, 'members_club');
    log(s, (q.fee ? 'You are in: ' : 'Membership renewed: ') + C.name + '.', 'good');
    return finish(s, ok((q.fee ? 'Welcome to ' : 'Another week at ') + C.name + '.'));
  }
  function clubActOptions(s, id) {
    var C = D.CLUBS[id]; if (!C) return [];
    return C.acts.map(function (a) {
      var o = { id: a.id, label: a.label, mins: a.mins, cost: price(s, a.cost || 0), when: a.when };
      if (!clubMember(s, id)) o.disabled = 'Members only';
      else if (s.loc !== C.district) o.disabled = 'Go to ' + D.DISTRICTS[C.district].name + ' first';
      else if (!inWindow(s, a.when)) o.disabled = 'Only ' + windowLabel(a.when);
      else if (s.pending.length) o.disabled = 'Decide on the open event first';
      else if (!canAfford(s, o.cost)) o.disabled = 'You need ' + naira(o.cost);
      return o;
    });
  }
  function clubAct(s, id, actId) {
    var C = D.CLUBS[id], o = clubActOptions(s, id).filter(function (x) { return x.id === actId; })[0];
    if (!o) return fail('Not on the club list.');
    if (o.disabled) return fail(o.disabled);
    s.alerts = [];
    var a = C.acts.filter(function (x) { return x.id === actId; })[0];
    if (o.cost && !pay(s, o.cost, C.name + ': ' + a.label)) return fail('Not enough money.');
    advance(s, a.mins); applyFx(s, a.fx); addXp(s, a.xp);
    log(s, a.label + ' at ' + C.name + '.', 'good');
    return finish(s, ok(a.label + '.'));
  }

  /* ---------- airport departures (new recorded calls; old lives never make them) ---------- */
  function ownsJet(s) { return (s.vehicles || []).some(function (v) { return D.VEHICLES[v.id] && D.VEHICLES[v.id].kind === 'jet'; }); }
  // A cab to the airport is included when you book from elsewhere in the same city.
  function cabLeg(s, airport) {
    if (s.loc === airport) return { cost: 0, mins: 0 };
    if (districtCity(s.loc) !== districtCity(airport)) return null;
    var o = travelOptions(s, airport).filter(function (x) { return x.mode === 'cab'; })[0];
    return o && !o.disabled ? { cost: o.cost, mins: o.mins } : null;
  }
  function flightQuote(s, city, cabin, insure) {
    var here = cityOf(s), C = D.CITIES[city], K = D.CABINS[cabin], A = D.AIR;
    if (!C || !K) return { disabled: 'Pick a city and a cabin' };
    if (city === here) return { disabled: 'You are already in ' + C.name };
    var from = D.CITIES[here], h = hour(s), rush = h >= A.rushFrom && h < A.rushTo ? A.rush : 1;
    var fare = Math.round(price(s, D.INTERCITY.flight.fare) * K.mult * rush / 100) * 100;
    var cab = cabLeg(s, from.airport), ins = insure ? Math.round(fare * A.insure / 100) * 100 : 0;
    var q = { city: city, cabin: cabin, fare: fare, rush: rush, cab: cab ? cab.cost : 0, insure: ins, mins: D.INTERCITY.flight.mins + (cab ? cab.mins : 0), from: from.airport, to: C.airport };
    q.total = fare + q.cab + ins;
    if (!cab) q.disabled = 'Get to ' + D.DISTRICTS[from.airport].name + ' first';
    else if (s.pending.length) q.disabled = 'Decide on the open event first';
    else if (s.over) q.disabled = 'This Weekly Lagos is over';
    else if (!canAfford(s, q.total)) q.disabled = 'You need ' + naira(q.total);
    return q;
  }
  function flyClass(s, city, cabin, insure) {
    var q = flightQuote(s, city, cabin, !!insure);
    if (q.disabled) return fail(q.disabled);
    s.alerts = [];
    var K = D.CABINS[cabin], C = D.CITIES[city];
    if (!pay(s, q.total, K.name + ' flight to ' + C.name + (q.cab ? ' (cab included)' : '') + (q.insure ? ', insured' : ''))) return fail('Not enough for the fare.');
    advance(s, q.mins);
    applyFx(s, K.fx);
    var msg = '';
    if (rand(s) < D.AIR.lostOdds) {
      if (insure) msg = 'The airline lost your bag. Insurance covered it.';
      else { payPartial(s, price(s, D.AIR.lostBag), 'Replacing a lost bag'); msg = 'The airline lost your bag. You had to replace your things.'; }
    }
    s.loc = q.to; s.stats.trips++;
    unlock(s, 'traveller'); if (cabin === 'first') unlock(s, 'first_class');
    log(s, 'You flew ' + K.name + ' to ' + C.name + '.', 'good');
    return finish(s, ok('Welcome to ' + C.name + '. ' + msg));
  }
  function jetQuote(s, city, charter) {
    var here = cityOf(s), C = D.CITIES[city];
    if (!C || city === here) return { disabled: C ? 'You are already in ' + C.name : 'Unknown city' };
    var from = D.CITIES[here], cab = cabLeg(s, from.airport);
    var q = { city: city, cost: price(s, charter ? D.AIR.charter : D.AIR.jetFuel) + (cab ? cab.cost : 0), mins: 110 + (cab ? cab.mins : 0), to: C.airport };
    if (!charter && !ownsJet(s)) q.disabled = 'You do not own a jet';
    else if (!cab) q.disabled = 'Get to ' + D.DISTRICTS[from.airport].name + ' first';
    else if (s.pending.length) q.disabled = 'Decide on the open event first';
    else if (s.over) q.disabled = 'This Weekly Lagos is over';
    else if (!canAfford(s, q.cost)) q.disabled = 'You need ' + naira(q.cost);
    return q;
  }
  function flyJet(s, city, charter) {
    var q = jetQuote(s, city, !!charter);
    if (q.disabled) return fail(q.disabled);
    s.alerts = [];
    if (!pay(s, q.cost, (charter ? 'Private jet charter to ' : 'Jet fuel and crew to ') + D.CITIES[city].name)) return fail('Not enough money.');
    advance(s, q.mins); applyFx(s, { energy: 4, stress: -10, fun: 10 });
    s.loc = q.to; s.stats.trips++;
    unlock(s, 'traveller'); unlock(s, 'private_jet');
    log(s, 'You flew private to ' + D.CITIES[city].name + '. No queue, no boarding.', 'good');
    return finish(s, ok('Wheels down in ' + D.CITIES[city].name + '.'));
  }
  function chopperQuote(s, placeId) {
    var pl = D.PLACES.filter(function (p) { return p.id === placeId; })[0];
    if (!pl) return { disabled: 'Pick where to land' };
    var cross = districtCity(pl.district) !== cityOf(s);
    var q = { place: placeId, cost: price(s, cross ? D.AIR.chopperIntercity : D.AIR.chopperCity), mins: cross ? 100 : 25, to: pl.district };
    if (s.loc === pl.district) q.disabled = 'You are already in ' + D.DISTRICTS[pl.district].name;
    else if (s.pending.length) q.disabled = 'Decide on the open event first';
    else if (s.over) q.disabled = 'This Weekly Lagos is over';
    else if (!canAfford(s, q.cost)) q.disabled = 'You need ' + naira(q.cost);
    return q;
  }
  function chopperTo(s, placeId) {
    var q = chopperQuote(s, placeId);
    if (q.disabled) return fail(q.disabled);
    s.alerts = [];
    var pl = D.PLACES.filter(function (p) { return p.id === placeId; })[0];
    if (!pay(s, q.cost, 'VIP chopper to ' + pl.name)) return fail('Not enough money.');
    advance(s, q.mins); applyFx(s, { stress: -6, fun: 12 });
    s.loc = q.to; s.stats.trips++; unlock(s, 'chopper');
    log(s, 'A chopper dropped you at ' + pl.name + '.', 'good');
    return finish(s, ok('Straight to the door: ' + pl.name + '.'));
  }

  function distance(a, b) {
    var A = D.DISTRICTS[a], B = D.DISTRICTS[b];
    return Math.round(Math.hypot(A.x - B.x, A.y - B.y) * 1.3 * 10) / 10;
  }

  function traffic(s, crossing) {
    var h = hour(s), f;
    if (h < 6) f = 1; else if (h < 10) f = 2.2; else if (h < 16) f = 1.4; else if (h < 21) f = 2.5; else f = 1.3;
    if (crossing && f > 2) f *= 1.2; // Third Mainland Bridge at rush hour
    return f;
  }

  /* ---------- weather (rules 9) ---------- */
  // Seeded by the life and the day, never by s.rng, so it is the same on replay.
  function monthOfDay(s, d) { var t0 = s.t; s.t = d * 1440; var m = monthIndex(s); s.t = t0; return m; }
  function weatherOn(s, d) {
    var m = monthOfDay(s, d), u = parseInt(fnv(s.seed + ':wx:' + d), 16) / 4294967296, v = parseInt(fnv(s.seed + ':wx2:' + d), 16) / 4294967296;
    if (u < D.WEATHER_MONTHS[m]) return v < 0.15 ? 'storm' : 'rain';
    if (v < (D.HARMATTAN_MONTHS[m] || 0)) return 'harmattan';
    return 'clear';
  }
  function weatherNow(s) {
    if (!(s.rules >= 9)) return null;
    var w = weatherOn(s, day(s)), h = hour(s);
    if ((w === 'rain' || w === 'storm') && (h < 11 || h >= 18)) return 'clear';
    return w;
  }
  function weatherForecast(s, n) {
    var out = [], d = day(s);
    for (var i = 0; i < (n || 7); i++) out.push({ day: d + i, wx: s.rules >= 9 ? weatherOn(s, d + i) : 'clear' });
    return out;
  }
  // The rail line that serves both districts, if any.
  function railLine(a, b) { var L = D.RAIL_LINES || {}; return Object.keys(L).filter(function (k) { return L[k].stops.indexOf(a) >= 0 && L[k].stops.indexOf(b) >= 0; })[0] || null; }
  var WET_MODES = { trek: 1, okada: 1, keke: 1, danfo: 1, brt: 1, ferry: 1 };

  function travelOptions(s, dest) {
    var from = s.loc;
    if (from === dest) return [];
    if (districtCity(from) !== districtCity(dest)) return Object.keys(D.MODES).map(function (id) { return { mode: id, name: D.MODES[id].name, km: 0, mins: 0, cost: 0, disabled: 'That is in ' + D.CITIES[districtCity(dest)].name + '. Fly or take a bus.' }; });
    var km = distance(from, dest);
    var crossing = D.DISTRICTS[from].side !== D.DISTRICTS[dest].side;
    var flood = s.econ.flood > 0 && (D.DISTRICTS[dest].side === 'island' || D.DISTRICTS[from].side === 'island');
    var wx = weatherNow(s), wet = wx === 'rain' || wx === 'storm';
    return Object.keys(D.MODES).map(function (id) {
      var m = D.MODES[id];
      var o = { mode: id, name: m.name, km: km };
      var ride = id === 'car' ? bestCar(s) : null;
      if (m.needsCar && !s.car && !ride) o.disabled = 'You do not own a car';
      else if (m.needsKind && !(s.vehicles || []).some(function (v) { return D.VEHICLES[v.id].kind === m.needsKind; })) o.disabled = m.needsKind === 'heli' ? 'You do not own a helicopter' : 'You do not own a boat';
      else if (m.stops === 'ferry' && (D.FERRY_STOPS.indexOf(from) < 0 || D.FERRY_STOPS.indexOf(dest) < 0)) o.disabled = 'No jetty on this route';
      else if (m.stops === 'brt' && (D.BRT_STOPS.indexOf(from) < 0 || D.BRT_STOPS.indexOf(dest) < 0)) o.disabled = 'No BRT on this route';
      else if (m.stops === 'rail' && !railLine(from, dest)) o.disabled = 'No train on this route';
      else if (m.noBridge && crossing) o.disabled = 'Keke cannot use the bridges';
      else if (km > m.maxKm) o.disabled = 'Too far (' + km + ' km)';
      else if (wx === 'storm' && (id === 'okada' || id === 'keke')) o.disabled = 'Riders have parked till the storm passes';
      else if (wx === 'storm' && (id === 'ferry' || id === 'boat')) o.disabled = 'Boats are not sailing in this storm';
      var f = 1;
      if (m.road) {
        f = traffic(s, crossing);
        if (m.weave) f = 1 + (f - 1) * m.weave;
        if (flood) f *= 1.6;
        if (wet) f *= wx === 'storm' ? 1.7 : 1.35;
        if (s.rules >= 14 && isDecember(s) && districtCity(from) === 'lagos') f *= 1.3; // December go-slow
      }
      o.traffic = Math.round(f * 10) / 10;
      var spd = ride ? Math.max(m.speed, ride.speed) : m.speed;
      o.mins = Math.max(STEP, ceilTo(m.wait + km / spd * 60 * f, STEP));
      if (m.stops === 'rail' && !o.disabled && (hour(s) < 6 || minuteOfDay(s) + o.mins > 21 * 60)) o.disabled = 'Trains run 06:00 to 21:00';
      var fare;
      if (id === 'ferry' || m.flat) fare = m.min;
      else fare = Math.max(m.min, (ride ? ride.fuel : m.perKm) * km);
      if (id !== 'trek' && !m.flat) fare *= s.econ.fuel;
      if (s.econ.policy === 'fares' && id !== 'car' && id !== 'trek') fare *= 0.8;
      o.cost = id === 'trek' ? 0 : roundTo(fare * priceFactor(s), 50);
      o.risk = id === 'okada' && (okadaBanned(s, from) || okadaBanned(s, dest)) ? 'Okada is banned here. Task force may seize it.' : null;
      if (id === 'trek') o.energy = Math.round(m.energyPerKm * km * (wet ? 1.3 : 1));
      if (wet && WET_MODES[id]) o.wet = true;
      if (!o.disabled && s.over) o.disabled = 'This Weekly Lagos is over';
      if (!o.disabled && s.japa) o.disabled = 'You have japa-ed';
      if (!o.disabled && s.pending.length) o.disabled = 'Decide on the open event first';
      if (!o.disabled && o.cost && !canAfford(s, o.cost)) o.disabled = 'Fare is ' + naira(o.cost);
      if (!o.disabled && id === 'trek' && s.needs.energy - o.energy - DECAY.energy * o.mins / 60 <= 5) o.disabled = 'Too tired to trek that far';
      return o;
    });
  }

  function travel(s, dest, mode) {
    s.alerts = [];
    if (!D.DISTRICTS[dest]) return fail('Unknown place.');
    var o = travelOptions(s, dest).filter(function (x) { return x.mode === mode; })[0];
    if (!o) return fail('You are already here.');
    if (o.disabled) return fail(o.disabled);
    if (o.cost && !pay(s, o.cost, D.MODES[mode].name + ' to ' + D.DISTRICTS[dest].name)) return fail('Not enough for the fare.');
    var night = hour(s) >= 21 || hour(s) < 5;
    advance(s, o.mins);
    if (o.energy) applyFx(s, { energy: -o.energy, hygiene: -o.km * 2 });
    var m = D.MODES[mode];
    if (m.stress) applyFx(s, { stress: m.stress * o.traffic * o.mins / 60 });
    if (mode === 'cab' || mode === 'ferry') applyFx(s, { stress: -3 });
    var soaked = o.wet && !outfitTags(s).rain;
    if (soaked) applyFx(s, { hygiene: -10, stress: 4 });
    s.loc = dest;
    s.stats.trips++;
    if (s.stats.trips >= 50) unlock(s, 'commuter');
    if (mode === 'ferry') unlock(s, 'ferry');
    var msg = 'You reached ' + D.DISTRICTS[dest].name + ' in ' + fmtMins(o.mins) + '.' + (soaked ? ' You are soaked: rain, no umbrella.' : '');
    if (mode === 'car' && s.rules >= 12) { var bd = carWear(s, o.km); if (bd) msg += ' ' + bd; }
    if (mode === 'car' && s.rules >= 14 && GROUND_MONEY[dest] && rand(s) < 0.3) {
      var gm = price(s, 1000); payPartial(s, gm, 'Ground money (area boys)');
      msg += ' Area boys "helped" you park and collected ' + naira(gm) + ' ground money.';
    }
    if (o.risk && rand(s) < 0.2) {
      var fine = price(s, 5000);
      payPartial(s, fine, 'Task force fine');
      advance(s, 60);
      msg = 'Task force stopped your okada. You paid a fine and lost an hour.';
      log(s, msg, 'bad');
    } else if (mode === 'car' && rand(s) < 0.03) {
      var lf = price(s, 20000);
      if (!pay(s, lf, 'LASTMA fine')) addDebt(s, lf, 'LASTMA fine');
      msg += ' LASTMA booked you for "obstruction".';
    } else if ((mode === 'cab' || mode === 'car') && night && rand(s) < 0.25) {
      queue(s, { id: 'police', title: 'Checkpoint', text: 'An officer flags you down. "Anything for the boys?"', options: ['Give ' + naira(price(s, 2000)), 'Show your papers and argue'] });
    } else if ((mode === 'danfo' || mode === 'okada') && night && rand(s) < 0.05) {
      var lost = Math.min(s.cash, price(s, 15000));
      if (lost) { post(s, 'cash', -lost, 'Phone snatched in traffic'); msg += ' Someone snatched your phone and cash on the way.'; }
    }
    return finish(s, ok(msg));
  }

  function fmtMins(m) {
    if (m >= 1440) { var dd = Math.floor(m / 1440), hh = Math.floor(m % 1440 / 60); return dd + 'd' + (hh ? ' ' + hh + 'h' : ''); }
    var h = Math.floor(m / 60), r = m % 60;
    return (h ? h + 'h' : '') + (r ? (h ? ' ' : '') + r + 'm' : '');
  }

  /* ---------- events ---------- */

  function queue(s, ev) { s.pending.push(ev); }

  function queueAreaBoys(s) {
    queue(s, { id: 'areaboys', title: 'Owo ijoko', text: 'Two agberos block your spot. "Settle us before you sell here."', options: ['Pay ' + naira(price(s, 500)), 'Refuse'] });
  }

  function queueVote(s) {
    var ids = Object.keys(D.POLICIES);
    queue(s, {
      id: 'vote', title: 'Governorship vote',
      text: 'Lagosians vote on the next policy. It lasts 4 weeks. Your vote counts, but so does everyone else\'s.',
      options: ids.map(function (k) { return D.POLICIES[k].name + ': ' + D.POLICIES[k].text; }),
      ids: ids
    });
  }

  function queueCbn(s) {
    var ids = Object.keys(D.CBN);
    queue(s, {
      id: 'cbn', title: 'CBN governor race',
      text: 'Three candidates want the Central Bank. The winner sets interest rates and the pace of inflation for 4 weeks.',
      options: ids.map(function (k) { return D.CBN[k].icon + ' ' + D.CBN[k].name + ': ' + D.CBN[k].text; }),
      ids: ids
    });
  }
  // The current CBN stance's value for a key, or the normal value.
  function cbnOf(s, key, normal) { var c = s.econ.cbn && D.CBN[s.econ.cbn]; return c && c[key] != null ? c[key] : normal; }
  function savingsRate(s) { return cbnOf(s, 'save', BANK_RATE); }
  function billRate(s) { return cbnOf(s, 'bill', BOND_RATE); }

  function dailyEvent(s) {
    if (rand(s) > 0.5) return;
    var pool = [];
    pool.push(['grid', 3]);
    if (!s.econ.fuelDays) pool.push(['fuel', 1.2]);
    if (isRainy(s) && !s.econ.flood) pool.push(['flood', 1.2]);
    if (s.cash + s.bank > 15000) pool.push(['blacktax', 1.5]);
    if (s.bank > 5000) pool.push(['scam', 1.2]);
    if (!s.ponzi && s.cash + s.bank >= 30000) pool.push(['ponzi', 0.8]);
    if (s.rentRate && s.econ.policy !== 'tenancy') pool.push(['landlord', 0.6]);
    if (dow(s) === 4) pool.push(['owambe', 3]);
    var offer = jobOfferNpc(s);
    if (offer) pool.push(['offer', 1.5]);
    if (s.rules >= 6) {
      if (!s.partner && s.needs.social >= 40) pool.push(['crush', 1.4]);
      if (s.partner && s.partner.stage === 'dating' && s.partner.aff >= 60) pool.push(['intro', 2]);
    }
    var total = pool.reduce(function (a, p) { return a + p[1]; }, 0);
    var r = rand(s) * total, ev = pool[0][0];
    for (var i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) { ev = pool[i][0]; break; } }

    switch (ev) {
      case 'grid':
        s.econ.gridDown = 1; s.power = false;
        log(s, 'National grid collapse. Light is scarce everywhere today. Gens are roaring.', 'bad');
        break;
      case 'fuel':
        s.econ.fuelDays = 3; s.econ.fuel = 1.6;
        log(s, 'Fuel scarcity. Queues everywhere, fares up 60% for 3 days, gen fuel costs more.', 'bad');
        break;
      case 'flood':
        s.econ.flood = 1;
        log(s, 'Heavy rain overnight. Lekki, VI and Ajah roads are flooded today.', 'bad');
        break;
      case 'blacktax':
        var amt = Math.max(5000, roundTo((s.cash + s.bank) * 0.1, 500));
        queue(s, { id: 'blacktax', title: 'Family call', text: 'Your aunty in Ibadan calls. Your cousin\'s school fees are due. Can you send ' + naira(amt) + '?', options: ['Send ' + naira(amt), 'Say you are broke'], amt: amt });
        break;
      case 'scam':
        queue(s, { id: 'scam', title: 'SMS from "Your Bank"', text: 'Dear customer, your BVN has been blocked. Click bit.ly/restore-bvn to restore your account within 24 hrs.', options: ['Click the link', 'Delete it'] });
        break;
      case 'ponzi':
        var stake = Math.max(20000, roundTo((s.cash + s.bank) * 0.2, 1000));
        queue(s, { id: 'ponzi', title: 'Double your money', text: 'A friend swears by CryptoDoubla: 40% returns every week, "guaranteed". Put in ' + naira(stake) + '?', options: ['Invest ' + naira(stake), 'No thanks'], amt: stake });
        break;
      case 'landlord':
        var inc = roundTo(s.rentRate * 0.15, 50);
        queue(s, { id: 'landlord', title: 'Landlord\'s notice', text: 'Your landlord is raising the rent by ' + naira(inc) + ' a week, "because of the economy".', options: ['Accept', 'Negotiate (Charisma)'], amt: inc });
        break;
      case 'owambe':
        queue(s, { id: 'owambe', title: 'Owambe invite', text: 'Your friend\'s mum is 60 on Saturday. Aso-ebi is ' + naira(price(s, 12000)) + '. Owambe runs 12:00–19:00 in Surulere.', options: ['Buy the aso-ebi', 'Go in your own clothes'], amt: price(s, 12000) });
        break;
      case 'crush':
        var nm = pick(s, PARTNER_NAMES), where = pick(s, ['a friend\'s birthday', 'church', 'the gym', 'a wedding in Surulere', 'a tech meetup in Yaba', 'the danfo to Oshodi', 'Balogun market']);
        queue(s, { id: 'crush', title: 'Someone special', text: 'At ' + where + ', you and ' + nm + ' could not stop talking. Exchange numbers?', options: ['Collect the number', 'Not now'], name: nm });
        break;
      case 'intro':
        var list = price(s, 300000);
        queue(s, { id: 'intro', title: 'Meet the family', text: s.partner.name + '\'s family wants to meet you properly. The introduction "list" (drinks, gifts, kola) comes to ' + naira(list) + '.', options: ['Do the introduction (' + naira(list) + ')', 'Not yet'], amt: list });
        break;
      case 'offer':
        queue(s, { id: 'offer', title: D.NPCS[offer].name + ' has a job for you', text: D.NPCS[offer].name + ' can get you in as ' + D.CAREERS[D.NPCS[offer].career].titles[0] + ' (' + D.CAREERS[D.NPCS[offer].career].name + '). No interview.', options: ['Take it', 'Not now'], npc: offer });
        break;
    }
  }

  function jobOfferNpc(s) {
    var keys = Object.keys(D.NPCS);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (s.friends[k].lvl >= 60 && (!s.job || s.job.id !== D.NPCS[k].career)) return k;
    }
    return null;
  }

  function resolveChoice(s, idx) {
    s.alerts = [];
    var ev = s.pending[0];
    if (!ev) return fail('Nothing to decide.');
    if (idx < 0 || idx >= ev.options.length) return fail('Pick one of the options.');
    s.pending.shift();
    var msg = '';
    switch (ev.id) {
      case 'blacktax':
        if (idx === 0) {
          if (pay(s, ev.amt, 'Sent to Aunty for school fees')) { applyFx(s, { stress: -10, social: 10 }); msg = 'Aunty is praying for you. Your cousin is back in school.'; }
          else msg = 'You could not afford it after all.';
        } else { applyFx(s, { stress: 12 }); msg = 'Aunty hissed and hung up. The family WhatsApp group is quiet.'; }
        break;
      case 'scam':
        if (idx === 0) {
          var lost = Math.min(s.bank, roundTo(s.bank * 0.4, 50), price(s, 300000));
          if (lost) post(s, 'bank', -lost, 'Unauthorised transfer');
          applyFx(s, { stress: 25 });
          msg = 'The link asked for your OTP. ' + naira(lost) + ' left your account. Banks never ask for your PIN or OTP.';
          log(s, msg, 'bad');
        } else { unlock(s, 'sharp'); msg = 'Deleted. Your bank never sends links asking for your BVN.'; }
        break;
      case 'ponzi':
        if (idx === 0) {
          if (pay(s, ev.amt, 'CryptoDoubla "investment"')) { s.ponzi = { amt: ev.amt, week: week(s) + 2 }; msg = 'You are "in". Payout in two weeks, they say.'; }
          else msg = 'You could not afford it.';
        } else msg = 'If it sounds too good to be true, it is.';
        break;
      case 'landlord':
        if (idx === 1 && rand(s) < 0.15 + skillLevel(s, 'charisma') * 0.08) {
          msg = 'You sweet-talked the landlord. Rent stays the same.';
        } else {
          s.rentRate += ev.amt;
          msg = (idx === 1 ? 'Negotiation failed. ' : '') + 'Rent is now ' + naira(s.rentRate) + ' a week.';
        }
        break;
      case 'owambe':
        if (idx === 0 && pay(s, ev.amt, 'Aso-ebi')) { s.asoebi = true; msg = 'Your aso-ebi is ready. See you at the owambe on Saturday.'; }
        else msg = 'You will still go. Just not in the family colours.';
        break;
      case 'offer':
        if (idx === 0) {
          var cid = D.NPCS[ev.npc].career;
          applyJob(s, cid, true);
          msg = 'You are now ' + D.CAREERS[cid].titles[0] + '. Report to ' + D.DISTRICTS[D.CAREERS[cid].district].name + '.';
        } else msg = 'Maybe another time.';
        break;
      case 'crush':
        if (idx === 0) {
          s.partner = { name: ev.name, aff: 30, stage: 'dating', met: day(s), contact: day(s), dated: -1, called: -1, since: -1 };
          applyFx(s, { social: 10, fun: 10, stress: -5 });
          msg = 'You and ' + ev.name + ' are talking. Call often and take ' + ev.name + ' out to keep it going.';
        } else msg = 'Maybe another time.';
        break;
      case 'intro':
        if (idx === 0 && pay(s, ev.amt, 'Introduction list')) {
          s.partner.stage = 'introduced'; s.partner.aff = Math.min(100, s.partner.aff + 10);
          applyFx(s, { social: 20, stress: 8 });
          msg = 'The families got on well. Plan the wedding from the Me tab when you are ready.';
        } else { s.partner.aff = Math.max(0, s.partner.aff - 10); msg = s.partner.name + ' is disappointed.'; }
        break;
      case 'baby':
        if (idx === 0) {
          s.kids.push({ born: day(s), school: null, nextFees: day(s) + 84 });
          s.babyPause = week(s) + 10;
          unlock(s, 'parent');
          applyFx(s, { social: 20, fun: 15, stress: 10 });
          msg = 'Congratulations! A baby has joined the family. Babies cost ' + naira(price(s, 4000)) + ' a week; school fees start in 12 weeks.';
          log(s, msg, 'good');
        } else { s.babyPause = week(s) + 8; msg = 'You agree to wait.'; }
        break;
      case 'school':
        var kid = s.kids[ev.kid], tier = ['public', 'private', 'intl'][idx];
        if (kid) { kid.school = tier; msg = 'You chose a ' + SCHOOLS[tier].name + '. Fees are ' + naira(price(s, SCHOOLS[tier].fee)) + ' a term.'; chargeFees(s, kid); }
        break;
      case 'ijgb':
        if (idx === 0) {
          payPartial(s, price(s, 30000), 'Showing an IJGB around Lagos');
          applyFx(s, { social: 30, fun: 25, energy: -15 });
          msg = 'Suya at night, a beach club by day: ' + ev.who + ' loved it.';
          if (rand(s) < 0.5) { var gift = price(s, roundTo(50000 + rand(s) * 100000, 5000)); earn(s, gift, 'IJGB gift (dollars changed at the BDC)'); msg += ' They pressed ' + naira(gift) + ' into your hand at the airport.'; }
        } else if (idx === 1) {
          payPartial(s, price(s, 8000), 'Family jollof for an IJGB');
          applyFx(s, { social: 20, fun: 10 });
          msg = 'Mama\'s jollof, the whole family, and ' + ev.who + ' asking where the light went.';
          if (rand(s) < 0.25) { var g2 = price(s, 30000); earn(s, g2, 'IJGB gift (dollars changed at the BDC)'); msg += ' They left you ' + naira(g2) + '.'; }
        } else { applyFx(s, { stress: 5, fun: -5 }); msg = 'You stayed out of sight. The family group chat noticed.'; }
        break;
      case 'police':
        if (idx === 0) { payPartial(s, price(s, 2000), 'Checkpoint "settlement"'); msg = 'He waves you through.'; }
        else { advance(s, 45); applyFx(s, { stress: 10 }); msg = 'Forty-five minutes of argument, then he lets you go.'; }
        break;
      case 'areaboys':
        if (idx === 0) { payPartial(s, price(s, 500), 'Owo ijoko'); msg = 'They leave you alone.'; }
        else if (rand(s) < 0.4) { var t = Math.min(s.cash, price(s, 1500)); if (t) post(s, 'cash', -t, 'Taken by area boys'); applyFx(s, { stress: 15 }); msg = 'They took ' + naira(t) + ' from your pocket.'; }
        else { applyFx(s, { stress: 5 }); msg = 'You stood your ground. They moved on.'; }
        break;
      case 'cbn':
        var cids = ev.ids, cw = cids.map(function () { return 1 + rand(s) * 2; });
        cw[idx] += 1.5;
        var ct = cw.reduce(function (a, b) { return a + b; }, 0), cr = rand(s) * ct, cwin = cids[0];
        for (var ci = 0; ci < cids.length; ci++) { cr -= cw[ci]; if (cr <= 0) { cwin = cids[ci]; break; } }
        s.econ.cbn = cwin; s.econ.cbnWeeks = 4;
        msg = D.CBN[cwin].icon + ' ' + D.CBN[cwin].name + ' is the new CBN governor. ' + D.CBN[cwin].text + (cwin === cids[idx] ? ' Your candidate won.' : '');
        log(s, msg, 'story');
        break;
      case 'vote':
        var ids = ev.ids, weights = ids.map(function () { return 1 + rand(s) * 2; });
        weights[idx] += 1.5;
        var total = weights.reduce(function (a, b) { return a + b; }, 0), r = rand(s) * total, win = ids[0];
        for (var i = 0; i < ids.length; i++) { r -= weights[i]; if (r <= 0) { win = ids[i]; break; } }
        s.econ.policy = win; s.econ.policyWeeks = 4;
        msg = 'Results are in: ' + D.POLICIES[win].name + ' won. ' + D.POLICIES[win].text + (win === ids[idx] ? ' Your side won.' : '');
        log(s, msg, 'story');
        break;
    }
    if (msg && ev.id !== 'scam' && ev.id !== 'vote' && ev.id !== 'cbn') log(s, msg, 'info');
    return finish(s, ok(msg));
  }

  function resolvePonzi(s) {
    if (!s.ponzi || week(s) < s.ponzi.week) return;
    var p = s.ponzi; s.ponzi = null;
    if (rand(s) < 0.15) {
      earn(s, roundTo(p.amt * 1.8, 50), 'CryptoDoubla payout');
      unlock(s, 'ponzi_win');
      log(s, 'CryptoDoubla actually paid you ' + naira(roundTo(p.amt * 1.8, 50)) + '. It collapsed the next day for everyone else.', 'good');
    } else {
      unlock(s, 'ponzi_burn');
      log(s, 'CryptoDoubla\'s website is gone and the WhatsApp admin has blocked everyone. Your ' + naira(p.amt) + ' is gone.', 'bad');
    }
  }

  /* ---------- banking, ajo, loans ---------- */

  function deposit(s, amt) {
    amt = Math.floor(amt);
    if (!(amt > 0) || amt > s.cash) return fail('You only have ' + naira(s.cash) + ' in cash.');
    s.alerts = [];
    post(s, 'cash', -amt, 'Transfer'); post(s, 'bank', amt, 'Transfer');
    return ok('Deposited ' + naira(amt) + '.');
  }
  function withdraw(s, amt) {
    amt = Math.floor(amt);
    if (!(amt > 0) || amt > s.bank) return fail('Your bank balance is ' + naira(s.bank) + '.');
    s.alerts = [];
    post(s, 'bank', -amt, 'Transfer'); post(s, 'cash', amt, 'Transfer');
    return ok('Withdrew ' + naira(amt) + '.');
  }

  // Treasury bills: money leaves savings for 7 days and comes back with 1%.
  function buyBond(s, amt) {
    amt = Math.floor(amt);
    if (!(amt >= 10000)) return fail('The smallest bill is ' + naira(10000) + '.');
    if (amt > s.bank) return fail('Bills are paid from savings. You have ' + naira(s.bank) + ' saved.');
    if ((s.bonds || []).length >= 20) return fail('You hold 20 bills already. Wait for one to mature.');
    s.alerts = [];
    post(s, 'bank', -amt, 'Treasury bill bought');
    var br = billRate(s);
    s.bonds.push(br === BOND_RATE ? { amt: amt, due: day(s) + BOND_DAYS } : { amt: amt, due: day(s) + BOND_DAYS, rate: br });
    return ok(naira(amt) + ' in a ' + BOND_DAYS + '-day bill. It pays ' + naira(bondReturn(amt, br)) + ' on day ' + (day(s) + BOND_DAYS) + '.');
  }
  function bondReturn(amt, rate) { return Math.floor(amt * (rate || BOND_RATE)); }
  function bondsHeld(s) { return (s.bonds || []).reduce(function (a, b) { return a + b.amt; }, 0); }
  function matureBonds(s) {
    if (!s.bonds || !s.bonds.length) return;
    var d = day(s);
    s.bonds = s.bonds.filter(function (b) {
      if (b.due > d) return true;
      post(s, 'bank', b.amt, 'Treasury bill matured');
      post(s, 'bank', bondReturn(b.amt, b.rate), 'Treasury bill interest');
      log(s, 'A treasury bill matured: ' + naira(b.amt + bondReturn(b.amt, b.rate)) + ' is back in your savings.', 'good');
      return false;
    });
  }

  function joinAjo(s, contrib) {
    if (AJO_SIZES.indexOf(contrib) < 0) return fail('Pick one of the contribution sizes.');
    if (s.ajo) return fail('You are already in an ajo.');
    s.ajo = { contrib: contrib, slot: 1 + Math.floor(rand(s) * AJO_MEMBERS), round: 0, paid: 0, received: false };
    log(s, 'You joined a ' + naira(contrib) + '/week ajo with 5 market women. Your turn to collect is week ' + s.ajo.slot + ' of ' + AJO_MEMBERS + '.', 'good');
    return ok('Joined. Contributions start Monday.');
  }

  function weeklyAjo(s) {
    var a = s.ajo;
    if (!a) return;
    a.round++;
    if (!pay(s, a.contrib, 'Ajo contribution')) {
      log(s, 'You missed your ajo contribution. The group has thrown you out and the collector is keeping what you paid.', 'bad');
      applyFx(s, { social: -20, stress: 15 });
      s.ajo = null;
      return;
    }
    a.paid += a.contrib;
    if (!a.received && rand(s) < 0.012) {
      log(s, 'The ajo collector has disappeared with everyone\'s money. You lost ' + naira(a.paid) + '.', 'bad');
      s.ajo = null;
      return;
    }
    if (a.round === a.slot) {
      var pot = a.contrib * (AJO_MEMBERS - 1); // collector keeps one share as commission
      earn(s, pot, 'Ajo payout');
      a.received = true;
      log(s, 'It is your turn. You collected ' + naira(pot) + ' from the ajo.', 'good');
    }
    if (a.round >= AJO_MEMBERS) {
      unlock(s, 'ajo');
      log(s, 'Ajo cycle complete.', 'info');
      s.ajo = null;
    }
  }

  function loanLimit(s, kind) {
    if (kind === 'coop') {
      if (!s.job || s.stats.shifts < 10) return 0;
      return roundTo(D.CAREERS[s.job.id].pay[s.job.level] * 10 * cbnOf(s, 'coop', 1), 1000);
    }
    return LOANS[kind].max;
  }

  function loanRate(s, kind) { var m = cbnOf(s, 'loan', 1); return m === 1 ? LOANS[kind].rate : Math.round(LOANS[kind].rate * m * 10000) / 10000; }
  function takeLoan(s, kind, amt) {
    var L = LOANS[kind];
    if (!L) return fail('Unknown loan.');
    amt = Math.floor(amt);
    if (s.loans.some(function (l) { return l.kind === kind && l.bal > 0; })) return fail('Repay your current ' + L.name + ' first.');
    var max = loanLimit(s, kind);
    if (!max) return fail(kind === 'coop' ? 'You need a job and 10 shifts to join the cooperative.' : 'Not available.');
    if (!(amt > 0) || amt > max) return fail('You can borrow up to ' + naira(max) + '.');
    s.alerts = [];
    post(s, 'bank', amt, L.name);
    var rate = loanRate(s, kind);
    s.loans.push({ kind: kind, name: L.name, bal: amt, rate: rate, weeksLeft: L.weeks, principal: amt });
    log(s, 'Borrowed ' + naira(amt) + ' (' + L.name + ', ' + (Math.round(rate * 1000) / 10) + '% a week, ' + L.weeks + ' weeks).', 'info');
    return ok('Loan paid into your bank.');
  }

  function repayLoan(s, i, amt) {
    var l = s.loans[i];
    if (!l || l.bal <= 0) return fail('No such loan.');
    amt = Math.min(Math.floor(amt), l.bal);
    if (!(amt > 0)) return fail('Enter an amount.');
    s.alerts = [];
    if (!pay(s, amt, 'Repay ' + l.name)) return fail('Not enough money.');
    l.bal -= amt;
    cleanLoans(s);
    return ok('Repaid ' + naira(amt) + '.');
  }

  function cleanLoans(s) {
    var had = s.loans.length;
    s.loans = s.loans.filter(function (l) { return l.bal > 0; });
    if (had && !s.loans.length) unlock(s, 'debt_free');
  }

  function weeklyLoans(s) {
    s.loans.forEach(function (l) {
      if (l.bal <= 0) return;
      if (l.rate) l.bal = Math.round(l.bal * (1 + l.rate));
      l.weeksLeft--;
      if (l.weeksLeft > 0) return;
      if (l.kind === 'app') {
        applyFx(s, { social: -25, stress: 25 });
        Object.keys(s.friends).forEach(function (k) { s.friends[k].lvl = Math.max(0, s.friends[k].lvl - 5); });
        log(s, 'QuickCash has messaged everyone in your contacts calling you a thief. You owe ' + naira(l.bal) + '.', 'bad');
      } else {
        var taken = payPartial(s, l.bal, 'Overdue ' + l.name + ' (auto-debit)');
        l.bal -= taken;
        if (l.bal > 0) { applyFx(s, { stress: 15 }); log(s, 'The ' + l.name + ' officer came to your house. You still owe ' + naira(l.bal) + '.', 'bad'); }
      }
    });
    cleanLoans(s);
  }

  /* ---------- assets ---------- */

  // site is optional: lives recorded before sites existed buy without one.
  function buyBusiness(s, id, site) {
    var b = D.BUSINESSES[id];
    if (!b) return fail('Unknown business.');
    if (site != null && !D.BUSINESS_SITES[site]) return fail('Pick a district for your business.');
    if (site != null && s.businesses.length >= 12) return fail('You run 12 businesses already.');
    var cost = price(s, b.price);
    s.alerts = [];
    if (!pay(s, cost, 'Bought ' + b.name)) return fail('You need ' + naira(cost) + '.');
    var rec = { id: id, paid: cost, visit: day(s) };
    if (site != null) { rec.site = site; rec.level = 1; }
    s.businesses.push(rec);
    log(s, 'You now own a ' + b.name + '. It pays out at 18:00 daily. Visit at least weekly or staff will chop the money.', 'good');
    return finish(s, ok('Business bought.'));
  }

  function sellBusiness(s, i) {
    var b = s.businesses[i];
    if (!b) return fail('No such business.');
    var v = roundTo(b.paid * 0.6, 50);
    s.alerts = [];
    s.businesses.splice(i, 1);
    earn(s, v, 'Sold ' + D.BUSINESSES[b.id].name);
    return finish(s, ok('Sold for ' + naira(v) + '.'));
  }

  function businessName(b) { var g = D.BUSINESS_GROWTH[b.id]; return g && b.level ? g.names[b.level - 1] : D.BUSINESSES[b.id].name; }
  function upgradeCost(s, b) { return b.level && b.level < 3 ? price(s, D.BUSINESSES[b.id].price * D.BUSINESS_LEVEL.cost[b.level]) : 0; }
  function managerPay(s, b) { return roundTo(D.BUSINESSES[b.id].daily * 0.08 * 7 * s.econ.infl * D.BUSINESS_LEVEL.mult[(b.level || 1) - 1], 500); }

  function upgradeBusiness(s, i) {
    var b = s.businesses[i];
    if (!b) return fail('No such business.');
    if (!b.level) return fail('Rebuild it on a site to grow it.');
    if (b.level >= 3) return fail('Already as big as it gets.');
    var cost = upgradeCost(s, b), from = businessName(b);
    s.alerts = [];
    if (!pay(s, cost, 'Business upgrade: ' + from)) return fail('The upgrade costs ' + naira(cost) + '.');
    b.level++; b.paid += cost;
    log(s, 'Your ' + from + ' is now a ' + businessName(b) + '.', 'good');
    return finish(s, ok('Upgraded to ' + businessName(b) + '.'));
  }
  function hireManager(s, i) {
    var b = s.businesses[i];
    if (!b) return fail('No such business.');
    if (!b.level) return fail('Rebuild it on a site to hire a manager.');
    if (b.manager) return fail('It already has a manager.');
    b.manager = true;
    return ok('Hired. A manager costs ' + naira(managerPay(s, b)) + ' a week; no more weekly visits needed.');
  }
  function fireManager(s, i) {
    var b = s.businesses[i];
    if (!b || !b.manager) return fail('No manager to let go.');
    b.manager = false; b.visit = day(s);
    return ok('You let the manager go. Visit at least weekly from now on.');
  }
  function weeklyBusinessCosts(s) {
    s.businesses.forEach(function (b) {
      if (!b.site) return;
      var nm = businessName(b), rent = price(s, D.BUSINESS_SITES[b.site].rent * (b.level || 1));
      pay(s, rent, 'Shop rent: ' + nm) || addDebt(s, rent, 'Shop rent: ' + nm);
      if (b.manager) { var w = managerPay(s, b); pay(s, w, 'Manager salary: ' + nm) || addDebt(s, w, 'Manager salary: ' + nm); }
    });
  }
  // Estimated daily payout for the UI (no randomness).
  function businessEstimate(s, b) {
    var def = D.BUSINESSES[b.id], v = def.daily * s.econ.infl;
    if (b.site) v *= D.BUSINESS_SITES[b.site].mult;
    if (b.level > 1) v *= D.BUSINESS_LEVEL.mult[b.level - 1];
    if (b.manager) v *= 0.9;
    if (s.econ.cbn === 'builder') v *= D.CBN.builder.biz;
    return roundTo(v, 50);
  }

  function visitBusinesses(s) {
    if (!s.businesses.length) return fail('You do not own a business.');
    if (s.pending.length) return fail('Decide on the open event first.');
    s.alerts = [];
    advance(s, 120);
    s.businesses.forEach(function (b) { b.visit = day(s); });
    applyFx(s, { stress: 4 });
    return finish(s, ok('You checked the books and the staff. Everything is in order.'));
  }

  function businessPayout(s) {
    if (!s.businesses.length) return;
    var d = dow(s), total = 0, notes = [];
    s.businesses.forEach(function (b) {
      var def = D.BUSINESSES[b.id];
      var v = def.daily * s.econ.infl * (0.7 + rand(s) * 0.6);
      if (b.site) v *= D.BUSINESS_SITES[b.site].mult;
      if (b.level > 1) v *= D.BUSINESS_LEVEL.mult[b.level - 1];
      if (b.manager) v *= 0.9; // the manager's cut
      if (s.econ.cbn === 'builder') v *= D.CBN.builder.biz;
      if (def.weekend) v *= (d >= 4 ? 2.2 : 0.3);
      if (def.weekdays) v *= (d <= 4 ? 1.3 : 0.2); // schools: term days only
      if (def.december && isDecember(s)) v *= def.december;
      if (monthIndex(s) === 0) v *= 0.75;
      if (!b.manager && day(s) - b.visit > 7) { v *= 0.45; notes.push(businessName(b) + ' staff are stealing'); }
      if (def.power && !s.power) v -= def.daily * 0.12 * s.econ.fuel * s.econ.infl * (b.level > 1 ? D.BUSINESS_LEVEL.mult[b.level - 1] : 1);
      if (def.risky && rand(s) < 0.05) { v -= def.daily * 1.5; notes.push('union and LASTMA "dues" on the bus'); }
      total += v;
    });
    total = roundTo(total, 50);
    if (total > 0) {
      earn(s, total, 'Business payout');
      if (s.rules >= 7) { var levy = roundTo(total * 0.12, 50); if (levy) post(s, 'cash', -levy, 'Business levies (state and council)'); }
    }
    else if (total < 0) { var lost = payPartial(s, -total, 'Business running costs'); if (lost < -total) addDebt(s, -total - lost, 'Business suppliers'); }
    if (notes.length) log(s, 'Business: ' + notes.join('; ') + '.', 'bad');
  }

  function buyProperty(s, id) {
    var p = D.PROPERTIES[id];
    if (!p || p.hidden) return fail('Unknown property.');
    // Lekki Hyde Park: one home per zone, whether bought ready-built or built on its plot.
    var hz = p.hpZone || (p.hydepark && Object.keys(D.HYDE_PARK.zones).filter(function (z) { return D.HYDE_PARK.zones[z].house === id; })[0]);
    if (hz) {
      var Z = D.HYDE_PARK.zones[hz], has = function (pid) { return s.properties.some(function (x) { return x.id === pid; }); };
      if (s.hpBuild && s.hpBuild[hz]) return fail('You are already building in ' + Z.name + '.');
      if (has(Z.house)) return fail('You already own a home in ' + Z.name + '.');
      if (has(Z.plot)) return fail('You already own the plot in ' + Z.name + '. Build on it.');
    }
    var cost = price(s, p.price);
    s.alerts = [];
    if (!pay(s, cost, 'Bought ' + p.name)) return fail('You need ' + naira(cost) + '.');
    s.properties.push({ id: id, value: cost });
    log(s, 'Omo! You now own a ' + p.name + '. Make sure the C of O is real.', 'good');
    if (p.house) unlock(s, 'landlord');
    if (id === 'banana_island') unlock(s, 'banana');
    if (p.hydepark) unlock(s, 'hyde_park');
    return finish(s, ok('Property bought.' + (p.home ? ' Move in from the homes list (no rent), or let it and collect ' + naira(roundTo(p.weekly * s.econ.infl, 50)) + ' a week.' : '')));
  }

  /* ---------- building your own house on the Ikorodu plot ---------- */
  function buildInfo(s) {
    var B = D.BUILD, hasPlot = s.properties.some(function (p) { return p.id === 'iko_plot'; }), b = s.build;
    var built = s.properties.some(function (p) { return p.id === 'built_house'; });
    var next = built ? null : B.stages[b ? b.done : 0];
    return { hasPlot: hasPlot, built: built, done: b ? b.done : 0, stages: B.stages, working: !!(b && b.working), readyIn: b && b.working ? Math.max(0, b.ready - day(s)) : 0,
      next: next, cost: next ? price(s, next.cost) + (!b ? price(s, B.levy) : 0) : 0, levy: !b ? price(s, B.levy) : 0, why: buildBlock(s) };
  }
  function buildBlock(s) {
    var b = s.build, B = D.BUILD;
    if (s.properties.some(function (p) { return p.id === 'built_house'; })) return 'Your house is finished';
    if (!s.properties.some(function (p) { return p.id === 'iko_plot'; })) return 'Buy the plot of land in Ikorodu first';
    if (b && b.working) return 'The ' + B.stages[b.done].name.toLowerCase() + ' is still going on';
    if (s.loc !== 'ikorodu') return 'Visit the site in Ikorodu to start the next stage';
    var cost = price(s, B.stages[b ? b.done : 0].cost) + (!b ? price(s, B.levy) : 0);
    if (!canAfford(s, cost)) return 'This stage needs ' + naira(cost);
    return busyBlock(s);
  }
  function buildStage(s) {
    var why = buildBlock(s); if (why) return fail(why + '.');
    var B = D.BUILD, first = !s.build;
    s.alerts = [];
    if (first) {
      pay(s, price(s, B.levy), 'Omo-onile development levy');
      log(s, '🏗️ The omo-onile came to "greet" the land. You paid their development levy (' + naira(price(s, B.levy)) + ') so work can start in peace.', 'info');
      s.build = { done: 0, working: false, ready: -1, spent: 0 };
    }
    var st = B.stages[s.build.done], cost = price(s, st.cost);
    pay(s, cost, 'Building: ' + st.name);
    s.build.spent += cost; s.build.working = true; s.build.ready = day(s) + st.days;
    advance(s, 60);
    return finish(s, ok(st.icon + ' ' + st.name + ' has started. The site manager says ' + st.days + ' days, "by God\'s grace".'));
  }
  // Each new day: a stage that is due is finished; the last one turns the plot into a house.
  function buildTick(s) {
    var b = s.build, B = D.BUILD;
    if (!b || !b.working || day(s) < b.ready) return;
    var st = B.stages[b.done];
    b.working = false; b.done++;
    if (b.done < B.stages.length) { log(s, '🏗️ ' + st.name + ' is done. Visit the site in Ikorodu to start the ' + B.stages[b.done].name.toLowerCase() + '.', 'good'); return; }
    var plot = s.properties.filter(function (p) { return p.id === 'iko_plot'; })[0];
    s.properties = s.properties.filter(function (p) { return p !== plot; });
    s.properties.push({ id: 'built_house', value: roundTo((plot ? plot.value : 0) + b.spent * 0.9, 1000) });
    unlock(s, 'builder'); unlock(s, 'landlord');
    log(s, '🏠 Your house in Ikorodu is finished! Move in from the Money tab (no rent, ever), or let tenants pay you ' + naira(price(s, D.PROPERTIES.built_house.weekly)) + ' a week.', 'ach');
  }

  /* ---------- Lekki Hyde Park: build your own in any zone (new recorded call hb) ---------- */
  function hpInfo(s, zone) {
    var H = D.HYDE_PARK, Z = H.zones[zone]; if (!Z) return { why: 'No such zone' };
    var hasPlot = s.properties.some(function (p) { return p.id === Z.plot; }), b = s.hpBuild && s.hpBuild[zone];
    var built = s.properties.some(function (p) { return p.id === Z.house; });
    var full = price(s, D.PROPERTIES[Z.house].price), done = b ? b.done : 0, next = built && !b ? null : H.stages[done];
    var cost = next ? Math.round(full * next.share / 1000) * 1000 + (!b ? Math.round(full * H.approval / 1000) * 1000 : 0) : 0;
    var why = '';
    if (built && !b) why = 'You already own a house here';
    else if (!hasPlot && !b) why = 'Buy the plot first';
    else if (b && b.working) why = 'The ' + H.stages[done].name.toLowerCase() + ' is still going on';
    else if (s.loc !== H.district) why = 'Visit the site in ' + D.DISTRICTS[H.district].name + ' to start the next stage';
    else if (!canAfford(s, cost)) why = 'This stage needs ' + naira(cost);
    else why = busyBlock(s) || '';
    return { zone: zone, hasPlot: hasPlot, built: built, done: done, working: !!(b && b.working), readyIn: b && b.working ? Math.max(0, b.ready - day(s)) : 0, next: next, cost: cost, approval: !b ? Math.round(full * H.approval / 1000) * 1000 : 0, why: why };
  }
  function hpBuild(s, zone) {
    var q = hpInfo(s, zone);
    if (q.why) return fail(q.why + '.');
    var H = D.HYDE_PARK, Z = H.zones[zone];
    s.alerts = [];
    s.hpBuild = s.hpBuild || {};
    if (!s.hpBuild[zone]) {
      pay(s, q.approval, 'Estate building approval, ' + Z.name);
      s.hpBuild[zone] = { done: 0, working: false, ready: -1, spent: q.approval };
      q.cost -= q.approval;
    }
    var b = s.hpBuild[zone], st = H.stages[b.done];
    pay(s, q.cost, 'Building in ' + Z.name + ': ' + st.name);
    b.spent += q.cost; b.working = true; b.ready = day(s) + st.days;
    advance(s, 60);
    return finish(s, ok(st.icon + ' ' + st.name + ' has started in ' + Z.name + '. The estate says ' + st.days + ' days.'));
  }
  function hpBuildTick(s) {
    var H = D.HYDE_PARK;
    Object.keys(s.hpBuild).forEach(function (zone) {
      var b = s.hpBuild[zone], Z = H.zones[zone];
      if (!b.working || day(s) < b.ready) return;
      var st = H.stages[b.done]; b.working = false; b.done++;
      if (b.done < H.stages.length) { log(s, '🏗️ ' + st.name + ' is done in ' + Z.name + '. Visit the site to start the ' + H.stages[b.done].name.toLowerCase() + '.', 'good'); return; }
      var plot = s.properties.filter(function (p) { return p.id === Z.plot; })[0];
      s.properties = s.properties.filter(function (p) { return p !== plot; });
      s.properties.push({ id: Z.house, value: roundTo((plot ? plot.value : 0) + b.spent * 0.95, 1000), built: true });
      delete s.hpBuild[zone];
      unlock(s, 'builder'); unlock(s, 'landlord'); unlock(s, 'hyde_park');
      log(s, '🏡 Your ' + D.PROPERTIES[Z.house].name + ' is finished! Move in from the homes list, or let it.', 'ach');
    });
  }

  // Detty December (rules 14): diaspora relatives come home and expect to be shown around.
  var IJGB_FROM = ['Houston', 'Atlanta', 'London', 'Manchester', 'Toronto', 'Dublin', 'Johannesburg'], IJGB_WHO = ['cousin', 'aunty', 'uncle', 'childhood friend'];
  function weeklyDetty(s) {
    if (!isDecember(s) || rand(s) >= 0.6) return;
    var who = 'your ' + pick(s, IJGB_WHO) + ' ' + pick(s, D.KID_NAMES), from = pick(s, IJGB_FROM);
    queue(s, { id: 'ijgb', who: who, title: 'IJGB in the house', text: 'Just got back from ' + from + ': ' + who + ' is in Lagos for Detty December and wants to "see the real Lagos".',
      options: ['Show them around (' + naira(price(s, 30000)) + ')', 'Bring them home for jollof (' + naira(price(s, 8000)) + ')', 'Hide: you are broke'] });
  }

  function weeklyProperty(s) {
    s.properties.forEach(function (p) {
      var def = D.PROPERTIES[p.id];
      p.value = roundTo(p.value * (def.house ? 1.006 : 1.012), 1000);
      if (def.weekly && !(def.home && s.home === def.home)) earn(s, roundTo(def.weekly * s.econ.infl, 50), 'Tenant rent: ' + def.name);
      if (def.charge) { var ch = roundTo(def.charge * s.econ.infl, 50); pay(s, ch, 'Estate service charge: ' + def.name) || addDebt(s, ch, 'Estate service charge'); }
    });
  }

  function buyCar(s) {
    if (s.car) return fail('You already have a car.');
    var cost = price(s, D.CAR.price);
    s.alerts = [];
    if (!pay(s, cost, 'Bought ' + D.CAR.name)) return fail('You need ' + naira(cost) + '.');
    s.car = true;
    log(s, 'You bought a ' + D.CAR.name + '. Fuel, mechanic and LASTMA are now your problem.', 'good');
    return finish(s, ok('Car bought.'));
  }

  function wait(s, mins) {
    if (s.pending.length) return fail('Decide on the open event first.');
    mins = Math.max(STEP, Math.min(24 * 60, ceilTo(mins | 0, STEP)));
    s.alerts = [];
    advance(s, mins);
    return finish(s, ok(fmtMins(mins) + ' passes.'));
  }

  /* ---------- love and family (rules 6+) ---------- */

  var PARTNER_NAMES = ['Tolu', 'Ifeoma', 'Kemi', 'Zara', 'Amaka', 'Funmi', 'Ngozi', 'Bola', 'Seun', 'Chidi', 'Dayo', 'Obinna', 'Tobi', 'Segun', 'Ike', 'Musa', 'Halima', 'Uche'];
  var SCHOOLS = {
    public:  { name: 'public school', fee: 15000 },
    private: { name: 'private school', fee: 180000 },
    intl:    { name: 'international school', fee: 1800000 }
  };
  var WEDDINGS = {
    registry: { name: 'Registry wedding', price: 60000, aff: 5, social: 10 },
    owambe:   { name: 'Owambe wedding', price: 1500000, aff: 15, social: 40 },
    big:      { name: 'Big Lagos wedding', price: 8000000, aff: 25, social: 60 }
  };
  var DATE_SPOTS = {
    vi:       { label: 'Dinner date', cost: 15000, mins: 120, aff: 12, fx: { fun: 20, social: 20, hunger: 50 }, when: { from: 18, to: 23 } },
    lekki:    { label: 'Beach date', cost: 4000, mins: 180, aff: 10, fx: { fun: 30, social: 20 }, when: { from: 10, to: 18 } },
    ikeja:    { label: 'Cinema date', cost: 8000, mins: 150, aff: 9, fx: { fun: 30, social: 15 }, when: { from: 12, to: 23 } },
    surulere: { label: 'Suya and gist date', cost: 3000, mins: 90, aff: 6, fx: { fun: 15, social: 20, hunger: 25 }, when: { from: 17, to: 23 } },
    ikoyi:    { label: 'Gallery date', cost: 5000, mins: 120, aff: 8, fx: { fun: 20, social: 15 }, when: { from: 10, to: 18 } }
  };

  function loveActions(s) {
    var p = s.partner;
    if (s.rules < 6 || !p) return [];
    var out = [];
    if (homeDistrict(s) === s.loc && p.stage !== 'married') out.push({ id: 'love_call', label: 'Call ' + p.name, mins: 30, fx: { social: 8, fun: 4 }, special: 'love_call' });
    if (homeDistrict(s) === s.loc && p.stage === 'married') out.push({ id: 'love_home', label: 'Quality time with ' + p.name, mins: 60, fx: { social: 15, fun: 10, stress: -10 }, special: 'love_call' });
    var spot = DATE_SPOTS[s.loc];
    if (spot) out.push({ id: 'love_date', label: spot.label + ' with ' + p.name, mins: spot.mins, cost: spot.cost, fx: spot.fx, when: spot.when, special: 'love_date', aff: spot.aff });
    return out;
  }

  specials.love_call = function (s) {
    var p = s.partner;
    if (p.called === day(s)) return 'You already talked today.';
    p.called = day(s); p.contact = day(s);
    p.aff = Math.min(100, p.aff + 4);
    return p.name + ' was happy to hear from you (' + p.aff + '/100).';
  };
  specials.love_date = function (s, a) {
    var p = s.partner;
    var gain = p.dated === day(s) ? 2 : a.aff + Math.floor(skillLevel(s, 'charisma') / 2);
    p.dated = day(s); p.contact = day(s);
    p.aff = Math.min(100, p.aff + gain);
    return 'Lovely time with ' + p.name + ' (' + p.aff + '/100).';
  };

  function dailyLove(s) {
    var p = s.partner;
    if (!p) return;
    var quiet = day(s) - p.contact;
    if (quiet > 2) p.aff = Math.max(0, p.aff - (p.stage === 'married' ? 1 : 3));
    if (p.aff <= 0) {
      log(s, p.stage === 'married' ? 'You and ' + p.name + ' have separated. The house feels empty.' : p.name + ' has stopped replying. It is over.', 'bad');
      applyFx(s, { stress: p.stage === 'married' ? 30 : 15, social: -15 });
      s.partner = null;
    }
  }

  function weeklyFamily(s) {
    s.kids.forEach(function (k, i) {
      var cost = price(s, 4000);
      if (!pay(s, cost, 'Childcare and food')) addDebt(s, cost, 'Childcare');
      if (day(s) >= k.nextFees) {
        if (!k.school) queue(s, { id: 'school', title: 'Choose a school', text: 'Your child is starting school. Fees are per 12-week term.', options: ['Public school (' + naira(price(s, SCHOOLS.public.fee)) + ')', 'Private school (' + naira(price(s, SCHOOLS.private.fee)) + ')', 'International school (' + naira(price(s, SCHOOLS.intl.fee)) + ')'], kid: i });
        else chargeFees(s, k);
      }
    });
    var p = s.partner;
    if (p && p.stage === 'married' && s.kids.length < 3 && week(s) >= s.babyPause && week(s) - p.since >= 4 && rand(s) < 0.07) {
      queue(s, { id: 'baby', title: 'Big news', text: p.name + ' thinks it is time to start a family. Ready?', options: ['We are ready', 'Not yet'] });
    }
  }

  function chargeFees(s, k) {
    // Report cards only come for children whose homework you have helped with (a newer system).
    if (k.hw !== undefined) reportCard(s, k);
    var fee = price(s, SCHOOLS[k.school].fee);
    if (!pay(s, fee, 'School fees (' + SCHOOLS[k.school].name + ')')) { addDebt(s, fee, 'School fees'); applyFx(s, { stress: 20 }); }
    k.nextFees = day(s) + 84;
  }

  /* ---------- children: homework, outings and report cards ---------- */
  // Siblings never share a name: walk on from the seeded pick past older siblings' names.
  function kidName(s, i) {
    var k = s.kids[i]; if (!k) return '';
    var N = D.KID_NAMES, j = parseInt(fnv(s.seed + ':kid:' + k.born + ':' + i), 16) % N.length, taken = {};
    for (var b = 0; b < i; b++) taken[kidName(s, b)] = 1;
    while (taken[N[j]]) j = (j + 1) % N.length;
    return N[j];
  }
  function homeworkBlock(s, i) {
    var k = s.kids[i];
    if (!k) return 'No such child';
    if (!k.school) return kidName(s, i) + ' has not started school yet';
    if (homeDistrict(s) !== s.loc) return 'Homework is done at home';
    if (dow(s) > 4) return 'Homework is for school nights (Monday to Friday)';
    var h = hour(s); if (h < 17 || h >= 21) return 'Homework time is 17:00 to 21:00';
    if (k.hwDay === day(s)) return 'Homework is done for today';
    if (s.needs.energy < 15) return 'Too tired';
    return busyBlock(s);
  }
  function helpHomework(s, i) {
    var why = homeworkBlock(s, i); if (why) return fail(why + '.');
    var k = s.kids[i];
    s.alerts = [];
    k.hw = (k.hw || 0) + 1; k.hwDay = day(s); k.bond = Math.min(100, (k.bond || 0) + 3);
    advance(s, 60); applyFx(s, { social: 6, stress: 3, energy: -5 });
    return finish(s, ok('📚 You did homework with ' + kidName(s, i) + '. ' + ['Long division, and a lot of patience.', 'A Basic Science project on the water cycle.', 'Reading practice: ' + kidName(s, i) + ' read you a whole story.', 'Spellings for Friday\'s test.'][k.hw % 4]));
  }
  function outingBlock(s, i) {
    var k = s.kids[i];
    if (!k) return 'No such child';
    if (cityOf(s) !== districtCity(homeDistrict(s))) return 'Outings are in your home city';
    if (dow(s) < 5) return 'Outings are at the weekend';
    var h = hour(s); if (h < 10 || h >= 18) return 'Outings are from 10:00 to 18:00';
    if (k.outWeek === week(s)) return 'One outing a week';
    if (!canAfford(s, price(s, 5000))) return 'An outing costs ' + naira(price(s, 5000));
    if (s.needs.energy < 25) return 'Too tired';
    return busyBlock(s);
  }
  function kidOuting(s, i) {
    var why = outingBlock(s, i); if (why) return fail(why + '.');
    var k = s.kids[i];
    s.alerts = [];
    pay(s, price(s, 5000), 'Family outing');
    k.outWeek = week(s); k.bond = Math.min(100, (k.bond || 0) + 10);
    if (k.hw === undefined && k.school) k.hw = 0; // report cards start once you are involved
    advance(s, 180); applyFx(s, { fun: 20, social: 15, stress: -10, energy: -8 });
    return finish(s, ok('🎡 A day out with ' + kidName(s, i) + ': ' + ['ice cream and the beach.', 'the zoo and puff-puff.', 'the cinema and popcorn.', 'the park and a football match.'][k.outWeek % 4]));
  }
  var GRADE_BONUS = { public: 0, private: 12, intl: 25 };
  function reportCard(s, k) {
    var i = s.kids.indexOf(k), name = kidName(s, i);
    var score = (GRADE_BONUS[k.school] || 0) + Math.min(45, (k.hw || 0) * 5) + (k.bond || 0) / 5 + parseInt(fnv(s.seed + ':rc:' + i + ':' + day(s)), 16) % 15;
    var grade = score >= 70 ? 'A' : score >= 55 ? 'B' : score >= 40 ? 'C' : score >= 25 ? 'D' : 'F';
    (k.reports = k.reports || []).push({ day: day(s), grade: grade });
    k.hw = 0;
    if (grade === 'A') { unlock(s, 'scholar'); applyFx(s, { fun: 10, stress: -5 }); log(s, '📜 ' + name + '\'s report card: straight A! The teacher says "A joy to teach."', 'good'); }
    else if (grade === 'F') { applyFx(s, { stress: 10 }); log(s, '📜 ' + name + '\'s report card: F. The teacher wants to see you. More homework help next term.', 'bad'); }
    else log(s, '📜 ' + name + '\'s report card: ' + grade + '.' + (grade === 'B' ? ' Very good.' : ' Room to improve.'), 'info');
  }
  function kidsInfo(s) {
    return (s.kids || []).map(function (k, i) {
      return { name: kidName(s, i), label: kidLabel(s, i), school: k.school, feesIn: Math.max(0, k.nextFees - day(s)), bond: k.bond || 0, hw: k.hw || 0, last: k.reports && k.reports.length ? k.reports[k.reports.length - 1].grade : null, hwWhy: homeworkBlock(s, i), outWhy: outingBlock(s, i) };
    });
  }

  function weddingOptions(s) {
    var p = s.partner;
    return Object.keys(WEDDINGS).map(function (k) {
      var w = WEDDINGS[k], cost = price(s, w.price), o = { id: k, name: w.name, cost: cost };
      if (s.rules < 6 || !p) o.disabled = 'You are not in a relationship';
      else if (p.stage === 'married') o.disabled = 'Already married';
      else if (p.stage !== 'introduced') o.disabled = 'Do the family introduction first';
      else if (p.aff < 75) o.disabled = p.name + ' is not ready yet (' + p.aff + '/75)';
      else if (s.wwPlan && !s.wwPlan.done && day(s) <= s.wwPlan.date) o.disabled = 'Your white wedding is already booked';
      else if (!canAfford(s, cost)) o.disabled = 'Costs ' + naira(cost);
      return o;
    });
  }

  function marry(s, kind) {
    if (s.pending.length) return fail('Decide on the open event first.');
    var o = weddingOptions(s).filter(function (x) { return x.id === kind; })[0];
    if (!o) return fail('Pick a wedding.');
    if (o.disabled) return fail(o.disabled);
    s.alerts = [];
    if (!pay(s, o.cost, o.name)) return fail('Not enough money.');
    var w = WEDDINGS[kind], p = s.partner;
    advance(s, kind === 'registry' ? 180 : 600);
    p.stage = 'married'; p.since = week(s); p.contact = day(s);
    p.aff = Math.min(100, p.aff + w.aff);
    applyFx(s, { social: w.social, fun: 40, stress: kind === 'big' ? 15 : 0 });
    unlock(s, 'wedding');
    log(s, 'You married ' + p.name + ' (' + o.name + '). ' + p.name + ' now pays half the rent.', 'good');
    return finish(s, ok('Congratulations! You married ' + p.name + '.'));
  }

  /* ---------- Lagoon Boat Cruise: board (cb), then spots on deck (cs) ---------- */
  function cruiseAboard(s) { return !!(s.cruise && s.t < s.cruise.until); }
  function cruiseFare(s) { var C = D.CRUISE; return price(s, isDecember(s) ? C.decFare : C.fare); }
  function cruiseBlock(s) {
    if (cruiseAboard(s)) return 'You are already aboard';
    if (s.loc !== D.CRUISE.district) return 'The boat leaves from ' + D.DISTRICTS[D.CRUISE.district].name;
    if (hour(s) < 9 || hour(s) >= 21) return 'Boats sail from 9am to 9pm';
    if (!canAfford(s, cruiseFare(s))) return 'The ticket is ' + naira(cruiseFare(s));
    return busyBlock(s) || '';
  }
  function cruiseBoard(s) {
    var why = cruiseBlock(s); if (why) return fail(why + '.');
    s.alerts = [];
    var C = D.CRUISE, fare = cruiseFare(s);
    if (!pay(s, fare, 'Lagoon Boat Cruise ticket')) return fail('Not enough money.');
    s.cruise = { until: s.t + C.mins, spot: 'rail', n: 0 };
    applyFx(s, C.fx); unlock(s, 'cruise');
    log(s, '🛳️ You boarded the Lagoon Boat Cruise at Five Cowries Creek.', 'good');
    return finish(s, ok('All aboard! Move around the deck.'));
  }
  function cruiseSpot(s, spot) {
    var C = D.CRUISE, P = C.spots[spot];
    if (!P) return fail('No such spot.');
    if (!cruiseAboard(s)) return fail('Board the boat first.');
    if (s.pending.length) return fail('Decide on the open event first.');
    var cost = price(s, P.cost);
    if (cost && !canAfford(s, cost)) return fail(P.name + ' costs ' + naira(cost) + '.');
    s.alerts = [];
    if (cost) pay(s, cost, 'Deck bar');
    s.cruise.spot = spot; s.cruise.n = (s.cruise.n || 0) + 1;
    if (s.cruise.n <= 6) applyFx(s, P.fx); // the deck stops giving after a while
    advance(s, 30);
    var line = P.text;
    if (spot === 'rail') line = C.sights[Math.floor(rand(s) * C.sights.length)] + '.';
    s.cruise.last = line;
    return finish(s, ok(P.icon + ' ' + line));
  }
  function cruiseLeave(s) {
    if (!s.cruise) return fail('You are not on a boat.');
    s.cruise.until = s.t;
    return ok('Back on the jetty.');
  }

  /* ---------- white wedding: plan (ww), then hold it on the day (wh) ---------- */
  function cleanWWPlan(p) {
    var W = D.WHITE_WEDDING; if (!p || typeof p !== 'object') return null;
    var ex = Array.isArray(p.extras) ? p.extras.filter(function (x, i, a) { return W.extras[x] && a.indexOf(x) === i; }).slice(0, 6) : [];
    if (!W.venues[p.venue] || !W.planners[p.planner] || !W.asoebi[p.asoebi] || !W.vendors[p.vendors] || !W.themes[p.theme] || !W.decor[p.decor] || !W.afterparty[p.after]) return null;
    return { venue: p.venue, planner: p.planner, asoebi: p.asoebi, vendors: p.vendors, theme: p.theme, decor: p.decor, extras: ex, after: p.after };
  }
  function wwQuote(s, plan) {
    var W = D.WHITE_WEDDING, p = cleanWWPlan(plan), partner = s.partner;
    if (!p) return { disabled: 'Finish choosing every part of the plan' };
    var V = W.venues[p.venue], lines = [
      [V.name, price(s, V.cost)], [W.planners[p.planner].name, price(s, W.planners[p.planner].cost)], [W.asoebi[p.asoebi].name, price(s, W.asoebi[p.asoebi].cost)],
      [W.vendors[p.vendors].name + ' for ' + V.guests + ' guests', price(s, W.vendors[p.vendors].perGuest * V.guests)], [W.decor[p.decor].name + ' hall decoration', price(s, W.decor[p.decor].cost)]
    ];
    p.extras.forEach(function (x) { lines.push([W.extras[x].name, price(s, W.extras[x].cost)]); });
    if (p.after !== 'none') lines.push([W.afterparty[p.after].name, price(s, W.afterparty[p.after].cost)]);
    var total = lines.reduce(function (a, l) { return a + l[1]; }, 0), deposit = Math.round(total * W.deposit / 1000) * 1000;
    var q = { plan: p, lines: lines.filter(function (l) { return l[1] > 0; }), total: total, deposit: deposit, balance: total - deposit, guests: V.guests, quality: W.planners[p.planner].q + W.asoebi[p.asoebi].q + W.vendors[p.vendors].q + W.decor[p.decor].q + Math.min(2, p.extras.length / 2) };
    var d = day(s) + W.leadDays; while (d % 7 !== 5) d++;
    q.date = d;
    if (s.rules < 6 || !partner) q.disabled = 'You are not in a relationship';
    else if (partner.stage === 'married') q.disabled = 'Already married';
    else if (partner.stage !== 'introduced') q.disabled = 'Do the family introduction first';
    else if (partner.aff < 75) q.disabled = partner.name + ' is not ready yet (' + partner.aff + '/75)';
    else if (s.wwPlan && day(s) <= s.wwPlan.date) q.disabled = 'Your wedding is already booked';
    else if (busyBlock(s)) q.disabled = busyBlock(s);
    else if (!canAfford(s, deposit)) q.disabled = 'The 30% deposit is ' + naira(deposit);
    return q;
  }
  function planWhiteWedding(s, plan) {
    var q = wwQuote(s, plan);
    if (q.disabled) return fail(q.disabled);
    s.alerts = [];
    if (!pay(s, q.deposit, 'White wedding deposit (30%)')) return fail('Not enough for the deposit.');
    s.wwPlan = { plan: q.plan, total: q.total, paid: q.deposit, date: q.date, quality: q.quality, guests: q.guests };
    advance(s, 120); applyFx(s, { stress: D.WHITE_WEDDING.planners[q.plan.planner].stress });
    log(s, '💍 The white wedding is booked for ' + D.DAYS[q.date % 7] + ', week ' + (Math.floor(q.date / 7) + 1) + ' at ' + D.WHITE_WEDDING.venues[q.plan.venue].name + '. Deposit paid; the balance is due on the day.', 'good');
    return finish(s, ok('Booked! Save the date: ' + D.DAYS[q.date % 7] + ', week ' + (Math.floor(q.date / 7) + 1) + '.'));
  }
  function wwDayBlock(s) {
    var w = s.wwPlan; if (!w) return 'Plan the wedding first';
    var V = D.WHITE_WEDDING.venues[w.plan.venue], left = w.total - w.paid;
    if (s.partner && s.partner.stage === 'married') return 'Already married';
    if (day(s) < w.date) return 'The wedding is in ' + (w.date - day(s)) + ' days';
    if (day(s) > w.date) return 'The date has passed: the venue kept your deposit';
    if (hour(s) < 9 || hour(s) >= 13) return 'The church service starts between 9am and 1pm';
    if (s.loc !== V.district) return 'Go to ' + D.DISTRICTS[V.district].name + ' for the venue';
    if (!canAfford(s, left)) return 'The balance of ' + naira(left) + ' is due today';
    return busyBlock(s) || '';
  }
  function holdWhiteWedding(s) {
    var why = wwDayBlock(s); if (why) return fail(why + '.');
    s.alerts = [];
    var w = s.wwPlan, W = D.WHITE_WEDDING, p = s.partner, left = w.total - w.paid;
    pay(s, left, 'White wedding balance');
    advance(s, 240); // the church service and the reception
    var A = W.afterparty[w.plan.after];
    if (w.plan.after !== 'none') advance(s, 180);
    p.stage = 'married'; p.since = week(s); p.contact = day(s);
    p.aff = Math.min(100, p.aff + 20 + Math.round(w.quality * 3));
    applyFx(s, { social: 50 + w.quality * 5, fun: 40 + A.fun, stress: Math.max(0, 15 - w.quality * 3), energy: -30 });
    // Guests spray and give gifts, but they never cover the cost.
    var gifts = roundTo(Math.min(w.total * 0.25, w.guests * 2500 * (1 + w.quality / 4) * s.econ.infl), 1000);
    if (gifts > 0) earn(s, gifts, 'Wedding gifts and spraying');
    unlock(s, 'wedding'); unlock(s, 'white_wedding');
    log(s, '💒 You married ' + p.name + ' in a white wedding at ' + W.venues[w.plan.venue].name + ': ' + W.themes[w.plan.theme].name.toLowerCase() + ' everywhere, the first dance, the cake and ' + (w.plan.after !== 'none' ? 'a ' + A.name.toLowerCase() + ' till late' : 'a send-off') + '. ' + p.name + ' now pays half the rent.', 'good');
    s.wwPlan.done = true;
    return finish(s, ok('Congratulations! You married ' + p.name + '.'));
  }

  /* ---------- your home: furniture ----------
   * Items are owned, kept when you move, and only work while placed in your
   * current home. Power-hungry items only work while there is light. */

  function roomSize(s) { return D.ROOM_SIZES[homeDef(s).type] || D.ROOM_SIZES.room; }
  function placed(s) { return (s.items || []).filter(function (it) { return it.x != null; }); }
  function itemDims(it) { var f = D.FURNITURE[it.id]; return it.r ? [f.d, f.w] : [f.w, f.d]; }
  function fitsAt(s, idx, x, y, r) {
    var it = s.items[idx], f = D.FURNITURE[it.id], sz = roomSize(s);
    var w = r ? f.d : f.w, d = r ? f.w : f.d;
    if (x < 0 || y < 0 || x + w > sz[0] || y + d > sz[1]) return false;
    for (var i = 0; i < s.items.length; i++) {
      var o = s.items[i];
      if (i === idx || o.x == null) continue;
      var od = itemDims(o);
      if (x < o.x + od[0] && x + w > o.x && y < o.y + od[1] && y + d > o.y) return false;
    }
    return true;
  }
  function firstSpot(s, idx) {
    var sz = roomSize(s);
    for (var r = 0; r < 2; r++) for (var y = 0; y < sz[1]; y++) for (var x = 0; x < sz[0]; x++) if (fitsAt(s, idx, x, y, r)) return { x: x, y: y, r: r };
    return null;
  }
  // After a move, keep what still fits; store the rest. Returns how many were stored.
  function relayout(s) {
    var n = 0;
    (s.items || []).forEach(function (it, i) {
      if (it.x == null) return;
      var x = it.x, y = it.y; it.x = null;
      if (fitsAt(s, i, x, y, it.r)) { it.x = x; it.y = y; } else n++;
    });
    return n;
  }
  function fxSum(s, key, cap) {
    var t = 0;
    placed(s).forEach(function (it) { var f = D.FURNITURE[it.id]; if (f.fx && f.fx[key] && (!f.needsPower || s.power)) t += f.fx[key]; });
    return cap == null ? t : Math.min(cap, t);
  }
  // Furniture (capped), plus a houseboat moored by an Island home.
  function furnitureSleep(s) {
    var t = fxSum(s, 'sleep', 0.3), d = homeDef(s).district;
    if ((d === 'lekki' || d === 'ikoyi') && (s.vehicles || []).some(function (v) { return D.VEHICLES[v.id].sleep; })) t += 0.1;
    return t;
  }
  function furniturePower(s) {
    var t = 0;
    placed(s).forEach(function (it) { var f = D.FURNITURE[it.id]; if (f.fx && f.fx.power) t += f.fx.power; });
    return Math.min(0.45, t);
  }
  function furnitureGen(s) {
    var t = 0;
    placed(s).forEach(function (it) { var f = D.FURNITURE[it.id]; if (f.fx && f.fx.gen) t = Math.max(t, f.fx.gen); });
    return t;
  }
  function furnitureDaily(s) {
    if (!(s.items && s.items.length)) return null;
    var out = null;
    ['fun', 'stress', 'social', 'hunger', 'energy'].forEach(function (k) {
      var v = fxSum(s, k, null);
      if (v) { out = out || {}; out[k] = Math.max(-15, Math.min(15, v)); }
    });
    return out;
  }
  // A car worth flexing: ₦40m or more.
  function luxuryCar(s) { return (s.vehicles || []).filter(function (v) { var V = D.VEHICLES[v.id]; return V.kind === 'car' && V.price >= 40000000; })[0] || null; }
  // After a glam session, the next night out lands better (only set by the new glam action).
  function glamBonus(s) {
    if (!(s.glamUntil > s.t)) return '';
    s.glamUntil = 0;
    applyFx(s, { social: 15, fun: 10 });
    return ' Everybody noticed your look.';
  }
  function statusPoints(s) {
    var t = 0;
    (s.wardrobe || []).forEach(function (w) { t += D.CLOTHES[w.id].status || 0; });
    (s.items || []).forEach(function (it) { t += D.FURNITURE[it.id].status || 0; });
    (s.vehicles || []).forEach(function (v) { t += D.VEHICLES[v.id].status || 0; });
    if (s.phone) t += D.PHONES[s.phone].status;
    (s.properties || []).forEach(function (p) { t += (D.PROPERTIES[p.id] && D.PROPERTIES[p.id].status) || 0; });
    var ti = titleDef(s); if (ti) t += ti.status;
    return t;
  }

  function buyItem(s, id) {
    var f = D.FURNITURE[id];
    if (!f) return fail('No such item.');
    if (s.pending.length) return fail('Decide on the open event first.');
    if ((s.items || []).length >= 60) return fail('Your storage is full. Sell something first.');
    var cost = price(s, f.price);
    s.alerts = [];
    if (!pay(s, cost, 'Bought ' + f.name)) return fail(f.name + ' costs ' + naira(cost) + '.');
    s.items.push({ id: id, x: null, y: null, r: 0, paid: cost });
    var spot = firstSpot(s, s.items.length - 1);
    if (spot) { var it = s.items[s.items.length - 1]; it.x = spot.x; it.y = spot.y; it.r = spot.r; }
    return finish(s, ok(spot ? f.name + ' is in your home. Drag it where you like.' : f.name + ' is in storage: there is no room for it here.'));
  }
  function placeItem(s, idx, x, y, r) {
    var it = s.items && s.items[idx];
    if (!it) return fail('No such item.');
    x = x | 0; y = y | 0; r = r ? 1 : 0;
    if (!fitsAt(s, idx, x, y, r)) return fail('It does not fit there.');
    it.x = x; it.y = y; it.r = r;
    return ok('Placed.');
  }
  function storeItem(s, idx) {
    var it = s.items && s.items[idx];
    if (!it) return fail('No such item.');
    it.x = null; it.y = null;
    return ok(D.FURNITURE[it.id].name + ' is in storage.');
  }
  function sellItem(s, idx) {
    var it = s.items && s.items[idx];
    if (!it) return fail('No such item.');
    var v = roundTo(it.paid * 0.4, 50);
    s.alerts = [];
    s.items.splice(idx, 1);
    if (v) earn(s, v, 'Sold ' + D.FURNITURE[it.id].name);
    return finish(s, ok('Sold for ' + naira(v) + '.'));
  }

  /* ---------- your Lagosian: looks and wardrobe ---------- */

  function outfitTags(s) {
    var t = {};
    Object.keys(s.outfit || {}).forEach(function (slot) { var c = D.CLOTHES[s.outfit[slot]]; if (c) c.tags.forEach(function (g) { t[g] = true; }); });
    return t;
  }
  function dressBonus(s, tag) {
    if (!outfitTags(s)[tag]) return '';
    applyFx(s, tag === 'owambe' ? { fun: 15, social: 15 } : { fun: 15, social: 10 });
    return tag === 'owambe' ? ' Your outfit turned heads.' : ' You were dressed for it: VIP section.';
  }
  function setLook(s, skin, hair, shape) {
    if (!(skin >= 0 && skin < D.LOOKS.skin.length) || !(hair >= 0 && hair < D.LOOKS.hair.length) || !(shape >= 0 && shape < D.LOOKS.shape.length)) return fail('Pick from the options.');
    s.look = { skin: skin | 0, hair: hair | 0, shape: shape | 0 };
    return ok('Looking good.');
  }
  function buyClothes(s, id) {
    var c = D.CLOTHES[id];
    if (!c || c.gift) return fail('No such item.');
    if (s.pending.length) return fail('Decide on the open event first.');
    if (s.wardrobe.some(function (w) { return w.id === id; })) return fail('You already own this.');
    var cost = price(s, c.price);
    s.alerts = [];
    if (!pay(s, cost, 'Bought ' + c.name)) return fail(c.name + ' costs ' + naira(cost) + '.');
    s.wardrobe.push({ id: id });
    wear(s, id);
    return finish(s, ok('You bought and put on the ' + c.name + '.'));
  }
  function wear(s, id) {
    var c = D.CLOTHES[id];
    if (!c || !s.wardrobe.some(function (w) { return w.id === id; })) return fail('You do not own that.');
    if (c.slot === 'dress') { delete s.outfit.top; delete s.outfit.bottom; }
    if (c.slot === 'top' || c.slot === 'bottom') delete s.outfit.dress;
    s.outfit[c.slot] = id;
    return ok('Wearing the ' + c.name + '.');
  }
  function takeOff(s, slot) {
    if (!s.outfit || !s.outfit[slot]) return fail('Nothing to take off.');
    delete s.outfit[slot];
    return ok('Taken off.');
  }

  /* ---------- garage and hangar ---------- */

  /* ---------- car wear and Ladipo (rules 12) ---------- */
  // The car instance you drive: your pick, else the fastest car (as bestCar).
  // Where the agberos collect ground money from drivers (rules 14).
  var GROUND_MONEY = { oshodi: 1, island: 1, vi: 1, lekki: 1, surulere: 1, ikeja: 1 };
  function drivenVehicle(s) {
    var dv = s.vehicles && s.driving >= 0 ? s.vehicles[s.driving] : null;
    if (dv && D.VEHICLES[dv.id].kind === 'car') return dv;
    var best = null;
    (s.vehicles || []).forEach(function (v) { var V = D.VEHICLES[v.id]; if (V.kind === 'car' && (!best || V.speed > D.VEHICLES[best.id].speed)) best = v; });
    return best;
  }
  // Wear builds with every km; the older and cheaper the car, the likelier a breakdown.
  function breakdownOdds(v) {
    var V = D.VEHICLES[v.id], w = v.wear || 0;
    return Math.min(0.25, (0.004 + w / 40000) * (V.price < 10000000 ? 1.5 : V.price >= 40000000 ? 0.6 : 1));
  }
  function carWear(s, km) {
    var v = drivenVehicle(s); if (!v) return '';
    v.wear = Math.round(((v.wear || 0) + km) * 10) / 10;
    if (rand(s) >= breakdownOdds(v)) return '';
    var V = D.VEHICLES[v.id], fix = price(s, Math.max(5000, V.upkeep * 2));
    pay(s, fix, 'Roadside mechanic: ' + V.name) || addDebt(s, fix, 'Roadside mechanic');
    advance(s, 90);
    applyFx(s, { stress: 12 });
    s.stats.breakdowns = (s.stats.breakdowns || 0) + 1;
    log(s, '🔧 Your ' + V.name + ' broke down on the way. A roadside mechanic fixed it for ' + naira(fix) + '.', 'bad');
    return 'Your ' + V.name + ' broke down on the way: 90 minutes and ' + naira(fix) + ' at a roadside mechanic. Service it at Ladipo.';
  }
  function serviceCost(s) {
    return (s.vehicles || []).reduce(function (a, v) { var V = D.VEHICLES[v.id]; return a + (V.kind === 'car' && (v.wear || 0) > 0 ? price(s, Math.max(15000, V.upkeep * 3)) : 0); }, 0);
  }
  function serviceBlock(s) {
    if (!(s.rules >= 12)) return 'This life started before car wear came to Lagos';
    if (!(s.vehicles || []).some(function (v) { return D.VEHICLES[v.id].kind === 'car'; })) return 'You do not own a car';
    if (!serviceCost(s)) return 'Your cars are freshly serviced';
    if (s.loc !== 'mushin') return 'Ladipo auto market is in Mushin';
    if (dow(s) === 6) return 'Ladipo is closed on Sundays';
    var h = hour(s); if (h < 8 || h >= 18) return 'Mechanics work 08:00 to 18:00';
    if (busyBlock(s)) return busyBlock(s);
    if (!canAfford(s, serviceCost(s))) return 'A service costs ' + naira(serviceCost(s));
    return null;
  }
  function serviceCars(s) {
    var why = serviceBlock(s); if (why) return fail(why + '.');
    var cost = serviceCost(s);
    s.alerts = [];
    pay(s, cost, 'Ladipo: car service');
    (s.vehicles || []).forEach(function (v) { if (D.VEHICLES[v.id].kind === 'car') v.wear = 0; });
    advance(s, 120);
    return finish(s, ok('🔧 Oil, filters, brake pads and a "small something" for the boys: your cars are serviced (' + naira(cost) + ').'));
  }
  function wearInfo(s, i) { var v = s.vehicles[i]; return v && s.rules >= 12 && D.VEHICLES[v.id].kind === 'car' ? { wear: Math.round(v.wear || 0), odds: breakdownOdds(v) } : null; }

  function bestCar(s) {
    var dv = s.vehicles && s.driving >= 0 ? s.vehicles[s.driving] : null;
    if (dv && D.VEHICLES[dv.id].kind === 'car') return D.VEHICLES[dv.id];
    var best = null;
    (s.vehicles || []).forEach(function (v) { var V = D.VEHICLES[v.id]; if (V.kind === 'car' && (!best || V.speed > best.speed)) best = V; });
    return best;
  }
  function buyVehicle(s, id) {
    var V = D.VEHICLES[id];
    if (!V) return fail('No such vehicle.');
    if (s.pending.length) return fail('Decide on the open event first.');
    if ((s.vehicles || []).length >= 12) return fail('Your garage is full.');
    var cost = price(s, V.price);
    s.alerts = [];
    if (!pay(s, cost, 'Bought ' + V.name)) return fail(V.name + ' costs ' + naira(cost) + '.');
    s.vehicles.push({ id: id, paid: cost });
    log(s, 'You bought a ' + V.name + '. Upkeep is ' + naira(price(s, V.upkeep)) + ' a week.', 'good');
    return finish(s, ok('Congratulations on your ' + V.name + '!'));
  }
  function vehicleUpkeep(s, id) { return price(s, D.VEHICLES[id].upkeep * (s.rules >= 8 ? 1.5 : 1)); }
  // Pick the car you drive; -1 goes back to the fastest one.
  function driveVehicle(s, idx) {
    if (idx === -1) { s.driving = -1; return ok('You will drive your fastest car.'); }
    var v = s.vehicles && s.vehicles[idx];
    if (!v || D.VEHICLES[v.id].kind !== 'car') return fail('Pick one of your cars.');
    s.driving = idx;
    return ok('You are driving the ' + D.VEHICLES[v.id].name + '.');
  }
  function sellVehicle(s, idx) {
    var v = s.vehicles && s.vehicles[idx];
    if (!v) return fail('No such vehicle.');
    var val = roundTo(v.paid * 0.5, 1000);
    s.alerts = [];
    s.vehicles.splice(idx, 1);
    if (s.driving === idx) s.driving = -1; else if (s.driving > idx) s.driving--;
    earn(s, val, 'Sold ' + D.VEHICLES[v.id].name);
    return finish(s, ok('Sold for ' + naira(val) + '.'));
  }

  /* ---------- Mainland Estate plots ---------- */

  function plotCount() { return D.ESTATE.cols * D.ESTATE.rows; }
  function plotXY(n) {
    var c = n % D.ESTATE.cols, r = Math.floor(n / D.ESTATE.cols);
    return { x: D.ESTATE.x0 + c * D.ESTATE.gap + D.ESTATE.gap / 2, y: D.ESTATE.y0 + r * D.ESTATE.gap + D.ESTATE.gap / 2 };
  }
  // Plots lived in by Lagosians who are not players (fixed, the same for everyone).
  function plotTakenByNpc(n) {
    var h = Math.imul((n + 17) * 2654435761, 1597334677) >>> 0;
    return (h % 100) < 38;
  }
  function myPlot(s) {
    var p = s.properties.filter(function (x) { return x.id === D.ESTATE.property; })[0];
    return p ? p.plot : null;
  }
  // The shared store decides who else owns a plot; the engine only refuses NPC
  // plots and a second plot, and takes the money (a recorded, replayable debit).
  function buyPlot(s, n) {
    n = n | 0;
    if (n < 0 || n >= plotCount()) return fail('No such plot.');
    if (plotTakenByNpc(n)) return fail('Someone already lives on this plot.');
    if (myPlot(s) != null) return fail('You already own a house in ' + D.ESTATE.name + '.');
    if (s.pending.length) return fail('Decide on the open event first.');
    var cost = price(s, D.PROPERTIES[D.ESTATE.property].price);
    s.alerts = [];
    if (!pay(s, cost, 'Bought plot ' + (n + 1) + ', ' + D.ESTATE.name)) return fail('A house here costs ' + naira(cost) + '.');
    s.properties.push({ id: D.ESTATE.property, value: cost, plot: n });
    unlock(s, 'landlord');
    log(s, 'You own a house on plot ' + (n + 1) + ' in ' + D.ESTATE.name + '. Move in from the Money tab: no rent, ever.', 'good');
    return finish(s, ok('Plot ' + (n + 1) + ' is yours.'));
  }

  /* ---------- billboards ----------
   * The engine only takes the rent (a recorded, replayable debit). What the
   * ad says lives in the shared store and is built from fixed parts. */

  function boardDef(id) {
    for (var i = 0; i < D.BILLBOARDS.length; i++) if (D.BILLBOARDS[i].id === id) return D.BILLBOARDS[i];
    return null;
  }
  function boardRent(s) { return price(s, D.BILLBOARD_RENT); }
  // Price for a board and plan: busier boards and longer runs cost more.
  function boardQuote(s, id, plan) {
    var b = boardDef(id), P = D.AD_PLANS[plan];
    if (!b || !P) return 0;
    return roundTo(price(s, D.BILLBOARD_RENT * (b.traffic || 1) * P.mult), 500);
  }

  // plan is optional: lives recorded before plans existed rent for one day at the flat price.
  function rentBoard(s, id, plan) {
    var b = boardDef(id);
    if (!b) return fail('No such billboard.');
    if (s.pending.length) return fail('Decide on the open event first.');
    if (plan != null && !D.AD_PLANS[plan]) return fail('Pick how long your ad runs.');
    var cost = plan == null ? boardRent(s) : boardQuote(s, id, plan), days = plan == null ? 1 : D.AD_PLANS[plan].days;
    s.alerts = [];
    if (!pay(s, cost, 'Billboard rental: ' + b.name)) return fail('Renting this board costs ' + naira(cost) + '.');
    unlock(s, 'billboard');
    log(s, 'Your ad is up on the ' + b.name + ' billboard for ' + (days === 1 ? '24 hours' : days + ' days') + '.', 'good');
    return finish(s, ok('Your ad is on air at ' + b.name + '.', { days: days, cost: cost }));
  }

  // Ad slogans: the fixed list, plus your own businesses by name and district.
  function adSlogans(s) {
    var out = D.AD_SLOGANS.map(function (t, i) { return { code: 's' + i, text: t }; });
    (s.businesses || []).forEach(function (b) {
      var code = 'b:' + b.id + ':' + homeDistrict(s);
      if (!out.some(function (o) { return o.code === code; })) out.push({ code: code, text: D.BUSINESSES[b.id].name + ' now open in ' + D.DISTRICTS[homeDistrict(s)].name });
    });
    return out;
  }
  // Turn a stored slogan code back into text; null when it is not a valid code.
  function sloganText(code) {
    if (typeof code !== 'string') return null;
    var m = /^s(\d{1,2})$/.exec(code);
    if (m) return D.AD_SLOGANS[+m[1]] || null;
    m = /^b:([a-z]+):([a-z]+)$/.exec(code);
    if (m && D.BUSINESSES[m[1]] && D.DISTRICTS[m[2]]) return D.BUSINESSES[m[1]].name + ' now open in ' + D.DISTRICTS[m[2]].name;
    return null;
  }
  // Validate an ad read from the shared store. Returns a clean ad or null.
  function checkAd(raw, now) {
    if (!raw || typeof raw !== 'object' || !boardDef(raw.board)) return null;
    var e = raw.emoji, c = raw.color, text = sloganText(raw.slogan);
    if (!(e >= 0 && e < D.AD_EMOJI.length && Math.round(e) === e) || !(c >= 0 && c < D.AD_COLORS.length && Math.round(c) === c) || !text) return null;
    if (typeof raw.until !== 'number' || raw.until <= now || raw.until > now + (7 * 24 + 1) * 3600 * 1000) return null;
    return { board: raw.board, emoji: D.AD_EMOJI[e], text: text, color: D.AD_COLORS[c], until: raw.until, at: typeof raw.at === 'number' ? raw.at : 0 };
  }

  // Picture ads: an approved picture (written by the owner) shows only while
  // the player's matching payment record is live. Returns a clean ad or null.
  var PIC_MAX = 123000; // about 90 KB of image as base64
  function checkPictureAd(img, paid, now) {
    if (!img || !paid || typeof img !== 'object' || typeof paid !== 'object') return null;
    if (typeof img.img !== 'string' || img.img.length > PIC_MAX || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+\/]+={0,2}$/.test(img.img)) return null;
    if (typeof img.sub !== 'string' || !/^[a-z0-9]{6,24}$/.test(img.sub) || paid.sub !== img.sub) return null;
    var P = D.AD_PLANS[img.plan];
    if (!P || !boardDef(img.board) || paid.board !== img.board) return null;
    if (typeof paid.until !== 'number' || paid.until <= now || paid.until > now + (P.days * 24 + 1) * 3600 * 1000) return null;
    return { board: img.board, img: img.img, until: paid.until, plan: img.plan, at: typeof paid.at === 'number' ? paid.at : 0 };
  }

  /* ---------- scoring & goals ---------- */

  function debts(s) {
    return s.arrears + s.loans.reduce(function (a, l) { return a + l.bal; }, 0);
  }
  function netWorth(s) {
    var assets = s.cash + s.bank;
    if (s.ajo && !s.ajo.received) assets += s.ajo.paid;
    s.businesses.forEach(function (b) { assets += roundTo(b.paid * 0.6, 50); });
    s.properties.forEach(function (p) { assets += p.value; });
    if (s.car) assets += roundTo(D.CAR.price * 0.5 * s.econ.infl, 1000);
    (s.vehicles || []).forEach(function (v) { assets += roundTo(v.paid * 0.5, 1000); });
    assets += bondsHeld(s) + stocksValue(s);
    (s.items || []).forEach(function (it) { assets += roundTo(it.paid * 0.4, 50); });
    return assets - debts(s);
  }

  function unlock(s, id) {
    if (s.ach[id]) return;
    s.ach[id] = s.t;
    log(s, 'Achievement: ' + ACHIEVEMENTS[id], 'ach');
  }

  function goalProgress(s) {
    switch (s.goal) {
      case 'japa': {
        var funds = Math.min(1, (s.cash + s.bank) / 15000000);
        return { done: s.edu.ieltsPassed && funds >= 1, parts: [
          { label: 'IELTS passed', done: s.edu.ieltsPassed, value: s.edu.ieltsPassed ? 1 : Math.min(0.9, s.edu.ielts / 20) },
          { label: 'Proof of funds ₦15m (cash + bank)', done: funds >= 1, value: funds }
        ] };
      }
      case 'landlord': {
        var house = s.properties.some(function (p) { return D.PROPERTIES[p.id].house; });
        return { done: house, parts: [{ label: 'Own a house (cheapest ' + naira(price(s, D.PROPERTIES.iko_house.price)) + ')', done: house, value: house ? 1 : Math.min(0.99, Math.max(0, netWorth(s)) / price(s, D.PROPERTIES.iko_house.price)) }] };
      }
      case 'odogwu': {
        var lvl = s.job ? s.job.level : 0;
        return { done: lvl >= 4, parts: [{ label: 'Career level 5 of 5', done: lvl >= 4, value: lvl / 4 }] };
      }
      default:
        return { done: false, parts: [{ label: 'Net worth ₦1m', done: netWorth(s) >= 1000000, value: Math.min(1, Math.max(0, netWorth(s)) / 1000000) }] };
    }
  }

  // Runs after every player action.
  function finish(s, res) {
    if (!s.over && (s.needs.hunger <= 0 || s.needs.energy <= 0)) collapse(s, res);
    if (s.over) res.over = true;
    var w = netWorth(s);
    if (w > s.stats.peakWorth) s.stats.peakWorth = w;
    if (w >= 1000000) unlock(s, 'millionaire');
    if (!s.won && s.goal !== 'freestyle' && goalProgress(s).done) {
      s.won = { goal: s.goal, t: s.t };
      log(s, 'Goal complete: ' + D.GOALS[s.goal].name + '! Lagos did not finish you. You can keep playing.', 'ach');
      res.won = true;
    }
    return res;
  }

  function collapse(s, res) {
    var why = s.needs.hunger <= 0 ? 'hunger' : s.sick ? 'malaria' : 'exhaustion';
    if (s.sick) {
      // The hospital treats the malaria too: a drip and a course of drugs. Like the
      // ward bill, it is charged once a week at most; after that the charity fund pays.
      if (s.hospitalWeek !== week(s)) {
        var mb = price(s, 15000);
        if (s.hmo) log(s, 'Your ' + D.HMO[s.hmo].name + ' paid for the malaria treatment (' + naira(mb) + ').', 'good');
        else { var mp = payPartial(s, mb, 'Hospital: malaria treatment'); if (mp < mb) addDebt(s, mb - mp, 'Hospital bill'); }
      }
      s.sick = null;
    }
    // One bill per week at most; a broke patient is treated on credit once,
    // then by the hospital's charity fund. No spiral into endless debt.
    if (s.hospitalWeek !== week(s)) {
      s.hospitalWeek = week(s);
      var bill = price(s, 8000);
      if (s.hmo) log(s, 'Your ' + D.HMO[s.hmo].name + ' paid the hospital bill (' + naira(bill) + ').', 'good');
      else {
        var paid = payPartial(s, bill, 'General Hospital bill');
        if (paid < bill) addDebt(s, bill - paid, 'Hospital bill');
      }
    }
    var ward = s.hmo === 'premium';
    advance(s, ward ? 240 : 360);
    var hc = D.CITIES[cityOf(s)];
    s.loc = hc.hospital;
    s.needs.hunger = Math.max(s.needs.hunger, 60);
    s.needs.energy = Math.max(s.needs.energy, 60);
    s.needs.stress = clamp(s.needs.stress + (ward ? 5 : 15), 0, 100);
    var msg = 'You collapsed from ' + why + ' and woke up in ' + (ward ? 'a private ward near ' : '') + hc.hospitalName + '.';
    log(s, msg, 'bad');
    res.msg = (res.msg ? res.msg + ' ' : '') + msg;
    res.collapsed = true;
  }

  /* ---------- saves ---------- */

  function b64e(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64d(str) { return decodeURIComponent(escape(atob(str))); }

  function serialize(s) {
    var json = JSON.stringify(s);
    return 'LSG' + VERSION + '.' + b64e(json) + '.' + fnv('lasgidi' + json);
  }

  function deserialize(code) {
    var parts = String(code || '').trim().split('.');
    if (parts.length !== 3 || parts[0] !== 'LSG' + VERSION) throw new Error('That is not a Lasgidi save code.');
    var json = b64d(parts[1]);
    var s = JSON.parse(json);
    var tampered = fnv('lasgidi' + json) !== parts[2] || !verifyLedger(s);
    migrate(s);
    return { state: s, tampered: tampered };
  }

  // Cash and bank must equal opening balance plus every ledger line ever posted.
  // Upgrade saves made by older versions in place.
  // Fields added after v0.9 (quests, stocks, streak, staff): filled on every
  // load, because builds 23-25 stamped newer schema numbers without them.
  function ensureFields(s) {
    if (!s.quests) s.quests = {};
    if (!s.stocks) s.stocks = {};
    if (s.streak === undefined) s.streak = null;
    if (!s.staff) s.staff = [];
    if (!s.pets) s.pets = [];
    if (s.hmo === undefined) s.hmo = null;
    if (s.shop === undefined) s.shop = null;
    if (!s.creator) s.creator = { followers: 0, posts: 0, lastPost: -1 };
    if (s.phone === undefined) s.phone = null;
    if (s.title === undefined) s.title = null;
    if (!s.partyJoins) s.partyJoins = {};
    if (s.danfoDriver === undefined) s.danfoDriver = false;
    if (!s.haggles) s.haggles = {};
    if (s.sea === undefined) s.sea = null;
    if (s.mini === undefined) s.mini = null;
    if (s.nysc === undefined) s.nysc = null;
    if (s.sick === undefined) s.sick = null;
    if (!s.interviews) s.interviews = {};
    if (s.build === undefined) s.build = null;
  }
  function migrate(s) {
    if (s) ensureFields(s);
    if (!s || s.sv >= SCHEMA) return s;
    if (s.welfareDay == null) s.welfareDay = -1;
    if (s.viralWeek == null) s.viralWeek = -1;
    if (s.hospitalWeek == null) s.hospitalWeek = -1;
    if (!s.wk) s.wk = { inc: {}, out: {} };
    if (!s.history) s.history = [];
    if (s.report === undefined) s.report = null;
    if (s.replay === undefined) s.replay = null; // lives from before v0.5 cannot be replayed
    if (!s.items) s.items = [];
    if (!s.vehicles) s.vehicles = [];
    if (s.driving == null) s.driving = -1;
    if (!s.bonds) s.bonds = [];
    if (!s.gems) s.gems = {};
    if (!s.giftsOpened) s.giftsOpened = {};
    if (s.econ && s.econ.cbn === undefined) { s.econ.cbn = null; s.econ.cbnWeeks = 0; }
    if (!s.wardrobe) s.wardrobe = [];
    if (!s.outfit) s.outfit = {};
    if (!s.look) s.look = { skin: 2, hair: 0, shape: 1 };
    if (!s.quests) s.quests = {};
    if (!s.rules) { s.rules = 5; s.partner = null; s.kids = []; s.babyPause = -1; if (s.replay) s.replay.rules = 5; }
    s.sv = SCHEMA;
    return s;
  }

  /* ---------- advisor ---------- */

  function minutesUntilRent(s) {
    var d = day(s), target = (d + ((5 - dow(s) + 7) % 7)) * 1440 + 720;
    if (target <= s.t) target += 7 * 1440;
    return target - s.t;
  }

  function route(s, dest, prefer) {
    var opts = travelOptions(s, dest).filter(function (o) { return !o.disabled; });
    if (!opts.length) return null;
    opts.sort(prefer === 'cheap'
      ? function (a, b) { return a.cost - b.cost || a.mins - b.mins; }
      : function (a, b) { return a.mins - b.mins || a.cost - b.cost; });
    return opts[0];
  }

  function hhmm(mins) { return String(Math.floor(mins / 60) % 24).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0'); }

  function foodHint(s) {
    var here = availableActions(s).filter(function (a) { return !a.disabled && ((a.fx && a.fx.hunger >= 30 && a.special !== 'welfare') || a.special === 'cook'); })
      .sort(function (a, b) { return a.price - b.price; })[0];
    if (here) return { kind: 'warn', text: 'Your belle is empty. ' + here.label + (here.price ? ' for ' + naira(here.price) : '') + '.', act: { type: 'act', id: here.id } };
    var welfare = availableActions(s).filter(function (a) { return !a.disabled && a.special === 'welfare'; })[0];
    if (welfare) return { kind: 'warn', text: 'You are broke and hungry. ' + welfare.label + '.', act: { type: 'act', id: welfare.id } };
    var best = null;
    Object.keys(D.PLACE_ACTIONS).forEach(function (d) {
      if (d === s.loc || districtCity(d) !== cityOf(s)) return;
      D.PLACE_ACTIONS[d].forEach(function (a) {
        if (!(a.fx && a.fx.hunger >= 30) || a.special === 'welfare' || !inWindow(s, a.when)) return;
        var r = route(s, d, 'cheap');
        if (!r || !canAfford(s, r.cost + price(s, a.cost))) return;
        if (r.mode === 'trek' && r.km > 5) return;
        var score = r.mins + (r.cost + price(s, a.cost)) / 100;
        if (!best || score < best.score) best = { score: score, d: d, a: a, r: r };
      });
    });
    if (best) return { kind: 'warn', text: 'Your belle is empty. ' + best.a.label + ' in ' + D.DISTRICTS[best.d].name + ' (' + D.MODES[best.r.mode].name + ', ' + fmtMins(best.r.mins) + ').', act: { type: 'travel', dest: best.d, mode: best.r.mode } };
    return { kind: 'warn', text: 'Your belle is empty and food is out of reach. Go home and ask a neighbour.' };
  }

  function shiftHint(s) {
    var c = D.CAREERS[s.job.id], m = minuteOfDay(s), st = c.start * 60;
    if (c.days.indexOf(dow(s)) < 0 || s.job.lastShift === day(s) || m > st + 60) return null;
    var title = c.titles[s.job.level];
    var shiftMins = c.end * 60 - Math.max(m, st);
    var p = project(s, { mins: shiftMins, special: 'shift', fx: {} });
    if (p.energy <= 5 || p.hunger <= 5) {
      var slack = st + 15 - m;
      if (p.hunger <= 5 && p.energy > 5 && slack >= 45) { var fh = foodHint(s); if (fh && fh.act && fh.act.type === 'act') return { kind: 'warn', text: 'Eat before your ' + title + ' shift or you will collapse on the job. ' + fh.text.replace(/^[^.]+\.\s*/, ''), act: fh.act }; }
      if (p.energy <= 5 && homeDistrict(s) === s.loc && slack >= 120) return { kind: 'warn', text: 'You are too tired for a ' + fmtMins(shiftMins) + ' shift. Nap first; there is time.', act: { type: 'act', id: 'home_nap' } };
      return { kind: 'warn', text: 'You are not fit for today\'s ' + fmtMins(shiftMins) + ' ' + title + ' shift. Working it means collapsing; skipping it is a strike (' + s.job.missed + '/3 so far).' };
    }
    if (s.loc === c.district) {
      if (m >= st - 60) return { kind: 'go', text: 'Your ' + title + ' shift is open. Clock in' + (m > st + 15 ? ' now. You are already late.' : ' before ' + hhmm(st + 15) + ' for full pay.'), act: { type: 'act', id: 'work_shift' } };
      return { kind: 'info', text: 'Your shift starts here at ' + hhmm(st) + '. Clock-in opens at ' + hhmm(st - 60) + '.' };
    }
    // Cheapest ride that still arrives on time; fastest if none can.
    var opts = travelOptions(s, c.district).filter(function (o) { return !o.disabled; })
      .sort(function (a, b) { return a.cost - b.cost || a.mins - b.mins; });
    var r = opts.filter(function (o) { return m + o.mins <= st + 15 && !(o.mode === 'trek' && o.km > 3); })[0] || route(s, c.district, 'fast');
    if (!r) return { kind: 'warn', text: 'You cannot afford any ride to work in ' + D.DISTRICTS[c.district].name + '.' };
    // Leaving later only helps if the cheap ride still makes it then.
    if (m + r.mins <= st + 15 && st - (m + r.mins) > 60) return { kind: 'info', text: 'Shift at ' + hhmm(st) + ' in ' + D.DISTRICTS[c.district].name + '. Leave by ' + hhmm(Math.max(0, st - r.mins)) + ' (' + D.MODES[r.mode].name + ', ' + fmtMins(r.mins) + (r.cost ? ', ' + naira(r.cost) : '') + ').' };
    var arrive = m + r.mins;
    if (arrive > st + 60) return { kind: 'warn', text: 'You will miss today\'s ' + title + ' shift. That is a strike (' + s.job.missed + '/3 so far).' };
    if (st - arrive <= 90) return { kind: 'go', text: 'Leave now for work in ' + D.DISTRICTS[c.district].name + ': ' + D.MODES[r.mode].name + ', ' + fmtMins(r.mins) + (r.cost ? ', ' + naira(r.cost) : '') + (arrive > st + 15 ? '. You will be late.' : '.'), act: { type: 'travel', dest: c.district, mode: r.mode } };
    return { kind: 'info', text: 'Shift at ' + hhmm(st) + ' in ' + D.DISTRICTS[c.district].name + '. Leave by ' + hhmm(Math.max(0, st - r.mins)) + ' (' + D.MODES[r.mode].name + ', ' + fmtMins(r.mins) + ').' };
  }

  function jobHint(s, nearHome) {
    var best = null;
    Object.keys(D.CAREERS).forEach(function (cid) {
      var c = D.CAREERS[cid], connect = connectFor(s, cid);
      if (districtCity(c.district) !== cityOf(s)) return;
      if (nearHome && ((s.job && s.job.id === cid) || distance(homeDistrict(s), c.district) > 6)) return;
      // Never talk someone out of a better-paid career just to shorten the commute.
      if (nearHome && s.job && c.pay[0] < D.CAREERS[s.job.id].pay[s.job.level] * 0.6) return;
      if (skillLevel(s, c.skill) < c.req[0] && !connect) return;
      if (c.degree && !s.edu.degree && !connect) return;
      var r = c.district === s.loc ? { mins: 0, cost: 0 } : route(s, c.district, 'cheap');
      if (!r) return;
      // Rank by the daily commute from home, not by where you stand now.
      var commuteKm = homeDistrict(s) === c.district ? 0 : distance(homeDistrict(s), c.district);
      var score = commuteKm * 8 - c.pay[0] / 100;
      if (!best || score < best.score) best = { score: score, cid: cid, r: r };
    });
    if (!best) return nearHome ? null : { kind: 'info', text: 'No job will take you yet. Build Hustle with gigs like hawking in Oshodi.' };
    var c = D.CAREERS[best.cid];
    if (c.district === s.loc) return { kind: 'go', text: 'You have no job. ' + c.titles[0] + ' (' + naira(c.pay[0]) + '/shift) is hiring right here.', act: { type: 'apply', id: best.cid } };
    return { kind: 'go', text: 'You have no job. ' + c.titles[0] + ' in ' + D.DISTRICTS[c.district].name + ' will take you (' + naira(c.pay[0]) + '/shift). Apply in person.', act: { type: 'travel', dest: c.district, mode: best.r.mode } };
  }

  // Far from home (another city) and tired or late: the cheapest bed here you can pay for.
  function lodgeHint(s) {
    if (districtCity(homeDistrict(s)) === cityOf(s)) return null;
    var o = lodgingOptions(s).filter(function (x) { return !x.disabled; }).sort(function (a, b) { return a.price - b.price; })[0];
    return o ? { kind: 'warn', text: 'You are far from home. ' + o.name + ' here: ' + naira(o.price) + ' a night.', act: { type: 'lodge', id: o.id } } : null;
  }
  function advise(s) {
    if (s.pending.length || s.over) return [];
    var out = [], lh0;
    if (s.sick && !s.sick.drugs) out.push({ kind: 'warn', text: '🦟 You have malaria' + (day(s) - s.sick.since >= 3 ? ' and it is getting worse' : '') + '. Antimalarials from a chemist cost ' + naira(treatCost(s)) + '.', act: treatBlock(s) ? null : { type: 'treat' } });
    if (s.needs.hunger < 30) out.push(foodHint(s));
    if (s.needs.energy < 25) {
      if (homeDistrict(s) === s.loc) {
        var am3 = alarmMins(s);
        out.push(am3 != null && am3 < 480
          ? { kind: 'warn', text: 'You are exhausted. Sleep with your alarm set so you do not miss work.', act: { type: 'act', id: 'home_alarm' } }
          : { kind: 'warn', text: 'You are exhausted. Sleep before you collapse.', act: { type: 'act', id: 'home_sleep' } });
      }
      else if ((lh0 = lodgeHint(s))) out.push(lh0);
      else {
        var r = route(s, homeDistrict(s), 'cheap');
        out.push({ kind: 'warn', text: 'You are exhausted. Go home to sleep' + (r ? ' (' + D.MODES[r.mode].name + ', ' + fmtMins(r.mins) + ').' : '.'), act: r ? { type: 'travel', dest: homeDistrict(s), mode: r.mode } : null });
      }
    }
    if (s.needs.energy >= 25 && hour(s) >= 21 && districtCity(homeDistrict(s)) !== cityOf(s)) { var lh = lodgeHint(s); if (lh) out.push(lh); }
    if (s.job) { var sh = shiftHint(s); if (sh) out.push(sh); }
    if (s.job && hour(s) >= 20 && s.needs.energy < 70 && homeDistrict(s) === s.loc && !out.some(function (t) { return t.act && t.act.id === 'home_sleep'; })) {
      var nc = D.CAREERS[s.job.id];
      var am2 = alarmMins(s);
      if (am2 != null) out.push({ kind: 'go', text: 'Sleep now with your alarm set. Your next ' + nc.titles[s.job.level] + ' shift starts at ' + hhmm(nc.start * 60) + '.', act: { type: 'act', id: 'home_alarm' } });
    } else if (s.job && hour(s) >= 19 && s.needs.energy < 60 && homeDistrict(s) !== s.loc && !out.length) {
      var hr = route(s, homeDistrict(s), 'cheap');
      if (hr) out.push({ kind: 'info', text: 'Head home to rest before tomorrow\'s shift (' + D.MODES[hr.mode].name + ', ' + fmtMins(hr.mins) + ').', act: { type: 'travel', dest: homeDistrict(s), mode: hr.mode } });
    }
    var due = minutesUntilRent(s);
    if (s.rentRate && due <= 48 * 60 && s.cash + s.bank < s.rentRate) {
      var gig = availableActions(s).filter(function (a) { return a.gig && a.earn && !a.disabled; })[0];
      out.push({ kind: 'warn', text: 'Rent of ' + naira(s.rentRate) + ' is due in ' + fmtMins(due) + '. You are ' + naira(s.rentRate - s.cash - s.bank) + ' short.' + (gig ? ' ' + gig.label + ' pays about ' + naira(gig.earnEst) + '.' : ''), act: gig ? { type: 'act', id: gig.id } : { type: 'tab', id: 'money' } });
    }
    if (s.pantry <= 1 && !out.some(function (t) { return t.kind === 'warn' && t.act && t.act.type !== 'tab'; })) {
      var shop = availableActions(s).filter(function (a) { return a.special === 'pantry7' && !a.disabled && a.price + s.rentRate <= s.cash + s.bank; })[0];
      if (shop) out.push({ kind: 'info', text: 'Your kitchen is empty. ' + shop.label.replace(/ \(7 meals\)/, '') + ': 7 meals for ' + naira(shop.price) + ', far cheaper than eating out.', act: { type: 'act', id: shop.id } });
    }
    if (s.job && s.rentRate) {
      var jc = D.CAREERS[s.job.id], weekly = jc.pay[s.job.level] * s.econ.wage * jc.days.length;
      if (s.rentRate > weekly * 0.45 && s.cash + s.bank < s.rentRate * 6) {
        var near = Object.keys(D.HOMES).filter(function (k) { return !D.HOMES[k].hidden && districtCity(D.HOMES[k].district) === districtCity(jc.district) && D.HOMES[k].rent * s.econ.infl <= weekly * 0.3; })
          .sort(function (x, y) { return distance(D.HOMES[x].district, jc.district) - distance(D.HOMES[y].district, jc.district); })[0];
        if (near && near !== s.home) {
          var mc = moveInCost(s, near).total, canMove = !s.arrears && canAfford(s, mc);
          out.push({ kind: 'warn', text: 'Rent (' + naira(s.rentRate) + ') eats most of your ' + naira(Math.round(weekly)) + ' weekly pay. ' + D.HOMES[near].name + ' is ' + naira(price(s, D.HOMES[near].rent)) + ' a week and close to work. Move-in costs ' + naira(mc) + '.',
            act: canMove ? { type: 'move', id: near } : { type: 'tab', id: 'money' } });
        }
      }
    }
    if (s.arrears) out.push({ kind: 'warn', text: 'You owe ' + naira(s.arrears) + ' in rent. Three missed rents and you are out.', act: { type: 'tab', id: 'money' } });
    if (!s.job) out.push(jobHint(s));
    else if (distance(homeDistrict(s), D.CAREERS[s.job.id].district) > 12) {
      // A long commute burns money and energy every day; a job near home may pay less but leave more.
      var local = jobHint(s, true);
      if (local && local.act) out.push(Object.assign(local, { kind: 'info', text: 'Your commute to ' + D.DISTRICTS[D.CAREERS[s.job.id].district].name + ' is ' + distance(homeDistrict(s), D.CAREERS[s.job.id].district) + ' km each way. ' + local.text.replace(/^You have no job\. /, 'Closer to home: ') }));
    }
    if (s.loc !== homeDistrict(s) && !out.some(function (t) { return t.act; })) {
      var home = route(s, homeDistrict(s), 'cheap');
      if (home && home.mode === 'trek' && s.cash + s.bank < price(s, 300)) {
        var g = availableActions(s).filter(function (a) { return a.gig && a.earn && !a.disabled; })[0];
        out.push(g ? { kind: 'warn', text: 'You are broke and far from home. ' + g.label + ' pays about ' + naira(g.earnEst) + ', enough for a ride.', act: { type: 'act', id: g.id } }
          : { kind: 'warn', text: 'You are broke and far from home. Trek back to ' + D.DISTRICTS[homeDistrict(s)].name + ' (' + fmtMins(home.mins) + ').', act: { type: 'travel', dest: homeDistrict(s), mode: 'trek' } });
      }
    }
    if (!out.length && s.cash + s.bank < s.rentRate * 2) {
      var gig2 = availableActions(s).filter(function (a) { return a.gig && a.earn && !a.disabled; })[0];
      if (gig2) out.push({ kind: 'info', text: 'Money is tight. ' + gig2.label + ' pays about ' + naira(gig2.earnEst) + '.', act: { type: 'act', id: gig2.id } });
    }
    if (s.needs.hygiene < 20 && homeDistrict(s) === s.loc) out.push({ kind: 'info', text: 'You smell. A bucket bath takes 30 minutes.', act: { type: 'act', id: 'home_bath' } });
    if (s.needs.stress > 75) {
      // Stress comes from neglected needs, so fix the lowest one, cheaply.
      var lowNeed = ['social', 'fun', 'hygiene'].sort(function (x, y) { return s.needs[x] - s.needs[y]; })[0];
      var cap = Math.min(price(s, 1000), (s.cash + s.bank) / 5);
      var calm = availableActions(s).filter(function (a) {
        return !a.disabled && a.fx && !a.collapseRisk && !(a.fx.energy < -10) && a.price <= cap && !a.gig &&
          ((a.fx[lowNeed] || 0) > 0 || (a.fx.stress || 0) < 0);
      }).sort(function (a, b) {
        var ra = (a.fx[lowNeed] || 0) > 0 ? 0 : 1, rb = (b.fx[lowNeed] || 0) > 0 ? 0 : 1;
        return (ra - rb) || (a.price - b.price) || ((b.fx[lowNeed] || 0) - (a.fx[lowNeed] || 0));
      })[0];
      if (calm && !((calm.fx[lowNeed] || 0) > 0)) lowNeed = 'stress';
      out.push(calm ? { kind: 'info', text: (lowNeed === 'stress' ? 'Stress is high and your work suffers. ' : 'Stress is high because your ' + ({ social: 'social life', fun: 'enjoyment', hygiene: 'hygiene' })[lowNeed] + ' is low. ') + calm.label + (calm.price ? ' (' + naira(calm.price) + ')' : ' (free)') + '.', act: { type: 'act', id: calm.id } }
        : { kind: 'info', text: 'Stress is high and your work suffers. Worship on Lagos Island, a beach day or Nollywood at home will calm you down.' });
    }
    if (s.rules >= 6 && s.partner) {
      var pr = s.partner, la = loveActions(s).map(function (x) { return describe(s, x); }).filter(function (x) { return !x.disabled; });
      if (pr.aff < 35 && pr.stage !== 'married') {
        var lv = la.filter(function (x) { return x.id === 'love_date'; })[0] || la.filter(function (x) { return x.id === 'love_call' && pr.called !== day(s); })[0];
        out.push({ kind: 'warn', text: pr.name + ' feels ignored (' + pr.aff + '/100). ' + (lv ? lv.label + '.' : 'Call from home or take ' + pr.name + ' on a date.'), act: lv ? { type: 'act', id: lv.id } : null });
      } else if (pr.stage === 'introduced' && pr.aff >= 75 && weddingOptions(s).some(function (w) { return !w.disabled; })) {
        out.push({ kind: 'go', text: pr.name + ' is ready to marry you. Plan the wedding on the Me tab.', act: { type: 'tab', id: 'me' } });
      }
    }
    if (s.goal === 'japa' && !s.edu.ieltsPassed && s.edu.ielts < 10 && s.job) out.push({ kind: 'info', text: 'Japa plan: IELTS prep classes in Yaba raise your pass chance (' + s.edu.ielts + ' of 10+ done).' });
    if (s.goal === 'landlord' && s.bank < 100000 && !s.ajo && s.job) out.push({ kind: 'info', text: 'Landlord plan: an ajo forces you to save. Join one in the Money tab.', act: { type: 'tab', id: 'money' } });
    var seenAct = {};
    return out.filter(function (t) {
      if (!t) return false;
      var key = t.act ? t.act.type + ':' + (t.act.id || t.act.dest) : null;
      if (key && seenAct[key]) return false;
      if (key) seenAct[key] = true;
      return true;
    }).slice(0, 3);
  }

  // A scored summary of this life, for the hall of lives.
  /* ---------- the next generation ---------- */
  var HEIR_CAP = 50000000, ESTATE_CUT = 0.1;
  function cleanHeir(h) {
    if (!h || typeof h !== 'object') return null;
    var int = function (v, lo, hi) { return typeof v === 'number' && Math.round(v) === v && v >= lo && v <= hi; };
    if (typeof h.name !== 'string' || !h.name || h.name.length > 24 || typeof h.parent !== 'string' || h.parent.length > 24) return null;
    if (!int(h.inherit, 0, HEIR_CAP) || !int(h.as, 0, 50) || !int(h.bond, 0, 100) || (h.school != null && !SCHOOLS[h.school])) return null;
    // The family line (oldest first) and the generation; heirs from before dynasties default to generation 2.
    var line = h.line == null ? [h.parent] : h.line, gen = h.gen == null ? 2 : h.gen;
    if (!Array.isArray(line) || !line.length || line.length > 8 || line.some(function (n) { return typeof n !== 'string' || !n || n.length > 24; }) || !int(gen, 2, 50)) return null;
    return { name: h.name, parent: h.parent, inherit: h.inherit, school: h.school || null, as: h.as, bond: h.bond, line: line.slice(), gen: gen };
  }
  // When a life with children ends: each child's share of the estate, and the family line.
  function heirOffers(s) {
    if (!s || s.challenge || !s.kids || !s.kids.length) return [];
    var estate = Math.max(0, netWorth(s)); // net worth is after debts
    var share = Math.min(HEIR_CAP, roundTo(estate * (1 - ESTATE_CUT) / s.kids.length, 1000));
    var me = String(s.name || 'Ade').slice(0, 24), line = ((s.heir && s.heir.line) || []).concat([me]).slice(-8), gen = (s.heir ? s.heir.gen || 2 : 1) + 1;
    return s.kids.map(function (k, i) {
      return cleanHeir({ name: kidName(s, i), parent: me, inherit: share, school: k.school || null, line: line, gen: Math.min(50, gen),
        as: Math.min(50, (k.reports || []).filter(function (r) { return r.grade === 'A'; }).length), bond: Math.round(k.bond || 0) });
    }).filter(Boolean);
  }
  function heirOffer(s) { return heirOffers(s)[0] || null; }

  function lifeSummary(s) {
    var weeks = week(s) + 1, worth = netWorth(s), achievements = Object.keys(s.ach).length;
    var score = scoreOf({ worth: worth, weeks: weeks, achievements: achievements, won: !!s.won, level: s.job ? s.job.level : 0,
      married: !!(s.partner && s.partner.stage === 'married'), kids: (s.kids || []).length, status: statusPoints(s) });
    return {
      name: s.name, origin: s.origin, gen: s.heir ? s.heir.gen || 2 : 1, goal: s.goal, won: !!s.won, weeks: weeks, worth: worth,
      peak: s.stats.peakWorth, title: s.job ? D.CAREERS[s.job.id].titles[s.job.level] : null,
      home: s.home, achievements: achievements, score: score, tampered: !!s.tampered
    };
  }

  /* ---------- shared hall of fame ----------
   * Entries are written by players' own browsers, so they are untrusted.
   * Readers never trust a stored score: they rebuild it from the fields and
   * drop entries that no honest game could produce. A server-run engine is
   * the real fix (docs/REVIEW.md §5); this keeps casual edits off the board. */

  var FAME_FIELDS = { weeks: 1, worth: 1, achievements: 1, level: 1, won: 1, origin: 1, goal: 1, married: 1, kids: 1, status: 1 };

  function scoreOf(e) {
    return Math.round(Math.max(0, e.worth) / 1000 + e.weeks * 10 + e.achievements * 50 + (e.won ? 500 : 0) + e.level * 40 +
      (e.married ? 200 : 0) + (e.kids || 0) * 100 + Math.min(2000, (e.status || 0) * 2));
  }

  function fameEntry(s) {
    var e = {
      v: 1, weeks: week(s) + 1, worth: netWorth(s), achievements: Object.keys(s.ach).length,
      level: s.job ? s.job.level : 0, won: !!s.won, origin: s.origin, goal: s.goal,
      career: s.job ? s.job.id : null, home: s.home, seal: s.ledgerHash, lines: s.ledgerCount,
      married: !!(s.partner && s.partner.stage === 'married'), kids: (s.kids || []).length, status: statusPoints(s)
    };
    e.score = scoreOf(e);
    if (s.heir) { e.inherit = s.heir.inherit; e.gen = s.heir.gen || 2; }
    if (s.replay) { e.replay = { seed: s.replay.seed, goal: s.replay.goal, origin: s.replay.origin, rules: s.replay.rules, challenge: s.replay.challenge || null, acts: s.replay.acts }; if (s.replay.heir) e.replay.heir = s.replay.heir; }
    return e;
  }

  // Returns a cleaned entry, or null when it is malformed or implausible.
  function checkFame(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var e = {};
    var int = function (v, lo, hi) { return typeof v === 'number' && isFinite(v) && Math.round(v) === v && v >= lo && v <= hi; };
    if (!int(raw.weeks, 1, 5200) || !int(raw.worth, -1e9, 1e12) || !int(raw.achievements, 0, Object.keys(ACHIEVEMENTS).length) || !int(raw.level, 0, 4)) return null;
    if (typeof raw.won !== 'boolean' || !D.ORIGINS[raw.origin] || !D.GOALS[raw.goal]) return null;
    if (raw.married != null && typeof raw.married !== 'boolean') return null;
    if (raw.kids != null && !int(raw.kids, 0, 3)) return null;
    if (raw.status != null && !int(raw.status, 0, 100000)) return null;
    Object.keys(FAME_FIELDS).forEach(function (k) { e[k] = raw[k]; });
    e.married = !!raw.married; e.kids = raw.kids || 0; e.status = raw.status || 0;
    e.career = typeof raw.career === 'string' && D.CAREERS[raw.career] ? raw.career : null;
    e.home = typeof raw.home === 'string' && D.HOMES[raw.home] ? raw.home : null;
    // Ceiling on wealth: starting cash plus a generous ₦3m a week.
    if (e.origin === 'heir') { if (!int(raw.inherit, 0, HEIR_CAP)) return null; e.inherit = raw.inherit; if (raw.gen != null) { if (!int(raw.gen, 2, 50)) return null; e.gen = raw.gen; } }
    else if (raw.gen != null) return null;
    if (e.worth > (e.origin === 'heir' ? e.inherit : D.ORIGINS[e.origin].cash) * 2 + e.weeks * 3000000) return null;
    if (e.level > 0 && !e.career) return null;
    e.score = scoreOf(e);
    return e;
  }

  /* ---------- replay verification ----------
   * The engine is deterministic: seed + starting choices + the ordered list
   * of player calls fully decide the outcome. A life that carries its log
   * can be rebuilt by anyone, and its ledger seal must come out identical.
   * Faking a score then means actually playing (or botting) it. */

  var MAX_ACTS = 10000; // ~190 KB of log, under the 256 KB row limit (about 140 weeks of play)
  var RECORDED = {}; // code -> engine function, filled in below

  function replayLife(rp) {
    if (!rp || typeof rp.seed !== 'number' || !Array.isArray(rp.acts) || rp.acts.length > MAX_ACTS) return null;
    if (!D.GOALS[rp.goal] || (rp.origin !== null && !D.ORIGINS[rp.origin])) return null;
    var rules = rp.rules == null ? 5 : rp.rules;
    if (!(rules >= 5 && rules <= RULES && Math.round(rules) === rules)) return null;
    if (rp.challenge != null && !CHALLENGE_ID.test(rp.challenge)) return null;
    if (rp.origin === 'heir' && !cleanHeir(rp.heir)) return null;
    if (rp.traits != null && !cleanTraits(rp.traits)) return null;
    var s = newGame({ seed: rp.seed, goal: rp.goal, origin: rp.origin || undefined, name: 'Replay', rules: rules, challenge: rp.challenge || undefined, heir: rp.heir, traits: rp.traits, startHome: rp.home, look: rp.look, outfit: rp.outfit });
    for (var i = 0; i < rp.acts.length; i++) {
      var a = rp.acts[i];
      if (!Array.isArray(a) || !RECORDED[a[0]]) return null;
      try { RECORDED[a[0]].fn.apply(null, [s].concat(a.slice(1))); } catch (e) { return null; }
    }
    return s;
  }

  // Rebuild an entry's life and check it lands exactly where it claims.
  function verifyFame(raw) {
    var e = checkFame(raw);
    if (!e || !raw.replay) return { ok: false, entry: e, reason: e ? 'no replay' : 'malformed' };
    var s = replayLife(raw.replay);
    if (!s) return { ok: false, entry: e, reason: 'replay failed' };
    var got = fameEntry(s);
    var same = got.seal === raw.seal && got.lines === raw.lines && got.score === e.score && got.weeks === e.weeks && got.worth === e.worth;
    return { ok: same, entry: same ? got : e, reason: same ? null : 'does not match its replay' };
  }

  /* ---------- gifts between players (mood only, never cash) ---------- */
  function sendGift(s, id) {
    var G = D.GIFTS[id];
    if (!G) return fail('No such gift.');
    if (s.pending.length) return fail('Decide on the open event first.');
    var cost = price(s, G.price);
    s.alerts = [];
    if (!pay(s, cost, 'Gift: ' + G.name)) return fail(G.name + ' costs ' + naira(cost) + '.');
    applyFx(s, { social: 5 });
    return ok('You sent a ' + G.name.toLowerCase() + '.');
  }
  // key identifies the gift (sender and time); up to 3 opened per game day.
  function openGift(s, key, id) {
    var G = D.GIFTS[id];
    if (!G || typeof key !== 'string' || key.length > 80) return fail('That gift is not valid.');
    if (Object.prototype.hasOwnProperty.call(s.giftsOpened, key)) return fail('You already opened this gift.');
    var today = day(s), n = Object.keys(s.giftsOpened).filter(function (k) { return s.giftsOpened[k] === today; }).length;
    if (n >= 3) return fail('You have opened three gifts today. Save the rest for tomorrow.');
    s.giftsOpened[key] = today;
    applyFx(s, G.fx);
    unlock(s, 'gifted');
    return finish(s, ok(G.icon + ' You opened a ' + G.name.toLowerCase() + '. Your mood lifts.'));
  }

  /* ---------- Daily gem hunt ---------- */
  // Every real-world day hides the same 5 gems for everyone, at places picked
  // from the date. Each gem pays once per life; prizes grow through the day's
  // hunt. One hunt day per game day, so old dates cannot be farmed.
  var GEM_ID = /^\d{4}-\d{2}-\d{2}$/, GEM_COUNT = 5, GEM_PRIZES = [3000, 5000, 8000, 12000, 20000];
  function gemDayId(date) { return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0'); }
  function gemsFor(dayId) {
    if (!GEM_ID.test(dayId)) return [];
    var h = 2166136261;
    for (var i = 0; i < dayId.length; i++) { h ^= dayId.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var pool = D.PLACES.filter(function (p) { return !p.nogem && (D.DISTRICTS[p.district].city || 'lagos') === 'lagos'; }).map(function (p) { return p.id; }), out = [];
    while (out.length < GEM_COUNT && pool.length) {
      h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; h = (h ^ (h >>> 13)) >>> 0;
      out.push(pool.splice(h % pool.length, 1)[0]);
    }
    return out.map(function (id) { var p = D.PLACES.filter(function (x) { return x.id === id; })[0]; return { place: id, district: p.district }; });
  }
  function gemsFound(s, dayId) { return (s.gems && s.gems[dayId] && s.gems[dayId].got) || []; }
  function nextGemPrize(s, dayId) { var n = gemsFound(s, dayId).length; return n < GEM_COUNT ? price(s, GEM_PRIZES[n]) : 0; }
  function collectGem(s, dayId, n) {
    if (!GEM_ID.test(dayId)) return fail('No gem hunt for that day.');
    var gems = gemsFor(dayId), g = gems[n];
    if (!g || Math.round(n) !== n) return fail('No such gem.');
    if (s.pending.length) return fail('Decide on the open event first.');
    if (s.loc !== g.district) return fail('That gem is in ' + D.DISTRICTS[g.district].name + '. Go there first.');
    var rec = s.gems[dayId];
    if (!rec) {
      var today = day(s);
      if (Object.keys(s.gems).some(function (k) { return s.gems[k].day === today; })) return fail('You already hunted today in this life. Sleep, and try tomorrow\'s gems.');
      rec = s.gems[dayId] = { day: today, got: [] };
    }
    if (rec.got.indexOf(n) >= 0) return fail('You already picked up this gem.');
    var prize = nextGemPrize(s, dayId);
    s.alerts = [];
    advance(s, 15);
    rec.got.push(n);
    earn(s, prize, 'Gem hunt prize');
    if (rec.got.length === GEM_COUNT) unlock(s, 'gems');
    return finish(s, ok('💎 You found a gem! +' + naira(prize) + '.'));
  }

  /* ---------- the stock exchange ---------- */
  // Prices are a random walk seeded by the life's seed and the ticker, one
  // step per game day. They never touch s.rng, so older lives replay unchanged.
  var STOCK_FEE = 0.015, STOCK_MIN_FEE = 500, STOCK_CAP = 20000000, priceMemo = {};
  function stockSeries(seed, id, d) {
    var key = seed + ':' + id, arr = priceMemo[key];
    if (!arr) { if (Object.keys(priceMemo).length > 64) priceMemo = {}; arr = priceMemo[key] = [Math.log(D.STOCKS[id].base)]; }
    var S = D.STOCKS[id];
    while (arr.length <= d) {
      var i = arr.length;
      // Half of each day's move is the whole market's, half the company's own.
      var z = 0.5 * gauss(seed + ':mkt:' + i) + 0.866 * gauss(key + ':' + i);
      if (z > 4) z = 4; if (z < -4) z = -4;
      arr.push(arr[i - 1] + S.drift - S.vol * S.vol / 2 + S.vol * z);
    }
    return arr;
  }
  function gauss(k) {
    var u1 = parseInt(fnv(k), 16) / 4294967296, u2 = parseInt(fnv(k + ':b'), 16) / 4294967296;
    return Math.sqrt(-2 * Math.log(u1 || 1e-9)) * Math.cos(2 * Math.PI * u2);
  }
  function stockPrice(s, id, d) {
    if (!D.STOCKS[id]) return 0;
    d = d == null ? day(s) : Math.max(0, d);
    var p = Math.exp(stockSeries(s.seed, id, d)[d]);
    return p < 10 ? Math.round(p * 100) / 100 : Math.round(p * 10) / 10;
  }
  function stockHistory(s, id, n) {
    var d = day(s), out = [];
    for (var i = Math.max(0, d - (n || 30) + 1); i <= d; i++) out.push(stockPrice(s, id, i));
    return out;
  }
  function stocksValue(s) {
    var h = s.stocks || {}, v = 0;
    Object.keys(h).forEach(function (id) { v += Math.floor(h[id].u * stockPrice(s, id)); });
    return v;
  }
  function brokerFee(amt) { return Math.max(STOCK_MIN_FEE, Math.round(amt * STOCK_FEE)); }
  function marketOpen(s) {
    var m = minuteOfDay(s);
    if (dow(s) > 4) return 'The exchange is closed at weekends.';
    if (m < 600 || m >= 870) return 'The exchange trades 10:00 to 14:30 on weekdays.';
    return null;
  }
  function buyStock(s, id, amt) {
    var S = D.STOCKS[id];
    if (!S) return fail('No such stock.');
    if (s.pending.length) return fail('Decide on the open event first.');
    var shut = marketOpen(s); if (shut) return fail(shut);
    amt = Math.floor(amt);
    if (!(amt >= 5000)) return fail('The smallest order is ' + naira(5000) + '.');
    var px = stockPrice(s, id), units = Math.floor(amt / px);
    if (units < 1) return fail('Not enough for one share.');
    var cost = Math.round(units * px), fee = brokerFee(cost);
    if (cost + fee > s.bank) return fail('Shares are paid from savings. You need ' + naira(cost + fee) + ' including the broker\'s fee.');
    s.alerts = [];
    post(s, 'bank', -cost, 'Shares bought: ' + S.ticker);
    post(s, 'bank', -fee, 'Broker fee');
    var invested = Object.keys(s.stocks).reduce(function (a, k) { return a + s.stocks[k].cost; }, 0), cap = price(s, STOCK_CAP);
    if (invested + cost + fee > cap) return fail('Your broker caps a retail account at ' + naira(cap) + ' invested. You have ' + naira(invested) + ' in.');
    var h = s.stocks[id] || (s.stocks[id] = { u: 0, cost: 0 });
    h.u += units; h.cost += cost + fee;
    unlock(s, 'investor');
    return finish(s, ok('Bought ' + units.toLocaleString('en') + ' ' + S.ticker + ' at ' + (px < 100 ? '₦' + px.toFixed(2) : naira(px)) + '. Broker fee ' + naira(fee) + '.'));
  }
  function sellStock(s, id, units) {
    var S = D.STOCKS[id], h = s.stocks && s.stocks[id];
    if (!S || !h) return fail('You hold no ' + (S ? S.ticker : 'such stock') + '.');
    if (s.pending.length) return fail('Decide on the open event first.');
    var shut = marketOpen(s); if (shut) return fail(shut);
    units = Math.floor(units);
    if (!(units >= 1) || units > h.u) return fail('You hold ' + h.u + ' shares.');
    var px = stockPrice(s, id), gross = Math.floor(units * px), fee = Math.min(gross, brokerFee(gross));
    s.alerts = [];
    post(s, 'bank', gross, 'Shares sold: ' + S.ticker);
    post(s, 'bank', -fee, 'Broker fee');
    var basis = Math.round(h.cost * units / h.u);
    h.cost -= basis; h.u -= units;
    if (!h.u) delete s.stocks[id];
    var pl = gross - fee - basis;
    return finish(s, ok('Sold ' + units.toLocaleString('en') + ' ' + S.ticker + ' for ' + naira(gross - fee) + ' after fees (' + (pl >= 0 ? 'profit ' : 'loss ') + naira(Math.abs(pl)) + ').'));
  }
  // Every 13 weeks, dividend payers pay a quarter of their yearly yield.
  function payDividends(s, w) {
    if (!s.stocks || w <= 0 || w % 13 !== 0) return;
    Object.keys(s.stocks).forEach(function (id) {
      var S = D.STOCKS[id], h = s.stocks[id];
      if (!S.div) return;
      var amt = Math.floor(h.u * stockPrice(s, id) * S.div / 4);
      if (amt > 0) { post(s, 'bank', amt, 'Dividend: ' + S.ticker); log(s, S.name + ' paid a dividend: ' + naira(amt) + '.', 'good'); }
    });
  }

  /* ---------- starter quests ---------- */
  var QUEST_CHECKS = {
    get_job:     function (s) { return !!s.job; },
    first_shift: function (s) { return s.stats.shifts > 0; },
    pantry:      function (s) { return s.pantry >= 5; },
    gem:         function (s) { return Object.keys(s.gems || {}).some(function (k) { return s.gems[k].got.length > 0; }); },
    save_100k:   function (s) { return s.bank >= 100000; },
    event:       function (s) { return (s.stats.events || 0) > 0; },
    sleep_oba:   function (s) { return (s.items || []).some(function (it) { return it.id === 'king'; }); },
    promoted:    function (s) { return !!s.ach.promoted; },
    car:         function (s) { return !!s.car || (s.vehicles || []).length > 0; },
    fly:         function (s) { return !!s.ach.traveller; },
    business:    function (s) { return (s.businesses || []).length > 0; },
    shares:      function (s) { return Object.keys(s.stocks || {}).length > 0; },
    party:       function (s) { return !!s.ach.host; },
    shop:        function (s) { return !!s.shop; },
    creator:     function (s) { return !!(s.creator && s.creator.followers >= 1000); },
    danforun:    function (s) { return (s.stats.danfoPax || 0) > 0; },
    nysc:        function (s) { return !!(s.nysc && (s.nysc.stage === 'service' || s.nysc.stage === 'done')); }
  };
  function questDef(id) { return D.QUESTS.filter(function (q) { return q.id === id; })[0]; }
  function questDone(s, id) { var c = QUEST_CHECKS[id]; return !!(c && c(s)); }
  function questReward(s, id) { var q = questDef(id); return q ? price(s, q.reward) : 0; }
  function activeQuests(s, n) {
    var got = s.quests || {};
    var open = D.QUESTS.filter(function (q) { return got[q.id] == null; })
      .map(function (q) { return { id: q.id, icon: q.icon, title: q.title, hint: q.hint, go: q.go, done: questDone(s, q.id), reward: questReward(s, q.id) }; });
    // Ready-to-claim quests first, then the next ones in order.
    return open.filter(function (q) { return q.done; }).concat(open.filter(function (q) { return !q.done; })).slice(0, n || 3);
  }
  function claimQuest(s, id) {
    var q = questDef(id);
    if (!q) return fail('No such quest.');
    if (!s.quests) s.quests = {};
    if (s.quests[id] != null) return fail('You already claimed that.');
    if (s.pending.length) return fail('Decide on the open event first.');
    if (!questDone(s, id)) return fail('Not done yet: ' + q.hint + '.');
    var got = questReward(s, id);
    s.alerts = [];
    s.quests[id] = day(s);
    earn(s, got, 'Quest: ' + q.title);
    return finish(s, ok(q.icon + ' ' + q.title + ' done. +' + naira(got) + '.'));
  }

  /* ---------- domestic staff ---------- */
  function staffRoom(s) { return D.STAFF_ROOM[homeDef(s).type || 'room'] || 0; }
  function staffPay(s, id) { return price(s, D.STAFF[id].pay); }
  function hireStaff(s, id) {
    var St = D.STAFF[id];
    if (!St) return fail('No such job.');
    if (s.pending.length) return fail('Decide on the open event first.');
    if (s.staff.indexOf(id) >= 0) return fail('You already have a ' + St.name.toLowerCase() + '.');
    if (s.staff.length >= staffRoom(s)) return fail(staffRoom(s) ? 'Your home has room for ' + staffRoom(s) + ' staff.' : 'Your home has no room for staff. A self-con or bigger has.');
    if (St.needsCar && !rideCar(s)) return fail('A driver needs a car to drive.');
    var first = staffPay(s, id);
    s.alerts = [];
    if (!pay(s, first, 'Staff: ' + St.name + ' (first week)')) return fail('You need ' + naira(first) + ' for the first week.');
    s.staff.push(id);
    unlock(s, 'oga');
    return finish(s, ok(St.icon + ' Your ' + St.name.toLowerCase() + ' starts tomorrow. ' + naira(first) + ' a week.'));
  }
  function fireStaff(s, id) {
    var i = s.staff.indexOf(id);
    if (i < 0) return fail('You have no ' + (D.STAFF[id] ? D.STAFF[id].name.toLowerCase() : 'such staff') + '.');
    s.staff.splice(i, 1);
    return ok('You let your ' + D.STAFF[id].name.toLowerCase() + ' go.');
  }
  function weeklyStaff(s) {
    if (!s.staff || !s.staff.length) return;
    var room = staffRoom(s);
    while (s.staff.length > room) { var gone = s.staff.pop(); log(s, 'Your ' + D.STAFF[gone].name.toLowerCase() + ' left: there is no room for them in this home.', 'bad'); }
    s.staff = s.staff.filter(function (id) {
      var fee = staffPay(s, id);
      if (pay(s, fee, 'Staff: ' + D.STAFF[id].name)) return true;
      log(s, 'You could not pay your ' + D.STAFF[id].name.toLowerCase() + '. They packed their bags and left.', 'bad');
      return false;
    });
  }

  /* ---------- chieftaincy titles ---------- */
  function titleDef(s) { return s.title ? D.TITLES.filter(function (x) { return x.id === s.title; })[0] : null; }
  function nextTitle(s) {
    var i = s.title ? D.TITLES.map(function (x) { return x.id; }).indexOf(s.title) + 1 : 0;
    return D.TITLES[i] || null;
  }
  function titledName(s) { var ti = titleDef(s); return (ti ? ti.prefix + ' ' : '') + s.name; }
  function takeTitle(s, id) {
    var T = nextTitle(s);
    if (!T || T.id !== id) return fail(T ? 'Titles come in order. Next is ' + T.name + '.' : 'You hold the highest title already.');
    if (s.pending.length) return fail('Decide on the open event first.');
    var need = price(s, T.worth);
    if (netWorth(s) < need) return fail('The palace wants to see a net worth of ' + naira(need) + ' first.');
    var cost = price(s, T.cost);
    s.alerts = [];
    if (!pay(s, cost, 'Chieftaincy: ' + T.name)) return fail('The installation costs ' + naira(cost) + '.');
    advance(s, 360);
    applyFx(s, { social: 40, fun: 30, stress: -10, energy: -20 });
    s.title = T.id;
    unlock(s, 'chief');
    log(s, T.icon + ' You were installed as ' + T.name + '. From today you are ' + titledName(s) + '.', 'ach');
    return finish(s, ok(T.icon + ' Kabiyesi! You are now ' + titledName(s) + '.'));
  }

  /* ---------- creators: phones, followers and weekly brand deals ---------- */
  function phoneCam(s) { return s.phone ? D.PHONES[s.phone].cam : 0.6; }
  function followerGain(s, viral) {
    var f = (s.creator && s.creator.followers) || 0;
    var reach = 1 + Math.min(2, f / 20000), look = outfitTags(s).club || outfitTags(s).owambe ? 1.2 : 1;
    var g = Math.round(40 * phoneCam(s) * (1 + skillLevel(s, 'charisma') * 0.15) * reach * look);
    if (s.rules >= 14 && isDecember(s)) g = Math.round(g * 1.5); // Detty December is all over Instagram and TikTok
    return viral ? g * 4 + 2000 : g;
  }
  /* ---------- skits and live streaming ---------- */
  /* ---------- Lagos labels (display only: no state, no random draw) ---------- */
  function lagosLabels(s) {
    var out = [], o = s.origin, hustle = skillLevel(s, 'hustle');
    if (o === 'lapo') out.push('lapo'); else if (o === 'mid') out.push('ajepako'); else if (o === 'nepo') out.push('nepo');
    if ((o === 'nepo' || (s.heir && (s.heir.school === 'intl' || s.heir.school === 'private'))) && hustle < 3) out.push('ajebo');
    if (s.heir && s.heir.bond >= 60) out.push('omoile');
    if (week(s) < 2 && (s.stats.trips || 0) < 15) out.push('jjc');
    if (hustle >= 5 && (s.stats.trips || 0) >= 50) out.push('areaboy');
    return out;
  }
  function kidLabel(s, i) {
    var k = s.kids[i]; if (!k) return null;
    if (k.school === 'intl') return 'butty';
    if (k.school === 'private') return 'ajebo';
    if ((k.bond || 0) >= 70) return 'omoile';
    if (k.school === 'public' && (k.reports || []).some(function (r) { return r.grade === 'A'; })) return 'ajepako';
    return null;
  }
  function trendingTheme(s) {
    var keys = Object.keys(D.SKIT_THEMES).filter(function (k) { return !D.SKIT_THEMES[k].december || isDecember(s); });
    if (isDecember(s)) return 'detty';
    return keys[parseInt(fnv(s.seed + ':trend:' + week(s)), 16) % keys.length];
  }
  function skitMult(s, theme) {
    var T = D.SKIT_THEMES[theme], m = 1;
    if (theme === trendingTheme(s)) m *= 2;
    if (T.at.indexOf(s.loc) >= 0 || (T.at.indexOf('home') >= 0 && homeDistrict(s) === s.loc)) m *= 1.4;
    return m;
  }
  function skitBlock(s, theme) {
    var T = D.SKIT_THEMES[theme];
    if (!T || (T.december && !isDecember(s))) return 'Pick a skit theme';
    var h = hour(s); if (h < 8 || h >= 23) return 'Film between 08:00 and 23:00';
    if (s.needs.energy < 15) return 'Too tired to perform';
    return busyBlock(s);
  }
  function shootSkit(s, theme) {
    var why = skitBlock(s, theme); if (why) return fail(why + '.');
    if (!s.creator) s.creator = { followers: 0, posts: 0, lastPost: -1 };
    var c = s.creator, T = D.SKIT_THEMES[theme], viral = false, msg = '';
    s.alerts = [];
    advance(s, 90); applyFx(s, { fun: 8, energy: -8 }); addXp(s, { charisma: 2 });
    var chance = 0.03 + skillLevel(s, 'charisma') * 0.01 + (theme === trendingTheme(s) ? 0.03 : 0);
    if (week(s) !== s.viralWeek && rand(s) < chance) {
      s.viralWeek = week(s); viral = true; unlock(s, 'viral');
      var pay2 = price(s, roundTo(15000 + rand(s) * 35000, 1000)) * (1 + Math.floor(skillLevel(s, 'charisma') / 3));
      earn(s, pay2, 'Brand deal from viral post');
      msg = ' It went viral: a brand paid ' + naira(pay2) + '.';
    }
    var got = Math.round(followerGain(s, viral) * skitMult(s, theme));
    c.followers += got; c.posts++; c.lastPost = day(s);
    c.skits = c.skits || {}; c.skits[theme] = (c.skits[theme] || 0) + 1;
    return finish(s, ok(T.icon + ' Skit: ' + T.name + (theme === trendingTheme(s) ? ' (trending this week)' : '') + '. +' + got.toLocaleString('en') + ' followers.' + msg));
  }
  function liveBlock(s) {
    var c = s.creator;
    if (!c || c.followers < 500) return 'Go live from 500 followers: post skits first';
    if (c.liveDay === day(s)) return 'One live stream a day';
    if (!canAfford(s, price(s, 1500))) return 'Data for a stream costs ' + naira(price(s, 1500));
    if (s.needs.energy < 20) return 'Too tired to go live';
    return busyBlock(s);
  }
  function liveEstimate(s) {
    var c = s.creator || { followers: 0 }, h = hour(s), prime = h >= 20 || h < 1 ? 1.5 : 1;
    return Math.round(c.followers * 0.02 * phoneCam(s) * (1 + skillLevel(s, 'charisma') * 0.1) * prime * (isDecember(s) ? 1.5 : 1));
  }
  function goLive(s) {
    var why = liveBlock(s); if (why) return fail(why + '.');
    var c = s.creator, viewers = liveEstimate(s);
    s.alerts = [];
    pay(s, price(s, 1500), 'Data for a live stream');
    // Light and network: at home with no light and no inverter or solar, the stream drops.
    var home = homeDistrict(s) === s.loc, backup = fxSum(s, 'power') > 0, drop = home ? (!s.power && !backup) : rand(s) < 0.1;
    advance(s, 120); applyFx(s, { social: 20, fun: 15, energy: -15 });
    c.liveDay = day(s);
    var gifts = Math.min(price(s, 60000), price(s, viewers * 4 * (0.6 + rand(s) * 0.8))); // about ₦4 a viewer
    if (drop) { gifts = roundTo(gifts * 0.25, 50); viewers = Math.round(viewers * 0.3); }
    if (gifts) earn(s, gifts, 'Live stream gifts');
    var gained = Math.round(viewers * 0.1); c.followers += gained;
    c.lives = (c.lives || 0) + 1; c.peakViewers = Math.max(c.peakViewers || 0, viewers);
    if (viewers >= 1000) unlock(s, 'streamer');
    return finish(s, ok('🔴 Live: ' + viewers.toLocaleString('en') + ' watching' + (drop ? (home ? ', until NEPA took light and the stream dropped' : ', until the network dropped') : '') + '. Gifts ' + naira(gifts) + ', +' + gained.toLocaleString('en') + ' followers.'));
  }
  function creatorInfo(s) {
    return { trend: trendingTheme(s), themes: Object.keys(D.SKIT_THEMES).filter(function (k) { return !D.SKIT_THEMES[k].december || isDecember(s); }).map(function (k) { return { id: k, mult: skitMult(s, k), why: skitBlock(s, k) }; }),
      live: liveBlock(s), viewers: liveEstimate(s), peak: (s.creator && s.creator.peakViewers) || 0 };
  }

  function brandDeal(s) {
    var c = s.creator;
    if (!c || c.followers < 2000) return 0;
    return price(s, Math.min(400, Math.floor(c.followers / 1000)) * 1200);
  }
  function weeklyCreator(s) {
    var c = s.creator; if (!c || !c.followers) return;
    var active = c.lastPost >= day(s) - 7;
    if (!active) { c.followers = Math.floor(c.followers * 0.97); return; }
    if (s.rules >= 9) {
      var deal = brandDeal(s);
      if (deal) { earn(s, deal, 'Brand deal: sponsored posts'); log(s, '📸 Brands paid ' + naira(deal) + ' for this week\'s sponsored posts (' + c.followers.toLocaleString('en') + ' followers).', 'good'); }
    }
  }
  function buyPhone(s, id) {
    var P = D.PHONES[id];
    if (!P) return fail('No such phone.');
    if (s.pending.length) return fail('Decide on the open event first.');
    if (s.phone === id) return fail('You already have this phone.');
    if (s.phone && D.PHONES[s.phone].price >= P.price) return fail('Your ' + D.PHONES[s.phone].name + ' is already better.');
    var cost = price(s, P.price), trade = s.phone ? Math.floor(price(s, D.PHONES[s.phone].price) * 0.3) : 0;
    s.alerts = [];
    if (!pay(s, cost - trade, 'Phone: ' + P.name + (trade ? ' (after trade-in)' : ''))) return fail('This phone costs ' + naira(cost - trade) + (trade ? ' after your trade-in' : '') + '.');
    s.phone = id;
    return finish(s, ok(P.icon + ' New phone: ' + P.name + '. Your content looks ' + (P.cam >= 2.4 ? 'premium' : 'sharper') + ' now.'));
  }

  /* ---------- online shop ---------- */
  var SHOP_SETUP = 10000, SHOP_DISPATCH = 500, SHOP_CUT = 0.05, SHOP_MAX = 500;
  function openShop(s, niche) {
    var N = D.SHOP_NICHES[niche];
    if (!N) return fail('No such shop.');
    if (s.pending.length) return fail('Decide on the open event first.');
    if (s.shop && s.shop.niche === niche) return fail('You already sell ' + N.name.toLowerCase() + '.');
    if (s.shop && s.shop.stock > 0) return fail('Sell or clear your stock before you switch.');
    var fee = price(s, SHOP_SETUP);
    s.alerts = [];
    if (!pay(s, fee, 'Shop setup: ' + N.name)) return fail('Setting up the page, photos and a ring light costs ' + naira(fee) + '.');
    s.shop = { niche: niche, stock: 0, ads: s.shop ? s.shop.ads : 'none', weeks: 0, sold: s.shop ? s.shop.sold : 0, last: null };
    return finish(s, ok(N.icon + ' Your ' + N.name.toLowerCase() + ' page is live. Buy stock to start selling.'));
  }
  function restockShop(s, units) {
    var sh = s.shop; if (!sh) return fail('Open a shop first.');
    if (s.pending.length) return fail('Decide on the open event first.');
    units = Math.floor(units);
    if (!(units >= 1)) return fail('Buy at least one.');
    if (sh.stock + units > SHOP_MAX) return fail('Your room holds ' + SHOP_MAX + ' at most.');
    var N = D.SHOP_NICHES[sh.niche], cost = price(s, N.cost) * units;
    s.alerts = [];
    if (!pay(s, cost, 'Shop stock: ' + units + ' × ' + N.unit)) return fail(units + ' cost ' + naira(cost) + '.');
    sh.stock += units;
    return finish(s, ok('Bought ' + units + ' ' + N.unit + (units === 1 ? '' : 's') + ' for ' + naira(cost) + '. Stock: ' + sh.stock + '.'));
  }
  function setShopAds(s, tier) {
    if (!s.shop) return fail('Open a shop first.');
    if (!D.SHOP_ADS[tier]) return fail('No such ad plan.');
    s.shop.ads = tier;
    return ok(tier === 'none' ? 'No ads from next week.' : D.SHOP_ADS[tier].name + ' from next week: ' + naira(price(s, D.SHOP_ADS[tier].cost)) + ' a week.');
  }
  function closeShop(s) {
    var sh = s.shop; if (!sh) return fail('You have no shop.');
    var back = Math.floor(sh.stock * price(s, D.SHOP_NICHES[sh.niche].cost) * 0.4);
    s.alerts = [];
    if (back > 0) earn(s, back, 'Shop clearance sale');
    s.shop = null;
    return ok('Shop closed.' + (back ? ' The clearance sale brought in ' + naira(back) + '.' : ''));
  }
  function shopDemand(s, tier) {
    var sh = s.shop, N = D.SHOP_NICHES[sh.niche], A = D.SHOP_ADS[tier || sh.ads];
    return N.demand * A.mult * (1 + skillLevel(s, 'charisma') * 0.05) * (monthIndex(s) === 11 ? 1.3 : monthIndex(s) === 0 ? 0.7 : 1);
  }
  function shopPreview(s) {
    var sh = s.shop; if (!sh) return null;
    var N = D.SHOP_NICHES[sh.niche], orders = Math.min(sh.stock, Math.round(shopDemand(s))), unit = price(s, N.price);
    var net = Math.round(orders * (0.94 * unit * (1 - SHOP_CUT) - price(s, SHOP_DISPATCH))) - price(s, D.SHOP_ADS[sh.ads].cost);
    return { orders: orders, demand: Math.round(shopDemand(s)), net: net, profit: net - Math.round(orders * 0.94) * price(s, N.cost), unit: unit, cost: price(s, N.cost) };
  }
  function weeklyShop(s) {
    var sh = s.shop; if (!sh) return;
    var N = D.SHOP_NICHES[sh.niche];
    sh.weeks++;
    if (sh.ads !== 'none' && !pay(s, price(s, D.SHOP_ADS[sh.ads].cost), 'Shop ads: ' + D.SHOP_ADS[sh.ads].name)) { log(s, 'Your ad payment bounced, so the ads stopped.', 'bad'); sh.ads = 'none'; }
    var orders = Math.min(sh.stock, Math.floor(shopDemand(s) * (0.6 + rand(s) * 0.8)));
    // Some customers send it back: the item returns to stock, the rider is still paid.
    var returned = 0; for (var r = 0; r < orders; r++) if (rand(s) < 0.06) returned++;
    var paid = orders - returned;
    var gross = paid * price(s, N.price), cut = Math.round(gross * SHOP_CUT), ship = orders * price(s, SHOP_DISPATCH);
    if (gross) earn(s, gross - cut, 'Shop sales: ' + N.name);
    if (orders) { pay(s, ship, 'Dispatch riders') || addDebt(s, ship, 'Dispatch riders'); }
    sh.stock -= paid; sh.sold += paid;
    var spoiled = N.spoils ? sh.stock : 0;
    if (spoiled) sh.stock = 0;
    sh.last = { w: week(s), orders: paid, returned: returned, gross: gross, net: gross - cut - ship, spoiled: spoiled };
    if (sh.sold >= 100) unlock(s, 'vendor');
    log(s, N.icon + ' Shop week: ' + paid + ' sold' + (returned ? ', ' + returned + ' returned' : '') + ', ' + naira(gross - cut - ship) + ' after fees and dispatch.' + (spoiled ? ' ' + spoiled + ' unsold ' + N.unit + 's spoiled.' : '') + (!sh.stock ? ' You are out of stock.' : ''), orders ? 'good' : 'info');
  }

  /* ---------- pets ---------- */
  function hasYard(s) { return D.YARD_HOMES.indexOf(homeDef(s).type) >= 0; }
  function buyPet(s, id) {
    var P = D.PETS[id];
    if (!P) return fail('No such pet.');
    if (s.pending.length) return fail('Decide on the open event first.');
    if (s.pets.indexOf(id) >= 0) return fail('You already have a ' + P.name.toLowerCase() + '.');
    if (s.pets.length >= 3) return fail('Three pets is plenty.');
    if (P.yard && !hasYard(s)) return fail('A ' + P.name.toLowerCase() + ' needs a compound. A 2-bedroom flat or bigger has one.');
    var cost = price(s, P.price);
    s.alerts = [];
    if (!pay(s, cost, 'Pet: ' + P.name)) return fail('A ' + P.name.toLowerCase() + ' costs ' + naira(cost) + '.');
    s.pets.push(id);
    unlock(s, 'pet');
    return finish(s, ok(P.icon + ' Welcome home! Food and the vet come to ' + naira(price(s, P.weekly)) + ' a week.'));
  }
  function rehomePet(s, id) {
    var i = s.pets.indexOf(id);
    if (i < 0) return fail('You have no ' + (D.PETS[id] ? D.PETS[id].name.toLowerCase() : 'such pet') + '.');
    s.pets.splice(i, 1);
    applyFx(s, { fun: -10 });
    return ok('You found your ' + D.PETS[id].name.toLowerCase() + ' a new home.');
  }
  function weeklyPets(s) {
    if (s.pets && s.pets.length) s.pets = s.pets.filter(function (id) {
      var P = D.PETS[id];
      if (P.yard && !hasYard(s)) { log(s, 'No compound for your ' + P.name.toLowerCase() + ' here. A neighbour with a yard took them in.', 'bad'); return false; }
      if (pay(s, price(s, P.weekly), 'Pet care: ' + P.name)) return true;
      log(s, 'You could not feed your ' + P.name.toLowerCase() + '. A neighbour took them in.', 'bad');
      return false;
    });
    if (s.hmo) {
      var H = D.HMO[s.hmo];
      if (!pay(s, price(s, H.weekly), 'HMO premium')) { log(s, 'Your ' + H.name + ' lapsed: the premium bounced.', 'bad'); s.hmo = null; }
    }
  }
  function joinHmo(s, plan) {
    var H = D.HMO[plan];
    if (!H) return fail('No such plan.');
    if (s.hmo === plan) return fail('You are already on ' + H.name + '.');
    var fee = price(s, H.weekly);
    s.alerts = [];
    if (!pay(s, fee, 'HMO premium')) return fail('The first premium is ' + naira(fee) + '.');
    s.hmo = plan;
    return ok(H.icon + ' You are on ' + H.name + ': ' + naira(fee) + ' a week.');
  }
  function leaveHmo(s) {
    if (!s.hmo) return fail('You have no HMO plan.');
    s.hmo = null;
    return ok('You cancelled your HMO plan.');
  }

  /* ---------- hosting a party at home ---------- */
  var PARTY_GAP = 28;
  function partyBlock(s, kind) {
    var P = D.PARTIES[kind];
    if (!P) return 'No such party.';
    if (s.pending.length) return 'Decide on the open event first';
    if (homeDistrict(s) !== s.loc) return 'Parties are at home. Go home first';
    if (P.types && P.types.indexOf(homeDef(s).type) < 0) return 'Your home is too small for ' + P.guests + ' guests';
    if (dow(s) !== 5) return 'Owambes are on Saturdays';
    var h = hour(s); if (h < 11 || h >= 18) return 'Guests come from 11:00; start by 18:00';
    if (s.partyDay != null && day(s) - s.partyDay < PARTY_GAP) return 'You hosted on day ' + (s.partyDay + 1) + '. Wait ' + (PARTY_GAP - (day(s) - s.partyDay)) + ' more days';
    return null;
  }
  function hostParty(s, kind, planner) {
    var P = D.PARTIES[kind], why = partyBlock(s, kind);
    if (why) return fail(why + '.');
    planner = !!planner;
    var cost = price(s, P.cost * (planner ? 1 + D.PLANNER_FACTOR : 1));
    s.alerts = [];
    if (!pay(s, cost, 'Party: ' + P.name + (planner ? ' with a decorator' : ''))) return fail('This party costs ' + naira(cost) + '.');
    advance(s, P.mins);
    applyFx(s, P.fx); applyFx(s, { hunger: 40, energy: -25 });
    // Guests spray more for a well-dressed, well-connected host.
    var charm = 1 + skillLevel(s, 'charisma') * 0.1 + Math.min(1.5, statusPoints(s) / 40) + (outfitTags(s).owambe ? 0.3 : 0);
    var spray = Math.round(price(s, P.guests * 400 * charm * (planner ? 1.25 : 1) * (0.7 + rand(s) * 0.6)) / 50) * 50;
    if (planner) applyFx(s, { social: 10, fun: 10 });
    if (spray > 0) earn(s, spray, 'Party: guests sprayed');
    Object.keys(s.friends).forEach(function (k) { if (s.friends[k].seen >= 0) s.friends[k].lvl = clamp(s.friends[k].lvl + (kind === 'small' ? 4 : 8), 0, 100); });
    s.partyDay = day(s);
    s.lastParty = { kind: kind, planner: planner, t: s.t };
    unlock(s, 'host');
    log(s, 'You hosted ' + P.guests + ' guests: ' + P.name.toLowerCase() + '. They sprayed ' + naira(spray) + '.', 'good');
    return finish(s, ok(P.icon + ' What a party! Guests sprayed ' + naira(spray) + ' (it cost ' + naira(cost) + ').'));
  }

  // A guest at another player's party (keyed by host and party time). Mood only;
  // each act once per party, and at most 6 a game day.
  function joinParty(s, key, act) {
    var A = D.PARTY_ACTS[act];
    if (!A) return fail('Nothing like that here.');
    if (typeof key !== 'string' || key.length > 80) return fail('No such party.');
    if (s.pending.length) return fail('Decide on the open event first.');
    if (!s.partyJoins) s.partyJoins = {};
    var k = key + ':' + act, today = day(s);
    if (Object.prototype.hasOwnProperty.call(s.partyJoins, k)) return fail('You already did that at this party.');
    if (Object.keys(s.partyJoins).filter(function (x) { return s.partyJoins[x] === today; }).length >= 6) return fail('You have partied enough today.');
    s.alerts = [];
    advance(s, 30);
    applyFx(s, A.fx);
    s.partyJoins[k] = today;
    return finish(s, ok(A.icon + ' ' + (act === 'dance' ? 'You danced till your legs shook.' : 'You met three new people and swapped numbers.')));
  }

  /* ---------- Danfo Run: a shift paid from the mini-game's result ---------- */
  var DANFO_CAP = 12000, DANFO_RETURNS = 4000, DANFO_FUEL = 2000;
  function danfoShift(s, fares, fines, served) {
    var m = miniClaim(s, 'danfo'), a;
    if (m && m.fail) return m.fail;
    if (!m) {
      a = miniAction(s, 'danfo');
      if (!a) return fail(MINI_WHERE.danfo);
      if (a.disabled) return fail(a.disabled);
    }
    fares = Math.floor(fares); fines = Math.floor(fines); served = Math.floor(served);
    if (!(fares >= 0 && fines >= 0 && served >= 0 && served <= 120)) return fail('That run does not add up.');
    // A run's takings are capped: no 90 seconds of driving pays more than a real day.
    fares = Math.min(fares, price(s, DANFO_CAP), served * price(s, 400));
    fines = Math.min(fines, price(s, 30000));
    s.alerts = [];
    if (m) s.mini = null;
    else { advance(s, a.mins); applyFx(s, a.fx); addXp(s, a.xp); }
    var got = gigPay(s, fares, 1);
    if (got) earn(s, got, 'Danfo fares');
    var mine = m ? m.cost.mine : ownsDanfo(s), owner = m ? m.cost.owner : mine ? 0 : price(s, DANFO_RETURNS), fuel = m ? m.cost.fuel : price(s, DANFO_FUEL * s.econ.fuel);
    if (!m) {
      if (owner) pay(s, owner, 'Danfo owner returns') || addDebt(s, owner, 'Danfo owner returns');
      pay(s, fuel, 'Danfo fuel') || addDebt(s, fuel, 'Danfo fuel');
    }
    if (fines) payPartial(s, fines, 'Danfo fines and settlements');
    s.stats.danfoPax = (s.stats.danfoPax || 0) + served;
    if (got > (s.stats.danfoBest || 0)) s.stats.danfoBest = got;
    if (s.stats.danfoPax >= 50) unlock(s, 'danfo');
    var net = got - owner - fuel - fines;
    return finish(s, ok('🚐 ' + served + ' passengers. Fares ' + naira(got) + (mine ? ' (your own bus: no returns)' : ', owner ' + naira(owner)) + ', fuel ' + naira(fuel) + (fines ? ', fines ' + naira(fines) : '') + '. You ' + (net >= 0 ? 'made ' + naira(net) : 'lost ' + naira(-net)) + '.'));
  }

  // Your own danfo: no owner's returns on your runs, or put a driver on it for weekly returns.
  function ownsDanfo(s) { return (s.vehicles || []).some(function (v) { return v.id === 'danfo_bus'; }); }
  function setDanfoDriver(s, on) {
    if (!ownsDanfo(s)) return fail('Buy a danfo first (dealers, Commercial).');
    s.danfoDriver = !!on;
    return ok(on ? 'A driver takes your danfo out from Monday. Returns land every week.' : 'You took your danfo off the road.');
  }
  function weeklyDanfo(s) {
    if (!s.danfoDriver) return;
    if (!ownsDanfo(s)) { s.danfoDriver = false; return; }
    var r = rand(s);
    if (r < 0.05) { log(s, '🚐 Your driver "travelled to the village" with this week\'s returns.', 'bad'); return; }
    if (r < 0.13) { var fix = price(s, 80000); pay(s, fix, 'Danfo repairs after a crash') || addDebt(s, fix, 'Danfo repairs'); log(s, '🚐 Your driver crashed the danfo. Repairs: ' + naira(fix) + '.', 'bad'); return; }
    var got = gigPay(s, 30000, 0.6 + rand(s) * 0.8);
    earn(s, got, 'Danfo returns from your driver');
    log(s, '🚐 Your danfo driver brought ' + naira(got) + ' for the week.', 'good');
  }

  /* ---------- Sea Plots ---------- */
  // One block per life. Buying a new block replaces the old one; you pay only
  // for plots beyond the ones you already had. Other players' claims are
  // checked against the shared store by the page before this is called.
  function seaCost(s, w, h) {
    var had = s.sea ? s.sea.w * s.sea.h : 0;
    return price(s, D.SEA.price) * Math.max(0, w * h - had);
  }
  function buySeaPlots(s, x, y, w, h) {
    var S = D.SEA, ok2 = function (v) { return Math.round(v) === v && v >= 0; };
    if (!ok2(x) || !ok2(y) || !ok2(w) || !ok2(h) || w < 1 || h < 1) return fail('Pick a block of plots.');
    if (w > S.maxSide || h > S.maxSide) return fail('A block is at most ' + S.maxSide + ' plots on a side.');
    if (x + w > S.cols || y + h > S.rows) return fail('That block runs off the grid.');
    if (s.pending.length) return fail('Decide on the open event first.');
    if (s.challenge) return fail('No Sea Plots in Weekly Lagos.');
    var cost = seaCost(s, w, h);
    s.alerts = [];
    if (cost && !pay(s, cost, 'Sea Plots: ' + w + '×' + h + ' block')) return fail('That block costs ' + naira(cost) + '.');
    s.sea = { x: x, y: y, w: w, h: h };
    unlock(s, 'seaplot');
    return finish(s, ok('🌊 You own a ' + w + '×' + h + ' block of Sea Plots' + (cost ? ' for ' + naira(cost) : '') + '. Add a picture for all Lagos to see.'));
  }
  function releaseSeaPlots(s) {
    if (!s.sea) return fail('You own no Sea Plots.');
    s.sea = null;
    return ok('You let your Sea Plots go. No refunds on the water.');
  }

  /* ---------- japa: the international flight that ends a life ---------- */
  var JAPA_FUNDS = 15000000, JAPA_VISA = 1200000;
  function japaBlock(s, dest) {
    var J = D.JAPA_DESTS[dest];
    if (!J) return 'No such destination';
    if (s.challenge) return 'No japa in Weekly Lagos';
    if (s.loc !== 'ikeja') return 'International flights leave from Murtala Muhammed Airport, Ikeja';
    if (!s.edu.ieltsPassed) return 'Pass IELTS first (Ikeja test centre)';
    var need = price(s, JAPA_FUNDS) + price(s, J.ticket) + price(s, JAPA_VISA);
    if (s.cash + s.bank < need) return 'You need ' + naira(need) + ': ₦15m proof of funds plus the visa and ticket';
    if (debts(s) > 0) return 'Clear your debts first. The embassy checks';
    return null;
  }
  function japaFly(s, dest) {
    var why = japaBlock(s, dest); if (why) return fail(why + '.');
    if (s.pending.length) return fail('Decide on the open event first.');
    var J = D.JAPA_DESTS[dest];
    s.alerts = [];
    pay(s, price(s, JAPA_VISA), 'Japa: visa fees');
    pay(s, price(s, J.ticket), 'Japa: one-way ticket to ' + J.name);
    advance(s, 120);
    s.japa = { dest: dest, t: s.t };
    unlock(s, 'japa');
    if (!s.won && s.goal === 'japa') s.won = { goal: 'japa', t: s.t };
    log(s, '✈️ You boarded the flight to ' + J.name + '. Lagos, we go see again.', 'ach');
    return ok(J.icon + ' Wheels up! Next stop: ' + J.name + '.', { japa: true });
  }

  /* ---------- haggling at Balogun ---------- */
  // The trader opens at 130% and has a secret last price between 75% and 95%
  // (a little lower for a good haggler), fixed for the day. Three offers per item a day.
  function haggleAsk(s, id) { return roundTo(price(s, D.CLOTHES[id].price) * 1.3, 50); }
  function haggleFloor(s, id) {
    var u = parseInt(fnv(s.seed + ':hag:' + day(s) + ':' + id), 16) / 4294967296;
    var f = 0.75 + u * 0.2 - Math.min(0.05, skillLevel(s, 'hustle') * 0.01);
    return roundTo(price(s, D.CLOTHES[id].price) * Math.max(0.7, f), 50);
  }
  function haggleOpen(s) {
    if (s.loc !== 'island') return 'Haggling is at Balogun market, Lagos Island';
    var h = hour(s); if (dow(s) > 5 || h < 8 || h >= 18) return 'Balogun traders are open 08:00 to 18:00, Monday to Saturday';
    return null;
  }
  function haggleBuy(s, id, offer) {
    var c = D.CLOTHES[id];
    if (!c || c.gift) return fail('No such item.');
    var shut = haggleOpen(s); if (shut) return fail(shut + '.');
    if (s.pending.length) return fail('Decide on the open event first.');
    if (s.wardrobe.some(function (w) { return w.id === id; })) return fail('You already own this.');
    if (!s.haggles) s.haggles = {};
    var key = day(s) + ':' + id, tries = s.haggles[key] || 0;
    if (tries >= 3) return fail('"Oya, go and come back tomorrow. I no fit sell at that price."');
    offer = Math.floor(offer);
    var ask = haggleAsk(s, id), floor = haggleFloor(s, id);
    if (!(offer > 0) || offer > ask) return fail('Make an offer between ' + naira(1) + ' and ' + naira(ask) + '.');
    s.haggles[key] = tries + 1;
    advance(s, 10);
    if (offer < floor) {
      var counter = roundTo(Math.max(floor, (offer + ask) / 2 - (tries * (ask - floor) / 4)), 50);
      return Object.assign(fail(tries + 1 >= 3 ? '"Abeg, I no fit. Last price was ' + naira(counter) + '. Come back tomorrow."' : '"Customer, add small! ' + naira(counter) + ' last price."'), { counter: counter, tries: tries + 1 });
    }
    s.alerts = [];
    if (!pay(s, offer, 'Bought ' + c.name + ' (haggled)')) return fail('You do not have ' + naira(offer) + '.');
    s.wardrobe.push({ id: id });
    wear(s, id);
    addXp(s, { hustle: 1 });
    var saved = price(s, c.price) - offer;
    return finish(s, ok('"Oya, bring am!" You got the ' + c.name + ' for ' + naira(offer) + (saved > 0 ? ', ' + naira(saved) + ' under the shop price.' : '.')));
  }

  /* ---------- mini-games: from rules 10 a game is paid for when it starts ---------- */
  // startMinigame spends the entry or stock, the time and the effort up front,
  // so quitting a bad run forfeits them and every attempt is a new run. The
  // collect call (danfoShift, danceOff, ...) then only pays out. Lives on rules
  // 9 or earlier keep the old pay-on-collect flow, so their replays still match.
  var MINI_RULES = 10;
  var MINI_WHERE = {
    danfo: 'Rent a danfo at the Ojuelegba park.',
    dance: 'Dance-offs are at the Surulere event hall on Saturdays.',
    hawk: 'Hawk in the Oshodi go-slow.',
    bole: 'The bole grill is in Old GRA, Port Harcourt.',
    quiz: 'The quiz show is at Millennium Park, Abuja, Friday to Sunday from 15:00.'
  };
  function miniAction(s, kind) { return availableActions(s).filter(function (x) { return x.minigame === kind; })[0]; }
  function miniStarts(s) { return s.rules >= MINI_RULES; }
  // Rules 10: the game must have been started; returns the started game, or { fail } if not.
  function miniClaim(s, kind) {
    if (!miniStarts(s)) return null;
    if (!s.mini || s.mini.kind !== kind) return { fail: fail('Start the game first.') };
    return s.mini;
  }
  function startMinigame(s, kind) {
    if (!MINI_WHERE[kind]) return fail('No such game.');
    if (!miniStarts(s)) return fail('This life plays by older rules: play the game and collect at the end.');
    var a = miniAction(s, kind);
    if (!a) return fail(MINI_WHERE[kind]);
    if (a.disabled) return fail(a.disabled);
    var cost = {};
    s.alerts = [];
    if (kind === 'dance') {
      cost.entry = a.price;
      if (!pay(s, a.price, a.label)) return fail('The entry is ' + naira(a.price) + '.');
    } else if (kind === 'hawk') {
      cost.stock = price(s, HAWK_STOCK);
      if (!pay(s, cost.stock, 'Hawking stock')) return fail('Stock for the tray costs ' + naira(cost.stock) + '.');
    } else if (kind === 'danfo') {
      cost.mine = ownsDanfo(s); cost.owner = cost.mine ? 0 : price(s, DANFO_RETURNS); cost.fuel = price(s, DANFO_FUEL * s.econ.fuel);
      if (cost.owner) pay(s, cost.owner, 'Danfo owner returns') || addDebt(s, cost.owner, 'Danfo owner returns');
      pay(s, cost.fuel, 'Danfo fuel') || addDebt(s, cost.fuel, 'Danfo fuel');
    }
    advance(s, a.mins); applyFx(s, a.fx); addXp(s, a.xp);
    if (kind === 'quiz') s.quizDay = day(s);
    s.mini = { kind: kind, t: s.t, cost: cost };
    var spent = (cost.entry || 0) + (cost.stock || 0) + (cost.owner || 0) + (cost.fuel || 0);
    return finish(s, ok('▶ ' + a.label.replace(/ \(mini-game\)$/, '') + (spent ? ': ' + naira(spent) + ' paid up front' : '') + '. Quitting forfeits the run.'));
  }

  /* ---------- owambe dance-off: guests spray a capped sum ---------- */
  var DANCE_CAP = 4000;
  function danceOff(s, hits, total, best) {
    var m = miniClaim(s, 'dance'), a;
    if (m && m.fail) return m.fail;
    if (!m) {
      a = miniAction(s, 'dance');
      if (!a) return fail(MINI_WHERE.dance);
      if (a.disabled) return fail(a.disabled);
    }
    hits = Math.floor(hits); total = Math.floor(total); best = Math.floor(best);
    if (!(total > 0 && total <= 200 && hits >= 0 && hits <= total && best >= 0 && best <= hits)) return fail('That dance does not add up.');
    s.alerts = [];
    if (m) s.mini = null;
    else {
      if (!pay(s, a.price, a.label)) return fail('The entry is ' + naira(a.price) + '.');
      advance(s, a.mins); applyFx(s, a.fx); addXp(s, a.xp);
    }
    var acc = hits / total, spray = acc < 0.4 ? 0 : Math.min(price(s, DANCE_CAP), gigPay(s, 5000 * Math.pow(acc, 2) + best * 25, 1));
    if (outfitTags(s).owambe) spray = Math.min(price(s, DANCE_CAP), roundTo(spray * 1.2, 50));
    if (spray > 0) earn(s, spray, 'Dance-off: guests sprayed');
    if (acc >= 0.9) unlock(s, 'dancer');
    if (Math.round(acc * 100) > (s.stats.danceBest || 0)) s.stats.danceBest = Math.round(acc * 100);
    return finish(s, ok('💃 ' + Math.round(acc * 100) + '% on the beat, best streak ' + best + '. ' + (spray ? 'The guests sprayed you ' + naira(spray) + '!' : 'Nobody sprayed. Practise and come back.') + dressBonus(s, 'owambe')));
  }

  /* ---------- go-slow hawker: a capped shift from the mini-game ---------- */
  var HAWK_STOCK = 4000, HAWK_CAP = 10000;
  function hawkShift(s, sales, served, wrong, seized) {
    var m = miniClaim(s, 'hawk'), a;
    if (m && m.fail) return m.fail;
    if (!m) {
      a = miniAction(s, 'hawk');
      if (!a) return fail(MINI_WHERE.hawk);
      if (a.disabled) return fail(a.disabled);
    }
    sales = Math.floor(sales); served = Math.floor(served); wrong = Math.floor(wrong); seized = Math.floor(seized);
    if (!(sales >= 0 && served >= 0 && served <= 30 && wrong >= 0 && seized >= 0 && seized <= 30 && served + seized <= 30)) return fail('That shift does not add up.');
    var stock = m ? m.cost.stock : price(s, HAWK_STOCK);
    s.alerts = [];
    if (m) s.mini = null;
    else {
      if (!pay(s, stock, 'Hawking stock')) return fail('Stock for the tray costs ' + naira(stock) + '.');
      advance(s, a.mins); applyFx(s, a.fx); addXp(s, a.xp);
    }
    var got = Math.min(price(s, HAWK_CAP), served * price(s, 500), gigPay(s, sales, 1));
    if (got) earn(s, got, 'Hawking sales');
    s.stats.hawkBest = Math.max(s.stats.hawkBest || 0, got);
    return finish(s, ok('🛒 ' + served + ' sales: ' + naira(got) + (seized ? ', ' + seized + ' items seized' : '') + '. Stock cost ' + naira(stock) + ', so you ' + (got - stock >= 0 ? 'made ' + naira(got - stock) : 'lost ' + naira(stock - got)) + '.'));
  }

  /* ---------- bole grill (Port Harcourt): a capped shift from the mini-game ---------- */
  var BOLE_CUT = 0.5, BOLE_CAP = 9000;
  function boleShift(s, sales, served, burnt) {
    var m = miniClaim(s, 'bole'), a;
    if (m && m.fail) return m.fail;
    if (!m) {
      a = miniAction(s, 'bole');
      if (!a) return fail(MINI_WHERE.bole);
      if (a.disabled) return fail(a.disabled);
    }
    sales = Math.floor(sales); served = Math.floor(served); burnt = Math.floor(burnt);
    if (!(sales >= 0 && served >= 0 && served <= 60 && burnt >= 0 && burnt <= 60 && sales <= served * 900)) return fail('That shift does not add up.');
    s.alerts = [];
    if (m) s.mini = null;
    else { advance(s, a.mins); applyFx(s, a.fx); addXp(s, a.xp); }
    // Mama keeps half of the takings and charges for what you burnt.
    var share = Math.min(price(s, BOLE_CAP), gigPay(s, sales * BOLE_CUT, 1)), burn = price(s, 150) * burnt;
    if (share) earn(s, share, 'Bole grill share');
    if (burn) payPartial(s, Math.min(burn, share || burn), 'Burnt bole (deducted)');
    s.stats.boleBest = Math.max(s.stats.boleBest || 0, share - burn);
    return finish(s, ok('🍌 ' + served + ' plates served. Your half: ' + naira(share) + (burnt ? ', minus ' + naira(burn) + ' for ' + burnt + ' burnt' : '') + '.'));
  }

  /* ---------- Naija Quiz (Abuja): a capped prize, once a game day ---------- */
  function quizShow(s, correct, total) {
    var m = miniClaim(s, 'quiz'), a;
    if (m && m.fail) return m.fail;
    if (!m) {
      if (s.quizDay === day(s)) return fail('You already played today. Come back tomorrow.');
      a = miniAction(s, 'quiz');
      if (!a) return fail(MINI_WHERE.quiz);
      if (a.disabled) return fail(a.disabled);
    }
    correct = Math.floor(correct); total = Math.floor(total);
    if (!(total === 10 && correct >= 0 && correct <= total)) return fail('That score does not add up.');
    s.alerts = [];
    if (m) s.mini = null;
    else { advance(s, a.mins); applyFx(s, a.fx); addXp(s, a.xp); s.quizDay = day(s); }
    var prize = correct >= 5 ? price(s, [0, 0, 0, 0, 0, 1000, 1500, 2500, 4000, 6000, 8000][correct]) : 0;
    if (prize) earn(s, prize, 'Quiz show prize');
    s.stats.quizBest = Math.max(s.stats.quizBest || 0, correct);
    if (correct === 10) unlock(s, 'quiz');
    return finish(s, ok('🎤 ' + correct + '/10. ' + (prize ? 'You won ' + naira(prize) + '!' : 'No prize under 5. The crowd still clapped.')));
  }


  /* ---------- NYSC: the service year after a degree ---------- */
  // Register (call-up letter), three camp days at Kubwa, then 12 weeks of service:
  // days at your PPA pay its small stipend, CDS is on Thursdays, and the federal
  // allowance comes every 4 weeks if 3 of those 4 CDS days were attended.
  // The posting comes from the seed (no rng draw), so other randomness is untouched.
  function nyscPosting(s) { return D.NYSC_PPAS[parseInt(fnv(s.seed + ':nysc'), 16) % D.NYSC_PPAS.length]; }
  function nyscPPA(s) { return s.nysc ? D.NYSC_PPAS.filter(function (p) { return p.id === s.nysc.ppa; })[0] : null; }
  function busyBlock(s) { return s.over ? 'This Weekly Lagos is over' : s.pending.length ? 'Decide on the open event first' : null; }
  function nyscRegister(s) {
    if (s.nysc) return fail('You have already registered for NYSC.');
    if (!s.edu.degree) return fail('NYSC is for graduates. Finish your degree at UNILAG first.');
    var b = busyBlock(s); if (b) return fail(b + '.');
    var fee = price(s, D.NYSC.callup);
    s.alerts = [];
    if (!pay(s, fee, 'NYSC call-up letter and registration')) return fail('Registration costs ' + naira(fee) + '.');
    var ppa = nyscPosting(s);
    s.nysc = { stage: 'callup', ppa: ppa.id, campDays: 0, start: -1, cds: {}, ppaDay: -1, paid: 0, withheld: 0 };
    log(s, '🎖️ Call-up letter: report to the orientation camp at Kubwa, Abuja. Your PPA: ' + ppa.name + '.', 'info');
    return finish(s, ok('Registered! Report to camp in Kubwa, Abuja. You are posted to ' + ppa.name + ' (' + D.DISTRICTS[ppa.district].name + ').'));
  }
  function nyscCampBlock(s) {
    var n = s.nysc;
    if (!n) return 'Register for NYSC first';
    if (n.stage !== 'callup' && n.stage !== 'camp') return 'Camp is over';
    if (s.loc !== 'abj_kubwa') return 'The camp is in Kubwa, Abuja';
    var h = hour(s); if (h < 5 || h >= 20) return 'The camp gate is open from 05:00 to 20:00';
    if (s.needs.energy < 35) return 'Too tired for drills';
    return busyBlock(s);
  }
  var CAMP_DAYS = [
    'Drills on the parade ground, then lectures on the history of NYSC. Man O\'War made everyone crawl in the mud.',
    'Skills acquisition (SAED) in the morning, Mammy market suya in the evening. Your platoon is practising for the parade.',
    'Passing-out parade and swearing-in. Your platoon came second in the drill competition.'
  ];
  function nyscCamp(s) {
    var why = nyscCampBlock(s); if (why) return fail(why + '.');
    var n = s.nysc;
    s.alerts = [];
    var msg = CAMP_DAYS[n.campDays] || CAMP_DAYS[2];
    n.stage = 'camp'; n.campDays++; n.campDay = day(s);
    // The day's drills and lectures, camp food, then the night in the camp hostel till the 05:00 bugle.
    // A late arrival still does registration and kit (at least 2 hours).
    advance(s, Math.max(120, 21 * 60 - minuteOfDay(s)));
    applyFx(s, { energy: -30, hunger: 45, social: 20, fun: 10, hygiene: -10 });
    addXp(s, { fitness: 2, charisma: 1 });
    if (!s.over) advance(s, (29 * 60 - minuteOfDay(s)) % (24 * 60), { sleep: 0.85 });
    if (n.campDays >= D.NYSC.campDays) {
      n.stage = 'service'; n.start = week(s);
      if (!s.wardrobe.some(function (w) { return w.id === 'nysc_khaki'; })) s.wardrobe.push({ id: 'nysc_khaki' });
      var ppa = nyscPPA(s);
      log(s, '🎖️ Sworn in as a corps member. Report to ' + ppa.name + ' and attend CDS every Thursday.', 'good');
      return finish(s, ok('🎖️ ' + msg + ' You are now a corper! The khaki is in your wardrobe. Report to ' + ppa.name + ', ' + D.DISTRICTS[ppa.district].name + '.'));
    }
    return finish(s, ok('🎖️ Camp day ' + n.campDays + ' of ' + D.NYSC.campDays + ': ' + msg));
  }
  function nyscWorkBlock(s) {
    var n = s.nysc, ppa = nyscPPA(s);
    if (!n || n.stage !== 'service') return 'Only corps members in service go to a PPA';
    if (s.loc !== ppa.district) return 'Your PPA is in ' + D.DISTRICTS[ppa.district].name;
    if (dow(s) > 4) return 'Your PPA is open Monday to Friday';
    var h = hour(s); if (h < 8 || h >= 10) return 'Report to your PPA between 08:00 and 09:59';
    if (n.ppaDay === day(s)) return 'You already worked at your PPA today';
    if (s.needs.energy < 25) return 'Too tired for work';
    return busyBlock(s);
  }
  function nyscWork(s) {
    var why = nyscWorkBlock(s); if (why) return fail(why + '.');
    var n = s.nysc, ppa = nyscPPA(s);
    s.alerts = [];
    n.ppaDay = day(s); n.days = (n.days || 0) + 1;
    advance(s, 6 * 60);
    applyFx(s, { energy: -20, hunger: -15, stress: 6 });
    addXp(s, ppa.id === 'tech' ? { tech: 2 } : ppa.id === 'bank' ? { hustle: 1, charisma: 1 } : ppa.id === 'school' ? { charisma: 2 } : { hustle: 1 });
    var got = ppa.pay ? price(s, ppa.pay) : 0;
    if (got) earn(s, got, 'NYSC PPA stipend');
    return finish(s, ok(ppa.icon + ' A day at ' + ppa.name + '. ' + (got ? 'Stipend: ' + naira(got) + '.' : 'No stipend here, but the students said "Thank you, Corper!"')));
  }
  function nyscCdsBlock(s) {
    var n = s.nysc, ppa = nyscPPA(s);
    if (!n || n.stage !== 'service') return 'CDS is for corps members in service';
    if (cityOf(s) !== districtCity(ppa.district)) return 'CDS is in your posting city, ' + D.CITIES[districtCity(ppa.district)].name;
    if (dow(s) !== D.NYSC.cdsDay) return 'CDS is on Thursdays';
    var h = hour(s); if (h < 10 || h >= 14) return 'CDS meets from 10:00 to 14:00';
    if (n.cds[week(s)]) return 'You already signed the CDS register this week';
    return busyBlock(s);
  }
  function nyscCDS(s) {
    var why = nyscCdsBlock(s); if (why) return fail(why + '.');
    s.alerts = [];
    s.nysc.cds[week(s)] = 1;
    advance(s, 3 * 60);
    applyFx(s, { social: 15, energy: -8, stress: -4 });
    addXp(s, { charisma: 1 });
    return finish(s, ok('🤝 CDS done: your group cleaned the market and painted a clinic. The register is signed.'));
  }
  // Weekly: the allowance every 4 weeks of service, then passing out.
  function weeklyNysc(s) {
    var n = s.nysc; if (!n || n.stage !== 'service') return;
    var served = week(s) - n.start;
    if (served <= 0 || served % 4) return;
    var att = 0; for (var w = week(s) - 4; w < week(s); w++) if (n.cds[w]) att++;
    if (att >= 3) { earn(s, price(s, D.NYSC.allowance), 'NYSC allawee'); n.paid++; log(s, '🎖️ Allawee don land! Your NYSC allowance is in.', 'good'); }
    else { n.withheld++; log(s, '🎖️ Your clearance was not signed: you attended ' + att + ' of 4 CDS days. No allowance this month.', 'bad'); }
    if (served >= D.NYSC.weeks) {
      n.stage = 'done'; unlock(s, 'corper');
      var ppa = nyscPPA(s), cid = D.NYSC_RETAIN[ppa.id];
      if (cid && (n.days || 0) >= NYSC_RETAIN_DAYS) n.offer = { career: cid, until: day(s) + 14 };
      log(s, '🎖️ Passing out! You have your Certificate of National Service.' + (n.offer ? ' ' + ppa.name + ' wants to retain you as ' + D.CAREERS[cid].titles[0] + ': accept in Phone → NYSC within 14 days.' : ''), 'ach');
    }
  }
  var NYSC_RETAIN_DAYS = 20;
  function nyscRetainBlock(s) {
    var n = s.nysc;
    if (!n || n.stage !== 'done') return 'Finish your service year first';
    if (n.retained) return 'You took the job: ' + D.CAREERS[n.retained].titles[0] + ' (' + D.CAREERS[n.retained].name + ')';
    if (!n.offer) return D.NYSC_RETAIN[n.ppa] ? 'No offer: your PPA retains corpers who worked at least ' + NYSC_RETAIN_DAYS + ' days there' : 'Your PPA does not retain corpers';
    if (day(s) > n.offer.until) return 'The offer has expired';
    if (s.job && s.job.id === n.offer.career) return 'You already work there';
    return busyBlock(s);
  }
  function nyscRetain(s) {
    var why = nyscRetainBlock(s); if (why) return fail(why + '.');
    var cid = s.nysc.offer.career, ppa = nyscPPA(s);
    s.nysc.offer = null; s.nysc.retained = cid;
    log(s, '🎖️ Retained by ' + ppa.name + '!', 'good');
    return applyJob(s, cid, true);
  }
  function nyscInfo(s) {
    var n = s.nysc, ppa = n ? nyscPPA(s) : null;
    var out = { stage: n ? n.stage : s.edu.degree ? 'eligible' : 'locked', fee: price(s, D.NYSC.callup), allowance: price(s, D.NYSC.allowance), ppa: ppa };
    if (!n) return out;
    out.campDays = n.campDays; out.paid = n.paid; out.withheld = n.withheld;
    out.camp = nyscCampBlock(s); out.work = nyscWorkBlock(s); out.cdsWhy = nyscCdsBlock(s); out.days = n.days || 0;
    out.offer = n.offer ? { career: n.offer.career, title: D.CAREERS[n.offer.career].titles[0], name: D.CAREERS[n.offer.career].name, pay: D.CAREERS[n.offer.career].pay[0], until: n.offer.until } : null;
    out.retainWhy = nyscRetainBlock(s);
    if (n.stage === 'service') {
      var served = week(s) - n.start, blockStart = week(s) - (served % 4);
      out.weeksLeft = Math.max(0, D.NYSC.weeks - served);
      out.nextPayIn = 4 - (served % 4);
      out.cds = []; for (var w = blockStart; w < blockStart + 4; w++) out.cds.push(w < week(s) ? !!n.cds[w] : w === week(s) ? (n.cds[w] ? true : null) : null);
    }
    return out;
  }

  /* ---------- somewhere to sleep away from home ---------- */
  // December rates (rules 14): Lagos hotels and short-lets are booked out.
  function decRates(s) { return s.rules >= 14 && isDecember(s) && cityOf(s) === 'lagos'; }
  function lodgingOptions(s) {
    var home = homeDef(s).district === s.loc;
    return Object.keys(D.LODGING).filter(function (k) { return D.LODGING[k].where.indexOf(s.loc) >= 0; }).map(function (k) {
      var L = D.LODGING[k], o = { id: k, name: L.name, icon: L.icon, price: roundTo(price(s, L.price) * (decRates(s) ? 1.6 : 1), 500), sleep: L.sleep };
      if (home) o.disabled = 'You are at home: sleep there';
      else if (busyBlock(s)) o.disabled = busyBlock(s);
      else if (s.needs.energy > 85) o.disabled = 'You are not tired';
      else if (!canAfford(s, o.price)) o.disabled = 'A night costs ' + naira(o.price);
      return o;
    });
  }
  function sleepAway(s, id) {
    var o = lodgingOptions(s).filter(function (x) { return x.id === id; })[0];
    if (!o) return fail('There is no ' + (D.LODGING[id] ? D.LODGING[id].name.toLowerCase() : 'such place') + ' in ' + D.DISTRICTS[s.loc].name + '.');
    if (o.disabled) return fail(o.disabled + '.');
    var L = D.LODGING[id];
    s.alerts = [];
    pay(s, o.price, 'Lodging: ' + L.name);
    // Sleep till 06:30 the next morning (at least 6 hours; by day, 8 hours). Hotels run a generator; guest houses wait for NEPA.
    var mins = (24 * 60 + 6 * 60 + 30 - minuteOfDay(s)) % (24 * 60);
    if (mins < 6 * 60) mins = 6 * 60;
    else if (mins > 11 * 60) mins = 8 * 60; // a daytime rest, not a day lost to sleep
    var bite = malariaChance(s, L.gen ? 0.85 : 0);
    advance(s, mins, { sleep: L.sleep * (L.gen || s.power ? 1 : 0.85) });
    if (L.fx) applyFx(s, L.fx);
    if (bite) catchMalaria(s, bite);
    return finish(s, ok(L.icon + ' A night in a ' + L.name.toLowerCase() + ' in ' + D.DISTRICTS[s.loc].name + '. ' + (L.gen || s.power ? 'You slept well.' : 'NEPA took light and the generator was off by midnight.')));
  }

  /* ---------- malaria (rules 11) ---------- */
  // A night without light (no fan, no AC) and no net invites mosquitoes; the rainy
  // season is worse. Rolled once per night's sleep, only on rules 11, so older lives
  // draw no extra random numbers. protect: 0..1 from a net, a running fan or AC, or a hotel.
  function malariaOdds(s, protect) {
    if (!(s.rules >= 11) || s.sick) return 0;
    var p = s.power ? 0.004 : 0.014, wx = weatherOn(s, day(s)); // the day's weather: wet days mean wet nights
    if (wx === 'rain' || wx === 'storm' || (D.WEATHER_MONTHS[monthIndex(s)] || 0) > 0.4) p *= 1.5;
    return p * (1 - Math.min(0.95, protect || 0));
  }
  // Rolls the seeded RNG: only call it from inside a recorded action.
  function malariaChance(s, protect) { var p = malariaOdds(s, protect); return p && rand(s) < p ? 1 : 0; }
  function catchMalaria(s) {
    s.sick = { kind: 'malaria', since: day(s), drugs: false, cure: -1 };
    log(s, '🦟 Fever, chills and a headache: it is malaria. Buy drugs at a chemist (Do tab) before it gets worse.', 'bad');
  }
  function malariaHour(s) {
    var sk = s.sick, f = sk.drugs ? 0.5 : day(s) - sk.since >= 3 ? 2 : 1; // untreated, it gets worse
    s.needs.energy = clamp(s.needs.energy - 1.5 * f, 0, 100);
    s.needs.fun = clamp(s.needs.fun - 0.8 * f, 0, 100);
    s.needs.stress = clamp(s.needs.stress + 0.6 * f, 0, 100);
    if (sk.drugs && day(s) >= sk.cure && hour(s) === 7) { s.sick = null; log(s, '🦟 The fever has broken. You are well again.', 'good'); }
  }
  function treatBlock(s) {
    if (!s.sick) return 'You are not sick';
    if (s.sick.drugs) return 'You are already taking the drugs';
    var h = hour(s); if (h < 7 || h >= 21) return 'Chemists open 07:00 to 21:00';
    if (busyBlock(s)) return busyBlock(s);
    if (!canAfford(s, treatCost(s))) return 'Antimalarials cost ' + naira(treatCost(s));
    return null;
  }
  function treatCost(s) { return price(s, s.hmo ? 2000 : 4500); }
  function treatMalaria(s) {
    var why = treatBlock(s); if (why) return fail(why + '.');
    s.alerts = [];
    var cost = treatCost(s);
    pay(s, cost, 'Chemist: antimalarials');
    advance(s, 30);
    s.sick.drugs = true; s.sick.cure = day(s) + 2;
    applyFx(s, { stress: -5 });
    return finish(s, ok('💊 The chemist sold you a full course of antimalarials (' + naira(cost) + (s.hmo ? ', HMO price' : '') + '). Rest, and the fever should break in two days.'));
  }
  function sickInfo(s) { return s.sick ? { kind: s.sick.kind, days: day(s) - s.sick.since, drugs: s.sick.drugs, cost: treatCost(s), why: treatBlock(s), worse: !s.sick.drugs && day(s) - s.sick.since >= 3 } : null; }

  /* ---------- daily streak: come back on real consecutive days ---------- */
  var STREAK_PRIZES = [1000, 1500, 2000, 3000, 4000, 5000, 10000];
  function nextDayId(id) { var d = new Date(id + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
  function streakInfo(s, dayId) {
    var st = s.streak, claimed = !!(st && st.last === dayId);
    var n = claimed ? st.n : st && nextDayId(st.last) === dayId ? st.n + 1 : 1;
    return { n: n, claimed: claimed, prize: price(s, STREAK_PRIZES[(n - 1) % 7]), slot: (n - 1) % 7 };
  }
  function claimStreak(s, dayId) {
    if (!GEM_ID.test(dayId)) return fail('No streak for that day.');
    if (s.challenge) return fail('No daily streak in Weekly Lagos.');
    if (s.pending.length) return fail('Decide on the open event first.');
    var st = s.streak;
    if (st && st.last === dayId) return fail('You already collected today\'s streak.');
    if (st && dayId < st.last) return fail('That day has passed.');
    if (st && st.gday === day(s)) return fail('One streak reward per game day. Sleep first.');
    var info = streakInfo(s, dayId);
    s.alerts = [];
    s.streak = { last: dayId, n: info.n, gday: day(s) };
    earn(s, info.prize, 'Daily streak');
    if (info.n >= 7) unlock(s, 'streak7');
    return finish(s, ok('🔥 Day ' + info.n + ' streak: +' + naira(info.prize) + '.' + (info.slot === 6 ? ' Full week! The bonus resets tomorrow.' : '')));
  }

  /* ---------- Weekly Lagos challenge ---------- */

  var CHALLENGE_ID = /^\d{4}-W\d{2}$/;
  var CHALLENGE_WEEKS = 4;

  // ISO-8601 week id for a real-world date, e.g. "2026-W41".
  function challengeId(date) {
    var d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var wk = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return d.getUTCFullYear() + '-W' + String(wk).padStart(2, '0');
  }

  function challengeEntry(s) {
    var e = fameEntry(s);
    e.challenge = s.challenge ? s.challenge.id : null;
    e.over = !!s.over;
    return e;
  }

  // A weekly entry counts only if it is finished and replays to the same result.
  function verifyChallenge(raw, id) {
    if (!raw || raw.challenge !== id || !CHALLENGE_ID.test(id) || !raw.replay || raw.replay.challenge !== id) return { ok: false, reason: 'wrong week' };
    if (typeof raw.worth !== 'number' || typeof raw.seal !== 'string') return { ok: false, reason: 'malformed' };
    var s = replayLife(raw.replay);
    if (!s || !s.over) return { ok: false, reason: 'not finished' };
    var got = challengeEntry(s);
    var ok = got.seal === raw.seal && got.lines === raw.lines && got.worth === raw.worth;
    return { ok: ok, entry: ok ? got : null, reason: ok ? null : 'does not match its replay' };
  }

  // Wordle-style: one square per week by how net worth moved.
  function challengeSquares(s) {
    var prev = s.history.length ? null : null, out = '';
    var start = s.heir ? s.heir.inherit : D.ORIGINS[s.origin].cash;
    var last = start;
    s.history.forEach(function (h) {
      var ch = (h.worth - last) / Math.max(1, Math.abs(last));
      out += ch > 0.1 ? '🟩' : ch >= -0.02 ? '🟨' : '🟥';
      last = h.worth;
    });
    return out;
  }

  function challengeShareText(s) {
    var title = s.job ? D.CAREERS[s.job.id].titles[s.job.level] : 'job hunting';
    return 'Lasgidi Weekly ' + s.challenge.id + ' · ' + naira(netWorth(s)) + ' · ' + D.ORIGINS[s.origin].name + ', ' + title + '\n' + challengeSquares(s) + (s.over ? '' : ' (in progress)');
  }

  function shareText(s) {
    if (s.challenge) return challengeShareText(s);
    if (s.japa) return 'I japa-ed! ' + titledName(s) + ' left Lagos for ' + D.JAPA_DESTS[s.japa.dest].name + ' after ' + (week(s) + 1) + (week(s) ? ' weeks' : ' week') + ' in #Lasgidi, net worth ' + naira(netWorth(s)) + '. Lagos, we go see again.';
    var title = s.job ? D.CAREERS[s.job.id].titles[s.job.level] : 'job hunting';
    var got = Object.keys(s.ach).length, total = Object.keys(ACHIEVEMENTS).length;
    return 'Week ' + (week(s) + 1) + ' in #Lasgidi: ' + titledName(s) + ', ' + D.ORIGINS[s.origin].name + ', now ' + title + ' living in ' + D.DISTRICTS[homeDistrict(s)].name +
      '. Net worth ' + naira(netWorth(s)) + '. ' + got + '/' + total + ' achievements.' + (s.won ? ' ' + D.GOALS[s.won.goal].name + ' goal: done.' : '') + ' Lagos no dey carry last.';
  }

  function verifyLedger(s) {
    return s.cash === s.opening.cash + s.ledgerSum.cash && s.bank === s.opening.bank + s.ledgerSum.bank &&
      s.cash >= 0 && s.bank >= 0;
  }

  // Every call that changes a life goes through recorded(), so the life can be replayed.
  // A finished challenge is frozen: every recorded call becomes a no-op failure.
  function recorded(code, raw) {
    var fn = function (s) { return s.over ? fail('This Weekly Lagos is over. Start next week\'s, or go back to your life.') : s.japa ? fail('You have japa-ed. This life is complete: start a new one.') : raw.apply(null, arguments); };
    if (RECORDED[code]) throw new Error('Replay code used twice: ' + code);
    RECORDED[code] = { fn: fn };
    return function (s) {
      var args = Array.prototype.slice.call(arguments, 1);
      if (s.over || s.japa) return fn.apply(null, arguments); // frozen: refuse without recording
      if (s.replay && s.replay.acts.length < MAX_ACTS) s.replay.acts.push([code].concat(args));
      else if (s.replay) s.replay = null; // too long to verify; stop recording
      return fn.apply(null, arguments);
    };
  }

  var API = {
    VERSION: VERSION, LOANS: LOANS, AJO_SIZES: AJO_SIZES, ACHIEVEMENTS: ACHIEVEMENTS, NEEDS: NEEDS, DATA: D,
    newGame: newGame, availableActions: availableActions, doAction: recorded('a', doAction),
    travelOptions: travelOptions, travel: recorded('t', travel), distance: distance,
    resolveChoice: recorded('c', resolveChoice),
    jobEligibility: jobEligibility, applyJob: recorded('j', applyJob), quitJob: recorded('q', quitJob), promotionNeeds: promotionNeeds,
    deposit: recorded('d', deposit), withdraw: recorded('w', withdraw), joinAjo: recorded('aj', joinAjo), takeLoan: recorded('l', takeLoan), repayLoan: recorded('r', repayLoan), loanLimit: loanLimit,
    payArrears: recorded('pa', payArrears), moveHouse: recorded('m', moveHouse), moveInCost: moveInCost,
    buyBusiness: recorded('bb', buyBusiness), sellBusiness: recorded('sb', sellBusiness), visitBusinesses: recorded('vb', visitBusinesses),
    upgradeBusiness: recorded('ub', upgradeBusiness), hireManager: recorded('hm', hireManager), fireManager: recorded('fm', fireManager),
    businessName: businessName, upgradeCost: upgradeCost, managerPay: managerPay, businessEstimate: businessEstimate,
    buyProperty: recorded('bp', buyProperty), buyCar: recorded('bc', buyCar),
    netWorth: netWorth, debts: debts, goalProgress: goalProgress, skillLevel: skillLevel, performance: performance,
    price: price, okadaBanned: okadaBanned, homeDef: homeDef,
    serialize: serialize, deserialize: deserialize, verifyLedger: verifyLedger,
    clockLabel: clockLabel, dateLabel: dateLabel, day: day, dow: dow, hour: hour, week: week,
    monthIndex: monthIndex, isDecember: isDecember, naira: naira, fmtMins: fmtMins,
    buyItem: recorded('bi', buyItem), placeItem: recorded('pi', placeItem), storeItem: recorded('si', storeItem), sellItem: recorded('xi', sellItem),
    setLook: recorded('lk', setLook), buyClothes: recorded('bc2', buyClothes), wear: recorded('wr', wear), takeOff: recorded('to', takeOff), outfitTags: outfitTags,
    buyVehicle: recorded('bv', buyVehicle), sellVehicle: recorded('xv', sellVehicle), driveVehicle: recorded('dv', driveVehicle), vehicleUpkeep: vehicleUpkeep,
    payeTax: payeTax, savingsRate: savingsRate, billRate: billRate, loanRate: loanRate,
    buyBond: recorded('tb', buyBond), bondReturn: bondReturn, bondsHeld: bondsHeld, BOND_RATE: BOND_RATE, BOND_DAYS: BOND_DAYS, BANK_RATE: BANK_RATE,
    roomSize: roomSize, fitsAt: fitsAt, statusPoints: statusPoints, furnitureSleep: furnitureSleep, furniturePower: furniturePower, furnitureGen: furnitureGen, furnitureDaily: furnitureDaily, bestCar: bestCar,
    buyPlot: recorded('bpl', buyPlot), plotCount: plotCount, plotXY: plotXY, plotTakenByNpc: plotTakenByNpc, myPlot: myPlot, ownsHome: ownsHome,
    rentBoard: recorded('rb', rentBoard), boardRent: boardRent, boardQuote: boardQuote, adSlogans: adSlogans, sloganText: sloganText, checkAd: checkAd, checkPictureAd: checkPictureAd, PIC_MAX: PIC_MAX,
    marry: recorded('mw', marry), weddingOptions: weddingOptions, rentShare: rentShare, SCHOOLS: SCHOOLS, RULES: RULES,
    wait: recorded('z', wait), replayLife: replayLife, verifyFame: verifyFame,
    buyStock: recorded('sk', buyStock), sellStock: recorded('xs', sellStock), stockPrice: stockPrice, stockHistory: stockHistory, stocksValue: stocksValue, marketOpen: marketOpen, brokerFee: brokerFee,
    hireStaff: recorded('hs', hireStaff), fireStaff: recorded('fs', fireStaff), staffRoom: staffRoom, staffPay: staffPay,
    takeTitle: recorded('ct', takeTitle), nextTitle: nextTitle, titleDef: titleDef, titledName: titledName,
    buyPhone: recorded('ph', buyPhone), brandDeal: brandDeal, followerGain: followerGain, phoneCam: phoneCam,
    openShop: recorded('os', openShop), restockShop: recorded('or', restockShop), setShopAds: recorded('oa', setShopAds), closeShop: recorded('oc', closeShop), shopPreview: shopPreview,
    buyPet: recorded('pp', buyPet), rehomePet: recorded('pr', rehomePet), joinHmo: recorded('hj', joinHmo), leaveHmo: recorded('hl', leaveHmo), hasYard: hasYard,
    buySeaPlots: recorded('sp', buySeaPlots), releaseSeaPlots: recorded('sx', releaseSeaPlots), seaCost: seaCost,
    japaFly: recorded('jp', japaFly), japaBlock: japaBlock,
    haggleBuy: recorded('hg', haggleBuy), haggleAsk: haggleAsk, haggleOpen: haggleOpen,
    nyscRegister: recorded('ny', nyscRegister), nyscCamp: recorded('nc', nyscCamp), nyscWork: recorded('np', nyscWork), nyscCDS: recorded('nd', nyscCDS), nyscInfo: nyscInfo, nyscPosting: nyscPosting, nyscRetain: recorded('nr', nyscRetain), treatMalaria: recorded('ml', treatMalaria), sickInfo: sickInfo, malariaOdds: malariaOdds, helpHomework: recorded('kh', helpHomework), kidOuting: recorded('ko', kidOuting), kidsInfo: kidsInfo, kidName: kidName, shootSkit: recorded('kt', shootSkit), goLive: recorded('gl', goLive), creatorInfo: creatorInfo, trendingTheme: trendingTheme, lagosLabels: lagosLabels, kidLabel: kidLabel,
    buildStage: recorded('bh', buildStage), buildInfo: buildInfo, interviewJob: recorded('iv', interviewJob), interviewQuestions: interviewQuestions, interviewBlock: interviewBlock, needsInterview: needsInterview,
    decRates: decRates, luxuryCar: luxuryCar, lodgingOptions: lodgingOptions, railLine: railLine, heirOffer: heirOffer, heirOffers: heirOffers, serviceCars: recorded('sv', serviceCars), serviceBlock: serviceBlock, serviceCost: serviceCost, wearInfo: wearInfo, breakdownOdds: breakdownOdds, sleepAway: recorded('ht', sleepAway),
    startMinigame: recorded('mg', startMinigame), miniStarts: miniStarts, quizShow: recorded('qz', quizShow), boleShift: recorded('bg', boleShift), hawkShift: recorded('hk', hawkShift), danceOff: recorded('df', danceOff), danfoShift: recorded('dr', danfoShift), setDanfoDriver: recorded('dd', setDanfoDriver), ownsDanfo: ownsDanfo,
    joinParty: recorded('pj', joinParty),
    hostParty: recorded('hp', hostParty), partyBlock: partyBlock,
    claimStreak: recorded('ds', claimStreak), streakInfo: streakInfo,
    claimQuest: recorded('qc', claimQuest), questDone: questDone, activeQuests: activeQuests,
    sendGift: recorded('gf', sendGift), openGift: recorded('gx', openGift),
    weatherOn: weatherOn, weatherNow: weatherNow, weatherForecast: weatherForecast,
    districtCity: districtCity, cityOf: cityOf, monthIndex: monthIndex, inWindow: inWindow, intercityOptions: intercityOptions, intercity: recorded('ic', intercity), flightQuote: flightQuote, flyClass: recorded('fc', flyClass), clubMember: clubMember, clubQuote: clubQuote, joinClub: recorded('jc', joinClub), clubActOptions: clubActOptions, clubAct: recorded('ca', clubAct), hpInfo: hpInfo, hpBuild: recorded('hb', hpBuild), cruiseAboard: cruiseAboard, cruiseFare: cruiseFare, cruiseBlock: cruiseBlock, cruiseBoard: recorded('cb', cruiseBoard), cruiseSpot: recorded('cs', cruiseSpot), cruiseLeave: recorded('cl', cruiseLeave), wwQuote: wwQuote, planWhiteWedding: recorded('ww', planWhiteWedding), wwDayBlock: wwDayBlock, holdWhiteWedding: recorded('wh', holdWhiteWedding), jetQuote: jetQuote, flyJet: recorded('fj', flyJet), chopperQuote: chopperQuote, chopperTo: recorded('ch', chopperTo), ownsJet: ownsJet,
    gemDayId: gemDayId, gemsFor: gemsFor, gemsFound: gemsFound, nextGemPrize: nextGemPrize, collectGem: recorded('gm', collectGem), GEM_COUNT: GEM_COUNT,
    challengeId: challengeId, challengeEntry: challengeEntry, verifyChallenge: verifyChallenge, challengeShareText: challengeShareText, CHALLENGE_WEEKS: CHALLENGE_WEEKS,
    migrate: migrate, advise: advise, lifeSummary: lifeSummary, fameEntry: fameEntry, checkFame: checkFame, scoreOf: scoreOf, nextShiftStart: nextShiftStart, alarmMins: alarmMins, minutesUntilRent: minutesUntilRent, shareText: shareText, route: route,
    CATEGORY_NAMES: CATEGORY_NAMES, category: category, SCHEMA: SCHEMA,
    _advance: advance, _post: post
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Lasgidi = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
