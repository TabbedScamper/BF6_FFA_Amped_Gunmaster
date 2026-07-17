// ============================================================================
// FFA GUNMASTER — SPAWN SELECTION (anti-spawn-kill)
// ============================================================================
// Arenas = the Deadlock maps with 32 uniquely-ID'd spawn markers placed as
// PHYSICAL spatial props (0,0,0 bug: GetObjectPosition returns ~0,0,0 on
// spawners/non-physical objects — consensus-unfixed; markers must be physical).
// A spawn is picked by SCORE:
//
//   score = distance-to-nearest-enemy term   (math, at pick time)
//         - LOS danger                        (rolling raycast cache, below)
//         - recently-used penalty             (LRU — don't reuse hot spawns)
//
// LINE-OF-SIGHT: a sniper across the map can see a spawn without being near it.
// Community-confirmed raycast rules (Discord, corpus): RayCast is async with no
// ray id, FIFO-matched; naive per-tick casts are costly + hard to attribute; the
// pattern is per-PLAYER attribution + a shared FIFO queue + cap in-flight +
// distance-scale. So we do NOT hand-roll raw casts here — we go through the
// bf6-portal-utils `Raycast` module (per-player queue + onHit/onMiss
// attribution), the SAME queue the amped-weapon FX will use. One sampler cast
// per LOS_SAMPLE_MS round-robins the markers: marker -> nearest player's chest.
// onMiss (clear line) => a sight-lane exists => danger up; onHit (blocked) =>
// decay. At pick time danger is just a cached number (zero spawn-time casts).
// ============================================================================

import { Timers } from 'bf6-portal-utils/timers/index.ts';
import { Raycast } from 'bf6-portal-utils/raycast/index.ts';
import { DEBUG_MODE } from './config.ts';

// The 32 spawn markers placed in the Godot map (unique PHYSICAL spatial ObjIds).
// Author's map pass finalizes these; 101..132 is the working plan.
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
const LOS_SAMPLE_MS = 200; // one cast per sample (well within budget; shares the queue)
const CHEST_OFFSET_Y = 1.4; // aim rays chest-height

interface SpawnPoint {
    id: number;
    pos: mod.Vector;
    danger: number; // rolling LOS danger cache
    lastUsedAt: number; // Date.now() of last spawn here
}

interface AlivePlayer {
    player: mod.Player;
    x: number;
    y: number;
    z: number;
}

const points: SpawnPoint[] = [];
let sampleIndex = 0;
let samplerInterval: number | null = null;

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Spawns] ${msg}`);
}

/** Read marker positions once (physical spatial objects report real coords). */
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

function alivePlayers(excludeId: number): AlivePlayer[] {
    const out: AlivePlayer[] = [];
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
                out.push({ player: p, x: mod.XComponentOf(pos), y: mod.YComponentOf(pos), z: mod.ZComponentOf(pos) });
            } catch {}
        }
    } catch {}
    return out;
}

// ---------------------------------------------------------------------------
// Rolling LOS sampler: one cast per LOS_SAMPLE_MS from spawn[i] to the nearest
// alive player's chest, via the shared Raycast module (per-player FIFO queue).
// The result closure captures its own spawn point, so multiple in-flight casts
// attribute correctly — no single-outstanding-cast assumption.
// ---------------------------------------------------------------------------
export function startLosSampler(): void {
    if (samplerInterval !== null) return;
    samplerInterval = Timers.setInterval(() => {
        try {
            if (points.length === 0) return;
            const sp = points[sampleIndex % points.length];
            sampleIndex++;
            const others = alivePlayers(-1);
            if (others.length === 0) return;

            const sx = mod.XComponentOf(sp.pos), sy = mod.YComponentOf(sp.pos), sz = mod.ZComponentOf(sp.pos);
            let best = others[0], bd = Infinity;
            for (const o of others) {
                const d = (o.x - sx) * (o.x - sx) + (o.y - sy) * (o.y - sy) + (o.z - sz) * (o.z - sz);
                if (d < bd) { bd = d; best = o; }
            }

            // Attribute the cast to the watcher; capture `sp` in the callbacks.
            Raycast.cast(
                best.player,
                mod.CreateVector(sx, sy + CHEST_OFFSET_Y, sz),
                mod.CreateVector(best.x, best.y + CHEST_OFFSET_Y, best.z),
                {
                    onHit: () => {
                        sp.danger = Math.max(0, sp.danger - DANGER_DECAY); // blocked -> safer
                    },
                    onMiss: () => {
                        sp.danger = Math.min(DANGER_MAX, sp.danger + 1); // clear sight-lane -> hotter
                    },
                }
            );
        } catch {}
    }, LOS_SAMPLE_MS);
}

export function stopLosSampler(): void {
    if (samplerInterval !== null) {
        Timers.clearInterval(samplerInterval);
        samplerInterval = null;
    }
}

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
