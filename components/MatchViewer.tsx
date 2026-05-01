'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import type { Match, Innings, BatsmanScore, BowlerScore } from '@/lib/cricket';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatOvers(o: number, b: number) { return `${o}.${b}`; }

function getRunRate(runs: number, overs: number, balls: number): string {
  const total = overs * 6 + balls;
  if (total === 0) return '0.00';
  return ((runs / total) * 6).toFixed(2);
}

function getRequiredRunRate(target: number, runs: number, overs: number, balls: number, maxOvers: number): string {
  const bowled = overs * 6 + balls;
  const remaining = maxOvers * 6 - bowled;
  if (remaining <= 0) return '∞';
  const needed = target - runs;
  if (needed <= 0) return '0.00';
  return ((needed / remaining) * 6).toFixed(2);
}

// ─── Ball pill ────────────────────────────────────────────────────────────────
function BallPill({ val }: { val: string }) {
  let cls = 'bg-gray-700 text-gray-300';
  if (val === 'W' || val.endsWith('W')) cls = 'bg-red-700 text-white';
  else if (val === '4') cls = 'bg-blue-700 text-white';
  else if (val === '6') cls = 'bg-purple-700 text-white';
  else if (val === 'wd') cls = 'bg-amber-800 text-amber-200';
  else if (val.startsWith('nb')) cls = 'bg-orange-800 text-orange-200';
  else if (val === '•') cls = 'bg-gray-800 text-gray-500';
  return <span className={`ball-pill ${cls}`}>{val}</span>;
}

// ─── Batsman row ─────────────────────────────────────────────────────────────
function BatsmanRow({ b, isActive }: { b: BatsmanScore; isActive: boolean }) {
  const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(0) : '—';
  return (
    <tr className={isActive && b.onStrike ? 'bg-green-950/30' : ''}>
      <td className="py-2 pr-4 text-sm">
        <span className={b.onStrike ? 'text-green-400 font-semibold' : 'text-white'}>
          {b.name} {b.onStrike ? '*' : ''}
        </span>
        {b.isOut && <span className="text-xs text-gray-500 ml-1">({b.dismissal})</span>}
      </td>
      <td className="py-2 px-3 text-center font-mono text-sm font-semibold">{b.runs}</td>
      <td className="py-2 px-3 text-center font-mono text-sm text-gray-400">{b.balls}</td>
      <td className="py-2 px-3 text-center font-mono text-sm text-blue-400">{b.fours}</td>
      <td className="py-2 px-3 text-center font-mono text-sm text-purple-400">{b.sixes}</td>
      <td className="py-2 px-3 text-center font-mono text-sm text-gray-400">{sr}</td>
    </tr>
  );
}

// ─── Bowler row ───────────────────────────────────────────────────────────────
function BowlerRow({ b, isCurrent }: { b: BowlerScore; isCurrent: boolean }) {
  const totalBalls = b.overs * 6 + b.balls;
  const eco = totalBalls > 0 ? ((b.runs / totalBalls) * 6).toFixed(2) : '—';
  return (
    <tr className={isCurrent ? 'bg-green-950/30' : ''}>
      <td className="py-2 pr-4 text-sm">
        <span className={isCurrent ? 'text-green-400 font-semibold' : 'text-white'}>
          {b.name} {isCurrent ? '*' : ''}
        </span>
      </td>
      <td className="py-2 px-3 text-center font-mono text-sm text-gray-400">{b.overs}.{b.balls}</td>
      <td className="py-2 px-3 text-center font-mono text-sm">{b.runs}</td>
      <td className="py-2 px-3 text-center font-mono text-sm text-red-400">{b.wickets}</td>
      <td className="py-2 px-3 text-center font-mono text-sm text-gray-400">{eco}</td>
    </tr>
  );
}

// ─── Innings scorecard ────────────────────────────────────────────────────────
function InningsCard({ inn, matchOvers, label, isCurrentInnings }: {
  inn: Innings;
  matchOvers: number;
  label: string;
  isCurrentInnings: boolean;
}) {
  const activeBatsmen = inn.batsmen.filter(b => !b.isOut);
  const outBatsmen = inn.batsmen.filter(b => b.isOut);
  const rr = getRunRate(inn.runs, inn.overs, inn.balls);
  const rrr = inn.target
    ? getRequiredRunRate(inn.target, inn.runs, inn.overs, inn.balls, matchOvers)
    : null;
  const recentBalls = inn.ballLog.slice(-6);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="bg-gray-800/50 px-5 py-3 flex items-center justify-between">
        <h3 className="font-display text-lg text-gray-300">{label}</h3>
        {isCurrentInnings && (
          <span className="flex items-center gap-1.5 text-xs text-green-400 font-mono">
            <span className="live-dot w-1.5 h-1.5 bg-green-400 rounded-full inline-block"></span>
            BATTING
          </span>
        )}
      </div>

      <div className="px-5 py-4 border-b border-gray-800">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="score-digit text-white">{inn.runs}/{inn.wickets}</span>
          <span className="font-mono text-gray-400 text-lg">{formatOvers(inn.overs, inn.balls)} ov</span>
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-mono text-gray-500 mt-2">
          <span>CRR: <span className="text-white">{rr}</span></span>
          {inn.target && (
            <>
              <span>Target: <span className="text-amber-400">{inn.target}</span></span>
              <span>Need: <span className="text-amber-400">
                {Math.max(0, inn.target - inn.runs)} off{' '}
                {Math.max(0, matchOvers * 6 - (inn.overs * 6 + inn.balls))} balls
              </span></span>
              {rrr && <span>RRR: <span className="text-amber-400">{rrr}</span></span>}
            </>
          )}
        </div>
        <div className="text-xs font-mono text-gray-600 mt-1">
          Extras: {inn.extras.wides + inn.extras.noBalls + inn.extras.byes + inn.extras.legByes}
          {' '}(wd {inn.extras.wides}, nb {inn.extras.noBalls})
        </div>
        {recentBalls.length > 0 && (
          <div className="flex gap-1.5 mt-3">
            {recentBalls.map((b, i) => <BallPill key={i} val={b} />)}
          </div>
        )}
      </div>

      <div className="px-5 py-3">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-600 font-mono uppercase">
              <th className="text-left py-1">Batter</th>
              <th className="py-1">R</th><th className="py-1">B</th>
              <th className="py-1">4s</th><th className="py-1">6s</th>
              <th className="py-1">SR</th>
            </tr>
          </thead>
          <tbody>
            {activeBatsmen.map((b, i) => <BatsmanRow key={b.name + i} b={b} isActive={true} />)}
            {outBatsmen.map((b, i) => <BatsmanRow key={b.name + 'out' + i} b={b} isActive={false} />)}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-gray-800">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-600 font-mono uppercase">
              <th className="text-left py-1">Bowler</th>
              <th className="py-1">O</th><th className="py-1">R</th>
              <th className="py-1">W</th><th className="py-1">Eco</th>
            </tr>
          </thead>
          <tbody>
            {inn.bowlers.map((b, i) => (
              <BowlerRow key={b.name + i} b={b} isCurrent={i === inn.currentBowlerIndex} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main match page ──────────────────────────────────────────────────────────
export default function MatchPage({ matchId }: { matchId: string }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch(`/api/matches/${matchId}`)
      .then(r => r.json())
      .then((m: Match) => { setMatch(m); setLoading(false); })
      .catch(() => setLoading(false));
  }, [matchId]);

  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout>;
    function connect() {
      const es = new EventSource(`/api/events/${matchId}`);
      eventSourceRef.current = es;
      es.addEventListener('connected', () => setSseStatus('connected'));
      es.addEventListener('update', (e) => {
        try { setMatch(JSON.parse(e.data) as Match); } catch {}
      });
      es.onerror = () => {
        setSseStatus('disconnected');
        es.close();
        retryTimeout = setTimeout(connect, 3000);
      };
    }
    connect();
    return () => { eventSourceRef.current?.close(); clearTimeout(retryTimeout); };
  }, [matchId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 font-mono animate-pulse">Loading match…</div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 font-mono mb-4">Match not found.</div>
          <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm font-mono">← All Matches</Link>
        </div>
      </div>
    );
  }

  // Defensively normalise innings — JSON turns undefined/null slots into proper objects
  // Handles: [], [null, null], [Innings, null], [Innings, Innings]
  const rawInnings: unknown[] = Array.isArray(match.innings) ? match.innings : [];
  const inn0 = (rawInnings[0] != null && typeof rawInnings[0] === 'object') ? rawInnings[0] as Innings : undefined;
  const inn1 = (rawInnings[1] != null && typeof rawInnings[1] === 'object') ? rawInnings[1] as Innings : undefined;

  const team1 = match.team1 || inn0?.battingTeam || inn0?.bowlingTeam || 'Team A';
  const team2 = match.team2 || inn0?.bowlingTeam || inn1?.battingTeam || 'Team B';
  const overs = match.overs ?? 20; // fallback to 20 if not set


  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm font-mono">← All Matches</Link>
          <div className="flex items-center gap-2">
            {match.status === 'completed' ? (
              <span className="text-xs font-mono text-blue-400 px-2 py-0.5 bg-blue-950 rounded-full">COMPLETED</span>
            ) : match.status === 'innings_break' ? (
              <span className="text-xs font-mono text-amber-400 px-2 py-0.5 bg-amber-950 rounded-full">INNINGS BREAK</span>
            ) : match.status === 'live' && sseStatus === 'connected' ? (
              <span className="text-xs font-mono text-green-400 flex items-center gap-1">
                <span className="live-dot w-1.5 h-1.5 bg-green-400 rounded-full inline-block"></span>
                LIVE
              </span>
            ) : (
              <span className="text-xs font-mono text-gray-600 uppercase">{match.status}</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Match title */}
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl text-white mb-1">
            {team1} <span className="text-gray-600">vs</span> {team2}
          </h1>
          <div className="text-gray-500 text-sm font-mono">{overs} overs</div>
          {match.tossWinner && (
            <div className="text-xs text-gray-600 mt-1 font-mono">
              {match.tossWinner} won toss · chose to {match.tossChoice}
            </div>
          )}
        </div>

        {/* Result banner */}
        {match.result && (
          <div className="bg-green-900/40 border border-green-700 rounded-xl px-6 py-4 text-center mb-6">
            <div className="text-xs text-green-600 font-mono mb-1">RESULT</div>
            <div className="font-display text-2xl text-green-400">{match.result}</div>
          </div>
        )}

        {/* Upcoming / no innings yet */}
        {!inn0 && match.status !== 'completed' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-14 text-center">
            <div className="text-5xl mb-4">🏏</div>
            <div className="font-display text-xl text-gray-300 mb-2">
              {match.status === 'upcoming' ? 'Match Starting Soon' : 'Waiting for Innings…'}
            </div>
            <div className="text-gray-600 text-sm font-mono">{team1} vs {team2} · {overs} overs</div>
            <div className="mt-5 text-xs text-gray-700 font-mono animate-pulse">
              {match.status === 'upcoming' ? 'Waiting for toss…' : 'Live updates will appear automatically'}
            </div>
          </div>
        )}

        {/* Innings break banner */}
        {match.status === 'innings_break' && inn0 && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-xl px-6 py-4 text-center mb-6">
            <div className="font-display text-xl text-amber-400">INNINGS BREAK</div>
            <div className="text-sm text-amber-300 mt-1 font-mono">
              {inn0.battingTeam}: {inn0.runs}/{inn0.wickets} · Target: {inn0.runs + 1}
            </div>
            <div className="text-xs text-amber-700 mt-2 font-mono animate-pulse">2nd innings starting soon…</div>
          </div>
        )}

        {/* Completed match — summary comparison bar */}
        {match.status === 'completed' && inn0 && inn1 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 mb-6">
            <div className="text-xs text-gray-500 font-mono mb-3">MATCH SUMMARY</div>
            <div className="grid grid-cols-2 gap-4">
              <div className={inn0.runs > inn1.runs ? 'text-green-400' : 'text-gray-300'}>
                <div className="text-xs font-mono text-gray-500 mb-1">{inn0.battingTeam}</div>
                <div className="font-display text-3xl">{inn0.runs}/{inn0.wickets}</div>
                <div className="text-xs font-mono text-gray-500">{inn0.overs}.{inn0.balls} ov</div>
              </div>
              <div className={inn1.runs >= inn0.runs ? 'text-green-400' : 'text-gray-300'}>
                <div className="text-xs font-mono text-gray-500 mb-1">{inn1.battingTeam}</div>
                <div className="font-display text-3xl">{inn1.runs}/{inn1.wickets}</div>
                <div className="text-xs font-mono text-gray-500">{inn1.overs}.{inn1.balls} ov</div>
              </div>
            </div>
          </div>
        )}

        {/* Innings scorecards — always shown when data exists */}
        <div className="grid gap-6">
          {inn0 && (
            <InningsCard
              inn={inn0}
              matchOvers={overs}
              label={`1st Innings — ${inn0.battingTeam}`}
              isCurrentInnings={match.currentInnings === 0 && match.status === 'live'}
            />
          )}
          {inn1 && (
            <InningsCard
              inn={inn1}
              matchOvers={overs}
              label={`2nd Innings — ${inn1.battingTeam}`}
              isCurrentInnings={match.currentInnings === 1 && match.status === 'live'}
            />
          )}
          {/* Completed but innings data missing — fallback */}
          {match.status === 'completed' && !inn0 && !inn1 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-10 text-center">
              <div className="text-gray-600 font-mono text-sm">Scorecard not available</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}