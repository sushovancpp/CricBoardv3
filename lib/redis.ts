// lib/redis.ts — Upstash Redis REST client wrapper

import { Redis } from '@upstash/redis';
import type { Match } from './cricket';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN env vars');
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ─── Key helpers ─────────────────────────────────────────────────────────────
const MATCH_KEY = (id: string) => `match:${id}`;
const MATCHES_SET_KEY = 'matches:all';
const SSE_CHANNEL = (id: string) => `sse:${id}`;

// ─── Match CRUD ───────────────────────────────────────────────────────────────

export async function saveMatch(match: Match): Promise<void> {
  await redis.set(MATCH_KEY(match.id), JSON.stringify(match));
  await redis.sadd(MATCHES_SET_KEY, match.id);
}

export async function getMatch(id: string): Promise<Match | null> {
  const raw = await redis.get<string>(MATCH_KEY(id));
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw as Match;
}

export async function getAllMatches(): Promise<Match[]> {
  const ids = await redis.smembers(MATCHES_SET_KEY);
  if (!ids || ids.length === 0) return [];
  const matches = await Promise.all(ids.map(id => getMatch(id as string)));
  return matches
    .filter((m): m is Match => m !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteMatch(id: string): Promise<void> {
  await redis.del(MATCH_KEY(id));
  await redis.srem(MATCHES_SET_KEY, id);
}

// ─── SSE pub/sub via Redis Lists ──────────────────────────────────────────────
// We push update notifications; SSE endpoint polls with BLPOP equivalent.
// Since Upstash REST doesn't support blocking commands, we use a simple
// timestamp-based publish: push a short message to a list + set TTL.

export async function publishUpdate(matchId: string, match: Match): Promise<void> {
  const key = SSE_CHANNEL(matchId);
  const payload = JSON.stringify({ ts: Date.now(), match });
  // Keep last 50 events; TTL 1 hour
  await redis.lpush(key, payload);
  await redis.ltrim(key, 0, 49);
  await redis.expire(key, 3600);
}

export async function getLatestUpdate(matchId: string, afterTs: number): Promise<Match | null> {
  const key = SSE_CHANNEL(matchId);
  const items = await redis.lrange<string>(key, 0, 0);
  if (!items || items.length === 0) return null;
  const raw = items[0];
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw as { ts: number; match: Match };
  if (parsed.ts > afterTs) return parsed.match;
  return null;
}
