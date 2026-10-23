const { getLeague } = require('../data/competitions');

function ensureCoachMarket(t) {
  t.initialHeadCoaches ||= Object.fromEntries(Object.values(t.slotByCode).map(team => [team.code, structuredClone(team.headCoach || null)]));
  const employed = new Set(Object.values(t.slotByCode).map(team => team.headCoach?.id));
  t.freeAgentCoaches ||= structuredClone(getLeague(t.leagueId)?.freeAgentCoaches || []).filter(coach => !employed.has(coach.id));
  t.initialFreeAgentCoaches ||= structuredClone(t.freeAgentCoaches);
  t.coachChanges ||= []; t.coachReviews ||= [];
}

// Two scheduled reviews prevent repeated sackings after every unlucky match.
// Human managers and clubs outside the bottom third keep their head coaches.
function reviewAiCoaches(t, table, random = Math.random) {
  if (t.leagueId !== 'pgl' || ![Math.floor(t.fixtures.length / 2), t.fixtures.length].includes(t.matchday)) return;
  ensureCoachMarket(t);
  if (t.coachReviews.includes(t.matchday)) return;
  t.coachReviews.push(t.matchday);
  const changedClubs = new Set(t.coachChanges.map(change => change.clubCode));
  const dismissed = new Set(t.coachChanges.map(change => change.from?.id));
  const employed = new Set(Object.values(t.slotByCode).map(team => team.headCoach?.id));
  const available = t.freeAgentCoaches.filter(coach => !employed.has(coach.id) && !dismissed.has(coach.id));
  const candidates = table.filter(row => !t.slotByCode[row.code].isHuman && !changedClubs.has(row.code)
    && row.rank > Math.floor(table.length * 2 / 3) && row.played > 0 && row.pts / row.played < 1.15).reverse();
  for (const row of candidates.slice(0, 2)) {
    if (!available.length) break;
    const incoming = available.splice(Math.floor(random() * available.length), 1)[0];
    const team = t.slotByCode[row.code], outgoing = team.headCoach;
    team.headCoach = structuredClone(incoming);
    t.freeAgentCoaches = t.freeAgentCoaches.filter(coach => coach.id !== incoming.id);
    if (outgoing && !t.freeAgentCoaches.some(coach => coach.id === outgoing.id)) t.freeAgentCoaches.push(structuredClone(outgoing));
    t.coachChanges.push({ matchday: t.matchday, clubCode: row.code, clubName: team.name,
      from: structuredClone(outgoing || null), to: structuredClone(incoming), rank: row.rank,
      points: row.pts, played: row.played, reason: 'Poor league results' });
  }
}

function coachSnapshot(t, throughMatchday = t.matchday) {
  const changes = (t.coachChanges || []).filter(change => change.matchday <= throughMatchday);
  const headCoaches = structuredClone(t.initialHeadCoaches || Object.fromEntries(Object.values(t.slotByCode).map(team => [team.code, team.headCoach])));
  let freeAgentCoaches = structuredClone(t.initialFreeAgentCoaches || getLeague(t.leagueId)?.freeAgentCoaches || []);
  for (const change of changes) {
    headCoaches[change.clubCode] = structuredClone(change.to);
    freeAgentCoaches = freeAgentCoaches.filter(coach => coach.id !== change.to.id);
    if (change.from && !freeAgentCoaches.some(coach => coach.id === change.from.id)) freeAgentCoaches.push(structuredClone(change.from));
  }
  return { headCoaches, freeAgentCoaches, coachChanges: structuredClone(changes) };
}
module.exports = { ensureCoachMarket, reviewAiCoaches, coachSnapshot };
