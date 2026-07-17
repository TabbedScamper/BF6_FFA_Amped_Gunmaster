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

## FFA mechanics on a team engine (the hard part)
- **Scoreboard:** `Modifiers → Gameplay → ScoreboardType = Default FFA` (portal page setting) + custom columns.
- **Teams:** community-verified pitfalls — 16-teams-of-1 breaks joining. Plan A: everyone on
  team 1 + **friendly fire ON** (portal modifier), per-player scoring in script. Plan B (if bots
  won't attack teammates): humans team 1, bots team 2, FF ON both. ⚠ VERIFY in-game which lets
  Deadlock's bot brain (AISetTarget cross/same team) engage everyone. The `debugSimulateTeamSorting`
  harness pattern from Deadlock applies.
- **Kill attribution:** OnPlayerEarnedKill + Deadlock's damage-contributor tracking (already fixed
  for round carry-over).

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
