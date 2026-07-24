# FFA-Gunmaster offline sim (modsim harness)

Runs the **real built bundle** (`dist/bundle.ts`) against the SDK's offline simulator
(`PortalSDK\unsupported\modsim`) on Node — no game required. Dev tooling only; never shipped.

## Usage

```
npm run build              # make sure dist/bundle.ts is current
node sim/harness.cjs                 # all scenarios
node sim/harness.cjs spawns ladder   # selected scenarios
node sim/harness.cjs --force         # recompile modsim+bundle even if fresh
node sim/harness.cjs -v              # stream captured console output live
```

Auto-compiles modsim + the bundle to CommonJS in `sim/build/` with the project's tsc
(`--noCheck`), then boots: `globalThis.mod` = patched modsim → `SetStrings(bundle.strings.json)`
→ `require(bundle)` → `LoadLevel(bundle, Hospital_Gunmaster.spatial.json)` → scenarios.

## Scenarios

| name     | verifies |
|----------|----------|
| boot     | 2 humans join+deploy, 32 spawn markers init, intro runs+ends, HUD shell built |
| spawns   | death→respawn teleports to a real marker, **facing = arena centroid** (yaw convention `atan2(dx,dz)` verified against modsim's own rotation math) |
| ladder   | 2 kills/tier promotion, knife tier = 1 kill |
| demotion | floor = peak−4, clamps at 0, `demotionLoss` preview |
| notify   | black death overlay + quote + attribution appear, then clean up after respawn |
| bots     | backfill pump spawns AI (1/tick, P18-safe), brains register + tick without throwing |
| winner   | last-tier kill → end-of-round results UI (asserted by widget-count delta — utils widgets are anonymous) |
| soak     | leak detection: active timer count + UI widget count stay flat over 60 sim-seconds |

## What the shim patches (`compat.cjs`)

- modsim's `AddUIText/Container/Button/Image` **return nothing** → wrapped to return the
  created widget. Full-arity Text(15/17) and Container(10/12) are built directly (modsim's
  `argsMatch` dispatcher rejects some valid shapes).
- `AddUIWeaponImage`/`AddUIGadgetImage` don't exist → minimal widget stubs.
- `GetSoldierState` **throws** on unimplemented states (e.g. `IsFiring`) → safe wrap with defaults.
- `Teleport` drops the facing arg → wrap records `{pos, facing}` into `shim.teleports`.
- `RayCast` is a stub → wired to the bundle's exported `OnRayCastHit(player, point, normal)` /
  `OnRayCastMissed(player)` (mode `hit`|`miss`|`drop`; `hit` = LOS blocked).
- `Message(playerObject)` → renders the player name.
- 30+ missing functions (AIEnable*, SetRedeployTime, DealDamage, DeployAllPlayers, ...) →
  real impls where behavior matters, counted no-ops otherwise (report lists which fired).
- Partial/missing enums (`Weapons`, `WeaponAttachments`, `AiInput`, ...) → proxies that fall
  back to unique `"Enum.Member"` strings (===-safe, Map-key-safe).
- The `mod` global is a **Proxy over modsim's exports, not a copy** — `export let stringkeys`
  is reassigned by `SetStrings` and a copy would go stale.

## Sim vs game differences (don't chase these as bugs)

- **Combat area / OOB is NOT simulated** (volumes stored but unused; RayCast has no geometry).
- modsim's `KillPlayer` fires `OnPlayerUndeploy` immediately after death (in-game it comes
  later) — our later explicit `UndeployPlayer` makes it fire twice per death cycle.
- `DeployPlayer` places at the team HQ then our `OnPlayerDeployed` teleports — same shape as
  the real AutoSpawn→teleport flow, but no deploy-screen timing.
- Ticks are 10 Hz (`SIM_TICK_TIME=0.1`), game is 30 Hz — per-tick counts scale ×3 in-game.
- No ballistics/aim: bot combat "damage" only happens via explicit `DealDamage`/`KillPlayer`.

## Reusing for another mode (Deadlock/Gunfight spectator debug)

Point `SPATIAL` and the `PROJ` bundle at that project (or parameterize), keep `compat.cjs`
as-is, and write scenarios that assert on `CameraSetActive`/`SetSpectateOnDeath` calls —
add observability wraps for them in `compat.cjs` exactly like the `Teleport` recorder.
