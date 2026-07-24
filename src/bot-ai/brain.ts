/**
 * Bot Brain - Coordinates memory, sensors, and behaviors
 * Based on bf6-portal-bots-brain Brain pattern
 */

import { BotMemory } from './memory.ts';
import { BotBehaviorSelector, DEFAULT_WEIGHTS } from './behaviors.ts';
import type { BehaviorKind } from './behaviors.ts';
import { aiCombatFlags, aiSetTargetCached } from './ai-flags.ts';
import {
    SENSOR_CONFIG,
    senseEnemy,
    senseRoamPosition,
    senseArrival,
    onBotDamaged,
    onBotFiring,
    senseFlagSituation,
} from './sensors.ts';

// ========== DEBUG LOGGING ==========
const DEBUG_BRAIN = false;
let _brainTickCount = 0;
let _enemySenseAttempts = 0;
let _enemySenseHits = 0;
let _roamSenseAttempts = 0;
let _roamSenseHits = 0;
let _lastBrainLogTime = Date.now();

function logBrain(msg: string, ...args: any[]): void {
    if (DEBUG_BRAIN) console.log(`[BotBrain] ${msg}`, ...args);
}

export function logBrainStats(): void {
    const elapsed = (Date.now() - _lastBrainLogTime) / 1000;
    logBrain(`BRAIN STATS (${elapsed.toFixed(1)}s):`, {
        ticks: _brainTickCount,
        enemySense: `${_enemySenseHits}/${_enemySenseAttempts}`,
        roamSense: `${_roamSenseHits}/${_roamSenseAttempts}`,
    });
    // Reset counters
    _brainTickCount = 0;
    _enemySenseAttempts = 0;
    _enemySenseHits = 0;
    _roamSenseAttempts = 0;
    _roamSenseHits = 0;
    _lastBrainLogTime = Date.now();
}
// ===================================

/**
 * BotBrain
 *
 * Pure AI logic unit that coordinates:
 * - Memory (TTL-based forgetting)
 * - Sensors (enemy detection, roaming, arrival)
 * - Behavior selection (weight-based priority)
 *
 * Does NOT handle player lifecycle - that's done externally.
 */
// Spawn protection: a freshly-spawned bot cannot target or shoot for this long. A new
// brain is created per spawn (keyed by the fresh engine player id), so setting the window
// in the constructor gives every spawn a clean grace period. Tune here (2000-3000ms).
const SPAWN_GRACE_MS = 2500;

// Reaction delay before a bot FIRES BACK at whoever just shot it. It still snaps its aim
// onto the attacker instantly (so it turns to face them), but holds the trigger for this
// long — otherwise bots return fire with inhuman zero-latency. Keep short (200-400ms).
const RETALIATE_REACTION_MS = 300;

export class BotBrain {
    public player: mod.Player;
    public memory: BotMemory;
    private behaviorSelector: BotBehaviorSelector;
    private spawnGraceUntil: number = Date.now() + SPAWN_GRACE_MS; // no targeting/fire until then
    private retaliateFireAt: number = 0; // earliest time this bot may fire BACK at a shooter

    // Sensor timing
    private lastEnemySenseTime: number = 0;
    private lastRoamSenseTime: number = 0;
    private stuckCheckAt: number = 0;
    private stuckPos: mod.Vector | null = null;
    private lastFlagSenseTime: number = 0;
    private nextMoveFlavor: number = 0;

    // External references
    private flagPosGetter: (() => mod.Vector | null) | null = null;
    private flagUrgencyGetter: (() => number) | null = null;
    private spawnPositionsGetter: (() => mod.Vector[]) | null = null;

    // Flag state
    private flagActive: boolean = false;

    constructor(player: mod.Player) {
        this.player = player;
        this.memory = new BotMemory();
        this.behaviorSelector = new BotBehaviorSelector(DEFAULT_WEIGHTS);
    }

    /**
     * Set function to get current flag position (null when no flag)
     */
    setFlagPosGetter(getter: () => mod.Vector | null): void {
        this.flagPosGetter = getter;
    }

    /**
     * Set function to get flag urgency (0-1, how urgent is capture)
     */
    setFlagUrgencyGetter(getter: () => number): void {
        this.flagUrgencyGetter = getter;
    }

    /**
     * Set function to get spawn positions (for roaming waypoints)
     */
    setSpawnPositionsGetter(getter: () => mod.Vector[]): void {
        this.spawnPositionsGetter = getter;
    }

    /**
     * Notify brain that flag has spawned (overtime started)
     */
    notifyFlagSpawned(): void {
        this.flagActive = true;
        logBrain(`Bot ${mod.GetObjId(this.player)} notified of flag spawn`);
    }

    /**
     * Notify brain that flag is gone (round ended or captured)
     */
    notifyFlagGone(): void {
        this.flagActive = false;
        this.memory.clear('flagPos');
        this.memory.clear('shouldPushFlag');
        this.memory.clear('enemyOnFlag');
        this.memory.clear('flagUrgency');
    }

    /**
     * Set push target for initial forward movement
     * Called at round start to make bots push toward enemies
     */
    setPushTarget(target: mod.Vector): void {
        // Push target lasts 8 seconds - enough time to reach mid-map
        this.memory.set('pushTarget', target, 8000);
        this.memory.set('shouldSprint', true, 8000);
        logBrain(`Bot ${mod.GetObjId(this.player)} set push target`);
    }

    /**
     * Clear push target (called when transitioning to normal behavior)
     */
    clearPushTarget(): void {
        this.memory.clear('pushTarget');
        this.memory.clear('shouldSprint');
    }

    /**
     * Reset brain state (call on death/respawn)
     */
    reset(): void {
        this.memory.clearAll();
        this.behaviorSelector.reset();
        this.lastEnemySenseTime = 0;
        this.lastRoamSenseTime = 0;
        this.lastFlagSenseTime = 0;
        // Note: don't reset flagActive - flag persists across respawns

        // Clear target
        if (mod.IsPlayerValid(this.player)) {
            aiSetTargetCached(this.player, undefined, true); // force: respawn transition must land
        }
    }

    /**
     * Handle damage event - triggers battle state
     */
    onDamaged(attacker: mod.Player, attackerPos?: mod.Vector): void {
        onBotDamaged(this.memory, attackerPos);
        // Only arm the reaction delay on the FIRST hit of a retaliation (when we weren't
        // already locked onto a shooter) — so continuous incoming fire can't keep pushing
        // our return fire back, but a fresh ambush still gets the human-like delay.
        const wasRetaliating = this.memory.get('retaliate') !== undefined;
        // Trigger-happy: remember WHO shot us and lock onto them for a few seconds so the normal
        // "closest visible" sensor can't pull us off the guy actually shooting.
        this.memory.set('retaliate', attacker, 3000);
        if (!wasRetaliating) this.retaliateFireAt = Date.now() + RETALIATE_REACTION_MS;
    }

    /**
     * Handle firing event - triggers battle state
     */
    onFiring(): void {
        onBotFiring(this.memory);
    }

    /**
     * Main tick - sense, think, act
     */
    tick(): void {
        _brainTickCount++;

        if (!mod.IsPlayerValid(this.player)) return;
        if (!mod.GetSoldierState(this.player, mod.SoldierStateBool.IsAlive)) return;

        // Prune expired memory entries
        this.memory.prune();

        const now = Date.now();

        // Run sensors at their configured rates
        // Flag sensor runs first and fast (highest priority in overtime)
        if (this.flagActive) {
            this.runFlagSensor(now);
        }

        this.runEnemySensor(now);
        this.runRoamSensor(now);
        this.runArrivalSensor();
        this.runStuckSensor(now);

        // Select and execute behavior
        this.behaviorSelector.update(this.player, this.memory);

        // Human-feel movement variety on top of the behavior.
        this.humanize(now);
    }

    // Random sprint / strafe / (rare) crouch / (very rare) prone so bots move like players.
    // Sprint is used only OUT of combat (sprinting AI are known to stop engaging).
    private humanize(now: number): void {
        if (now < this.nextMoveFlavor) return;
        this.nextMoveFlavor = now + 2200 + Math.random() * 2600; // re-roll every ~2.2-4.8s per bot
        const inCombat = this.memory.has('visibleEnemy') || this.memory.has('isInBattle');
        const r = Math.random();
        try {
            if (inCombat) {
                // In a fight: juke side-to-side; occasionally crouch; very rarely go prone.
                if (r < 0.62) mod.SetAiInput(this.player, mod.AiInput.Strafe, 0.4 + Math.random() * 0.5);
                else if (r < 0.72) mod.SetAiInput(this.player, mod.AiInput.Crouch, 0.8); // ~10% crouch
                else if (r < 0.74) mod.SetAiInput(this.player, mod.AiInput.Prone, 1.2); // ~2% prone
                // else: just keep fighting
            } else {
                // Repositioning: SPRINT-heavy (75% — bots should hustle around the map),
                // with the occasional slide (sprint -> crouch) and rare crouch-peek.
                if (r < 0.75) mod.SetAiInput(this.player, mod.AiInput.Sprint, 0.9 + Math.random());
                else if (r < 0.85) {
                    mod.SetAiInput(this.player, mod.AiInput.Sprint, 0.5);
                    mod.SetAiInput(this.player, mod.AiInput.Crouch, 0.5); // slide-ish transition
                } else if (r < 0.9) mod.SetAiInput(this.player, mod.AiInput.Crouch, 0.6); // ~5% crouch
            }
        } catch {}
    }

    /**
     * Enemy detection sensor - AGGRESSIVE: instant targeting and shooting
     */
    private runEnemySensor(now: number): void {
        // SPAWN PROTECTION: for the first SPAWN_GRACE_MS after (re)spawn, the bot may not
        // target or shoot (they were far too lethal the instant they appeared). Keep
        // targeting/shooting hard-off and hold no target until the window passes.
        if (now < this.spawnGraceUntil) {
            aiSetTargetCached(this.player); // drop any target (cached — no per-tick spam)
            aiCombatFlags(this.player, false, false);
            this.memory.clear('retaliate'); // don't lock onto a shooter during grace either
            return;
        }
        if (now - this.lastEnemySenseTime < SENSOR_CONFIG.ENEMY_SENSOR_RATE) return;
        this.lastEnemySenseTime = now;

        // TRIGGER-HAPPY: if we were shot recently, stay locked on the shooter and keep firing,
        // even if a different enemy is technically closer. Overrides normal target selection.
        const retal = this.memory.get('retaliate');
        if (retal) {
            try {
                if (mod.IsPlayerValid(retal) && mod.GetSoldierState(retal, mod.SoldierStateBool.IsAlive)) {
                    // Snap aim onto the attacker immediately, but hold fire until the short
                    // reaction delay (set in onDamaged) elapses — no zero-latency return fire.
                    aiSetTargetCached(this.player, retal);
                    aiCombatFlags(this.player, now >= this.retaliateFireAt, true);
                    if (now >= this.retaliateFireAt) mod.AIForceFire(this.player, 0.6);
                    // Feed the shooter into visibleEnemy so the battlefield behavior
                    // PURSUES them — without this, a retaliating bot aimed+fired but
                    // never moved (visibleEnemy expired while this branch early-returns).
                    this.memory.set('visibleEnemy', retal, SENSOR_CONFIG.VISIBLE_ENEMY_TTL);
                    return;
                }
            } catch {}
            this.memory.clear('retaliate'); // dead / invalid -> stop chasing it
        }

        _enemySenseAttempts++;
        const enemy = senseEnemy(this.player, this.memory);
        if (enemy) {
            _enemySenseHits++;

            // Clear push target when enemy spotted - engage instead of pushing
            if (this.memory.has('pushTarget')) {
                this.memory.clear('pushTarget');
                this.memory.clear('shouldSprint');
            }

            // AGGRESSIVE: Immediately set target and ensure shooting is enabled
            try {
                aiSetTargetCached(this.player, enemy);
                aiCombatFlags(this.player, true, true);
                // Stop sprinting - use run speed for combat
                mod.AISetMoveSpeed(this.player, mod.MoveSpeed.Run);
                // Reliably fire at a visible target: snap-shoot on acquisition, and keep the
                // trigger warm (~every 0.9s) while it stays in engagement range, so a bot never
                // just stands there staring at someone right in front of it.
                const eid = mod.GetObjId(enemy);
                const newTarget = this.memory.get('curTargetId') !== eid;
                let dist = 0;
                try {
                    dist = mod.DistanceBetween(
                        mod.GetSoldierState(this.player, mod.SoldierStateVector.GetPosition),
                        mod.GetSoldierState(enemy, mod.SoldierStateVector.GetPosition)
                    );
                } catch {}
                const lastFF = this.memory.get('lastForceFire') ?? 0;
                if (dist < 30 && (newTarget || now - lastFF > 900)) {
                    mod.AIForceFire(this.player, 0.7);
                    this.memory.set('lastForceFire', now, 5000);
                }
                if (newTarget) this.memory.set('curTargetId', eid, 4000);
            } catch {}
        }
    }

    /**
     * Roam point sensor (direction-driven patrol)
     */
    private runRoamSensor(now: number): void {
        // Don't roam if in battle
        if (this.memory.has('isInBattle')) return;
        if (this.memory.has('lastKnownEnemyPos')) return;

        if (now - this.lastRoamSenseTime < SENSOR_CONFIG.ROAM_SENSOR_RATE) return;
        this.lastRoamSenseTime = now;

        _roamSenseAttempts++;

        const flagPos = this.flagPosGetter?.() ?? null;
        const spawnPositions = this.spawnPositionsGetter?.() ?? [];

        const roamPos = senseRoamPosition(this.player, this.memory, flagPos, spawnPositions);
        if (roamPos) {
            _roamSenseHits++;
        }
    }

    /**
     * Arrival detection sensor
     */
    private runArrivalSensor(): void {
        senseArrival(this.player, this.memory);
    }

    /**
     * STUCK WATCHDOG — the "bots just stand in place" killer. A MoveTo can fail or
     * dead-end silently (unreachable/blocked navmesh point, engine gives up) and the
     * behavior skip-guards then suppress any re-issue while roamPos blocks a new roll
     * for its full 15s TTL. Detection: barely moved over the last ~2.5s with nobody
     * to shoot -> whatever the plan was, it failed. Wipe ALL movement intent + reset
     * the selector's caches + force an immediate roam re-roll, so the bot has a fresh
     * destination within one tick instead of statue-ing out the TTLs.
     */
    private runStuckSensor(now: number): void {
        if (now < this.stuckCheckAt) return;
        this.stuckCheckAt = now + 2500;
        try {
            const pos = mod.GetSoldierState(this.player, mod.SoldierStateVector.GetPosition);
            const prev = this.stuckPos;
            this.stuckPos = pos;
            if (!prev) return;
            if (mod.DistanceBetween(prev, pos) > 1.5) return; // moving fine (pursuing/roaming) — not stuck

            // MOTIONLESS. If we still have a target we're almost certainly JAMMED against geometry — a
            // MoveTo to a spot behind a wall (incl. locked on ANOTHER bot through it via the close-range
            // LOS false-clear) stops at the wall and the bot freezes facing it. This used to be SKIPPED
            // for "has a visible enemy", which is exactly why those bots statue up. Don't abandon the
            // fight: SHOVE off the wall (back up + sideways) — that un-jams AND moves far enough that the
            // LOS ray stops seeing through the wall, so we can re-path around or drop the phantom target.
            const hasTarget =
                this.memory.has('visibleEnemy') || this.memory.has('lastKnownEnemyPos') || this.memory.has('isInBattle');
            if (hasTarget) {
                const facing = mod.GetSoldierState(this.player, mod.SoldierStateVector.GetFacingDirection);
                const fx = mod.XComponentOf(facing), fz = mod.ZComponentOf(facing);
                const side = Math.random() < 0.5 ? 1 : -1;
                // back off along -facing (6m) + a perpendicular slide (perp of (fx,fz) = (-fz,fx), 4m)
                const dest = mod.CreateVector(
                    mod.XComponentOf(pos) - fx * 6 + -fz * side * 4,
                    mod.YComponentOf(pos),
                    mod.ZComponentOf(pos) - fz * 6 + fx * side * 4
                );
                this.behaviorSelector.forceReposition(dest, 1200); // ~1.2s shove, overrides pursuit
                return; // keep the target — just un-jam off the wall
            }

            // No target — the old idle-stuck recovery: wipe movement intent + force a fresh roam.
            this.memory.clear('roamPos');
            this.memory.clear('searchPos');
            this.memory.clear('pushTarget');
            this.lastRoamSenseTime = 0; // next tick rolls a fresh roam point
            this.behaviorSelector.resetMovement(); // and the MoveTo actually re-issues
        } catch {}
    }

    /**
     * Flag situation sensor - evaluates flag priority and updates memory
     */
    private runFlagSensor(now: number): void {
        if (now - this.lastFlagSenseTime < SENSOR_CONFIG.FLAG_SENSOR_RATE) return;
        this.lastFlagSenseTime = now;

        const flagPos = this.flagPosGetter?.() ?? null;
        const urgency = this.flagUrgencyGetter?.() ?? SENSOR_CONFIG.FLAG_URGENCY_BASE;

        // Update flag situation in memory
        senseFlagSituation(this.player, this.memory, flagPos, urgency);
    }

    /**
     * Get current behavior for debugging
     */
    getCurrentBehavior(): BehaviorKind | null {
        return this.behaviorSelector.getCurrent();
    }

    /**
     * Check if bot is in battle state
     */
    isInBattle(): boolean {
        return this.memory.has('isInBattle');
    }

    /**
     * Check if bot has visible enemy
     */
    hasVisibleEnemy(): boolean {
        return this.memory.has('visibleEnemy');
    }

    /**
     * Get last known enemy position
     */
    getLastKnownEnemyPos(): mod.Vector | null {
        return this.memory.get('lastKnownEnemyPos');
    }
}

// ========== BOT BRAIN MANAGER ==========

/**
 * Global registry of bot brains by player ID
 */
const botBrains: Map<number, BotBrain> = new Map();

/**
 * Get or create a brain for a bot player
 */
export function getBotBrain(player: mod.Player): BotBrain {
    const playerId = mod.GetObjId(player);
    let brain = botBrains.get(playerId);

    if (!brain) {
        brain = new BotBrain(player);
        botBrains.set(playerId, brain);
        logBrain(`Created brain for bot ${playerId}`);
    }

    return brain;
}

/**
 * Remove brain for a player (call on bot removal)
 */
export function removeBotBrain(player: mod.Player): void {
    const playerId = mod.GetObjId(player);
    if (botBrains.delete(playerId)) {
        logBrain(`Removed brain for bot ${playerId}`);
    }
}

/**
 * Remove brain by raw player id — for cleanup AFTER the engine player is already
 * gone (a dead bot's body may be unresolvable, which leaked stale brains).
 */
export function removeBotBrainById(playerId: number): void {
    if (botBrains.delete(playerId)) {
        logBrain(`Removed brain for departed bot ${playerId}`);
    }
}

/**
 * Reset brain for a player (call on respawn)
 */
export function resetBotBrain(player: mod.Player): void {
    const brain = botBrains.get(mod.GetObjId(player));
    if (brain) {
        brain.reset();
        logBrain(`Reset brain for bot ${mod.GetObjId(player)}`);
    }
}

/**
 * Clear all bot brains
 */
export function clearAllBotBrains(): void {
    botBrains.clear();
    logBrain('Cleared all bot brains');
}

/**
 * Get count of active bot brains
 */
export function getBotBrainCount(): number {
    return botBrains.size;
}

/**
 * Tick all bot brains (call from main loop)
 */
export function tickAllBotBrains(): void {
    for (const brain of botBrains.values()) {
        try {
            brain.tick();
        } catch {}
    }
}
