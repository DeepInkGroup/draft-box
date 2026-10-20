const { getLeague, teamsForRoom, ratedPlayer } = require('../data/competitions');
const { bestBotSetup, teamStrength, prepareBotForMatch } = require('./botEngine');
const { simulateMatch } = require('./matchSim');
const { normalizeStyle } = require('./tacticalStyles');
const { ensureTransferWindow, transfersPending } = require('./leagueTransfers');
const { transferSettings } = require('./leagueSettings');
const { recoverCohesion } = require('./leagueCohesion');
const { ensureTacticWindow, tacticsPending } = require('./leagueMidseason');
const { ensureFormationWindow, formationsPending } = require('./leagueFormation');
const { runAiTransfers, ensureClubRosters } = require('./leagueAiTransfers');

function createFixtures(codes) {
  if (codes.length < 2 || new Set(codes).size !== codes.length) throw new Error('a league needs distinct clubs');
  const rotation = codes.slice();
  if (rotation.length % 2) rotation.push(null);
  const firstLeg = [];
  for (let round = 0; round < rotation.length - 1; round++) {
    const matches = [];
    for (let i = 0; i < rotation.length / 2; i++) {
      let aCode = rotation[i];
      let bCode = rotation[rotation.length - 1 - i];
      if (!aCode || !bCode) continue;
      if ((round + i) % 2) [aCode, bCode] = [bCode, aCode];
      matches.push({ aCode, bCode });
    }
    firstLeg.push(matches);
    rotation.splice(1, 0, rotation.pop());
  }
  return firstLeg.concat(firstLeg.map((matches) => matches.map(({ aCode, bCode }) => ({ aCode: bCode, bCode: aCode }))));
}

function rankTable(t) {
  return Object.entries(t.standings).map(([code, row]) => ({ code, ...row }))
    .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || t.slotByCode[a.code].name.localeCompare(t.slotByCode[b.code].name))
    .map((row, index) => ({ ...row, rank: index + 1, gd: row.gf - row.ga, name: t.slotByCode[row.code].name, isHuman: t.slotByCode[row.code].isHuman, username: t.slotByCode[row.code].username || null }));
}

function startLeague(roomState) {
  const league = getLeague(roomState.leagueId);
  if (!league) throw new Error('league is not available');
  const humans = new Map();
  for (const member of roomState.members.values()) {
    if (!league.teams.some((club) => club.code === member.clubCode) || humans.has(member.clubCode)) throw new Error('each player must represent a different league club');
    if (member.squad.length !== 11 || !member.tacticalStyleLocked) throw new Error('finish drafting and lock your tactics first');
    humans.set(member.clubCode, member);
  }
  const slotByCode = {};
  const standings = {};
  for (const club of teamsForRoom(roomState)) {
    const member = humans.get(club.code);
    const setup = member ? {
      xi: member.squad.map((player) => ({ ...ratedPlayer(player,roomState), isCaptain: !!member.captainSlot && player.slotCode === member.captainSlot })),
      formation: member.formation, tacticalStyle: normalizeStyle(member.tacticalStyle)
    } : bestBotSetup(club);
    slotByCode[club.code] = {
      code: club.code, name: club.name, headCoach: club.headCoach, isHuman: !!member, userId: member?.userId || null, username: member?.username || null,
      ...setup, customTactic: member?.customTactic || null, strength: teamStrength(setup.xi), eliminated: false, morale: 0
    };
    standings[club.code] = { played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  }
  roomState.tournament = {
    kind: 'league', resultsOnly: !!roomState.resultsOnly, pglRatingBoost: !!roomState.pglRatingBoost, leagueId: league.id, leagueName: league.name, stage: 'league', slotByCode, standings,
    transferSettings: transferSettings(roomState.transferEnabled, roomState.transferLimit),
    midseasonTactics: !!roomState.midseasonTactics, aiTransfers: !!roomState.aiTransfers,
    endseasonTactics: !!roomState.endseasonTactics, midseasonFormations: !!roomState.midseasonFormations,
    endTransferSettings: transferSettings(roomState.endTransferEnabled ?? false, roomState.endTransferLimit ?? 2), endAiTransfers: !!roomState.endAiTransfers,
    managerOffers: !!roomState.managerOffers, playerDepartures: !!roomState.playerDepartures,
    seasonNumber: roomState.seasonNumber || 1, transferLog: [],
    fixtures: createFixtures(league.teams.map((club) => club.code)), matchday: 0,
    matchLog: [], history: [], champion: null, bracket: {}
  };
  roomState.tournament.initialTable = rankTable(roomState.tournament);
  ensureClubRosters(roomState.tournament);
  roomState.tournament.initialClubRosters = structuredClone(roomState.tournament.clubRosters);
  roomState.tournament.initialXIs = Object.fromEntries(Object.values(slotByCode).map(team => [team.code, structuredClone(team.xi)]));
  roomState.tournament.initialFormations = Object.fromEntries(Object.values(slotByCode).map(team => [team.code, team.formation]));
  roomState.tournament.initialTactics = Object.fromEntries(Object.values(slotByCode).map(team => [team.code, team.tacticalStyle]));
  return roomState.tournament;
}

function simulateLeagueStep(roomState, applyResult) {
  const t = roomState.tournament;
  if (!t || t.stage === 'done') return null;
  if (tacticsPending(t)) throw new Error(`Choose or keep your ${t.matchday === 0 ? 'end-of-season' : 'mid-season'} tactic before the next matchday`);
  if (formationsPending(t)) throw new Error('Choose or keep your mid-season formation before the next matchday');
  if (transfersPending(t)) throw new Error(`complete or skip the ${t.matchday === 0 ? 'end-of-season' : 'mid-season'} transfer window before the next matchday`);
  const matches = [];
  for (const fixture of t.fixtures[t.matchday]) {
    const a = t.slotByCode[fixture.aCode];
    const b = t.slotByCode[fixture.bCode];
    prepareBotForMatch(a, b);
    prepareBotForMatch(b, a);
    const moraleA = a.morale;
    const moraleB = b.morale;
    const result = simulateMatch(a, b, { knockout: false, stage: 'league' });
    const match = { ...fixture, ...result, stage: 'league', matchday: t.matchday + 1, moraleA, moraleB,
      lineups: { A: a.xi.map((player) => ({ ...player })), B: b.xi.map((player) => ({ ...player })) } };
    if (result.goalsA !== result.goalsB) match.winnerCode = result.goalsA > result.goalsB ? a.code : b.code;
    applyResult(t, a.code, b.code, result);
    recoverCohesion(a);
    recoverCohesion(b);
    t.matchLog.push(match);
    matches.push(match);
  }
  t.matchday++;
  ensureTacticWindow(t);
  ensureFormationWindow(t);
  runAiTransfers(t);
  ensureTransferWindow(t);
  const table = rankTable(t);
  if (t.matchday === t.fixtures.length) {
    t.stage = 'done';
    t.champion = table[0].code;
  }
  const step = {
    index: t.history.length, type: 'league', label: `${t.leagueName} — Matchday ${t.matchday} of ${t.fixtures.length}`,
    matchday: t.matchday, totalMatchdays: t.fixtures.length, matches, leagueTable: table, champion: t.stage === 'done'
  };
  t.history.push(step);
  return step;
}

function leagueSnapshot(t, viewedStep = 0) {
  if (t.kind !== 'league') return null;
  const table = viewedStep > 0 ? t.history[viewedStep - 1]?.leagueTable : t.initialTable;
  return { freeAgentCoaches: getLeague(t.leagueId)?.freeAgentCoaches || [], seasonDepartures: t.seasonDepartures || [], managerChanges: t.managerChanges || [], name: t.leagueName, resultsOnly: !!t.resultsOnly, pglRatingBoost: !!t.pglRatingBoost, seasonNumber: t.seasonNumber || 1, previousSeasons: t.previousSeasons || [], matchday: viewedStep, totalMatchdays: t.fixtures.length, table: table || [],
    nextFixtures: (t.fixtures[viewedStep] || []).map((fixture) => {
      const a = t.slotByCode[fixture.aCode], b = t.slotByCode[fixture.bCode];
      return { ...fixture, aName: a.name, bName: b.name, aHuman: a.isHuman, bHuman: b.isHuman, aUsername: a.username, bUsername: b.username };
    }) };
}
module.exports = { createFixtures, rankTable, startLeague, simulateLeagueStep, leagueSnapshot };
