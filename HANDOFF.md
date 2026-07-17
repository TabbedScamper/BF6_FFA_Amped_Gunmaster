# FFA Amped Gunmaster — Session Handoff & Findings

**Repo:** https://github.com/TabbedScamper/BF6_FFA_Amped_Gunmaster (origin, `main`)
**Project:** `User_Created/projects/FFA-Gunmaster` · **SDK:** 1.3.3.0 · **Template:** v1.7.0
**Companion docs:** `DESIGN.md` (the design/port plan). This file = what got built + what we learned + what's left.

> Everything below is committed and pushed as **TabbedScamper** (no AI attribution). `tsc --noEmit`
> and `npm run build` are clean on every commit.

---

## 1. What this mode is
A **free-for-all gun game**. Everyone climbs the SAME shuffled ladder of weapon "cards" by getting
kills; **first to finish the ladder wins** (or the leader when a time limit hits). Built by combining
your **Undead Gunmaster** (ladder, promo/demo powerups, amped FX/sounds) with **Deadlock** (cards,
bot AI, UI, audio system, bot roster). 31 active players + bot backfill.

---

## 2. Top-of-script config knobs (`src/config.ts`)
| Knob | Default | What it does |
|---|---|---|
| `LADDER_GUN_TIERS` | 13 | **How many guns** the match runs through (before 2 gadget finale tiers) |
| `LADDER_ROTATION` | `'shuffled'` | Progression type: `'shuffled'` / `'classic'` (pistols→shotguns) / `'amped'` (FX guns) / `'base'` (no amped) |
| `KILLS_PER_TIER` | 2 | Kills to advance one gun |
| `MIN_PLAYERS` | 12 | Bot backfill floor (bots fill to this; humans replace bots) |
| `MAX_PLAYERS` | 31 | Max ACTIVE (= number of solo teams). Extras are benched. |
| `SFX_MASTER_VOLUME` | 0.6 | One knob for ALL sound effects (VO is engine-fixed, so lowering this makes VO stand out) |
| `SPAWN_PROTECTION_MS` | 1500 | Invuln window on respawn |
| `DEBUG_MODE` | true | Solo testing (full bot lobby + PortalLog telemetry). **Set false for release.** |
| Amped block | — | `AMPED_EXPLOSION_*` (Camaro), `AMPED_RAYGUN_*` (M44), `AMPED_FIRE_*` (shotguns), `CHAIN_FREEZE_*` (snipers) |
| Powerup block | — | `POWERUP_DROP_CHANCE`, `POWERUP_SPAWN_COOLDOWN_MS`, `POWERUP_DROP_TABLE` (weighted promo/demo ×1/2/3) |

---

## 3. Modules (`src/`, ~3,000 lines)
| File | Role |
|---|---|
| `index.ts` | Entry point — lifecycle, kill/death/join/leave, win + time-limit, wiring |
| `config.ts` | All tunables (see above) |
| `teams.ts` | Solo-slot allocator + landing-team split |
| `roster.ts` | Persistent bot identities (name/stats/ladder survive respawns) + **Deadlock bot names** |
| `ladder.ts` | The shuffled gun ladder (base + amped cards, gadget finale) + rotation modes |
| `amped.ts` | Amped weapon FX + sound + signature AOE damage + player-safe chain-freeze |
| `powerups.ts` | Promotion/demotion powerups — **drop at death**, weighted, spinning, blue/red |
| `bots.ts` | Lightweight raycast-free bot director |
| `spawns.ts` | Anti-spawn-kill spawn selection (distance + rolling line-of-sight danger) |
| `hud.ts` | Per-player gun/tier bar + promo/demo flash banners |
| `announce.ts` | Lobby banners: first blood, killstreaks |
| `bench.ts` | Spectator bench for over-capacity + spawn-on-friendly safety net |
| `result-ui.ts` | Custom VICTORY/DEFEAT leaderboard end screen |
| `sdk-augment.d.ts` | Types the npm package lags on (5 new weapons) |

---

## 4. The team scheme (portal page setup)
Portal site caps teams at **32**. Final layout:
- **Team 1 = size 4** — the GATE (landing dock + spectator bench).
- **Teams 2–32 = size 1** — 31 SOLO slots = the 31 active players.
- Capacity 4 + 31 = 35 (31 active + up to 4 benched). **Lobby set to 31** (bench dormant unless raised).

Every active player is on their own solo team → clean FFA, **no friendly fire needed**.
A joiner lands on team 1 → gets `SetTeam`'d onto a free solo slot (pre-deploy = the safe window).
Over-capacity joiners are benched (`EnablePlayerDeploy(false)` + spectate-anyone) and promoted into a
freed solo slot when someone leaves. A benched player who sneaks a spawn-on-friendly is instantly
`UndeployPlayer`'d (`enforceBench`).

**Portal page checklist:** 32 teams (1×4, 2–32×1) · lobby max 31 · **set a TIME LIMIT** (arms the
leader-wins fallback) · Friendly Fire OFF · Scoreboard is set to CustomFFA by the script.

---

## 5. Feature summary
- **Ladder:** shuffled base + amped cards, 2 kills/tier, promote on kill, **gadget finale** (breach-charge
  launcher → throwing knife). `ForceSwitchInventory` makes gadget/knife tiers equip on respawn.
- **Amped weapons** (cosmetic prestige, no damage *boost*, but the signature ones keep their real AOE
  since the FX object is only visual): **CAMARO** (explosive M45A1), **RAYGUN** (M44), fire-DOT shotguns,
  **chain-frost** snipers (fair slow + frost, works on players). Amped hit-sound + per-shot FX via a
  per-tick ammo-delta detector; raycasts throttled + routed through the shared Raycast module.
- **Powerups** — **drop at death locations**, weighted rarity: **promotion** (climb N now), **demotion
  HOT POTATO** (your next kill dumps −N on the victim; dying first backfires −N onto you). Spinning
  number prop + blue(promo)/red(demo) sparks. Carrier is `SpotTarget`-highlighted so victims see who
  marked them. Bots pick them up too; drops happen on bot deaths too.
- **Bots** — each on its own solo team (native AI targets everyone); a lightweight director keeps them
  pushing/roaming (no per-bot raycasts). Persistent identities with the **Deadlock bot names**.
- **Anti-spawn-kill** — score = distance to nearest enemy − line-of-sight danger − recently-used; LOS
  danger is a rolling 1-cast/200ms sampler. Plus 1.5s spawn protection.
- **HUD** — bottom bar `GUN X/N · CARDNAME`; center flashes PROMOTED / DEMOTED / etc.
- **Announcements** — global FIRST BLOOD + killstreak banners (SPREE/RAMPAGE/UNSTOPPABLE/GODLIKE) with
  EOR rank-up SFX.
- **End screen** — custom VICTORY/DEFEAT + leaderboard (rank · name · gun · K · D), GlobalEOM VO.
- **Match end** — first to finish the ladder, OR the leader (highest gun, tie-break kills) at the time limit.

---

## 6. SDK / engine FINDINGS (reusable across all your projects)
The valuable reference — quirks and verified facts we relied on:

- **`GetObjectPosition` returns ~(0,0,0)** for non-physical objects (AI Spawners, SpawnPoints,
  InteractPoints, WorldIcons). **Consensus-unfixed.** → Map markers must be **physical spatial props**
  with unique ObjIds; read *their* positions.
- **Raycasts:** async, no ray-id, **FIFO-matched** via `OnRayCastHit`/`OnRayCastMissed`. Pattern =
  per-player attribution + shared FIFO queue + cap in-flight + distance-scale. ~1 raycast/tick soft
  limit; `OngoingPlayer` is the main cost center. → Route ALL casts through the `bf6-portal-utils`
  Raycast module (one queue). Hand-rolled raw casts fight each other.
- **`MoveObject` is flaky** (won't move every object); **`SetObjectTransform` / the `...OverTime`
  functions "generally work."** The **OverTime functions offload continuous motion to the engine**
  ("set it and forget it") — the fix for the `SetObjectTransform` fast-loop buffer-drift bug.
  (Source: Discord "Library for Multiple Object Operations" thread.) → We spin powerups with
  `MoveObjectOverTime(obj, 0, 2π-yaw, 2.5s, loop=true)`.
- **`mod.SetVFXColor(vfx, CreateVector(r,g,b))`** tints ANY VFX (how we get blue/red powerups from one
  base FX; the SDK has no blue marker FX in `RuntimeSpawn_Common`).
- **`mod.Message(...)` accepts RAW strings & numbers** (and a `Player` → renders their name), and takes
  **multiple placeholder args**. So dynamic UI text needs NO per-string keys.
- **`PlayVO` has NO volume parameter** (engine-fixed loudness). Team-relative VO lines are **silent
  unless scoped to a player** — play a fresh `SFX_VOModule_OneShot2D` per call, to each player.
- **Chain-freeze on players:** the old AI-only immobilize (`AIEnableTargeting/Shooting`,
  `AISetMoveSpeed`, `AIMoveToBehavior`) **silently no-ops on humans**. Use `SetSoldierEffect(p,
  SoldierEffects.FreezeStatusEffect, true)` + `SetPlayerMovementSpeedMultiplier(p, 0.5)` instead.
- **Amped FX are visual only** — a spawned FX object does no damage; the explosive/raygun/fire effects
  need their radius/DOT `DealDamage` restored to actually do anything (distinct from the damage *boost*
  we removed). `DealDamage(target, dmg, attacker)` credits the shooter (so kills promote).
- **No on-fired event** in SDK 1.3.3.0 → detect shots via a per-tick ammo-delta (`GetInventoryAmmo`
  decrease) in `OngoingPlayer`.
- **FFA on a team engine:** a size-1 team-1 blocks party joins (the community 16-team-FFA bug). Fix =
  a size-4 gate team + solo teams. Portal site caps teams at **32**. `EnablePlayerDeploy(false)` +
  `SetSpectatingFiltersForPlayer(All,false,false)` = benched spectator; `DisablePlayerJoin` is
  **one-way** (no re-enable) so rely on team capacity to cap the lobby.
- **`ForceSwitchInventory(player, slot)`** fixes the "respawn with only a gadget = empty hands until you
  cycle" bug (force-equip the active slot on deploy).
- **`bf6-portal-mod-types` (npm) lags the SDK** — was missing 5 weapons (VCR-2, CZ3A1, M121 A2, GRT CPS,
  VZ-61). Fixed with an ambient `.d.ts` augmentation (safe: the bundler emits weapon refs by NAME, so
  the .d.ts numeric values never ship). **Affects Deadlock too.**
- **`SetTeam` only reliable while a player is UNDEPLOYED** (match start / pre-deploy / on death).

---

## 7. What's LEFT (not code)
1. **Map pass:** place **32 physical spawn markers** (ObjIds **101–132**) on the arena — physical props,
   sunk slightly under terrain (0,0,0 rule). *Powerup markers are NOT needed* (powerups drop at deaths).
2. **Portal page settings** (section 4 checklist): 32 teams, lobby 31, time limit, FF off.
3. **In-game verification** — the only unverified assumptions:
   - 32 teams + the lobby boot cleanly; match-start split → deploy works; AutoSpawn keeps respawning.
   - Markers return real positions (physical-prop check).
   - Scoreboard sorts highest-gun-on-top (may need a one-line `SetScoreboardSorting` tweak).
   - Amped FX + damage, powerup drops + hot-potato + carrier spotting, bench (only if lobby raised >31).
4. **Optional later:** the 5 shelved-weapons' amped configs; spoken VO callouts; clean unused `ffa.hud`
   strings.

---

## 8. Related projects & sources
- **TDM** (`projects/TDM`) — your original team-deathmatch export, imported this session; compiles clean
  on SDK 1.3.3.0. Source of the killstreak/first-blood notification UI. Needs a modern-components upgrade
  pass eventually.
- **VIP-Escort** (`projects/VIP-Escort`) — source of the leaderboard-row layout used in `result-ui.ts`.
- **Undead Gunmaster** (`_archive/old-sdk-extracts/1.2.2.0/My Projects/BF6-Undead-Gunmaster`) — ladder,
  powerup weights, `UPGRADED_WEAPON_FX`, amped sounds. **Backport to it later:** the chain-freeze
  AI-only fix + the respawn-gadget `ForceSwitchInventory` fix (both bugs originated there).
- **Deadlock** (`projects/bf6-Deadlock`) — cards/attachments, bot AI, UI components, audio system, bot names.

---

## 9. Build / deploy
```bash
npm install
npm run build      # -> dist/bundle.ts + dist/bundle.strings.json  (upload both to the experience)
```
`DEBUG_MODE = true` (in config.ts) = solo test with a full bot lobby + telemetry. Set `false` for release.
