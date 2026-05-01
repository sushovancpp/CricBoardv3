// app/api/matches/route.ts
import { NextRequest } from 'next/server';
import { getAllMatches, saveMatch, deleteMatch } from '@/lib/redis';
import { verifyAdminPassword, unauthorizedResponse } from '@/lib/auth';
import { generateId } from '@/lib/id';
import type { Match } from '@/lib/cricket';

export const dynamic = 'force-dynamic';

export async function GET() {
  const matches = await getAllMatches();
  return Response.json(matches);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { password, title, team1, team2, overs } = body;

  if (!verifyAdminPassword(password)) return unauthorizedResponse();

  if (!title || !team1 || !team2 || !overs) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const match: Match = {
    id: generateId(),
    title,
    team1,
    team2,
    overs: Number(overs),
    status: 'upcoming',
    innings: [undefined, undefined],
    currentInnings: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await saveMatch(match);
  return Response.json(match, { status: 201 });
}

// Delete ALL matches
export async function DELETE(req: NextRequest) {
  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  if (!verifyAdminPassword(body.password)) return unauthorizedResponse();

  const matches = await getAllMatches();
  await Promise.all(matches.map(m => deleteMatch(m.id)));
  return Response.json({ success: true, deleted: matches.length });
}