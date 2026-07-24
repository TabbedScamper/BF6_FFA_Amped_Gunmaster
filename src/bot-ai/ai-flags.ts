// ============================================================================
// FFA GUNMASTER — AI NATIVE-CALL CACHE (change-detect + periodic re-assert)
// ============================================================================
// The brain/behaviors re-asserted AIEnableShooting/Targeting + AISetTarget on
// EVERY tick ("ALWAYS ensure...") — measured by the offline sim at ~2,800-4,100
// native calls each per match segment, ~99% of them no-ops re-setting the same
// value. This cache only calls the natives when the value actually CHANGES,
// while keeping the defensive always-on intent via a periodic re-assert
// (REASSERT_MS), so an engine-side reset can never stick for more than a few
// seconds. `force` bypasses the cache for state transitions that MUST land
// (fresh body on deploy, intro freeze/unfreeze).
// ============================================================================

const REASSERT_MS = 5000; // combat flags re-asserted at most this often when unchanged
const TARGET_REASSERT_MS = 3000; // same-target AISetTarget re-issued at most this often

interface FlagRec { shoot: boolean; target: boolean; at: number; }
interface TargetRec { targetId: number; at: number; } // -1 = explicitly no target

const flags: Map<number, FlagRec> = new Map();
const targets: Map<number, TargetRec> = new Map();

/** Set AIEnableShooting + AIEnableTargeting, skipping the natives when unchanged. */
export function aiCombatFlags(player: mod.Player, shoot: boolean, target: boolean, force: boolean = false): void {
    try {
        const id = mod.GetObjId(player);
        const now = Date.now();
        const prev = flags.get(id);
        if (!force && prev && prev.shoot === shoot && prev.target === target && now - prev.at < REASSERT_MS) return;
        mod.AIEnableShooting(player, shoot);
        mod.AIEnableTargeting(player, target);
        flags.set(id, { shoot, target, at: now });
    } catch {}
}

/** AISetTarget with change-detection (undefined = drop target). Same target re-issued
 *  only every TARGET_REASSERT_MS — AISetTarget TRACKS the live soldier, so once set it
 *  keeps following; the periodic re-issue is only a safety net. */
export function aiSetTargetCached(player: mod.Player, enemy?: mod.Player, force: boolean = false): void {
    try {
        const id = mod.GetObjId(player);
        const tid = enemy !== undefined ? mod.GetObjId(enemy) : -1;
        const now = Date.now();
        const prev = targets.get(id);
        if (!force && prev && prev.targetId === tid && now - prev.at < TARGET_REASSERT_MS) return;
        if (enemy !== undefined) mod.AISetTarget(player, enemy);
        else mod.AISetTarget(player);
        targets.set(id, { targetId: tid, at: now });
    } catch {}
}

/** Drop a player's cached state (call when the engine body is torn down). */
export function clearAiFlagCache(playerId: number): void {
    flags.delete(playerId);
    targets.delete(playerId);
}
