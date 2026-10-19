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

Club head coaches and the 20 free-agent coaches are imported from **[PGL-Coaches.txt](PGL-Coaches.txt)**. Setup previews, multiplayer lobbies and **Teams & Player Stats** show each club's supplied head coach separately from its human manager. The free-agent coach directory is available in league selection and during the season. These are roster profiles; coaches do not add match modifiers or hiring mechanics.

All 18 club crests from **PGL Logos.rar** appear in club previews, lobbies, draft reveals, standings, fixtures, match scores and team profiles. Assets are bundled locally for both the game server and GitHub Pages. Regenerate league data with `node server/src/data/generate-pgl.js`; reimport logos with `node scripts/import-pgl-logos.cjs` (requires a RAR-capable tar and the server's Playwright browser). The importer converts mislabeled WebP sources to actual PNGs.

The PGL roster comes directly from **[PGL-Players.txt](PGL-Players.txt)**: all 18 supplied clubs and 510 players, including their ratings, exact positions and `*` star markers. This is the game's supplied roster, rather than a claim about current official league membership.

Choose **Single Player → League Games → Persian Gulf League**, then your club and **Squad Mode**. **Draft Style** builds an XI from the league's players; **Real Club Squad** fills your chosen formation with players from the selected club. Lock your tactics and represent that club against the other clubs' bot squads. The season has **34 matchdays and 306 matches**: each club faces every other club once at home and once away. Draws remain draws; there are no knockout rounds. A win earns 3 points, a draw 1. Standings use points, goal difference, then goals scored; exact ties use club name for a stable game order. The top club at the end wins the title.

League setup places **Squad Mode**, **Mid-season Transfers**, **Mid-season Tactics** and **End-of-season Transfers** below **Experimental Auto Draft**, using keyboard-accessible option cards. For each transfer window, choose **Open** or **Closed** transfers and a **1 to 3 player-change limit** (default 2). Choose Closed to disable transfers for that window. If enabled, a transfer window pauses the season after **matchday 17**. Keep your current XI, or release one to your configured maximum players first, then choose one of **two randomly offered, position-compatible players** for each vacant slot. Ratings do not influence offer selection. Offers are disjoint between slots and persist across reloads and server restarts; only those offered players can be signed. Released players cannot be immediately re-signed. A captain's replacement inherits that slot's captain role. Player cards show the full supplied profile (name, club, positions, overall and star status), squad/captain status, and recorded season appearances, goals, assists, saves, cards and star moments. Transfer progress and the active XI save together, including vacant slots; play resumes once the XI is complete.

**PGL Overall Boost** is optional and exclusive to the Persian Gulf League. It gives all 510 supplied player profiles exactly **+10 Overall** in that league, including drafted players, real club squads, AI XIs, reserves and transfer offers. Team strength, attack/defense ratings and match calculations use those boosted values. The setting persists through reloads and continuing seasons without stacking. Other leagues, World Cup games, original data and unboosted PGL saves keep their supplied ratings.

Signing replacements applies a temporary coordination penalty to attack and defense: **1.5% per player changed**, up to **4.5%** for three signings. It fades linearly over the next **four played matches**, then ends. Snapshots and reloading do not advance recovery. This changes simulation strength, so a result is still sampled normally; upgraded players can still improve the squad overall. The coordination panel and match reviews show the actual penalty. Recovery saves with the season and applies equally when finishing all remaining fixtures.

On phones, standings fit the screen with rank, club, played, goal difference and points. **Show all stats** opens the full horizontally scrollable table; **Compact standings** restores the phone layout. Columns stay separate and club names wrap.

The standings mark the bottom two clubs with **↓** arrows: **Relegation zone** during the season and **Relegated** after the final matchday.

**Simulate to Transfer Window** runs every remaining first-half fixture through the normal match engine and stops after matchday 17. Results, standings and reports are retained, and the existing transfer rules still apply. The button is available before mid-season in single-player leagues. With transfers disabled it is labeled **Simulate to Mid-season**, and no transfer pause occurs. The finish-season button becomes available after halfway even when transfers are closed.

Open **Teams & Player Stats** to browse your club or switch clubs with the selector and previous/next buttons. The overview shows league position, points, matches played, goals for/against, average XI rating and squad size. Search names, positions or source clubs; combine position and Starting XI/Reserves/Departed filters, and sort by squad order, rating, goals, assists, saves, appearances or name. Player cards show positions, rating, squad status, captain/star badges and season statistics. Player lists show 12 profiles per page, while filters search the full roster. Counts, empty states, Clear Filters, My Club and Refresh help navigate the squad. Statistics stay scoped to the selected club through the matchday reached; unplayed players show zero appearances.

**Match Experience** offers **Live Match** (the default) or **Results Only** in solo and multiplayer league setup. Results Only shows one completed matchday at a time, with your club's score highlighted first, then automatically advances after two seconds until an enabled transfer/tactic window or the season end. It shows final scorelines, standings and results without a live feed, match selector, commentary, in-match player choices or next-matchday buttons. Management choices happen between fixtures; resolving them resumes play automatically. In multiplayer, everyone must complete or skip their transfers. Each user's saved cursor advances through every matchday, including when catching up after reconnecting; a faster browser cannot skip another user's results. Spoiler Mode is disabled for automatic results because no readiness clicks are required. A completed-matchday selector reviews saved scores. The option carries into continued seasons and rematches.

**Mid-season tactic changes** can be enabled during league creation. At halfway, choose one of the 12 built-in styles or keep your current tactic. This choice works even when player transfers are closed; the second half waits until you decide. Changing tactics affects future matches only.

**AI team transfers** is a separate setup option, available when transfers are open and the limit is above zero. At the enabled window, AI clubs choose randomly between two compatible reserves and exchange one with a starting player. Player ratings do not determine the offers or the final selection. Both clubs keep complete XIs and each AI club participates in at most the selected number of deals. AI teams protect your club and players, and changed AI XIs receive the same four-match coordination recovery. The searchable **Transfer Center** shows AI exchanges and your completed signings with players, clubs, ratings and the matchday. Clubs keep their squads when two eligible candidates are not available.

**End-of-season Transfers** has its own Open/Closed switch, **1 to 3** change limit and AI toggle, independent of the mid-season settings. It defaults to Closed for existing leagues. After completing a season, **Continue to Next Season** opens this window before matchday 1 of the next season, if enabled. Keep your XI or release 1 to the selected maximum and choose from two fixed random offers per slot. AI end-season deals appear in the Transfer Center, and new signings settle over the next four matches. The completed season and its reports remain intact.

After a completed season, **Continue to Next Season** carries your XI, captain, formation, chosen tactic, AI squads and league settings. Standings, fixtures, morale, season statistics and mid-season choices reset. Each season has a separate saved room and retains its results; **Previous Seasons** lets you review earlier seasons. Continue for as many seasons as you wish. The same 18 supplied clubs remain available; promotion/relegation between divisions is not simulated. **Create New League** starts a separate league from setup.

There are **12 built-in tactical styles**, including **Vertical Tiki-Taka**, **Overlapping Fullbacks** and **Catenaccio**. The picker uses the same modifiers and formation-fit data as the match engine, with strengths, trade-offs, risk, pressure and matchup guidance. Formation-fit modifiers are deterministic; match results remain sampled normally.

The dashboard's **Your League Seasons** section resumes unfinished drafts and seasons. Match history and career totals include completed league seasons. A rematch keeps the league, club, squad mode and transfer settings, with a fresh XI and transfer window. Persistence follows the hosting storage limits below.

Moving to a dashboard, new room or rematch cleans up the previous screen's listeners and match timers. A socket subscribes to one room channel at a time. Delayed lobby responses cannot reopen an abandoned game, and duplicate rematch requests return the same saved rematch room.

Room screens recover their saved state after a connection drop or when returning to a suspended phone page. A reconnect banner temporarily pauses controls until the room reloads; **Try again** retries the connection. Draft picks, transfer choices and each user's result cursor are restored from the server, and interrupted live reports stop before saved results are displayed.

Multiplayer league standings, upcoming fixtures and match results show **@username** alongside each human-managed club. Labels wrap on small screens; AI clubs keep their club names without a user label.

**Multiplayer League Games** is available through **Create Room → League Games → Persian Gulf League**. Up to 18 players choose different clubs; bots fill the remaining clubs. Invite friends with the room code; each joining player selects an available club before joining. Choose drafted or real club squads, human transfer windows (Open/Closed, 1–3 changes), optional +10 PGL ratings and the normal multiplayer draft controls. The simplified lobby omits AI transfers and mid-season tactics; Match Experience offers Live Match or Results Only. AI transfers and mid-season tactics are always disabled on the server in multiplayer leagues. All players must finish or skip a transfer window before another matchday can be generated; replacement offers are reserved to avoid conflicts. The host can continue to another season with the same squads, or create a rematch lobby.

Online league lobbies also offer two independent **Between Seasons** settings, both off by default. **AI Club Manager Offers** generates zero, one or two exclusive AI-club offers per user when the host opens next-season planning. Human-managed clubs are excluded. Each user accepts an offered club and its existing squad or stays with their current club; the host starts the next season after all decisions are saved. Unchosen offers are not rerolled on reconnect, and the previous season retains its original managers, squads and results.

When taking over an AI club, footballers already signed by another human club stay with their owner. Available reserves fill those positions, keeping a complete, distinct XI for every human manager, including older saved seasons. **Manager Moves** lists these squad updates; replacements receive the usual chemistry recovery.

**Player Departures After Poor Results** gives each bottom-third club a 40% chance to lose one or two footballers after the completed season. Human and AI clubs follow the same rule. Only players with eligible, unoccupied club reserves can leave; reserves step into the same slots, including the captain role, so closed transfer windows cannot strand an incomplete XI. Departures become free agents. The between-seasons panel lists departures and replacements, and the usual four-match chemistry recovery applies. These automatic departures are separate from the optional manual transfer-window limits.

Phone standings use four compact columns (rank, club, played, points), with goal difference beneath each club, highlighted user/relegation rows and intact club names. **Show all stats** opens the horizontally scrollable ten-column table.

Single-player League Games has **no Pick Timer** controls and no automatic pick countdown. World Cup and multiplayer draft timers remain available.

`server/src/data/competitions.js` is the league registry, `generate-pgl.js` validates and imports the source list, and `leagueEngine.js` builds fixtures and tracks the season. Additional leagues can be registered independently of the UI.

## Architecture

```
web/     static frontend (vanilla JS, no build step)
server/  Node.js + Express + Socket.io + node:sqlite → serves the frontend and API
```

The Node server serves the whole game at one address. The browser connects to that address automatically, including live Socket.io updates. GitHub Pages can host the frontend, but cannot run the Node server; connect Pages to a deployed backend as described below.

Phone and tablet layouts support narrow screens and portrait/landscape use, with larger touch targets, safe-area padding, readable controls, scrollable tables, adaptive player grids and viewport-sized dialogs.

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

**Profile** groups career statistics, friends, draft layout preferences and password settings into separate tabs. **Formations & Tactics** includes a live formation preview and searchable cards using the actual tactical catalog. **Rulebook** has topic navigation, search and expandable explanations for World Cup and League Games.

**Profile → Security** lets players change their email after confirming their current password. Addresses are validated and compared without case sensitivity, and the new address can be used to sign in immediately. **Profile → Clan** creates a group with a unique 2–6 character tag or joins an existing group by tag. Players belong to one clan at a time; clan tags appear on profiles and lobby member lists. Leaders can edit the name/description. Leaving transfers leadership to the earliest remaining member; an empty clan closes and frees its tag. Clan members see usernames and roles, with no email addresses exposed.

Multiplayer league club choices refresh while joining. Drafted footballers are exclusive across the room: a pick disables that card on other open draft screens and cancels a stale position chooser. The server and database reject duplicate picks, including after reconnects.

The **About Us** information icon in the header opens a public introduction. **Admin Panel → About Us** edits the page title, short introduction, story, organization name, contact email and website/GitHub/Telegram links, with a live preview. **Save & publish** makes the content public immediately; empty optional fields disappear. Content is plain text, URLs are validated, and concurrent changes are protected by revision checks. Content is stored in SQLite alongside accounts and games and requires persistent hosting storage to survive redeploys.

After completing or skipping mid-season transfers, **Finish Season & View Results** simulates the remaining fixtures and saves every match. Results include the final table, champion, relegated clubs, team record, awards, top scorers, creators, goalkeeper saves and star moments.

**Admin** signs directly into a dedicated admin workspace. Administrator accounts cannot create/join games, draft, play leagues or connect to the live game server; the server enforces this separation. Normal players keep all 12 built-in tactical styles. **Custom Tactics** is an administrative analysis tool inside the panel.

In **Admin Panel → Users → View**, **Kick / Sign Out** revokes every current session; the user may sign in again. **Ban** immediately blocks sign-in, existing tokens and live sockets; **Unban** allows a new sign-in. Banned or deleted managers are removed from active games, their league clubs continue under AI, and another available player becomes host. **Delete Account** requires typing the username, removes personal sign-in details and social links, transfers clan leadership, and anonymizes saved results while preserving game history. Administrator accounts are protected from these actions. The Users activity filter includes Banned accounts.

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
