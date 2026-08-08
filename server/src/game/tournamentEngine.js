const { ALL_TEAMS, getTeam } = require('../data/teams');
const { bestXI, teamStrength } = require('./botEngine');
const { simulateMatch } = require('./matchSim');

const GROUP_LABELS = 'ABCDEFGHIJKL'.split('');

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
    slots.push({
      code,
      name: getTeam(code).name,
      isHuman: true,
      userId: member.userId,
      username: member.username,
      xi: member.squad,
      strength: avg(member.squad.map((p) => p.overall)),
      eliminated: false
    });
  });
  botCodes.forEach((code) => {
    const team = getTeam(code);
    const xi = bestXI(team);
    slots.push({ code, name: team.name, isHuman: false, userId: null, xi, strength: teamStrength(xi), eliminated: false });
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

function markEliminated(roomState, code) {
  const t = roomState.tournament;
  const slot = t.slotByCode[code];
  if (!slot || !slot.isHuman) return;
  slot.eliminated = true;
  const member = roomState.members.get(slot.userId);
  if (member) member.eliminated = true;
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

function simulateNextStep(roomState) {
  const t = roomState.tournament;
  if (!t || t.stage === 'done') return { type: 'done', champion: t ? t.champion : null };

  if (t.stage === 'group') {
    const mdIdx = t.groupMatchdaysPlayed;
    const md = t.fixtures[mdIdx];
    const results = md.map((fx) => {
      const a = t.slotByCode[fx.aCode];
      const b = t.slotByCode[fx.bCode];
      const sim = simulateMatch(a, b, { knockout: false });
      applyGroupResult(t, fx.aCode, fx.bCode, sim);
      const entry = { stage: 'group', group: fx.group, aCode: fx.aCode, bCode: fx.bCode, ...sim };
      t.matchLog.push(entry);
      return entry;
    });
    t.groupMatchdaysPlayed += 1;
    if (t.groupMatchdaysPlayed === 3) finalizeGroupsAndSeedR32(roomState);
    return { type: 'group', matchday: t.groupMatchdaysPlayed, matches: results, stage: t.stage };
  }

  const { finishedStage, matches } = playKnockoutRound(roomState);
  return { type: 'knockout', finishedStage, matches, stage: t.stage, champion: t.champion };
}

function getPublicState(roomState) {
  const t = roomState.tournament;
  if (!t) return null;
  const groups = {};
  for (const label of Object.keys(t.groups)) {
    groups[label] = rankGroup(t, label).map((row) => ({
      ...row,
      name: t.slotByCode[row.code].name,
      isHuman: t.slotByCode[row.code].isHuman,
      username: t.slotByCode[row.code].username || null,
      eliminated: t.slotByCode[row.code].eliminated
    }));
  }
  const decorate = (m) => m && {
    ...m,
    aName: t.slotByCode[m.aCode].name,
    bName: t.slotByCode[m.bCode].name,
    aHuman: t.slotByCode[m.aCode].isHuman,
    bHuman: t.slotByCode[m.bCode].isHuman
  };
  const bracket = {};
  for (const [round, matches] of Object.entries(t.bracket)) {
    bracket[round] = matches.map(decorate);
  }
  return {
    stage: t.stage,
    groupMatchdaysPlayed: t.groupMatchdaysPlayed,
    groups,
    bracket,
    champion: t.champion ? { code: t.champion, ...t.slotByCode[t.champion] } : null,
    recentMatches: t.matchLog.slice(-24)
  };
}

module.exports = { startTournament, simulateNextStep, getPublicState };
