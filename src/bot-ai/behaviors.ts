/**
 * Bot Behavior System - Weight-based behavior selection
 * Based on bf6-portal-bots-brain BehaviorSelector pattern
 */

import { BotMemory } from './memory.ts';
import type { BotMemoryFields } from './memory.ts';
import { SENSOR_CONFIG } from './sensors.ts';
import { aiCombatFlags, aiSetTargetCached } from './ai-flags.ts';

// ========== CONFIGURATION ==========
export const BEHAVIOR_CONFIG = {
    // Position comparison threshold (avoid redundant commands)
    POS_EPSILON: 0.5,

    // Defend position radii
    DEFEND_MIN_RADIUS: 2.0,
    DEFEND_MAX_RADIUS: 8.0,

    // Push forward settings
    PUSH_ARRIVAL_DIST: 3.0, // Distance to consider "arrived" at push target
};

// Behavior weights (higher = higher priority)
// Note: Flag weights are DYNAMIC - they increase based on urgency and situation
export const DEFAULT_WEIGHTS: Partial<Record<keyof BotMemoryFields, number>> = {
    enemyOnFlag: 150, // CRITICAL: Enemy capturing = drop everything
    visibleEnemy: 100, // Highest: actively engage visible enemy
    shouldPushFlag: 90, // Very high: push flag when decided
    isInBattle: 80, // High: battlefield behavior when in combat
    pushTarget: 70, // High: push forward at round start (before roam)
    lastKnownEnemyPos: 60, // Medium: search last known position
    searchPos: 50, // Medium-low: search around area
    flagPos: 40, // Medium-low: move toward flag area
    roamPos: 30, // Low: patrol to roam point
    arrivedAtDest: 10, // Lowest: defend when arrived
};

export type BehaviorKind = 'battlefield' | 'defend' | 'moveto' | 'search' | 'flagpush' | 'flagengage' | 'push' | 'reposition';

/**
 * Maps memory keys to behavior types
 */
function getBehaviorForKey(key: keyof BotMemoryFields): BehaviorKind | null {
    switch (key) {
        // Flag behaviors - highest priority
        case 'enemyOnFlag':
            return 'flagengage'; // Rush to flag AND fight

        case 'shouldPushFlag':
            return 'flagpush'; // Push to flag with combat awareness

        // Combat behaviors
        case 'visibleEnemy':
        case 'isInBattle':
            return 'battlefield';

        // Push forward at round start
        case 'pushTarget':
            return 'push';

        case 'arrivedAtDest':
            return 'defend';

        case 'lastKnownEnemyPos':
        case 'searchPos':
            return 'search';

        // Movement behaviors
        case 'flagPos':
            return 'flagpush'; // General flag awareness

        case 'roamPos':
            return 'moveto';

        default:
            return null;
    }
}

/**
 * BotBehaviorSelector
 *
 * Selects and executes the appropriate behavior based on memory state.
 * Uses weight-based priority to determine which behavior to run.
 */
export class BotBehaviorSelector {
    private weights: Partial<Record<keyof BotMemoryFields, number>>;
    private currentBehavior: BehaviorKind | null = null;
    private lastMoveToPos: mod.Vector | null = null;
    private lastDefendPos: mod.Vector | null = null;
    private lastSearchPos: mod.Vector | null = null;
    private lastFlagPos: mod.Vector | null = null;
    private lastPushPos: mod.Vector | null = null;
    private lastPursuitAt: number = 0; // last time we re-fed the pursuit move-to
    // Reposition override: the stuck watchdog briefly forces a jammed bot to shove off a wall, beating
    // normal pursuit so it doesn't instantly re-issue a MoveTo back into the wall. Ends on arrival/timeout.
    private repositionPos: mod.Vector | null = null;
    private repositionUntil: number = 0;

    constructor(weights: Partial<Record<keyof BotMemoryFields, number>> = DEFAULT_WEIGHTS) {
        this.weights = weights;
    }

    /**
     * Update weights at runtime
     */
    setWeights(weights: Partial<Record<keyof BotMemoryFields, number>>): void {
        this.weights = weights;
    }

    /**
     * Reset state (call on bot death/respawn)
     */
    reset(): void {
        this.currentBehavior = null;
        this.lastMoveToPos = null;
        this.lastDefendPos = null;
        this.lastSearchPos = null;
        this.lastFlagPos = null;
        this.lastPushPos = null;
        this.repositionPos = null;
    }

    /**
     * Select and execute the best behavior for this tick
     */
    update(player: mod.Player, memory: BotMemory): void {
        if (!mod.IsPlayerValid(player)) return;
        if (!mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive)) return;

        // REPOSITION OVERRIDE: briefly forced by the stuck watchdog to shove a jammed bot off a wall.
        // Beats normal target-selection so the bot actually un-jams instead of the battlefield behavior
        // instantly re-issuing a MoveTo straight back into the wall. Ends on arrival or timeout.
        if (this.repositionPos && Date.now() < this.repositionUntil) {
            try {
                const bp = mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
                if (mod.DistanceBetween(bp, this.repositionPos) < 3) {
                    this.repositionPos = null; // arrived — hand back to normal behavior
                } else {
                    if (this.currentBehavior !== 'reposition') {
                        mod.AISetMoveSpeed(player, mod.MoveSpeed.Run);
                        mod.AIValidatedMoveToBehavior(player, this.repositionPos);
                        this.currentBehavior = 'reposition';
                    }
                    return;
                }
            } catch { this.repositionPos = null; }
        } else if (this.repositionPos) {
            this.repositionPos = null; // window elapsed
        }

        // Find highest-weight memory key that is currently set
        const winnerKey = this.getWinnerKey(memory);
        if (!winnerKey) return;

        const behavior = getBehaviorForKey(winnerKey);
        if (!behavior) return;

        this.executeBehavior(player, memory, behavior, winnerKey);
    }

    /**
     * Find the highest-weight memory key that is currently set
     */
    private getWinnerKey(memory: BotMemory): keyof BotMemoryFields | null {
        let bestKey: keyof BotMemoryFields | null = null;
        let bestScore = -Infinity;

        for (const key of Object.keys(this.weights) as Array<keyof BotMemoryFields>) {
            if (!memory.has(key)) continue;

            const score = this.weights[key] ?? 0;
            if (score > bestScore) {
                bestScore = score;
                bestKey = key;
            }
        }

        return bestKey;
    }

    /** Forget cached movement so the next tick RE-ISSUES its MoveTo — the skip-guards
     *  (lastMoveToPos/lastSearchPos ≈ target -> return) otherwise suppress the re-issue
     *  forever after a failed/blocked path. Called by the brain's stuck watchdog. */
    resetMovement(): void {
        this.currentBehavior = null;
        this.lastMoveToPos = null;
        this.lastSearchPos = null;
        this.lastDefendPos = null;
    }

    /** Stuck-watchdog hook: shove a jammed bot toward `pos` for `durationMs`, overriding pursuit so it
     *  un-jams off a wall (and moves far enough the LOS ray stops false-clearing through it). */
    forceReposition(pos: mod.Vector, durationMs: number): void {
        this.repositionPos = pos;
        this.repositionUntil = Date.now() + durationMs;
        this.currentBehavior = null;
        this.lastMoveToPos = null;
        this.lastSearchPos = null;
        this.lastDefendPos = null;
    }

    /**
     * Execute the selected behavior
     */
    private executeBehavior(
        player: mod.Player,
        memory: BotMemory,
        behavior: BehaviorKind,
        memoryKey: keyof BotMemoryFields
    ): void {
        switch (behavior) {
            case 'flagengage':
                this.executeFlagEngage(player, memory);
                break;

            case 'flagpush':
                this.executeFlagPush(player, memory);
                break;

            case 'battlefield':
                this.executeBattlefield(player, memory);
                break;

            case 'push':
                this.executePush(player, memory);
                break;

            case 'defend':
                this.executeDefend(player, memory);
                break;

            case 'search':
                this.executeSearch(player, memory, memoryKey);
                break;

            case 'moveto':
                this.executeMoveTo(player, memory);
                break;
        }
    }

    /**
     * Battlefield behavior - AGGRESSIVE engagement
     * Always re-target visible enemies and ensure shooting is enabled
     */
    private executeBattlefield(player: mod.Player, memory: BotMemory): void {
        // FFA has NO objectives, so AIBattlefieldBehavior (objective-driven) makes bots
        // idle AND clears AISetTarget. Instead: aim + fire at the enemy and PURSUE them
        // with a validated move-to (re-issued only when they move, per the corpus's
        // "don't re-path every frame" rule).
        const visibleEnemy = memory.get('visibleEnemy');
        if (!visibleEnemy) {
            // LOST SIGHT (the visibleEnemy TTL lapsed with no fresh LOS). Don't freeze in
            // 'battlefield' with no target: if we still remember WHERE we last saw them, CHASE
            // that spot; once we arrive (executeSearch clears lastKnownEnemyPos) or the trail goes
            // cold, drop the battle flag so we resume roaming instead of statue-ing out the TTL.
            // Fully INTERRUPTIBLE — the instant we re-spot ANY enemy senseEnemy re-sets
            // visibleEnemy (weight 100 > isInBattle 80), and a hit arms the retaliate lock; either
            // yanks us straight back into the fight next tick.
            if (memory.has('lastKnownEnemyPos')) {
                this.executeSearch(player, memory, 'lastKnownEnemyPos');
            } else {
                memory.clear('isInBattle');
            }
            return;
        }
        let gone = false;
        try {
            gone = !mod.IsPlayerValid(visibleEnemy) || !mod.GetSoldierState(visibleEnemy, mod.SoldierStateBool.IsAlive);
        } catch { gone = true; }
        if (gone) {
            // Enemy DEAD or left: drop the WHOLE battle state NOW. Leaving isInBattle up
            // blocked the roam sensor for its full 8s TTL (and lastKnownEnemyPos for 10s),
            // so a bot that just WON a fight stood frozen on the spot — the reported
            // "bots sometimes just stand in place". Clearing lets roam resume next tick.
            memory.clear('visibleEnemy');
            memory.clear('isInBattle');
            memory.clear('lastKnownEnemyPos');
            return;
        }
        try {
            // AISetTarget TRACKS the live soldier — bot-vs-bot kills were confirmed
            // working with this alone. (AISetFocusPoint was tried and REVERTED: it
            // locks aim to a stale fixed point, so bots blazed away at empty air and
            // "shot each other without hurting each other".)
            aiSetTargetCached(player, visibleEnemy);
            aiCombatFlags(player, true, true);
        } catch {}
        try {
            const enemyPos = mod.GetSoldierState(visibleEnemy, mod.SoldierStateVector.GetPosition);
            const now = Date.now();
            const targetMoved = !this.lastMoveToPos || mod.DistanceBetween(this.lastMoveToPos, enemyPos) > 2.0;
            // Corpus rule: RE-FEED the target's current position on a cadence — a
            // single move-to goes stale (bot arrives / path ends) and the bot just
            // stands there aiming. 1.2s keeps pursuit alive without per-frame spam.
            if (targetMoved || now - this.lastPursuitAt >= 1200) {
                mod.AISetMoveSpeed(player, mod.MoveSpeed.Run);
                mod.AIValidatedMoveToBehavior(player, enemyPos);
                this.lastMoveToPos = enemyPos;
                this.lastPursuitAt = now;
            }
        } catch {}
        this.currentBehavior = 'battlefield';
        this.lastDefendPos = null;
        this.lastSearchPos = null;
    }

    /**
     * Defend behavior - hold position after arrival
     */
    private executeDefend(player: mod.Player, memory: BotMemory): void {
        // ANTI-CAMP (gunmaster FFA): never hold position. The Deadlock "defend on
        // arrival" behavior made bots STAND at a roam point inside a 2-8m bubble.
        // Instead, drop the arrival state and current roam point so the roam sensor
        // immediately picks a NEW waypoint — bots keep patrolling between fights.
        void player;
        memory.clear('arrivedAtDest');
        memory.clear('roamPos');
        this.currentBehavior = 'defend';
        this.lastDefendPos = null;
        this.lastMoveToPos = null;
        this.lastSearchPos = null;
    }

    /**
     * Search behavior - investigate last known enemy position
     */
    private executeSearch(player: mod.Player, memory: BotMemory, memoryKey: keyof BotMemoryFields): void {
        let targetPos: mod.Vector | null = null;

        if (memoryKey === 'lastKnownEnemyPos') {
            targetPos = memory.get('lastKnownEnemyPos');
        } else if (memoryKey === 'searchPos') {
            targetPos = memory.get('searchPos');
        }

        if (!targetPos) return;

        // ARRIVED at the search point? Clear the memory key so the bot falls through
        // to roaming instead of STANDING on the spot until the TTL expires.
        try {
            const botPos = mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
            if (mod.DistanceBetween(botPos, targetPos) < 4) {
                memory.clear(memoryKey);
                return;
            }
        } catch {}

        // Skip if already searching nearby position
        if (
            this.currentBehavior === 'search' &&
            this.lastSearchPos &&
            mod.DistanceBetween(this.lastSearchPos, targetPos) <= BEHAVIOR_CONFIG.POS_EPSILON
        ) {
            return;
        }

        // Move to search position — sprint the long legs, run the approach (stay ready:
        // this is hunting a last-known enemy position).
        try {
            const botPos = mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
            const far = mod.DistanceBetween(botPos, targetPos) > 20;
            mod.AISetMoveSpeed(player, far ? mod.MoveSpeed.Sprint : mod.MoveSpeed.Run);
        } catch {}
        mod.AIValidatedMoveToBehavior(player, targetPos);

        this.currentBehavior = 'search';
        this.lastSearchPos = targetPos;
        this.lastMoveToPos = null;
        this.lastDefendPos = null;

        // Mark search position for arrival check
        memory.set('searchPos', targetPos, SENSOR_CONFIG.SEARCH_TTL);
    }

    /**
     * MoveTo behavior - patrol to roam position
     */
    private executeMoveTo(player: mod.Player, memory: BotMemory): void {
        const roamPos = memory.get('roamPos');
        if (!roamPos) return;

        // Skip if already moving to nearby position
        if (
            this.currentBehavior === 'moveto' &&
            this.lastMoveToPos &&
            mod.DistanceBetween(this.lastMoveToPos, roamPos) <= BEHAVIOR_CONFIG.POS_EPSILON
        ) {
            return;
        }

        // SPRINT across the map when the roam point is far, drop to Run close-in so the
        // bot arrives combat-ready. No visible enemy here by construction (battle would
        // have been selected), so the corpus "sprinting AI stop engaging" rule is safe.
        try {
            const botPos = mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
            const far = mod.DistanceBetween(botPos, roamPos) > 15;
            mod.AISetMoveSpeed(player, far ? mod.MoveSpeed.Sprint : mod.MoveSpeed.Run);
        } catch {}
        mod.AIValidatedMoveToBehavior(player, roamPos);

        this.currentBehavior = 'moveto';
        this.lastMoveToPos = roamPos;
        this.lastDefendPos = null;
        this.lastSearchPos = null;
    }

    /**
     * Push behavior - aggressive forward movement at round start
     * Moves toward enemy side until reaching target or seeing enemy
     */
    private executePush(player: mod.Player, memory: BotMemory): void {
        const pushTarget = memory.get('pushTarget');
        if (!pushTarget) return;

        const botPos = mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
        const distToTarget = mod.DistanceBetween(botPos, pushTarget);

        // Check if we've arrived at push target
        if (distToTarget < BEHAVIOR_CONFIG.PUSH_ARRIVAL_DIST) {
            // Clear push target - we've arrived, switch to normal roaming
            memory.clear('pushTarget');
            this.lastPushPos = null;
            // Switch back to normal run speed
            try {
                mod.AISetMoveSpeed(player, mod.MoveSpeed.Run);
            } catch {}
            return;
        }

        // Skip if already pushing to same position
        if (
            this.currentBehavior === 'push' &&
            this.lastPushPos &&
            mod.DistanceBetween(this.lastPushPos, pushTarget) <= BEHAVIOR_CONFIG.POS_EPSILON
        ) {
            return;
        }

        // Sprint toward push target
        try {
            mod.AISetMoveSpeed(player, mod.MoveSpeed.Sprint);
        } catch {}
        mod.AIValidatedMoveToBehavior(player, pushTarget);

        this.currentBehavior = 'push';
        this.lastPushPos = pushTarget;
        this.lastMoveToPos = null;
        this.lastDefendPos = null;
        this.lastSearchPos = null;
    }

    // ========== FLAG BEHAVIORS ==========

    /**
     * FlagEngage behavior - URGENT rush to flag while fighting
     * Used when enemy is capturing the flag
     */
    private executeFlagEngage(player: mod.Player, memory: BotMemory): void {
        const flagPos = memory.get('flagPos');
        if (!flagPos) return;

        // ALWAYS ensure shooting is enabled during flag engagement (cached — only
        // hits the natives on change or the periodic re-assert).
        aiCombatFlags(player, true, true);

        // Set target if we have a visible enemy
        const visibleEnemy = memory.get('visibleEnemy');
        if (visibleEnemy && mod.IsPlayerValid(visibleEnemy)) {
            aiSetTargetCached(player, visibleEnemy);
        }

        // Use battlefield behavior (will fight while moving)
        // but with flag as the destination focus
        const botPos = mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
        const distToFlag = mod.DistanceBetween(botPos, flagPos);

        if (distToFlag > SENSOR_CONFIG.FLAG_CAPTURE_RADIUS) {
            // Not on flag yet - move toward it with combat awareness
            // Skip if already doing this for same position
            if (
                this.currentBehavior === 'flagengage' &&
                this.lastFlagPos &&
                mod.DistanceBetween(this.lastFlagPos, flagPos) <= BEHAVIOR_CONFIG.POS_EPSILON
            ) {
                return;
            }

            // Use DefendPosition with wide radius - this makes bot move to flag
            // while still engaging enemies along the way
            mod.AIDefendPositionBehavior(player, flagPos, 1.0, 15.0);

            this.currentBehavior = 'flagengage';
            this.lastFlagPos = flagPos;
        } else {
            // On flag - defend it aggressively
            mod.AIDefendPositionBehavior(
                player,
                flagPos,
                SENSOR_CONFIG.FLAG_CAPTURE_RADIUS,
                SENSOR_CONFIG.FLAG_ENGAGE_RADIUS
            );

            this.currentBehavior = 'flagengage';
            this.lastFlagPos = flagPos;
        }

        this.lastMoveToPos = null;
        this.lastDefendPos = null;
        this.lastSearchPos = null;
    }

    /**
     * FlagPush behavior - move toward flag with combat awareness
     * Less urgent than FlagEngage, but still prioritizes the objective
     */
    private executeFlagPush(player: mod.Player, memory: BotMemory): void {
        const flagPos = memory.get('flagPos');
        if (!flagPos) return;

        // ALWAYS ensure shooting is enabled (cached)
        aiCombatFlags(player, true, true);

        const botPos = mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
        const distToFlag = mod.DistanceBetween(botPos, flagPos);

        // If we have a visible enemy nearby, engage them IMMEDIATELY
        const visibleEnemy = memory.get('visibleEnemy');
        if (visibleEnemy && mod.IsPlayerValid(visibleEnemy)) {
            try {
                const enemyPos = mod.GetSoldierState(visibleEnemy, mod.SoldierStateVector.GetPosition);
                const enemyDist = mod.DistanceBetween(botPos, enemyPos);

                // ALWAYS engage visible enemy (cached)
                aiSetTargetCached(player, visibleEnemy);

                // Switch to battlefield if enemy is close
                if (enemyDist < 15) {
                    mod.AIBattlefieldBehavior(player);
                    this.currentBehavior = 'battlefield';
                    return;
                }
            } catch {}
        }

        // Skip if already pushing to same flag position
        if (
            this.currentBehavior === 'flagpush' &&
            this.lastFlagPos &&
            mod.DistanceBetween(this.lastFlagPos, flagPos) <= BEHAVIOR_CONFIG.POS_EPSILON
        ) {
            return;
        }

        if (distToFlag > SENSOR_CONFIG.FLAG_CAPTURE_RADIUS) {
            // Move toward flag with combat readiness
            // DefendPosition allows engaging enemies while moving
            mod.AIDefendPositionBehavior(player, flagPos, 2.0, 12.0);
        } else {
            // On flag - hold position and watch for enemies
            mod.AIDefendPositionBehavior(
                player,
                flagPos,
                SENSOR_CONFIG.FLAG_CAPTURE_RADIUS,
                SENSOR_CONFIG.FLAG_CLOSE_RADIUS
            );
        }

        this.currentBehavior = 'flagpush';
        this.lastFlagPos = flagPos;
        this.lastMoveToPos = null;
        this.lastDefendPos = null;
        this.lastSearchPos = null;
    }

    /**
     * Get current behavior label (for debugging)
     */
    getCurrent(): BehaviorKind | null {
        return this.currentBehavior;
    }
}
