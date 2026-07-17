// ============================================================================
// FFA GUNMASTER — AMPED WEAPON FX + SOUND + CHAIN-FREEZE
// ============================================================================
// Ported from Undead Gunmaster's UPGRADED_WEAPON_FX, but DAMAGE-STRIPPED: amped
// guns are a cosmetic prestige tier (identical damage to their base gun). We
// keep the per-weapon impact FX, the amped hit-sound, and — the sniper
// signature — a PLAYER-SAFE chain-freeze.
//
// Firing: SDK still has no on-fired event, so a per-tick ammo-delta detector
// (Events.OngoingPlayer) spots each shot; on an amped tier it raycasts (shared
// Raycast module, per-player FIFO queue) to place FX at the impact point. A
// per-player cooldown throttles full-auto so we respect the ~1 raycast/tick
// budget (corpus). Humans only (bots skip FX — saves the raycast budget).
//
// Chain-freeze (old code was AI-only, no-oped on humans): rebuilt with
// SetSoldierEffect(FreezeStatusEffect) + SetPlayerMovementSpeedMultiplier — a
// fair ~50% slow + frost visual that chains to nearby enemies, then releases.
// ============================================================================

import { Events } from 'bf6-portal-utils/events/index.ts';
import { Timers } from 'bf6-portal-utils/timers/index.ts';
import { Raycast } from 'bf6-portal-utils/raycast/index.ts';
import {
    sfxVol,
    DEBUG_MODE,
    AMPED_FX_COOLDOWN_MS,
    AMPED_HIT_SFX_AMP,
    AMPED_SOUND_CUTOFF_MS,
    AMPED_FX_RAY_RANGE,
    CHAIN_FREEZE_RADIUS,
    CHAIN_FREEZE_SLOW,
    CHAIN_FREEZE_DURATION_MS,
    CHAIN_FREEZE_MAX_TARGETS,
    AMPED_EXPLOSION_RADIUS,
    AMPED_EXPLOSION_DAMAGE,
    AMPED_RAYGUN_RADIUS,
    AMPED_RAYGUN_DAMAGE,
    AMPED_FIRE_RADIUS,
    AMPED_FIRE_DOT_DAMAGE,
    AMPED_FIRE_DOT_TICKS,
    AMPED_FIRE_DOT_INTERVAL_MS,
} from './config.ts';
import { currentTier, tierIsAmped } from './ladder.ts';

const RS = mod.RuntimeSpawn_Common;
const W = mod.Weapons;
const ZERO = mod.CreateVector(0, 0, 0);

// The amped hit sound (a single persistent SFX object, spawned once).
const AMPED_HIT_SFX = RS.SFX_UI_Gamemode_Shared_LeadChange_Positive_OneShot2D;
let ampedHitSfx: mod.SFX | null = null;

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Amped] ${msg}`);
}

// ---------------------------------------------------------------------------
// Per-weapon FX (DAMAGE-STRIPPED — visuals + chainFreeze flag only).
// Weapons not listed use AMPED_DEFAULT_FX (sparks) + the amped hit sound.
// ---------------------------------------------------------------------------
interface AmpedFxConfig {
    fx: mod.RuntimeSpawn_Common;
    despawnTime?: number;
    facePlayer?: boolean;
    scale?: number;
    aimOffset?: number;
    secondaryFx?: mod.RuntimeSpawn_Common;
    secondaryDespawnTime?: number;
    chainFreeze?: boolean; // the sniper signature (player-safe)
    // SIGNATURE DAMAGE — the FX is only visual; these make it actually hurt.
    explosionRadius?: number;
    explosionDamage?: number;
    fire?: boolean; // shotgun burn DOT in a small radius at the impact
}

const AMPED_DEFAULT_FX = RS.FX_BASE_Sparks_Pulse_L;

const WEAPON_FX: Map<mod.Weapons, AmpedFxConfig> = new Map([
    // M45A1 "CAMARO" — explosive rounds: 40mm HE burst + radius damage.
    [W.Sidearm_M45A1, {
        fx: RS.FX_Grenade_40mm_HE_Detonation,
        scale: 1,
        despawnTime: 1500,
        explosionRadius: AMPED_EXPLOSION_RADIUS,
        explosionDamage: AMPED_EXPLOSION_DAMAGE,
    }],
    // M44 "RAYGUN" — mortar-beacon + incendiary flourish + radius damage.
    [W.Sidearm_M44, {
        fx: RS.FX_Gadget_DeployableMortar_Target_Area,
        despawnTime: 200,
        facePlayer: true,
        scale: 0.25,
        aimOffset: 0.1,
        secondaryFx: RS.FX_Airburst_Incendiary_Detonation_Friendly,
        secondaryDespawnTime: 2000,
        explosionRadius: AMPED_RAYGUN_RADIUS,
        explosionDamage: AMPED_RAYGUN_DAMAGE,
    }],
    // Shotguns — fire/burn: fizzle FX + a burn DOT in a small splash radius.
    [W.Shotgun_M1014, { fx: RS.FX_Gadget_Sabotage_03_Fizzle, despawnTime: 2500, fire: true }],
    [W.Shotgun_M87A1, { fx: RS.FX_Gadget_Sabotage_03_Fizzle, despawnTime: 2500, fire: true }],
    [W.Shotgun_DB_12, { fx: RS.FX_Gadget_Sabotage_03_Fizzle, despawnTime: 2500, fire: true }],
    // Snipers — chain-FROST (player-safe slow + frost visual, no damage).
    [W.Sniper_SV_98, { fx: RS.FX_RepairTool_Sparks_1P, despawnTime: 5000, chainFreeze: true }],
    [W.Sniper_M2010_ESR, { fx: RS.FX_RepairTool_Sparks_1P, despawnTime: 5000, chainFreeze: true }],
    [W.Sniper_Mini_Scout, { fx: RS.FX_RepairTool_Sparks_1P, despawnTime: 5000, chainFreeze: true }],
]);

// --------------------------------------------------------------------------
// SIGNATURE DAMAGE — radius + DOT, applied to ALL soldiers (players + bots)
// except the shooter. DealDamage credits the shooter so kills promote them.
// --------------------------------------------------------------------------
function soldiersInRadius(center: mod.Vector, radius: number, excludeId: number): mod.Player[] {
    const out: mod.Player[] = [];
    try {
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        for (let i = 0; i < n; i++) {
            const p = mod.ValueInArray(arr, i) as mod.Player;
            try {
                if (!mod.IsPlayerValid(p)) continue;
                if (mod.GetObjId(p) === excludeId) continue;
                if (!mod.GetSoldierState(p, mod.SoldierStateBool.IsAlive)) continue;
                const pos = mod.GetSoldierState(p, mod.SoldierStateVector.GetPosition);
                if (mod.DistanceBetween(center, pos) <= radius) out.push(p);
            } catch {}
        }
    } catch {}
    return out;
}

function explode(attacker: mod.Player, center: mod.Vector, radius: number, damage: number): void {
    let attackerId = -1;
    try {
        attackerId = mod.GetObjId(attacker);
    } catch {}
    for (const p of soldiersInRadius(center, radius, attackerId)) {
        try {
            const pos = mod.GetSoldierState(p, mod.SoldierStateVector.GetPosition);
            const falloff = 1 - mod.DistanceBetween(center, pos) / radius;
            const dmg = Math.floor(damage * Math.max(0, falloff));
            if (dmg > 0) mod.DealDamage(p, dmg, attacker);
        } catch {}
    }
}

function fireDot(attacker: mod.Player, center: mod.Vector): void {
    let attackerId = -1;
    try {
        attackerId = mod.GetObjId(attacker);
    } catch {}
    // Snapshot victims at impact; tick the burn on each.
    const victims = soldiersInRadius(center, AMPED_FIRE_RADIUS, attackerId).map((p) => mod.GetObjId(p));
    for (let tick = 1; tick <= AMPED_FIRE_DOT_TICKS; tick++) {
        Timers.setTimeout(() => {
            for (const vid of victims) {
                const p = resolvePlayer(vid);
                try {
                    if (p && mod.IsPlayerValid(p) && mod.GetSoldierState(p, mod.SoldierStateBool.IsAlive)) {
                        mod.DealDamage(p, AMPED_FIRE_DOT_DAMAGE, attacker);
                    }
                } catch {}
            }
        }, tick * AMPED_FIRE_DOT_INTERVAL_MS);
    }
}

function resolvePlayer(playerId: number): mod.Player | null {
    try {
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        for (let i = 0; i < n; i++) {
            const p = mod.ValueInArray(arr, i) as mod.Player;
            try {
                if (mod.IsPlayerValid(p) && mod.GetObjId(p) === playerId) return p;
            } catch {}
        }
    } catch {}
    return null;
}

// ---------------------------------------------------------------------------
// FX object lifecycle — track spawned FX so we can despawn on timeout/cleanup.
// ---------------------------------------------------------------------------
const liveFx: Set<mod.Object> = new Set();

function spawnFx(fxType: mod.RuntimeSpawn_Common, pos: mod.Vector, rot: mod.Vector, scale: number, despawnMs?: number): void {
    try {
        const fx = mod.SpawnObject(fxType, pos, rot, mod.CreateVector(scale, scale, scale));
        if (!fx) return;
        liveFx.add(fx);
        try {
            mod.EnableVFX(fx as mod.VFX, true);
        } catch {}
        Timers.setTimeout(() => {
            if (liveFx.has(fx)) {
                liveFx.delete(fx);
                try {
                    mod.UnspawnObject(fx);
                } catch {}
            }
        }, despawnMs ?? 1500);
    } catch {}
}

// ---------------------------------------------------------------------------
// Sound.
// ---------------------------------------------------------------------------
export function initAmped(): void {
    liveFx.clear();
    frozen.clear();
    fxState.clear();
    try {
        ampedHitSfx = mod.SpawnObject(AMPED_HIT_SFX, ZERO, ZERO) as mod.SFX;
    } catch {
        ampedHitSfx = null;
    }
    log('amped system initialized');
}

function playAmpedHitSound(player: mod.Player): void {
    if (!ampedHitSfx) return;
    try {
        mod.PlaySound(ampedHitSfx, sfxVol(AMPED_HIT_SFX_AMP), player);
        Timers.setTimeout(() => {
            try {
                mod.StopSound(ampedHitSfx!);
            } catch {}
        }, AMPED_SOUND_CUTOFF_MS);
    } catch {}
}

// ---------------------------------------------------------------------------
// PLAYER-SAFE chain-freeze: frost + slow that hops between nearby enemies.
// ---------------------------------------------------------------------------
const frozen: Map<number, number> = new Map(); // playerId -> release timer id
const FROST_FX = RS.FX_RepairTool_Sparks_1P;

function aliveSoldiersNear(x: number, y: number, z: number, radius: number, excludeId: number): mod.Player[] {
    const out: mod.Player[] = [];
    const r2 = radius * radius;
    try {
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        for (let i = 0; i < n; i++) {
            const p = mod.ValueInArray(arr, i) as mod.Player;
            try {
                if (!mod.IsPlayerValid(p)) continue;
                if (mod.GetObjId(p) === excludeId) continue;
                if (!mod.GetSoldierState(p, mod.SoldierStateBool.IsAlive)) continue;
                const pos = mod.GetSoldierState(p, mod.SoldierStateVector.GetPosition);
                const dx = mod.XComponentOf(pos) - x, dy = mod.YComponentOf(pos) - y, dz = mod.ZComponentOf(pos) - z;
                if (dx * dx + dy * dy + dz * dz <= r2) out.push(p);
            } catch {}
        }
    } catch {}
    return out;
}

function freezeOne(target: mod.Player): void {
    try {
        const id = mod.GetObjId(target);
        if (frozen.has(id)) return; // already frosted — don't stack
        mod.SetSoldierEffect(target, mod.SoldierEffects.FreezeStatusEffect, true);
        mod.SetPlayerMovementSpeedMultiplier(target, CHAIN_FREEZE_SLOW);
        const pos = mod.GetSoldierState(target, mod.SoldierStateVector.GetPosition);
        spawnFx(FROST_FX, mod.Add(pos, mod.CreateVector(0, 1.5, 0)), ZERO, 1, CHAIN_FREEZE_DURATION_MS);
        const timer = Timers.setTimeout(() => {
            frozen.delete(id);
            try {
                if (mod.IsPlayerValid(target)) {
                    mod.SetSoldierEffect(target, mod.SoldierEffects.FreezeStatusEffect, false);
                    mod.SetPlayerMovementSpeedMultiplier(target, 1.0);
                }
            } catch {}
        }, CHAIN_FREEZE_DURATION_MS);
        frozen.set(id, timer);
    } catch {}
}

function applyChainFreeze(attacker: mod.Player, hitPoint: mod.Vector): void {
    const attackerId = (() => {
        try {
            return mod.GetObjId(attacker);
        } catch {
            return -1;
        }
    })();
    const hx = mod.XComponentOf(hitPoint), hy = mod.YComponentOf(hitPoint), hz = mod.ZComponentOf(hitPoint);

    // Seed from the nearest enemy to the impact, then hop outward through the
    // frost radius up to the cap. BFS on positions (bounded, synchronous).
    const seeds = aliveSoldiersNear(hx, hy, hz, CHAIN_FREEZE_RADIUS, attackerId);
    const queue: mod.Player[] = [];
    const chainedIds = new Set<number>();
    for (const s of seeds) {
        const id = mod.GetObjId(s);
        if (!chainedIds.has(id)) { chainedIds.add(id); queue.push(s); }
        if (chainedIds.size >= CHAIN_FREEZE_MAX_TARGETS) break;
    }
    let head = 0;
    while (head < queue.length && chainedIds.size < CHAIN_FREEZE_MAX_TARGETS) {
        const cur = queue[head++];
        freezeOne(cur);
        try {
            const cp = mod.GetSoldierState(cur, mod.SoldierStateVector.GetPosition);
            const hops = aliveSoldiersNear(
                mod.XComponentOf(cp), mod.YComponentOf(cp), mod.ZComponentOf(cp),
                CHAIN_FREEZE_RADIUS, attackerId
            );
            for (const h of hops) {
                const hid = mod.GetObjId(h);
                if (!chainedIds.has(hid) && chainedIds.size < CHAIN_FREEZE_MAX_TARGETS) {
                    chainedIds.add(hid);
                    queue.push(h);
                }
            }
        } catch {}
    }
    // Freeze any seeds not yet processed (cap reached mid-BFS).
    for (; head < queue.length; head++) freezeOne(queue[head]);
    if (chainedIds.size > 0) log(`chain-frost hit ${chainedIds.size} target(s)`);
}

// ---------------------------------------------------------------------------
// FX firing — raycast to the impact point and spawn the weapon's FX there.
// ---------------------------------------------------------------------------
function fireAmpedFx(player: mod.Player, weapon: mod.Weapons): void {
    const cfg = WEAPON_FX.get(weapon);
    const fxType = cfg?.fx ?? AMPED_DEFAULT_FX;
    const scale = cfg?.scale ?? 1;
    const aimOffset = cfg?.aimOffset ?? 0;

    let eye: mod.Vector, facing: mod.Vector;
    try {
        eye = mod.GetSoldierState(player, mod.SoldierStateVector.EyePosition);
        facing = mod.GetSoldierState(player, mod.SoldierStateVector.GetFacingDirection);
    } catch {
        return;
    }
    const adj = mod.CreateVector(mod.XComponentOf(facing), mod.YComponentOf(facing) - aimOffset, mod.ZComponentOf(facing));
    const start = mod.Add(eye, mod.Multiply(adj, 0.5));
    const end = mod.Add(start, mod.Multiply(adj, AMPED_FX_RAY_RANGE));

    Raycast.cast(player, start, end, {
        onHit: (hitPoint: mod.Vector) => {
            let rot = ZERO;
            if (cfg?.facePlayer) {
                const dx = mod.XComponentOf(eye) - mod.XComponentOf(hitPoint);
                const dy = mod.YComponentOf(eye) - mod.YComponentOf(hitPoint);
                const dz = mod.ZComponentOf(eye) - mod.ZComponentOf(hitPoint);
                const horiz = Math.sqrt(dx * dx + dz * dz);
                rot = mod.CreateVector(-Math.atan2(dy, horiz) + Math.PI / 2, Math.atan2(dx, dz), 0);
            }
            spawnFx(fxType, hitPoint, rot, scale, cfg?.despawnTime);
            if (cfg?.secondaryFx) {
                spawnFx(cfg.secondaryFx, hitPoint, ZERO, 1, cfg.secondaryDespawnTime);
            }
            // Signature damage — the FX is only cosmetic; these make it hurt.
            if (cfg?.explosionRadius && cfg?.explosionDamage) {
                explode(player, hitPoint, cfg.explosionRadius, cfg.explosionDamage);
            }
            if (cfg?.fire) {
                fireDot(player, hitPoint);
            }
            if (cfg?.chainFreeze) {
                applyChainFreeze(player, hitPoint);
            }
        },
        // onMiss: nothing to place FX on (shot into the sky) — skip silently.
        onMiss: () => {},
    });
}

// ---------------------------------------------------------------------------
// Per-tick shot detector (Events.OngoingPlayer). Humans only.
// ---------------------------------------------------------------------------
interface FxState {
    lastWeapon: mod.Weapons | null;
    lastMag: number;
    lastFxAt: number;
}
const fxState: Map<number, FxState> = new Map();

function stateOf(playerId: number): FxState {
    let s = fxState.get(playerId);
    if (!s) {
        s = { lastWeapon: null, lastMag: -1, lastFxAt: 0 };
        fxState.set(playerId, s);
    }
    return s;
}

function activeWeaponSlot(player: mod.Player): mod.InventorySlots | null {
    try {
        if (mod.IsInventorySlotActive(player, mod.InventorySlots.PrimaryWeapon)) return mod.InventorySlots.PrimaryWeapon;
        if (mod.IsInventorySlotActive(player, mod.InventorySlots.SecondaryWeapon)) return mod.InventorySlots.SecondaryWeapon;
    } catch {}
    return null;
}

/** Called every tick per player. Detects a shot and fires amped FX if applicable. */
export function checkAmpedFx(player: mod.Player): void {
    try {
        if (!mod.IsPlayerValid(player)) return;
        if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return; // humans only
        if (!mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive)) return;
        if (!tierIsAmped(player)) return;

        const tier = currentTier(player);
        const weapon = tier?.weapon;
        if (weapon === undefined) return;

        const slot = activeWeaponSlot(player);
        if (!slot) return;

        const playerId = mod.GetObjId(player);
        const st = stateOf(playerId);

        let mag: number;
        try {
            mag = mod.GetInventoryAmmo(player, slot);
        } catch {
            st.lastMag = -1;
            return;
        }

        // Weapon changed (promotion / respawn) — reset baseline, no shot this tick.
        if (weapon !== st.lastWeapon) {
            st.lastWeapon = weapon;
            st.lastMag = mag;
            return;
        }

        const fired = st.lastMag - mag; // rounds consumed since last tick
        st.lastMag = mag;
        if (fired <= 0) return;

        // Throttle FX raycasts (respect the raycast budget on full-auto).
        const now = Date.now();
        if (now - st.lastFxAt < AMPED_FX_COOLDOWN_MS) return;
        st.lastFxAt = now;

        fireAmpedFx(player, weapon);
        playAmpedHitSound(player);
    } catch {}
}

export function clearAmpedState(playerId: number): void {
    fxState.delete(playerId);
    const t = frozen.get(playerId);
    if (t !== undefined) {
        try {
            Timers.clearTimeout(t);
        } catch {}
        frozen.delete(playerId);
    }
}

export function cleanupAmped(): void {
    for (const fx of liveFx) {
        try {
            mod.UnspawnObject(fx);
        } catch {}
    }
    liveFx.clear();
    for (const [, t] of frozen) {
        try {
            Timers.clearTimeout(t);
        } catch {}
    }
    frozen.clear();
    fxState.clear();
}

/** Wire the per-tick detector once (call from OnGameModeStarted). */
export function startAmpedDetector(): void {
    Events.OngoingPlayer.subscribe(checkAmpedFx);
}
