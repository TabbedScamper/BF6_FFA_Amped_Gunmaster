# FFA Gunmaster — Architecture & Contributor Guide

A free-for-all gun-game for BF6 Portal, built on the deluca-mike TypeScript scripting
template. This doc is the **map** of the codebase: read it once and you'll know where
everything lives and where to change things. Every file also has a detailed header comment
explaining the *why* behind its tricky bits — this guide is the *where* and *how it connects*.

- **Build:** `npm run build` → `bf6-portal-bundler` bundles `src/index.ts` (+ all imports)
  into `dist/bundle.ts` and merges every `strings.json` into `dist/bundle.strings.json`.
- **Deploy:** `npm run deploy` (build + upload). CI lives in `.github/workflows`.
- **Entry point:** `src/index.ts` — everything is wired up there.

---

## 1. The four big ideas (grok these first)

Almost every confusing thing in the code traces back to one of these four decisions.

1. **True FFA on a team engine, via "solo teams."** BF6 has no native FFA, so *every human
   sits on its own declared team* (2, 3, 4, …) and *every bot on its own undeclared team*
   (50+). Everyone is natively hostile → real red-diamonds/hit-markers, no friendly-fire
   stats. This is why `teams.ts` / `config.ts` talk about "16 declared capacity-4 teams" and
   why bots and humans use disjoint team-id ranges. (See `config.ts` top comment.)

2. **Bots run a per-tick sense → think → act brain.** There is no built-in FFA bot AI, so
   `src/bot-ai/` implements one: each tick a bot **senses** (enemies, roam points, flags),
   updates **memory** (TTL-based, so it "forgets"), and the **behavior selector** picks the
   highest-priority action (engage / chase / search / roam). Movement is `AIValidatedMoveTo`;
   aim/fire is `AISetTarget` + combat flags. The engine gives *no on-fired event*, so shots
   are detected by watching the ammo count drop.

3. **The match is a weapon ladder.** Kills promote you up a shuffled list of guns
   (`ladder.ts`); reaching the end (through the finale gadget tiers) wins. Powerups
   (`powerups.ts`) shove you up/down the ladder. "Amped" guns (`amped.ts`) are a cosmetic
   prestige tier — same damage, extra FX/sound/signature effect.

4. **The engine is quirky, and the comments say so.** Radio music is timing-sensitive,
   `SetObjectTransform` on spawners silently no-ops, `RayCast` hits the caster, music
   amplitude is globally-applied, etc. When a piece of code looks over-engineered, the header
   almost always explains which engine bug forced it. **Don't "simplify" those without
   reading the comment** — they're scar tissue from real in-game failures.

---

## 2. The match lifecycle (the flow)

This is the spine. Follow it in `index.ts` and you'll understand the whole mode.

```
OnGameModeStarted
  ├─ initMusic()        arm the radio station (silent until FIGHT)      music.ts
  ├─ init bots/roster/spawns/ladder/amped/hud …
  └─ …

OnPlayerJoined / team seating
  └─ seat humans onto their own solo team; bench overflow             teams.ts, bench.ts

Round start (OnGameModeStarted flow → deploy)
  ├─ SetSpawnMode(AutoSpawn) + DeployAllPlayers()
  └─ startIntro({...})                                                 intro.ts
        the cinematic countdown; at "FIGHT!" calls onFight()

onFight()  (the match goes LIVE)
  ├─ SetSpawnMode(Deploy)   → we own respawns from here
  ├─ musicOnFight()         start the global streak music              music.ts
  ├─ announceFight()        round-start VO                             music.ts
  ├─ startBotDirector()     begin ticking bot brains + backfilling     bots.ts
  └─ scheduleMapCard()      the MAP / MADE-BY credit card              map-card.ts

Every tick (while live)
  ├─ tickAllBotBrains()     sense→think→act per bot                    bot-ai/brain.ts
  ├─ checkAmpedFx(player)   ammo-delta shot detection → FX + sound     amped.ts
  └─ HUD refresh                                                       hud.ts

OnPlayerDied / OnPlayerDeployed
  ├─ markSpawned()          fresh-spawn target immunity window         bot-ai/spawn-protect.ts
  ├─ bestSpawnPos()         anti-spawn-kill marker pick + teleport     index.ts → spawns.ts
  ├─ ladder promote/demote + powerup drop                              ladder.ts, powerups.ts
  └─ streak music up/down                                              music.ts

Match end
  └─ musicOnMatchEnd() + result screen                                music.ts, result-ui.ts
```

---

## 3. Directory / file map

### Core / entry
| File | What it does |
|---|---|
| `index.ts` | **Entry point.** Subscribes every `Events.*`, owns the round lifecycle, the deploy/respawn loop, and wires all subsystems together. `bestSpawnPos()` (the spawn teleport) lives here. Start reading here. |
| `config.ts` | **The control panel.** Every tunable constant, each with a comment on what it does and safe ranges. Change gameplay feel here first. |
| `sdk-augment.d.ts` | Type stubs for SDK members the `bf6-portal-mod-types` package hasn't caught up on yet. |

### Teams / seating
| File | What it does |
|---|---|
| `teams.ts` | Puts every human on its own solo team (the "true FFA" scheme). |
| `bench.ts` | Over-capacity players → a freecam "bench," promoted into a free slot when one opens. |
| `roster.ts` | Persistent bot identities (name, team) that survive respawns — a bot is an *identity* re-adopted onto a fresh engine body each life. |

### Bot AI (`src/bot-ai/`)
| File | What it does |
|---|---|
| `brain.ts` | The per-bot **BotBrain**: runs the sensors, holds the memory, ticks the behavior selector. `getBotBrain()` / `tickAllBotBrains()`. The **stuck-watchdog** (un-jams bots) is here. |
| `memory.ts` | `BotMemory` — a TTL key/value store so bots "forget" (last-known enemy pos, roam point, in-battle, etc.). |
| `sensors.ts` | Reads the world into memory: `senseEnemy` (probabilistic detection + LOS gate), `senseRoamPosition`, arrival, flag situation. |
| `behaviors.ts` | **Weight-based behavior selector.** Maps memory keys → behaviors (battlefield / search / roam / reposition / flag…) and executes the highest-weight one. Change bot *priorities* via `DEFAULT_WEIGHTS`. |
| `los.ts` | Line-of-sight: one round-robin `RayCast` per tick per bot to its closest enemy → `canSeeEnemy()`. Stops wall-hacking. |
| `spawn-protect.ts` | Fresh-spawn **target immunity** — bots won't lock onto a player for a few seconds after they deploy. |
| `ai-flags.ts` | Caches `AISetTarget` / combat-flag native calls (change-detect + periodic re-assert) so we don't spam them every tick. |
| `ffa-deps.ts` | Shims that adapt the original 2-team Deadlock AI to FFA (`allAliveEnemies`, telemetry). |
| `index.ts` | Barrel re-exports for the bot-ai package. |

### Bot management
| File | What it does |
|---|---|
| `bots.ts` | The **bot director**: spawns/backfills bots one-per-tick (never a burst — engine culls same-frame spawns), and drives the brain tick loop. |
| `spawns.ts` | **Spawn selection.** Reads the physical spawn markers (ObjId 101-135), scores them (distance to players, recent-use cooldown, danger, hard human-safe floor) and returns the best. `pickSpawn()`. |

### Progression
| File | What it does |
|---|---|
| `ladder.ts` | The **weapon ladder**: the shuffled gun rotation, tier tracking, promote/demote, the finale gadget tiers, and applying a tier's weapon to a player. |
| `powerups.ts` | Promotion/demotion pickups dropped at death locations (hot-potato demotion, promo climb). |
| `amped.ts` | Cosmetic "amped" weapon tier: per-weapon impact FX, the amped shot sound (ammo-delta driven), signature damage (explosive/raygun/fire), and the sniper chain-freeze. |

### UI / audio / presentation
| File | What it does |
|---|---|
| `hud.ts` | The in-match HUD (weapon card, leaderboard, streak feed…). Persistent widgets, swap-only updates. The biggest file — treat it as its own module. |
| `game-ui.ts` | **Reusable UI helper** — thin wrappers over `AddUIContainer` / `AddUIText` / images. Use this, not the raw natives. |
| `intro.ts` | The cinematic GET READY / FIGHT countdown, choreographed to a game sound. Calls `onFight()` at the end. |
| `map-card.ts` + `map-registry.ts` | The match-start **MAP / MADE BY** credit card and the runtime map-detection (spawn-marker centroid → which map). |
| `result-ui.ts` | The end-of-match victory/defeat leaderboard. |
| `announce.ts` | Kill-feed style lobby announcements (first blood, killstreak words). |
| `music.ts` | The global streak radio + voice-over beats (round start, time warnings, finale). |

### Dev-only
| File | What it does |
|---|---|
| `debug-tool/index.ts` | An in-game F-key debug menu (spawn test props, etc.). |
| `test-log.ts` | `[FFATEST]` instrumentation that can stream results to an admin's PortalLog (solo-team verification). Off for release. |

---

## 4. "I want to change X" — where to go

| Goal | Where |
|---|---|
| Tune *anything* numeric (respawn time, bot count, spawn radii, streak music, powerup rates, amped damage) | **`config.ts`** — start here always |
| Change the gun rotation / how many tiers / finale gadgets | `ladder.ts` (+ `LADDER_*` in config) |
| Make bots more/less aggressive, change what they prioritize | `bot-ai/behaviors.ts` `DEFAULT_WEIGHTS`, and `bot-ai/sensors.ts` `SENSOR_CONFIG` |
| Change spawn placement / anti-spawn-kill behavior | `spawns.ts` (`pickSpawn`) + `SPAWN_*` in config |
| Add a map to the credit card | `map-registry.ts` (add a signature row) + `strings.json` (`ffa.mapcard.*`) |
| Add/adjust a per-weapon amped FX | `amped.ts` `WEAPON_FX` map |
| Change HUD layout/content | `hud.ts` |
| Change the intro timing/look | `intro.ts` |
| Add on-screen text | add a key to `src/strings.json` (nested `ffa.*`), then `mod.Message(SK().ffa.your.key)` |

---

## 5. Reusing pieces in your own script

These modules are the most self-contained and easiest to lift:

- **`game-ui.ts`** — drop-in UI helper (`GameUI.container/text/vec/rgb`), no dependencies on the rest.
- **`bot-ai/`** — the whole sense-think-act brain is fairly portable; the FFA-specific glue is
  isolated in `ffa-deps.ts` (swap that for your team model).
- **`map-registry.ts`** — runtime map detection via spawn-marker centroid (works because
  `mod.IsCurrentMap` is broken and `GetHQ` reads ~0,0,0 — see its header).
- **The radio recipe** in `music.ts` (`armStreakStation` / `doGlobalPlay`) is a known-working
  BF6 Portal music sequence worth copying verbatim.

---

## 6. Engine gotchas baked into this code (don't "fix" these)

These are real, in-game-verified quirks. The code works *around* them on purpose:

- **No on-fired event** → shots detected by ammo-count delta (`amped.ts`).
- **`RayCast` hits the caster** → LOS ray is started offset in front (`los.ts` `EYE_FORWARD`);
  too large an offset punches through a hugged wall.
- **`SetObjectTransform` on spawners silently no-ops** → bots materialize at the engine
  spawner then get `Teleport`'d to the picked marker (`index.ts` OnPlayerDeployed).
- **`GetObjectPosition` returns ~0,0,0 on non-physical objects** → spawn markers must be
  physical props; map detection uses those, not the HQ.
- **Music amplitude `SetMusicParam` is applied globally and is timing-sensitive** → writes are
  de-duped + debounced so they don't collide with a track switch (`music.ts`).
- **Bots multi-spawned in one frame get culled** → spawn one-per-tick (`bots.ts`).
- **`mod.IsCurrentMap` always returns Abbasid** → don't use it; see `map-registry.ts`.

---

*Every file's top-of-file comment goes deeper on its own tricky parts. When something looks
weird, read the header before changing it — it almost certainly explains why.*
