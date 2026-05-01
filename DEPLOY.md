# Cricket Live — Vercel Deployment Guide

## Prerequisites

- Node.js 18+ installed locally
- A [Vercel](https://vercel.com) account (free tier works perfectly)
- An [Upstash](https://console.upstash.com) account (free tier: 10k requests/day)

---

## Step 1 — Set up Upstash Redis

1. Go to https://console.upstash.com and sign in
2. Click **Create Database**
3. Choose a name (e.g. `cricket-live`), region closest to your users
4. Select **REST API** type (default)
5. After creation, copy:
   - `UPSTASH_REDIS_REST_URL`  → the REST URL
   - `UPSTASH_REDIS_REST_TOKEN` → the REST token

---

## Step 2 — Deploy to Vercel

### Option A: Via Vercel CLI (recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# In the project directory
cd cricket-live
npm install
vercel

# Follow prompts:
# - Link to your Vercel account
# - Set project name
# - Framework: Next.js (auto-detected)
```

### Option B: Via GitHub

1. Push this repo to GitHub
2. Go to https://vercel.com/new
3. Import your GitHub repo
4. Vercel auto-detects Next.js — just click Deploy

---

## Step 3 — Set Environment Variables

In Vercel dashboard → your project → **Settings** → **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `UPSTASH_REDIS_REST_URL` | `https://your-db.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | `your_token_here` |
| `ADMIN_PASSWORD` | `choose_a_strong_password` |
| `NEXT_PUBLIC_BASE_URL` | `https://your-app.vercel.app` |

After adding variables → **Redeploy** the project.

---

## Step 4 — Local Development

```bash
# Copy env example
cp .env.example .env.local

# Edit .env.local with your actual values
nano .env.local

# Install and run
npm install
npm run dev
```

App runs at http://localhost:3000

---

## URL Structure

| URL | Description |
|-----|-------------|
| `/` | Public match list (share this with viewers) |
| `/match/[id]` | Live scorecard — real-time SSE updates |
| `/admin` | Admin scoring panel (password protected) |

---

## Scaling Notes

### For 1000+ concurrent viewers
- Vercel's serverless functions handle horizontal scaling automatically
- Each SSE connection polls Redis every 2s (very lightweight)
- Upstash Redis handles thousands of concurrent REST calls
- No WebSocket server needed — SSE works perfectly through Vercel

### Upstash free tier limits
- 10,000 requests/day free
- For 1000 viewers × 30 polls/min × 60 min match ≈ 1.8M requests
- Upgrade to Upstash Pay-As-You-Go ($0.2 per 100K commands) for live events

### Vercel free tier
- 100GB bandwidth/month
- Unlimited serverless function invocations
- Perfect for matches up to a few hundred concurrent viewers

---

## Admin Workflow

1. **Create match** in admin panel (set teams + overs)
2. **Enter toss** result
3. **Start innings**: enter openers + opening bowler
4. **Score ball-by-ball** using the buttons
5. At end of each over: **set next bowler**
6. On wicket: **confirm dismissal**, then **send in new batsman**
7. 2nd innings starts automatically after break
8. Match completes when target reached or all out

---

## Cricket Logic Reference

- **Target** = 1st innings runs + 1
- **Wide/No Ball**: +1 extra, ball NOT counted
- **Strike rotation**: odd runs swap ends; end of over also swaps
- **Wicket + odd runs**: bowler end batsman out (use run-out if non-striker)
- **10 wickets or overs complete**: innings ends automatically
- **Target reached**: match ends immediately, win calculated by wickets remaining
- **Tie**: if scores exactly equal at end of 2nd innings
