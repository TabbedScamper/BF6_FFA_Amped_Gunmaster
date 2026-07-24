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
import { DEBUG_MODE, SPAWN_Y_LIFT, SPAWN_FACING_MODE } from './config.ts';
import { isBenched } from './bench.ts';

// The 32 spawn markers placed in the Godot map (unique PHYSICAL spatial ObjIds).
// Author's map pass finalizes these; 101..132 is the working plan.
export const SPAWN_SPATIAL_IDS: number[] = [
    101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116,
    117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132,
    133, 134, 135,
];

// --- scoring knobs ---
// A big "personal bubble": any player within MIN_SAFE_DISTANCE makes a marker almost unpickable,
// so bots don't spawn in someone's face. (15 was way too small — a bot ~16-25u away in view read
// as "spawned in front of me". 30u forces a real gap; scoring still degrades gracefully — if every
// marker is crowded it just picks the least-bad one.)
const MIN_SAFE_DISTANCE = 42; // enemies inside this make a spawn nearly unpickable (bigger bubble)
// HARD no-spawn bubble: a marker with any player (or fresh spawn) within this radius is NEVER picked —
// UNLESS every marker is that crowded, in which case the least-bad one is used as a last resort.
const SPAWN_EXCLUSION_RADIUS = 20; // metres — nobody spawns within this of a player (last-resort override)
// HARD floor for HUMANS specifically: a bot NEVER materializes within this of a live human, even in
// the last-resort fallback (unlike the 20m all-players bubble, which the fallback ignores when every
// marker is crowded). This is the "a bot spawned right next to me" fix. Bots still crowd each other.
const HUMAN_SAFE_RADIUS = 25;
const NEAR_PENALTY = 1000; // applied per enemy inside MIN_SAFE_DISTANCE
const DISTANCE_CAP = 80; // distance term saturates here (far is far enough)
const DANGER_WEIGHT = 12; // score cost per cached danger point
const DANGER_MAX = 10; // cache ceiling (10*12=120 > distance cap 80, so a hot sightline wins)
const DANGER_DECAY = 0.5; // subtracted per sample when the line is blocked
// PER-SPAWNER COOLDOWN: a spawner just used is unavailable for this long. The picker only reuses a
// still-cooling spawner as a LAST RESORT (when every other human-safe spawner is also on cooldown),
// so bots stop popping out of the same spawner one after another.
const SPAWN_COOLDOWN_MS = 4000;
// Burst-spawn spacing: a just-picked spawn POSITION counts as a threat for this long, so a
// wave of players/bots deploying in the same window (before they register as "alive" for one
// another) never lands on top of each other. Treated exactly like an enemy in the scoring.
const RECENT_SPAWN_MS = 6500; // keep a just-used spawn "hot" longer so bot respawns keep spacing out
interface RecentSpawn { x: number; y: number; z: number; at: number; }
const recentSpawns: RecentSpawn[] = [];
const LOS_SAMPLE_MS = 200; // one cast per sample (well within budget; shares the queue)
const CHEST_OFFSET_Y = 1.4; // aim rays chest-height

// --- spawn FACING ---
// We DON'T use each marker's own rotation for facing: these repurposed FiringRange props are
// tilted so their "forward" points nearly straight UP (horizontal component ~0.1), which yields a
// near-random yaw -> players spawn staring at a wall. Instead every spawn faces the PLAY-AREA
// CENTRE (mean of all markers), so they look inward toward the action. Convention matches the
// game's Euler-Y (== GetObjectRotation.y): yaw = atan2(dx, dz) faces world direction (dx,0,dz).
const SPAWN_YAW_OFFSET = 0;                              // add Math.PI to spin ALL facings 180°
const SPAWN_YAW_OVERRIDE: { [id: number]: number } = {}; // hand-set one marker's facing (radians) by ObjId

interface SpawnPoint {
    id: number;
    pos: mod.Vector;
    yaw: number; // teleport orientation (radians) — faces the play-area centre so no wall-staring
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

/** Read marker positions once (physical spatial objects report real coords).
 *  Each stored Y is raised by SPAWN_Y_LIFT so buried markers still spawn on top. */
export function initSpawns(): number {
    points.length = 0;
    // Pass 1: read every valid (physical) marker's world position + placed heading.
    const raw: { id: number; x: number; y: number; z: number; heading: number }[] = [];
    for (const id of SPAWN_SPATIAL_IDS) {
        try {
            const obj = mod.GetSpatialObject(id);
            const p = mod.GetObjectPosition(obj);
            const rx = mod.XComponentOf(p), ry = mod.YComponentOf(p), rz = mod.ZComponentOf(p);
            // A NON-PHYSICAL object reports ~0,0,0 (known runtime bug). A real marker
            // on this map is hundreds of units from world origin, so a near-origin read
            // means the prop isn't physical — skip it (never teleport to the void).
            if (Math.abs(rx) < 1 && Math.abs(ry) < 1 && Math.abs(rz) < 1) {
                log(`marker ${id} read ~origin (non-physical prop?) — skipping`);
                continue;
            }
            // The marker's placed HEADING. NOTE the Euler slot: the rotation vector's
            // Z component carries the horizontal heading (atan2(front.x, front.z) —
            // matches the SDK simulator's decoder). The old wall-facing bug came from
            // reading Y here. If facing is ever uniformly wrong in-game, this component
            // choice is the knob to revisit (Y vs Z convention).
            let heading = 0;
            try { heading = mod.ZComponentOf(mod.GetObjectRotation(obj)); } catch {}
            raw.push({ id, x: rx, y: ry, z: rz, heading });
        } catch {
            // marker not present on this map — skip
        }
    }
    if (raw.length === 0) { log('no valid spawn markers'); return 0; }
    // Play-area centre = mean of all markers. Every spawn faces TOWARD it (inward), so nobody
    // spawns looking at a perimeter wall. Per-marker override wins; global offset lets you flip 180°.
    let cx = 0, cz = 0;
    for (const r of raw) { cx += r.x; cz += r.z; }
    cx /= raw.length; cz /= raw.length;
    for (const r of raw) {
        // Lift the stored spawn Y so a marker sunk in/under terrain still spawns players cleanly on top.
        const pos = mod.CreateVector(r.x, r.y + SPAWN_Y_LIFT, r.z);
        const ov = SPAWN_YAW_OVERRIDE[r.id];
        const yaw = ov !== undefined ? ov
            : SPAWN_FACING_MODE === 'marker' ? r.heading + SPAWN_YAW_OFFSET // copy the prop's placed rotation
            : Math.atan2(cx - r.x, cz - r.z) + SPAWN_YAW_OFFSET; // face the arena centroid
        points.push({ id: r.id, pos, yaw, danger: 0, lastUsedAt: 0 });
    }
    log(`initialized ${points.length}/${SPAWN_SPATIAL_IDS.length} spawn markers (facing: ${SPAWN_FACING_MODE})`);
    return points.length;
}

export function spawnCount(): number {
    return points.length;
}

/** Marker positions (for the bot director's roam targets). */
export function spawnMarkerPositions(): mod.Vector[] {
    return points.map((p) => p.pos);
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
                const pid = mod.GetObjId(p);
                if (pid === excludeId) continue;
                if (isBenched(pid)) continue; // parked freecam statue — not a spawn threat
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
                        sp.danger = Math.min(DANGER_MAX, sp.danger + 2); // clear sight-lane -> hotter (faster convergence)
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
    // Drop expired burst-spawn markers.
    while (recentSpawns.length > 0 && now - recentSpawns[0].at > RECENT_SPAWN_MS) recentSpawns.shift();

    // HUMANS get a HARD safety floor the fallback still respects: a bot must never materialize on top
    // of a real player. Bots may crowd each other; humans never.
    const humans = others.filter((o) => {
        try { return !mod.GetSoldierState(o.player, mod.SoldierStateBool.IsAISoldier); } catch { return false; }
    });

    let best: SpawnPoint | null = null; // best OUTSIDE the hard exclusion bubble
    let bestScore = -Infinity;
    let bestAny: SpawnPoint | null = null; // best HUMAN-SAFE marker (crowded-with-bots last resort)
    let bestAnyScore = -Infinity;
    let humanSafest: SpawnPoint | null = null; // ultimate fallback: the marker farthest from any human
    let humanSafestDist = -Infinity;
    let bestCooldown: SpawnPoint | null = null; // last resort: best human-safe spawner still on cooldown
    let bestCooldownScore = -Infinity;
    for (const sp of points) {
        const sx = mod.XComponentOf(sp.pos), sy = mod.YComponentOf(sp.pos), sz = mod.ZComponentOf(sp.pos);
        // Nearest HUMAN — drives the hard floor + the ultimate fallback ranking.
        let nearestHuman = Infinity;
        for (const h of humans) {
            const d = Math.sqrt((h.x - sx) * (h.x - sx) + (h.y - sy) * (h.y - sy) + (h.z - sz) * (h.z - sz));
            if (d < nearestHuman) nearestHuman = d;
        }
        if (nearestHuman > humanSafestDist) { humanSafestDist = nearestHuman; humanSafest = sp; }
        if (nearestHuman < HUMAN_SAFE_RADIUS) continue; // never spawn on a real player, even last-resort
        let nearest = Infinity;
        let tooClose = 0;
        for (const o of others) {
            const d = Math.sqrt((o.x - sx) * (o.x - sx) + (o.y - sy) * (o.y - sy) + (o.z - sz) * (o.z - sz));
            if (d < nearest) nearest = d;
            if (d < MIN_SAFE_DISTANCE) tooClose++;
        }
        // Recently-picked spawn spots count as threats too — this is what actually spaces out a
        // simultaneous wave (they aren't "alive" yet, so `others` alone can't see them).
        for (const r of recentSpawns) {
            const d = Math.sqrt((r.x - sx) * (r.x - sx) + (r.y - sy) * (r.y - sy) + (r.z - sz) * (r.z - sz));
            if (d < nearest) nearest = d;
            if (d < MIN_SAFE_DISTANCE) tooClose++;
        }
        const distanceTerm = Math.min(nearest, DISTANCE_CAP);
        const score = distanceTerm - tooClose * NEAR_PENALTY - sp.danger * DANGER_WEIGHT;
        // COOLDOWN: a spawner used within SPAWN_COOLDOWN_MS only feeds the LAST-RESORT pool; fresh
        // spawners are the normal candidates. This is what stops same-spawner-in-a-row.
        if (now - sp.lastUsedAt < SPAWN_COOLDOWN_MS) {
            if (score > bestCooldownScore) { bestCooldownScore = score; bestCooldown = sp; }
            continue;
        }
        // Track the best-of-all (cooldown-free) as the crowded-with-bots last resort.
        if (score > bestAnyScore) { bestAnyScore = score; bestAny = sp; }
        // HARD 20m bubble: only eligible if nothing is within SPAWN_EXCLUSION_RADIUS of this marker.
        if (nearest >= SPAWN_EXCLUSION_RADIUS && score > bestScore) { bestScore = score; best = sp; }
    }
    // Priority: (1) FRESH spawner clear of the 20m bubble, (2) any FRESH human-safe spawner,
    // (3) LAST RESORT a still-cooling human-safe spawner, (4) if the whole map is within HUMAN_SAFE
    // of a human, the marker farthest from any human.
    const chosen = best ?? bestAny ?? bestCooldown ?? humanSafest;
    if (chosen) {
        chosen.lastUsedAt = now;
        recentSpawns.push({ x: mod.XComponentOf(chosen.pos), y: mod.YComponentOf(chosen.pos), z: mod.ZComponentOf(chosen.pos), at: now });
        log(`picked spawn ${chosen.id} (score ${Math.round(best ? bestScore : bestAnyScore)}, danger ${chosen.danger}${best ? '' : ' [LAST-RESORT: within ' + SPAWN_EXCLUSION_RADIUS + 'm]'})`);
    }
    return chosen;
}
