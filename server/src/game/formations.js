// Formation -> position-group slot counts. Every formation always sums to 11.
const FORMATIONS = {
  '4-3-3': { GK: 1, DF: 4, MF: 3, FW: 3 },
  '4-4-2': { GK: 1, DF: 4, MF: 4, FW: 2 },
  '4-2-3-1': { GK: 1, DF: 4, MF: 5, FW: 1 },
  '3-5-2': { GK: 1, DF: 3, MF: 5, FW: 2 },
  '5-3-2': { GK: 1, DF: 5, MF: 3, FW: 2 },
  '4-1-4-1': { GK: 1, DF: 4, MF: 5, FW: 1 }
};

const POSITION_GROUPS = ['GK', 'DF', 'MF', 'FW'];

function slotsFor(formation) {
  return FORMATIONS[formation] || FORMATIONS['4-3-3'];
}

function isValidFormation(formation) {
  return Object.prototype.hasOwnProperty.call(FORMATIONS, formation);
}

module.exports = { FORMATIONS, POSITION_GROUPS, slotsFor, isValidFormation };
