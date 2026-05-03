'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { Match, Innings } from '@/lib/cricket';

// ─── Ball pill colours (shared) ───────────────────────────────────────────────
function ballClass(b: string) {
  if (b === 'W' || b.includes('W')) return 'bg-red-600 text-white ring-1 ring-red-400';
  if (b === '4' || b.includes('+4')) return 'bg-blue-600 text-white';
  if (b === '6' || b.includes('+6')) return 'bg-violet-600 text-white';
  if (b === 'wd' || b.startsWith('wd')) return 'bg-amber-700 text-amber-100';
  if (b.startsWith('nb')) return 'bg-orange-700 text-orange-100';
  if (b === '•') return 'bg-gray-800 text-gray-500';
  return 'bg-gray-700 text-gray-200';
}

// ─── Over breakdown helpers ───────────────────────────────────────────────────
function splitIntoOvers(ballLog: string[]): string[][] {
  const overs: string[][] = [];
  let curr: string[] = [];
  for (const ball of ballLog) {
    curr.push(ball);
    const countsTowardOver = !ball.startsWith('wd') && !ball.startsWith('nb') && !ball.includes('+wd') && !ball.includes('+nb');
    if (countsTowardOver && curr.filter(b => !b.startsWith('wd') && !b.startsWith('nb')).length === 6) {
      overs.push(curr);
      curr = [];
    }
  }
  if (curr.length) overs.push(curr);
  return overs;
}

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [step, setStep] = useState<'history' | 'setup' | 'toss' | 'live'>('history');
  const [match, setMatch] = useState<Match | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  // Setup form
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [overs, setOvers] = useState('20');

  // Toss
  const [tossWinner, setTossWinner] = useState('');
  const [tossChoice, setTossChoice] = useState<'bat' | 'bowl'>('bat');

  // Bowler
  const [bowlerName, setBowlerName] = useState('');

  // Player names
  const [editStriker, setEditStriker] = useState('');
  const [editNonStriker, setEditNonStriker] = useState('');
  const [editBowler, setEditBowler] = useState('');

  // ── Chain state ───────────────────────────────────────────────────────────
  // pendingChain = true means the next scoring button press will APPEND to
  // the last ball rather than start a new ball.
  const [pendingChain, setPendingChain] = useState(false);

  // ── Edit mode ────────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [editingBallIdx, setEditingBallIdx] = useState<number | null>(null);
  const [editBallValue, setEditBallValue] = useState('');

  // ── Show all overs toggle ────────────────────────────────────────────────
  const [showAllOvers, setShowAllOvers] = useState(false);

  // Derived
  const rawInn = match?.innings[match.currentInnings];
  const inn = (rawInn != null && typeof rawInn === 'object') ? rawInn as Innings : undefined;
  const needsBowler = inn && inn.currentBowlerIndex === -1;
  const striker = inn?.batsmen.find(b => b.onStrike && !b.isOut);
  const nonStriker = inn?.batsmen.find(b => !b.onStrike && !b.isOut);
  const currentBowler = inn && inn.currentBowlerIndex >= 0 ? inn.bowlers[inn.currentBowlerIndex] : null;
  const allOvers = inn ? splitIntoOvers(inn.ballLog) : [];
  const currentOverBalls = allOvers[allOvers.length - 1] ?? [];

  useEffect(() => { if (striker) setEditStriker(striker.name); }, [striker?.name]);
  useEffect(() => { if (nonStriker) setEditNonStriker(nonStriker.name); }, [nonStriker?.name]);
  useEffect(() => { if (currentBowler) setEditBowler(currentBowler.name); }, [currentBowler?.name]);

  // Reset chain when innings changes
  useEffect(() => { setPendingChain(false); }, [match?.currentInnings]);

  // ── HTTP helpers ──────────────────────────────────────────────────────────
  const post = useCallback(async (url: string, body: object) => {
    setLoading(true);
    setApiError('');
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, ...body }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      setLoading(false);
      return data;
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Error');
      setLoading(false);
      return null;
    }
  }, [password]);

  const del = useCallback(async (url: string, body: object) => {
    setLoading(true);
    setApiError('');
    try {
      const r = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, ...body }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      setLoading(false);
      return data;
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Error');
      setLoading(false);
      return null;
    }
  }, [password]);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/matches');
      const data = await r.json();
      setMatches(Array.isArray(data) ? data : []);
    } catch { setApiError('Failed to load matches'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authed && step === 'history') loadMatches();
  }, [authed, step, loadMatches]);

  async function deleteOneMatch(id: string) {
    if (!confirm('Delete this match?')) return;
    await del(`/api/matches/${id}`, {});
    await loadMatches();
  }

  async function deleteAllMatches() {
    if (!confirm('Delete ALL match history?')) return;
    await del('/api/matches', {});
    await loadMatches();
  }

  async function handleSetup() {
    const t1 = team1.trim() || 'Team A';
    const t2 = team2.trim() || 'Team B';
    const created = await post('/api/matches', {
      title: `${t1} vs ${t2}`,
      team1: t1, team2: t2,
      overs: Number(overs) || 20,
    });
    if (created) { setMatch(created); setTossWinner(t1); setStep('toss'); }
  }

  async function handleToss() {
    if (!match) return;
    await post('/api/admin/score', {
      matchId: match.id, action: 'toss',
      payload: { winner: tossWinner, choice: tossChoice },
    });
    const battingTeam = tossChoice === 'bat'
      ? tossWinner
      : (tossWinner === match.team1 ? match.team2 : match.team1);
    const updated = await post('/api/admin/score', {
      matchId: match.id, action: 'start_innings',
      payload: { battingTeam, opener1: 'Batter 1', opener2: 'Batter 2', bowler: 'Bowler 1' },
    });
    if (updated) { setBowlerName('Bowler 1'); setMatch(updated); setStep('live'); }
  }

  // ── Score a new ball (or append via chain) ────────────────────────────────
  async function scoreBall(type: string, extra?: number) {
    if (!match) return;

    // If chain mode is active, append to last ball instead of scoring a new one
    if (pendingChain) {
      setPendingChain(false);
      const appendType = type === 'wicket' ? 'wicket' : type === 'wide' ? 'wide' : type === 'noball' ? 'noball' : 'runs';
      const appendRuns = extra ?? 0;
      const updated = await post('/api/admin/score', {
        matchId: match.id,
        action: 'append_to_last_ball',
        payload: { appendType, appendRuns },
      });
      if (updated) {
        setMatch(updated);
        // Allow further chaining unless it was a wicket or end-of-over
        const updatedInn = updated.innings[updated.currentInnings] as Innings | undefined;
        const isEndOver = updatedInn && updatedInn.currentBowlerIndex === -1;
        if (!isEndOver && type !== 'wicket') {
          setPendingChain(false); // chain dismissed after one append; user presses + again if needed
        }
      }
      return;
    }

    // Normal new-ball scoring
    let payload: object;
    if (type === 'wide') payload = { type: 'wide' };
    else if (type === 'noball') payload = { type: 'noball', runs: extra ?? 0 };
    else if (type === 'wicket') payload = { type: 'wicket', runs: 0, dismissal: 'Out' };
    else payload = { type: 'runs', runs: extra ?? 0 };

    const updated = await post('/api/admin/score', {
      matchId: match.id, action: 'ball', payload,
    });
    if (!updated) return;
    setMatch(updated);

    const updatedInn = updated.innings[updated.currentInnings] as Innings | undefined;

    // After wicket: add next batsman
    if (type === 'wicket' && updatedInn && !updatedInn.isComplete && updatedInn.wickets < 10) {
      const nextName = 'Batter ' + (updatedInn.batsmen.length + 1);
      const afterWicket = await post('/api/admin/score', {
        matchId: updated.id, action: 'add_batsman',
        payload: { name: nextName },
      });
      if (afterWicket) setMatch(afterWicket);
    }

    if (updatedInn && updatedInn.currentBowlerIndex === -1) {
      setBowlerName('Bowler ' + (updatedInn.bowlers.length + 1));
    }
  }

  async function setBowler() {
    if (!match) return;
    const name = bowlerName.trim() || 'Bowler';
    const updated = await post('/api/admin/score', {
      matchId: match.id, action: 'set_bowler', payload: { name },
    });
    if (updated) setMatch(updated);
  }

  async function startSecondInnings() {
    if (!match) return;
    const raw0 = match.innings[0];
    const inn0batting = (raw0 != null && typeof raw0 === 'object') ? (raw0 as Innings).battingTeam : null;
    const battingTeam = inn0batting === match.team1 ? match.team2 : match.team1;
    const updated = await post('/api/admin/score', {
      matchId: match.id, action: 'start_innings',
      payload: { battingTeam, opener1: 'Batter 1', opener2: 'Batter 2', bowler: 'Bowler 1' },
    });
    if (updated) { setBowlerName('Bowler 1'); setMatch(updated); }
  }

  async function updateNames(s: string, ns: string, b: string) {
    if (!match) return;
    const updated = await post('/api/admin/score', {
      matchId: match.id, action: 'update_names',
      payload: { striker: s, nonStriker: ns, bowler: b },
    });
    if (updated) setMatch(updated);
  }

  // ── Edit ball ─────────────────────────────────────────────────────────────
  async function submitBallEdit(ballIndex: number, newLabel: string) {
    if (!match) return;
    const updated = await post('/api/admin/score', {
      matchId: match.id, action: 'edit_ball',
      payload: { ballIndex, newLabel },
    });
    if (updated) {
      setMatch(updated);
      setEditingBallIdx(null);
      setEditBallValue('');
    }
  }

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!password.trim()) { setApiError('Enter a password'); return; }
    setLoading(true); setApiError('');
    try {
      const r = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, title: '__auth_check__', team1: 'a', team2: 'b', overs: 1 }),
      });
      if (r.status === 401) { setApiError('Wrong password'); setLoading(false); return; }
      try {
        const created = await r.json();
        if (created?.id && created?.title === '__auth_check__') {
          await fetch(`/api/matches/${created.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
          });
        }
      } catch {}
      setAuthed(true); loadMatches();
    } catch { setApiError('Network error'); }
    setLoading(false);
  }

  // ─── LOGIN SCREEN ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-green-950 flex items-center justify-center p-4">
        <div className="bg-gray-900/80 backdrop-blur border border-gray-700 rounded-2xl p-8 w-full max-w-xs text-center shadow-2xl">
          <div className="text-5xl mb-3">🏏</div>
          <h1 className="font-display text-4xl mb-1 text-white">ADMIN</h1>
          <p className="text-gray-500 text-xs font-mono mb-6">CricBoard Control Panel</p>
          <input
            type="password" placeholder="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); setApiError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="mb-3"
          />
          {apiError && <div className="text-red-400 text-xs font-mono mb-3">{apiError}</div>}
          <button onClick={handleLogin} disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-all">
            {loading ? 'Checking…' : 'Enter →'}
          </button>
        </div>
      </div>
    );
  }

  // ─── HISTORY ───────────────────────────────────────────────────────────────
  if (step === 'history') {
    return (
      <div className="min-h-screen bg-gray-950 p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-3xl text-white">🏏 MATCHES</h1>
              <p className="text-gray-600 text-xs font-mono">Admin Panel</p>
            </div>
            <button onClick={() => { setTeam1(''); setTeam2(''); setOvers('20'); setStep('setup'); }}
              className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all">
              + New
            </button>
          </div>
          <button onClick={loadMatches} disabled={loading}
            className="w-full mb-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-400 font-mono text-sm py-2 rounded-xl transition-colors">
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
          {apiError && <div className="bg-red-900/40 border border-red-800 text-red-300 px-4 py-2 rounded-xl text-sm font-mono mb-4">{apiError}</div>}
          {matches.length === 0 ? (
            <div className="text-center text-gray-600 font-mono py-16">
              <div className="text-5xl mb-3">📋</div>No matches yet
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {matches.map(m => (
                  <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white font-semibold truncate">{m.title}</div>
                        <div className="text-gray-500 text-xs font-mono mt-0.5">
                          {m.overs} ov ·{' '}
                          <span className={m.status === 'live' ? 'text-green-400' : m.status === 'completed' ? 'text-blue-400' : 'text-amber-400'}>
                            {m.status.toUpperCase()}
                          </span>
                        </div>
                        {m.result && <div className="text-green-400 text-xs font-mono mt-1">{m.result}</div>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => {
                          setMatch(m);
                          const hasInnings = Array.isArray(m.innings) && m.innings[0] != null;
                          if (!hasInnings && m.status !== 'completed') { setTossWinner(m.team1 || ''); setStep('toss'); }
                          else setStep('live');
                        }} className="text-xs bg-blue-900/60 hover:bg-blue-800 text-blue-300 px-3 py-1.5 rounded-lg font-mono border border-blue-800 transition-colors">
                          Open
                        </button>
                        <button onClick={() => deleteOneMatch(m.id)} disabled={loading}
                          className="text-xs bg-red-950 hover:bg-red-900 disabled:opacity-40 text-red-400 px-3 py-1.5 rounded-lg font-mono border border-red-900 transition-colors">
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={deleteAllMatches} disabled={loading}
                className="w-full bg-red-950 hover:bg-red-900 disabled:opacity-40 border border-red-800 text-red-400 font-mono text-sm py-2.5 rounded-xl transition-colors">
                🗑 Delete All History
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── SETUP ─────────────────────────────────────────────────────────────────
  if (step === 'setup') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setStep('history')} className="text-gray-500 hover:text-gray-300 text-sm font-mono">← Back</button>
            <div className="flex-1 text-center">
              <div className="text-3xl mb-1">🏏</div>
              <h1 className="font-display text-3xl">NEW MATCH</h1>
            </div>
          </div>
          <div className="space-y-3">
            <input placeholder="Team 1 (default: Team A)" value={team1} onChange={e => setTeam1(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSetup()} />
            <input placeholder="Team 2 (default: Team B)" value={team2} onChange={e => setTeam2(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSetup()} />
            <input type="number" placeholder="Overs (default: 20)" value={overs} onChange={e => setOvers(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSetup()} />
            {apiError && <div className="text-red-400 text-xs font-mono">{apiError}</div>}
            <button onClick={handleSetup} disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-all">
              {loading ? 'Creating…' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── TOSS ──────────────────────────────────────────────────────────────────
  if (step === 'toss') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-3xl mb-1">🪙</div>
            <h1 className="font-display text-3xl">TOSS</h1>
            <div className="text-gray-500 text-sm font-mono mt-1">{match?.team1} vs {match?.team2}</div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Who won the toss?</label>
              <select value={tossWinner} onChange={e => setTossWinner(e.target.value)}>
                <option value={match?.team1}>{match?.team1}</option>
                <option value={match?.team2}>{match?.team2}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Elected to…</label>
              <div className="flex gap-2">
                {(['bat', 'bowl'] as const).map(c => (
                  <button key={c} onClick={() => setTossChoice(c)}
                    className={`flex-1 py-2 rounded-xl font-bold text-sm border transition-all ${tossChoice === c ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                    {c.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {apiError && <div className="text-red-400 text-xs font-mono">{apiError}</div>}
            <button onClick={handleToss} disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-all">
              {loading ? 'Starting…' : 'Start Match →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── LIVE SCORING ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-950/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('history')} className="text-gray-500 hover:text-gray-300 text-sm font-mono">←</button>
            <h1 className="font-display text-xl text-white">{match?.team1} vs {match?.team2}</h1>
          </div>
          <div className="flex items-center gap-2">
            {match && (
              <Link href={`/match/${match.id}`} target="_blank"
                className="text-xs text-blue-400 hover:text-blue-300 font-mono bg-blue-950/40 px-2 py-1 rounded-lg border border-blue-900">
                Live ↗
              </Link>
            )}
            {/* Edit Mode Toggle */}
            {match?.status === 'live' && (
              <button
                onClick={() => { setEditMode(m => !m); setEditingBallIdx(null); setPendingChain(false); }}
                className={`text-xs font-mono px-2 py-1 rounded-lg border transition-all ${editMode ? 'bg-amber-600 border-amber-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-amber-600 hover:text-amber-400'}`}
              >
                {editMode ? '✓ Edit ON' : '✎ Edit'}
              </button>
            )}
            <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${match?.status === 'live' ? 'bg-green-900/60 text-green-400' : match?.status === 'completed' ? 'bg-blue-900/60 text-blue-400' : 'bg-amber-900/60 text-amber-400'}`}>
              {match?.status?.toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {apiError && (
          <div className="bg-red-900/40 border border-red-800 text-red-300 px-4 py-2 rounded-xl text-sm font-mono">{apiError}</div>
        )}

        {/* ── Score Summary ─────────────────────────────────────────────────── */}
        {inn && (
          <div className="bg-gradient-to-br from-gray-900 to-gray-900/80 border border-gray-700 rounded-2xl p-5">
            <div className="flex items-baseline justify-between mb-3">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-5xl text-white">{inn.runs}/{inn.wickets}</span>
                <span className="font-mono text-gray-400">{inn.overs}.{inn.balls} ov</span>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-600 font-mono">CRR</div>
                <div className="text-green-400 font-mono font-bold">
                  {inn.balls + inn.overs * 6 > 0 ? ((inn.runs / (inn.overs * 6 + inn.balls)) * 6).toFixed(2) : '0.00'}
                </div>
              </div>
            </div>

            {inn.target && (
              <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-3 py-2 mb-3 flex items-center justify-between">
                <span className="text-amber-400 font-mono text-sm">
                  Target <strong>{inn.target}</strong> · Need <strong>{Math.max(0, inn.target - inn.runs)}</strong> off{' '}
                  {Math.max(0, (match?.overs ?? 20) * 6 - (inn.overs * 6 + inn.balls))} balls
                </span>
              </div>
            )}

            {/* ── Ball log ─────────────────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600 font-mono">
                  Over {allOvers.length > 0 ? allOvers.length : 1}
                </span>
                {allOvers.length > 1 && (
                  <button onClick={() => setShowAllOvers(v => !v)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-mono underline">
                    {showAllOvers ? 'Hide history' : `Show all ${allOvers.length} overs`}
                  </button>
                )}
              </div>

              {/* All overs expanded */}
              {showAllOvers && (
                <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-1">
                  {allOvers.map((overBalls, oi) => (
                    <div key={oi} className="flex items-start gap-2">
                      <span className="text-xs text-gray-600 font-mono w-6 shrink-0 pt-1">O{oi + 1}</span>
                      <div className="flex gap-1 flex-wrap">
                        {overBalls.map((b, bi) => {
                          const globalIdx = inn.ballLog.indexOf(b, allOvers.slice(0, oi).flat().length);
                          return (
                            <button
                              key={bi}
                              disabled={!editMode}
                              onClick={() => {
                                if (editMode) {
                                  setEditingBallIdx(globalIdx);
                                  setEditBallValue(b);
                                }
                              }}
                              className={`ball-pill text-xs transition-all ${ballClass(b)} ${editMode ? 'ring-2 ring-amber-500/30 hover:ring-amber-400 cursor-pointer' : 'cursor-default'} ${editingBallIdx === globalIdx ? 'ring-2 ring-amber-400' : ''}`}
                            >{b}</button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Current over pills + inline + button */}
              {!showAllOvers && (
                <div className="flex gap-1.5 flex-wrap items-center">
                  {currentOverBalls.length === 0 && (
                    <span className="text-xs text-gray-700 font-mono italic">New over…</span>
                  )}
                  {currentOverBalls.map((b, i) => {
                    const globalIdx = inn.ballLog.length - currentOverBalls.length + i;
                    const isLast = i === currentOverBalls.length - 1;
                    return (
                      <>
                        <button
                          key={`ball-${i}`}
                          disabled={!editMode}
                          onClick={() => {
                            if (editMode) { setEditingBallIdx(globalIdx); setEditBallValue(b); }
                          }}
                          className={`ball-pill text-xs transition-all ${ballClass(b)} ${editMode ? 'ring-2 ring-amber-500/30 hover:ring-amber-400 cursor-pointer' : 'cursor-default'} ${editingBallIdx === globalIdx ? 'ring-2 ring-amber-400' : ''}`}
                        >{b}</button>

                        {/* Inline + button — only after last ball, only when live & no bowler needed & not edit mode */}
                        {isLast && match?.status === 'live' && !needsBowler && !editMode && (
                          <button
                            key="chain-plus"
                            onClick={() => setPendingChain(v => !v)}
                            title="Append extra to this ball"
                            className={`
                              h-6 w-6 rounded-full text-xs font-bold transition-all shrink-0
                              flex items-center justify-center
                              ${pendingChain
                                ? 'bg-green-500 text-white ring-2 ring-green-400 scale-110'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white'
                              }
                            `}
                          >+</button>
                        )}
                      </>
                    );
                  })}
                </div>
              )}

              {/* Chain mode label — shown below pills when active */}
              {pendingChain && !editMode && inn.ballLog.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-green-400 font-mono">
                    appending to <strong className="text-white">{inn.ballLog[inn.ballLog.length - 1]}</strong> —
                    pick a scoring button below
                  </span>
                  <button
                    onClick={() => setPendingChain(false)}
                    className="text-xs text-gray-600 hover:text-gray-400 font-mono"
                  >cancel</button>
                </div>
              )}
            </div>

            {/* Edit ball modal */}
            {editMode && editingBallIdx !== null && (
              <div className="mt-3 bg-amber-900/20 border border-amber-700 rounded-xl p-3">
                <div className="text-xs text-amber-400 font-mono mb-2">Edit ball #{editingBallIdx + 1} — current: <strong>{inn.ballLog[editingBallIdx]}</strong></div>
                <div className="flex gap-2">
                  <input
                    value={editBallValue}
                    onChange={e => setEditBallValue(e.target.value)}
                    className="flex-1 text-sm"
                    placeholder="e.g. 4, W, nb, wd, nb+6, 2W"
                    onKeyDown={e => e.key === 'Enter' && submitBallEdit(editingBallIdx, editBallValue.trim())}
                  />
                  <button onClick={() => submitBallEdit(editingBallIdx, editBallValue.trim())}
                    disabled={loading}
                    className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm px-3 py-1.5 rounded-lg font-mono">
                    Save
                  </button>
                  <button onClick={() => setEditingBallIdx(null)}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-3 py-1.5 rounded-lg font-mono">
                    ✕
                  </button>
                </div>
                <div className="text-xs text-gray-600 mt-1 font-mono">
                  Totals recalculate automatically
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Player names ──────────────────────────────────────────────────── */}
        {inn && match?.status === 'live' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="text-xs text-gray-600 font-mono mb-3 uppercase tracking-wider">Players</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="text-xs text-green-500 block mb-1">Striker *</label>
                <input value={editStriker} onChange={e => setEditStriker(e.target.value)} placeholder="Striker" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Non-striker</label>
                <input value={editNonStriker} onChange={e => setEditNonStriker(e.target.value)} placeholder="Non-striker" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-amber-500 block mb-1">Bowler</label>
                <input value={editBowler} onChange={e => setEditBowler(e.target.value)} placeholder="Bowler" className="text-sm" />
              </div>
            </div>
            <button onClick={() => updateNames(editStriker, editNonStriker, editBowler)} disabled={loading}
              className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg font-mono transition-colors">
              {loading ? 'Saving…' : 'Save Names'}
            </button>
          </div>
        )}

        {/* ── Innings break ─────────────────────────────────────────────────── */}
        {match?.status === 'innings_break' && (
          <div className="bg-amber-900/20 border border-amber-700 rounded-2xl p-5 text-center">
            <div className="font-display text-2xl text-amber-400 mb-1">INNINGS BREAK</div>
            <div className="text-amber-300 text-sm font-mono mb-4">
              {(() => { const i0 = match.innings[0] as Innings | null | undefined; return i0 ? `${i0.battingTeam}: ${i0.runs}/${i0.wickets} · Target: ${i0.runs + 1}` : ''; })()}
            </div>
            <button onClick={startSecondInnings} disabled={loading}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold px-6 py-2.5 rounded-xl">
              Start 2nd Innings →
            </button>
          </div>
        )}

        {/* ── Set bowler ───────────────────────────────────────────────────── */}
        {needsBowler && match?.status === 'live' && (
          <div className="bg-gray-900 border border-amber-700/60 rounded-2xl p-4">
            <div className="text-xs text-amber-400 font-mono mb-2 uppercase tracking-wider">New Over — Set Bowler</div>
            <div className="flex gap-2">
              <input value={bowlerName} onChange={e => setBowlerName(e.target.value)}
                placeholder="Bowler name" className="flex-1" onKeyDown={e => e.key === 'Enter' && setBowler()} autoFocus />
              <button onClick={setBowler} disabled={loading}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-1.5 rounded-xl text-sm">
                Set
              </button>
            </div>
          </div>
        )}

        {/* ── Main scoring buttons ─────────────────────────────────────────── */}
        {match?.status === 'live' && !needsBowler && !editMode && (
          <div className={`bg-gray-900 border rounded-2xl p-4 transition-colors ${pendingChain ? 'border-green-700/60' : 'border-gray-800'}`}>
            <div className="text-xs text-gray-600 font-mono mb-3 uppercase tracking-wider">
              {pendingChain
                ? <span className="text-green-400">Appending to <strong className="text-white">{inn?.ballLog[inn.ballLog.length - 1]}</strong></span>
                : 'Score a Ball'
              }
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[
                { label: '•', runs: 0, color: 'bg-gray-800 hover:bg-gray-700 text-gray-400' },
                { label: '1', runs: 1, color: 'bg-gray-700 hover:bg-gray-600 text-white' },
                { label: '2', runs: 2, color: 'bg-gray-700 hover:bg-gray-600 text-white' },
                { label: '3', runs: 3, color: 'bg-gray-700 hover:bg-gray-600 text-white' },
                { label: '4', runs: 4, color: 'bg-blue-800 hover:bg-blue-700 text-blue-100' },
                { label: '6', runs: 6, color: 'bg-violet-800 hover:bg-violet-700 text-violet-100' },
                { label: 'WD', runs: 0, color: 'bg-amber-800 hover:bg-amber-700 text-amber-100', type: 'wide' },
                { label: 'NB', runs: 0, color: 'bg-orange-800 hover:bg-orange-700 text-orange-100', type: 'noball' },
              ].map(btn => (
                <button key={btn.label} disabled={loading}
                  onClick={() => scoreBall(btn.type ?? 'runs', btn.runs)}
                  className={`${btn.color} disabled:opacity-40 font-display text-2xl py-4 rounded-xl transition-all active:scale-95`}>
                  {btn.label}
                </button>
              ))}
            </div>
            <button disabled={loading} onClick={() => scoreBall('wicket')}
              className="w-full bg-red-900 hover:bg-red-800 disabled:opacity-40 text-red-100 font-display text-2xl py-4 rounded-xl transition-all active:scale-95 border border-red-800">
              🔴 OUT
            </button>
          </div>
        )}

        {/* ── Match complete ───────────────────────────────────────────────── */}
        {match?.status === 'completed' && (
          <div className="bg-green-900/20 border border-green-700 rounded-2xl p-6 text-center">
            <div className="font-display text-3xl text-green-400 mb-1">MATCH COMPLETE</div>
            <div className="text-white text-lg font-semibold">{match.result}</div>
            <Link href={`/match/${match.id}`} target="_blank"
              className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300 font-mono">
              View full scorecard ↗
            </Link>
            <div className="mt-4">
              <button onClick={() => setStep('history')} className="text-xs text-gray-500 hover:text-gray-300 font-mono">
                ← All matches
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}