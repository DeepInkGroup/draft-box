const fs = require('fs');
const path = require('path');

const TEAM_NAME_TO_CODE = {
  'Mexico': 'MEX',
  'Usa': 'USA',
  'Canada': 'CAN',
  'Norway': 'NOR',
  'Colombia': 'COL',
  'Japan': 'JPN',
  'Senegal': 'SEN',
  'Uruguay': 'URU',
  'Ecvador': 'ECU',
  'Ecuador': 'ECU',
  'Austrailia': 'AUS',
  'Australia': 'AUS',
  'Cabo Verde': 'CPV',
  'Cape Verde': 'CPV',
  'Sweden': 'SWE',
  'Czechia': 'CZE',
  'Czech Republic': 'CZE',
  'Scotland': 'SCO',
  'New Zealand': 'NZL',
  'South Korea': 'KOR',
  'Jordan': 'JOR',
  'Qatar': 'QAT',
  'Saudi Arabia': 'KSA',
  'Uzbekistan': 'UZB',
  'Algeria': 'ALG',
  'Republic of the Congo': 'COD',
  'DR Congo': 'COD',
  "Côte d'Ivoire": 'CIV',
  'Ivory Coast': 'CIV',
  'Egypt': 'EGY',
  'Ghana': 'GHA',
  'Morocco': 'MAR',
  'South Africa': 'RSA',
  'Tunisia': 'TUN',
  'Curacao': 'CUW',
  'Curaçao': 'CUW',
  'Haiti': 'HAI',
  'Panama': 'PAN',
  'Argentina': 'ARG',
  'Brazil': 'BRA',
  'Paraguay': 'PAR',
  'Austria': 'AUT',
  'Belgium': 'BEL',
  'Bosnia and Herzegovina': 'BIH',
  'Croatia': 'CRO',
  'England': 'ENG',
  'France': 'FRA',
  'Germany': 'GER',
  'Netherland': 'NED',
  'Netherlands': 'NED',
  'Portugal': 'POR',
  'Spain': 'ESP',
  'Switzerland': 'SUI',
  'Turkey': 'TUR',
  'Iran': 'IRN',
  'Iraq': 'IRQ'
};

const TEAM_BASE_OVERRIDES = {
  MEX: 79, KOR: 76, RSA: 68, CZE: 73,
  CAN: 77, SUI: 79, QAT: 69, BIH: 72,
  BRA: 89, MAR: 82, SCO: 75, HAI: 65,
  USA: 80, PAR: 74, AUS: 73, TUR: 78,
  GER: 85, ECU: 78, CIV: 79, CUW: 64,
  NED: 84, JPN: 80, TUN: 75, SWE: 76,
  BEL: 83, IRN: 77, EGY: 78, NZL: 66,
  ESP: 90, URU: 82, KSA: 72, CPV: 67,
  FRA: 90, SEN: 80, NOR: 81, IRQ: 70,
  ARG: 91, ALG: 79, AUT: 78, JOR: 65,
  POR: 87, COL: 82, UZB: 66, COD: 68,
  ENG: 88, CRO: 82, GHA: 76, PAN: 70
};

function mapPositions(rawPositions) {
  const posList = rawPositions.split(',').map(p => p.trim().toUpperCase());
  for (const p of posList) {
    if (p === 'GK') return 'GK';
    if (['CB', 'RB', 'LB', 'DF', 'RWB', 'LWB'].includes(p)) return 'DF';
    if (['CDM', 'CM', 'CAM', 'LM', 'RM', 'MF', 'AM', 'DM'].includes(p)) return 'MF';
    if (['ST', 'LW', 'RW', 'FW', 'CF', 'SS', 'LF', 'RF'].includes(p)) return 'FW';
  }
  return 'MF';
}

function normalizeName(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
}

const txtPath = path.join(__dirname, '..', '..', '..', 'PlayerDatabase.txt');
const txtContent = fs.readFileSync(txtPath, 'utf8');

const lines = txtContent.split(/\r?\n/);
const teamsMap = new Map();

let currentTeamName = null;
let currentPlayers = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const teamMatch = line.match(/^\d+\)\s*(.+?)\s*:$/);
  if (teamMatch) {
    if (currentTeamName && currentPlayers.length > 0) {
      teamsMap.set(currentTeamName, currentPlayers);
    }
    currentTeamName = teamMatch[1].trim();
    currentPlayers = [];
    continue;
  }

  if (/^-{5,}$/.test(line)) continue;

  const playerMatch = line.match(/^\d+-\s*(.+?)\s*\((.+?)\)\s*-\s*(\d+)\s*$/);
  if (playerMatch) {
    const name = playerMatch[1].trim();
    const rawPos = playerMatch[2].trim();
    const overall = parseInt(playerMatch[3], 10);
    const pos = mapPositions(rawPos);
    currentPlayers.push({ name, rawPos, pos, overall });
  }
}

if (currentTeamName && currentPlayers.length > 0) {
  teamsMap.set(currentTeamName, currentPlayers);
}

console.log(`Parsed ${teamsMap.size} teams from PlayerDatabase.txt`);
for (const [name, players] of teamsMap.entries()) {
  console.log(`  ${name}: ${players.length} players`);
}

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

const REQUIRED_ORDER = [
  'MEX', 'KOR', 'RSA', 'CZE',
  'CAN', 'SUI', 'QAT', 'BIH',
  'BRA', 'MAR', 'SCO', 'HAI',
  'USA', 'PAR', 'AUS', 'TUR',
  'GER', 'ECU', 'CIV', 'CUW',
  'NED', 'JPN', 'TUN', 'SWE',
  'BEL', 'IRN', 'EGY', 'NZL',
  'ESP', 'URU', 'KSA', 'CPV',
  'FRA', 'SEN', 'NOR', 'IRQ',
  'ARG', 'ALG', 'AUT', 'JOR',
  'POR', 'COL', 'UZB', 'COD',
  'ENG', 'CRO', 'GHA', 'PAN'
];

const TEAM_CODE_TO_NAME = {
  MEX: 'Mexico', KOR: 'South Korea', RSA: 'South Africa', CZE: 'Czech Republic',
  CAN: 'Canada', SUI: 'Switzerland', QAT: 'Qatar', BIH: 'Bosnia and Herzegovina',
  BRA: 'Brazil', MAR: 'Morocco', SCO: 'Scotland', HAI: 'Haiti',
  USA: 'USA', PAR: 'Paraguay', AUS: 'Australia', TUR: 'Turkey',
  GER: 'Germany', ECU: 'Ecuador', CIV: 'Ivory Coast', CUW: 'Curaçao',
  NED: 'Netherlands', JPN: 'Japan', TUN: 'Tunisia', SWE: 'Sweden',
  BEL: 'Belgium', IRN: 'Iran', EGY: 'Egypt', NZL: 'New Zealand',
  ESP: 'Spain', URU: 'Uruguay', KSA: 'Saudi Arabia', CPV: 'Cape Verde',
  FRA: 'France', SEN: 'Senegal', NOR: 'Norway', IRQ: 'Iraq',
  ARG: 'Argentina', ALG: 'Algeria', AUT: 'Austria', JOR: 'Jordan',
  POR: 'Portugal', COL: 'Colombia', UZB: 'Uzbekistan', COD: 'DR Congo',
  ENG: 'England', CRO: 'Croatia', GHA: 'Ghana', PAN: 'Panama'
};

function buildTeam(code, txtPlayers, teamStars) {
  const starMap = new Map();
  for (const [name, pos, overall] of teamStars) {
    starMap.set(normalizeName(name), { name, pos, overall });
  }

  const players = txtPlayers.map((rp, idx) => {
    const norm = normalizeName(rp.name);
    const starMatch = starMap.get(norm);
    let overall = rp.overall;
    let isStar = false;
    if (starMatch) {
      overall = starMatch.overall;
      isStar = true;
    }
    return {
      id: `${code}-${rp.pos}${idx}`,
      name: rp.name,
      team: code,
      pos: rp.pos,
      rawPos: rp.rawPos,
      overall,
      isStar
    };
  });

  players.sort((a, b) => b.overall - a.overall);

  const top3 = players.slice(0, 3);
  let avgOverall = 0;
  if (players.length > 0) {
    const sum = players.reduce((s, p) => s + p.overall, 0);
    avgOverall = Math.round(sum / players.length);
  }

  const baseOverall = TEAM_BASE_OVERRIDES[code] || avgOverall;

  return {
    id: code,
    name: TEAM_CODE_TO_NAME[code] || code,
    code,
    baseOverall,
    players
  };
}

function buildFallbackTeam(code) {
  console.log(`  !! WARNING: No txt data for ${code} (${TEAM_CODE_TO_NAME[code]}), generating fallback squad`);
  const base = TEAM_BASE_OVERRIDES[code] || 70;
  const positions = ['GK', 'GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW', 'FW', 'FW', 'FW', 'FW'];
  const players = positions.map((pos, idx) => {
    const variance = Math.round((Math.random() - 0.5) * 10);
    return {
      id: `${code}-${pos}${idx}`,
      name: `Player ${idx + 1}`,
      team: code,
      pos,
      overall: base + variance,
      isStar: false
    };
  });
  players.sort((a, b) => b.overall - a.overall);
  return {
    id: code,
    name: TEAM_CODE_TO_NAME[code] || code,
    code,
    baseOverall: base,
    players
  };
}

const finalTeams = [];

for (const code of REQUIRED_ORDER) {
  let matchedTxtTeam = null;
  for (const [txtName, txtPlayers] of teamsMap.entries()) {
    const mappedCode = TEAM_NAME_TO_CODE[txtName] || TEAM_NAME_TO_CODE[txtName.replace(/[^a-zA-Z]/g, '')];
    if (mappedCode === code) {
      matchedTxtTeam = txtPlayers;
      break;
    }
  }

  if (!matchedTxtTeam) {
    for (const [txtName, txtPlayers] of teamsMap.entries()) {
      const normTxt = normalizeName(txtName);
      const normOfficial = normalizeName(TEAM_CODE_TO_NAME[code] || code);
      if (normTxt === normOfficial || normTxt.includes(normOfficial) || normOfficial.includes(normTxt)) {
        matchedTxtTeam = txtPlayers;
        break;
      }
    }
  }

  const teamStars = STARS[code] || [];
  if (matchedTxtTeam) {
    finalTeams.push(buildTeam(code, matchedTxtTeam, teamStars));
  } else {
    finalTeams.push(buildFallbackTeam(code));
  }
}

const outPath = path.join(__dirname, 'teams2026.json');
fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), teams: finalTeams }, null, 2));

let totalPlayers = 0;
for (const t of finalTeams) totalPlayers += t.players.length;
console.log(`\nWrote ${finalTeams.length} teams (${totalPlayers} players) to ${outPath}`);
console.log('\nTop-rated players per team:');
for (const t of finalTeams) {
  const top = t.players[0];
  console.log(`  ${t.code} (${t.name}): base=${t.baseOverall}, top=${top.name} (${top.pos}) OVR=${top.overall}`);
}
