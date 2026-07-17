// ============================================================================
// FFA GUNMASTER — SPECTATOR BENCH (over-capacity handling)
// ============================================================================
// The 32 solo teams cap ACTIVE players at 32. Joiners 33..36 land on team 1
// (the gate) and are BENCHED: EnablePlayerDeploy(false) + spectate-anyone. When
// an active player leaves, the oldest benched player is promoted into the freed
// solo slot and deployed. Proven pattern (deluca's Search & Destroy).
//
// SAFETY NET (author's catch): in spectator mode a player can "spawn on a
// friendly they're spectating" — and benched players all share team 1, so one
// could sneak a deploy onto another. enforceBench() (called first thing in
// OnPlayerDeployed) instantly UndeployPlayer's anyone benched who slips through.
// ============================================================================

import { DEBUG_MODE } from './config.ts';

const benchedQueue: number[] = []; // FIFO of playerIds
const benchedSet: Set<number> = new Set();

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Bench] ${msg}`);
}

/** Bench a player: no deploy, free spectate of anyone, ensure undeployed. */
export function benchPlayer(player: mod.Player): void {
    try {
        const id = mod.GetObjId(player);
        if (benchedSet.has(id)) return;
        mod.EnablePlayerDeploy(player, false);
        try {
            mod.SetSpectatingFiltersForPlayer(player, mod.SpectatingGroup.All, false, false);
        } catch {}
        try {
            mod.UndeployPlayer(player);
        } catch {}
        benchedQueue.push(id);
        benchedSet.add(id);
        log(`benched ${id} (bench size ${benchedQueue.length})`);
    } catch {}
}

export function isBenched(playerId: number): boolean {
    return benchedSet.has(playerId);
}

export function benchedCount(): number {
    return benchedQueue.length;
}

export function removeBenched(playerId: number): void {
    benchedSet.delete(playerId);
    const i = benchedQueue.indexOf(playerId);
    if (i >= 0) benchedQueue.splice(i, 1);
}

/** Oldest benched playerId (FIFO), or null. */
export function peekBenched(): number | null {
    return benchedQueue.length > 0 ? benchedQueue[0] : null;
}

/**
 * SAFETY NET: if a benched player somehow deployed (spawn-on-friendly bypass),
 * instantly undeploy them. Returns true if it kicked them (caller should stop).
 */
export function enforceBench(player: mod.Player): boolean {
    try {
        const id = mod.GetObjId(player);
        if (!benchedSet.has(id)) return false;
        mod.EnablePlayerDeploy(player, false);
        mod.UndeployPlayer(player);
        log(`enforced bench on ${id} (kicked an unwanted deploy)`);
        return true;
    } catch {
        return false;
    }
}

/** Promote a benched player to active: remove from bench + allow deploy. */
export function activate(player: mod.Player): void {
    try {
        removeBenched(mod.GetObjId(player));
        mod.EnablePlayerDeploy(player, true);
    } catch {}
}

/** Reset the bench (match end) and re-enable deploy for everyone. */
export function clearBench(): void {
    benchedQueue.length = 0;
    benchedSet.clear();
    try {
        mod.EnableAllPlayerDeploy(true);
    } catch {}
}
