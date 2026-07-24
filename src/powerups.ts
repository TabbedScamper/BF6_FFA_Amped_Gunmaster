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
    POWERUP_MAX_CONCURRENT,
    POWERUP_PICKUP_RADIUS,
    POWERUP_LIFETIME_MS,
    POWERUP_DROP_CHANCE,
    POWERUP_SPAWN_COOLDOWN_MS,
    POWERUP_DROP_TABLE,
    DEMOTION_MAX_BACK,
} from './config.ts';
import { shiftTiers, applyTierWeapon, progressOf } from './ladder.ts';

const RS = mod.RuntimeSpawn_Common;
const ZERO = mod.CreateVector(0, 0, 0);

// Powerup visual = a spinning NUMBER prop + a persistent SPARKS FX, exactly as
// the Undead mode did (NOT smoke — smoke was only for the removed perks):
//   promotion -> FX_RepairTool_Sparks_1P,  demotion -> FX_RepairTool_Sparks_Damage.
// We also SetVFXColor them to guarantee the requested BLUE (promo) / RED (demo).
const NUMBER_PROP = [RS.FiringRange_NumberOne_01, RS.FiringRange_NumberTwo_01, RS.FiringRange_NumberThree_01];
const PROMO_SPARKS = RS.FX_RepairTool_Sparks_1P;
const DEMO_SPARKS = RS.FX_RepairTool_Sparks_Damage;
const PROMO_COLOR = mod.CreateVector(0.1, 0.5, 1); // BLUE = promotion
const DEMO_COLOR = mod.CreateVector(1, 0.15, 0.15); // RED = demotion
// Spin via the ENGINE (MoveObjectOverTime + shouldLoop): one call, no per-tick
// script, no SetObjectTransform buffer-drift (corpus: the "Library for Multiple
// Object Operations" thread — OverTime functions are "set it and forget it").
const SPIN_PERIOD_S = 2.5; // one full revolution every 2.5s, looped by the engine
const SPIN_FULL = mod.CreateVector(0, Math.PI * 2, 0); // yaw rotation delta per period
// Sounds matched EXACTLY to the Undead Gunmaster archive (SFX_CONFIG).
const SFX_PROMO = RS.SFX_UI_Notification_Primary_D_2D; // SFX_CONFIG.PROMOTION
const SFX_DEMO_LOADED = RS.SFX_UI_MainMenu_PressPlay_OneShot2D; // SFX_CONFIG.DEMOTION
const SFX_PICKUP = RS.SFX_GameModes_BR_Mission_WeaponCache_Open_OneShot3D; // SFX_CONFIG.POWERUP_PICKUP

type Kind = 'promo' | 'demo';

interface LivePowerup {
    id: number;
    kind: Kind;
    magnitude: number; // 1..3
    pos: mod.Vector;
    numberObj: mod.Object | null;
    sparksObj: mod.Object | null;
    spawnedAt: number;
    expireTimer: number;
    raised: mod.Vector; // spawn position (death spot + lift); spin rotates about this
    rot: number; // current spin angle (advanced by the ONE shared spin loop)
}

const live: Map<number, LivePowerup> = new Map(); // id -> powerup
const pendingDemotion: Map<number, number> = new Map(); // playerId -> loaded demotion tiers
// playerId -> guns to show as lost via the red "DEMOTED / N GUNS" box callout on their NEXT
// deploy. Set when a demotion actually LANDS (marked-kill victim OR own-charge backfire), so
// both routes share the single respawn callout (replaces the -N center flashes).
const pendingDemoCallout: Map<number, number> = new Map();
// playerId -> a demotion was applied but the demotion LOCK fully absorbed it (0 guns lost). On the
// next deploy this shows the GREEN "DEMOTION LOCKED" box + green screen flash + a "safe" sound,
// instead of the red DEMOTED callout — the lock protected them.
const pendingLockCallout: Set<number> = new Set();
let nextId = 1;
let lastDropAt = 0; // Date.now() of the last drop (global cooldown)

// HUD hooks (registered by index.ts; decouples powerups from the UI module).
export interface PowerupHud {
    refresh(player: mod.Player): void;
    setDemotionWarning(player: mod.Player, n: number): void; // paint at-risk cards red
    clearDemotionWarning(player: mod.Player): void; // clear the red at-risk cards
    powerupPromo(player: mod.Player, magnitude: number): void; // green "PROMOTED! / +N GUNS" box note
    demoLoaded(player: mod.Player): void; // bright-red "GET A KILL!" box note (charge picked up)
}
// Powerup banner text is CUSTOM TEXT -> keyed in strings.json (ffa.flash.*),
// numbers passed as placeholder args.
const SK = (): mod.Any => mod.stringkeys;
let hud: PowerupHud | null = null;
export function setPowerupHud(h: PowerupHud): void {
    hud = h;
}

let pickupInterval: number | null = null;
let spinInterval: number | null = null;

const SPIN_STEP = 0.09; // radians per tick

// ONE shared spin loop for ALL live powerups (vs a Timers.setInterval per powerup).
// Each object still needs its own SetObjectTransform (bf6-MultiObjectTransform: the
// engine call is per-object; the win is a single scheduler, not N timers).
function spinLoop(): void {
    if (live.size === 0) return;
    for (const pu of live.values()) {
        if (!pu.numberObj) continue;
        pu.rot += SPIN_STEP;
        try {
            mod.SetObjectTransform(
                pu.numberObj as mod.SpatialObject,
                // Yaw only (rotate about the vertical STANDING axis) so the number stays
                // upright and readable — no pitch/roll, so it never tumbles upside down.
                mod.CreateTransform(pu.raised, mod.CreateVector(0, pu.rot, 0))
            );
        } catch {}
    }
}

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

// A pooled one-shot sound: spawn, play to player, unspawn shortly after.
function playSfx(sfx: mod.RuntimeSpawn_Common, player: mod.Player, amp: number = 1.0): void {
    try {
        const obj = mod.SpawnObject(sfx, ZERO, ZERO) as mod.SFX;
        mod.PlaySound(obj, sfxVol(amp), player);
        // Cleanup ONLY — no StopSound. The pickup chime runs ~4.5s; 5.5s outlasts it so it's never
        // clipped. Amped weapon fire is the sole sound we intentionally cut short (in amped.ts).
        Timers.setTimeout(() => {
            try {
                mod.UnspawnObject(obj as unknown as mod.Object);
            } catch {}
        }, 5500);
    } catch {}
}

// ---------------------------------------------------------------------------
// Init / teardown
// ---------------------------------------------------------------------------
export function initPowerups(): void {
    nextId = 1;
    lastDropAt = 0;
    log('powerups: death-drop model (weighted rarity, no markers)');
}

/** Weighted pick from the drop table. */
function pickDrop(): { kind: Kind; magnitude: number } {
    let total = 0;
    for (const d of POWERUP_DROP_TABLE) total += d.weight;
    let r = Math.random() * total;
    for (const d of POWERUP_DROP_TABLE) {
        r -= d.weight;
        if (r <= 0) return { kind: d.kind, magnitude: d.magnitude };
    }
    const f = POWERUP_DROP_TABLE[0];
    return { kind: f.kind, magnitude: f.magnitude };
}

/**
 * Try to drop a powerup at a death location (Undead model): respects a global
 * cooldown + drop chance + concurrent cap, then a weighted rarity roll.
 */
export function trySpawnAtDeath(pos: mod.Vector): void {
    const now = Date.now();
    if (live.size >= POWERUP_MAX_CONCURRENT) return;
    if (now - lastDropAt < POWERUP_SPAWN_COOLDOWN_MS) return;
    if (Math.random() > POWERUP_DROP_CHANCE) return;
    lastDropAt = now;
    const { kind, magnitude } = pickDrop();
    spawnAt(pos, kind, magnitude);
}

function spawnAt(pos: mod.Vector, kind: Kind, magnitude: number): void {
    const id = nextId++;

    // Spawn the floating number 1.5m ABOVE the death spot (was 0.5m — too low,
    // it sat in the floor). Matches the Undead Gunmaster's +1.5 lift.
    const raised = mod.Add(pos, mod.CreateVector(0, 1.5, 0));
    let numberObj: mod.Object | null = null;
    try {
        numberObj = mod.SpawnObject(NUMBER_PROP[magnitude - 1], raised, ZERO);
    } catch {}
    // No per-powerup timer — the ONE shared spinLoop() rotates every live powerup
    // (studied bf6-MultiObjectTransform: SetObjectTransform is still 1 engine call
    // per object, so the win is centralizing to a single loop instead of N timers).
    // Persistent sparks FX (promo vs demo), tinted to guarantee blue/red — raised too.
    let sparksObj: mod.Object | null = null;
    try {
        sparksObj = mod.SpawnObject(kind === 'promo' ? PROMO_SPARKS : DEMO_SPARKS, raised, ZERO, mod.CreateVector(1, 1, 1));
        if (sparksObj) {
            try {
                mod.SetVFXColor(sparksObj as mod.VFX, kind === 'promo' ? PROMO_COLOR : DEMO_COLOR);
            } catch {}
            mod.EnableVFX(sparksObj as mod.VFX, true);
        }
    } catch {}

    const expireTimer = Timers.setTimeout(() => despawn(id), POWERUP_LIFETIME_MS);
    live.set(id, { id, kind, magnitude, pos, numberObj, sparksObj, spawnedAt: Date.now(), expireTimer, raised, rot: 0 });
    log(`dropped ${kind} ${magnitude}x at death (id ${id})`);
}

function despawn(id: number): void {
    const pu = live.get(id);
    if (!pu) return;
    try {
        Timers.clearTimeout(pu.expireTimer);
    } catch {}
    if (pu.numberObj) {
        try {
            mod.UnspawnObject(pu.numberObj);
        } catch {}
    }
    if (pu.sparksObj) {
        try {
            mod.UnspawnObject(pu.sparksObj);
        } catch {}
    }
    live.delete(id);
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
                despawn(pu.id);
                break; // one pickup per player per tick
            }
        }
    }
}

function applyPickup(player: mod.Player, pu: LivePowerup): void {
    try {
        // SFX_PICKUP is a 3D sound — a 3D SFX played WITHOUT a position is heard by NO
        // ONE (Aryo-thread truth table; this sting was silent). Play it AT the powerup:
        // the picker is standing on it, and nearby players hear the grab too.
        try {
            const obj = mod.SpawnObject(SFX_PICKUP, ZERO, ZERO) as mod.SFX;
            mod.PlaySound(obj, sfxVol(1.0), pu.pos, 40);
            Timers.setTimeout(() => {
                try { mod.UnspawnObject(obj as unknown as mod.Object); } catch {}
            }, 5500);
        } catch {}
        if (pu.kind === 'promo') {
            const newIdx = shiftTiers(player, pu.magnitude);
            applyTierWeapon(player); // give the better gun right now
            playSfx(SFX_PROMO, player, 2.0);
            hud?.powerupPromo(player, pu.magnitude); // "PROMOTED! / +N GUNS" box note
            hud?.refresh(player);
            log(`PROMO ${pu.magnitude}x -> tier ${newIdx}`);
        } else {
            const playerId = mod.GetObjId(player);
            pendingDemotion.set(playerId, (pendingDemotion.get(playerId) ?? 0) + pu.magnitude);
            playSfx(SFX_DEMO_LOADED, player, 2.0);
            const total = pendingDemotion.get(playerId) ?? pu.magnitude;
            spot(player, true); // light them up for the whole lobby
            hud?.demoLoaded(player); // bright-red "GET A KILL!" box note (red cards show which guns)
            // Cap the at-risk red cards at the demotion lock — you can never lose more than
            // DEMOTION_MAX_BACK guns, so never warn on more than that many.
            hud?.setDemotionWarning(player, Math.min(total, DEMOTION_MAX_BACK));
            log(`DEMO ${pu.magnitude}x LOADED onto ${playerId} (pending ${total})`);
        }
    } catch {}
}

// ---------------------------------------------------------------------------
// Hot-potato hooks — called from the kill / death handlers in index.ts.
// ---------------------------------------------------------------------------

/** Killer had a pending demotion? Dump it on the victim and clear it. Returns the guns the victim
 *  actually lost (0 if the killer wasn't carrying a charge, or the victim's lock ate it). */
export function onKillOffloadDemotion(killer: mod.Player, victim: mod.Player): number {
    try {
        const killerId = mod.GetObjId(killer);
        const n = pendingDemotion.get(killerId);
        if (!n || n <= 0) return 0;
        pendingDemotion.delete(killerId);
        spot(killer, false); // no longer carrying it
        hud?.clearDemotionWarning(killer); // got a kill -> offloaded -> clear the red cards
        const vBefore = progressOf(victim)?.ladderIndex ?? 0;
        const newIdx = shiftTiers(victim, -n); // applies on the victim's respawn (capped by the lock)
        const lost = Math.max(0, vBefore - newIdx); // ACTUAL guns lost after the demotion lock
        playSfx(SFX_DEMO_LOADED, killer, 2.0);
        // No "DUMPED IT!" flash for the killer, no "-N marked" flash for the victim — the
        // victim gets the red DEMOTED box callout on their respawn instead (queued here), showing
        // the REAL guns lost (never more than the demotion lock allows).
        const victimId = mod.GetObjId(victim);
        if (lost > 0) {
            pendingDemoCallout.set(victimId, (pendingDemoCallout.get(victimId) ?? 0) + lost);
        } else {
            pendingLockCallout.add(victimId); // lock ate the whole demotion -> green "DEMOTION LOCKED"
        }
        log(`offload: victim demoted ${n} (lost ${lost}) -> tier ${newIdx}${lost === 0 ? ' [LOCKED]' : ''}`);
        return lost;
    } catch {}
    return 0;
}

/** Player died still holding a pending demotion? It backfires onto them. */
export function onDeathBackfireDemotion(player: mod.Player): void {
    try {
        const playerId = mod.GetObjId(player);
        const n = pendingDemotion.get(playerId);
        if (!n || n <= 0) return;
        pendingDemotion.delete(playerId);
        spot(player, false);
        hud?.clearDemotionWarning(player); // charge spent (backfired) -> clear the red cards
        const before = progressOf(player)?.ladderIndex ?? 0;
        const newIdx = shiftTiers(player, -n); // applies on their respawn (capped by the lock)
        const lost = Math.max(0, before - newIdx); // ACTUAL guns lost after the demotion lock
        if (lost > 0) {
            pendingDemoCallout.set(playerId, (pendingDemoCallout.get(playerId) ?? 0) + lost); // red DEMOTED box on respawn
        } else {
            pendingLockCallout.add(playerId); // lock ate the whole demotion -> green "DEMOTION LOCKED"
        }
        log(`backfire: ${playerId} self-demoted ${n} (lost ${lost}) -> tier ${newIdx}${lost === 0 ? ' [LOCKED]' : ''}`);
    } catch {}
}

export function hasPendingDemotion(playerId: number): number {
    return pendingDemotion.get(playerId) ?? 0;
}

/** Pop the queued "DEMOTED / N GUNS" respawn callout for this player (0 if none). */
export function takeDemoCallout(playerId: number): number {
    const n = pendingDemoCallout.get(playerId) ?? 0;
    pendingDemoCallout.delete(playerId);
    return n;
}

/** Pop the queued green "DEMOTION LOCKED" respawn callout (true if a demotion was fully blocked). */
export function takeLockCallout(playerId: number): boolean {
    const had = pendingLockCallout.has(playerId);
    pendingLockCallout.delete(playerId);
    return had;
}

export function clearPowerupState(playerId: number): void {
    if (pendingDemotion.has(playerId)) {
        const p = resolvePlayerById(playerId);
        if (p) spot(p, false);
    }
    pendingDemotion.delete(playerId);
    pendingDemoCallout.delete(playerId);
    pendingLockCallout.delete(playerId);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
export function startPowerups(): void {
    stopPowerups();
    pendingDemotion.clear();
    pendingDemoCallout.clear();
    pendingLockCallout.clear();
    pickupInterval = Timers.setInterval(() => {
        checkPickups();
        spotCarriers();
    }, 250);
    spinInterval = Timers.setInterval(spinLoop, 50); // single loop spins every powerup
    log('powerup system started');
}

export function stopPowerups(despawnObjects: boolean = true): void {
    if (pickupInterval !== null) {
        Timers.clearInterval(pickupInterval);
        pickupInterval = null;
    }
    if (spinInterval !== null) {
        Timers.clearInterval(spinInterval);
        spinInterval = null;
    }
    if (despawnObjects) {
        for (const id of [...live.keys()]) despawn(id);
    } else {
        // TEARDOWN (match end / host exit): do NOT UnspawnObject — the engine is already
        // freeing the world, and unspawning an already-removed prop hard-crashes on exit.
        // Just drop our JS references and let the engine reclaim the props.
        live.clear();
    }
}
