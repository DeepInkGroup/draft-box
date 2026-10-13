# ⚽ Draft Box

A real-time multiplayer football **draft** game (not a fantasy league!). Players build an 11-man squad by getting one randomly-revealed real national team per round and grabbing one player from it, then take that squad into a full 2026-format, 48-team World Cup — group stage through the final — against real-country bot squads and other players in the room.

Full game design & rules: **[RULES.md](RULES.md)**

- 🌍 World Cup mode (2026 field: 48 teams, 12 groups of 4, top 2 + best 8 thirds advance to Round of 32)
- ⚽ Single Player → League Games: choose the Persian Gulf League (Iran), select a club, draft a league XI, and play a home-and-away season
- 🔑 Create a room → get a 6-character code → friends join with it (up to 32 human-controlled slots, configurable)
- 🎲 Draft: each round reveals one random real team's full squad; pick one available player; picks are shared/contested room-wide
- 🤖 Single-player mode: draft alone against 47 bot-controlled countries
- 📊 Simple statistical match simulation (Poisson goals from squad overall)
- 👻 Eliminated players become spectators for the rest of the room's tournament

## League Games

The PGL roster comes directly from **[PGL-Players.txt](PGL-Players.txt)**: all 18 supplied clubs and 510 players, including their ratings, exact positions and `*` star markers. This is the game's supplied roster, rather than a claim about current official league membership.

Choose **Single Player → League Games → Persian Gulf League**, then your club and **Squad Mode**. **Draft Style** builds an XI from the league's players; **Real Club Squad** fills your chosen formation with players from the selected club. Lock your tactics and represent that club against the other clubs' bot squads. The season has **34 matchdays and 306 matches**: each club faces every other club once at home and once away. Draws remain draws; there are no knockout rounds. A win earns 3 points, a draw 1. Standings use points, goal difference, then goals scored; exact ties use club name for a stable game order. The top club at the end wins the title.

League setup places **Squad Mode**, **Mid-season Transfers**, **Mid-season Tactics** and **End-of-season Transfers** below **Experimental Auto Draft**, using keyboard-accessible option cards. For each transfer window, choose **Open** or **Closed** transfers and a **0 to 3 player-change limit** (default 2). A limit of 0 disables transfers. If enabled, a transfer window pauses the season after **matchday 17**. Keep your current XI, or release one to your configured maximum players first, then choose one of **two randomly offered, position-compatible players** for each vacant slot. Ratings do not influence offer selection. Offers are disjoint between slots and persist across reloads and server restarts; only those offered players can be signed. Released players cannot be immediately re-signed. A captain's replacement inherits that slot's captain role. Player cards show the full supplied profile (name, club, positions, overall and star status), squad/captain status, and recorded season appearances, goals, assists, saves, cards and star moments. Transfer progress and the active XI save together, including vacant slots; play resumes once the XI is complete.

Signing replacements applies a temporary coordination penalty to attack and defense: **1.5% per player changed**, up to **4.5%** for three signings. It fades linearly over the next **four played matches**, then ends. Snapshots and reloading do not advance recovery. This changes simulation strength, so a result is still sampled normally; upgraded players can still improve the squad overall. The coordination panel and match reviews show the actual penalty. Recovery saves with the season and applies equally when finishing all remaining fixtures.

The standings mark the bottom two clubs with **↓** arrows: **Relegation zone** during the season and **Relegated** after the final matchday.

**Simulate to Transfer Window** runs every remaining first-half fixture through the normal match engine and stops after matchday 17. Results, standings and reports are retained, and the existing transfer rules still apply. The button is available before mid-season in single-player leagues. With transfers disabled it is labeled **Simulate to Mid-season**, and no transfer pause occurs. The finish-season button becomes available after halfway even when transfers are closed.

Open **Teams & Player Stats** during the season to select any club, search its players and inspect its formation, tactical style, starting XI, roster/released status, positions, ratings, stars and recorded statistics. Statistics are counted for the selected club through the matchday you have reached; unplayed roster members show zero appearances.

**Mid-season tactic changes** can be enabled during league creation. At halfway, choose one of the 12 built-in styles or keep your current tactic. This choice works even when player transfers are closed; the second half waits until you decide. Changing tactics affects future matches only.

**AI team transfers** is a separate setup option, available when transfers are open and the limit is above zero. At the enabled window, AI clubs choose randomly between two compatible reserves and exchange one with a starting player. Player ratings do not determine the offers or the final selection. Both clubs keep complete XIs and each AI club participates in at most the selected number of deals. AI teams protect your club and players, and changed AI XIs receive the same four-match coordination recovery. The searchable **Transfer Center** shows AI exchanges and your completed signings with players, clubs, ratings and the matchday. Clubs keep their squads when two eligible candidates are not available.

**End-of-season Transfers** has its own Open/Closed switch, **0 to 3** change limit and AI toggle, independent of the mid-season settings. It defaults to Closed for existing leagues. After completing a season, **Continue to Next Season** opens this window before matchday 1 of the next season, if enabled. Keep your XI or release 1 to the selected maximum and choose from two fixed random offers per slot. AI end-season deals appear in the Transfer Center, and new signings settle over the next four matches. The completed season and its reports remain intact.

After a completed season, **Continue to Next Season** carries your XI, captain, formation, chosen tactic, AI squads and league settings. Standings, fixtures, morale, season statistics and mid-season choices reset. Each season has a separate saved room and retains its results; **Previous Seasons** lets you review earlier seasons. Continue for as many seasons as you wish. The same 18 supplied clubs remain available; promotion/relegation between divisions is not simulated. **Create New League** starts a separate league from setup.

There are **12 built-in tactical styles**, including **Vertical Tiki-Taka**, **Overlapping Fullbacks** and **Catenaccio**. The picker uses the same modifiers and formation-fit data as the match engine, with strengths, trade-offs, risk, pressure and matchup guidance. Formation-fit modifiers are deterministic; match results remain sampled normally.

The dashboard's **Your League Seasons** section resumes unfinished drafts and seasons. Match history and career totals include completed league seasons. A rematch keeps the league, club, squad mode and transfer settings, with a fresh XI and transfer window. Persistence follows the hosting storage limits below.

`server/src/data/competitions.js` is the league registry, `generate-pgl.js` validates and imports the source list, and `leagueEngine.js` builds fixtures and tracks the season. Additional leagues can be registered independently of the UI. League multiplayer is currently disabled at the server boundary; club assignments are stored per participant so it can be added later.

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
npm run test:ui           # browser checks; use npx playwright install chromium first if needed
```

If you serve `web/` separately, enter `http://localhost:4321` in its server settings.

## Version 2.1.3: season results and admin tools

After completing or skipping mid-season transfers, **Finish Season & View Results** simulates the remaining fixtures and saves every match. Results include the final table, champion, relegated clubs, team record, awards, top scorers, creators, goalkeeper saves and star moments.

**Admin** signs directly into a dedicated admin workspace. Administrator accounts cannot create/join games, draft, play leagues or connect to the live game server; the server enforces this separation. Normal players keep all 12 built-in tactical styles. **Custom Tactics** is an administrative analysis tool inside the panel.

The requested `Admin` account is initialized on first server startup. Its initial password is stored as a bcrypt hash; no password is included in browser code. Deploys never reset an existing account's password. Hosts can set `ADMIN_INITIAL_PASSWORD` before first startup to override the initial password. Use **Admin Panel → Account** to change the password.

**Users** provides an administrator-only directory with usernames, emails, roles, friend codes, signup dates, last login and last activity, plus account details and recent games. Search, role/activity filters, sorting and pagination help inspect accounts. **Online** means at least one live game connection; **Recently active** means an authenticated request in the last five minutes; **Offline** means older activity; **No activity recorded** means there is no recorded timestamp (including older accounts before activity tracking). The directory never exposes password hashes or tokens. Refresh updates the overview and directory; desktop and mobile navigation keep each administrative task in its own section.

The admin panel offers searchable PGL and World Cup player profiles, club/position/rating filters, comparisons of up to three players, game totals and league reports with club/player statistics. The tactics lab adds 12 built-in templates, bounded sliders with trade-offs, JSON import/export, duplication, saved version history and restore. Its Match Lab compares the current editor values against Balanced in 20–100 simulations per style using the actual match engine and the same XI, opponent and neutral morale. Random samples vary; these experiments do not advance a saved season.

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
