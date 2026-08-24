/**
 * Generates data/teams2026.json — the 48-nation player pool for the World Cup mode.
 *
 * Data note: every player is a real member of that nation's actual 2026 World Cup
 * squad (26 players each, sourced from Wikipedia's "2026 FIFA World Cup squads"
 * article, itself drawn from FIFA's officially published squad lists). No fictional
 * or generated players are ever added — a team with fewer real players in a given
 * position group than a demanding formation calls for simply won't be revealed to a
 * drafter who still needs that position (see draftEngine.revealForMember), and bots
 * fall back to reusing their weakest already-selected player rather than inventing
 * one (see botEngine.bestXI). Overall ratings are NOT official — they're generated
 * for gameplay, since no public, licensed rating dataset exists for these squads. A
 * handful of well-known stars per major team get a hand-set overall instead of the
 * generated one.
 */
const fs = require('fs');
const path = require('path');

const REAL_SQUADS = JSON.parse(fs.readFileSync(path.join(__dirname, 'wc2026_real_squads.json'), 'utf8'));

// 48 qualified nations (2026 World Cup), grouped by their real draw groups (A-L).
// baseOverall = rough fictional team-strength tier for gameplay purposes only.
const TEAMS = [
  { name: 'Mexico', code: 'MEX', region: 'concacaf', base: 79 },
  { name: 'South Korea', code: 'KOR', region: 'eastasia', base: 76 },
  { name: 'South Africa', code: 'RSA', region: 'african', base: 68 },
  { name: 'Czech Republic', code: 'CZE', region: 'balkan', base: 73 },

  { name: 'Canada', code: 'CAN', region: 'concacaf', base: 77 },
  { name: 'Switzerland', code: 'SUI', region: 'german', base: 79 },
  { name: 'Qatar', code: 'QAT', region: 'arab', base: 69 },
  { name: 'Bosnia and Herzegovina', code: 'BIH', region: 'balkan', base: 72 },

  { name: 'Brazil', code: 'BRA', region: 'brazil', base: 89 },
  { name: 'Morocco', code: 'MAR', region: 'arab', base: 82 },
  { name: 'Scotland', code: 'SCO', region: 'english', base: 75 },
  { name: 'Haiti', code: 'HAI', region: 'concacaf', base: 65 },

  { name: 'USA', code: 'USA', region: 'concacaf', base: 80 },
  { name: 'Paraguay', code: 'PAR', region: 'latam', base: 74 },
  { name: 'Australia', code: 'AUS', region: 'oceania', base: 73 },
  { name: 'Turkey', code: 'TUR', region: 'turkic', base: 78 },

  { name: 'Germany', code: 'GER', region: 'german', base: 85 },
  { name: 'Ecuador', code: 'ECU', region: 'latam', base: 78 },
  { name: 'Ivory Coast', code: 'CIV', region: 'african', base: 79 },
  { name: 'Curaçao', code: 'CUW', region: 'concacaf', base: 64 },

  { name: 'Netherlands', code: 'NED', region: 'dutch', base: 84 },
  { name: 'Japan', code: 'JPN', region: 'eastasia', base: 80 },
  { name: 'Tunisia', code: 'TUN', region: 'arab', base: 75 },
  { name: 'Sweden', code: 'SWE', region: 'scandi', base: 76 },

  { name: 'Belgium', code: 'BEL', region: 'dutch', base: 83 },
  { name: 'Iran', code: 'IRN', region: 'persian', base: 77 },
  { name: 'Egypt', code: 'EGY', region: 'arab', base: 78 },
  { name: 'New Zealand', code: 'NZL', region: 'oceania', base: 66 },

  { name: 'Spain', code: 'ESP', region: 'iberian', base: 90 },
  { name: 'Uruguay', code: 'URU', region: 'latam', base: 82 },
  { name: 'Saudi Arabia', code: 'KSA', region: 'arab', base: 72 },
  { name: 'Cape Verde', code: 'CPV', region: 'african', base: 67 },

  { name: 'France', code: 'FRA', region: 'french', base: 90 },
  { name: 'Senegal', code: 'SEN', region: 'african', base: 80 },
  { name: 'Norway', code: 'NOR', region: 'scandi', base: 81 },
  { name: 'Iraq', code: 'IRQ', region: 'arab', base: 70 },

  { name: 'Argentina', code: 'ARG', region: 'latam', base: 91 },
  { name: 'Algeria', code: 'ALG', region: 'arab', base: 79 },
  { name: 'Austria', code: 'AUT', region: 'german', base: 78 },
  { name: 'Jordan', code: 'JOR', region: 'arab', base: 65 },

  { name: 'Portugal', code: 'POR', region: 'iberian', base: 87 },
  { name: 'Colombia', code: 'COL', region: 'latam', base: 82 },
  { name: 'Uzbekistan', code: 'UZB', region: 'centralasia', base: 66 },
  { name: 'DR Congo', code: 'COD', region: 'african', base: 68 },

  { name: 'England', code: 'ENG', region: 'english', base: 88 },
  { name: 'Croatia', code: 'CRO', region: 'balkan', base: 82 },
  { name: 'Ghana', code: 'GHA', region: 'african', base: 76 },
  { name: 'Panama', code: 'PAN', region: 'concacaf', base: 70 }
];

// A handful of well-known real players seeded onto their national teams for flavor.
// Not an exhaustive or official roster — see RULES.md.
const STARS = {
  BRA: [['Vinícius Júnior', 'FW', 92], ['Endrick', 'FW', 84], ['Alisson', 'GK', 89]],
  FRA: [['Kylian Mbappé', 'FW', 94], ['Ousmane Dembélé', 'FW', 89], ['Aurélien Tchouaméni', 'MF', 87], ['Mike Maignan', 'GK', 88]],
  ARG: [],
  ENG: [['Jude Bellingham', 'MF', 91], ['Bukayo Saka', 'FW', 89], ['Jordan Pickford', 'GK', 85]],
  ESP: [['Lamine Yamal', 'FW', 91], ['Pedri', 'MF', 89], ['Rodri', 'MF', 90], ['Unai Simón', 'GK', 85]],
  POR: [['Cristiano Ronaldo', 'FW', 86], ['Bruno Fernandes', 'MF', 88], ['Rúben Dias', 'DF', 88], ['Diogo Costa', 'GK', 87]],
  GER: [['Jamal Musiala', 'MF', 90], ['Florian Wirtz', 'MF', 89], ['Kai Havertz', 'FW', 85], ['Manuel Neuer', 'GK', 84]],
  NED: [['Cody Gakpo', 'FW', 85], ['Virgil van Dijk', 'DF', 88], ['Bart Verbruggen', 'GK', 82]],
  BEL: [['Kevin De Bruyne', 'MF', 89], ['Romelu Lukaku', 'FW', 84], ['Jérémy Doku', 'FW', 86]],
  CRO: [['Luka Modrić', 'MF', 86], ['Joško Gvardiol', 'DF', 87]],
  URU: [['Darwin Núñez', 'FW', 85], ['Federico Valverde', 'MF', 88], ['Ronald Araújo', 'DF', 86]],
  COL: [['James Rodríguez', 'MF', 83], ['Luis Díaz', 'FW', 87]],
  MAR: [['Achraf Hakimi', 'DF', 88]],
  USA: [['Christian Pulisic', 'FW', 86], ['Weston McKennie', 'MF', 82]],
  NOR: [['Erling Haaland', 'FW', 93], ['Martin Ødegaard', 'MF', 88]],
  SUI: [['Granit Xhaka', 'MF', 84], ['Manuel Akanji', 'DF', 84]],
  MEX: [['Santiago Giménez', 'FW', 83], ['Edson Álvarez', 'MF', 82]],
  JPN: [['Takefusa Kubo', 'FW', 85]],
  SEN: [['Sadio Mané', 'FW', 85], ['Kalidou Koulibaly', 'DF', 83]],
  ECU: [['Moisés Caicedo', 'MF', 86], ['Piero Hincapié', 'DF', 82]],
  CAN: [['Alphonso Davies', 'DF', 87], ['Jonathan David', 'FW', 84]],
  GHA: [['Thomas Partey', 'MF', 81]],
  EGY: [['Mohamed Salah', 'FW', 89]],
  ALG: [['Riyad Mahrez', 'FW', 82]],
  IRN: [['Mehdi Taremi', 'FW', 83]],
  KSA: [['Salem Al-Dawsari', 'FW', 78]],
  QAT: [['Akram Afif', 'FW', 79]]
};

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function genOverall(team, pos) {
  const posAdjust = { GK: -1, DF: -2, MF: 0, FW: 1 }[pos];
  const variance = Math.round((Math.random() - 0.5) * 10);
  return clamp(team.base + posAdjust + variance - 3, 52, 90);
}

function buildTeam(team) {
  const realSquad = REAL_SQUADS[team.name] || [];
  const starOverallByName = new Map((STARS[team.code] || []).map(([name, , overall]) => [name, overall]));

  const players = realSquad.map((rp, idx) => {
    const isStar = starOverallByName.has(rp.name);
    return {
      id: `${team.code}-${rp.pos}${idx}`,
      name: rp.name,
      team: team.code,
      pos: rp.pos,
      rawPos: rp.rawPos,
      overall: isStar ? starOverallByName.get(rp.name) : genOverall(team, rp.pos),
      isStar
    };
  });

  players.sort((a, b) => b.overall - a.overall);

  return {
    id: team.code,
    name: team.name,
    code: team.code,
    baseOverall: team.base,
    players
  };
}

const teams = TEAMS.map(buildTeam);

const outPath = path.join(__dirname, 'teams2026.json');
fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), teams }, null, 2));
console.log(`Wrote ${teams.length} teams (${teams.reduce((s, t) => s + t.players.length, 0)} players) to ${outPath}`);
