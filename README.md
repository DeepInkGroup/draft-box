# ⚽ Draft Box

A real-time multiplayer football **draft** game (not a fantasy league!). Players build an 11-man squad by getting one randomly-revealed real national team per round and grabbing one player from it, then take that squad into a full 2026-format, 48-team World Cup — group stage through the final — against real-country bot squads and other players in the room.

Full game design & rules (Persian): **[RULES.md](RULES.md)**

- 🌍 World Cup mode only for now (2026 field: 48 teams, 12 groups of 4, top 2 + best 8 thirds advance to Round of 32)
- 🔑 Create a room → get a 6-character code → friends join with it (up to 32 human-controlled slots, configurable)
- 🎲 Draft: each round reveals one random real team's full squad; pick one available player; picks are shared/contested room-wide
- 🤖 Single-player mode: draft alone against 47 bot-controlled countries
- 📊 Simple statistical match simulation (Poisson goals from squad overall)
- 👻 Eliminated players become spectators for the rest of the room's tournament

## Architecture

```
web/     static frontend (vanilla JS, no build step) → deployed to GitHub Pages
server/  Node.js + Express + Socket.io + node:sqlite backend → deploy separately (Docker)
```

GitHub Pages only serves static files, so the backend (auth, rooms, draft, tournament engine, live socket updates) must be deployed on its own (a VPS, Render, Fly.io, etc. — see `server/Dockerfile`). The frontend's backend URL is configurable at runtime from the ⚙️ button in the top bar (saved to `localStorage`, no rebuild needed).

## Local development

Requires **Node.js ≥ 22.5** (uses the built-in `node:sqlite` module — no native build step, no Visual Studio / build-essential required).

```bash
cd server
cp .env.example .env      # edit JWT_SECRET etc.
npm install
npm run gen:data          # (re)generates server/src/data/teams2026.json
npm start                 # listens on :4321 by default
```

Serve `web/` with any static file server, e.g.:

```bash
cd web
python -m http.server 5500
```

Open `http://localhost:5500`, then set the backend URL (⚙️ icon) to `http://localhost:4321` if it isn't already the default.

## Docker

```bash
docker compose up --build
```

This builds and runs the backend on port `4321` with a persisted SQLite volume. Point your deployed frontend's ⚙️ settings at this server's public URL.

## Data disclaimer

The 48-team list matches the real 2026 World Cup field. Squad rosters are a mix of a handful of real, well-known players per major team plus procedurally generated names/ratings to fill out playable squads — **not an official/licensed dataset**. See [RULES.md §9](RULES.md#۹-دربارهٔ-دادهٔ-بازیکنان-مهم) for details; swap `server/src/data/teams2026.json` for a different source if you need accuracy.
