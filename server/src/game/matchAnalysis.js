// Turns one already-simulated match (a matchLog entry from tournamentEngine, plus which
// side the viewer's team was) into a professional, human-readable explanation of why that
// match went the way it did — pulling together the same numbers the engine actually used
// to decide it (xG, possession/shots/passing, discipline, set pieces, momentum) rather
// than just restating the scoreline. Purely narrative, generated deterministically from
// the match's own recorded data — no external calls, nothing hidden from the rest of the
// engine.

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function fmt1(n) {
  return Math.round(n * 10) / 10;
}

function resultOutcome(m, mySide) {
  if (m.wentToPenalties) {
    return m.penaltyWinner === mySide ? 'w' : 'l';
  }
  const myGoals = mySide === 'A' ? m.goalsA : m.goalsB;
  const oppGoals = mySide === 'A' ? m.goalsB : m.goalsA;
  if (myGoals > oppGoals) return 'w';
  if (myGoals < oppGoals) return 'l';
  return 'd';
}

function headline(outcome, myGoals, oppGoals, myName, oppName, m) {
  const scoreline = `${myGoals}-${oppGoals}`;
  if (m.wentToPenalties) {
    const pens = `${m.penalties.A}-${m.penalties.B}`;
    const verb = outcome === 'w' ? 'came through' : 'went out';
    return `${myName} ${verb} a ${scoreline} draw with ${oppName} on penalties (${pens}) after extra time.`;
  }
  if (m.wentToExtraTime) {
    const verb = outcome === 'w' ? 'edged' : outcome === 'l' ? 'fell to' : 'were held to';
    return `${myName} ${verb} ${oppName} ${scoreline} after extra time.`;
  }
  if (outcome === 'w') {
    const margin = myGoals - oppGoals;
    const style = margin >= 3 ? 'a commanding' : margin === 2 ? 'a comfortable' : 'a narrow';
    return `${myName} picked up ${style} ${scoreline} win over ${oppName}.`;
  }
  if (outcome === 'l') {
    const margin = oppGoals - myGoals;
    const style = margin >= 3 ? 'a heavy' : margin === 2 ? 'a disappointing' : 'a narrow';
    return `${myName} suffered ${style} ${scoreline} defeat to ${oppName}.`;
  }
  return `${myName} were held ${scoreline} by ${oppName}.`;
}

function xgStory(myGoals, oppGoals, myXg, oppXg) {
  const xgDiff = myXg - oppXg;
  const finishingDiff = myGoals - myXg;
  const oppFinishingDiff = oppGoals - oppXg;
  const sentences = [];

  if (xgDiff > 0.6) {
    sentences.push(`The underlying numbers back it up — ${fmt1(myXg)} xG created against ${fmt1(oppXg)} conceded shows this side generated clearly the better chances over the course of the match.`);
  } else if (xgDiff < -0.6) {
    sentences.push(`The underlying numbers tell a tougher story — ${fmt1(myXg)} xG against ${fmt1(oppXg)} conceded means the opponent created the more dangerous openings on the balance of play.`);
  } else {
    sentences.push(`Chance quality was close to even (${fmt1(myXg)} xG for, ${fmt1(oppXg)} against) — this was a genuinely tight contest on the numbers, not just the scoreline.`);
  }

  if (finishingDiff >= 0.8) {
    sentences.push(`Finishing was the difference-maker: converting ${myGoals} from ${fmt1(myXg)} expected goals is a clinical return well above what the chances alone suggested.`);
  } else if (finishingDiff <= -0.8) {
    sentences.push(`Finishing let this side down — ${fmt1(myXg)} xG should have produced more than ${myGoals} goal${myGoals === 1 ? '' : 's'}, and those missed opportunities are the story of the match.`);
  }

  if (oppFinishingDiff <= -0.8) {
    sentences.push(`The opponent, for their part, were wasteful in front of goal, managing only ${oppGoals} from ${fmt1(oppXg)} xG.`);
  } else if (oppFinishingDiff >= 0.8) {
    sentences.push(`The opponent were ruthless with what they had, scoring ${oppGoals} from just ${fmt1(oppXg)} xG.`);
  }

  return sentences.join(' ');
}

function territorialStory(myStats, oppStats) {
  const possDiff = myStats.possession - oppStats.possession;
  const shotDiff = myStats.shots - oppStats.shots;
  const sentences = [];

  if (possDiff >= 14) {
    sentences.push(`Territorially this was one-way traffic — ${myStats.possession}% possession and a ${myStats.shots}-${oppStats.shots} shot count both point to sustained control.`);
  } else if (possDiff <= -14) {
    sentences.push(`This side saw far less of the ball (${myStats.possession}% possession) and were outshot ${oppStats.shots}-${myStats.shots}, a sign the opponent dictated the terms of the match.`);
  } else if (shotDiff >= 6) {
    sentences.push(`Even with possession fairly even, a ${myStats.shots}-${oppStats.shots} edge in shots shows real attacking intent going forward.`);
  } else if (shotDiff <= -6) {
    sentences.push(`Despite a similar share of possession, this side managed only ${myStats.shots} shots to the opponent's ${oppStats.shots} — a passive night in the final third.`);
  }

  if (myStats.passAccuracy - oppStats.passAccuracy >= 10) {
    sentences.push(`Passing was noticeably crisper too, at ${myStats.passAccuracy}% accuracy against the opponent's ${oppStats.passAccuracy}%.`);
  } else if (oppStats.passAccuracy - myStats.passAccuracy >= 10) {
    sentences.push(`Ball retention was a problem — ${myStats.passAccuracy}% pass accuracy trailed the opponent's ${oppStats.passAccuracy}% by some distance.`);
  }

  return sentences.join(' ');
}

function disciplineStory(myReds, oppReds, myYellows, oppYellows) {
  const sentences = [];
  if (myReds > 0) {
    sentences.push(`A red card${myReds > 1 ? 's' : ''} for this side left them playing a man down for a stretch of the match, a real handicap that shows up directly in the ratings the rest of that game (Section 6.5 of the rulebook).`);
  }
  if (oppReds > 0) {
    sentences.push(`The opponent had ${oppReds > 1 ? 'players' : 'a player'} sent off, a discipline lapse that handed this side an extended numerical advantage.`);
  }
  if (myReds === 0 && oppReds === 0 && (myYellows + oppYellows) >= 6) {
    sentences.push(`A niggly, card-heavy match (${myYellows + oppYellows} yellows combined) without either side losing a man.`);
  }
  return sentences.join(' ');
}

function setPieceStory(myStats, oppStats) {
  const cornerDiff = myStats.corners - oppStats.corners;
  const foulsWon = oppStats.fouls; // fouls the opponent committed = free kicks this side won
  const sentences = [];
  if (cornerDiff >= 4 || (cornerDiff > 0 && foulsWon >= 12)) {
    sentences.push(`Set pieces played a real part — ${myStats.corners} corners won and ${foulsWon} free kicks earned from opponent fouls gave this side a steady stream of extra scoring chances beyond open play.`);
  } else if (cornerDiff <= -4) {
    sentences.push(`The opponent had the better of the set-piece battle too, winning ${oppStats.corners} corners to this side's ${myStats.corners}.`);
  }
  return sentences.join(' ');
}

function moraleStory(myMorale, oppMorale) {
  const sentences = [];
  if (myMorale >= 0.35) {
    sentences.push(`This side carried real momentum into kickoff, on the back of strong recent results — visible confidence that fed into the performance.`);
  } else if (myMorale <= -0.35) {
    sentences.push(`Confidence looked shaky coming in after a rough run of results, and it showed in a side that never quite settled.`);
  }
  if (oppMorale >= 0.35 && myMorale < 0.35) {
    sentences.push(`The opponent, by contrast, arrived full of confidence off the back of good form.`);
  } else if (oppMorale <= -0.35 && myMorale > -0.35) {
    sentences.push(`The opponent arrived under a cloud after a poor run, which this side was able to take advantage of.`);
  }
  return sentences.join(' ');
}


function pressureStory(myPressure, oppPressure) {
  if (!myPressure || !myPressure.level) return '';
  const level = Math.round(myPressure.level * 100);
  const sentences = [`Morale Dynamic mattered here: ${myPressure.label} pressure (${level}%) pushed this side's urgency before kickoff.`];
  if (myPressure.reason) sentences.push(myPressure.reason);
  if (oppPressure && oppPressure.level > myPressure.level + 0.2) sentences.push(`The opponent carried even heavier qualification pressure, which raised the match intensity on both sides.`);
  return sentences.join(' ');
}
function chemistryStory(myChem, oppChem) {
  if (!myChem || !oppChem) return '';
  const diff = myChem.multiplier - oppChem.multiplier;
  const detail = `Chemistry multiplier ${fmt1(myChem.multiplier * 100)} vs ${fmt1(oppChem.multiplier * 100)}, with ${myChem.outOfPosition || 0} out-of-position pick${(myChem.outOfPosition || 0) === 1 ? '' : 's'}.`;
  if (diff >= 0.025) return `The XI fit together better than the opponent: ${detail}`;
  if (diff <= -0.025) return `Chemistry worked against this side: ${detail}`;
  return '';
}

function tacticalStory(myTac, oppTac) {
  if (!myTac || !oppTac) return '';
  const edge = myTac.edge || 0;
  if (edge >= 0.04) return `${myTac.label} had a clear tactical answer to ${oppTac.label}, adding value to both chance creation and defensive resistance.`;
  if (edge <= -0.04) return `${myTac.label} was an awkward matchup into ${oppTac.label}, so the tactical layer tilted away from this side.`;
  return `Tactically this was close: ${myTac.label} against ${oppTac.label} did not create a major matchup swing.`;
}

function starStory(starEvents, mySide, oppSide) {
  const mine = starEvents.filter((e) => e.side === mySide);
  const opp = starEvents.filter((e) => e.side === oppSide);
  const sentences = [];
  if (mine.length) {
    sentences.push(`${mine.map((e) => e.player).join(', ')} produced a Star Moment, adding late clutch chance quality when the match was at its most fragile.`);
  }
  if (opp.length) {
    sentences.push(`The opponent also had clutch star influence through ${opp.map((e) => e.player).join(', ')}.`);
  }
  return sentences.join(' ');
}

function verdict(outcome, xgDiff, finishingDiff) {
  if (outcome === 'w') {
    if (xgDiff < 0) return `Overall: a win that owes as much to clinical finishing and a bit of fortune as to control of the match — the kind of result that doesn't always repeat.`;
    return `Overall: a deserved result that matches the balance of play.`;
  }
  if (outcome === 'l') {
    if (xgDiff > 0) return `Overall: the performance deserved more — on another night, with sharper finishing, this is a different result.`;
    return `Overall: outplayed for large stretches, and the scoreline reflects it.`;
  }
  return `Overall: an even contest that could plausibly have gone either way.`;
}

function analyzeMatch(m, mySide, myName, oppName) {
  if (!m || !m.stats) return '';
  const oppSide = mySide === 'A' ? 'B' : 'A';
  const myGoals = mySide === 'A' ? m.goalsA : m.goalsB;
  const oppGoals = mySide === 'A' ? m.goalsB : m.goalsA;
  const myXg = mySide === 'A' ? m.xgA : m.xgB;
  const oppXg = mySide === 'A' ? m.xgB : m.xgA;
  const myStats = mySide === 'A' ? m.stats.A : m.stats.B;
  const oppStats = mySide === 'A' ? m.stats.B : m.stats.A;
  const myMorale = mySide === 'A' ? (m.moraleA || 0) : (m.moraleB || 0);
  const oppMorale = mySide === 'A' ? (m.moraleB || 0) : (m.moraleA || 0);
  const myChem = mySide === 'A' ? (m.chemistry && m.chemistry.A) : (m.chemistry && m.chemistry.B);
  const oppChem = mySide === 'A' ? (m.chemistry && m.chemistry.B) : (m.chemistry && m.chemistry.A);
  const myTac = mySide === 'A' ? (m.tactical && m.tactical.A) : (m.tactical && m.tactical.B);
  const oppTac = mySide === 'A' ? (m.tactical && m.tactical.B) : (m.tactical && m.tactical.A);
  const myInfluence = mySide === 'A' ? (m.influence && m.influence.A) : (m.influence && m.influence.B);
  const oppInfluence = mySide === 'A' ? (m.influence && m.influence.B) : (m.influence && m.influence.A);
  const myPressure = mySide === 'A' ? (m.moralePressure && m.moralePressure.A) : (m.moralePressure && m.moralePressure.B);
  const oppPressure = mySide === 'A' ? (m.moralePressure && m.moralePressure.B) : (m.moralePressure && m.moralePressure.A);
  const events = m.events || [];
  const starEvents = m.starMoments || events.filter((e) => e.type === 'star');
  const myReds = events.filter((e) => e.type === 'red' && e.side === mySide).length;
  const oppReds = events.filter((e) => e.type === 'red' && e.side === oppSide).length;
  const myYellows = events.filter((e) => e.type === 'yellow' && e.side === mySide).length;
  const oppYellows = events.filter((e) => e.type === 'yellow' && e.side === oppSide).length;
  const outcome = resultOutcome(m, mySide);
  const xgDiff = myXg - oppXg;
  const finishingDiff = myGoals - myXg;
  const shotDiff = myStats.shots - oppStats.shots;
  const sotDiff = myStats.shotsOnTarget - oppStats.shotsOnTarget;
  const possDiff = myStats.possession - oppStats.possession;
  const saveSwing = myStats.saves - oppStats.saves;
  const disciplineSwing = (oppYellows + oppReds * 2) - (myYellows + myReds * 2);

  const factors = [];
  const addFactor = (label, value, detail, tone = 'neutral') => factors.push({ label, value, detail, tone });
  addFactor('xG Balance', `${xgDiff >= 0 ? '+' : ''}${fmt1(xgDiff)}`, xgDiff >= 0.6 ? 'Created the better chance quality.' : xgDiff <= -0.6 ? 'Opponent produced the stronger chances.' : 'Chance quality was almost level.', xgDiff >= 0.4 ? 'good' : xgDiff <= -0.4 ? 'bad' : 'neutral');
  addFactor('Finishing', `${finishingDiff >= 0 ? '+' : ''}${fmt1(finishingDiff)}`, finishingDiff >= 0.8 ? 'Finished well above expected output.' : finishingDiff <= -0.8 ? 'Chances were left on the table.' : 'Conversion tracked the chance quality.', finishingDiff >= 0.6 ? 'good' : finishingDiff <= -0.6 ? 'bad' : 'neutral');
  addFactor('Shot Pressure', `${shotDiff >= 0 ? '+' : ''}${shotDiff}`, `${myStats.shots}-${oppStats.shots} shots, ${myStats.shotsOnTarget}-${oppStats.shotsOnTarget} on target.`, shotDiff >= 4 || sotDiff >= 2 ? 'good' : shotDiff <= -4 || sotDiff <= -2 ? 'bad' : 'neutral');
  addFactor('Control', `${possDiff >= 0 ? '+' : ''}${possDiff}%`, `${myStats.possession}% possession and ${myStats.passAccuracy}% pass accuracy.`, possDiff >= 10 ? 'good' : possDiff <= -10 ? 'bad' : 'neutral');
  addFactor('Keeper Impact', `${saveSwing >= 0 ? '+' : ''}${saveSwing}`, `${myStats.saves} saves for, ${oppStats.saves} against.`, saveSwing >= 2 ? 'good' : saveSwing <= -2 ? 'bad' : 'neutral');
  if (myChem && oppChem) {
    const chemDiff = myChem.multiplier - oppChem.multiplier;
    addFactor('Chemistry', `${chemDiff >= 0 ? '+' : ''}${fmt1(chemDiff * 100)}%`, `Fit ${Math.round((myChem.positionFit || 0) * 100)}%, line balance ${Math.round((myChem.lineBalance || 0) * 100)}%, OOP ${myChem.outOfPosition || 0}.`, chemDiff >= 0.015 ? 'good' : chemDiff <= -0.015 ? 'bad' : 'neutral');
  }
  if (myTac && oppTac) {
    addFactor('Tactical Style', myTac.label, `${myTac.label} vs ${oppTac.label}; matchup edge ${myTac.edge >= 0 ? '+' : ''}${fmt1(myTac.edge * 100)}%.`, myTac.edge >= 0.035 ? 'good' : myTac.edge <= -0.035 ? 'bad' : 'neutral');
  }
  if (myPressure && myPressure.level > 0) {
    const pressureDiff = myPressure.level - ((oppPressure && oppPressure.level) || 0);
    const pressureDetail = `${myPressure.label}${myPressure.reason ? ` - ${myPressure.reason}` : ''}`;
    addFactor('Morale Dynamic', `${Math.round(myPressure.level * 100)}%`, pressureDetail, pressureDiff >= 0.2 ? 'good' : pressureDiff <= -0.2 ? 'bad' : 'neutral');
  }
  if (myInfluence && oppInfluence) {
    const creatorDiff = myInfluence.supportFocus - oppInfluence.supportFocus;
    const attackDiff = myInfluence.attackFocus - oppInfluence.attackFocus;
    const detail = `Creator ${Math.round(myInfluence.supportFocus)} vs ${Math.round(oppInfluence.supportFocus)}, finisher ${Math.round(myInfluence.attackFocus)} vs ${Math.round(oppInfluence.attackFocus)}, shield ${Math.round(myInfluence.shieldFocus)}.`;
    addFactor('Player Influence', `${attackDiff >= 0 ? '+' : ''}${fmt1(attackDiff)}`, detail, creatorDiff >= 4 || attackDiff >= 4 ? 'good' : creatorDiff <= -4 || attackDiff <= -4 ? 'bad' : 'neutral');
  }
  if (starEvents.length) {
    const myStars = starEvents.filter((e) => e.side === mySide);
    const oppStars = starEvents.filter((e) => e.side === oppSide);
    addFactor('Star Moments', `${myStars.length}-${oppStars.length}`, myStars.length ? `${myStars.map((e) => e.player).join(', ')} created clutch xG.` : 'Opponent stars created the clutch swing.', myStars.length > oppStars.length ? 'good' : myStars.length < oppStars.length ? 'bad' : 'neutral');
  }
  if (myReds || oppReds || myYellows + oppYellows >= 5) addFactor('Discipline', `${disciplineSwing >= 0 ? '+' : ''}${disciplineSwing}`, `${myYellows}Y/${myReds}R vs ${oppYellows}Y/${oppReds}R.`, disciplineSwing > 0 ? 'good' : disciplineSwing < 0 ? 'bad' : 'neutral');
  if (m.wentToPenalties) addFactor('Shootout', m.penaltyWinner === mySide ? 'Won' : 'Lost', `Penalty score ${m.penalties[mySide]}-${m.penalties[oppSide]}.`, m.penaltyWinner === mySide ? 'good' : 'bad');
  else if (m.wentToExtraTime) addFactor('Extra Time', `${mySide === 'A' ? m.etGoalsA : m.etGoalsB}-${mySide === 'A' ? m.etGoalsB : m.etGoalsA}`, 'The knockout match needed 120 minutes.', outcome === 'w' ? 'good' : outcome === 'l' ? 'bad' : 'neutral');

  const parts = [
    headline(outcome, myGoals, oppGoals, myName, oppName, m),
    xgStory(myGoals, oppGoals, myXg, oppXg),
    territorialStory(myStats, oppStats),
    disciplineStory(myReds, oppReds, myYellows, oppYellows),
    setPieceStory(myStats, oppStats),
    moraleStory(myMorale, oppMorale),
    chemistryStory(myChem, oppChem),
    tacticalStory(myTac, oppTac),
    starStory(starEvents, mySide, oppSide)
  ].filter(Boolean);
  const finalVerdict = verdict(outcome, xgDiff, finishingDiff);

  return {
    summary: parts.join(' '),
    verdict: finalVerdict,
    metrics: [
      { label: 'xG', mine: fmt1(myXg), opponent: fmt1(oppXg) },
      { label: 'Shots', mine: myStats.shots, opponent: oppStats.shots },
      { label: 'On Target', mine: myStats.shotsOnTarget, opponent: oppStats.shotsOnTarget },
      { label: 'Possession', mine: `${myStats.possession}%`, opponent: `${oppStats.possession}%` },
      { label: 'Pass Acc.', mine: `${myStats.passAccuracy}%`, opponent: `${oppStats.passAccuracy}%` },
      { label: 'Chemistry', mine: myChem ? `${fmt1(myChem.multiplier * 100)}%` : '-', opponent: oppChem ? `${fmt1(oppChem.multiplier * 100)}%` : '-' },
      { label: 'Style', mine: myTac ? myTac.label : '-', opponent: oppTac ? oppTac.label : '-' },
      { label: 'Influence', mine: myInfluence ? Math.round((myInfluence.attackFocus + myInfluence.supportFocus) / 2) : '-', opponent: oppInfluence ? Math.round((oppInfluence.attackFocus + oppInfluence.supportFocus) / 2) : '-' },
      { label: 'Saves', mine: myStats.saves, opponent: oppStats.saves }
    ],
    factors
  };
}

module.exports = { analyzeMatch, resultOutcome };
