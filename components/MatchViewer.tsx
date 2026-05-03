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

// Parse ballLog into per-over groups, treating WD/NB as not counting toward over
function splitIntoOvers(ballLog: string[]): string[][] {
  const overs: string[][] = [];
  let curr: string[] = [];
  for (const ball of ballLog) {
    curr.push(ball);
    const isExtra = ball === 'wd' || ball.startsWith('nb');
    if (!isExtra && curr.filter(b => b !== 'wd' && !b.startsWith('nb')).length === 6) {
      overs.push(curr);
      curr = [];
    }
  }
  if (curr.length) overs.push(curr);
  return overs;
}

// ─── Ball pill ────────────────────────────────────────────────────────────────
function BallPill({ val, size = 'md' }: { val: string; size?: 'sm' | 'md' }) {
  let cls = 'bg-gray-700/80 text-gray-300 border border-gray-600';
  if (val === 'W' || (val.includes('W') && !val.startsWith('wd'))) cls = 'bg-red-600 text-white border border-red-500 shadow-lg shadow-red-900/50';
  else if (val === '4' || val.includes('+4')) cls = 'bg-blue-600 text-white border border-blue-500 shadow-md shadow-blue-900/40';
  else if (val === '6' || val.includes('+6')) cls = 'bg-violet-600 text-white border border-violet-500 shadow-md shadow-violet-900/40';
  else if (val === 'wd' || val.startsWith('wd')) cls = 'bg-amber-700/80 text-amber-100 border border-amber-600';
  else if (val.startsWith('nb')) cls = 'bg-orange-700/80 text-orange-100 border border-orange-600';
  else if (val === '•') cls = 'bg-gray-800 text-gray-600 border border-gray-700';

  const sz = size === 'sm'
    ? 'w-7 h-7 text-[10px]'
    : 'w-8 h-8 text-xs';

  return (
    <span className={`${sz} inline-flex items-center justify-center rounded-full font-mono font-bold ${cls}`}>
      {val}
    </span>
  );
}

// ─── Full ball history ────────────────────────────────────────────────────────
function BallHistory({ ballLog }: { ballLog: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const overs = splitIntoOvers(ballLog);
  if (overs.length === 0) return null;

  const displayOvers = expanded ? overs : overs.slice(-2);
  const currentOver = overs[overs.length - 1];

  // Over run total
  function overTotal(balls: string[]) {
    return balls.reduce((sum, b) => {
      if (b === 'W') return sum;
      if (b === '•') return sum;
      if (b === 'wd') return sum + 1;
      if (b === 'nb') return sum + 1;
      if (b.startsWith('nb+')) return sum + 1 + parseInt(b.slice(3));
      if (b.endsWith('W')) return sum + parseInt(b.slice(0, -1)) || 0;
      if (b.includes('+')) {
        return sum + b.split('+').reduce((s, p) => {
          if (p === 'W' || p === 'wd' || p === 'nb') return s;
          return s + (parseInt(p) || 0);
        }, 0);
      }
      return sum + (parseInt(b) || 0);
    }, 0);
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-600 font-mono uppercase tracking-wider">Ball by Ball</span>
        {overs.length > 2 && (
          <button onClick={() => setExpanded(v => !v)}
            className="text-xs text-blue-400 hover:text-blue-300 font-mono">
            {expanded ? '▲ Collapse' : `▼ All ${overs.length} overs`}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {displayOvers.map((overBalls, idx) => {
          const overNum = expanded ? idx + 1 : (overs.length - displayOvers.length + idx + 1);
          const isCurrent = overNum === overs.length;
          const total = overTotal(overBalls);
          return (
            <div key={overNum} className={`rounded-xl px-3 py-2 ${isCurrent ? 'bg-green-950/30 border border-green-900/50' : 'bg-gray-800/40'}`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono w-8 shrink-0 ${isCurrent ? 'text-green-500' : 'text-gray-600'}`}>
                  O{overNum}
                </span>
                <div className="flex gap-1.5 flex-wrap flex-1">
                  {overBalls.map((b, bi) => <BallPill key={bi} val={b} size="sm" />)}
                  {isCurrent && overBalls.length < 6 && [...Array(Math.max(0, 6 - overBalls.filter(b => b !== 'wd' && !b.startsWith('nb')).length))].map((_, i) => (
                    <span key={`empty-${i}`} className="w-7 h-7 inline-flex items-center justify-center rounded-full border border-dashed border-gray-700 opacity-30" />
                  ))}
                </div>
                <span className={`text-xs font-mono shrink-0 ${isCurrent ? 'text-green-400' : 'text-gray-500'}`}>
                  {total}R
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Batsman row ──────────────────────────────────────────────────────────────
function BatsmanRow({ b, isActive }: { b: BatsmanScore; isActive: boolean }) {
  const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(0) : '—';
  const isOnStrike = isActive && b.onStrike;
  return (
    <tr className={`border-b border-gray-800/50 last:border-0 transition-colors ${isOnStrike ? 'bg-green-950/20' : ''}`}>
      <td className="py-2.5 pr-3 text-sm">
        <div className="flex items-center gap-1.5">
          {isOnStrike && <span className="text-green-400 text-[10px]">▶</span>}
          <span className={isOnStrike ? 'text-green-400 font-semibold' : b.isOut ? 'text-gray-500' : 'text-white'}>
            {b.name}
          </span>
          {b.isOut && <span className="text-xs text-gray-600">†</span>}
        </div>
        {b.isOut && <div className="text-[10px] text-gray-600 font-mono">{b.dismissal}</div>}
      </td>
      <td className={`py-2.5 px-2 text-center font-mono text-sm font-bold ${b.isOut ? 'text-gray-500' : 'text-white'}`}>{b.runs}</td>
      <td className="py-2.5 px-2 text-center font-mono text-xs text-gray-500">{b.balls}</td>
      <td className="py-2.5 px-2 text-center font-mono text-xs text-blue-400">{b.fours || '—'}</td>
      <td className="py-2.5 px-2 text-center font-mono text-xs text-violet-400">{b.sixes || '—'}</td>
      <td className={`py-2.5 px-2 text-center font-mono text-xs ${Number(sr) >= 150 ? 'text-green-400' : Number(sr) >= 100 ? 'text-amber-400' : 'text-gray-400'}`}>{sr}</td>
    </tr>
  );
}

// ─── Bowler row ───────────────────────────────────────────────────────────────
function BowlerRow({ b, isCurrent }: { b: BowlerScore; isCurrent: boolean }) {
  const totalBalls = b.overs * 6 + b.balls;
  const eco = totalBalls > 0 ? ((b.runs / totalBalls) * 6).toFixed(2) : '—';
  return (
    <tr className={`border-b border-gray-800/50 last:border-0 ${isCurrent ? 'bg-amber-950/20' : ''}`}>
      <td className="py-2.5 pr-3 text-sm">
        <span className={isCurrent ? 'text-amber-400 font-semibold' : 'text-white'}>
          {b.name} {isCurrent ? '▶' : ''}
        </span>
      </td>
      <td className="py-2.5 px-2 text-center font-mono text-xs text-gray-500">{b.overs}.{b.balls}</td>
      <td className="py-2.5 px-2 text-center font-mono text-sm text-white">{b.runs}</td>
      <td className="py-2.5 px-2 text-center font-mono text-sm text-red-400 font-bold">{b.wickets}</td>
      <td className={`py-2.5 px-2 text-center font-mono text-xs ${parseFloat(eco) <= 6 ? 'text-green-400' : parseFloat(eco) <= 9 ? 'text-amber-400' : 'text-red-400'}`}>{eco}</td>
    </tr>
  );
}

// ─── Innings card ─────────────────────────────────────────────────────────────
function InningsCard({ inn, matchOvers, label, isCurrentInnings }: {
  inn: Innings; matchOvers: number; label: string; isCurrentInnings: boolean;
}) {
  const [showBowlers, setShowBowlers] = useState(false);
  const activeBatsmen = inn.batsmen.filter(b => !b.isOut);
  const outBatsmen = inn.batsmen.filter(b => b.isOut);
  const rr = getRunRate(inn.runs, inn.overs, inn.balls);
  const rrr = inn.target ? getRequiredRunRate(inn.target, inn.runs, inn.overs, inn.balls, matchOvers) : null;

  return (
    <div className={`rounded-2xl overflow-hidden border ${isCurrentInnings ? 'border-green-800/60 bg-gradient-to-b from-gray-900 to-gray-900/80' : 'border-gray-800 bg-gray-900'}`}>
      {/* Header */}
      <div className={`px-5 py-3 flex items-center justify-between ${isCurrentInnings ? 'bg-green-950/40 border-b border-green-900/40' : 'bg-gray-800/30 border-b border-gray-800'}`}>
        <h3 className="font-display text-lg text-gray-200">{label}</h3>
        {isCurrentInnings && (
          <span className="flex items-center gap-1.5 text-xs text-green-400 font-mono">
            <span className="live-dot w-1.5 h-1.5 bg-green-400 rounded-full inline-block"></span>
            LIVE
          </span>
        )}
      </div>

      {/* Score block */}
      <div className="px-5 py-4 border-b border-gray-800/50">
        <div className="flex items-end justify-between mb-2">
          <div className="flex items-baseline gap-3">
            <span className="score-digit text-white">{inn.runs}/{inn.wickets}</span>
            <span className="font-mono text-gray-400">{formatOvers(inn.overs, inn.balls)} ov</span>
          </div>

          {/* Target progress bar */}
          {inn.target && (
            <div className="text-right">
              <div className="text-xs text-gray-500 font-mono mb-1">Target {inn.target}</div>
              <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-600 to-green-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (inn.runs / inn.target) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-4 text-xs font-mono mt-2">
          <div className="flex items-center gap-1">
            <span className="text-gray-600">CRR</span>
            <span className="text-green-400 font-bold">{rr}</span>
          </div>
          {inn.target && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-gray-600">Need</span>
                <span className="text-amber-400 font-bold">{Math.max(0, inn.target - inn.runs)}</span>
                <span className="text-gray-600">off {Math.max(0, matchOvers * 6 - (inn.overs * 6 + inn.balls))} balls</span>
              </div>
              {rrr && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-600">RRR</span>
                  <span className={`font-bold ${parseFloat(rrr) > parseFloat(rr) + 3 ? 'text-red-400' : 'text-amber-400'}`}>{rrr}</span>
                </div>
              )}
            </>
          )}
          <div className="flex items-center gap-1">
            <span className="text-gray-600">Extras</span>
            <span className="text-gray-400">{inn.extras.wides + inn.extras.noBalls + inn.extras.byes + inn.extras.legByes}</span>
            <span className="text-gray-600">(wd {inn.extras.wides}, nb {inn.extras.noBalls})</span>
          </div>
        </div>

        {/* ── Full ball history ── */}
        <BallHistory ballLog={inn.ballLog} />
      </div>

      {/* Batsmen */}
      <div className="px-5 py-3 border-b border-gray-800/50">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">
              <th className="text-left pb-2">Batter</th>
              <th className="pb-2 text-center">R</th>
              <th className="pb-2 text-center">B</th>
              <th className="pb-2 text-center text-blue-700">4s</th>
              <th className="pb-2 text-center text-violet-700">6s</th>
              <th className="pb-2 text-center">SR</th>
            </tr>
          </thead>
          <tbody>
            {activeBatsmen.map((b, i) => <BatsmanRow key={b.name + i} b={b} isActive={true} />)}
            {outBatsmen.map((b, i) => <BatsmanRow key={b.name + 'out' + i} b={b} isActive={false} />)}
          </tbody>
        </table>
      </div>

      {/* Bowlers (collapsible) */}
      <div className="px-5 py-3">
        <button onClick={() => setShowBowlers(v => !v)}
          className="flex items-center justify-between w-full text-left">
          <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">Bowling</span>
          <span className="text-gray-600 text-xs">{showBowlers ? '▲' : '▼'}</span>
        </button>
        {showBowlers && (
          <table className="w-full mt-2">
            <thead>
              <tr className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">
                <th className="text-left pb-2">Bowler</th>
                <th className="pb-2 text-center">O</th>
                <th className="pb-2 text-center">R</th>
                <th className="pb-2 text-center text-red-700">W</th>
                <th className="pb-2 text-center">Eco</th>
              </tr>
            </thead>
            <tbody>
              {inn.bowlers.map((b, i) => (
                <BowlerRow key={b.name + i} b={b} isCurrent={i === inn.currentBowlerIndex} />
              ))}
            </tbody>
          </table>
        )}
        {!showBowlers && (
          <div className="flex gap-3 mt-2 overflow-x-auto">
            {inn.bowlers.map((b, i) => (
              <div key={i} className={`shrink-0 text-xs font-mono ${i === inn.currentBowlerIndex ? 'text-amber-400' : 'text-gray-500'}`}>
                {b.name}: {b.wickets}/{b.runs}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Hero scoreboard (public view top) ────────────────────────────────────────
function HeroScore({ match, inn, isLive }: { match: Match; inn: Innings | undefined; isLive: boolean }) {
  const inn0 = match.innings[0] as Innings | undefined;
  const inn1 = match.innings[1] as Innings | undefined;
  const ci = match.currentInnings;

  return (
    <div className="relative overflow-hidden rounded-2xl mb-6 border border-gray-700/50"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1f0f 50%, #1a0a0a 100%)' }}>
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-green-400 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-blue-400 blur-3xl" />
      </div>

      <div className="relative px-6 py-6">
        {/* Teams header */}
        <div className="flex items-center justify-center gap-4 mb-5">
          <div className={`text-center flex-1 ${ci === 0 && match.status === 'live' ? '' : ''}`}>
            <div className="text-gray-400 text-xs font-mono uppercase tracking-wider mb-1">
              {inn0?.battingTeam || match.team1}
            </div>
            {inn0 && (
              <div className={`font-display text-3xl ${ci === 0 ? 'text-white' : 'text-gray-400'}`}>
                {inn0.runs}/{inn0.wickets}
                <span className="text-sm font-mono text-gray-500 ml-2">{formatOvers(inn0.overs, inn0.balls)}</span>
              </div>
            )}
          </div>

          <div className="text-gray-600 font-display text-xl px-3">VS</div>

          <div className="text-center flex-1">
            <div className="text-gray-400 text-xs font-mono uppercase tracking-wider mb-1">
              {inn1?.battingTeam || (inn0?.bowlingTeam || match.team2)}
            </div>
            {inn1 ? (
              <div className={`font-display text-3xl ${ci === 1 ? 'text-white' : 'text-gray-400'}`}>
                {inn1.runs}/{inn1.wickets}
                <span className="text-sm font-mono text-gray-500 ml-2">{formatOvers(inn1.overs, inn1.balls)}</span>
              </div>
            ) : (
              <div className="text-gray-700 font-display text-2xl">Yet to bat</div>
            )}
          </div>
        </div>

        {/* Current innings highlight */}
        {inn && isLive && (
          <div className="bg-black/30 rounded-xl px-4 py-3 border border-gray-700/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-mono uppercase">Now Batting</span>
              <div className="flex items-center gap-1.5">
                <span className="live-dot w-1.5 h-1.5 bg-green-400 rounded-full inline-block"></span>
                <span className="text-green-400 text-xs font-mono">LIVE</span>
              </div>
            </div>
            <div className="flex items-end gap-4">
              <div>
                <span className="font-display text-5xl text-white">{inn.runs}/{inn.wickets}</span>
                <span className="text-gray-400 font-mono ml-3">{formatOvers(inn.overs, inn.balls)} ov</span>
              </div>
              {inn.target && (
                <div className="ml-auto text-right">
                  <div className="text-xs text-gray-500 font-mono">Need</div>
                  <div className="text-amber-400 font-display text-2xl">{Math.max(0, inn.target - inn.runs)}</div>
                  <div className="text-xs text-gray-600 font-mono">off {Math.max(0, match.overs * 6 - (inn.overs * 6 + inn.balls))} balls</div>
                </div>
              )}
            </div>

            {/* Current batsmen & bowler */}
            <div className="flex gap-4 mt-3 text-xs font-mono">
              {inn.batsmen.filter(b => !b.isOut).map(b => (
                <span key={b.name} className={b.onStrike ? 'text-green-400' : 'text-gray-400'}>
                  {b.onStrike ? '▶ ' : ''}{b.name} {b.runs}({b.balls})
                </span>
              ))}
              {inn.currentBowlerIndex >= 0 && inn.bowlers[inn.currentBowlerIndex] && (
                <span className="text-amber-400 ml-auto">
                  ⚾ {inn.bowlers[inn.currentBowlerIndex].name}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Toss info */}
        {match.tossWinner && (
          <div className="text-center mt-3 text-xs text-gray-600 font-mono">
            {match.tossWinner} won toss · chose to {match.tossChoice}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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
        <div className="text-center">
          <div className="text-4xl mb-3 animate-bounce">🏏</div>
          <div className="text-gray-500 font-mono animate-pulse">Loading match…</div>
        </div>
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

  const rawInnings: unknown[] = Array.isArray(match.innings) ? match.innings : [];
  const inn0 = (rawInnings[0] != null && typeof rawInnings[0] === 'object') ? rawInnings[0] as Innings : undefined;
  const inn1 = (rawInnings[1] != null && typeof rawInnings[1] === 'object') ? rawInnings[1] as Innings : undefined;
  const overs = match.overs ?? 20;
  const isLive = match.status === 'live';
  const currentInn = (rawInnings[match.currentInnings] != null && typeof rawInnings[match.currentInnings] === 'object')
    ? rawInnings[match.currentInnings] as Innings : undefined;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800/50 bg-gray-950/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm font-mono flex items-center gap-1">
            <span>←</span> <span className="hidden sm:inline">All Matches</span>
          </Link>
          <div className="flex items-center gap-2">
            {match.status === 'completed' ? (
              <span className="text-xs font-mono text-blue-300 px-2 py-0.5 bg-blue-950/60 rounded-full border border-blue-800">✓ COMPLETED</span>
            ) : match.status === 'innings_break' ? (
              <span className="text-xs font-mono text-amber-300 px-2 py-0.5 bg-amber-950/60 rounded-full border border-amber-800">INNINGS BREAK</span>
            ) : isLive && sseStatus === 'connected' ? (
              <span className="text-xs font-mono text-green-300 flex items-center gap-1 px-2 py-0.5 bg-green-950/60 rounded-full border border-green-800">
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
        {/* Result banner */}
        {match.result && (
          <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-700/50 rounded-2xl px-6 py-4 text-center mb-5">
            <div className="text-xs text-green-600 font-mono uppercase tracking-wider mb-1">Result</div>
            <div className="font-display text-2xl text-green-300">{match.result}</div>
          </div>
        )}

        {/* Match title */}
        <div className="mb-5 text-center">
          <h1 className="font-display text-4xl text-white mb-1">
            {match.team1} <span className="text-gray-600">vs</span> {match.team2}
          </h1>
          <div className="text-gray-600 text-sm font-mono">{overs} overs</div>
        </div>

        {/* Hero score block */}
        {(inn0 || isLive) && (
          <HeroScore match={match} inn={currentInn} isLive={isLive} />
        )}

        {/* Innings break */}
        {match.status === 'innings_break' && inn0 && (
          <div className="bg-amber-900/20 border border-amber-800/50 rounded-2xl px-6 py-4 text-center mb-5">
            <div className="font-display text-xl text-amber-400">INNINGS BREAK</div>
            <div className="text-sm text-amber-300 mt-1 font-mono">
              {inn0.battingTeam}: {inn0.runs}/{inn0.wickets} · Target: {inn0.runs + 1}
            </div>
            <div className="text-xs text-amber-700 mt-2 font-mono animate-pulse">2nd innings starting soon…</div>
          </div>
        )}

        {/* Upcoming */}
        {!inn0 && match.status !== 'completed' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-14 text-center">
            <div className="text-5xl mb-4">🏏</div>
            <div className="font-display text-xl text-gray-300 mb-2">
              {match.status === 'upcoming' ? 'Match Starting Soon' : 'Waiting for Innings…'}
            </div>
            <div className="text-gray-600 text-sm font-mono">{match.team1} vs {match.team2} · {overs} overs</div>
            <div className="mt-5 text-xs text-gray-700 font-mono animate-pulse">
              Live updates will appear automatically
            </div>
          </div>
        )}

        {/* Innings cards */}
        <div className="grid gap-5">
          {inn0 && (
            <InningsCard inn={inn0} matchOvers={overs}
              label={`1st Innings — ${inn0.battingTeam}`}
              isCurrentInnings={match.currentInnings === 0 && isLive} />
          )}
          {inn1 && (
            <InningsCard inn={inn1} matchOvers={overs}
              label={`2nd Innings — ${inn1.battingTeam}`}
              isCurrentInnings={match.currentInnings === 1 && isLive} />
          )}
          {match.status === 'completed' && !inn0 && !inn1 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-10 text-center">
              <div className="text-gray-600 font-mono text-sm">Scorecard not available</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
