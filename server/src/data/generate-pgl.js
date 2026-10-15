const fs = require('node:fs');
const path = require('node:path');

const GROUPS = { GK: 'GK', CB: 'DF', LB: 'DF', RB: 'DF', LWB: 'DF', RWB: 'DF', CDM: 'MF', CM: 'MF', CAM: 'MF', LM: 'MF', RM: 'MF', LW: 'FW', RW: 'FW', ST: 'FW', CF: 'FW', SS: 'FW' };
const slug = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function parseCoaches(text, teams) {
  const sections = new Map();
  let names;
  for (const [index, raw] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || /^-+$/.test(line)) continue;
    const header = line.match(/^\d+\)\s*(.+):$/);
    if (header) {
      const name = header[1].trim();
      if (sections.has(name)) throw new Error(`Duplicate coach section: ${name}`);
      names = []; sections.set(name, names);
      continue;
    }
    const coach = line.match(/^\d+-\s*(.+)$/);
    if (!names || !coach) throw new Error(`Invalid coach entry on line ${index + 1}: ${line}`);
    names.push({ id: `pgl-coach-${slug(coach[1])}`, name: coach[1].trim() });
  }
  const expected = new Set([...teams.map(team => team.name), 'Free Agents']);
  for (const name of sections.keys()) if (!expected.has(name)) throw new Error(`Unknown coach club: ${name}`);
  for (const team of teams) {
    if (sections.get(team.name)?.length !== 1) throw new Error(`Expected one head coach for ${team.name}`);
  }
  if (!sections.get('Free Agents')?.length) throw new Error('Missing free-agent coaches');
  const coaches = [...sections.values()].flat();
  if (new Set(coaches.map(coach => coach.id)).size !== coaches.length) throw new Error('Duplicate coach identifiers');
  return sections;
}

function parsePgl(text, coachText) {
  const teams = [];
  let team;
  for (const [index, raw] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || /^-+$/.test(line)) continue;
    const header = line.match(/^\d+\)\s*(.+):$/);
    if (header) {
      const name = header[1].trim();
      team = { id: `pgl-${slug(name)}`, code: `PGL-${slug(name).toUpperCase()}`, name, players: [] };
      teams.push(team);
      continue;
    }
    const player = line.match(/^(\d+)-\s*(.+?)\s*\(([^)]+)\)\s*-\s*(\d+)\s*(?:-\s*(\*))?$/);
    if (!team || !player) throw new Error(`Invalid PGL entry on line ${index + 1}: ${line}`);
    const [, number, name, rawPos, rating, star] = player;
    const positions = rawPos.split(',').map((position) => position.trim().toUpperCase());
    if (positions.some((position) => !GROUPS[position])) throw new Error(`Unknown PGL position on line ${index + 1}`);
    const overall = Number(rating);
    if (overall < 1 || overall > 99) throw new Error(`Invalid rating on line ${index + 1}`);
    team.players.push({ id: `${team.id}-${number}`, name: name.trim(), team: team.code, pos: GROUPS[positions[0]], rawPos: positions.join(', '), overall, isStar: !!star });
  }
  const ids = teams.flatMap((entry) => entry.players.map((player) => player.id));
  if (new Set(teams.map((entry) => entry.code)).size !== teams.length || new Set(ids).size !== ids.length) throw new Error('Duplicate PGL team or player identifiers');
  if (teams.length < 2 || teams.some((entry) => entry.players.length < 11 || !entry.players.some((player) => player.pos === 'GK'))) throw new Error('PGL needs at least two clubs with playable squads');
  for (const entry of teams) entry.baseOverall = Math.round(entry.players.reduce((sum, player) => sum + player.overall, 0) / entry.players.length);
  const league = { id: 'pgl', name: 'Persian Gulf League', country: 'Iran', teams };
  if (coachText !== undefined) {
    const coaches = parseCoaches(coachText, teams);
    for (const club of teams) {
      club.headCoach = coaches.get(club.name)[0];
      club.logo = `assets/clubs/pgl/${slug(club.name)}.png`;
    }
    league.freeAgentCoaches = coaches.get('Free Agents');
  }
  return league;
}

if (require.main === module) {
  const source = path.join(__dirname, '..', '..', '..', 'PGL-Players.txt');
  const league = parsePgl(fs.readFileSync(source, 'utf8'), fs.readFileSync(path.join(path.dirname(source), 'PGL-Coaches.txt'), 'utf8'));
  fs.writeFileSync(path.join(__dirname, 'pgl.json'), JSON.stringify(league, null, 2) + '\n');
  console.log(`PGL: ${league.teams.length} clubs, ${league.teams.reduce((sum, team) => sum + team.players.length, 0)} players`);
}
module.exports = { parsePgl, parseCoaches };
