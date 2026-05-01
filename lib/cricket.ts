export type BallEvent =
  | { type: 'runs'; runs: number }
  | { type: 'wide' }
  | { type: 'noball'; runs: number }
  | { type: 'wicket'; runs: number; dismissal: string };

export interface BatsmanScore {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissal?: string;
  onStrike: boolean;
}

export interface BowlerScore {
  name: string;
  overs: number;
  balls: number;
  runs: number;
  wickets: number;
  wides: number;
  noBalls: number;
}

export interface Innings {
  battingTeam: string;
  bowlingTeam: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  extras: { wides: number; noBalls: number; byes: number; legByes: number };
  batsmen: BatsmanScore[];
  bowlers: BowlerScore[];
  currentBowlerIndex: number;
  ballLog: string[];
  isComplete: boolean;
  target?: number;
}

export interface Match {
  id: string;
  title: string;
  team1: string;
  team2: string;
  overs: number;
  status: 'upcoming' | 'live' | 'innings_break' | 'completed';
  tossWinner?: string;
  tossChoice?: 'bat' | 'bowl';
  innings: [Innings?, Innings?];
  currentInnings: 0 | 1;
  result?: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Cricket Logic ────────────────────────────────────────────────────────────

export function createInnings(
  battingTeam: string,
  bowlingTeam: string,
  target?: number
): Innings {
  return {
    battingTeam,
    bowlingTeam,
    runs: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    batsmen: [],
    bowlers: [],
    currentBowlerIndex: -1,
    ballLog: [],
    isComplete: false,
    target,
  };
}

export function getStrikeBatsman(innings: Innings): number {
  return innings.batsmen.findIndex(b => b.onStrike && !b.isOut);
}

export function getNonStrikeBatsman(innings: Innings): number {
  return innings.batsmen.findIndex(b => !b.onStrike && !b.isOut);
}

export function formatOvers(overs: number, balls: number): string {
  return `${overs}.${balls}`;
}

export function totalBallsBowled(overs: number, balls: number): number {
  return overs * 6 + balls;
}

export function applyBallEvent(
  innings: Innings,
  event: BallEvent,
  maxOvers: number
): Innings {
  const inn = structuredClone(innings) as Innings;

  const strikerIdx = getStrikeBatsman(inn);
  const nonStrikerIdx = getNonStrikeBatsman(inn);
  const bowler = inn.bowlers[inn.currentBowlerIndex];

  switch (event.type) {

    case 'runs': {
      const r = event.runs;
      inn.runs += r;
      inn.batsmen[strikerIdx].runs += r;
      inn.batsmen[strikerIdx].balls += 1;
      if (r === 4) inn.batsmen[strikerIdx].fours += 1;
      if (r === 6) inn.batsmen[strikerIdx].sixes += 1;
      bowler.runs += r;
      inn.ballLog.push(r === 0 ? '•' : String(r));

      // Strike rotation on odd runs
      if (r % 2 !== 0 && nonStrikerIdx !== -1) {
        inn.batsmen[strikerIdx].onStrike = false;
        inn.batsmen[nonStrikerIdx].onStrike = true;
      }

      inn.balls += 1;
      bowler.balls += 1;

      // End of over
      if (inn.balls === 6) {
        inn.overs += 1;
        inn.balls = 0;
        bowler.overs += 1;
        bowler.balls = 0;
        // Always rotate strike at end of over
        if (nonStrikerIdx !== -1) {
          inn.batsmen[strikerIdx].onStrike = !inn.batsmen[strikerIdx].onStrike;
          inn.batsmen[nonStrikerIdx].onStrike = !inn.batsmen[nonStrikerIdx].onStrike;
        }
        inn.currentBowlerIndex = -1; // needs new bowler
      }
      break;
    }

    case 'wide': {
      inn.runs += 1;
      inn.extras.wides += 1;
      bowler.runs += 1;
      bowler.wides += 1;
      inn.ballLog.push('wd');
      // Ball NOT counted toward over
      break;
    }

    case 'noball': {
      const r = event.runs;
      inn.runs += 1 + r;
      inn.extras.noBalls += 1;
      if (r > 0) {
        inn.batsmen[strikerIdx].runs += r;
        if (r === 4) inn.batsmen[strikerIdx].fours += 1;
        if (r === 6) inn.batsmen[strikerIdx].sixes += 1;
      }
      bowler.runs += 1 + r;
      bowler.noBalls += 1;
      inn.ballLog.push(r > 0 ? `nb+${r}` : 'nb');
      // Ball NOT counted toward over
      // Strike rotation on odd bat runs
      if (r % 2 !== 0 && nonStrikerIdx !== -1) {
        inn.batsmen[strikerIdx].onStrike = false;
        inn.batsmen[nonStrikerIdx].onStrike = true;
      }
      break;
    }

    case 'wicket': {
      const r = event.runs;

      if (r > 0) {
        inn.runs += r;
        inn.batsmen[strikerIdx].runs += r;
        if (r === 4) inn.batsmen[strikerIdx].fours += 1;
        if (r === 6) inn.batsmen[strikerIdx].sixes += 1;
        // Strike rotation before wicket if odd runs (batsman crossed)
        if (r % 2 !== 0 && nonStrikerIdx !== -1) {
          inn.batsmen[strikerIdx].onStrike = false;
          inn.batsmen[nonStrikerIdx].onStrike = true;
        }
      }

      // Dismiss the striker
      inn.batsmen[strikerIdx].balls += 1;
      inn.batsmen[strikerIdx].isOut = true;
      inn.batsmen[strikerIdx].dismissal = event.dismissal || 'Out';
      inn.batsmen[strikerIdx].onStrike = false;

      bowler.runs += r;
      bowler.wickets += 1;
      bowler.balls += 1;

      inn.wickets += 1;
      inn.ballLog.push(r > 0 ? `${r}W` : 'W');

      inn.balls += 1;

      // End of over on wicket ball
      if (inn.balls === 6) {
        inn.overs += 1;
        inn.balls = 0;
        bowler.overs += 1;
        bowler.balls = 0;
        inn.currentBowlerIndex = -1;
        // Per cricket rules: non-striker faces next over.
        // New batsman (coming in via add_batsman) will be at non-strike end.
        if (nonStrikerIdx !== -1) {
          inn.batsmen[nonStrikerIdx].onStrike = true;
        }
      }
      break;
    }
  }

  // ── Check innings completion ──────────────────────────────────────────────

  // All 10 wickets down
  if (inn.wickets >= 10) {
    inn.isComplete = true;
  }
  // Overs complete
  else if (totalBallsBowled(inn.overs, inn.balls) >= maxOvers * 6) {
    inn.isComplete = true;
  }
  // Target reached (2nd innings win)
  else if (inn.target !== undefined && inn.runs >= inn.target) {
    inn.isComplete = true;
  }

  return inn;
}

export function computeResult(match: Match): string {
  const inn1 = match.innings[0]!;
  const inn2 = match.innings[1]!;

  if (inn1.runs === inn2.runs) return 'Match Tied';

  if (inn2.runs >= (inn2.target ?? inn1.runs + 1)) {
    const wicketsLeft = 10 - inn2.wickets;
    return `${inn2.battingTeam} won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`;
  } else {
    const runDiff = inn1.runs - inn2.runs;
    return `${inn1.battingTeam} won by ${runDiff} run${runDiff !== 1 ? 's' : ''}`;
  }
}

export function getRunRate(runs: number, overs: number, balls: number): string {
  const total = totalBallsBowled(overs, balls);
  if (total === 0) return '0.00';
  return ((runs / total) * 6).toFixed(2);
}

export function getRequiredRunRate(
  target: number,
  currentRuns: number,
  ballsRemaining: number
): string {
  if (ballsRemaining <= 0) return '∞';
  const needed = target - currentRuns;
  if (needed <= 0) return '0.00';
  return ((needed / ballsRemaining) * 6).toFixed(2);
}