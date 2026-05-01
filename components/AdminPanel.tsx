'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { Match, Innings } from '@/lib/cricket';

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);

  // Step: 'history' | 'setup' | 'toss' | 'live'
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

  // Bowler name for new over (always visible in scoring panel)
  const [bowlerName, setBowlerName] = useState('');

  // Editable player name fields (live scoring panel)
  const [editStriker, setEditStriker] = useState('');
  const [editNonStriker, setEditNonStriker] = useState('');
  const [editBowler, setEditBowler] = useState('');

  // Derived from current match state — safe to compute always
  // Innings slots can be null from Redis JSON serialisation
  const rawInn = match?.innings[match.currentInnings];
  const inn = (rawInn != null && typeof rawInn === 'object') ? rawInn as Innings : undefined;
  const needsBowler = inn && inn.currentBowlerIndex === -1;
  const striker = inn?.batsmen.find(b => b.onStrike && !b.isOut);
  const nonStriker = inn?.batsmen.find(b => !b.onStrike && !b.isOut);
  const currentBowler = inn && inn.currentBowlerIndex >= 0 ? inn.bowlers[inn.currentBowlerIndex] : null;
  const recentBalls = inn?.ballLog.slice(-6) ?? [];

  // Sync editable name fields whenever the underlying player changes
  useEffect(() => {
    if (striker) setEditStriker(striker.name);
  }, [striker?.name]);
  useEffect(() => {
    if (nonStriker) setEditNonStriker(nonStriker.name);
  }, [nonStriker?.name]);
  useEffect(() => {
    if (currentBowler) setEditBowler(currentBowler.name);
  }, [currentBowler?.name]);

  // ── HTTP helpers ─────────────────────────────────────────────────────────

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

  // ── Load match list ───────────────────────────────────────────────────────

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/matches');
      const data = await r.json();
      setMatches(Array.isArray(data) ? data : []);
    } catch {
      setApiError('Failed to load matches');
    }
    setLoading(false);
  }, []);

  // Load matches whenever history step is shown
  useEffect(() => {
    if (authed && step === 'history') loadMatches();
  }, [authed, step, loadMatches]);

  // ── Delete helpers ────────────────────────────────────────────────────────

  async function deleteOneMatch(id: string) {
    if (!confirm('Delete this match? This cannot be undone.')) return;
    await del(`/api/matches/${id}`, {});
    await loadMatches();
  }

  async function deleteAllMatches() {
    if (!confirm('Delete ALL match history? This cannot be undone.')) return;
    await del('/api/matches', {});
    await loadMatches();
  }

  // ── Step 1: Create match & move to toss ──────────────────────────────────

  async function handleSetup() {
    const t1 = team1.trim() || 'Team A';
    const t2 = team2.trim() || 'Team B';
    const created = await post('/api/matches', {
      title: `${t1} vs ${t2}`,
      team1: t1,
      team2: t2,
      overs: Number(overs) || 20,
    });
    if (created) {
      setMatch(created);
      setTossWinner(t1);
      setStep('toss');
    }
  }

  // ── Step 2: Toss → immediately start 1st innings ─────────────────────────

  async function handleToss() {
    if (!match) return;

    await post('/api/admin/score', {
      matchId: match.id,
      action: 'toss',
      payload: { winner: tossWinner, choice: tossChoice },
    });

    const battingTeam = tossChoice === 'bat'
      ? tossWinner
      : (tossWinner === match.team1 ? match.team2 : match.team1);

    const updated = await post('/api/admin/score', {
      matchId: match.id,
      action: 'start_innings',
      payload: {
        battingTeam,
        opener1: 'Batter 1',
        opener2: 'Batter 2',
        bowler: 'Bowler 1',
      },
    });
    if (updated) {
      setBowlerName('Bowler 1');
      setMatch(updated);
      setStep('live');
    }
  }

  // ── Score a ball ──────────────────────────────────────────────────────────

  async function scoreBall(type: string, extra?: number) {
    if (!match) return;

    let payload: object;
    if (type === 'wide') payload = { type: 'wide' };
    else if (type === 'noball') payload = { type: 'noball', runs: extra ?? 0 };
    else if (type === 'wicket') payload = { type: 'wicket', runs: 0, dismissal: 'Out' };
    else payload = { type: 'runs', runs: extra ?? 0 };

    const updated = await post('/api/admin/score', {
      matchId: match.id,
      action: 'ball',
      payload,
    });
    if (!updated) return;
    setMatch(updated);

    const inn = updated.innings[updated.currentInnings] as Innings | undefined;

    // After wicket: automatically send in next batsman with a default name.
    // No popup — name can be updated via the names panel if needed.
    if (type === 'wicket' && inn && !inn.isComplete && inn.wickets < 10) {
      const nextName = 'Batter ' + (inn.batsmen.length + 1);
      const afterWicket = await post('/api/admin/score', {
        matchId: updated.id,
        action: 'add_batsman',
        payload: { name: nextName },
      });
      if (afterWicket) setMatch(afterWicket);
    }

    // After end of over: auto-set bowler name suggestion (no popup).
    // Admin sets it via the bowler input that's always visible.
    if (inn && inn.currentBowlerIndex === -1) {
      const nextBowlerNum = inn.bowlers.length + 1;
      setBowlerName('Bowler ' + nextBowlerNum);
    }
  }

  // ── Set bowler for new over ───────────────────────────────────────────────

  async function setBowler() {
    if (!match) return;
    const name = bowlerName.trim() || 'Bowler';
    const updated = await post('/api/admin/score', {
      matchId: match.id,
      action: 'set_bowler',
      payload: { name },
    });
    if (updated) setMatch(updated);
  }

  // ── Start 2nd innings ────────────────────────────────────────────────────

  async function startSecondInnings() {
    if (!match) return;
    const raw0 = match.innings[0];
    const inn0batting = (raw0 != null && typeof raw0 === 'object') ? (raw0 as Innings).battingTeam : null;
    const battingTeam = inn0batting === match.team1 ? match.team2 : match.team1;
    const updated = await post('/api/admin/score', {
      matchId: match.id,
      action: 'start_innings',
      payload: {
        battingTeam,
        opener1: 'Batter 1',
        opener2: 'Batter 2',
        bowler: 'Bowler 1',
      },
    });
    if (updated) {
      setBowlerName('Bowler 1');
      setMatch(updated);
    }
  }

  // ── Update player names ───────────────────────────────────────────────────

  async function updateNames(striker: string, nonStriker: string, bowler: string) {
    if (!match) return;
    const updated = await post('/api/admin/score', {
      matchId: match.id,
      action: 'update_names',
      payload: { striker, nonStriker, bowler },
    });
    if (updated) setMatch(updated);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTH GATE
  // ─────────────────────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!password.trim()) { setApiError('Enter a password'); return; }
    setLoading(true);
    setApiError('');
    try {
      // Verify password by making a real API call — if 401, password is wrong
      const r = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, title: '__auth_check__', team1: 'a', team2: 'b', overs: 1 }),
      });
      if (r.status === 401) {
        setApiError('Wrong password');
        setLoading(false);
        return;
      }
      // Auth succeeded — if a test match was accidentally created, clean it up
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
      setAuthed(true);
      loadMatches();
    } catch {
      setApiError('Network error');
    }
    setLoading(false);
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-xs text-center">
          <div className="text-4xl mb-3">🏏</div>
          <h1 className="font-display text-3xl mb-6">ADMIN</h1>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); setApiError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="mb-3"
          />
          {apiError && (
            <div className="text-red-400 text-xs font-mono mb-3">{apiError}</div>
          )}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white font-semibold py-2 rounded-lg"
          >
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HISTORY STEP
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'history') {
    return (
      <div className="min-h-screen bg-gray-950 p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display text-3xl text-white">🏏 MATCHES</h1>
            <button
              onClick={() => { setTeam1(''); setTeam2(''); setOvers('20'); setStep('setup'); }}
              className="bg-green-700 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg text-sm"
            >
              + New Match
            </button>
          </div>

          <button
            onClick={loadMatches}
            disabled={loading}
            className="w-full mb-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 font-mono text-sm py-2 rounded-lg transition-colors"
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>

          {apiError && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm font-mono mb-4">
              {apiError}
            </div>
          )}

          {matches.length === 0 ? (
            <div className="text-center text-gray-600 font-mono py-16">
              <div className="text-5xl mb-3">📋</div>
              No matches yet
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {matches.map(m => (
                  <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white font-semibold truncate">{m.title}</div>
                        <div className="text-gray-500 text-xs font-mono mt-0.5">
                          {m.overs} ov ·{' '}
                          <span className={
                            m.status === 'live' ? 'text-green-400' :
                            m.status === 'completed' ? 'text-blue-400' :
                            'text-amber-400'
                          }>
                            {m.status.toUpperCase()}
                          </span>
                        </div>
                        {m.result && (
                          <div className="text-green-400 text-xs font-mono mt-1">{m.result}</div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setMatch(m);
                            // Route based on match state:
                            // - No innings yet → toss (need to start the match)
                            // - Innings started → live scoring
                            const raw = Array.isArray(m.innings) ? m.innings : [];
                            const hasInnings = raw[0] != null && typeof raw[0] === 'object';
                            if (!hasInnings && m.status !== 'completed') {
                              setTossWinner(m.team1 || '');
                              setStep('toss');
                            } else {
                              setStep('live');
                            }
                          }}
                          className="text-xs bg-blue-900 hover:bg-blue-800 text-blue-300 px-3 py-1.5 rounded-lg font-mono transition-colors"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => deleteOneMatch(m.id)}
                          disabled={loading}
                          className="text-xs bg-red-950 hover:bg-red-900 disabled:opacity-40 text-red-400 px-3 py-1.5 rounded-lg font-mono border border-red-900 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {matches.length > 0 && (
                <button
                  onClick={deleteAllMatches}
                  disabled={loading}
                  className="w-full bg-red-950 hover:bg-red-900 disabled:opacity-40 border border-red-800 text-red-400 font-mono text-sm py-2.5 rounded-lg transition-colors"
                >
                  🗑 Delete All Match History
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SETUP STEP
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'setup') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setStep('history')}
              className="text-gray-500 hover:text-gray-300 text-sm font-mono"
            >
              ← Back
            </button>
            <div className="flex-1 text-center">
              <div className="text-3xl mb-1">🏏</div>
              <h1 className="font-display text-3xl">NEW MATCH</h1>
            </div>
          </div>
          <div className="space-y-3">
            <input
              placeholder="Team 1 (default: Team A)"
              value={team1}
              onChange={e => setTeam1(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetup()}
            />
            <input
              placeholder="Team 2 (default: Team B)"
              value={team2}
              onChange={e => setTeam2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetup()}
            />
            <input
              type="number"
              placeholder="Overs (default: 20)"
              value={overs}
              onChange={e => setOvers(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetup()}
            />
            {apiError && <div className="text-red-400 text-xs font-mono">{apiError}</div>}
            <button
              onClick={handleSetup}
              disabled={loading}
              className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Creating…' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOSS STEP
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'toss') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm">
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
                  <button
                    key={c}
                    onClick={() => setTossChoice(c)}
                    className={`flex-1 py-2 rounded-lg font-semibold text-sm border transition-colors ${
                      tossChoice === c
                        ? 'bg-green-700 border-green-600 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {c.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {apiError && <div className="text-red-400 text-xs font-mono">{apiError}</div>}
            <button
              onClick={handleToss}
              disabled={loading}
              className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Starting…' : 'Start Match →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIVE SCORING STEP
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep('history')}
              className="text-gray-500 hover:text-gray-300 text-sm font-mono"
            >
              ←
            </button>
            <h1 className="font-display text-xl text-white">
              {match?.team1} vs {match?.team2}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {match && (
              <Link href={`/match/${match.id}`} target="_blank"
                className="text-xs text-blue-400 hover:text-blue-300 font-mono">
                Live ↗
              </Link>
            )}
            <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
              match?.status === 'live' ? 'bg-green-900 text-green-400' :
              match?.status === 'completed' ? 'bg-blue-900 text-blue-400' :
              'bg-amber-900 text-amber-400'
            }`}>{match?.status?.toUpperCase()}</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {apiError && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm font-mono">
            {apiError}
          </div>
        )}

        {/* ── Score summary ───────────────────────────────────────────────── */}
        {inn && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-display text-5xl text-white">{inn.runs}/{inn.wickets}</span>
              <span className="font-mono text-gray-400">{inn.overs}.{inn.balls} ov · {match?.overs} max</span>
            </div>
            {inn.target && (
              <div className="text-amber-400 font-mono text-sm mb-2">
                Target {inn.target} · Need {Math.max(0, inn.target - inn.runs)} off{' '}
                {Math.max(0, (match?.overs ?? 20) * 6 - (inn.overs * 6 + inn.balls))} balls
              </div>
            )}
            {recentBalls.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-1">
                {recentBalls.map((b, i) => (
                  <span key={i} className={`ball-pill text-xs ${
                    b === 'W' || b.endsWith('W') ? 'bg-red-700 text-white' :
                    b === '4' ? 'bg-blue-700 text-white' :
                    b === '6' ? 'bg-purple-700 text-white' :
                    b === 'wd' ? 'bg-amber-800 text-amber-200' :
                    b.startsWith('nb') ? 'bg-orange-800 text-orange-200' :
                    b === '•' ? 'bg-gray-800 text-gray-500' :
                    'bg-gray-700 text-gray-300'
                  }`}>{b}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Editable player names ────────────────────────────────────────── */}
        {inn && match?.status === 'live' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 font-mono mb-3">PLAYERS (editable)</div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-green-500 block mb-1">Striker *</label>
                <input
                  value={editStriker}
                  onChange={e => setEditStriker(e.target.value)}
                  placeholder="Striker"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Non-striker</label>
                <input
                  value={editNonStriker}
                  onChange={e => setEditNonStriker(e.target.value)}
                  placeholder="Non-striker"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-amber-500 block mb-1">Bowler</label>
                <input
                  value={editBowler}
                  onChange={e => setEditBowler(e.target.value)}
                  placeholder="Bowler"
                  className="text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => updateNames(editStriker, editNonStriker, editBowler)}
              disabled={loading}
              className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg font-mono transition-colors"
            >
              {loading ? 'Saving…' : 'Save Names'}
            </button>
          </div>
        )}

        {/* ── Innings break ────────────────────────────────────────────────── */}
        {match?.status === 'innings_break' && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-5 text-center">
            <div className="font-display text-2xl text-amber-400 mb-1">INNINGS BREAK</div>
            <div className="text-amber-300 text-sm font-mono mb-4">
              {(() => { const i0 = match.innings[0] as Innings | null | undefined; return i0 ? `${i0.battingTeam}: ${i0.runs}/${i0.wickets} · Target: ${i0.runs + 1}` : ''; })()}
            </div>
            <button
              onClick={startSecondInnings}
              disabled={loading}
              className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white font-semibold px-6 py-2.5 rounded-lg"
            >
              Start 2nd Innings →
            </button>
          </div>
        )}

        {/* ── Set bowler for new over ──────────────────────────────────────── */}
        {needsBowler && match?.status === 'live' && (
          <div className="bg-gray-900 border border-amber-700 rounded-xl p-4">
            <div className="text-xs text-amber-400 font-mono mb-2">NEW OVER — SET BOWLER</div>
            <div className="flex gap-2">
              <input
                value={bowlerName}
                onChange={e => setBowlerName(e.target.value)}
                placeholder="Bowler name"
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && setBowler()}
                autoFocus
              />
              <button
                onClick={setBowler}
                disabled={loading}
                className="bg-amber-700 hover:bg-amber-600 text-white font-semibold px-4 py-1.5 rounded-lg text-sm"
              >
                Set
              </button>
            </div>
          </div>
        )}

        {/* ── Scoring buttons ──────────────────────────────────────────────── */}
        {match?.status === 'live' && !needsBowler && (
          <div className="bg-gray-900 border border-green-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 font-mono mb-3">SCORE</div>

            <div className="grid grid-cols-4 gap-2 mb-2">
              {[
                { label: '•', runs: 0, color: 'bg-gray-800 text-gray-400' },
                { label: '1', runs: 1, color: 'bg-gray-700 text-white' },
                { label: '2', runs: 2, color: 'bg-gray-700 text-white' },
                { label: '3', runs: 3, color: 'bg-gray-700 text-white' },
                { label: '4', runs: 4, color: 'bg-blue-800 text-blue-100' },
                { label: '6', runs: 6, color: 'bg-purple-800 text-purple-100' },
                { label: 'WD', runs: 0, color: 'bg-amber-800 text-amber-100', type: 'wide' },
                { label: 'NB', runs: 0, color: 'bg-orange-800 text-orange-100', type: 'noball' },
              ].map(btn => (
                <button
                  key={btn.label}
                  disabled={loading}
                  onClick={() => scoreBall(btn.type ?? 'runs', btn.runs)}
                  className={`${btn.color} disabled:opacity-40 font-display text-xl py-3 rounded-lg hover:brightness-125 transition-all active:scale-95`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <button
              disabled={loading}
              onClick={() => scoreBall('wicket')}
              className="w-full bg-red-900 hover:bg-red-800 disabled:opacity-40 text-red-100 font-display text-xl py-3 rounded-lg transition-all active:scale-95"
            >
              🔴 OUT
            </button>
          </div>
        )}

        {/* ── Match complete ───────────────────────────────────────────────── */}
        {match?.status === 'completed' && (
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-6 text-center">
            <div className="font-display text-3xl text-green-400 mb-1">MATCH COMPLETE</div>
            <div className="text-white text-lg font-semibold">{match.result}</div>
            <Link href={`/match/${match.id}`} target="_blank"
              className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300 font-mono">
              View full scorecard ↗
            </Link>
            <div className="mt-4">
              <button
                onClick={() => setStep('history')}
                className="text-xs text-gray-500 hover:text-gray-300 font-mono"
              >
                ← Back to all matches
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}