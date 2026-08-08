const { ALL_TEAMS, getTeam } = require('../data/teams');
const { bestXI, teamStrength } = require('./botEngine');
const { simulateMatch } = require('./matchSim');
const { FORMATIONS } = require('./formations');

const FORMATION_NAMES = Object.keys(FORMATIONS);
function randomFormation() {
  return FORMATION_NAMES[Math.floor(Math.random() * FORMATION_NAMES.length)];
}

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

function startTournament(roomState) {
  const members = Array.from(roomState.members.values());
  const humanCount = members.length;
  if (humanCount > 32) throw new Error('at most 32 human-controlled slots are allowed');

  const shuffledCodes = shuffle(ALL_TEAMS.map((t) => t.code));
  const humanCodes = shuffledCodes.slice(0, humanCount);
  const botCodes = shuffledCodes.slice(humanCount);

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
      strength: avg(member.squad.map((p) => p.overall)),
      eliminated: false
    });
  });
  botCodes.forEach((code) => {
    const team = getTeam(code);
    const botFormation = randomFormation();
    const xi = bestXI(team, botFormation);
    slots.push({ code, name: team.name, isHuman: false, userId: null, xi, formation: botFormation, strength: teamStrength(xi), eliminated: false });
  });

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
}

function rankGroup(t, label) {
  const codes = t.groups[label];
  return codes
    .map((code) => ({ code, ...t.standings[code] }))
    .sort((x, y) => (y.pts - x.pts) || ((y.gf - y.ga) - (x.gf - x.ga)) || (y.gf - x.gf) || (Math.random() - 0.5));
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
  for (const label of Object.keys(t.groups)) {
    const ranked = rankGroup(t, label);
    top2.push(ranked[0], ranked[1]);
    thirds.push(ranked[2]);
    for (const s of ranked.slice(2)) markEliminated(roomState, s.code);
  }
  thirds.sort((x, y) => (y.pts - x.pts) || ((y.gf - y.ga) - (x.gf - x.ga)) || (y.gf - x.gf) || (Math.random() - 0.5));
  const best8 = thirds.slice(0, 8);
  for (const s of thirds.slice(8)) markEliminated(roomState, s.code);

  const advancing = shuffle([...top2, ...best8].map((s) => s.code));
  const matches = [];
  for (let i = 0; i < advancing.length; i += 2) {
    matches.push({ aCode: advancing[i], bCode: advancing[i + 1], result: null, winnerCode: null });
  }
  t.bracket = { r32: matches };
  t.stage = 'r32';
}

function playKnockoutRound(roomState) {
  const t = roomState.tournament;
  const matches = t.bracket[t.stage];
  const winners = [];
  for (const m of matches) {
    const a = t.slotByCode[m.aCode];
    const b = t.slotByCode[m.bCode];
    const sim = simulateMatch(a, b, { knockout: true });
    m.result = sim;
    m.winnerCode = sim.goalsA > sim.goalsB || (sim.wentToPenalties && sim.penaltyWinner === 'A') ? a.code : b.code;
    const loserCode = m.winnerCode === a.code ? b.code : a.code;
    markEliminated(roomState, loserCode);
    winners.push(m.winnerCode);
    t.matchLog.push({ stage: t.stage, aCode: a.code, bCode: b.code, ...sim, winnerCode: m.winnerCode });
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
      const sim = simulateMatch(a, b, { knockout: false });
      applyGroupResult(t, fx.aCode, fx.bCode, sim);
      const entry = { stage: 'group', group: fx.group, aCode: fx.aCode, bCode: fx.bCode, ...sim };
      t.matchLog.push(entry);
      return entry;
    });
    t.groupMatchdaysPlayed += 1;
    const matchday = t.groupMatchdaysPlayed;
    const groupFinal = matchday === 3;
    if (groupFinal) finalizeGroupsAndSeedR32(roomState);

    const step = {
      index: t.history.length,
      type: 'group',
      label: `Group Stage — Matchday ${matchday}`,
      matchday,
      matches: rawMatches,
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
    champion: t.stage === 'done'
  };
  t.history.push(step);
  return step;
}

// Turns a raw history[] record into everything a client needs to render that one step:
// team names, human/username tags, winner highlighting, and (only when relevant) the
// final group standings or the champion banner.
function decorateStep(roomState, index) {
  const t = roomState.tournament;
  if (!t || !t.history[index]) return null;
  const raw = t.history[index];
  const name = (code) => t.slotByCode[code].name;
  const isHuman = (code) => t.slotByCode[code].isHuman;
  const username = (code) => t.slotByCode[code].username || null;

  const matches = raw.matches.map((m) => ({
    ...m,
    aName: name(m.aCode),
    bName: name(m.bCode),
    aHuman: isHuman(m.aCode),
    bHuman: isHuman(m.bCode),
    aUsername: username(m.aCode),
    bUsername: username(m.bCode)
  }));

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

  return decorated;
}

function historyLength(roomState) {
  const t = roomState.tournament;
  return t ? t.history.length : 0;
}

module.exports = { startTournament, simulateNextStep, decorateStep, historyLength };
