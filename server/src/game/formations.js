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
const FORMATION_DEEP_INFO = {
  '4-3-3': {
    keywords: ['Width', 'High press', 'Three forwards'],
    bestStyles: ['gegenpress', 'wingplay', 'possession'],
    worstStyles: ['defensive', 'compact'],
    synergy: 'Classic high-tempo width. The three forwards thrive on gegenpress turnovers and wingplay crosses. Avoid ultra-defensive styles — the back four is exposed and the three CMs need space to advance.',
    xgProfile: 'Midfield creates 55% / Strikers convert 45%. Balanced split with wide creators.',
    archetype: 'Modern-Attack',
    biases: { width: 1.22, highline: 1.12, buildup: 1.06, setPiece: 1.0, physicality: 1.0 }
  },
  '4-4-2': {
    keywords: ['Two banks of four', 'Strike partnership', 'Balanced'],
    bestStyles: ['direct', 'balanced', 'wingplay'],
    worstStyles: ['tiki-taka', 'gegenpress'],
    synergy: 'Two strikers feast on direct balls and flick-ons. The flat four-man midfield lacks central density for tiki-taka but is perfect for wing-play width and counter-attack speed.',
    xgProfile: 'Midfield creates 45% / Strikers convert 55%. Strike partnership drives finishing.',
    archetype: 'Classic-Balanced',
    biases: { width: 1.06, highline: 0.96, buildup: 0.88, setPiece: 1.12, physicality: 1.1 }
  },
  '4-2-3-1': {
    keywords: ['Double pivot', 'No.10 playmaker', 'Creative overload'],
    bestStyles: ['possession', 'tiki-taka', 'balanced'],
    worstStyles: ['direct', 'defensive'],
    synergy: 'The CAM (No.10) plus two CDMs behind him is the possession king — 5-man midfield generates xG through circulation. Bad for direct play because the lone striker gets isolated.',
    xgProfile: 'Midfield creates 65% / Strikers convert 35%. Creator-heavy, conversion-reliant on one finisher.',
    archetype: 'Possession-Playmaker',
    biases: { width: 0.96, highline: 1.06, buildup: 1.2, setPiece: 0.98, physicality: 0.94 }
  },
  '4-5-1': {
    keywords: ['Compact midfield', 'Counter ready', 'Low block'],
    bestStyles: ['counter', 'defensive', 'compact'],
    worstStyles: ['direct', 'tiki-taka'],
    synergy: 'Five-man midfield absorbs pressure then releases wingers on the break. Ideal counter shape. The lone striker needs elite finishing because chance creation is deliberately low.',
    xgProfile: 'Midfield creates 40% / Strikers convert 60%. Counter specialist: low volume, high-value breaks.',
    archetype: 'Counter-LowBlock',
    biases: { width: 0.96, highline: 0.72, buildup: 0.88, setPiece: 1.04, physicality: 1.08 }
  },
  '3-4-3': {
    keywords: ['Bold width', 'Back three', 'High risk high reward'],
    bestStyles: ['wingplay', 'gegenpress', 'direct'],
    worstStyles: ['defensive', 'compact'],
    synergy: 'Two wide wing-backs plus two wide forwards = max width. Wing Play thrives. Gegenpress wins the ball high; the three-man backline covers. Avoid deep blocks because the wing-backs leave flank space behind.',
    xgProfile: 'Midfield creates 50% / Strikers convert 50%. Front three shoulders the load.',
    archetype: 'Modern-Wingback',
    biases: { width: 1.42, highline: 1.18, buildup: 0.96, setPiece: 1.12, physicality: 1.04 }
  },
  '3-5-2': {
    keywords: ['Five-man midfield', 'Wing-backs', 'Strike duo'],
    bestStyles: ['possession', 'compact', 'tiki-taka'],
    worstStyles: ['defensive', 'direct'],
    synergy: 'Wing-backs provide the width while five central players dominate the middle. Possession and Compact shine with this much central density. Two strikers finish well from wing-back crosses.',
    xgProfile: 'Midfield creates 60% / Strikers convert 40%. Central overload = more created chances.',
    archetype: 'Central-Overload',
    biases: { width: 1.04, highline: 1.08, buildup: 1.14, setPiece: 1.06, physicality: 1.04 }
  },
  '5-4-1': {
    keywords: ['Fortress back five', 'Deep block', 'Rare breaks'],
    bestStyles: ['defensive', 'counter', 'compact'],
    worstStyles: ['tiki-taka', 'gegenpress', 'wingplay'],
    synergy: 'Parking the bus at its finest. Three CBs + two wing-backs in a deep five-man line. Counter-attack or Defensive only — anything more adventurous wastes the shape.',
    xgProfile: 'Midfield creates 35% / Strikers convert 65%. Striker is isolated, so elite finishing is mandatory.',
    archetype: 'Deep-Block-Fortress',
    biases: { width: 0.86, highline: 0.54, buildup: 0.68, setPiece: 1.18, physicality: 1.16 }
  },
  '4-1-2-1-2': {
    keywords: ['Narrow diamond', 'Through the middle', 'No width'],
    bestStyles: ['compact', 'tiki-taka', 'possession'],
    worstStyles: ['wingplay', 'direct'],
    synergy: 'The diamond has no natural wingers — wing-play is wasted. Compact and Tiki-Taka crush the central lanes. Two strikers finish through-ball chances created by the No.10.',
    xgProfile: 'Midfield creates 62% / Strikers convert 38%. Midfield diamond is the engine; two finishers share the spoils.',
    archetype: 'Narrow-Diamond',
    biases: { width: 0.62, highline: 1.02, buildup: 1.18, setPiece: 0.92, physicality: 1.04 }
  },
  '4-4-1-1': {
    keywords: ['Second striker', 'Link play', 'False forward'],
    bestStyles: ['balanced', 'counter', 'possession'],
    worstStyles: ['wingplay', 'defensive'],
    synergy: 'The SS (second striker) links midfield and attack. Perfect for patient build-up or counter transitions. Not ideal for pure wing-play because the SS narrows the attack.',
    xgProfile: 'Midfield creates 55% / Strikers convert 45%. The SS acts as creator + finisher.',
    archetype: 'Link-Play',
    biases: { width: 0.92, highline: 0.94, buildup: 1.04, setPiece: 1.02, physicality: 1.0 }
  },
  '5-3-2': {
    keywords: ['Back five', 'Solid', 'Strike partnership'],
    bestStyles: ['defensive', 'counter', 'compact'],
    worstStyles: ['tiki-taka', 'wingplay'],
    synergy: 'Three central midfielders in the engine room with a back five shield. Defensive and Counter styles shine. Two strikers handle the finishing. No room for wide play.',
    xgProfile: 'Midfield creates 45% / Strikers convert 55%. The two finishers carry the goalscoring.',
    archetype: 'Solid-Counter',
    biases: { width: 0.8, highline: 0.78, buildup: 0.9, setPiece: 1.12, physicality: 1.14 }
  },
  '3-4-1-2': {
    keywords: ['No.10 freedom', 'Back three', 'Two strikers'],
    bestStyles: ['tiki-taka', 'possession', 'balanced'],
    worstStyles: ['defensive', 'direct'],
    synergy: 'CAM feeds two strikers from a free central role. Possession & Tiki-Taka maximize touches for the playmaker. Not defensive — the back three relies on ball retention.',
    xgProfile: 'Midfield creates 63% / Strikers convert 37%. Playmaker drives creation; two poachers finish.',
    archetype: 'Playmaker-Front2',
    biases: { width: 0.9, highline: 1.12, buildup: 1.16, setPiece: 0.98, physicality: 0.98 }
  },
  '4-2-2-2': {
    keywords: ['Magic rectangle', 'Two pivots, two playmakers'],
    bestStyles: ['possession', 'tiki-taka', 'balanced'],
    worstStyles: ['direct', 'defensive'],
    synergy: 'Two CDM + two attacking midfielders = the "magic rectangle" of short passing. Tiki-Taka loves this shape. Two strikers are pure finishers fed by the central creators.',
    xgProfile: 'Midfield creates 68% / Strikers convert 32%. Creator heavy; strikers get spoon-fed chances.',
    archetype: 'Magic-Rectangle',
    biases: { width: 0.9, highline: 1.04, buildup: 1.22, setPiece: 1.0, physicality: 0.92 }
  },
  '5-2-3': {
    keywords: ['Back five, front three', 'Wide outlet forwards'],
    bestStyles: ['counter', 'wingplay', 'defensive'],
    worstStyles: ['tiki-taka', 'compact'],
    synergy: 'Defensive solidity at the back with explosive forwards up top. Counter and Wing Play thrive. Front three covers width. Avoid Tiki-Taka — only two CMs can\'t circulate.',
    xgProfile: 'Midfield creates 42% / Strikers convert 58%. Counter-release forwards need elite finishing.',
    archetype: 'Solid-Front3',
    biases: { width: 1.22, highline: 0.72, buildup: 0.82, setPiece: 1.12, physicality: 1.1 }
  },
  '5-3-1-1': {
    keywords: ['Defensive fortress', 'SS link + target man'],
    bestStyles: ['counter', 'defensive', 'direct'],
    worstStyles: ['tiki-taka', 'wingplay'],
    synergy: 'Extreme low-block. Direct balls to the target man ST; the SS holds and links. Only counter/defensive/direct make sense — too defensive for anything else.',
    xgProfile: 'Midfield creates 32% / Strikers convert 68%. Elite strikers only; creation is minimal.',
    archetype: 'Bunker-Linkup',
    biases: { width: 0.72, highline: 0.5, buildup: 0.62, setPiece: 1.22, physicality: 1.22 }
  },
  '3-2-4-1': {
    keywords: ['Six attackers', 'Double pivot shield', 'Gegenpress ready'],
    bestStyles: ['gegenpress', 'wingplay', 'possession'],
    worstStyles: ['defensive', 'direct'],
    synergy: 'Four attacking midfielders plus a striker: heavy forward commitment. Gegenpress wins turnovers into the overload. Wing Play uses the wide outlets. Bad defensively.',
    xgProfile: 'Midfield creates 66% / Strikers convert 34%. Creator deluge; one finisher gets fed.',
    archetype: 'Gegen-Front6',
    biases: { width: 1.16, highline: 1.3, buildup: 1.14, setPiece: 0.94, physicality: 1.0 }
  },
  '3-3-2-2': {
    keywords: ['Compact triangle', 'Half-space creators', 'Two finishers'],
    bestStyles: ['tiki-taka', 'possession', 'compact'],
    worstStyles: ['wingplay', 'direct'],
    synergy: 'Central overload with two creators and two finishers. Tiki-Taka and Compact dominate the middle. Wing Play is wasted because the shape is narrow and central.',
    xgProfile: 'Midfield creates 64% / Strikers convert 36%. Half-space creators do the work.',
    archetype: 'Narrow-HalfSpaces',
    biases: { width: 0.76, highline: 1.08, buildup: 1.18, setPiece: 0.94, physicality: 1.04 }
  },
  '4-1-4-1': {
    keywords: ['Single pivot shield', 'Advanced eights', 'Wide mids'],
    bestStyles: ['possession', 'balanced', 'gegenpress'],
    worstStyles: ['direct', 'defensive'],
    synergy: 'The CDM protects while four advanced midfielders push on. Possession circulates; Gegenpress wins it high. Bad for Direct because the lone striker is isolated from long balls.',
    xgProfile: 'Midfield creates 60% / Strikers convert 40%. Midfield-heavy; finisher needs to hold-up play.',
    archetype: 'Shield-Advanced8',
    biases: { width: 1.08, highline: 1.1, buildup: 1.14, setPiece: 0.98, physicality: 0.98 }
  },
  '5-2-2-1': {
    keywords: ['Deep five, double pivot, two narrow creators'],
    bestStyles: ['compact', 'defensive', 'counter'],
    worstStyles: ['wingplay', 'tiki-taka'],
    synergy: 'Central compactness at both ends. Creators narrow behind a lone striker. Defend first, counter in numbers. No wide outlets so Wing Play is pointless.',
    xgProfile: 'Midfield creates 48% / Strikers convert 52%. Narrow creators feed a clinical finisher.',
    archetype: 'Compact-Narrow',
    biases: { width: 0.78, highline: 0.72, buildup: 0.94, setPiece: 1.04, physicality: 1.1 }
  },
  '3-5-1-1': {
    keywords: ['Five-man midfield', 'Close striker pair'],
    bestStyles: ['possession', 'compact', 'tiki-taka'],
    worstStyles: ['direct', 'wingplay'],
    synergy: 'SS + ST close together behind a five-man midfield. Possession and Compact play through the middle. Bad for direct because five midfielders clog the pass lanes for long balls.',
    xgProfile: 'Midfield creates 58% / Strikers convert 42%. The SS bridges creation & finishing.',
    archetype: 'Possession-StrikeLink',
    biases: { width: 0.96, highline: 1.02, buildup: 1.18, setPiece: 1.02, physicality: 1.02 }
  },
  '2-5-2-1': {
    keywords: ['Two CBs only', 'Radical possession shape'],
    bestStyles: ['tiki-taka', 'possession', 'compact'],
    worstStyles: ['direct', 'counter', 'defensive'],
    synergy: 'Only two centre-backs — radical, for elite ball-players only. Tiki-Taka and Possession must dominate because if you lose the ball, two CBs are exposed. Never direct or counter.',
    xgProfile: 'Midfield creates 72% / Strikers convert 28%. Midfield is everything; ST gets spoon-fed.',
    archetype: 'Radical-BuildUp',
    biases: { width: 0.92, highline: 1.24, buildup: 1.42, setPiece: 0.82, physicality: 0.86 }
  },
  '3-3-1-3': {
    keywords: ['Front three + No.10', 'Sustained pressure'],
    bestStyles: ['gegenpress', 'possession', 'wingplay'],
    worstStyles: ['defensive', 'direct'],
    synergy: 'Four real forwards plus a No.10: huge attacking commitment. Gegenpress and Possession work. Wing Play uses the wide forwards. Never defensive — too thin at the back.',
    xgProfile: 'Midfield creates 56% / Strikers convert 44%. Three finishers share conversion duties.',
    archetype: 'All-Attack-Presser',
    biases: { width: 1.2, highline: 1.26, buildup: 1.08, setPiece: 0.92, physicality: 0.96 }
  },
  '4-3-2-1': {
    keywords: ['Christmas tree', 'Three CMs + two creators + one finisher'],
    bestStyles: ['possession', 'tiki-taka', 'compact'],
    worstStyles: ['direct', 'wingplay'],
    synergy: 'Narrow "Christmas tree" — three CMs + two creators + one ST. Possession/Tiki-Taka/Compact all use central density well. No wingers so Wing Play is wasted.',
    xgProfile: 'Midfield creates 67% / Strikers convert 33%. One elite finisher needed; creators supply everything.',
    archetype: 'Christmas-Tree',
    biases: { width: 0.74, highline: 1.08, buildup: 1.22, setPiece: 0.94, physicality: 1.0 }
  },
  '4-3-1-2': {
    keywords: ['Narrow diamond variant', 'Playmaker + two strikers'],
    bestStyles: ['tiki-taka', 'possession', 'compact'],
    worstStyles: ['wingplay', 'direct'],
    synergy: 'The CDM + 2 CM + CAM diamond feeds two strikers. Tiki-Taka builds through the diamond. Compact uses the narrow density. Wing Play wasted with no wingers.',
    xgProfile: 'Midfield creates 63% / Strikers convert 37%. Diamond creators feed two poachers.',
    archetype: 'Diamond-Front2',
    biases: { width: 0.68, highline: 1.06, buildup: 1.2, setPiece: 0.92, physicality: 1.04 }
  },
  '4-2-4': {
    keywords: ['Four forwards', 'Direct chaos', 'Midfield thin'],
    bestStyles: ['direct', 'gegenpress', 'counter'],
    worstStyles: ['tiki-taka', 'possession', 'compact'],
    synergy: 'Only two CMs vs four forwards — Tiki-Taka and Possession are impossible (no one to circulate). Direct balls, gegenpress turnovers, and counter-release all feed the four forwards. High risk, high reward.',
    xgProfile: 'Midfield creates 30% / Strikers convert 70%. The four forwards are pure finishers; midfield just wins balls.',
    archetype: 'Chaos-Front4',
    biases: { width: 1.18, highline: 1.16, buildup: 0.62, setPiece: 1.18, physicality: 1.12 }
  }
};

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

function getDeepInfo(formation) {
  return FORMATION_DEEP_INFO[formation] || null;
}

function getStyleSynergy(formation, tacticalStyle) {
  const info = FORMATION_DEEP_INFO[formation];
  if (!info) return { match: 'neutral', bonus: 1, label: 'Neutral fit' };
  const style = String(tacticalStyle || '').toLowerCase();
  if (info.bestStyles && info.bestStyles.includes(style)) {
    return { match: 'great', bonus: clamp(1 + 0.018 + Math.random() * 0.012, 1.012, 1.032), label: 'Great fit — this style amplifies the formation' };
  }
  if (info.worstStyles && info.worstStyles.includes(style)) {
    return { match: 'poor', bonus: clamp(0.968 - Math.random() * 0.012, 0.958, 0.982), label: 'Poor fit — the style fights the formation shape' };
  }
  return { match: 'neutral', bonus: 1 + (Math.random() - 0.5) * 0.01, label: 'Neutral fit' };
}

function getCombinedBiases(formation, styleDef) {
  const info = FORMATION_DEEP_INFO[formation];
  const inherent = (info && info.biases) || { width: 1, highline: 1, buildup: 1, setPiece: 1, physicality: 1 };
  const s = styleDef || {};
  return {
    width: clamp(inherent.width * (s.widthBias || 1), 0.55, 1.6),
    highline: clamp(inherent.highline * (s.highlineBias || 1), 0.45, 1.65),
    buildup: clamp(inherent.buildup * (s.buildupBias || 1), 0.45, 1.7),
    setPiece: clamp(inherent.setPiece * (s.setPieceBias || 1), 0.6, 1.55),
    physicality: clamp(inherent.physicality * (s.physicalityBias || 1), 0.6, 1.5),
    creation: clamp((s.midfieldBias || 1), 0.55, 1.45),
    conversion: clamp((s.finishingBias || 1), 0.7, 1.35)
  };
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
  getAdjacentPairs,
  getDeepInfo,
  getStyleSynergy,
  getCombinedBiases
};
