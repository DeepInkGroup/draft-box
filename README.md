# ⚽ Draft Box

A real-time multiplayer football **draft** game (not a fantasy league!). Players build an 11-man squad by getting one randomly-revealed real national team per round and grabbing one player from it, then take that squad into a full 2026-format, 48-team World Cup — group stage through the final — against real-country bot squads and other players in the room.

Full game design & rules: **[RULES.md](RULES.md)**

- 🌍 World Cup mode only for now (2026 field: 48 teams, 12 groups of 4, top 2 + best 8 thirds advance to Round of 32)
- 🔑 Create a room → get a 6-character code → friends join with it (up to 32 human-controlled slots, configurable)
- 🎲 Draft: each round reveals one random real team's full squad; pick one available player; picks are shared/contested room-wide
- 🤖 Single-player mode: draft alone against 47 bot-controlled countries
- 📊 Simple statistical match simulation (Poisson goals from squad overall)
- 👻 Eliminated players become spectators for the rest of the room's tournament

## Architecture

```
web/     static frontend (vanilla JS, no build step)
server/  Node.js + Express + Socket.io + node:sqlite → serves the frontend and API
```

The Node server serves the whole game at one address. The browser connects to that address automatically, including live Socket.io updates. GitHub Pages can host the frontend, but cannot run the Node server; connect Pages to a deployed backend as described below.

## Local development

Requires **Node.js ≥ 22.13**; Node 24 LTS is recommended. Uses built-in `node:sqlite`, so no native compilation or Visual Studio / build-essential is required.

```bash
cd server
cp .env.example .env      # edit JWT_SECRET etc.
npm ci
npm start                 # listens on :4321 by default
```

Open **http://localhost:4321**. The frontend, API, and live game server are all served there; no second server or address setting is needed.

To regenerate the bundled player data or run integration checks:

```bash
npm run gen:data
npm test
```

If you serve `web/` separately, enter `http://localhost:4321` in its server settings.

## Run inside GitHub (Codespaces)

[Open Draft Box in GitHub Codespaces](https://codespaces.new/DeepInkGroup/draft-box)

Create a Codespace on `master`. The included `.devcontainer` installs the dependencies, starts the game, and forwards port **4321**. Open that port's browser link to play. If the browser does not open automatically, use the **Ports** tab. Server logs are at `/tmp/draft-box.log`.

Codespaces is a development environment that stops when inactive. Use a server host for an ongoing multiplayer deployment.

## Deploy the full game from GitHub (Render)

[Deploy the included Render Blueprint](https://render.com/deploy?repo=https://github.com/DeepInkGroup/draft-box)

Sign in to Render, select this repository and branch `master`, and create the Blueprint. `render.yaml` builds the full application image, generates a JWT secret, and checks `/api/health`. After the deployment succeeds, open the service's HTTPS URL to play. Copy the actual URL from Render; the service name does not guarantee a particular hostname.

The included free plan uses ephemeral storage: accounts and games are lost when the service restarts or redeploys. For persistent online data, choose a plan supporting a disk, mount it at `/app/data`, and enable the commented disk block in `render.yaml`. Local runs and Docker Compose retain their databases.

## Connect GitHub Pages to the server

1. Deploy the backend, then copy its HTTPS origin (without `/api`).
2. In this repository, open **Settings → Secrets and variables → Actions → Variables** and create `DRAFTBOX_API_BASE` with that URL.
3. Run **Actions → Deploy frontend to GitHub Pages → Run workflow**, or push a change under `web/`.
4. Open [Draft Box on GitHub Pages](https://deepinkgroup.github.io/draft-box/). Everyone uses the configured server automatically. The server settings button still supports an individual override; clearing it restores the deployment default.

The Render Blueprint already permits `https://deepinkgroup.github.io` for browser requests. If using a custom frontend domain, add that origin to the server's comma-separated `CORS_ORIGIN` setting.

## Docker

```bash
docker compose up --build
```

Open **http://localhost:4321**. This builds and runs the full app with a persisted SQLite volume. Docker builds must use the repository root as their build context: `docker build -f server/Dockerfile .`.

## Data disclaimer

The 48-team list matches the real 2026 World Cup field, and all 1,248 players are real members of each nation's actual 26-man squad. Overall ratings come from the final bundled player database for gameplay use, not an official/licensed rating dataset. See [RULES.md §9](RULES.md#9-about-the-player-data-important) for the full breakdown.
