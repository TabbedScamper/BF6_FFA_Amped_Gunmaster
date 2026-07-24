// ============================================================================
// FFA GUNMASTER — bot-ai dependency shims (adapts Deadlock's 2-team AI to FFA)
// ============================================================================
// The Deadlock bot brain finds enemies by TEAM (team 1 vs team 2). In this FFA
// every player is on their own solo team, so "enemy" = any OTHER alive soldier.
// senseEnemy()/los use allAliveEnemies(bot) instead of getAlivePlayersOnTeam.
// Tlm is stubbed (no telemetry pipeline in this project).
// ============================================================================

import { isBenched } from '../bench.ts';

/** All alive soldiers except the given bot — every other player IS an enemy in FFA. */
export function allAliveEnemies(self: mod.Player): mod.Player[] {
    const out: mod.Player[] = [];
    try {
        const selfId = mod.GetObjId(self);
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        for (let i = 0; i < n; i++) {
            try {
                const p = mod.ValueInArray(arr, i) as mod.Player;
                if (!mod.IsPlayerValid(p)) continue;
                const pid = mod.GetObjId(p);
                if (pid === selfId) continue;
                if (isBenched(pid)) continue; // parked freecam statue — invulnerable, never a target
                if (!mod.GetSoldierState(p, mod.SoldierStateBool.IsAlive)) continue;
                out.push(p);
            } catch {}
        }
    } catch {}
    return out;
}

/** Real team lookup — used only by the (unused-in-FFA) flag sensor path. */
export function getAlivePlayersOnTeam(teamId: number): mod.Player[] {
    const out: mod.Player[] = [];
    try {
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        for (let i = 0; i < n; i++) {
            try {
                const p = mod.ValueInArray(arr, i) as mod.Player;
                if (!mod.IsPlayerValid(p)) continue;
                if (!mod.GetSoldierState(p, mod.SoldierStateBool.IsAlive)) continue;
                if (mod.GetObjId(mod.GetTeam(p)) !== mod.GetObjId(mod.GetTeam(teamId))) continue;
                out.push(p);
            } catch {}
        }
    } catch {}
    return out;
}

/** Telemetry stub (no-op). */
export const Tlm = {
    event(_name: string, _data?: unknown): void {},
    sample(_name: string, _data?: unknown): void {},
};
