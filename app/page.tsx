import Link from 'next/link';
import { getAllMatches } from '@/lib/redis';
import type { Match } from '@/lib/cricket';

export const revalidate = 0;

function StatusBadge({ status }: { status: Match['status'] }) {
  const map = {
    upcoming: { label: 'Upcoming', cls: 'bg-gray-700 text-gray-300' },
    live: { label: '● LIVE', cls: 'bg-green-900 text-green-400 animate-pulse' },
    innings_break: { label: 'Break', cls: 'bg-amber-900 text-amber-400' },
    completed: { label: 'Final', cls: 'bg-blue-900 text-blue-400' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

function MatchCard({ match }: { match: Match }) {
  const raw = Array.isArray(match.innings) ? match.innings : [];
  const inn1 = (raw[0] != null && typeof raw[0] === 'object') ? raw[0] as NonNullable<typeof match.innings[0]> : undefined;
  const inn2 = (raw[1] != null && typeof raw[1] === 'object') ? raw[1] as NonNullable<typeof match.innings[1]> : undefined;

  return (
    <Link href={`/match/${match.id}`}>
      <div className="group bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-green-700 transition-all duration-200 cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <h2 className="font-display text-xl text-white group-hover:text-green-400 transition-colors">
            {match.title}
          </h2>
          <StatusBadge status={match.status} />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="text-sm text-gray-400 mb-1">{match.team1}</div>
            {inn1 && (
              <div className="font-mono text-lg text-white">
                {inn1.runs}/{inn1.wickets}
                <span className="text-xs text-gray-500 ml-1">
                  ({inn1.overs}.{inn1.balls})
                </span>
              </div>
            )}
          </div>

          <div className="text-gray-600 font-display text-lg">VS</div>

          <div className="flex-1 text-right">
            <div className="text-sm text-gray-400 mb-1">{match.team2}</div>
            {inn2 && (
              <div className="font-mono text-lg text-white">
                {inn2.runs}/{inn2.wickets}
                <span className="text-xs text-gray-500 ml-1">
                  ({inn2.overs}.{inn2.balls})
                </span>
              </div>
            )}
          </div>
        </div>

        {match.result && (
          <div className="mt-3 text-sm text-green-400 font-medium border-t border-gray-800 pt-3">
            {match.result}
          </div>
        )}

        <div className="mt-3 text-xs text-gray-600 font-mono">
          {match.overs} overs · {new Date(match.createdAt).toLocaleDateString()}
        </div>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const matches = await getAllMatches();

  const live = matches.filter(m => m.status === 'live' || m.status === 'innings_break');
  const upcoming = matches.filter(m => m.status === 'upcoming');
  const completed = matches.filter(m => m.status === 'completed');

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏏</span>
            <h1 className="font-display text-3xl text-white tracking-wide">CRICKET LIVE</h1>
          </div>
          <Link
            href="/admin"
            className="text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 border border-gray-800 rounded-lg hover:border-gray-600"
          >
            Admin →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {matches.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-6">🏏</div>
            <h2 className="font-display text-4xl text-gray-600 mb-2">NO MATCHES YET</h2>
            <p className="text-gray-600 text-sm mb-6">Create a match from the admin panel to get started.</p>
            <Link
              href="/admin"
              className="inline-block bg-green-700 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Go to Admin →
            </Link>
          </div>
        ) : (
          <>
            {live.length > 0 && (
              <section className="mb-10">
                <h2 className="font-display text-2xl text-green-400 mb-4 flex items-center gap-2">
                  <span className="live-dot inline-block w-2 h-2 bg-green-400 rounded-full"></span>
                  LIVE NOW
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {live.map(m => <MatchCard key={m.id} match={m} />)}
                </div>
              </section>
            )}

            {upcoming.length > 0 && (
              <section className="mb-10">
                <h2 className="font-display text-2xl text-amber-400 mb-4">UPCOMING</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {upcoming.map(m => <MatchCard key={m.id} match={m} />)}
                </div>
              </section>
            )}

            {completed.length > 0 && (
              <section className="mb-10">
                <h2 className="font-display text-2xl text-gray-500 mb-4">COMPLETED</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {completed.map(m => <MatchCard key={m.id} match={m} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
