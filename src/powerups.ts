// ============================================================================
// FFA GUNMASTER — POWERUPS (promotion + demotion)
// ============================================================================
// Spawn at dedicated PHYSICAL marker props (ObjIds 201.., 0,0,0-bug safe).
// Humans only (the risk/reward is a player decision; bots ignore them).
//
// PROMOTION (N=1/2/3): pick up -> climb N tiers immediately + re-equip.
// DEMOTION (N=1/2/3) — HOT POTATO (author's design):
//   pick up -> a pending demotion of N is "loaded" onto you.
//   * If you get a KILL first  -> the VICTIM is demoted N tiers (dumped on them).
//   * If you DIE first          -> it backfires: YOU are demoted N tiers.
//   Picking up more demotions before offloading STACKS the pending amount.
// ============================================================================

import { Timers } from 'bf6-portal-utils/timers/index.ts';
import {
    sfxVol,
    DEBUG_MODE,
    POWERUP_MARKER_IDS,
    POWERUP_SPAWN_INTERVAL_MS,
    POWERUP_MAX_CONCURRENT,
    POWERUP_PICKUP_RADIUS,
    POWERUP_LIFETIME_MS,
    POWERUP_DEMOTION_CHANCE,
    POWERUP_MAGNITUDE_WEIGHTS,
} from './config.ts';
import { shiftTiers, applyTierWeapon } from './ladder.ts';

const RS = mod.RuntimeSpawn_Common;
const ZERO = mod.CreateVector(0, 0, 0);

// Number props (magnitude) spin; a colored smoke aura marks promo vs demo.
// Technique lifted from the Undead mode: FX_Smoke_Marker_Custom + SetVFXColor
// (same base FX, tinted) — the SDK has no blue marker FX in RuntimeSpawn_Common.
const NUMBER_PROP = [RS.FiringRange_NumberOne_01, RS.FiringRange_NumberTwo_01, RS.FiringRange_NumberThree_01];
const SPAWN_BURST = RS.FX_BASE_Sparks_Pulse_L; // one-shot on spawn (as in Undead)
const SMOKE_FX = RS.FX_Smoke_Marker_Custom;
const PROMO_COLOR = mod.CreateVector(0.1, 0.5, 1); // BLUE = promotion
const DEMO_COLOR = mod.CreateVector(1, 0.15, 0.15); // RED = demotion
const SPIN_TICK_MS = 60; // spin cadence (matches Undead's 0.05s SetObjectTransform loop)
const SPIN_STEP = 0.05; // radians added per tick (tumble)
const SMOKE_RESPAWN_TICKS = 20; // re-puff the colored smoke ~every 1.2s (marker FX fades)
const SFX_PROMO = RS.SFX_UI_Notification_Primary_D_2D;
const SFX_DEMO_LOADED = RS.SFX_UI_MainMenu_PressPlay_OneShot2D;
const SFX_PICKUP = RS.SFX_UI_Gauntlet_Beacons_BeaconPickup_OneShot2D;

type Kind = 'promo' | 'demo';

interface LivePowerup {
    markerId: number;
    kind: Kind;
    magnitude: number; // 1..3
    pos: mod.Vector;
    numberObj: mod.Object | null;
    spawnedAt: number;
    expireTimer: number;
    yaw: number; // current spin angle
    smokeCounter: number; // ticks since last colored-smoke puff
}

const markerPositions: Map<number, mod.Vector> = new Map();
const live: Map<number, LivePowerup> = new Map(); // markerId -> powerup
const pendingDemotion: Map<number, number> = new Map(); // playerId -> loaded demotion tiers

// HUD hooks (registered by index.ts; decouples powerups from the UI module).
export interface PowerupHud {
    flash(player: mod.Player, text: string, color: 'green' | 'red' | 'gold' | 'white', ms?: number): void;
    refresh(player: mod.Player): void;
}
let hud: PowerupHud | null = null;
export function setPowerupHud(h: PowerupHud): void {
    hud = h;
}

let spawnInterval: number | null = null;
let pickupInterval: number | null = null;
let spinInterval: number | null = null;

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Powerups] ${msg}`);
}

function resolvePlayerById(playerId: number): mod.Player | null {
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

function spot(player: mod.Player, on: boolean): void {
    try {
        mod.SpotTarget(player, on ? mod.SpotStatus.SpotInBoth : mod.SpotStatus.Unspot);
    } catch {}
}

/** Keep every demotion-carrier highlighted so victims can SEE who demoted them. */
function spotCarriers(): void {
    for (const playerId of pendingDemotion.keys()) {
        const p = resolvePlayerById(playerId);
        if (p) {
            try {
                if (mod.IsPlayerValid(p) && mod.GetSoldierState(p, mod.SoldierStateBool.IsAlive)) {
                    mod.SpotTarget(p, mod.SpotStatus.SpotInBoth); // re-applied each tick to stay lit
                }
            } catch {}
        }
    }
}

/** Nearest live powerup position to a point within range (for the bot director). */
export function nearestPowerupPos(from: mod.Vector, maxRange: number): mod.Vector | null {
    let best: mod.Vector | null = null;
    let bestD = maxRange;
    for (const pu of live.values()) {
        try {
            const d = mod.DistanceBetween(from, pu.pos);
            if (d < bestD) {
                bestD = d;
                best = pu.pos;
            }
        } catch {}
    }
    return best;
}

/** Spin every live powerup's number prop. SetObjectTransform is the runtime mover
 * that "generally works" (corpus: MoveObject is flaky); kept at a modest cadence
 * to avoid the SetObjectTransform buffer-drift bug reported on fast loops. */
function puffSmoke(pu: LivePowerup): void {
    try {
        const smokePos = mod.Add(pu.pos, mod.CreateVector(0, 1.0, 0));
        const smoke = mod.SpawnObject(SMOKE_FX, smokePos, ZERO, mod.CreateVector(0.5, 0.5, 0.5)) as mod.VFX;
        if (smoke) {
            mod.SetVFXColor(smoke, pu.kind === 'promo' ? PROMO_COLOR : DEMO_COLOR);
            mod.EnableVFX(smoke, true);
            Timers.setTimeout(() => {
                try {
                    mod.UnspawnObject(smoke as unknown as mod.Object);
                } catch {}
            }, 2000);
        }
    } catch {}
}

function spinTick(): void {
    for (const pu of live.values()) {
        // Tumble the number prop (Undead's multi-axis SetObjectTransform spin).
        if (pu.numberObj) {
            pu.yaw += SPIN_STEP;
            if (pu.yaw > Math.PI * 2) pu.yaw -= Math.PI * 2;
            const r = pu.yaw;
            try {
                mod.SetObjectTransform(
                    pu.numberObj,
                    mod.CreateTransform(mod.Add(pu.pos, mod.CreateVector(0, 0.5, 0)), mod.CreateVector(r, r * 0.7, r * 0.3))
                );
            } catch {}
        }
        // Re-puff the colored smoke so the promo/demo color persists.
        pu.smokeCounter++;
        if (pu.smokeCounter >= SMOKE_RESPAWN_TICKS) {
            pu.smokeCounter = 0;
            puffSmoke(pu);
        }
    }
}

// A pooled one-shot sound: spawn, play to player, unspawn shortly after.
function playSfx(sfx: mod.RuntimeSpawn_Common, player: mod.Player, amp: number = 1.0): void {
    try {
        const obj = mod.SpawnObject(sfx, ZERO, ZERO) as mod.SFX;
        mod.PlaySound(obj, sfxVol(amp), player);
        Timers.setTimeout(() => {
            try {
                mod.StopSound(obj);
            } catch {}
            try {
                mod.UnspawnObject(obj as unknown as mod.Object);
            } catch {}
        }, 1200);
    } catch {}
}

// ---------------------------------------------------------------------------
// Init / teardown
// ---------------------------------------------------------------------------
export function initPowerups(): number {
    markerPositions.clear();
    for (const id of POWERUP_MARKER_IDS) {
        try {
            const obj = mod.GetSpatialObject(id);
            markerPositions.set(id, mod.GetObjectPosition(obj));
        } catch {
            // marker not present on this map — skip
        }
    }
    log(`initialized ${markerPositions.size}/${POWERUP_MARKER_IDS.length} powerup markers`);
    return markerPositions.size;
}

function weightedMagnitude(): number {
    const r = Math.random();
    let acc = 0;
    for (let i = 0; i < POWERUP_MAGNITUDE_WEIGHTS.length; i++) {
        acc += POWERUP_MAGNITUDE_WEIGHTS[i];
        if (r <= acc) return i + 1;
    }
    return 1;
}

function freeMarker(): number | null {
    const free: number[] = [];
    for (const id of markerPositions.keys()) {
        if (!live.has(id)) free.push(id);
    }
    if (free.length === 0) return null;
    return free[Math.floor(Math.random() * free.length)];
}

function spawnOne(): void {
    if (live.size >= POWERUP_MAX_CONCURRENT) return;
    const markerId = freeMarker();
    if (markerId === null) return;
    const pos = markerPositions.get(markerId)!;
    const kind: Kind = Math.random() < POWERUP_DEMOTION_CHANCE ? 'demo' : 'promo';
    const magnitude = weightedMagnitude();

    let numberObj: mod.Object | null = null;
    try {
        numberObj = mod.SpawnObject(NUMBER_PROP[magnitude - 1], mod.Add(pos, mod.CreateVector(0, 0.5, 0)), ZERO);
    } catch {}
    // Spawn burst (one-shot), as in the Undead mode.
    try {
        const burst = mod.SpawnObject(SPAWN_BURST, pos, ZERO, mod.CreateVector(1, 1, 1)) as mod.VFX;
        if (burst) {
            mod.EnableVFX(burst, true);
            Timers.setTimeout(() => {
                try {
                    mod.UnspawnObject(burst as unknown as mod.Object);
                } catch {}
            }, 3000);
        }
    } catch {}

    const expireTimer = Timers.setTimeout(() => despawn(markerId), POWERUP_LIFETIME_MS);
    const pu: LivePowerup = { markerId, kind, magnitude, pos, numberObj, spawnedAt: Date.now(), expireTimer, yaw: 0, smokeCounter: SMOKE_RESPAWN_TICKS };
    live.set(markerId, pu);
    puffSmoke(pu); // initial colored aura
    log(`spawned ${kind} ${magnitude}x at marker ${markerId}`);
}

function despawn(markerId: number): void {
    const pu = live.get(markerId);
    if (!pu) return;
    try {
        Timers.clearTimeout(pu.expireTimer);
    } catch {}
    if (pu.numberObj) {
        try {
            mod.UnspawnObject(pu.numberObj);
        } catch {}
    }
    live.delete(markerId);
}

// ---------------------------------------------------------------------------
// Pickup detection (proximity, humans only) — pure distance math, no raycasts.
// ---------------------------------------------------------------------------
function checkPickups(): void {
    if (live.size === 0) return;
    const r2 = POWERUP_PICKUP_RADIUS * POWERUP_PICKUP_RADIUS;
    let arr: mod.Any;
    let n = 0;
    try {
        arr = mod.AllPlayers();
        n = mod.CountOf(arr);
    } catch {
        return;
    }
    for (let i = 0; i < n; i++) {
        let p: mod.Player;
        try {
            p = mod.ValueInArray(arr, i) as mod.Player;
            if (!mod.IsPlayerValid(p)) continue;
            // Bots pick up too (they path toward powerups via the director).
            if (!mod.GetSoldierState(p, mod.SoldierStateBool.IsAlive)) continue;
        } catch {
            continue;
        }
        let pos: mod.Vector;
        try {
            pos = mod.GetSoldierState(p, mod.SoldierStateVector.GetPosition);
        } catch {
            continue;
        }
        const px = mod.XComponentOf(pos), py = mod.YComponentOf(pos), pz = mod.ZComponentOf(pos);
        for (const pu of live.values()) {
            const dx = mod.XComponentOf(pu.pos) - px;
            const dy = mod.YComponentOf(pu.pos) - py;
            const dz = mod.ZComponentOf(pu.pos) - pz;
            if (dx * dx + dy * dy + dz * dz <= r2) {
                applyPickup(p, pu);
                despawn(pu.markerId);
                break; // one pickup per player per tick
            }
        }
    }
}

function applyPickup(player: mod.Player, pu: LivePowerup): void {
    try {
        playSfx(SFX_PICKUP, player, 1.0);
        if (pu.kind === 'promo') {
            const newIdx = shiftTiers(player, pu.magnitude);
            applyTierWeapon(player); // give the better gun right now
            playSfx(SFX_PROMO, player, 1.5);
            hud?.flash(player, `PROMOTED  +${pu.magnitude}`, 'green');
            hud?.refresh(player);
            log(`PROMO ${pu.magnitude}x -> tier ${newIdx}`);
        } else {
            const playerId = mod.GetObjId(player);
            pendingDemotion.set(playerId, (pendingDemotion.get(playerId) ?? 0) + pu.magnitude);
            playSfx(SFX_DEMO_LOADED, player, 1.5);
            const total = pendingDemotion.get(playerId) ?? pu.magnitude;
            spot(player, true); // light them up for the whole lobby
            hud?.flash(player, `DEMOTION LOADED  −${total}  ·  GET A KILL!`, 'red', 2600);
            log(`DEMO ${pu.magnitude}x LOADED onto ${playerId} (pending ${total})`);
        }
    } catch {}
}

// ---------------------------------------------------------------------------
// Hot-potato hooks — called from the kill / death handlers in index.ts.
// ---------------------------------------------------------------------------

/** Killer had a pending demotion? Dump it on the victim and clear it. */
export function onKillOffloadDemotion(killer: mod.Player, victim: mod.Player): void {
    try {
        const killerId = mod.GetObjId(killer);
        const n = pendingDemotion.get(killerId);
        if (!n || n <= 0) return;
        pendingDemotion.delete(killerId);
        spot(killer, false); // no longer carrying it
        const newIdx = shiftTiers(victim, -n); // applies on the victim's respawn
        playSfx(SFX_DEMO_LOADED, killer, 1.5);
        hud?.flash(killer, `DUMPED IT!  −${n} ON THEM`, 'green');
        hud?.flash(victim, `DEMOTED  −${n}  ·  killed by a marked player`, 'red', 2600);
        log(`offload: victim demoted ${n} -> tier ${newIdx}`);
    } catch {}
}

/** Player died still holding a pending demotion? It backfires onto them. */
export function onDeathBackfireDemotion(player: mod.Player): void {
    try {
        const playerId = mod.GetObjId(player);
        const n = pendingDemotion.get(playerId);
        if (!n || n <= 0) return;
        pendingDemotion.delete(playerId);
        spot(player, false);
        const newIdx = shiftTiers(player, -n); // applies on their respawn
        log(`backfire: ${playerId} self-demoted ${n} -> tier ${newIdx}`);
    } catch {}
}

export function hasPendingDemotion(playerId: number): number {
    return pendingDemotion.get(playerId) ?? 0;
}

export function clearPowerupState(playerId: number): void {
    if (pendingDemotion.has(playerId)) {
        const p = resolvePlayerById(playerId);
        if (p) spot(p, false);
    }
    pendingDemotion.delete(playerId);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
export function startPowerups(): void {
    stopPowerups();
    pendingDemotion.clear();
    spawnInterval = Timers.setInterval(spawnOne, POWERUP_SPAWN_INTERVAL_MS);
    pickupInterval = Timers.setInterval(() => {
        checkPickups();
        spotCarriers();
    }, 250);
    spinInterval = Timers.setInterval(spinTick, SPIN_TICK_MS);
    log('powerup system started');
}

export function stopPowerups(): void {
    if (spawnInterval !== null) {
        Timers.clearInterval(spawnInterval);
        spawnInterval = null;
    }
    if (pickupInterval !== null) {
        Timers.clearInterval(pickupInterval);
        pickupInterval = null;
    }
    if (spinInterval !== null) {
        Timers.clearInterval(spinInterval);
        spinInterval = null;
    }
    for (const markerId of [...live.keys()]) despawn(markerId);
}
