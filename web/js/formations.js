// Mirrors server/src/game/formations.js — keep in sync. Explicit named slots per formation
// (not just position-group counts) so the pitch UI can render real positions and let the
// player choose the exact slot (e.g. which side of central defense) when drafting.

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

const FORMATION_NAMES = Object.keys(FORMATIONS);

function getSlots(formation) {
  const f = FORMATIONS[formation] || FORMATIONS['4-3-3'];
  return f.slots;
}

function getDescription(formation) {
  const f = FORMATIONS[formation] || FORMATIONS['4-3-3'];
  return f.description;
}

const POS_LABEL = { GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Forward' };

const STAGE_LABEL = {
  lobby: 'Lobby',
  drafting: 'Drafting Players',
  group: 'Group Stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  final: 'Final',
  done: 'Tournament Finished'
};
