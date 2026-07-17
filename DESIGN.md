# FFA Gunmaster — Design & Port Plan (2026-07-17)

**The mode:** free-for-all gun game. Everyone climbs a shuffled ladder of weapon cards by getting
kills; first to finish the ladder wins. Promotion/demotion powerups spice the race; the top tiers
are the **amped** guns with their custom raycast FX + sounds. Small arena (8–12, bots backfill),
scalable to 32 via config.

Built by combining two of our codebases (upgrade both as we port):
- **BF6-Undead-Gunmaster** (source: `_archive/old-sdk-extracts/1.2.2.0/My Projects/BF6-Undead-Gunmaster`)
- **bf6-Deadlock** (live: `projects/bf6-Deadlock`)

## What ports from where

| System | Source | Port notes |
|---|---|---|
| **Weapon ladder + progression** | Gunmaster `systems/gunmaster/{game-mode,weapons}.ts` | Keep shuffle + kills-per-tier; swap zombie-kill triggers for player-kill events. `initGunMasterPlayer`, `giveGunMasterWeapon`, `promotePlayer`, `onGunMasterKill` are the spine. |
| **Ladder ENTRIES = named cards** | Deadlock `src/gunfight/loadout.ts` (45 validated cards) | Tiers become THE LONG GOODBYE / OFFICE MEMO / etc. with their verified attachments; amped tiers at the top; pistols (HIGH NOON etc.) as the finale tiers (classic gun-game). |
| **Amped weapon FX + sounds** | Gunmaster `UPGRADED_WEAPON_FX` map + `initAmpedHitSound`/`playAmpedHitSound` + raycast tracer flow | The crown jewels: explosive .45, mortar-beacon M44, Rorsch ray-kill, fire-DOT shotguns, chain-freeze PSR. Raycast = 1/tick (Discord) — the existing cooldown map respects this. |
| **Powerups (ONLY promo/demo)** | Gunmaster `systems/powerups.ts` | Keep Single/Double/Triple Promotion + Demotion (FiringRange number props). STRIP: Nuke, Killshot, perks, BottomlessClip. Spawn: chance-drop at kill locations + occasional map spawns. Demotion = trap pickup (risk/reward). |
| **All the SFX** | Gunmaster `SFX_CONFIG` + Deadlock audio pass | Route EVERYTHING through Deadlock's `SFX_MASTER_VOLUME`/`sfxVol()` pattern from day one. Per-receiver sounds only (no N× stacking — lesson learned). |
| **Bot backfill + brains** | Deadlock `src/bot-ai/` | Sense-think-act brain; retarget "closest ENEMY" → "closest PLAYER (anyone)". Bots climb the ladder too (their kills promote them). |
| **Spawning** | `bf6-portal-utils` `FFASpawnPoints` (+ `FFADropIns` option) | The community-proven FFA spawner: safe-distance + least-recently-used. Spatial spawn points from the arena map. |
| **UI** | Deadlock `gunfight/ui/` + Gunmaster `ui/gunmaster-ui.ts` | Ladder-progress HUD (tier X/N + current card name), kill feed, leader callouts, round results. Rebuild on Deadlock's polished components. |
| **Round/lobby flow** | Deadlock `countdown-ui` + spectator fixes | Countdown freeze → play → winner screen. Port the spectate-filter + Deploy-transition lessons wholesale. |

## FFA mechanics on a team engine — THE 28-TEAM SCHEME (author's design, 2026-07-17)
The community's 16-teams-of-1 FFA blocked human joins because NO team had room for a joining
party. Fix: **one landing-zone team with room, everyone else on solo teams.**

- **Portal page setup:** 28 teams. **Team 1 = size 4** (the landing zone — parties can seat).
  **Teams 2–28 = size 1** (27 solo slots). 4 + 27 = 31 concurrent + rotation headroom; supports
  the 32-actual-player goal. ⚠ VERIFY in-game: 28 teams behave (community proved 16).
- **Match start: SPLIT TEAM 1.** Everyone the engine seated on team 1 is `SetTeam`'d onto their
  own empty solo team BEFORE first deploy (players are undeployed at mode start — the one safe
  `SetTeam` window per the Deadlock team-sorting findings). Team 1 then stays open as the
  landing zone for later joiners.
- **Mid-match joiners:** land on team 1 (it has room) → script immediately assigns a free solo
  slot (undeployed → SetTeam → deploy via FFASpawnPoints). If the server is at the bot-backfill
  floor, a bot is despawned to free its slot.
- **Bots = 12-player floor.** `MIN_PLAYERS = 12`: bots fill empty solo slots so the match never
  feels dead; each human join replaces one bot. Every bot sits on its OWN solo team → cross-team
  hostile to everyone → the Deadlock bot brain works UNMODIFIED (no friendly-fire dependency,
  which only matters for the brief time players share team 1).
- **Persistent bot identities (ported from Deadlock roster):** a bot keeps its name, scoreboard
  row, kills AND ladder position across respawns — extended with `ladderIndex` so bots visibly
  progress through guns like players do.
- **Scoreboard:** `mod.SetScoreboardType(ScoreboardType.CustomFFA)` (script-side — confirmed in
  SDK) + custom columns (Gun #, Kills, Deaths); sorted by ladder position.
- **Kill attribution:** OnPlayerEarnedKill + Deadlock's damage-contributor tracking (already fixed
  for round carry-over).

## Maps & spawn system (author's design)
Arenas = the Deadlock maps, with **32 spawn markers** placed per map. ⚠ **Map-authoring rule
(0,0,0 bug, consensus-confirmed UNFIXED):** `GetObjectPosition` returns ~(0,0,0) for non-physical
objects (AI Spawners, SpawnPoints, InteractPoints, WorldIcons...). The markers must be **tiny
PHYSICAL props (spatial objects) with unique ObjIds 101–132**, sunk slightly under the terrain.
Script reads marker positions (works for physical objects) and teleports/places at them.

**Anti-spawn-kill selection** (`src/spawns.ts`): score = distance-to-nearest-enemy (capped)
− heavy penalty per enemy within 15 m − **LOS danger** − recently-used penalty.
LOS danger = rolling cache: one raycast per 200 ms round-robins the markers, casting
spawn→nearest player's chest (raycast budget is ~1/tick engine-wide, so NO burst checks at
spawn time). Clear line = a sniper lane exists → danger up; blocked = decay. Catches the
cross-map sniper case the plain distance check misses.

## Config (top of script, Deadlock-style)
`MAX_PLAYERS` (default 12, cap 32) · `BOT_BACKFILL` target · `KILLS_PER_TIER` (default 2) ·
`LADDER_LENGTH` (default 15 tiers: 10 cards → 3 amped → pistol → final) · `SFX_MASTER_VOLUME` ·
`DEBUG_MODE` (solo bot-lobby + telemetry).

## Build order (each step gated: tsc + build clean)
1. **Skeleton**: config, FFA spawn wiring (FFASpawnPoints), per-player score state, win condition. ✅ scaffold done
2. **Ladder core**: port gunmaster progression + Deadlock cards as tiers; kill → promote; HUD counter.
3. **Bots**: Deadlock brain + anyone-targeting + ladder participation.
4. **Amped tiers**: port UPGRADED_WEAPON_FX + amped sounds (raycast tracers, 1/tick budget).
5. **Powerups**: promo/demo drops + pickup FX/SFX.
6. **Polish**: UI suite, VO (per-player scoping!), spectate/transition fixes, audio leveling.
7. **Meanwhile**: notes on every Gunmaster bug found → feeds the eventual Undead-Gunmaster overhaul.

## Known-good lessons already baked in (from this month's work)
Removed-API compat (EnableSpatialObject/EnableSFX/GetScreenEffect...), async-handler rule,
per-receiver audio, spectate filters, `Deploy`-mode transitions avoided, attachment family
validation (all card attachments pre-verified), `.gitignore` PortalLog, TabbedScamper identity.
