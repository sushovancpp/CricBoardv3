import Link from 'next/link';
import { getAllMatches } from '@/lib/redis';
import type { Match, Innings } from '@/lib/cricket';

function statusBadge(status: Match['status']) {
  switch (status) {
    case 'live': return <span className="flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full bg-green-900/60 text-green-400 border border-green-800"><span className="live-dot w-1.5 h-1.5 bg-green-400 rounded-full inline-block"></span>LIVE</span>;
    case 'completed': return <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-800">✓ Done</span>;
    case 'innings_break': return <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-800">Break</span>;
    default: return <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700">Upcoming</span>;
  }
}

export default async function HomePage() {
  let matches: Match[] = [];
  try { matches = await getAllMatches(); } catch {}

  const live = matches.filter(m => m.status === 'live');
  const rest = matches.filter(m => m.status !== 'live');

  function getScoreLine(m: Match) {
    const rawInnings = Array.isArray(m.innings) ? m.innings : [];
    const inn0 = (rawInnings[0] != null && typeof rawInnings[0] === 'object') ? rawInnings[0] as Innings : null;
    const inn1 = (rawInnings[1] != null && typeof rawInnings[1] === 'object') ? rawInnings[1] as Innings : null;
    if (!inn0) return null;
    const p0 = `${inn0.battingTeam}: ${inn0.runs}/${inn0.wickets} (${inn0.overs}.${inn0.balls})`;
    const p1 = inn1 ? ` | ${inn1.battingTeam}: ${inn1.runs}/${inn1.wickets} (${inn1.overs}.${inn1.balls})` : '';
    return p0 + p1;
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero header */}
      <div className="border-b border-gray-800 bg-gradient-to-br from-gray-950 via-gray-900 to-green-950/30">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center relative">
          {/* Admin link — top right corner */}
          <Link
            href="/admin"
            className="absolute top-4 right-4 text-xs text-gray-700 hover:text-gray-400 font-mono transition-colors"
          >
            admin
          </Link>
          <div className="text-5xl mb-3">🏏</div>
          <h1 className="font-display text-5xl text-white mb-2 tracking-wide">CRICBOARD</h1>
          <p className="text-gray-500 font-mono text-sm">Live Cricket Scores</p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {matches.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏟️</div>
            <div className="text-gray-600 font-mono">No matches yet. Check back soon!</div>
          </div>
        ) : (
          <>
            {/* Live matches */}
            {live.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xs font-mono uppercase tracking-widest text-green-500 mb-3 flex items-center gap-2">
                  <span className="live-dot w-1.5 h-1.5 bg-green-400 rounded-full inline-block"></span>
                  Live Now
                </h2>
                <div className="space-y-3">
                  {live.map(m => {
                    const scoreLine = getScoreLine(m);
                    return (
                      <Link key={m.id} href={`/match/${m.id}`}
                        className="block bg-gradient-to-br from-gray-900 to-green-950/20 border border-green-800/50 rounded-2xl p-5 hover:border-green-700 transition-all group">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="font-display text-xl text-white group-hover:text-green-300 transition-colors">
                              {m.team1} vs {m.team2}
                            </div>
                            <div className="text-gray-600 text-xs font-mono">{m.overs} overs</div>
                          </div>
                          {statusBadge(m.status)}
                        </div>
                        {scoreLine && (
                          <div className="text-green-400 font-mono text-sm mt-2 bg-black/20 rounded-xl px-3 py-2">
                            {scoreLine}
                          </div>
                        )}
                        <div className="text-xs text-gray-700 font-mono mt-2 group-hover:text-gray-500 transition-colors">
                          Tap to watch live →
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Other matches */}
            {rest.length > 0 && (
              <section>
                <h2 className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">All Matches</h2>
                <div className="space-y-2">
                  {rest.map(m => {
                    const scoreLine = getScoreLine(m);
                    return (
                      <Link key={m.id} href={`/match/${m.id}`}
                        className="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-700 hover:bg-gray-800/50 transition-all group">
                        <div className="min-w-0">
                          <div className="font-semibold text-white text-sm truncate group-hover:text-gray-200">{m.title}</div>
                          {scoreLine && <div className="text-gray-500 text-xs font-mono truncate mt-0.5">{scoreLine}</div>}
                          {m.result && <div className="text-blue-400 text-xs font-mono mt-0.5">{m.result}</div>}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {statusBadge(m.status)}
                          <span className="text-gray-700 group-hover:text-gray-500 transition-colors">→</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}