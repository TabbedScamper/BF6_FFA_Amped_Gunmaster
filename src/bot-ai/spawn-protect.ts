// ============================================================================
// FFA GUNMASTER — FRESH-SPAWN TARGET IMMUNITY
// ============================================================================
// Anti-spawn-camp: bots won't ACQUIRE a player as a target for a short window
// after that player deploys, so nobody gets insta-locked the instant they
// materialize. This is a pure TARGETING filter (checked in senseEnemy + the LOS
// round-robin) — NOT damage immunity. (Damage-immunity spawn protection was
// removed from OnPlayerDeployed for leaving players permanently invincible; the
// 0->1 reset didn't reliably fire.) Recorded per player id on every deploy, so it
// covers first spawns AND respawns, humans AND bots.
//
// NOTE: retaliation is intentionally NOT gated by this — if a fresh spawn SHOOTS a
// bot, the bot still fights back (the grace is for passive spawns, not aggressors).
// ============================================================================

import { SPAWN_TARGET_IMMUNITY_MS } from '../config.ts';

const spawnedAt = new Map<number, number>(); // playerId -> Date.now() of last deploy

/** Call on every deploy (OnPlayerDeployed) to start this player's target-immunity window. */
export function markSpawned(playerId: number): void {
    spawnedAt.set(playerId, Date.now());
}

/** True while this player is within SPAWN_TARGET_IMMUNITY_MS of their last deploy — bots skip them. */
export function isTargetProtected(player: mod.Player): boolean {
    try {
        const t = spawnedAt.get(mod.GetObjId(player));
        return t !== undefined && Date.now() - t < SPAWN_TARGET_IMMUNITY_MS;
    } catch {
        return false;
    }
}

/** Drop a player's record (on leave/removal). Harmless if absent; overwritten on respawn anyway. */
export function clearSpawnProtect(playerId: number): void {
    spawnedAt.delete(playerId);
}

/** Wipe all records (match reset). */
export function clearAllSpawnProtect(): void {
    spawnedAt.clear();
}
