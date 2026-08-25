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
| 4-5-1 | 1 | 4 | 5 | 1 |
| 3-4-3 | 1 | 3 | 4 | 3 |
| 3-5-2 | 1 | 3 | 5 | 2 |
| 5-4-1 | 1 | 5 | 4 | 1 |
| 4-1-2-1-2 | 1 | 4 | 4 | 2 |
| 4-4-1-1 | 1 | 4 | 4 | 2 |
| 5-3-2 | 1 | 5 | 3 | 2 |
| 3-4-1-2 | 1 | 3 | 5 | 2 |
| 4-2-2-2 | 1 | 4 | 4 | 2 |
| 5-2-3 | 1 | 5 | 2 | 3 |
| 5-3-1-1 | 1 | 5 | 3 | 2 |
| 3-2-4-1 | 1 | 3 | 6 | 1 |
| 4-2-4 | 1 | 4 | 2 | 4 |
| 3-3-2-2 | 1 | 3 | 5 | 2 |
| 4-1-4-1 | 1 | 4 | 5 | 1 |
| 5-2-2-1 | 1 | 5 | 4 | 1 |
| 3-5-1-1 | 1 | 3 | 5 | 2 |
| 2-5-2-1 | 1 | 2 | 7 | 1 |
| 3-3-1-3 | 1 | 3 | 4 | 3 |
| 4-3-2-1 | 1 | 4 | 5 | 1 |
| 4-3-1-2 | 1 | 4 | 4 | 2 |

The total is always 11 players. Each formation is an explicit pitch map with named slots such as LB, RB, CB1, CM2, CAM, LW, or ST2. The draft still enforces the broader position groups (GK / DF / MF / FW), while the final lineup screen lets you move or swap players only inside the same group so the chosen shape stays intact.

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
All 1,248 World Cup players (48 teams × 26 players) sit in one **pool shared by every member of the room**. The moment someone drafts a player, that player becomes unavailable to everyone else in the room too. Because drafting happens **simultaneously and independently** (not turn-based), it's entirely possible that right while you're deciding on a star player, someone else in the room grabs them — and the next time that same team is revealed to you, that player is gone. This is intentional: **decisiveness and speed** are part of the strategy.

### Skipping
If you don't like any of the pickable players on the revealed team, you can hit "Skip & show next team" without picking, and a new random team appears. There's no limit on how many times you can skip.

### Final squad
Every member drafts exactly **11 starting players** (no substitutes). This 11-man squad is exactly what plays for that user throughout the entire World Cup.

### Formation lock and final lineup moves
Your formation is chosen before the draft starts. Once the draft screen opens, the shape is locked: a 4-3-3 cannot become a 3-4-4, 4-4-2, or any other shape mid-draft. This keeps the draft fair and prevents players from escaping position-group commitments after seeing the random teams.

You can still rearrange the XI before locking tactical style: select a filled pitch slot, then choose another slot in the same position group to move or swap the players. For example, defenders can swap with defenders and midfielders with midfielders, but the formation's slot counts never change. This lets you polish the final lineup without changing the squad shape itself.

### Tactical style lock
Once the XI is complete, each drafter locks one tactical style: Defensive, Balanced, Gegenpress, Possession, or Counter Attack. The tournament starts only after every drafter has finished this lock step.
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
The outcome of every match (bot vs. bot, human vs. bot, or human vs. human) is decided by a statistical model:
- Each team's base Attack and Defense come from weighted player overalls. Advanced slots weigh more for Attack, deeper slots weigh more for Defense, and elite players use a stronger quality curve so 85-91 rated players matter more in goals, assists, saves and penalties.
- Chemistry then adjusts the team through correct position fit, balanced defense/midfield/attack structure, linkage, Game Changer leadership and out-of-position penalties.
- Tactical Style applies engine modifiers: Attack, Defense, Tempo, Risk, Press, Control, Transition, Set Pieces and Star Moment. Attack/Defense multiply the core ratings; Tempo/Risk/Transition alter shot and counter volume; Control/Press shape possession, pass accuracy and territory; Risk also raises foul/card volatility.
- Style matchups add small edges. Counter Attack can punish heavy pressure, Possession can slow chaotic games, Defensive can absorb risk, Gegenpress can create late pressure, and Balanced avoids large weaknesses.
- Human teams receive a 1.2x Attack and Defense boost only against AI opponents. Human vs human and AI vs AI matches are neutral.
- Based on the resulting expected goals, actual goals are sampled from a Poisson distribution, so better teams win more often but never automatically.
- In knockout rounds, a draw goes to extra time and then penalties; player quality, keeper quality, star moments and pressure influence the shootout edge.

### Predict Chance and pre-tournament projections
The lineup reveal predicts title chance from the same inputs the match engine uses: weighted player overall, chemistry, tactical style, Game Changer threat, formation fit and the relative strength of the full 48-team field. It also highlights likely goal focus, creator focus and pressure player using the same role/quality weights that live match events use.
Any member of the room can hit "Simulate Next Stage" to advance the game engine (e.g. the next matchday of the group stage, or an entire knockout round); results are shown live to everyone in the room at once.

---

## 6. Getting Eliminated = Becoming a Spectator

If the team you represent (whether in the group stage or the knockout stage) gets eliminated, you as a player are **not removed from the game** — your squad simply stops playing, and from that point on you follow the rest of the room's World Cup as a **spectator**, to see who the eventual champion turns out to be (another human player, or a bot).

---

## 7. Single Player Mode

In Single Player mode, you're the only human in the room, and bots run the other 47 countries. Every rule about drafting, formations, the World Cup, and match simulation described above applies exactly the same — you just don't wait for anyone else, and the World Cup begins the moment your own draft is complete.

Single Player also includes an experimental **Auto Draft** option. When enabled before starting, the engine reveals eligible teams, picks the strongest available XI for your locked formation, chooses the highest-rated captain when captains are enabled, locks a balanced tactical style if needed, and then starts the tournament automatically.

---

## 8. Current Scope: World Cup Only

Right now only "World Cup" mode is active (with the real 2026 World Cup teams and players). A "club league" mode is on the roadmap and will be added later.

---

## 9. About the Player Data (important)

The list of 48 teams matches the real, official field of nations qualified for the 2026 FIFA World Cup, and **every player in the game is a real member of that nation's actual 26-man 2026 World Cup squad** (1,248 real players total, sourced from Wikipedia's "2026 FIFA World Cup squads" article, itself compiled from FIFA's officially published squad lists).

What's *not* official:

- **Overall ratings come from the bundled player database**, tuned for gameplay and not from an official/licensed rating dataset.

Every single one of the 1,248 players in the game is a real 2026 World Cup squad member — no fictional or generated players exist anywhere in the dataset. A handful of teams have real squads slightly shallower in one position group than the most demanding formations call for (e.g. 3-2-4-1's 6 midfielders); rather than inventing a player to pad it out, the draft simply won't reveal that team to a drafter who still needs that position (there are 47 other teams to draw from), and a bot fielding that formation with that nation falls back to reusing its weakest already-selected player in the extra slot instead of fabricating one.

This is intentional: the goal of the game is an exciting draft-and-simulation experience built on real players, without claiming to be an officially licensed EA/FIFA ratings product. If you want, this data layer (`server/src/data/teams2026.json`, generated from `server/src/data/player-database.txt`) can be swapped out for a different or more precise ratings source.
