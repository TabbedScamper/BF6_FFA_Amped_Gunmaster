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

// Number props (magnitude) + auras (promo vs demo) + sounds.
const NUMBER_PROP = [RS.FiringRange_NumberOne_01, RS.FiringRange_NumberTwo_01, RS.FiringRange_NumberThree_01];
const PROMO_AURA = RS.FX_Gadget_SpawnBeacon_Active; // friendly-looking beacon
const DEMO_AURA = RS.FX_Smoke_Marker_Custom; // ominous smoke
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
    auraObj: mod.Object | null;
    spawnedAt: number;
    expireTimer: number;
}

const markerPositions: Map<number, mod.Vector> = new Map();
const live: Map<number, LivePowerup> = new Map(); // markerId -> powerup
const pendingDemotion: Map<number, number> = new Map(); // playerId -> loaded demotion tiers

let spawnInterval: number | null = null;
let pickupInterval: number | null = null;

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Powerups] ${msg}`);
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
    let auraObj: mod.Object | null = null;
    try {
        numberObj = mod.SpawnObject(NUMBER_PROP[magnitude - 1], mod.Add(pos, mod.CreateVector(0, 0.5, 0)), ZERO);
    } catch {}
    try {
        auraObj = mod.SpawnObject(kind === 'promo' ? PROMO_AURA : DEMO_AURA, pos, ZERO);
        if (auraObj) {
            try {
                mod.EnableVFX(auraObj as mod.VFX, true);
            } catch {}
        }
    } catch {}

    const expireTimer = Timers.setTimeout(() => despawn(markerId), POWERUP_LIFETIME_MS);
    live.set(markerId, { markerId, kind, magnitude, pos, numberObj, auraObj, spawnedAt: Date.now(), expireTimer });
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
    if (pu.auraObj) {
        try {
            mod.UnspawnObject(pu.auraObj);
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
            if (mod.GetSoldierState(p, mod.SoldierStateBool.IsAISoldier)) continue; // humans only
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
            log(`PROMO ${pu.magnitude}x -> tier ${newIdx}`);
        } else {
            const playerId = mod.GetObjId(player);
            pendingDemotion.set(playerId, (pendingDemotion.get(playerId) ?? 0) + pu.magnitude);
            playSfx(SFX_DEMO_LOADED, player, 1.5);
            log(`DEMO ${pu.magnitude}x LOADED onto ${playerId} (pending ${pendingDemotion.get(playerId)})`);
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
        const newIdx = shiftTiers(victim, -n); // applies on the victim's respawn
        playSfx(SFX_DEMO_LOADED, killer, 1.5);
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
        const newIdx = shiftTiers(player, -n); // applies on their respawn
        log(`backfire: ${playerId} self-demoted ${n} -> tier ${newIdx}`);
    } catch {}
}

export function hasPendingDemotion(playerId: number): number {
    return pendingDemotion.get(playerId) ?? 0;
}

export function clearPowerupState(playerId: number): void {
    pendingDemotion.delete(playerId);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
export function startPowerups(): void {
    stopPowerups();
    pendingDemotion.clear();
    spawnInterval = Timers.setInterval(spawnOne, POWERUP_SPAWN_INTERVAL_MS);
    pickupInterval = Timers.setInterval(checkPickups, 250);
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
    for (const markerId of [...live.keys()]) despawn(markerId);
}
