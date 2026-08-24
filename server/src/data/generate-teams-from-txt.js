const fs = require('fs');
const path = require('path');

const TEAM_NAME_TO_CODE = {
  mexico: 'MEX', usa: 'USA', canada: 'CAN', norway: 'NOR', colombia: 'COL', japan: 'JPN',
  senegal: 'SEN', uruguay: 'URU', ecvador: 'ECU', ecuador: 'ECU', austrailia: 'AUS', australia: 'AUS',
  caboverde: 'CPV', capeverde: 'CPV', sweden: 'SWE', czechia: 'CZE', czechrepublic: 'CZE',
  scotland: 'SCO', newzealand: 'NZL', southkorea: 'KOR', jordan: 'JOR', qatar: 'QAT',
  saudiarabia: 'KSA', uzbekistan: 'UZB', algeria: 'ALG', republicofthecongo: 'COD', drcongo: 'COD',
  cotedivoire: 'CIV', ivorycoast: 'CIV', egypt: 'EGY', ghana: 'GHA', morocco: 'MAR', southafrica: 'RSA',
  tunisia: 'TUN', curacao: 'CUW', haiti: 'HAI', panama: 'PAN', argentina: 'ARG', brazil: 'BRA',
  paraguay: 'PAR', austria: 'AUT', belgium: 'BEL', bosniaandherzegovina: 'BIH', croatia: 'CRO',
  england: 'ENG', france: 'FRA', germany: 'GER', netherland: 'NED', netherlands: 'NED', portugal: 'POR',
  spain: 'ESP', switzerland: 'SUI', turkey: 'TUR', iran: 'IRN', iraq: 'IRQ'
};

const REQUIRED_ORDER = [
  'MEX', 'KOR', 'RSA', 'CZE', 'CAN', 'SUI', 'QAT', 'BIH',
  'BRA', 'MAR', 'SCO', 'HAI', 'USA', 'PAR', 'AUS', 'TUR',
  'GER', 'ECU', 'CIV', 'CUW', 'NED', 'JPN', 'TUN', 'SWE',
  'BEL', 'IRN', 'EGY', 'NZL', 'ESP', 'URU', 'KSA', 'CPV',
  'FRA', 'SEN', 'NOR', 'IRQ', 'ARG', 'ALG', 'AUT', 'JOR',
  'POR', 'COL', 'UZB', 'COD', 'ENG', 'CRO', 'GHA', 'PAN'
];

const TEAM_CODE_TO_NAME = {
  MEX: 'Mexico', KOR: 'South Korea', RSA: 'South Africa', CZE: 'Czech Republic',
  CAN: 'Canada', SUI: 'Switzerland', QAT: 'Qatar', BIH: 'Bosnia and Herzegovina',
  BRA: 'Brazil', MAR: 'Morocco', SCO: 'Scotland', HAI: 'Haiti',
  USA: 'USA', PAR: 'Paraguay', AUS: 'Australia', TUR: 'Turkey',
  GER: 'Germany', ECU: 'Ecuador', CIV: 'Ivory Coast', CUW: 'Curacao',
  NED: 'Netherlands', JPN: 'Japan', TUN: 'Tunisia', SWE: 'Sweden',
  BEL: 'Belgium', IRN: 'Iran', EGY: 'Egypt', NZL: 'New Zealand',
  ESP: 'Spain', URU: 'Uruguay', KSA: 'Saudi Arabia', CPV: 'Cape Verde',
  FRA: 'France', SEN: 'Senegal', NOR: 'Norway', IRQ: 'Iraq',
  ARG: 'Argentina', ALG: 'Algeria', AUT: 'Austria', JOR: 'Jordan',
  POR: 'Portugal', COL: 'Colombia', UZB: 'Uzbekistan', COD: 'DR Congo',
  ENG: 'England', CRO: 'Croatia', GHA: 'Ghana', PAN: 'Panama'
};

function normalizeName(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
}

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

function parseDatabase(txtPath) {
  const txtContent = fs.readFileSync(txtPath, 'utf8');
  const teamsMap = new Map();
  let currentTeamName = null;
  let currentPlayers = [];

  for (const rawLine of txtContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^-{5,}$/.test(line)) continue;

    const teamMatch = line.match(/^\d+\)\s*(.+?)\s*:$/);
    if (teamMatch) {
      if (currentTeamName && currentPlayers.length > 0) teamsMap.set(currentTeamName, currentPlayers);
      currentTeamName = teamMatch[1].trim();
      currentPlayers = [];
      continue;
    }

    const playerMatch = line.match(/^\d+-\s*(.+?)\s*\((.+?)\)\s*-\s*(\d+)\s*$/);
    if (playerMatch) {
      const name = playerMatch[1].trim();
      const rawPos = playerMatch[2].trim();
      const overall = parseInt(playerMatch[3], 10);
      currentPlayers.push({ name, rawPos, pos: mapPositions(rawPos), overall });
    }
  }

  if (currentTeamName && currentPlayers.length > 0) teamsMap.set(currentTeamName, currentPlayers);
  return teamsMap;
}

function findPlayersForCode(teamsMap, code) {
  for (const [teamName, players] of teamsMap.entries()) {
    if (TEAM_NAME_TO_CODE[normalizeName(teamName)] === code) return players;
  }
  for (const [teamName, players] of teamsMap.entries()) {
    const normTxt = normalizeName(teamName);
    const normOfficial = normalizeName(TEAM_CODE_TO_NAME[code] || code);
    if (normTxt === normOfficial || normTxt.includes(normOfficial) || normOfficial.includes(normTxt)) return players;
  }
  return null;
}

function buildTeam(code, txtPlayers) {
  const players = txtPlayers.map((rp, idx) => ({
    id: `${code}-${rp.pos}${idx}`,
    name: rp.name,
    team: code,
    pos: rp.pos,
    rawPos: rp.rawPos,
    overall: rp.overall,
    isStar: rp.overall >= 85
  }));

  players.sort((a, b) => b.overall - a.overall);
  const baseOverall = Math.round(players.reduce((sum, player) => sum + player.overall, 0) / players.length);

  return {
    id: code,
    name: TEAM_CODE_TO_NAME[code] || code,
    code,
    baseOverall,
    players
  };
}

const txtPath = path.join(__dirname, 'player-database.txt');
const teamsMap = parseDatabase(txtPath);
console.log(`Parsed ${teamsMap.size} teams from ${path.basename(txtPath)}`);

const finalTeams = REQUIRED_ORDER.map(code => {
  const players = findPlayersForCode(teamsMap, code);
  if (!players) throw new Error(`Missing final player database entry for ${code} (${TEAM_CODE_TO_NAME[code]})`);
  if (players.length !== 26) throw new Error(`${code} must have exactly 26 players, found ${players.length}`);
  return buildTeam(code, players);
});

const outPath = path.join(__dirname, 'teams2026.json');
fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), teams: finalTeams }, null, 2));

const totalPlayers = finalTeams.reduce((sum, team) => sum + team.players.length, 0);
console.log(`Wrote ${finalTeams.length} teams (${totalPlayers} players) to ${outPath}`);
console.log('Top-rated players per team:');
for (const team of finalTeams) {
  const top = team.players[0];
  console.log(`  ${team.code} (${team.name}): base=${team.baseOverall}, top=${top.name} (${top.pos}) OVR=${top.overall}`);
}
