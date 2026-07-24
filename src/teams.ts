// ============================================================================
// FFA GUNMASTER — TEAM SEATS (true FFA: every human on its OWN runtime team)
// ============================================================================
// NO friendly fire. Each playing human sits on its OWN team (HUMAN_TEAM_BASE+),
// exactly like each bot sits on its own team (BOT_TEAM_BASE+) — separate teams are
// natively hostile, so everyone damages everyone with proper enemy visuals. Team 1
// is the GATE where the engine seats joiners (and where overflow is benched).
//
// Only TWO teams are DECLARED on the portal page (so the base mode starts); the
// solo teams here are RUNTIME teams (undeclared ids — the bots prove GetTeam(n)
// works for them). SetTeam only STICKS on an UNDEPLOYED player (SetTeam forces the
// deploy screen anyway) — match start + pre-deploy joins are the safe windows.
//
// We track each human's OWN team so we can free/reuse solo slots and keep the
// MAX_PLAYERS roster cap + bench.
// ============================================================================

import { HUMAN_TEAM_BASE, MAX_PLAYERS, BOT_COUNT, DEBUG_MODE } from './config.ts';

const humans: Map<number, number> = new Map(); // playerId -> its team id (shared 1..MAX_PLAYERS pool)
const bots: Map<number, number> = new Map(); // bot identityId -> its team id (same shared pool)

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Teams] ${msg}`);
}

export function initSlots(): void {
    humans.clear();
    bots.clear();
}

/** Seats currently taken across the active roster (humans + bots). */
export function seatsTaken(): number {
    return humans.size + bots.size;
}

// ONE SHARED POOL of MAX_PLAYERS declared teams (HUMAN_TEAM_BASE..+MAX_PLAYERS-1).
// Humans AND bots draw from the SAME 16 teams, one entity per team — so everyone is on
// a different team and mutually hostile (true FFA). Bots FILL the teams humans haven't
// taken; a bot steps aside when a human needs its team. (Separate high bot teams like
// 50-65 DON'T EXIST on the portal page — only these are declared — so AI spawned there
// gets culled by the engine. Party hosting forces every declared team to capacity >= 4,
// which caps the pool at 16 teams = 16 total entities, humans + bots combined.)

/** Every team currently held by a human OR a bot. */
function occupiedTeams(): Set<number> {
    const s = new Set<number>();
    for (const t of humans.values()) s.add(t);
    for (const t of bots.values()) s.add(t);
    return s;
}

/** First unoccupied team in the shared pool, or null if all MAX_PLAYERS are taken. */
function freeTeamId(): number | null {
    const used = occupiedTeams();
    for (let t = HUMAN_TEAM_BASE; t < HUMAN_TEAM_BASE + MAX_PLAYERS; t++) {
        if (!used.has(t)) return t;
    }
    return null;
}

/** Next free team for a HUMAN. Null when all 16 are occupied — the caller then evicts a
 *  bot (bots yield to humans) before benching into the FIFO queue. */
export function freeHumanTeamId(): number | null {
    return freeTeamId();
}

/** True if a slot is free for a human right now (else caller evicts a bot / benches). */
export function freeSlotTeamId(): number | null {
    return freeHumanTeamId();
}

/** Next free team for a BOT — one of the same declared teams, only while total entities
 *  < MAX_PLAYERS and fewer than BOT_COUNT bots are active. Bots never share a team. */
export function freeBotTeamId(): number | null {
    if (bots.size >= BOT_COUNT) return null;
    if (humans.size + bots.size >= MAX_PLAYERS) return null;
    return freeTeamId();
}

export function humanCount(): number {
    return humans.size;
}

/** Bot seats — {teamId, identityId} per active bot (each bot has its OWN team). */
export function botSlots(): Array<{ teamId: number; identityId: number }> {
    return [...bots.entries()].map(([identityId, teamId]) => ({ teamId, identityId }));
}

/** The human's own team id, or null if not seated. */
export function slotOfHuman(playerId: number): number | null {
    return humans.has(playerId) ? (humans.get(playerId) as number) : null;
}

/** Is this player ACTUALLY on its own solo playing team right now (engine truth)?
 *  False while still on the gate (team 1) or unseated — the retry loops in index.ts
 *  keep calling assignHumanToSlot until this reads true. */
export function isOnActiveTeam(player: mod.Player): boolean {
    try {
        const playerId = mod.GetObjId(player);
        const teamId = humans.get(playerId);
        if (teamId === undefined) return false;
        return mod.GetObjId(mod.GetTeam(player)) === mod.GetObjId(mod.GetTeam(teamId));
    } catch {
        return false;
    }
}

/** Reserve a bot seat on its own team (teamId from freeBotTeamId). */
export function claimSlotForBot(teamId: number, identityId: number): void {
    bots.set(identityId, teamId);
}

/** Free a bot's seat (by its persistent identity). */
export function releaseBotSlot(identityId: number): void {
    bots.delete(identityId);
}

/** Free a human's seat. Returns the solo team they held, or null. */
export function releaseHumanSlot(playerId: number): number | null {
    const teamId = humans.get(playerId);
    if (teamId === undefined) return null;
    humans.delete(playerId);
    return teamId;
}

/**
 * Seat one (undeployed) human on its OWN solo team. Idempotent: if the player is
 * already tracked, it re-asserts SetTeam onto the SAME team (never allocates a
 * second). Returns the teamId or null (roster full). Caller redeploys after.
 */
export function assignHumanToSlot(player: mod.Player): number | null {
    try {
        const playerId = mod.GetObjId(player);
        // Reuse the player's existing solo team if already seated; else claim one.
        let teamId = humans.get(playerId) ?? null;
        if (teamId === null) {
            teamId = freeHumanTeamId();
            if (teamId === null) {
                log(`no free solo slot for player ${playerId}`);
                return null;
            }
        }
        // SetTeam only STICKS on an UNDEPLOYED player. If the engine already deployed
        // them (on the gate team), undeploy first, move team, then the caller redeploys
        // (DeployAllPlayers at match start; DeployPlayer for a mid-match joiner).
        try {
            mod.UndeployPlayer(player);
        } catch {}
        mod.SetTeam(player, mod.GetTeam(teamId));
        humans.set(playerId, teamId);
        // READ BACK the engine's actual team so the log proves whether SetTeam stuck.
        let actual = -1;
        try {
            actual = mod.GetObjId(mod.GetTeam(player));
        } catch {}
        log(
            `player ${playerId} -> own solo team ${teamId} (engine team obj now ${actual}, ` +
                `target obj ${mod.GetObjId(mod.GetTeam(teamId))})`
        );
        return teamId;
    } catch {
        return null;
    }
}

/**
 * THE SPLIT: give every human its OWN solo team. The engine seats a joining party
 * TOGETHER on one team (it must, to host); this distributes them 1-per-team.
 * Call at match start BEFORE first deploy, and for later joiners while undeployed.
 * Each human not yet holding a solo slot gets one (or is benched if all are full).
 */
export function splitLandingTeam(allPlayers: mod.Player[]): mod.Player[] {
    let moved = 0;
    const unseated: mod.Player[] = []; // overflow — CALLER must bench these (avoids a teams->bench cycle)
    for (const p of allPlayers) {
        try {
            if (!mod.IsPlayerValid(p)) continue;
            if (mod.GetSoldierState(p, mod.SoldierStateBool.IsAISoldier)) continue;
            const pid = mod.GetObjId(p);
            if (slotOfHuman(pid) !== null) continue; // already holds a solo team
            if (assignHumanToSlot(p) !== null) moved++;
            else unseated.push(p); // all slots full — over-capacity at match start
        } catch {}
    }
    log(`split: seated ${moved} human(s); ${unseated.length} over capacity`);
    return unseated;
}
