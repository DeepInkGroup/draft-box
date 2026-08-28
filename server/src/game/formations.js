// Each formation is an explicit, named list of 11 slots (not just position-group counts).
// x/y are percentages on a pitch (0,0 = top-left / attacking corner, 100,100 = bottom-right / own goal side),
// used by the frontend to render the pitch diagram and let players assign a drafted player to an exact slot
// (e.g. choosing which side of central defense, not just "a defender").

const FORMATIONS = {
  '4-3-3': {
    description: 'Attacking with width. Three forwards create constant threat.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LB', group: 'DF', short: 'LB', label: 'Left Back', x: 15, y: 72 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 35, y: 76 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 65, y: 76 },
      { code: 'RB', group: 'DF', short: 'RB', label: 'Right Back', x: 85, y: 72 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 30, y: 52 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 50, y: 46 },
      { code: 'CM3', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 70, y: 52 },
      { code: 'LW', group: 'FW', short: 'LW', label: 'Left Winger', x: 18, y: 20 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 14 },
      { code: 'RW', group: 'FW', short: 'RW', label: 'Right Winger', x: 82, y: 20 }
    ]
  },
  '4-4-2': {
    description: 'Balanced and reliable. Two banks of four with a strike partnership.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LB', group: 'DF', short: 'LB', label: 'Left Back', x: 15, y: 74 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 37, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 63, y: 78 },
      { code: 'RB', group: 'DF', short: 'RB', label: 'Right Back', x: 85, y: 74 },
      { code: 'LM', group: 'MF', short: 'LM', label: 'Left Midfielder', x: 15, y: 48 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 38, y: 52 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 62, y: 52 },
      { code: 'RM', group: 'MF', short: 'RM', label: 'Right Midfielder', x: 85, y: 48 },
      { code: 'ST1', group: 'FW', short: 'ST', label: 'Striker', x: 38, y: 16 },
      { code: 'ST2', group: 'FW', short: 'ST', label: 'Striker', x: 62, y: 16 }
    ]
  },
  '4-2-3-1': {
    description: 'Defensive solidity with a creative No.10 behind a lone striker.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LB', group: 'DF', short: 'LB', label: 'Left Back', x: 15, y: 74 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 37, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 63, y: 78 },
      { code: 'RB', group: 'DF', short: 'RB', label: 'Right Back', x: 85, y: 74 },
      { code: 'CDM1', group: 'MF', short: 'CDM', label: 'Defensive Midfielder', x: 38, y: 60 },
      { code: 'CDM2', group: 'MF', short: 'CDM', label: 'Defensive Midfielder', x: 62, y: 60 },
      { code: 'LAM', group: 'MF', short: 'LAM', label: 'Left Attacking Mid', x: 18, y: 34 },
      { code: 'CAM', group: 'MF', short: 'CAM', label: 'Attacking Midfielder', x: 50, y: 30 },
      { code: 'RAM', group: 'MF', short: 'RAM', label: 'Right Attacking Mid', x: 82, y: 34 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 14 }
    ]
  },
  '4-5-1': {
    description: 'Ultra-compact midfield. Absorb pressure and hit on the counter.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LB', group: 'DF', short: 'LB', label: 'Left Back', x: 15, y: 74 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 37, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 63, y: 78 },
      { code: 'RB', group: 'DF', short: 'RB', label: 'Right Back', x: 85, y: 74 },
      { code: 'LM', group: 'MF', short: 'LM', label: 'Left Midfielder', x: 12, y: 46 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 32, y: 52 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 50, y: 56 },
      { code: 'CM3', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 68, y: 52 },
      { code: 'RM', group: 'MF', short: 'RM', label: 'Right Midfielder', x: 88, y: 46 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 16 }
    ]
  },
  '3-4-3': {
    description: 'High-risk, high-reward. Bold width in attack, exposed at the back.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 28, y: 76 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 50, y: 80 },
      { code: 'CB3', group: 'DF', short: 'CB', label: 'Center Back', x: 72, y: 76 },
      { code: 'LM', group: 'MF', short: 'LM', label: 'Left Midfielder', x: 14, y: 50 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 38, y: 54 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 62, y: 54 },
      { code: 'RM', group: 'MF', short: 'RM', label: 'Right Midfielder', x: 86, y: 50 },
      { code: 'LW', group: 'FW', short: 'LW', label: 'Left Winger', x: 18, y: 20 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 14 },
      { code: 'RW', group: 'FW', short: 'RW', label: 'Right Winger', x: 82, y: 20 }
    ]
  },
  '3-5-2': {
    description: 'Wing-backs provide the width while a five-man midfield dominates the center.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 28, y: 76 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 50, y: 80 },
      { code: 'CB3', group: 'DF', short: 'CB', label: 'Center Back', x: 72, y: 76 },
      { code: 'LWB', group: 'MF', short: 'LWB', label: 'Left Wing Back', x: 10, y: 46 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 32, y: 52 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 50, y: 56 },
      { code: 'CM3', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 68, y: 52 },
      { code: 'RWB', group: 'MF', short: 'RWB', label: 'Right Wing Back', x: 90, y: 46 },
      { code: 'ST1', group: 'FW', short: 'ST', label: 'Striker', x: 38, y: 16 },
      { code: 'ST2', group: 'FW', short: 'ST', label: 'Striker', x: 62, y: 16 }
    ]
  },
  '5-4-1': {
    description: 'Fortress at the back. Sit deep, stay compact, strike on the break.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LWB', group: 'DF', short: 'LWB', label: 'Left Wing Back', x: 10, y: 68 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 30, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 50, y: 82 },
      { code: 'CB3', group: 'DF', short: 'CB', label: 'Center Back', x: 70, y: 78 },
      { code: 'RWB', group: 'DF', short: 'RWB', label: 'Right Wing Back', x: 90, y: 68 },
      { code: 'LM', group: 'MF', short: 'LM', label: 'Left Midfielder', x: 15, y: 46 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 38, y: 50 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 62, y: 50 },
      { code: 'RM', group: 'MF', short: 'RM', label: 'Right Midfielder', x: 85, y: 46 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 16 }
    ]
  },
  '4-1-2-1-2': {
    description: 'A narrow diamond in midfield builds through the center.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LB', group: 'DF', short: 'LB', label: 'Left Back', x: 15, y: 74 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 37, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 63, y: 78 },
      { code: 'RB', group: 'DF', short: 'RB', label: 'Right Back', x: 85, y: 74 },
      { code: 'CDM', group: 'MF', short: 'CDM', label: 'Defensive Midfielder', x: 50, y: 62 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 32, y: 48 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 68, y: 48 },
      { code: 'CAM', group: 'MF', short: 'CAM', label: 'Attacking Midfielder', x: 50, y: 32 },
      { code: 'ST1', group: 'FW', short: 'ST', label: 'Striker', x: 38, y: 16 },
      { code: 'ST2', group: 'FW', short: 'ST', label: 'Striker', x: 62, y: 16 }
    ]
  },
  '4-4-1-1': {
    description: 'A second striker links midfield and attack just behind the target man.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LB', group: 'DF', short: 'LB', label: 'Left Back', x: 15, y: 74 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 37, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 63, y: 78 },
      { code: 'RB', group: 'DF', short: 'RB', label: 'Right Back', x: 85, y: 74 },
      { code: 'LM', group: 'MF', short: 'LM', label: 'Left Midfielder', x: 15, y: 48 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 38, y: 52 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 62, y: 52 },
      { code: 'RM', group: 'MF', short: 'RM', label: 'Right Midfielder', x: 85, y: 48 },
      { code: 'SS', group: 'FW', short: 'SS', label: 'Second Striker', x: 50, y: 26 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 12 }
    ]
  },
  '5-3-2': {
    description: 'Three at the back become five in defense. Cautious and hard to break down.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LWB', group: 'DF', short: 'LWB', label: 'Left Wing Back', x: 10, y: 68 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 30, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 50, y: 82 },
      { code: 'CB3', group: 'DF', short: 'CB', label: 'Center Back', x: 70, y: 78 },
      { code: 'RWB', group: 'DF', short: 'RWB', label: 'Right Wing Back', x: 90, y: 68 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 32, y: 50 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 50, y: 54 },
      { code: 'CM3', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 68, y: 50 },
      { code: 'ST1', group: 'FW', short: 'ST', label: 'Striker', x: 38, y: 16 },
      { code: 'ST2', group: 'FW', short: 'ST', label: 'Striker', x: 62, y: 16 }
    ]
  },
  '3-4-1-2': {
    description: 'A free-roaming No.10 supports a strike duo behind a solid back three.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 28, y: 76 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 50, y: 80 },
      { code: 'CB3', group: 'DF', short: 'CB', label: 'Center Back', x: 72, y: 76 },
      { code: 'LM', group: 'MF', short: 'LM', label: 'Left Midfielder', x: 14, y: 50 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 38, y: 54 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 62, y: 54 },
      { code: 'RM', group: 'MF', short: 'RM', label: 'Right Midfielder', x: 86, y: 50 },
      { code: 'CAM', group: 'MF', short: 'CAM', label: 'Attacking Midfielder', x: 50, y: 30 },
      { code: 'ST1', group: 'FW', short: 'ST', label: 'Striker', x: 40, y: 14 },
      { code: 'ST2', group: 'FW', short: 'ST', label: 'Striker', x: 60, y: 14 }
    ]
  },
  '4-2-2-2': {
    description: 'Two holding midfielders shield the back four while two playmakers link the strikers.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LB', group: 'DF', short: 'LB', label: 'Left Back', x: 15, y: 74 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 37, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 63, y: 78 },
      { code: 'RB', group: 'DF', short: 'RB', label: 'Right Back', x: 85, y: 74 },
      { code: 'CDM1', group: 'MF', short: 'CDM', label: 'Defensive Midfielder', x: 38, y: 60 },
      { code: 'CDM2', group: 'MF', short: 'CDM', label: 'Defensive Midfielder', x: 62, y: 60 },
      { code: 'LAM', group: 'MF', short: 'LAM', label: 'Left Attacking Mid', x: 25, y: 34 },
      { code: 'RAM', group: 'MF', short: 'RAM', label: 'Right Attacking Mid', x: 75, y: 34 },
      { code: 'ST1', group: 'FW', short: 'ST', label: 'Striker', x: 38, y: 16 },
      { code: 'ST2', group: 'FW', short: 'ST', label: 'Striker', x: 62, y: 16 }
    ]
  },
  '5-2-3': {
    description: 'A back five with only two in the middle — width and firepower up top, but the engine room can get overrun.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LWB', group: 'DF', short: 'LWB', label: 'Left Wing Back', x: 10, y: 68 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 30, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 50, y: 82 },
      { code: 'CB3', group: 'DF', short: 'CB', label: 'Center Back', x: 70, y: 78 },
      { code: 'RWB', group: 'DF', short: 'RWB', label: 'Right Wing Back', x: 90, y: 68 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 38, y: 52 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 62, y: 52 },
      { code: 'LW', group: 'FW', short: 'LW', label: 'Left Winger', x: 18, y: 20 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 14 },
      { code: 'RW', group: 'FW', short: 'RW', label: 'Right Winger', x: 82, y: 20 }
    ]
  },
  '5-3-1-1': {
    description: 'Extreme defensive solidity with a target man and a support striker linking play — built to absorb and break at pace.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LWB', group: 'DF', short: 'LWB', label: 'Left Wing Back', x: 10, y: 68 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 30, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 50, y: 82 },
      { code: 'CB3', group: 'DF', short: 'CB', label: 'Center Back', x: 70, y: 78 },
      { code: 'RWB', group: 'DF', short: 'RWB', label: 'Right Wing Back', x: 90, y: 68 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 35, y: 52 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 50, y: 56 },
      { code: 'CM3', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 65, y: 52 },
      { code: 'SS', group: 'FW', short: 'SS', label: 'Second Striker', x: 50, y: 26 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 12 }
    ]
  },
  '3-2-4-1': {
    description: 'A back three protected by a double pivot, exploding into four attacking outlets — thrilling going forward, thin at the back.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 28, y: 76 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 50, y: 80 },
      { code: 'CB3', group: 'DF', short: 'CB', label: 'Center Back', x: 72, y: 76 },
      { code: 'CDM1', group: 'MF', short: 'CDM', label: 'Defensive Midfielder', x: 38, y: 62 },
      { code: 'CDM2', group: 'MF', short: 'CDM', label: 'Defensive Midfielder', x: 62, y: 62 },
      { code: 'LW', group: 'MF', short: 'LW', label: 'Left Winger', x: 12, y: 32 },
      { code: 'LAM', group: 'MF', short: 'LAM', label: 'Left Attacking Mid', x: 34, y: 30 },
      { code: 'RAM', group: 'MF', short: 'RAM', label: 'Right Attacking Mid', x: 66, y: 30 },
      { code: 'RW', group: 'MF', short: 'RW', label: 'Right Winger', x: 88, y: 32 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 14 }
    ]
  },
  '3-3-2-2': {
    description: 'A compact back three with a midfield triangle, two creators and two strikers attacking the half-spaces.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 28, y: 76 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 50, y: 80 },
      { code: 'CB3', group: 'DF', short: 'CB', label: 'Center Back', x: 72, y: 76 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 30, y: 56 },
      { code: 'CDM', group: 'MF', short: 'CDM', label: 'Defensive Midfielder', x: 50, y: 62 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 70, y: 56 },
      { code: 'LAM', group: 'MF', short: 'LAM', label: 'Left Attacking Mid', x: 35, y: 34 },
      { code: 'RAM', group: 'MF', short: 'RAM', label: 'Right Attacking Mid', x: 65, y: 34 },
      { code: 'ST1', group: 'FW', short: 'ST', label: 'Striker', x: 40, y: 14 },
      { code: 'ST2', group: 'FW', short: 'ST', label: 'Striker', x: 60, y: 14 }
    ]
  },
  '4-1-4-1': {
    description: 'A single pivot protects the back four while advanced eights and wide midfielders support one striker.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LB', group: 'DF', short: 'LB', label: 'Left Back', x: 15, y: 74 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 37, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 63, y: 78 },
      { code: 'RB', group: 'DF', short: 'RB', label: 'Right Back', x: 85, y: 74 },
      { code: 'CDM', group: 'MF', short: 'CDM', label: 'Defensive Midfielder', x: 50, y: 62 },
      { code: 'LM', group: 'MF', short: 'LM', label: 'Left Midfielder', x: 14, y: 42 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 38, y: 44 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 62, y: 44 },
      { code: 'RM', group: 'MF', short: 'RM', label: 'Right Midfielder', x: 86, y: 42 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 14 }
    ]
  },
  '5-2-2-1': {
    description: 'A back five with a double pivot and two narrow creators behind a lone finisher.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LWB', group: 'DF', short: 'LWB', label: 'Left Wing Back', x: 10, y: 68 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 30, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 50, y: 82 },
      { code: 'CB3', group: 'DF', short: 'CB', label: 'Center Back', x: 70, y: 78 },
      { code: 'RWB', group: 'DF', short: 'RWB', label: 'Right Wing Back', x: 90, y: 68 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 38, y: 56 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 62, y: 56 },
      { code: 'LAM', group: 'MF', short: 'LAM', label: 'Left Attacking Mid', x: 35, y: 34 },
      { code: 'RAM', group: 'MF', short: 'RAM', label: 'Right Attacking Mid', x: 65, y: 34 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 14 }
    ]
  },
  '3-5-1-1': {
    description: 'A five-man midfield feeds a roaming second striker who plays close to the main forward.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 28, y: 76 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 50, y: 80 },
      { code: 'CB3', group: 'DF', short: 'CB', label: 'Center Back', x: 72, y: 76 },
      { code: 'LWB', group: 'MF', short: 'LWB', label: 'Left Wing Back', x: 10, y: 46 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 32, y: 54 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 50, y: 58 },
      { code: 'CM3', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 68, y: 54 },
      { code: 'RWB', group: 'MF', short: 'RWB', label: 'Right Wing Back', x: 90, y: 46 },
      { code: 'SS', group: 'FW', short: 'SS', label: 'Second Striker', x: 50, y: 28 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 12 }
    ]
  },
  '2-5-2-1': {
    description: 'A radical possession shape: two center backs, five midfield stabilizers, two creators and one striker.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 38, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 62, y: 78 },
      { code: 'LWB', group: 'MF', short: 'LWB', label: 'Left Wing Back', x: 10, y: 50 },
      { code: 'CDM', group: 'MF', short: 'CDM', label: 'Defensive Midfielder', x: 50, y: 62 },
      { code: 'RWB', group: 'MF', short: 'RWB', label: 'Right Wing Back', x: 90, y: 50 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 34, y: 46 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 66, y: 46 },
      { code: 'LAM', group: 'MF', short: 'LAM', label: 'Left Attacking Mid', x: 34, y: 28 },
      { code: 'RAM', group: 'MF', short: 'RAM', label: 'Right Attacking Mid', x: 66, y: 28 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 12 }
    ]
  },
  '3-3-1-3': {
    description: 'A central back three, three midfielders, a No.10 and a front three built for sustained pressure.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 28, y: 76 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 50, y: 80 },
      { code: 'CB3', group: 'DF', short: 'CB', label: 'Center Back', x: 72, y: 76 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 30, y: 54 },
      { code: 'CDM', group: 'MF', short: 'CDM', label: 'Defensive Midfielder', x: 50, y: 62 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 70, y: 54 },
      { code: 'CAM', group: 'MF', short: 'CAM', label: 'Attacking Midfielder', x: 50, y: 34 },
      { code: 'LW', group: 'FW', short: 'LW', label: 'Left Winger', x: 18, y: 20 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 12 },
      { code: 'RW', group: 'FW', short: 'RW', label: 'Right Winger', x: 82, y: 20 }
    ]
  },
  '4-3-2-1': {
    description: 'The Christmas tree: three midfielders control the center while two creators play behind one striker.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LB', group: 'DF', short: 'LB', label: 'Left Back', x: 15, y: 74 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 37, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 63, y: 78 },
      { code: 'RB', group: 'DF', short: 'RB', label: 'Right Back', x: 85, y: 74 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 30, y: 54 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 50, y: 58 },
      { code: 'CM3', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 70, y: 54 },
      { code: 'LAM', group: 'MF', short: 'LAM', label: 'Left Attacking Mid', x: 38, y: 34 },
      { code: 'RAM', group: 'MF', short: 'RAM', label: 'Right Attacking Mid', x: 62, y: 34 },
      { code: 'ST', group: 'FW', short: 'ST', label: 'Striker', x: 50, y: 14 }
    ]
  },
  '4-3-1-2': {
    description: 'A narrow midfield diamond with an advanced playmaker supplying two strikers.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LB', group: 'DF', short: 'LB', label: 'Left Back', x: 15, y: 74 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 37, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 63, y: 78 },
      { code: 'RB', group: 'DF', short: 'RB', label: 'Right Back', x: 85, y: 74 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 30, y: 54 },
      { code: 'CDM', group: 'MF', short: 'CDM', label: 'Defensive Midfielder', x: 50, y: 62 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 70, y: 54 },
      { code: 'CAM', group: 'MF', short: 'CAM', label: 'Attacking Midfielder', x: 50, y: 34 },
      { code: 'ST1', group: 'FW', short: 'ST', label: 'Striker', x: 40, y: 14 },
      { code: 'ST2', group: 'FW', short: 'ST', label: 'Striker', x: 60, y: 14 }
    ]
  },
  '4-2-4': {
    description: 'Four forwards, two midfielders. Devastatingly direct but leaves acres of space to exploit in midfield and behind.',
    slots: [
      { code: 'GK', group: 'GK', short: 'GK', label: 'Goalkeeper', x: 50, y: 90 },
      { code: 'LB', group: 'DF', short: 'LB', label: 'Left Back', x: 15, y: 74 },
      { code: 'CB1', group: 'DF', short: 'CB', label: 'Center Back', x: 37, y: 78 },
      { code: 'CB2', group: 'DF', short: 'CB', label: 'Center Back', x: 63, y: 78 },
      { code: 'RB', group: 'DF', short: 'RB', label: 'Right Back', x: 85, y: 74 },
      { code: 'CM1', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 38, y: 54 },
      { code: 'CM2', group: 'MF', short: 'CM', label: 'Central Midfielder', x: 62, y: 54 },
      { code: 'LW', group: 'FW', short: 'LW', label: 'Left Winger', x: 15, y: 18 },
      { code: 'ST1', group: 'FW', short: 'ST', label: 'Striker', x: 38, y: 12 },
      { code: 'ST2', group: 'FW', short: 'ST', label: 'Striker', x: 62, y: 12 },
      { code: 'RW', group: 'FW', short: 'RW', label: 'Right Winger', x: 85, y: 18 }
    ]
  }
};

const POSITION_GROUPS = ['GK', 'DF', 'MF', 'FW'];

function isValidFormation(formation) {
  return Object.prototype.hasOwnProperty.call(FORMATIONS, formation);
}

function getSlots(formation) {
  const f = FORMATIONS[formation] || FORMATIONS['4-3-3'];
  return f.slots;
}

function getDescription(formation) {
  const f = FORMATIONS[formation] || FORMATIONS['4-3-3'];
  return f.description;
}

// Derived group counts (e.g. { GK:1, DF:4, MF:3, FW:3 }) — used by the bot auto-XI picker
// and to know how many players of a group a formation needs overall.
function slotsFor(formation) {
  const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const slot of getSlots(formation)) counts[slot.group] += 1;
  return counts;
}

function isValidSlotCode(formation, slotCode) {
  return getSlots(formation).some((s) => s.code === slotCode);
}

function slotGroup(formation, slotCode) {
  const slot = getSlots(formation).find((s) => s.code === slotCode);
  return slot ? slot.group : null;
}

const GROUP_POSITION_FALLBACKS = {
  GK: ['GK'],
  DF: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  MF: ['CDM', 'CM', 'CAM', 'LM', 'RM', 'LAM', 'RAM'],
  FW: ['ST', 'CF', 'SS', 'LW', 'RW']
};

const SLOT_COMPATIBILITY = {
  GK: ['GK'],
  CB: ['CB'],
  LB: ['LB'],
  RB: ['RB'],
  LWB: ['LWB', 'LB', 'LM'],
  RWB: ['RWB', 'RB', 'RM'],
  CDM: ['CDM'],
  CM: ['CM'],
  CAM: ['CAM'],
  LAM: ['LAM', 'CAM', 'LM', 'LW'],
  RAM: ['RAM', 'CAM', 'RM', 'RW'],
  LM: ['LM', 'LW', 'LWB'],
  RM: ['RM', 'RW', 'RWB'],
  LW: ['LW', 'LM'],
  RW: ['RW', 'RM'],
  SS: ['SS', 'CF', 'ST', 'CAM'],
  ST: ['ST', 'CF']
};

function normalizePositionCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

function playerPositionCodes(player) {
  const raw = String((player && (player.rawPos || player.position || player.positions)) || (player && player.pos) || '');
  const codes = raw
    .split(/[,/|]/)
    .map(normalizePositionCode)
    .filter(Boolean)
    .flatMap((code) => GROUP_POSITION_FALLBACKS[code] || [code]);
  return [...new Set(codes)];
}

function slotAcceptsPosition(slot, positionCode) {
  if (!slot || !positionCode) return false;
  const needed = normalizePositionCode(slot.short || slot.code);
  const accepted = SLOT_COMPATIBILITY[needed] || [needed];
  return accepted.includes(normalizePositionCode(positionCode));
}

function playerFitsSlot(player, slot) {
  return playerPositionCodes(player).some((code) => slotAcceptsPosition(slot, code));
}

// A formation's tactical "shape", derived purely from its slot layout (no hardcoded
// per-formation tuning) — used by the match engine to give formations real
// strengths/weaknesses against each other. See RULES.md / the rulebook PDF for the
// full explanation.
//   defShape = defensive presence: every DF slot, plus every MF slot sitting deep (y >= 55)
//   atkShape = attacking presence: every FW slot weighted 1.5x, plus every MF slot pushed
//              forward (y <= 35)
//   width    = how far the formation stretches across the pitch (max x - min x among
//              outfield slots) — wide shapes exploit narrow ones
const profileCache = new Map();

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function getProfile(formation) {
  if (profileCache.has(formation)) return profileCache.get(formation);

  const slots = getSlots(formation);
  let defShape = 0;
  let atkShape = 0;
  let minX = 100;
  let maxX = 0;
  let centralPresence = 0;
  let midfieldDensity = 0;
  let backLine = 0;
  let frontLine = 0;
  let wideOutlets = 0;
  let ySum = 0;
  let yMin = 100;
  let yMax = 0;
  let outfieldCount = 0;

  for (const s of slots) {
    if (s.group === 'DF') defShape += 1;
    if (s.group === 'MF' && s.y >= 55) defShape += 1;
    if (s.group === 'FW') atkShape += 1.5;
    if (s.group === 'MF' && s.y <= 35) atkShape += 1;
    if (s.group !== 'GK') {
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x);
      outfieldCount += 1;
      ySum += s.y;
      yMin = Math.min(yMin, s.y);
      yMax = Math.max(yMax, s.y);
      if (s.x >= 28 && s.x <= 72) centralPresence += 1;
      if (s.group === 'MF') midfieldDensity += 1;
      if (s.group === 'DF' || (s.group === 'MF' && s.y >= 58)) backLine += 1;
      if (s.group === 'FW' || (s.group === 'MF' && s.y <= 34)) frontLine += 1;
      if (s.x <= 18 || s.x >= 82) wideOutlets += 1;
    }
  }

  const width = maxX - minX;
  const avgY = ySum / Math.max(1, outfieldCount);
  const verticalGap = yMax - yMin;
  const compactness = clamp(1 - Math.max(0, verticalGap - 56) / 32, 0, 1);
  const profile = { defShape, atkShape, width, centralPresence, midfieldDensity, backLine, frontLine, wideOutlets, avgY, verticalGap, compactness };
  profileCache.set(formation, profile);
  return profile;
}

// Outfield slot pairs close enough on the pitch to represent players who interact
// constantly (a center back and the full back next to him, a central midfield trio,
// etc.) — used by the chemistry system to reward squads where those local partnerships
// share a real source team. Purely geometric: any two non-GK slots within ADJACENCY_DIST
// of each other (straight-line distance in the same 0-100 x/y space used to draw the pitch).
const ADJACENCY_DIST = 28;
const adjacencyCache = new Map();

function getAdjacentPairs(formation) {
  if (adjacencyCache.has(formation)) return adjacencyCache.get(formation);

  const slots = getSlots(formation).filter((s) => s.group !== 'GK');
  const pairs = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const dx = slots[i].x - slots[j].x;
      const dy = slots[i].y - slots[j].y;
      if (Math.sqrt(dx * dx + dy * dy) <= ADJACENCY_DIST) {
        pairs.push([slots[i].code, slots[j].code]);
      }
    }
  }
  adjacencyCache.set(formation, pairs);
  return pairs;
}

module.exports = {
  FORMATIONS,
  POSITION_GROUPS,
  isValidFormation,
  getSlots,
  getDescription,
  slotsFor,
  isValidSlotCode,
  slotGroup,
  playerPositionCodes,
  slotAcceptsPosition,
  playerFitsSlot,
  getProfile,
  getAdjacentPairs
};
