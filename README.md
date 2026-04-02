# 🏏 IPL Watch Party

A production-grade real-time cricket watch party platform. Watch IPL matches together with friends — live scores, ball-by-ball commentary, reactions, polls, and private rooms.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=flat&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socketdotio&logoColor=white)

---

## Features

- **Live scores** — real-time innings scores, overs, target, required run rate
- **Ball-by-ball commentary** — FOUR, SIX, WICKET events with batter/bowler names and shot descriptions
- **Over summaries** — posted to chat right after each over completes
- **Current over tracker** — live ball dots (W/4/6/wide/no-ball) in the score header
- **Polls** — create and vote on live match polls
- **Reactions** — floating emoji reactions synced across all users
- **Private rooms** — pay ₹99 via Razorpay to create an invite-only watch room
- **Match day ads** — dismissable ad banners integrated into lobby and watch party
- **Auto-refresh lobby** — match list updates every 15s without page reload

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    React Frontend                    │
│         (Vite · Socket.io-client · React Router)    │
└──────────────────────┬──────────────────────────────┘
                       │ WebSocket + REST
┌──────────────────────▼──────────────────────────────┐
│                  Express API Server                  │
│              (Socket.io · JWT Auth)                  │
├──────────────┬───────────────────┬──────────────────┤
│   MongoDB    │      Redis        │   Live Poller    │
│  (Rooms,     │  (Online counts,  │  (ESPN scraper,  │
│  Messages,   │   session cache)  │   4s intervals)  │
│  Polls)      │                   │                  │
└──────────────┴───────────────────┴──────────────────┘
                              │
              ┌───────────────▼───────────────┐
              │     ESPNcricinfo Scraper       │
              │  (No API key — __NEXT_DATA__)  │
              │  · Live scores                 │
              │  · Ball-by-ball data           │
              │  · Match schedule              │
              │  · Match completion detection  │
              └───────────────────────────────┘
```

### Key Technical Decisions

**ESPN `__NEXT_DATA__` scraping** — ESPNcricinfo embeds full match state as JSON in every page's `__NEXT_DATA__` script tag. No API key required. The scraper deep-traverses this JSON to extract innings, ball-by-ball deliveries, and result text.

**Ball deduplication across innings** — ESPN's ball `id` field is monotonically increasing across the entire match. Used as the primary sort/dedup key to prevent innings 1 ball data bleeding into innings 2 displays.

**Innings break detection** — ESPN keeps `isCurrent: true` during innings breaks. We detect completion by checking `balls >= totalBalls || wickets >= 10` (handles DLS/rain-shortened matches via ESPN's `totalBalls` field).

**Event-driven commentary pipeline** — Each poll computes a diff of new balls since `lastBallId`. Typed events (WICKET, SIX, FOUR, OVER_COMPLETE, MATCH_RESULT, INNINGS_BREAK) are persisted to MongoDB and emitted via Socket.io rooms simultaneously.

**Private room score propagation** — Private rooms join a `scores:<matchId>` Socket.io channel. The poller emits score updates to both the public match room and the scores channel, so private room members receive live updates without being in the public chat.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | Node.js, Express |
| Real-time | Socket.io |
| Database | MongoDB (Mongoose) |
| Cache / Presence | Redis |
| Frontend | React, Vite |
| Auth | JWT |
| Payments | Razorpay |
| Scraping | Custom ESPN `__NEXT_DATA__` parser |
| Deployment | AWS (ap-south-1) |

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB
- Redis

### API Setup
```bash
cd api
npm install
cp .env.example .env
# Fill in MONGODB_URI, REDIS_URL, JWT_SECRET, RAZORPAY keys
npm run dev
```

### Web Setup
```bash
cd web
npm install
npm run dev
```

### Environment Variables

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/ipl_watch_party
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_secret
FRONTEND_URL=http://localhost:5173
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
CRICKET_POLL_INTERVAL_MS=4000
```

---

## Project Structure

```
ipl-watch-party/
├── api/
│   ├── src/
│   │   ├── models/          # Room, Message, Poll, User
│   │   ├── routes/          # auth, rooms, payments
│   │   ├── services/        # livePoller, scoresScraper
│   │   └── socket/          # handlers (chat, poll, reaction)
│   └── scripts/             # seed script
└── web/
    └── src/
        ├── components/      # ScoreHeader, ChatStream, AdBanner...
        ├── pages/           # Lobby, WatchParty, CreatePrivateRoom...
        └── context/         # Auth, Socket
```
