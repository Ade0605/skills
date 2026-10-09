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
  var LEDGER_KEEP = 300;
  var LOG_KEEP = 80;
  var VERSION = 1;        // save-code format
  var SCHEMA = 4;         // state shape; migrate() upgrades older saves
  // Game RULES version. A life plays by the rules it started under, so a
  // recorded life replays identically after later updates add new systems.
  // 5 = v0.5 rules; 6 adds love and family.
  var RULES = 6;

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
    debt_free:   'Debt free: cleared every loan',
    top:         'Top of the ladder in a career',
    wedding:     'Wedding bells: got married',
    parent:      'Proud parent: welcomed a child',
    billboard:   'On the billboard: rented an ad board'
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
    health: 'Health', lifestyle: 'Fun and lifestyle', other: 'Other'
  };
  function category(memo, amt) {
    var m = memo.replace(/ \(incl\. gen fuel\)$/, '');
    if (/^Shift pay/.test(m)) return 'wages';
    if (GIG_LABELS[m] || /^(Brand deal|Hackathon prize)/.test(m)) return 'gigs';
    if (/^(Rent|Move-in)/.test(m)) return 'housing';
    if (FOOD_LABELS[m] || m === 'Aso-ebi') return 'food';
    if (/ to [A-Z]/.test(m) && /^(Trek|Keke|Okada|Danfo|BRT|Ferry|Cab|Own car)/.test(m) || /^Car maintenance/.test(m)) return 'transport';
    if (/snatched|Unauthorised|Taken by|CryptoDoubla|Owo ijoko|fine|settlement|Power levy/i.test(m)) return 'losses';
    if (/Business|^Bought|^Sold|Tenant rent/.test(m)) return 'business';
    if (/Ajo|loan|Repay|Overdue|Cooperative|interest|Microfinance|QuickCash/i.test(m)) return 'savings';
    if (/Allowance|Aunty/.test(m)) return 'family';
    if (/Hospital|Check-up/.test(m)) return 'health';
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
    return clamp(mood(s) / 100 * (1 - s.needs.stress / 250) + 0.25, 0.3, 1.15);
  }

  /* ---------- world state ---------- */

  function homeDef(s) { return D.HOMES[s.home]; }
  function homeDistrict(s) { return homeDef(s).district; }

  function rollPower(s) {
    var p = homeDef(s).power;
    if (s.econ.policy === 'power') p += 0.25;
    if (s.econ.gridDown > 0) p *= 0.3;
    s.power = rand(s) < clamp(p, 0, 0.98);
  }

  function okadaBanned(s, d) {
    if (s.econ.policy === 'okada') return ['mushin', 'oshodi', 'festac', 'ikorodu', 'ajah'].indexOf(d) < 0;
    return D.OKADA_BAN.indexOf(d) >= 0;
  }

  /* ---------- new game ---------- */

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
      rules: opts.rules || RULES, partner: null, kids: [], babyPause: -1,
      econ: { infl: 1, wage: 1, fuel: 1, fuelDays: 0, flood: 0, gridDown: 0, policy: null, policyWeeks: 0 },
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
    s.origin = originId;
    s.home = o.home;
    s.rentRate = D.HOMES[o.home].rent;
    s.loc = D.HOMES[o.home].district;
    // Opening balance is the one deposit that is not an in-game action.
    s.bank = o.cash; s.opening.bank = o.cash;
    if (o.allowance) { s.allowance = o.allowance; s.allowanceWeeks = o.allowanceWeeks; }
    if (originId === 'nepo') s.friends.kunle.lvl = 60; // Daddy's banker friend
    rollPower(s);
    s.stats.weekStartWorth = netWorth(s);
    // Everything needed to rebuild this life from scratch: the seed, the
    // starting choices, and every player call in order (see recorded()).
    if (opts.challenge) { s.challenge = { id: opts.challenge, weeks: CHALLENGE_WEEKS }; s.over = false; s.goal = 'freestyle'; }
    s.replay = { seed: seed, goal: s.goal, origin: opts.origin || null, rules: s.rules, challenge: opts.challenge || null, acts: [] };
    log(s, o.text, 'story');
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
    var low = 0;
    NEEDS.forEach(function (k) { if (s.needs[k] < 25) low++; });
    s.needs.stress = clamp(s.needs.stress + (low ? low * 2 : -0.5), 0, 100);
  }

  function onNewDay(s) {
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
    var inf = 0.004 + rand(s) * 0.008;
    s.econ.infl = Math.round(s.econ.infl * (1 + inf) * 10000) / 10000;
    s.econ.wage = Math.round(s.econ.wage * (1 + inf / 2) * 10000) / 10000;

    var interest = Math.floor(s.bank * BANK_RATE);
    if (interest > 0) post(s, 'bank', interest, 'Savings interest');

    if (s.allowanceWeeks > 0) {
      post(s, 'bank', s.allowance, 'Allowance from Daddy');
      if (--s.allowanceWeeks === 0) log(s, 'Daddy: "You are an adult now." The allowance has stopped.', 'story');
    }
    if (s.econ.policy === 'power') pay(s, price(s, 1000), 'Power levy') || addDebt(s, price(s, 1000), 'Power levy');
    if (s.car) pay(s, price(s, 5000), 'Car maintenance') || addDebt(s, price(s, 5000), 'Mechanic');

    weeklyAjo(s);
    weeklyLoans(s);
    weeklyProperty(s);
    if (s.rules >= 6) weeklyFamily(s);
    resolvePonzi(s);

    if (s.econ.policyWeeks > 0 && --s.econ.policyWeeks === 0) {
      log(s, 'The ' + D.POLICIES[s.econ.policy].name + ' has ended.', 'info');
      s.econ.policy = null;
    }
    if (w > 0 && w % 4 === 0) queueVote(s);

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

  function moveInCost(s, homeId) {
    var rent = price(s, D.HOMES[homeId].rent);
    var cost = rent * 4 + roundTo(rent * 4 * 0.1, 50);
    if (s.econ.policy === 'tenancy') cost = roundTo(cost / 2, 50);
    return { rent: rent, total: cost };
  }

  function moveHouse(s, homeId) {
    var h = D.HOMES[homeId];
    if (!h || h.hidden) return fail('That place is not on the market.');
    if (homeId === s.home) return fail('You already live here.');
    if (s.arrears) return fail('Clear your rent arrears first. No landlord will take you with debt.');
    var c = moveInCost(s, homeId);
    if (!pay(s, c.total, 'Move-in: 4 weeks rent + agent fee')) return fail('Move-in needs ' + naira(c.total) + ' (4 weeks upfront plus agent fee).');
    s.home = homeId; s.rentRate = c.rent; s.rentLate = 0;
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
    var h = hour(s);
    if (when.from != null && h < when.from) return false;
    if (when.to != null && h >= when.to) return false;
    return true;
  }
  function windowLabel(when) {
    if (!when) return '';
    var parts = [];
    if (when.days) parts.push(when.days.map(function (d) { return D.DAYS[d]; }).join('/'));
    if (when.from != null) parts.push(String(when.from).padStart(2, '0') + ':00–' + String(when.to).padStart(2, '0') + ':00');
    return parts.join(' ');
  }

  function genCost(s) { return price(s, 1500 * s.econ.fuel); }

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

  function shiftPay(s, late, perf) {
    var c = D.CAREERS[s.job.id];
    var v = c.pay[s.job.level] * s.econ.wage * (late ? 0.7 : 1) * perf;
    return roundTo(v, 50);
  }

  function availableActions(s) {
    var list = [];
    var shift = shiftAction(s);
    if (shift) list.push(shift);
    (D.PLACE_ACTIONS[s.loc] || []).forEach(function (a) { list.push(a); });
    list = list.concat(npcActions(s)).concat(loveActions(s));
    if (homeDistrict(s) === s.loc) D.HOME_ACTIONS.forEach(function (a) { list.push(Object.assign({ atHome: true }, a)); });
    return list.map(function (a) { return describe(s, a); });
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
    if (s.pending.length) return 'Decide on the open event first';
    if (!inWindow(s, a.when)) return 'Only ' + windowLabel(a.when);
    if (a.req) {
      for (var k in a.req) if (skillLevel(s, k) < a.req[k]) return 'Needs ' + D.SKILLS[k] + ' ' + a.req[k];
    }
    if (a.fx && a.fx.hunger > 0 && s.needs.hunger >= 90 && a.special !== 'owambe') return 'You are full';
    if (cost && !canAfford(s, cost)) return 'Costs ' + naira(cost);
    switch (a.special) {
      case 'cook': if (s.pantry <= 0) return 'No foodstuff at home'; break;
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
    return roundTo(base * f * spread, 50);
  }

  function ok(msg, extra) { return Object.assign({ ok: true, msg: msg }, extra || {}); }
  function fail(msg) { return { ok: false, msg: msg }; }

  function doAction(s, id) {
    s.alerts = [];
    var a = availableActions(s).filter(function (x) { return x.id === id; })[0];
    if (!a) return fail('You cannot do that here.');
    if (a.disabled) return fail(a.disabled);
    if (a.special === 'shift') return workShift(s, a);
    if (a.alarm) a.label = 'Sleep';
    if (a.price && !pay(s, a.price, a.label + (a.gen ? ' (incl. gen fuel)' : ''))) return fail('Not enough money.');

    var msg = a.label + '.';
    if (a.special === 'sleep' || a.special === 'nap') {
      var q = homeDef(s).sleep * (s.power ? 1 : 0.8);
      advance(s, a.mins, { sleep: q });
      msg = s.power ? 'You slept well.' : 'NEPA took light. Heat and mosquitoes, you slept badly.';
    } else {
      advance(s, a.mins);
      applyFx(s, a.fx);
    }
    addXp(s, a.xp);

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
        return 'Your aso-ebi was the talk of the party. You bonded with ' + D.NPCS[k].name + '.';
      }
      return 'Jollof, small chops and plenty spraying.';
    },
    club: function (s) {
      if (rand(s) < 0.06) {
        var lost = Math.min(s.cash, price(s, 20000));
        if (lost) post(s, 'cash', -lost, 'Phone and wallet snatched');
        return 'Someone snatched your wallet outside the club.';
      }
      return 'Great night.';
    },
    content: function (s) {
      var chance = 0.03 + skillLevel(s, 'charisma') * 0.01;
      if (week(s) !== s.viralWeek && rand(s) < chance) {
        s.viralWeek = week(s);
        var pay2 = price(s, roundTo(15000 + rand(s) * 35000, 1000)) * (1 + Math.floor(skillLevel(s, 'charisma') / 3));
        earn(s, pay2, 'Brand deal from viral post');
        applyFx(s, { social: 20, fun: 10 });
        unlock(s, 'viral');
        return 'Your video went viral. A brand paid ' + naira(pay2) + '.';
      }
      return 'Posted. A few hundred views.';
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

  function travelOptions(s, dest) {
    var from = s.loc;
    if (from === dest) return [];
    var km = distance(from, dest);
    var crossing = D.DISTRICTS[from].side !== D.DISTRICTS[dest].side;
    var flood = s.econ.flood > 0 && (D.DISTRICTS[dest].side === 'island' || D.DISTRICTS[from].side === 'island');
    return Object.keys(D.MODES).map(function (id) {
      var m = D.MODES[id];
      var o = { mode: id, name: m.name, km: km };
      if (m.needsCar && !s.car) o.disabled = 'You do not own a car';
      else if (m.stops === 'ferry' && (D.FERRY_STOPS.indexOf(from) < 0 || D.FERRY_STOPS.indexOf(dest) < 0)) o.disabled = 'No jetty on this route';
      else if (m.stops === 'brt' && (D.BRT_STOPS.indexOf(from) < 0 || D.BRT_STOPS.indexOf(dest) < 0)) o.disabled = 'No BRT on this route';
      else if (m.noBridge && crossing) o.disabled = 'Keke cannot use the bridges';
      else if (km > m.maxKm) o.disabled = 'Too far (' + km + ' km)';
      var f = 1;
      if (m.road) {
        f = traffic(s, crossing);
        if (m.weave) f = 1 + (f - 1) * m.weave;
        if (flood) f *= 1.6;
      }
      o.traffic = Math.round(f * 10) / 10;
      o.mins = Math.max(STEP, ceilTo(m.wait + km / m.speed * 60 * f, STEP));
      var fare;
      if (id === 'ferry') fare = m.min;
      else fare = Math.max(m.min, m.perKm * km);
      if (id !== 'trek') fare *= s.econ.fuel;
      if (s.econ.policy === 'fares' && id !== 'car' && id !== 'trek') fare *= 0.8;
      o.cost = id === 'trek' ? 0 : roundTo(fare * priceFactor(s), 50);
      o.risk = id === 'okada' && (okadaBanned(s, from) || okadaBanned(s, dest)) ? 'Okada is banned here. Task force may seize it.' : null;
      if (id === 'trek') o.energy = Math.round(m.energyPerKm * km);
      if (!o.disabled && s.over) o.disabled = 'This Weekly Lagos is over';
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
    s.loc = dest;
    s.stats.trips++;
    if (s.stats.trips >= 50) unlock(s, 'commuter');
    if (mode === 'ferry') unlock(s, 'ferry');
    var msg = 'You reached ' + D.DISTRICTS[dest].name + ' in ' + fmtMins(o.mins) + '.';
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
      case 'police':
        if (idx === 0) { payPartial(s, price(s, 2000), 'Checkpoint "settlement"'); msg = 'He waves you through.'; }
        else { advance(s, 45); applyFx(s, { stress: 10 }); msg = 'Forty-five minutes of argument, then he lets you go.'; }
        break;
      case 'areaboys':
        if (idx === 0) { payPartial(s, price(s, 500), 'Owo ijoko'); msg = 'They leave you alone.'; }
        else if (rand(s) < 0.4) { var t = Math.min(s.cash, price(s, 1500)); if (t) post(s, 'cash', -t, 'Taken by area boys'); applyFx(s, { stress: 15 }); msg = 'They took ' + naira(t) + ' from your pocket.'; }
        else { applyFx(s, { stress: 5 }); msg = 'You stood your ground. They moved on.'; }
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
    if (msg && ev.id !== 'scam' && ev.id !== 'vote') log(s, msg, 'info');
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
      return roundTo(D.CAREERS[s.job.id].pay[s.job.level] * 10, 1000);
    }
    return LOANS[kind].max;
  }

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
    s.loans.push({ kind: kind, name: L.name, bal: amt, rate: L.rate, weeksLeft: L.weeks, principal: amt });
    log(s, 'Borrowed ' + naira(amt) + ' (' + L.name + ', ' + Math.round(L.rate * 100) + '% a week, ' + L.weeks + ' weeks).', 'info');
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

  function buyBusiness(s, id) {
    var b = D.BUSINESSES[id];
    if (!b) return fail('Unknown business.');
    var cost = price(s, b.price);
    s.alerts = [];
    if (!pay(s, cost, 'Bought ' + b.name)) return fail('You need ' + naira(cost) + '.');
    s.businesses.push({ id: id, paid: cost, visit: day(s) });
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
      if (def.weekend) v *= (d >= 4 ? 2.2 : 0.3);
      if (def.december && isDecember(s)) v *= def.december;
      if (monthIndex(s) === 0) v *= 0.75;
      if (day(s) - b.visit > 7) { v *= 0.45; notes.push(def.name + ' staff are stealing'); }
      if (def.power && !s.power) v -= def.daily * 0.12 * s.econ.fuel * s.econ.infl;
      if (def.risky && rand(s) < 0.05) { v -= def.daily * 1.5; notes.push('union and LASTMA "dues" on the bus'); }
      total += v;
    });
    total = roundTo(total, 50);
    if (total > 0) earn(s, total, 'Business payout');
    else if (total < 0) { var lost = payPartial(s, -total, 'Business running costs'); if (lost < -total) addDebt(s, -total - lost, 'Business suppliers'); }
    if (notes.length) log(s, 'Business: ' + notes.join('; ') + '.', 'bad');
  }

  function buyProperty(s, id) {
    var p = D.PROPERTIES[id];
    if (!p) return fail('Unknown property.');
    var cost = price(s, p.price);
    s.alerts = [];
    if (!pay(s, cost, 'Bought ' + p.name)) return fail('You need ' + naira(cost) + '.');
    s.properties.push({ id: id, value: cost });
    log(s, 'Omo! You now own a ' + p.name + '. Make sure the C of O is real.', 'good');
    if (p.house) unlock(s, 'landlord');
    return finish(s, ok('Property bought.'));
  }

  function weeklyProperty(s) {
    s.properties.forEach(function (p) {
      var def = D.PROPERTIES[p.id];
      p.value = roundTo(p.value * (def.house ? 1.006 : 1.012), 1000);
      if (def.weekly) earn(s, roundTo(def.weekly * s.econ.infl, 50), 'Tenant rent: ' + def.name);
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
    var fee = price(s, SCHOOLS[k.school].fee);
    if (!pay(s, fee, 'School fees (' + SCHOOLS[k.school].name + ')')) { addDebt(s, fee, 'School fees'); applyFx(s, { stress: 20 }); }
    k.nextFees = day(s) + 84;
  }

  function weddingOptions(s) {
    var p = s.partner;
    return Object.keys(WEDDINGS).map(function (k) {
      var w = WEDDINGS[k], cost = price(s, w.price), o = { id: k, name: w.name, cost: cost };
      if (s.rules < 6 || !p) o.disabled = 'You are not in a relationship';
      else if (p.stage === 'married') o.disabled = 'Already married';
      else if (p.stage !== 'introduced') o.disabled = 'Do the family introduction first';
      else if (p.aff < 75) o.disabled = p.name + ' is not ready yet (' + p.aff + '/75)';
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

  /* ---------- billboards ----------
   * The engine only takes the rent (a recorded, replayable debit). What the
   * ad says lives in the shared store and is built from fixed parts. */

  function boardDef(id) {
    for (var i = 0; i < D.BILLBOARDS.length; i++) if (D.BILLBOARDS[i].id === id) return D.BILLBOARDS[i];
    return null;
  }
  function boardRent(s) { return price(s, D.BILLBOARD_RENT); }

  function rentBoard(s, id) {
    var b = boardDef(id);
    if (!b) return fail('No such billboard.');
    if (s.pending.length) return fail('Decide on the open event first.');
    var cost = boardRent(s);
    s.alerts = [];
    if (!pay(s, cost, 'Billboard rental: ' + b.name)) return fail('Renting this board costs ' + naira(cost) + '.');
    unlock(s, 'billboard');
    log(s, 'Your ad is up on the ' + b.name + ' billboard for 24 hours.', 'good');
    return finish(s, ok('Your ad is on air at ' + b.name + '.'));
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
    if (typeof raw.until !== 'number' || raw.until <= now || raw.until > now + 25 * 3600 * 1000) return null;
    return { board: raw.board, emoji: D.AD_EMOJI[e], text: text, color: D.AD_COLORS[c], until: raw.until, at: typeof raw.at === 'number' ? raw.at : 0 };
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
    var why = s.needs.hunger <= 0 ? 'hunger' : 'exhaustion';
    // One bill per week at most; a broke patient is treated on credit once,
    // then by the hospital's charity fund. No spiral into endless debt.
    if (s.hospitalWeek !== week(s)) {
      s.hospitalWeek = week(s);
      var bill = price(s, 8000);
      var paid = payPartial(s, bill, 'General Hospital bill');
      if (paid < bill) addDebt(s, bill - paid, 'Hospital bill');
    }
    advance(s, 360);
    s.loc = 'island';
    s.needs.hunger = Math.max(s.needs.hunger, 60);
    s.needs.energy = Math.max(s.needs.energy, 60);
    s.needs.stress = clamp(s.needs.stress + 15, 0, 100);
    var msg = 'You collapsed from ' + why + ' and woke up in General Hospital, Lagos Island.';
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
  function migrate(s) {
    if (!s || s.sv >= SCHEMA) return s;
    if (s.welfareDay == null) s.welfareDay = -1;
    if (s.viralWeek == null) s.viralWeek = -1;
    if (s.hospitalWeek == null) s.hospitalWeek = -1;
    if (!s.wk) s.wk = { inc: {}, out: {} };
    if (!s.history) s.history = [];
    if (s.report === undefined) s.report = null;
    if (s.replay === undefined) s.replay = null; // lives from before v0.5 cannot be replayed
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
      if (d === s.loc) return;
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

  function advise(s) {
    if (s.pending.length || s.over) return [];
    var out = [];
    if (s.needs.hunger < 30) out.push(foodHint(s));
    if (s.needs.energy < 25) {
      if (homeDistrict(s) === s.loc) {
        var am3 = alarmMins(s);
        out.push(am3 != null && am3 < 480
          ? { kind: 'warn', text: 'You are exhausted. Sleep with your alarm set so you do not miss work.', act: { type: 'act', id: 'home_alarm' } }
          : { kind: 'warn', text: 'You are exhausted. Sleep before you collapse.', act: { type: 'act', id: 'home_sleep' } });
      }
      else {
        var r = route(s, homeDistrict(s), 'cheap');
        out.push({ kind: 'warn', text: 'You are exhausted. Go home to sleep' + (r ? ' (' + D.MODES[r.mode].name + ', ' + fmtMins(r.mins) + ').' : '.'), act: r ? { type: 'travel', dest: homeDistrict(s), mode: r.mode } : null });
      }
    }
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
      var gig = availableActions(s).filter(function (a) { return a.gig && !a.disabled; })[0];
      out.push({ kind: 'warn', text: 'Rent of ' + naira(s.rentRate) + ' is due in ' + fmtMins(due) + '. You are ' + naira(s.rentRate - s.cash - s.bank) + ' short.' + (gig ? ' ' + gig.label + ' pays about ' + naira(gig.earnEst) + '.' : ''), act: gig ? { type: 'act', id: gig.id } : { type: 'tab', id: 'money' } });
    }
    if (s.pantry <= 1 && !out.some(function (t) { return t.kind === 'warn' && t.act && t.act.type !== 'tab'; })) {
      var shop = availableActions(s).filter(function (a) { return a.special === 'pantry7' && !a.disabled && a.price + s.rentRate <= s.cash + s.bank; })[0];
      if (shop) out.push({ kind: 'info', text: 'Your kitchen is empty. ' + shop.label.replace(/ \(7 meals\)/, '') + ': 7 meals for ' + naira(shop.price) + ', far cheaper than eating out.', act: { type: 'act', id: shop.id } });
    }
    if (s.job && s.rentRate) {
      var jc = D.CAREERS[s.job.id], weekly = jc.pay[s.job.level] * s.econ.wage * jc.days.length;
      if (s.rentRate > weekly * 0.45 && s.cash + s.bank < s.rentRate * 6) {
        var near = Object.keys(D.HOMES).filter(function (k) { return !D.HOMES[k].hidden && D.HOMES[k].rent * s.econ.infl <= weekly * 0.3; })
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
        var g = availableActions(s).filter(function (a) { return a.gig && !a.disabled; })[0];
        out.push(g ? { kind: 'warn', text: 'You are broke and far from home. ' + g.label + ' pays about ' + naira(g.earnEst) + ', enough for a ride.', act: { type: 'act', id: g.id } }
          : { kind: 'warn', text: 'You are broke and far from home. Trek back to ' + D.DISTRICTS[homeDistrict(s)].name + ' (' + fmtMins(home.mins) + ').', act: { type: 'travel', dest: homeDistrict(s), mode: 'trek' } });
      }
    }
    if (!out.length && s.cash + s.bank < s.rentRate * 2) {
      var gig2 = availableActions(s).filter(function (a) { return a.gig && !a.disabled; })[0];
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
  function lifeSummary(s) {
    var weeks = week(s) + 1, worth = netWorth(s), achievements = Object.keys(s.ach).length;
    var score = scoreOf({ worth: worth, weeks: weeks, achievements: achievements, won: !!s.won, level: s.job ? s.job.level : 0,
      married: !!(s.partner && s.partner.stage === 'married'), kids: (s.kids || []).length });
    return {
      name: s.name, origin: s.origin, goal: s.goal, won: !!s.won, weeks: weeks, worth: worth,
      peak: s.stats.peakWorth, title: s.job ? D.CAREERS[s.job.id].titles[s.job.level] : null,
      home: s.home, achievements: achievements, score: score, tampered: !!s.tampered
    };
  }

  /* ---------- shared hall of fame ----------
   * Entries are written by players' own browsers, so they are untrusted.
   * Readers never trust a stored score: they rebuild it from the fields and
   * drop entries that no honest game could produce. A server-run engine is
   * the real fix (docs/REVIEW.md §5); this keeps casual edits off the board. */

  var FAME_FIELDS = { weeks: 1, worth: 1, achievements: 1, level: 1, won: 1, origin: 1, goal: 1, married: 1, kids: 1 };

  function scoreOf(e) {
    return Math.round(Math.max(0, e.worth) / 1000 + e.weeks * 10 + e.achievements * 50 + (e.won ? 500 : 0) + e.level * 40 +
      (e.married ? 200 : 0) + (e.kids || 0) * 100);
  }

  function fameEntry(s) {
    var e = {
      v: 1, weeks: week(s) + 1, worth: netWorth(s), achievements: Object.keys(s.ach).length,
      level: s.job ? s.job.level : 0, won: !!s.won, origin: s.origin, goal: s.goal,
      career: s.job ? s.job.id : null, home: s.home, seal: s.ledgerHash, lines: s.ledgerCount,
      married: !!(s.partner && s.partner.stage === 'married'), kids: (s.kids || []).length
    };
    e.score = scoreOf(e);
    if (s.replay) e.replay = { seed: s.replay.seed, goal: s.replay.goal, origin: s.replay.origin, rules: s.replay.rules, challenge: s.replay.challenge || null, acts: s.replay.acts };
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
    Object.keys(FAME_FIELDS).forEach(function (k) { e[k] = raw[k]; });
    e.married = !!raw.married; e.kids = raw.kids || 0;
    e.career = typeof raw.career === 'string' && D.CAREERS[raw.career] ? raw.career : null;
    e.home = typeof raw.home === 'string' && D.HOMES[raw.home] ? raw.home : null;
    // Ceiling on wealth: starting cash plus a generous ₦3m a week.
    if (e.worth > D.ORIGINS[e.origin].cash * 2 + e.weeks * 3000000) return null;
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
    if (rules !== 5 && rules !== 6) return null;
    if (rp.challenge != null && !CHALLENGE_ID.test(rp.challenge)) return null;
    var s = newGame({ seed: rp.seed, goal: rp.goal, origin: rp.origin || undefined, name: 'Replay', rules: rules, challenge: rp.challenge || undefined });
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
    var start = D.ORIGINS[s.origin].cash;
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
    var title = s.job ? D.CAREERS[s.job.id].titles[s.job.level] : 'job hunting';
    var got = Object.keys(s.ach).length, total = Object.keys(ACHIEVEMENTS).length;
    return 'Week ' + (week(s) + 1) + ' in #Lasgidi: ' + s.name + ', ' + D.ORIGINS[s.origin].name + ', now ' + title + ' living in ' + D.DISTRICTS[homeDistrict(s)].name +
      '. Net worth ' + naira(netWorth(s)) + '. ' + got + '/' + total + ' achievements.' + (s.won ? ' ' + D.GOALS[s.won.goal].name + ' goal: done.' : '') + ' Lagos no dey carry last.';
  }

  function verifyLedger(s) {
    return s.cash === s.opening.cash + s.ledgerSum.cash && s.bank === s.opening.bank + s.ledgerSum.bank &&
      s.cash >= 0 && s.bank >= 0;
  }

  // Every call that changes a life goes through recorded(), so the life can be replayed.
  // A finished challenge is frozen: every recorded call becomes a no-op failure.
  function recorded(code, raw) {
    var fn = function (s) { return s.over ? fail('This Weekly Lagos is over. Start next week\'s, or go back to your life.') : raw.apply(null, arguments); };
    RECORDED[code] = { fn: fn };
    return function (s) {
      var args = Array.prototype.slice.call(arguments, 1);
      if (s.over) return fn.apply(null, arguments); // frozen: refuse without recording
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
    buyProperty: recorded('bp', buyProperty), buyCar: recorded('bc', buyCar),
    netWorth: netWorth, debts: debts, goalProgress: goalProgress, skillLevel: skillLevel, performance: performance,
    price: price, okadaBanned: okadaBanned, homeDef: homeDef,
    serialize: serialize, deserialize: deserialize, verifyLedger: verifyLedger,
    clockLabel: clockLabel, dateLabel: dateLabel, day: day, dow: dow, hour: hour, week: week,
    monthIndex: monthIndex, isDecember: isDecember, naira: naira, fmtMins: fmtMins,
    rentBoard: recorded('rb', rentBoard), boardRent: boardRent, adSlogans: adSlogans, sloganText: sloganText, checkAd: checkAd,
    marry: recorded('mw', marry), weddingOptions: weddingOptions, rentShare: rentShare, SCHOOLS: SCHOOLS, RULES: RULES,
    wait: recorded('z', wait), replayLife: replayLife, verifyFame: verifyFame,
    challengeId: challengeId, challengeEntry: challengeEntry, verifyChallenge: verifyChallenge, challengeShareText: challengeShareText, CHALLENGE_WEEKS: CHALLENGE_WEEKS,
    migrate: migrate, advise: advise, lifeSummary: lifeSummary, fameEntry: fameEntry, checkFame: checkFame, scoreOf: scoreOf, nextShiftStart: nextShiftStart, alarmMins: alarmMins, minutesUntilRent: minutesUntilRent, shareText: shareText, route: route,
    CATEGORY_NAMES: CATEGORY_NAMES, category: category, SCHEMA: SCHEMA,
    _advance: advance, _post: post
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Lasgidi = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
