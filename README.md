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
5. After creation, copy:# 🏏 Cricket Live

A real-time cricket scoring system built with **Next.js**, **Upstash Redis**, and **Server-Sent Events (SSE)**. Score matches ball-by-ball from the admin panel while 1000+ viewers watch the live scorecard update instantly.

---

## ✨ Features

- 🔴 **Live scoring** — ball-by-ball with real-time SSE updates (no page refresh needed)
- 📊 **Full scorecard** — batsman stats, bowler figures, run rate, required run rate
- 🏆 **Auto result** — match result announced instantly when target is reached or innings ends
- 📋 **Match history** — view, open, and delete past matches
- 🔐 **Password protected** admin panel
- 📱 **Mobile friendly** — works on any device
- ⚡ **Scalable** — serverless on Vercel + Upstash Redis handles 1000+ concurrent viewers

---

## 🖥️ Screenshots

| Match Viewer (Live) | Admin Scoring Panel | Match History |
|---|---|---|
| Live scorecard with ball log | Ball-by-ball scoring buttons | All matches with delete |

---

## 🚀 Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/cricket-live.git
cd cricket-live
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here
ADMIN_PASSWORD=your_secure_password
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🌐 Deploy to Vercel

### Option A — GitHub (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repo — Next.js is auto-detected
4. Add environment variables (see below)
5. Click **Deploy**

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel
```

### Environment Variables (Vercel Dashboard)

| Variable | Description |
|---|---|
| `UPSTASH_REDIS_REST_URL` | From [Upstash Console](https://console.upstash.com) |
| `UPSTASH_REDIS_REST_TOKEN` | From [Upstash Console](https://console.upstash.com) |
| `ADMIN_PASSWORD` | Your chosen admin password |
| `NEXT_PUBLIC_BASE_URL` | Your Vercel app URL e.g. `https://cricket-live.vercel.app` |

---

## 📁 Project Structure

```
cricket-live/
├── app/
│   ├── page.tsx                      # Public match list
│   ├── layout.tsx                    # Root layout + fonts
│   ├── globals.css                   # Global styles
│   ├── admin/
│   │   └── page.tsx                  # Admin panel page
│   ├── match/[id]/
│   │   └── page.tsx                  # Live match viewer page
│   └── api/
│       ├── matches/
│       │   ├── route.ts              # GET all, POST create, DELETE all
│       │   └── [id]/route.ts         # GET, PUT, DELETE single match
│       ├── admin/score/
│       │   └── route.ts              # Ball events, toss, innings
│       └── events/[matchId]/
│           └── route.ts              # SSE live updates
├── components/
│   ├── AdminPanel.tsx                # Admin scoring UI
│   └── MatchViewer.tsx               # Live scorecard UI
├── lib/
│   ├── cricket.ts                    # Cricket logic engine
│   ├── redis.ts                      # Redis client + match CRUD
│   ├── auth.ts                       # Admin password verification
│   └── id.ts                         # Match ID generator
├── .env.example
├── DEPLOY.md
└── README.md
```

---

## 🏏 How to Score a Match

1. Go to `/admin` and enter your password
2. Click **+ New Match** — enter team names and overs
3. Set the **toss** result
4. Score **ball by ball** using the buttons:

| Button | Meaning |
|---|---|
| `•` | Dot ball |
| `1` `2` `3` `4` `6` | Runs scored |
| `WD` | Wide — 1 extra, ball not counted |
| `NB` | No Ball — 1 extra, ball not counted |
| `🔴 OUT` | Wicket — next batter comes in automatically |

5. At end of each over — **set the next bowler's name**
6. Edit player names anytime via the **PLAYERS panel**
7. After 1st innings — click **Start 2nd Innings**
8. Match ends automatically when target is reached or all out

---

## ⚙️ Cricket Rules Implemented

- **Target** = 1st innings runs + 1
- **Wide / No Ball** = +1 extra run, ball NOT counted toward the over
- **Strike rotation** = odd runs swap ends; end of over always swaps
- **Wicket on last ball** = non-striker retains strike, new batter comes in at non-strike end
- **Target reached mid-over** = match ends immediately, result announced
- **10 wickets or overs complete** = innings ends automatically
- **Tie** = if scores exactly equal at end of 2nd innings

---

## 🛠️ Tech Stack

| Technology | Usage |
|---|---|
| [Next.js 14](https://nextjs.org) | Full-stack React framework |
| [Upstash Redis](https://upstash.com) | Serverless Redis for match data + SSE pub/sub |
| [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) | Real-time live updates |
| [Tailwind CSS](https://tailwindcss.com) | Styling |
| [TypeScript](https://typescriptlang.org) | Type safety |
| [Vercel](https://vercel.com) | Deployment + serverless functions |

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/matches` | List all matches |
| `POST` | `/api/matches` | Create a new match |
| `DELETE` | `/api/matches` | Delete all matches |
| `GET` | `/api/matches/[id]` | Get a single match |
| `DELETE` | `/api/matches/[id]` | Delete a single match |
| `POST` | `/api/admin/score` | Score a ball / set toss / start innings |
| `GET` | `/api/events/[matchId]` | SSE stream for live updates |

---

## 📈 Scaling

| Scenario | Capacity |
|---|---|
| Vercel free tier | Handles hundreds of concurrent viewers |
| Upstash free tier | 10,000 requests/day |
| Upstash Pay-As-You-Go | 1000+ viewers × full match ≈ ~2M requests ($0.2/100K) |

Each viewer connects via SSE and polls Redis every 2 seconds. Vercel's serverless functions scale horizontally automatically.

---

## 📄 License

MIT — free to use, modify, and deploy.

---

> Built for live cricket scoring at local tournaments, school matches, and club games. Share the `/match/[id]` URL with your audience and they'll see every ball live. 🏏
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
