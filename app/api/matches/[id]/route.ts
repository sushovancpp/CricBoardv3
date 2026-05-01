// app/api/matches/[id]/route.ts
import { NextRequest } from 'next/server';
import { getMatch, saveMatch, deleteMatch } from '@/lib/redis';
import { verifyAdminPassword, unauthorizedResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const match = await getMatch(params.id);
  if (!match) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(match);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { password, ...updates } = body;

  if (!verifyAdminPassword(password)) return unauthorizedResponse();

  const match = await getMatch(params.id);
  if (!match) return Response.json({ error: 'Not found' }, { status: 404 });

  const updated = { ...match, ...updates, updatedAt: Date.now() };
  await saveMatch(updated);
  return Response.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  if (!verifyAdminPassword(body.password)) return unauthorizedResponse();

  await deleteMatch(params.id);
  return Response.json({ success: true });
}