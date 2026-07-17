// ============================================================================
// FFA GUNMASTER — SPAWN SELECTION (anti-spawn-kill)
// ============================================================================
// The arenas are the Deadlock maps with 32 uniquely-ID'd spawn markers placed
// as spatial objects (SPAWN_SPATIAL_IDS). A spawn is picked by SCORE:
//
//   score = distance-to-nearest-enemy term   (math, computed at pick time)
//         - LOS danger                        (rolling raycast cache, see below)
//         - recently-used penalty             (LRU — don't reuse hot spawns)
//
// LINE-OF-SIGHT: a sniper across the map can see a spawn without being near it.
// Raycasts are ~1/tick engine-wide (Discord-confirmed), so we CANNOT burst-
// check 32 spawns at pick time. Instead a background sampler round-robins ONE
// raycast per interval: spawn[i] -> nearest alive player's chest. A CLEAR line
// (OnRayCastMissed) means players can see that spawn => danger bumps; a HIT
// (wall in between) decays it. At pick time danger is just a cached number.
//
// NOTE: this module owns the global RayCast(start, stop) result events. When
// the bot-LOS system lands (DESIGN step 3) both must share one dispatch queue.
// ============================================================================

import { Events } from 'bf6-portal-utils/events/index.ts';
import { Timers } from 'bf6-portal-utils/timers/index.ts';
import { DEBUG_MODE } from './config.ts';

// The 32 spawn markers placed in the Godot map (unique spatial ObjIds).
// Author's map pass will finalize these ids; 101..132 is the working plan.
export const SPAWN_SPATIAL_IDS: number[] = [
    101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116,
    117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132,
];

// --- scoring knobs ---
const MIN_SAFE_DISTANCE = 15; // enemies inside this make a spawn nearly unpickable
const NEAR_PENALTY = 1000; // applied per enemy inside MIN_SAFE_DISTANCE
const DISTANCE_CAP = 80; // distance term saturates here (far is far enough)
const DANGER_WEIGHT = 12; // score cost per cached danger point
const DANGER_MAX = 8; // cache ceiling
const DANGER_DECAY = 0.5; // subtracted per sample when the line is blocked
const RECENT_USE_PENALTY = 40; // discourage the just-used spawn
const RECENT_USE_MS = 8000;
const LOS_SAMPLE_MS = 200; // one raycast per sample (respects the 1/tick budget)
const CHEST_OFFSET_Y = 1.4; // aim rays chest-height

interface SpawnPoint {
    id: number;
    pos: mod.Vector;
    danger: number; // rolling LOS danger cache
    lastUsedAt: number; // Date.now() of last spawn here
}

const points: SpawnPoint[] = [];
let sampleIndex = 0;
let samplerInterval: number | null = null;
let pendingSampleIndex: number | null = null; // the spawn awaiting a raycast result

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Spawns] ${msg}`);
}

/** Read marker positions once (spatial objects — GetObjectPosition works on these). */
export function initSpawns(): number {
    points.length = 0;
    for (const id of SPAWN_SPATIAL_IDS) {
        try {
            const obj = mod.GetSpatialObject(id);
            const pos = mod.GetObjectPosition(obj);
            points.push({ id, pos, danger: 0, lastUsedAt: 0 });
        } catch {
            // marker not present on this map — skip
        }
    }
    log(`initialized ${points.length}/${SPAWN_SPATIAL_IDS.length} spawn markers`);
    return points.length;
}

export function spawnCount(): number {
    return points.length;
}

function alivePlayers(excludeId: number): Array<{ pos: mod.Vector; x: number; y: number; z: number }> {
    const out: Array<{ pos: mod.Vector; x: number; y: number; z: number }> = [];
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
                out.push({ pos, x: mod.XComponentOf(pos), y: mod.YComponentOf(pos), z: mod.ZComponentOf(pos) });
            } catch {}
        }
    } catch {}
    return out;
}

// ---------------------------------------------------------------------------
// Rolling LOS sampler: one raycast per LOS_SAMPLE_MS from spawn[i] to the
// nearest alive player's chest. Clear line => danger up; blocked => decay.
// ---------------------------------------------------------------------------
export function startLosSampler(): void {
    if (samplerInterval !== null) return;
    samplerInterval = Timers.setInterval(() => {
        try {
            if (points.length === 0 || pendingSampleIndex !== null) return;
            const idx = sampleIndex % points.length;
            sampleIndex++;
            const sp = points[idx];
            const others = alivePlayers(-1);
            if (others.length === 0) return;
            // nearest player to this spawn (the most likely watcher)
            const sx = mod.XComponentOf(sp.pos), sy = mod.YComponentOf(sp.pos), sz = mod.ZComponentOf(sp.pos);
            let best = others[0], bd = Infinity;
            for (const o of others) {
                const d = (o.x - sx) * (o.x - sx) + (o.y - sy) * (o.y - sy) + (o.z - sz) * (o.z - sz);
                if (d < bd) { bd = d; best = o; }
            }
            pendingSampleIndex = idx;
            mod.RayCast(
                mod.CreateVector(sx, sy + CHEST_OFFSET_Y, sz),
                mod.CreateVector(best.x, best.y + CHEST_OFFSET_Y, best.z)
            );
        } catch {
            pendingSampleIndex = null;
        }
    }, LOS_SAMPLE_MS);
}

export function stopLosSampler(): void {
    if (samplerInterval !== null) {
        Timers.clearInterval(samplerInterval);
        samplerInterval = null;
    }
    pendingSampleIndex = null;
}

// Result attribution: we only ever have ONE outstanding cast.
Events.OnRayCastHit.subscribe(() => {
    // Something between spawn and watcher: line blocked -> decay danger.
    if (pendingSampleIndex !== null && points[pendingSampleIndex]) {
        const sp = points[pendingSampleIndex];
        sp.danger = Math.max(0, sp.danger - DANGER_DECAY);
    }
    pendingSampleIndex = null;
});
Events.OnRayCastMissed.subscribe(() => {
    // Clear line: the nearest player can SEE this spawn -> danger up.
    if (pendingSampleIndex !== null && points[pendingSampleIndex]) {
        const sp = points[pendingSampleIndex];
        sp.danger = Math.min(DANGER_MAX, sp.danger + 1);
    }
    pendingSampleIndex = null;
});

// ---------------------------------------------------------------------------
// Pick the best spawn for a player (or a bot identity's respawn).
// ---------------------------------------------------------------------------
export function pickSpawn(excludePlayerId: number): SpawnPoint | null {
    if (points.length === 0) return null;
    const others = alivePlayers(excludePlayerId);
    const now = Date.now();

    let best: SpawnPoint | null = null;
    let bestScore = -Infinity;
    for (const sp of points) {
        const sx = mod.XComponentOf(sp.pos), sy = mod.YComponentOf(sp.pos), sz = mod.ZComponentOf(sp.pos);
        let nearest = Infinity;
        let tooClose = 0;
        for (const o of others) {
            const d = Math.sqrt((o.x - sx) * (o.x - sx) + (o.y - sy) * (o.y - sy) + (o.z - sz) * (o.z - sz));
            if (d < nearest) nearest = d;
            if (d < MIN_SAFE_DISTANCE) tooClose++;
        }
        const distanceTerm = Math.min(nearest, DISTANCE_CAP);
        let score = distanceTerm - tooClose * NEAR_PENALTY - sp.danger * DANGER_WEIGHT;
        if (now - sp.lastUsedAt < RECENT_USE_MS) score -= RECENT_USE_PENALTY;
        if (score > bestScore) {
            bestScore = score;
            best = sp;
        }
    }
    if (best) {
        best.lastUsedAt = now;
        log(`picked spawn ${best.id} (score ${Math.round(bestScore)}, danger ${best.danger})`);
    }
    return best;
}
