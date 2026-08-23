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
  const events = m.events || [];
  const myReds = events.filter((e) => e.type === 'red' && e.side === mySide).length;
  const oppReds = events.filter((e) => e.type === 'red' && e.side === oppSide).length;
  const myYellows = events.filter((e) => e.type === 'yellow' && e.side === mySide).length;
  const oppYellows = events.filter((e) => e.type === 'yellow' && e.side === oppSide).length;

  const outcome = resultOutcome(m, mySide);
  const xgDiff = myXg - oppXg;
  const finishingDiff = myGoals - myXg;

  const parts = [
    headline(outcome, myGoals, oppGoals, myName, oppName, m),
    xgStory(myGoals, oppGoals, myXg, oppXg),
    territorialStory(myStats, oppStats),
    disciplineStory(myReds, oppReds, myYellows, oppYellows),
    setPieceStory(myStats, oppStats),
    moraleStory(myMorale, oppMorale),
    verdict(outcome, xgDiff, finishingDiff)
  ].filter(Boolean);

  return parts.join(' ');
}

module.exports = { analyzeMatch, resultOutcome };
