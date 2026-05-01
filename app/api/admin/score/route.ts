import { NextRequest } from 'next/server';
import { getMatch, saveMatch, publishUpdate } from '@/lib/redis';
import { verifyAdminPassword, unauthorizedResponse } from '@/lib/auth';
import {
  applyBallEvent,
  computeResult,
  createInnings,
  type BallEvent,
  type BatsmanScore,
  type BowlerScore,
} from '@/lib/cricket';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { password, matchId, action, payload } = body;

  if (!verifyAdminPassword(password)) return unauthorizedResponse();

  const match = await getMatch(matchId);
  if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });

  switch (action) {

    // ── Toss ────────────────────────────────────────────────────────────────
    case 'toss': {
      match.tossWinner = payload.winner;
      match.tossChoice = payload.choice;
      match.status = 'live';
      break;
    }

    // ── Start Innings ───────────────────────────────────────────────────────
    case 'start_innings': {
      const ci = match.currentInnings;
      const battingTeam = payload.battingTeam;
      // Derive bowling team from batting team
      const bowlingTeam = battingTeam === match.team1 ? match.team2 : match.team1;
      // Target is 1st innings score + 1 for the 2nd innings
      const target = ci === 1 ? (match.innings[0]!.runs + 1) : undefined;

      // FIX: pass bowlingTeam so target is stored correctly (was previously being
      // passed as the 2nd arg which is bowlingTeam, causing target to be lost)
      const innings = createInnings(battingTeam, bowlingTeam, target);

      const opener1: BatsmanScore = {
        name: payload.opener1 || 'Batter 1',
        runs: 0, balls: 0, fours: 0, sixes: 0,
        isOut: false, onStrike: true,
      };
      const opener2: BatsmanScore = {
        name: payload.opener2 || 'Batter 2',
        runs: 0, balls: 0, fours: 0, sixes: 0,
        isOut: false, onStrike: false,
      };
      innings.batsmen = [opener1, opener2];

      const bowler: BowlerScore = {
        name: payload.bowler || 'Bowler 1',
        overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0,
      };
      innings.bowlers = [bowler];
      innings.currentBowlerIndex = 0;

      (match.innings as (typeof innings | undefined)[])[ci] = innings;
      match.status = 'live';
      break;
    }

    // ── Set Bowler ──────────────────────────────────────────────────────────
    case 'set_bowler': {
      const inn = match.innings[match.currentInnings]!;
      const existing = inn.bowlers.findIndex(b => b.name === payload.name);
      if (existing !== -1) {
        inn.currentBowlerIndex = existing;
      } else {
        const newBowler: BowlerScore = {
          name: payload.name || 'Bowler',
          overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0,
        };
        inn.bowlers.push(newBowler);
        inn.currentBowlerIndex = inn.bowlers.length - 1;
      }
      break;
    }

    // ── Add New Batsman (after wicket) ──────────────────────────────────────
    case 'add_batsman': {
      const inn = match.innings[match.currentInnings]!;
      const newBat: BatsmanScore = {
        name: payload.name || ('Batter ' + (inn.batsmen.length + 1)),
        runs: 0, balls: 0, fours: 0, sixes: 0,
        isOut: false,
        // If someone is already on strike (e.g. non-striker retained strike after
        // an end-of-over wicket), new batter comes in at non-strike end.
        // Otherwise new batter takes strike as normal.
        onStrike: !inn.batsmen.some(b => b.onStrike && !b.isOut),
      };
      inn.batsmen.push(newBat);
      break;
    }

    // ── Update Player Names ─────────────────────────────────────────────────
    case 'update_names': {
      const inn = match.innings[match.currentInnings]!;

      if (payload.striker) {
        const strikerIdx = inn.batsmen.findIndex(b => b.onStrike && !b.isOut);
        if (strikerIdx !== -1) inn.batsmen[strikerIdx].name = payload.striker;
      }

      if (payload.nonStriker) {
        const nonStrikerIdx = inn.batsmen.findIndex(b => !b.onStrike && !b.isOut);
        if (nonStrikerIdx !== -1) inn.batsmen[nonStrikerIdx].name = payload.nonStriker;
      }

      if (payload.bowler && inn.currentBowlerIndex >= 0) {
        inn.bowlers[inn.currentBowlerIndex].name = payload.bowler;
      }

      break;
    }

    // ── Ball Event ───────────────────────────────────────────────────────────
    case 'ball': {
      let inn = match.innings[match.currentInnings]!;

      if (inn.currentBowlerIndex === -1) {
        return Response.json({ error: 'Set a bowler before scoring' }, { status: 400 });
      }

      const event: BallEvent = payload;
      inn = applyBallEvent(inn, event, match.overs);
      (match.innings as typeof inn[])[match.currentInnings] = inn;

      if (inn.isComplete) {
        if (match.currentInnings === 0) {
          match.status = 'innings_break';
          match.currentInnings = 1;
        } else {
          // 2nd innings complete — announce result immediately
          match.status = 'completed';
          match.result = computeResult(match);
        }
      }
      break;
    }

    // ── Innings Break Done ───────────────────────────────────────────────────
    case 'innings_break_done': {
      match.status = 'live';
      break;
    }

    default:
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  match.updatedAt = Date.now();
  await saveMatch(match);
  await publishUpdate(match.id, match);

  return Response.json(match);
}