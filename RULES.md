# 📖 Draft Box — Official World Cup Rulebook

> This game is **not a fantasy league**. Unlike a typical fantasy draft where you knowingly pick a player from a list, here every round a **completely random real national team** is revealed to you, and you must take one player from that team for your squad. Speed of decision, luck, and managing which positions on your team are still open are the heart of this game.

---

## 1. Overview

1. You register an account.
2. You create a **room** (and get a 6-character code) or **join** another room with a code — or just play **Single Player**.
3. You pick your formation (e.g. 4-3-3).
4. You enter the **draft** phase: each round a random real national team is revealed, you take one player from it, the next random team appears... until your 11-man squad is complete.
5. Once every member of the room has finished drafting, the **2026 World Cup** begins with 48 teams — any team without a human player is run by a bot using its best real lineup.
6. You follow the group stage, then Round of 32 through the final, until a champion is decided — a real person or a bot.

---

## 2. Registration, Rooms & Invite Codes

- Every user registers with a username, email, and password.
- The room creator sets the maximum number of human players allowed in that room: **between 1 and 32** (configurable, default 32).
- Each room gets a **6-character code** (uppercase letters and digits, excluding look-alike characters like `0`/`O`). Share this code with others so they can join.
- While a room is in the "lobby" state, members can join and change their formation. Once the creator starts the game, no new members can join.
- **Single Player**: an instant-start shortcut — a room with a capacity of 1 is created and the draft begins immediately. You're the only human in the World Cup; the other 47 teams are bots.

---

## 3. Formations

Each player picks their own formation when creating/joining a room. The formation determines how many players you need from each **position group** (Goalkeeper GK / Defender DF / Midfielder MF / Forward FW):

| Formation | GK | DF | MF | FW |
|---|---|---|---|---|
| 4-3-3 | 1 | 4 | 3 | 3 |
| 4-4-2 | 1 | 4 | 4 | 2 |
| 4-2-3-1 | 1 | 4 | 5 | 1 |
| 3-5-2 | 1 | 3 | 5 | 2 |
| 5-3-2 | 1 | 5 | 3 | 2 |
| 4-1-4-1 | 1 | 4 | 5 | 1 |

The total is always 11 players. The formation only sets how many you need from each position group; within a group (say, all 4 defenders) it's up to you which players you take.

---

## 4. The Draft Phase — the Heart of the Game

### Core mechanic
Each round:
1. The server randomly picks **one real national team** from the 2026 World Cup field and shows you its full squad (with each player's real name, position, and overall rating).
2. From the players who are "pickable," you take **exactly one**.
3. The instant you pick, that player is locked into your squad forever, and the next random team is revealed.
4. This cycle continues until all 11 slots in your formation are filled.

### Why a player might not be pickable
A player in the currently revealed team stays greyed out (unclickable) if:
- **Their position is already full for you** (e.g. if all 4 of your defender slots are filled, any defenders on the next revealed team are off-limits no matter how good they are), or
- **Someone else in the room already took that exact player before you did.**

### A shared pool — real competition over players
All 1,008 World Cup players (48 teams × 21 players) sit in one **pool shared by every member of the room**. The moment someone drafts a player, that player becomes unavailable to everyone else in the room too. Because drafting happens **simultaneously and independently** (not turn-based), it's entirely possible that right while you're deciding on a star player, someone else in the room grabs them — and the next time that same team is revealed to you, that player is gone. This is intentional: **decisiveness and speed** are part of the strategy.

### Skipping
If you don't like any of the pickable players on the revealed team, you can hit "Skip & show next team" without picking, and a new random team appears. There's no limit on how many times you can skip.

### Final squad
Every member drafts exactly **11 starting players** (no substitutes). This 11-man squad is exactly what plays for that user throughout the entire World Cup.

---

## 5. The 2026 World Cup — the Real Format

### 48 teams, 12 groups
As soon as every member of the room finishes drafting, the World Cup begins:

1. Out of the 48 real 2026 World Cup teams, a **completely random country** is assigned to each human player present in the room (up to 32 humans). The 11-man squad you drafted now represents that country in the World Cup — not that country's real squad!
2. Teams with no human player are run by a **bot**: the bot automatically fields the best possible 11 (by overall rating, in a 4-3-3) from that country's real player pool.
3. All 48 teams are randomly placed into 12 groups of four (A through L).
4. Each group plays a round robin (every team plays every other team in its group once) — 6 matches per group, across 3 "matchdays."
5. **Advancement**: the top 2 finishers of every group (24 teams) plus the **8 best third-placed teams** (by points, goal difference, goals scored) advance directly to the **Round of 32**. This matches the real FIFA 2026 World Cup format exactly.

### Knockout stage
Round of 32 (32 teams) → Round of 16 (16) → Quarter-finals (8) → Semi-finals (4) → Final (2) → Champion.
Pairings in each round are random. If a knockout match ends level, a **penalty shootout** decides the winner.

### Match result simulation
The outcome of every match (bot vs. bot, human vs. bot, or human vs. human) is decided by a simple statistical model:
- Each team's strength = the average overall rating of its 11 players.
- Based on the strength difference between the two teams, an "expected goals" value is computed for each.
- The actual number of goals for each team is sampled from a Poisson distribution around that number — so there's always an element of luck; the weaker team can still win, just less often.
- In knockout rounds, a draw goes to penalties; the shootout winner is mostly luck-based, with a slight edge for the stronger team.

Any member of the room can hit "Simulate Next Stage" to advance the game engine (e.g. the next matchday of the group stage, or an entire knockout round); results are shown live to everyone in the room at once.

---

## 6. Getting Eliminated = Becoming a Spectator

If the team you represent (whether in the group stage or the knockout stage) gets eliminated, you as a player are **not removed from the game** — your squad simply stops playing, and from that point on you follow the rest of the room's World Cup as a **spectator**, to see who the eventual champion turns out to be (another human player, or a bot).

---

## 7. Single Player Mode

In Single Player mode, you're the only human in the room, and bots run the other 47 countries. Every rule about drafting, formations, the World Cup, and match simulation described above applies exactly the same — you just don't wait for anyone else, and the World Cup begins the moment your own draft is complete.

---

## 8. Current Scope: World Cup Only

Right now only "World Cup" mode is active (with the real 2026 World Cup teams and players). A "club league" mode is on the roadmap and will be added later.

---

## 9. About the Player Data (important)

The list of 48 teams matches the real, official field of nations qualified for the 2026 FIFA World Cup. However, **each team's squad and player overall ratings are approximate, unofficial data made for gameplay purposes**, not a licensed/official FIFA database:

- For major teams, a handful of real, well-known star players (with approximate overall ratings) are included in the squad.
- The rest of each team's squad (needed to have enough depth for every formation) is filled with **procedurally generated names in a style matching that country** — these players are not real.
- Every player's overall rating is a **fictional value made up for gameplay**, not an official EA/FIFA rating.

This is intentional: the goal of the game is an exciting draft-and-simulation experience, not a precise statistical database. If you want, this data layer (`server/src/data/teams2026.json`) can easily be swapped out for a more accurate, licensed data source.
