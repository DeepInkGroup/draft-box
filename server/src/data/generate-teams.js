/**
 * Generates data/teams2026.json — the 48-nation player pool for the World Cup mode.
 *
 * Data note: team list reflects the real 2026 World Cup qualifiers (48 nations).
 * A handful of well-known real players are seeded per major team for flavor;
 * the rest of every squad is procedurally generated (plausible names + ratings),
 * NOT an official/licensed roster. See RULES.md for the full disclaimer.
 */
const fs = require('fs');
const path = require('path');

// name banks grouped by loose linguistic/regional style, used to fill out squads
const NAME_BANKS = {
  latam: {
    first: ['Diego', 'Mateo', 'Santiago', 'Nicolás', 'Facundo', 'Agustín', 'Bruno', 'Lucas', 'Emiliano', 'Joaquín', 'Thiago', 'Gonzalo', 'Franco', 'Ezequiel', 'Ramiro'],
    last: ['Fernández', 'González', 'Rodríguez', 'Martínez', 'Pérez', 'Silva', 'Rojas', 'Herrera', 'Núñez', 'Cabrera', 'Molina', 'Aguirre', 'Vega', 'Correa', 'Paredes']
  },
  brazil: {
    first: ['Gabriel', 'Matheus', 'Rafael', 'Wesley', 'Kayky', 'Igor', 'Bruno', 'Caio', 'Vitor', 'Everton', 'Douglas', 'Lucas', 'André', 'Renan', 'Yuri'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Almeida', 'Ribeiro', 'Carvalho', 'Gomes', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Teixeira']
  },
  english: {
    first: ['Harry', 'James', 'Jack', 'Callum', 'Marcus', 'Ben', 'Ethan', 'Tyler', 'Reece', 'Curtis', 'Mason', 'Aaron', 'Kyle', 'Ollie', 'Ryan'],
    last: ['Smith', 'Jones', 'Taylor', 'Walker', 'Clarke', 'Wright', 'Evans', 'Hughes', 'Edwards', 'Bennett', 'Marshall', 'Cole', 'Hunt', 'Fisher', 'Reid']
  },
  french: {
    first: ['Antoine', 'Hugo', 'Lucas', 'Théo', 'Mathis', 'Nathan', 'Enzo', 'Yanis', 'Bilal', 'Rayan', 'Amine', 'Malo', 'Loïc', 'Jules', 'Noé'],
    last: ['Bernard', 'Dubois', 'Moreau', 'Lefevre', 'Girard', 'André', 'Fontaine', 'Perrin', 'Rousseau', 'Blanchard', 'Marchand', 'Barbier', 'Renaud', 'Fabre', 'Gauthier']
  },
  german: {
    first: ['Lukas', 'Finn', 'Jonas', 'Julian', 'Niklas', 'Maximilian', 'Elias', 'David', 'Tom', 'Leon', 'Paul', 'Moritz', 'Felix', 'Jannik', 'Robin'],
    last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Hofmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann']
  },
  dutch: {
    first: ['Daan', 'Sem', 'Lars', 'Milan', 'Bram', 'Thijs', 'Ruben', 'Jasper', 'Stijn', 'Tim', 'Niek', 'Joris', 'Wouter', 'Koen', 'Sven'],
    last: ['de Jong', 'Bakker', 'Visser', 'Smit', 'Meijer', 'Mulder', 'de Boer', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Dijk', 'Dekker', 'Brouwer', 'de Groot']
  },
  iberian: {
    first: ['Álvaro', 'Pablo', 'Sergio', 'Adrián', 'Iker', 'Marc', 'Hugo', 'Rubén', 'Diego', 'Nuno', 'Tiago', 'João', 'Rui', 'Miguel', 'Gonçalo'],
    last: ['García', 'López', 'Sánchez', 'Torres', 'Romero', 'Navarro', 'Costa', 'Ferreira', 'Ramos', 'Domínguez', 'Serrano', 'Vidal', 'Carvalho', 'Lopes', 'Pinto']
  },
  balkan: {
    first: ['Luka', 'Marko', 'Ivan', 'Petar', 'Nikola', 'Dario', 'Ante', 'Josip', 'Bojan', 'Filip', 'Stefan', 'Dino', 'Vedran', 'Kristijan', 'Mario'],
    last: ['Horvat', 'Kovačević', 'Perić', 'Jurić', 'Novak', 'Babić', 'Marić', 'Knežević', 'Radić', 'Vuković', 'Šimić', 'Pavlović', 'Kovač', 'Ivanović', 'Tomić']
  },
  scandi: {
    first: ['Erik', 'Anders', 'Magnus', 'Oscar', 'Viktor', 'Emil', 'Gustav', 'Sander', 'Fredrik', 'Kristian', 'Henrik', 'Aksel', 'Jonas', 'Mats', 'Nils'],
    last: ['Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsen', 'Hansen', 'Pedersen', 'Olsen', 'Berg', 'Haugen', 'Lund', 'Dahl', 'Solberg', 'Strand']
  },
  arab: {
    first: ['Ahmed', 'Mohammed', 'Youssef', 'Omar', 'Khalid', 'Ali', 'Hamza', 'Karim', 'Bilal', 'Tariq', 'Sami', 'Anas', 'Zaid', 'Rami', 'Fahad'],
    last: ['Al-Sayed', 'Hassan', 'Farouk', 'Mansour', 'Saleh', 'Khalil', 'Nasser', 'Rashid', 'Qureshi', 'Amrani', 'Belkacem', 'Tahiri', 'Aziz', 'Karimi', 'Zidan']
  },
  persian: {
    first: ['Reza', 'Amir', 'Arman', 'Kian', 'Sina', 'Pooya', 'Navid', 'Farhad', 'Milad', 'Behrad', 'Danial', 'Arash', 'Kaveh', 'Shayan', 'Iman'],
    last: ['Hosseini', 'Karimi', 'Rezaei', 'Ahmadi', 'Moradi', 'Ebrahimi', 'Ghasemi', 'Nasiri', 'Sadeghi', 'Jafari', 'Norouzi', 'Rostami', 'Salehi', 'Bahrami', 'Fallahi']
  },
  african: {
    first: ['Emmanuel', 'Ibrahim', 'Samuel', 'Joseph', 'Moussa', 'Aboubakar', 'Kwame', 'Yusuf', 'Chidi', 'Idris', 'Baba', 'Sekou', 'Amadou', 'Bakary', 'Ismael'],
    last: ['Diallo', 'Traoré', 'Koné', 'Mensah', 'Boateng', 'Osei', 'Camara', 'Cissé', 'Keita', 'Toure', 'Diop', 'Fofana', 'Bamba', 'Sow', 'Doumbia']
  },
  eastasia: {
    first: ['Haruto', 'Yuto', 'Sota', 'Ren', 'Riku', 'Min-jun', 'Ji-ho', 'Seo-jun', 'Do-yun', 'Tae-yang'],
    last: ['Tanaka', 'Suzuki', 'Yamamoto', 'Watanabe', 'Kobayashi', 'Kim', 'Lee', 'Park', 'Jung', 'Choi']
  },
  centralasia: {
    first: ['Aziz', 'Sardor', 'Botir', 'Jahongir', 'Diyor', 'Otabek', 'Islom', 'Sherzod', 'Farrukh', 'Bekzod'],
    last: ['Yusupov', 'Rashidov', 'Karimov', 'Tursunov', 'Nazarov', 'Abdullayev', 'Ismoilov', 'Xolmatov', 'Sodiqov', 'Ergashev']
  },
  concacaf: {
    first: ['Carlos', 'Luis', 'José', 'Andrés', 'Kevin', 'Erick', 'Josh', 'Tajon', 'Alphonso', 'Junior'],
    last: ['Hernández', 'Ramírez', 'Vargas', 'Jiménez', 'Castillo', 'Moreno', 'David', 'Buchanan', 'Larin', 'Charles']
  },
  turkic: {
    first: ['Emre', 'Kaan', 'Burak', 'Cenk', 'Onur', 'Baris', 'Ugur', 'Serkan', 'Deniz', 'Tolga'],
    last: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Kılıç']
  },
  oceania: {
    first: ['Liam', 'Noah', 'Jack', 'Cole', 'Finn', 'Zane', 'Tyrone', 'Marco', 'Levi', 'Sione'],
    last: ['Wood', 'Fallon', 'Rufer', 'Boxall', 'Bell', 'Tuiloma', 'Sail', 'Kire', 'Vicelich', 'Payne']
  }
};

const POSITIONS = ['GK', 'DF', 'MF', 'FW'];
const SQUAD_SHAPE = { GK: 3, DF: 7, MF: 7, FW: 4 }; // 21-man pool per team

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
  BRA: [['Vinícius Júnior', 'FW', 92], ['Rodrygo', 'FW', 87], ['Endrick', 'FW', 84], ['Alisson', 'GK', 89]],
  FRA: [['Kylian Mbappé', 'FW', 94], ['Ousmane Dembélé', 'FW', 89], ['Aurélien Tchouaméni', 'MF', 87], ['Mike Maignan', 'GK', 88]],
  ARG: [['Lionel Messi', 'FW', 90], ['Julián Álvarez', 'FW', 88], ['Enzo Fernández', 'MF', 87], ['Emiliano Martínez', 'GK', 88]],
  ENG: [['Jude Bellingham', 'MF', 91], ['Bukayo Saka', 'FW', 89], ['Phil Foden', 'MF', 88], ['Jordan Pickford', 'GK', 85]],
  ESP: [['Lamine Yamal', 'FW', 91], ['Pedri', 'MF', 89], ['Rodri', 'MF', 90], ['Unai Simón', 'GK', 85]],
  POR: [['Cristiano Ronaldo', 'FW', 86], ['Bruno Fernandes', 'MF', 88], ['Rúben Dias', 'DF', 88], ['Diogo Costa', 'GK', 87]],
  GER: [['Jamal Musiala', 'MF', 90], ['Florian Wirtz', 'MF', 89], ['Kai Havertz', 'FW', 85], ['Manuel Neuer', 'GK', 84]],
  NED: [['Cody Gakpo', 'FW', 85], ['Xavi Simons', 'MF', 87], ['Virgil van Dijk', 'DF', 88], ['Bart Verbruggen', 'GK', 82]],
  BEL: [['Kevin De Bruyne', 'MF', 89], ['Romelu Lukaku', 'FW', 84], ['Jérémy Doku', 'FW', 86]],
  CRO: [['Luka Modrić', 'MF', 86], ['Josko Gvardiol', 'DF', 87]],
  URU: [['Darwin Núñez', 'FW', 85], ['Federico Valverde', 'MF', 88], ['Ronald Araújo', 'DF', 86]],
  COL: [['James Rodríguez', 'MF', 83], ['Luis Díaz', 'FW', 87]],
  MAR: [['Achraf Hakimi', 'DF', 88], ['Hakim Ziyech', 'MF', 80]],
  USA: [['Christian Pulisic', 'FW', 86], ['Weston McKennie', 'MF', 82]],
  NOR: [['Erling Haaland', 'FW', 93], ['Martin Ødegaard', 'MF', 88]],
  SUI: [['Granit Xhaka', 'MF', 84], ['Manuel Akanji', 'DF', 84]],
  MEX: [['Santiago Giménez', 'FW', 83], ['Edson Álvarez', 'MF', 82]],
  JPN: [['Takefusa Kubo', 'FW', 85], ['Kaoru Mitoma', 'FW', 84]],
  SEN: [['Sadio Mané', 'FW', 85], ['Kalidou Koulibaly', 'DF', 83]],
  ECU: [['Moisés Caicedo', 'MF', 86], ['Piero Hincapié', 'DF', 82]],
  CAN: [['Alphonso Davies', 'DF', 87], ['Jonathan David', 'FW', 84]],
  GHA: [['Mohammed Kudus', 'MF', 85], ['Thomas Partey', 'MF', 81]],
  EGY: [['Mohamed Salah', 'FW', 89]],
  ALG: [['Riyad Mahrez', 'FW', 82]],
  IRN: [['Mehdi Taremi', 'FW', 83]],
  KSA: [['Salem Al-Dawsari', 'FW', 78]],
  QAT: [['Akram Afif', 'FW', 79]]
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function genName(region) {
  const bank = NAME_BANKS[region] || NAME_BANKS.latam;
  return `${pick(bank.first)} ${pick(bank.last)}`;
}

function genPlayer(team, pos, idx, isStar, starOverall, starName) {
  const posAdjust = { GK: -1, DF: -2, MF: 0, FW: 1 }[pos];
  const variance = Math.round((Math.random() - 0.5) * 10);
  const overall = isStar ? starOverall : clamp(team.base + posAdjust + variance - 3, 52, 90);
  return {
    id: `${team.code}-${pos}${idx}`,
    name: isStar ? starName : genName(team.region),
    team: team.code,
    pos,
    overall,
    isStar: !!isStar
  };
}

function buildTeam(team) {
  const players = [];
  const counters = { GK: 0, DF: 0, MF: 0, FW: 0 };
  const stars = STARS[team.code] || [];

  for (const [name, pos, overall] of stars) {
    counters[pos] += 1;
    players.push(genPlayer(team, pos, counters[pos], true, overall, name));
  }

  for (const pos of POSITIONS) {
    while (counters[pos] < SQUAD_SHAPE[pos]) {
      counters[pos] += 1;
      players.push(genPlayer(team, pos, counters[pos], false));
    }
  }

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
