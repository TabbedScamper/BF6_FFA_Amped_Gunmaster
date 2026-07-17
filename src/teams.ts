// ============================================================================
// FFA GUNMASTER — TEAM SLOT ALLOCATOR (the 28-team scheme)
// ============================================================================
// Team 1 (size 4) is the LANDING ZONE: the engine seats joiners (and parties)
// there. We then SetTeam each one onto an empty SOLO slot (teams 2..28, size 1)
// so every participant is cross-team hostile. SetTeam only works on undeployed
// players (Deadlock team-sorting finding) — match start and pre-deploy joins
// are the safe windows.
// ============================================================================

import { FIRST_SOLO_TEAM_ID, LAST_SOLO_TEAM_ID, LANDING_TEAM_ID, DEBUG_MODE } from './config.ts';

export type SlotOccupant =
    | { kind: 'human'; playerId: number }
    | { kind: 'bot'; identityId: number }
    | null;

// teamId -> occupant (null = free)
const slots: Map<number, SlotOccupant> = new Map();

export function initSlots(): void {
    slots.clear();
    for (let t = FIRST_SOLO_TEAM_ID; t <= LAST_SOLO_TEAM_ID; t++) {
        slots.set(t, null);
    }
}

export function slotCount(): number {
    return LAST_SOLO_TEAM_ID - FIRST_SOLO_TEAM_ID + 1;
}

export function freeSlotTeamId(): number | null {
    for (const [teamId, occ] of slots) {
        if (occ === null) return teamId;
    }
    return null;
}

export function occupiedSlots(): Array<{ teamId: number; occupant: NonNullable<SlotOccupant> }> {
    const out: Array<{ teamId: number; occupant: NonNullable<SlotOccupant> }> = [];
    for (const [teamId, occ] of slots) {
        if (occ !== null) out.push({ teamId, occupant: occ });
    }
    return out;
}

export function humanCount(): number {
    let n = 0;
    for (const occ of slots.values()) if (occ?.kind === 'human') n++;
    return n;
}

export function botSlots(): Array<{ teamId: number; identityId: number }> {
    const out: Array<{ teamId: number; identityId: number }> = [];
    for (const [teamId, occ] of slots) {
        if (occ?.kind === 'bot') out.push({ teamId, identityId: occ.identityId });
    }
    return out;
}

export function slotOfHuman(playerId: number): number | null {
    for (const [teamId, occ] of slots) {
        if (occ?.kind === 'human' && occ.playerId === playerId) return teamId;
    }
    return null;
}

export function claimSlotForBot(teamId: number, identityId: number): void {
    slots.set(teamId, { kind: 'bot', identityId });
}

export function releaseSlot(teamId: number): void {
    if (slots.has(teamId)) slots.set(teamId, null);
}

export function releaseHumanSlot(playerId: number): number | null {
    const teamId = slotOfHuman(playerId);
    if (teamId !== null) slots.set(teamId, null);
    return teamId;
}

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Teams] ${msg}`);
}

/**
 * Move one (undeployed) human onto a free solo slot. Returns the teamId or null.
 */
export function assignHumanToSlot(player: mod.Player): number | null {
    try {
        const playerId = mod.GetObjId(player);
        // Already seated?
        const existing = slotOfHuman(playerId);
        if (existing !== null) return existing;

        const teamId = freeSlotTeamId();
        if (teamId === null) {
            log(`no free solo slot for player ${playerId}`);
            return null;
        }
        mod.SetTeam(player, mod.GetTeam(teamId));
        slots.set(teamId, { kind: 'human', playerId });
        log(`player ${playerId} -> solo team ${teamId}`);
        return teamId;
    } catch {
        return null;
    }
}

/**
 * THE SPLIT: everyone the engine seated on the landing team (1) gets their own
 * solo slot. Call at match start BEFORE first deploy, and for any later joiner
 * found on team 1 while undeployed.
 */
export function splitLandingTeam(allPlayers: mod.Player[]): number {
    let moved = 0;
    const landing = mod.GetTeam(LANDING_TEAM_ID);
    const landingId = mod.GetObjId(landing);
    for (const p of allPlayers) {
        try {
            if (!mod.IsPlayerValid(p)) continue;
            if (mod.GetSoldierState(p, mod.SoldierStateBool.IsAISoldier)) continue;
            if (mod.GetObjId(mod.GetTeam(p)) !== landingId) continue;
            if (assignHumanToSlot(p) !== null) moved++;
        } catch {}
    }
    log(`split landing team: moved ${moved} player(s)`);
    return moved;
}
