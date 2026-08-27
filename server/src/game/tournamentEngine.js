const { ALL_TEAMS, getTeam } = require('../data/teams');
const { bestBotSetup, teamStrength, prepareBotForMatch } = require('./botEngine');
const { simulateMatch } = require('./matchSim');
const { analyzeMatch, resultOutcome } = require('./matchAnalysis');
const { normalizeStyle } = require('./tacticalStyles');

const GROUP_LABELS = 'ABCDEFGHIJKL'.split('');
const KNOCKOUT_LABEL = { r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-Finals', sf: 'Semi-Finals', final: 'Final' };

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function avg(nums) {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// Total slots (human + bot) each shortened tournament length starts with.
const LENGTH_SLOT_COUNT = { blitz: 32, quarter: 8 };

// "Emotional" momentum: each team's morale (-1..+1) tracks its recent results across the
// whole tournament and carries into its next match's ratings via matchSim's moraleModifier
// — a side on a good run plays with a bit more conviction than its paper quality alone
// would suggest, and one that just got beaten up looks shakier than its rating average.
// A knockout draw settled on penalties still counts as a real result for morale (you won
// or lost the match), even though the scoreline itself finished level.
const MORALE_HISTORY_WEIGHT = 0.5; // how much of the previous value survives into the update
function updateMorale(slot, myGoals, oppGoals, shootoutWon) {
  if (!slot) return;
  let resultScore;
  if (shootoutWon != null) {
    resultScore = shootoutWon ? 0.7 : -0.7;
  } else if (myGoals > oppGoals) {
    resultScore = 1;
  } else if (myGoals < oppGoals) {
    resultScore = -1;
  } else {
    resultScore = -0.1; // a draw is mildly deflating, not a neutral result
  }
  const marginBonus = clamp((myGoals - oppGoals) * 0.15, -0.5, 0.5);
  const target = clamp(resultScore + marginBonus, -1, 1);
  const prev = slot.morale || 0;
  slot.morale = clamp(prev * MORALE_HISTORY_WEIGHT + target * (1 - MORALE_HISTORY_WEIGHT), -1, 1);
}

function startTournament(roomState) {
  const members = Array.from(roomState.members.values());
  const humanCount = members.length;
  const length = roomState.tournamentLength || (roomState.blitzMode ? 'blitz' : 'full');
  const startingSlots = LENGTH_SLOT_COUNT[length] || null;

  if (startingSlots) {
    if (humanCount > startingSlots) throw new Error(`at most ${startingSlots} human-controlled slots are allowed for this tournament length`);
  } else if (humanCount > 32) {
    throw new Error('at most 32 human-controlled slots are allowed');
  }

  const shuffledCodes = shuffle(ALL_TEAMS.map((t) => t.code));
  const humanCodes = shuffledCodes.slice(0, humanCount);
  let botCodes = shuffledCodes.slice(humanCount);

  // Blitz / Top 8: skip the group stage entirely and start straight in the knockout
  // bracket. Every human is guaranteed a spot; bots are randomly trimmed from 48 down
  // to fill the remaining slots, so no group-stage matches are ever simulated.
  if (startingSlots) botCodes = botCodes.slice(0, Math.max(0, startingSlots - humanCount));

  const slots = [];
  humanCodes.forEach((code, i) => {
    const member = members[i];
    const xi = member.squad.map((p) => ({ ...p, isCaptain: !!member.captainSlot && p.slotCode === member.captainSlot }));
    slots.push({
      code,
      name: getTeam(code).name,
      isHuman: true,
      userId: member.userId,
      username: member.username,
      xi,
      formation: member.formation,
      tacticalStyle: normalizeStyle(member.tacticalStyle),
      strength: avg(member.squad.map((p) => p.overall)),
      eliminated: false,
      morale: 0
    });
  });
  botCodes.forEach((code) => {
    const team = getTeam(code);
    const setup = bestBotSetup(team);
    slots.push({ code, name: team.name, isHuman: false, userId: null, xi: setup.xi, formation: setup.formation, tacticalStyle: setup.tacticalStyle, strength: teamStrength(setup.xi), eliminated: false, morale: 0 });
  });

  if (startingSlots) {
    const startStage = length === 'quarter' ? 'qf' : 'r32';
    const slotByCode = {};
    for (const s of slots) slotByCode[s.code] = s;
    const advancing = shuffle(slots.map((s) => s.code));
    const matches = [];
    for (let i = 0; i < advancing.length; i += 2) {
      matches.push({ aCode: advancing[i], bCode: advancing[i + 1], result: null, winnerCode: null });
    }

    roomState.tournament = {
      stage: startStage,
      slotByCode,
      groups: {},
      standings: {},
      groupMatchdaysPlayed: 0,
      fixtures: [],
      bracket: { [startStage]: matches },
      matchLog: [],
      history: [],
      champion: null
    };
    return roomState.tournament;
  }

  const shuffledSlots = shuffle(slots);
  const groupChunks = chunk(shuffledSlots, 4);
  const groups = {};
  const standings = {};
  const slotByCode = {};

  groupChunks.forEach((four, idx) => {
    const label = GROUP_LABELS[idx];
    groups[label] = four.map((s) => s.code);
    four.forEach((s) => {
      slotByCode[s.code] = s;
      standings[s.code] = { pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, played: 0, group: label };
    });
  });

  const fixtures = [[], [], []];
  const pairingOrder = [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]];
  for (const [label, codes] of Object.entries(groups)) {
    pairingOrder.forEach(([a1, b1, a2, b2], mdIdx) => {
      fixtures[mdIdx].push({ group: label, aCode: codes[a1], bCode: codes[b1] });
      fixtures[mdIdx].push({ group: label, aCode: codes[a2], bCode: codes[b2] });
    });
  }

  roomState.tournament = {
    stage: 'group',
    slotByCode,
    groups,
    standings,
    groupMatchdaysPlayed: 0,
    fixtures,
    bracket: {},
    matchLog: [],
    history: [], // sequential step records — see simulateNextStep / decorateStep
    champion: null
  };

  return roomState.tournament;
}

function applyGroupResult(t, aCode, bCode, sim) {
  const sa = t.standings[aCode];
  const sb = t.standings[bCode];
  sa.played += 1;
  sb.played += 1;
  sa.gf += sim.goalsA;
  sa.ga += sim.goalsB;
  sb.gf += sim.goalsB;
  sb.ga += sim.goalsA;
  if (sim.goalsA > sim.goalsB) {
    sa.w += 1; sa.pts += 3; sb.l += 1;
  } else if (sim.goalsA < sim.goalsB) {
    sb.w += 1; sb.pts += 3; sa.l += 1;
  } else {
    sa.d += 1; sb.d += 1; sa.pts += 1; sb.pts += 1;
  }
  updateMorale(t.slotByCode[aCode], sim.goalsA, sim.goalsB);
  updateMorale(t.slotByCode[bCode], sim.goalsB, sim.goalsA);
}

function rankGroup(t, label) {
  const codes = t.groups[label];
  return codes
    .map((code) => ({ code, ...t.standings[code] }))
    .sort((x, y) => (y.pts - x.pts) || ((y.gf - y.ga) - (x.gf - x.ga)) || (y.gf - x.gf) || (Math.random() - 0.5));
}


function ordinal(n) {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}
function qualificationPressure(t, group, code) {
  const ranked = rankGroup(t, group);
  const row = ranked.find((r) => r.code === code);
  if (!row) return null;
  const rank = ranked.findIndex((r) => r.code === code) + 1;
  const gd = row.gf - row.ga;
  const top2Pts = ranked[1] ? ranked[1].pts : 0;
  const thirdPts = ranked[2] ? ranked[2].pts : 0;

  if (rank >= 4 || row.pts <= 1) {
    return { level: 1, label: 'Must-win', reason: `Sits ${ordinal(rank)} on ${row.pts} pts before the final group match; only a win gives a realistic qualification route.` };
  }
  if (rank === 3) {
    const level = row.pts >= top2Pts ? 0.8 : 0.92;
    return { level, label: 'Qualification push', reason: `Sits 3rd on ${row.pts} pts and needs the final match to reach the automatic places or protect a best-third route.` };
  }
  if (rank === 2) {
    const level = thirdPts >= row.pts - 1 ? 0.72 : 0.48;
    return { level, label: 'Protect qualification', reason: `Sits 2nd on ${row.pts} pts with ${gd >= 0 ? '+' : ''}${gd} GD; a result is still needed to avoid being dragged back.` };
  }
  if (rank === 1 && row.pts < 6) {
    return { level: 0.42, label: 'Seal top spot', reason: `Leads the group on ${row.pts} pts but has not fully secured first place yet.` };
  }
  return { level: 0.18, label: 'Control the group', reason: `Starts the final group match from a strong position and can manage the game with less pressure.` };
}
// One block of four teams feeds one Round-of-16 slot. Separating same-group teams by
// block prevents a group winner and runner-up from meeting again in R32 or R16.
function seedRoundOf32(top2, best8) {
  const seeds = [
    ...shuffle(top2.filter((s) => s.rank === 1)),
    ...shuffle(top2.filter((s) => s.rank === 2)),
    ...shuffle(best8)
  ];
  const blocks = Array.from({ length: 8 }, () => []);

  const solve = (seedIndex) => {
    if (seedIndex >= seeds.length) return blocks.every((block) => block.length === 4);
    const seed = seeds[seedIndex];
    const blockOrder = shuffle(blocks.map((_, idx) => idx))
      .sort((a, b) => blocks[a].length - blocks[b].length);

    for (const blockIndex of blockOrder) {
      const block = blocks[blockIndex];
      if (block.length >= 4 || block.some((s) => s.group === seed.group)) continue;
      block.push(seed);
      if (solve(seedIndex + 1)) return true;
      block.pop();
    }
    return false;
  };

  if (!solve(0)) throw new Error('could not seed knockout bracket without early same-group rematches');

  return blocks
    .flatMap((block) => shuffle(block))
    .map((s) => s.code);
}

// Marks a slot (human OR bot) as eliminated so group-final/bracket displays are accurate
// for everyone. Only human slots also flip the member's own "eliminated" (spectator) flag.
function markEliminated(roomState, code) {
  const t = roomState.tournament;
  const slot = t.slotByCode[code];
  if (!slot) return;
  slot.eliminated = true;
  if (slot.isHuman) {
    const member = roomState.members.get(slot.userId);
    if (member) member.eliminated = true;
  }
}

function finalizeGroupsAndSeedR32(roomState) {
  const t = roomState.tournament;
  const top2 = [];
  const thirds = [];
  const eliminatedCodes = [];
  Object.keys(t.groups).forEach((label, groupIndex) => {
    const ranked = rankGroup(t, label);
    top2.push({ ...ranked[0], rank: 1, groupIndex }, { ...ranked[1], rank: 2, groupIndex });
    thirds.push({ ...ranked[2], rank: 3, groupIndex });
    // 4th place is always out immediately. 3rd place's fate depends on the cross-group
    // "best 8 thirds" comparison below, so it's deliberately NOT marked eliminated yet —
    // marking it here (before that comparison) would wrongly strike through every 3rd-place
    // team, including the 8 that actually go on to play in the Round of 32.
    markEliminated(roomState, ranked[3].code);
    eliminatedCodes.push(ranked[3].code);
  });
  thirds.sort((x, y) => (y.pts - x.pts) || ((y.gf - y.ga) - (x.gf - x.ga)) || (y.gf - x.gf) || (Math.random() - 0.5));
  const best8 = thirds.slice(0, 8);
  for (const s of thirds.slice(8)) {
    markEliminated(roomState, s.code);
    eliminatedCodes.push(s.code);
  }

  const advancing = seedRoundOf32(top2, best8);
  const matches = [];
  for (let i = 0; i < advancing.length; i += 2) {
    matches.push({ aCode: advancing[i], bCode: advancing[i + 1], result: null, winnerCode: null });
  }
  t.bracket = { r32: matches };
  t.stage = 'r32';
  return eliminatedCodes;
}

function playKnockoutRound(roomState) {
  const t = roomState.tournament;
  const matches = t.bracket[t.stage];
  const winners = [];
  for (const m of matches) {
    const a = t.slotByCode[m.aCode];
    const b = t.slotByCode[m.bCode];
    prepareBotForMatch(a, b);
    prepareBotForMatch(b, a);
    const sim = simulateMatch(a, b, { knockout: true, stage: t.stage });
    // Captured before updateMorale mutates it below — the analysis for this match should
    // reflect the confidence each side carried INTO it, not the result it just produced.
    const moraleA = a.morale || 0;
    const moraleB = b.morale || 0;
    m.result = sim;
    m.winnerCode = sim.goalsA > sim.goalsB || (sim.wentToPenalties && sim.penaltyWinner === 'A') ? a.code : b.code;
    const loserCode = m.winnerCode === a.code ? b.code : a.code;
    markEliminated(roomState, loserCode);
    winners.push(m.winnerCode);
    t.matchLog.push({ stage: t.stage, aCode: a.code, bCode: b.code, moraleA, moraleB, ...sim, winnerCode: m.winnerCode });
    if (sim.wentToPenalties) {
      updateMorale(a, sim.goalsA, sim.goalsB, sim.penaltyWinner === 'A');
      updateMorale(b, sim.goalsB, sim.goalsA, sim.penaltyWinner === 'B');
    } else {
      updateMorale(a, sim.goalsA, sim.goalsB);
      updateMorale(b, sim.goalsB, sim.goalsA);
    }
  }

  const order = { r32: 'r16', r16: 'qf', qf: 'sf', sf: 'final' };
  const finishedStage = t.stage;

  if (finishedStage === 'final') {
    t.champion = winners[0];
    t.stage = 'done';
  } else {
    const nextStage = order[finishedStage];
    const nextMatches = [];
    for (let i = 0; i < winners.length; i += 2) {
      nextMatches.push({ aCode: winners[i], bCode: winners[i + 1], result: null, winnerCode: null });
    }
    t.bracket[nextStage] = nextMatches;
    t.stage = nextStage;
  }

  return { finishedStage, matches: t.matchLog.filter((m) => m.stage === finishedStage) };
}

// Runs exactly ONE more step of the shared, room-wide tournament simulation (one group
// matchday, or one full knockout round) and appends it to the history log. This is the
// single source of truth; per-user viewing progress (roomState.members.get(id).viewedStep)
// is tracked separately so one member simulating doesn't force everyone else's screen
// forward — see sockets/index.js's tournament:advance handler.
function simulateNextStep(roomState) {
  const t = roomState.tournament;
  if (!t || t.stage === 'done') return null;

  if (t.stage === 'group') {
    const mdIdx = t.groupMatchdaysPlayed;
    const md = t.fixtures[mdIdx];
    const rawMatches = md.map((fx) => {
      const a = t.slotByCode[fx.aCode];
      const b = t.slotByCode[fx.bCode];
      prepareBotForMatch(a, b);
      prepareBotForMatch(b, a);
      const groupFinalPressure = mdIdx === 2;
      const moraleContext = groupFinalPressure ? {
        A: qualificationPressure(t, fx.group, fx.aCode),
        B: qualificationPressure(t, fx.group, fx.bCode)
      } : null;
      const sim = simulateMatch(a, b, { knockout: false, stage: 'group', moraleContext });
      // Captured before applyGroupResult mutates morale for the NEXT match — the analysis
      // shown for this match should reflect the confidence each side carried INTO it.
      const moraleA = a.morale || 0;
      const moraleB = b.morale || 0;
      applyGroupResult(t, fx.aCode, fx.bCode, sim);
      const entry = { stage: 'group', group: fx.group, aCode: fx.aCode, bCode: fx.bCode, moraleA, moraleB, ...sim };
      t.matchLog.push(entry);
      return entry;
    });
    t.groupMatchdaysPlayed += 1;
    const matchday = t.groupMatchdaysPlayed;
    const groupFinal = matchday === 3;
    const eliminatedCodes = groupFinal ? finalizeGroupsAndSeedR32(roomState) : [];

    const step = {
      index: t.history.length,
      type: 'group',
      label: `Group Stage — Matchday ${matchday}`,
      matchday,
      matches: rawMatches,
      eliminatedCodes,
      groupFinal
    };
    t.history.push(step);
    return step;
  }

  const { finishedStage, matches } = playKnockoutRound(roomState);
  const step = {
    index: t.history.length,
    type: 'knockout',
    label: KNOCKOUT_LABEL[finishedStage] || finishedStage,
    finishedStage,
    matches,
    eliminatedCodes: matches
      .map((m) => (m.winnerCode === m.aCode ? m.bCode : m.aCode))
      .filter(Boolean),
    champion: t.stage === 'done'
  };
  t.history.push(step);
  return step;
}

// Turns a raw history[] record into everything a client needs to render that one step:
// Every real football result app leads with "your" match — this finds the requesting
// viewer's own slot code (if they're a human with a team in this tournament).
function findMyCode(t, forUserId) {
  if (!forUserId) return null;
  for (const [code, slot] of Object.entries(t.slotByCode)) {
    if (slot.isHuman && slot.userId === forUserId) return code;
  }
  return null;
}

// Aggregates one user's whole-tournament record (W-D-L, goals, top scorer) straight
// from matchLog + the events already generated by matchSim — no separate tracking.
function computeTeamRecord(t, myCode) {
  if (!myCode || !t.slotByCode[myCode]) return null;
  const slot = t.slotByCode[myCode];
  let w = 0;
  let d = 0;
  let l = 0;
  let gf = 0;
  let ga = 0;
  const scorers = {};

  for (const m of t.matchLog) {
    if (m.aCode !== myCode && m.bCode !== myCode) continue;
    const isA = m.aCode === myCode;
    const myGoals = isA ? m.goalsA : m.goalsB;
    const oppGoals = isA ? m.goalsB : m.goalsA;
    gf += myGoals;
    ga += oppGoals;

    let outcome = myGoals > oppGoals ? 'w' : myGoals < oppGoals ? 'l' : 'd';
    if (m.wentToPenalties) {
      const iWonShootout = (isA && m.penaltyWinner === 'A') || (!isA && m.penaltyWinner === 'B');
      outcome = iWonShootout ? 'w' : 'l';
    }
    if (outcome === 'w') w += 1;
    else if (outcome === 'l') l += 1;
    else d += 1;

    for (const e of m.events || []) {
      if (e.type === 'goal' && e.side === (isA ? 'A' : 'B')) {
        scorers[e.player] = (scorers[e.player] || 0) + 1;
      }
    }
  }

  let topScorer = null;
  let topGoals = 0;
  for (const [name, goals] of Object.entries(scorers)) {
    if (goals > topGoals) { topGoals = goals; topScorer = name; }
  }

  return {
    code: myCode,
    countryName: slot.name,
    formation: slot.formation,
    tacticalStyle: slot.tacticalStyle || 'balanced',
    eliminated: slot.eliminated,
    w, d, l, gf, ga,
    topScorer, topGoals,
    squad: slot.xi.map((p) => ({ name: p.name, pos: p.pos, overall: p.overall, isCaptain: !!p.isCaptain }))
  };
}

function computeMyMatchAnalyses(t, myCode) {
  if (!myCode || !t.slotByCode[myCode]) return [];
  const displayName = (code) => {
    const slot = t.slotByCode[code];
    if (!slot) return code;
    return slot.isHuman && slot.username ? slot.username : slot.name;
  };

  return t.matchLog
    .filter((m) => m.aCode === myCode || m.bCode === myCode)
    .map((m) => {
      const mySide = m.aCode === myCode ? 'A' : 'B';
      const oppCode = mySide === 'A' ? m.bCode : m.aCode;
      const myGoals = mySide === 'A' ? m.goalsA : m.goalsB;
      const oppGoals = mySide === 'A' ? m.goalsB : m.goalsA;
      const outcome = resultOutcome(m, mySide);
      return {
        stage: m.stage,
        label: m.stage === 'group' ? `Group ${m.group}` : (KNOCKOUT_LABEL[m.stage] || m.stage),
        opponentName: displayName(oppCode),
        score: `${myGoals} - ${oppGoals}`,
        outcome,
        analysis: analyzeMatch(m, mySide, displayName(myCode), displayName(oppCode))
      };
    });
}

// Tournament-wide awards, aggregated once the champion is decided from every match's
// events (goals/assists/saves/cards) across the whole matchLog — every team, not just
// the viewer's. Narrative only — none of this feeds back into any score or rating.
//
// IMPORTANT: stats are keyed by (teamCode + playerName) together, not by player name
// alone. Two different slots in the tournament can draft a player of the same real
// name (or the exact same real player can appear on multiple nations' squads in the
// pool) — their runs must never be merged into one aggregate.
function computeTournamentAwards(t) {
  const goals = new Map();     // key "teamCode|playerName" -> count
  const assists = new Map();
  const saves = new Map();
  const yellows = new Map();
  const reds = new Map();
  const knockoutGoals = new Map();
  const meta = new Map();      // key "teamCode|playerName" -> { player, teamCode, teamName, isHuman, username }

  for (const m of t.matchLog) {
    for (const e of m.events || []) {
      const teamCode = e.side === 'A' ? m.aCode : m.bCode;
      const slot = t.slotByCode[teamCode];
      if (!slot) continue;
      const involved = [[e.player, null]];
      if (e.type === 'goal' && e.assistBy) involved.push([e.assistBy, null]);
      for (const [pName] of involved) {
        const key = `${teamCode}|${pName}`;
        if (!meta.has(key)) {
          meta.set(key, {
            player: pName,
            teamCode,
            teamName: slot.name,
            isHuman: !!slot.isHuman,
            username: slot.username || null
          });
        }
      }
      const scorerKey = `${teamCode}|${e.player}`;
      if (e.type === 'goal') {
        goals.set(scorerKey, (goals.get(scorerKey) || 0) + 1);
        if (m.stage !== 'group') knockoutGoals.set(scorerKey, (knockoutGoals.get(scorerKey) || 0) + 1);
        if (e.assistBy) {
          const aKey = `${teamCode}|${e.assistBy}`;
          assists.set(aKey, (assists.get(aKey) || 0) + 1);
        }
      } else if (e.type === 'save') {
        saves.set(scorerKey, (saves.get(scorerKey) || 0) + 1);
      } else if (e.type === 'yellow') {
        yellows.set(scorerKey, (yellows.get(scorerKey) || 0) + 1);
      } else if (e.type === 'red') {
        reds.set(scorerKey, (reds.get(scorerKey) || 0) + 1);
      }
    }
  }

  const topOf = (counterMap) => {
    let bestKey = null;
    let bestCount = 0;
    for (const [key, count] of counterMap.entries()) {
      if (count > bestCount) { bestCount = count; bestKey = key; }
    }
    if (!bestKey) return null;
    const m = meta.get(bestKey);
    return { player: m.player, count: bestCount, teamCode: m.teamCode, teamName: m.teamName, isHuman: m.isHuman, username: m.username };
  };

  // Player of the Tournament: a holistic score across the player's whole tournament —
  // goals and assists carry the most weight (as in real Golden Ball voting), saves
  // count for less (so one busy goalkeeper doesn't automatically dominate a small
  // sample of matches), cards are a discipline penalty, and reaching the final with
  // the champion nation is a modest bonus for team success.
  const allKeys = new Set([
    ...goals.keys(), ...assists.keys(), ...saves.keys(), ...knockoutGoals.keys(),
    ...yellows.keys(), ...reds.keys()
  ]);
  let potmKey = null;
  let potmScore = -Infinity;
  let potmBreakdown = null;
  for (const key of allKeys) {
    const g = goals.get(key) || 0;
    const a = assists.get(key) || 0;
    const s = saves.get(key) || 0;
    const y = yellows.get(key) || 0;
    const r = reds.get(key) || 0;
    const m = meta.get(key);
    const isChampion = !!(t.champion && m && m.teamCode === t.champion);
    const score = g * 4 + a * 2.5 + s * 0.5 - y * 0.5 - r * 3 + (isChampion ? 3 : 0);
    if (score > potmScore) {
      potmScore = score;
      potmKey = key;
      potmBreakdown = { goals: g, assists: a, saves: s, isChampion };
    }
  }

  let playerOfTournament = null;
  if (potmKey) {
    const m = meta.get(potmKey);
    playerOfTournament = {
      player: m.player,
      teamCode: m.teamCode,
      teamName: m.teamName,
      isHuman: m.isHuman,
      username: m.username,
      score: Math.round(potmScore * 10) / 10,
      ...potmBreakdown
    };
  }

  const discipline = new Map();
  for (const key of allKeys) {
    const cardScore = (yellows.get(key) || 0) + (reds.get(key) || 0) * 2;
    if (cardScore > 0) discipline.set(key, cardScore);
  }

  return {
    topScorer: topOf(goals),
    topAssist: topOf(assists),
    mostSaves: topOf(saves),
    knockoutHero: topOf(knockoutGoals),
    mostBooked: topOf(discipline),
    playerOfTournament
  };
}

// Whole-tournament headline numbers: matches played, total/average goals, and the
// single biggest-margin result — a quick narrative summary alongside the awards.
function computeTournamentSummary(t) {
  const matches = t.matchLog;
  const totalMatches = matches.length;
  const totalGoals = matches.reduce((s, m) => s + m.goalsA + m.goalsB, 0);
  const avgGoalsPerMatch = totalMatches ? totalGoals / totalMatches : 0;

  let biggest = null;
  for (const m of matches) {
    const margin = Math.abs(m.goalsA - m.goalsB);
    if (!biggest || margin > biggest.margin) {
      biggest = {
        margin,
        aName: t.slotByCode[m.aCode].name,
        bName: t.slotByCode[m.bCode].name,
        goalsA: m.goalsA,
        goalsB: m.goalsB
      };
    }
  }

  return { totalMatches, totalGoals, avgGoalsPerMatch: Math.round(avgGoalsPerMatch * 100) / 100, biggest };
}

function completedBracket(t) {
  const name = (code) => t.slotByCode[code].name;
  const isHuman = (code) => t.slotByCode[code].isHuman;
  const username = (code) => t.slotByCode[code].username || null;
  const rounds = ['r32', 'r16', 'qf', 'sf', 'final'];
  return rounds
    .filter((stage) => Array.isArray(t.bracket[stage]))
    .map((stage) => ({
      stage,
      label: KNOCKOUT_LABEL[stage] || stage,
      matches: t.bracket[stage].map((m) => ({
        ...m,
        aName: name(m.aCode),
        bName: name(m.bCode),
        aHuman: isHuman(m.aCode),
        bHuman: isHuman(m.bCode),
        aUsername: username(m.aCode),
        bUsername: username(m.bCode)
      }))
    }));
}

// team names, human/username tags, winner highlighting, and (only when relevant) the
// final group standings or the champion banner. forUserId (optional) additionally
// reorders matches — the viewer's own match first, then any human-involving matches,
// then bot-vs-bot — and attaches that viewer's whole-tournament record.
function decorateStep(roomState, index, forUserId) {
  const t = roomState.tournament;
  if (!t || !t.history[index]) return null;
  const raw = t.history[index];
  const name = (code) => t.slotByCode[code].name;
  const isHuman = (code) => t.slotByCode[code].isHuman;
  const username = (code) => t.slotByCode[code].username || null;
  const myCode = findMyCode(t, forUserId);

  const matches = raw.matches.map((m) => ({
    ...m,
    aName: name(m.aCode),
    bName: name(m.bCode),
    aHuman: isHuman(m.aCode),
    bHuman: isHuman(m.bCode),
    aUsername: username(m.aCode),
    bUsername: username(m.bCode)
  }));

  if (myCode) {
    const priority = (m) => {
      if (m.aCode === myCode || m.bCode === myCode) return 0;
      if (m.aHuman || m.bHuman) return 1;
      return 2;
    };
    matches.sort((a, b) => priority(a) - priority(b));
  }

  const decorated = { index: raw.index, type: raw.type, label: raw.label, matches };

  if (raw.type === 'group') {
    decorated.matchday = raw.matchday;
    if (raw.groupFinal) {
      const groups = {};
      for (const label of Object.keys(t.groups)) {
        groups[label] = rankGroup(t, label).map((row) => ({
          ...row,
          name: name(row.code),
          isHuman: isHuman(row.code),
          username: username(row.code),
          advanced: !t.slotByCode[row.code].eliminated
        }));
      }
      decorated.groupFinal = { groups };
    }
  } else {
    decorated.finishedStage = raw.finishedStage;
    if (raw.champion) {
      decorated.champion = { code: t.champion, ...t.slotByCode[t.champion] };
    }
  }

  if (raw.champion) {
    decorated.myRecord = computeTeamRecord(t, myCode);
    decorated.myMatchAnalyses = computeMyMatchAnalyses(t, myCode);
    decorated.tournamentAwards = computeTournamentAwards(t);
    decorated.tournamentSummary = computeTournamentSummary(t);
    decorated.completedBracket = completedBracket(t);
  }

  return decorated;
}

function historyLength(roomState) {
  const t = roomState.tournament;
  return t ? t.history.length : 0;
}

module.exports = { startTournament, simulateNextStep, decorateStep, historyLength, computeTeamRecord, computeMyMatchAnalyses, computeTournamentAwards, computeTournamentSummary, completedBracket, findMyCode };
