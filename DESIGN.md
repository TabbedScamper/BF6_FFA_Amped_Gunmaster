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

## Amped weapons (author's clarification, 2026-07-17)
Amped = **cosmetic prestige tier, NO damage advantage** (the old Undead amped guns gave bonus
damage/instakills — stripped for PvP fairness). Keep: the custom hit-FX, the amped hit-sounds,
and the attachments. 20 base guns have amped versions (M45A1, P18, M44, GGH-22, PW5A3, KV9, SGX,
M4A1, AK-205, SOR-300SC, M433, AK4D, L110, M60, M2010, SV-98, Mini Scout, M1014, M87A1, DB-12).
Amped versions are **shuffled throughout** the ladder (not grouped at the top).

**Amped FX firing:** SDK 1.3.3.0 still has NO on-fired event → keep the old per-tick ammo-delta
detector in `OngoingPlayer` (detect mag decrease → raycast per shot → spawn FX at hit point).
Strip from each config: `explosionDamage`, `dotDamage`, `doubleDamageFirstHit`, and the
`rayKill`/`hitPointKill` instant-`mod.Kill` calls. Keep the FX spawns + `playAmpedHitSound`.

**CHAIN-FREEZE — solved for players.** Old code used AI-only immobilize (`AIEnableTargeting/
Shooting`, `AISetMoveSpeed`, `AIMoveToBehavior`) — silently no-ops on humans. Rebuild with the
player-facing pair: `SetSoldierEffect(p, SoldierEffects.FreezeStatusEffect, true)` (frost visual,
works on humans+bots) + `SetPlayerMovementSpeedMultiplier(p, 0.5)` (a fair ~50% slow, NOT a
stunlock), chained to nearby enemies for ~2s, then released (effect off + multiplier 1.0). No
damage (per no-damage rule).

## Raycast performance (corpus-backed — user asked, confirmed)
RayCast is **async, no ray id, FIFO-matched** via `OnRayCastHit`/`OnRayCastMissed`. Community
pattern: **per-player attribution + shared FIFO queue + cap in-flight + distance-scale frequency**;
`OngoingPlayer` is the main cost center — throttle per-player raycasts. ~1 raycast/tick is the
community soft limit; no official tick budget. Frostbite dump shows `MaxNumberOfAsyncRaycastsPerFrame`
= 50 (engine crowd-placement cap, not necessarily Portal). ⇒ **Everything raycast goes through the
bf6-portal-utils `Raycast` module** (one native handler, per-player queue, onHit/onMiss). Spawn LOS
sampler already refactored onto it (slice 2); amped-FX per-shot casts will use the same module.

## Ladder structure (settled 2026-07-17)
Shuffled subset: (base + amped, shuffled throughout) sliced to `LADDER_GUN_TIERS` (13), then the
**gadget finale** appended (always last, hardest): breach-charge launcher → throwing knife. The
`ForceSwitchInventory` fix makes gadget/knife tiers actually equip on (re)spawn — this also fixes
the standalone bug the author hit (respawn with only a gadget = empty hands until manual cycle).

## Build order (each step gated: tsc + build clean)
1. ✅ **Skeleton** (slice 1): 28-team split, bot backfill w/ persistent identities, CustomFFA
   scoreboard, win condition. Anti-spawn-kill spawn selection (distance + rolling LOS danger).
2. ✅ **Ladder core** (slice 2): shuffled base+amped ladder + gadget finale; ForceSwitchInventory
   respawn-gadget fix. Repo: github.com/TabbedScamper/BF6_FFA_Amped_Gunmaster.
3. ✅ **Amped FX** (slice 3): src/amped.ts — damage-stripped UPGRADED_WEAPON_FX, amped hit sound,
   player-safe chain-freeze (SetSoldierEffect + MovementSpeedMultiplier). Per-tick OngoingPlayer
   detector; FX raycasts via shared Raycast module w/ cooldown. + mod-types augmentation (5 weapons).
4. ✅ **Bots** (slice 4): src/bots.ts — lightweight raycast-free director (native AI targets all
   since each bot is on its own solo team; director keeps them pushing/roaming). NOT the heavy
   Deadlock brain (raycast budget).
5. ✅ **Powerups** (slice 5): src/powerups.ts — promo (climb N) + demo HOT POTATO (kill dumps −N on
   victim; dying backfires −N on self). Physical markers 201-212.
6. ✅ **HUD** (slice 6): src/hud.ts — per-player gun/tier bar + promo/demo flash banners (raw-string
   mod.Message, no per-card keys).
7. ✅ **Announcements + polish** (slice 7): src/announce.ts — lobby FIRST BLOOD + killstreak banners
   (upgraded from the TDM export) with EOR rank-up SFX; bots use powerups; demotion carrier is
   SpotTarget-highlighted so victims see who marked them.

**Backport to Undead Gunmaster** (its overhaul pass): chain-freeze was AI-only (unusable on
players → fixed with SetSoldierEffect + MovementSpeedMultiplier); respawn-with-gadget = empty
hands (→ fixed with ForceSwitchInventory). TDM export imported at `projects/TDM` (compiles clean;
source of the announcement UI).

## Remaining before ship
- **Map pass**: place 32 spawn markers (ObjIds 101-132) + 12 powerup markers (201-212), all
  PHYSICAL props (0,0,0 bug). Portal page: 28 teams, team 1 size 4, teams 2-28 size 1.
- **In-game test** (DEBUG_MODE=true = solo bot lobby + telemetry): verify the checklist above.
- Optional: add the 5 shelved weapons' amped FX configs; VO callouts (per-player scoped); card
  names as localized keys if non-English support is ever wanted.

## Known-good lessons already baked in (from this month's work)
Removed-API compat (EnableSpatialObject/EnableSFX/GetScreenEffect...), async-handler rule,
per-receiver audio, spectate filters, `Deploy`-mode transitions avoided, attachment family
validation (all card attachments pre-verified), `.gitignore` PortalLog, TabbedScamper identity.
