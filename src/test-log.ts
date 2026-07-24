// ============================================================================
// FFA SOLO-TEAM TEST INSTRUMENTATION (2026-07-18)
// ============================================================================
// Prints [FFATEST] lines that prove the runtime-solo-team FFA works, and — on an
// ONLINE "Host" (dedicated) session — flushes PortalLog to the ADMIN client via
// mod.SendPortalLogToAdmin() on a quota-safe interval, so you can read the result
// off  %LocalAppData%\Temp\Battlefield(TM) 6\PortalLog.txt  on the admin machine.
// On "Host Locally", SendPortalLogToAdmin is a no-op (the log is already local) —
// the [FFATEST] lines still print to the local PortalLog.
//
// Everything is gated behind config TEST_LOG — set it false to silence for release.
// ============================================================================

import { Timers } from 'bf6-portal-utils/timers/index.ts';
import { TEST_LOG, LOG_FLUSH_MS } from './config.ts';

export function tlog(msg: string): void {
    if (TEST_LOG) console.log(`[FFATEST] ${msg}`);
}

/** Engine-truth team id a player is on (-1 on error). */
export function teamOf(p: mod.Player): number {
    try {
        return mod.GetObjId(mod.GetTeam(p));
    } catch {
        return -1;
    }
}

export function pidOf(p: mod.Player): number {
    try {
        return mod.GetObjId(p);
    } catch {
        return -1;
    }
}

export function isBotPlayer(p: mod.Player): boolean {
    try {
        return mod.GetSoldierState(p, mod.SoldierStateBool.IsAISoldier);
    } catch {
        return false;
    }
}

let flush: number | null = null;

/** Arm the periodic admin-log flush (online "Host" only; no-op locally). Quota
 *  applies per session, so the interval is deliberately infrequent — if flushes
 *  stop arriving on the admin machine mid-test, the quota is hit; raise LOG_FLUSH_MS. */
export function startLogFlush(): void {
    if (!TEST_LOG || flush !== null) return;
    flush = Timers.setInterval(() => {
        // The installed bf6-portal-mod-types (2.3.1) predates this SDK 1.3.3.0
        // function, so call it via a cast + optional chain: compiles against the old
        // stubs and no-ops if the live runtime somehow lacks it. (Update the types
        // package to type it properly.)
        try {
            (mod as unknown as { SendPortalLogToAdmin?: () => void }).SendPortalLogToAdmin?.();
        } catch {}
    }, LOG_FLUSH_MS);
    tlog(`admin-log flush armed: SendPortalLogToAdmin every ${LOG_FLUSH_MS}ms (online host only)`);
}

export function stopLogFlush(): void {
    if (flush !== null) {
        Timers.clearInterval(flush);
        flush = null;
    }
}

/** One-shot roster snapshot: every player + its engine team. This is the proof
 *  that SetTeam stuck — each human should read a UNIQUE team in the HUMAN range. */
export function logRosterSnapshot(label: string): void {
    if (!TEST_LOG) return;
    try {
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        let humans = 0;
        for (let i = 0; i < n; i++) {
            const p = mod.ValueInArray(arr, i) as mod.Player;
            const bot = isBotPlayer(p);
            if (!bot) humans++;
            tlog(`  ${label}: ${bot ? 'BOT  ' : 'HUMAN'} id=${pidOf(p)} team=${teamOf(p)}`);
        }
        tlog(`${label}: humans=${humans} total=${n}`);
    } catch {}
}

// Hostility proof from damage, capped so PortalLog doesn't fill with per-hit spam.
let dmgLogged = 0;
const DMG_LOG_CAP = 12;
export function logHostileDamage(victim: mod.Player, giver: mod.Player): void {
    if (!TEST_LOG || dmgLogged >= DMG_LOG_CAP) return;
    if (isBotPlayer(giver) && isBotPlayer(victim)) return; // only human-involved hits matter here
    dmgLogged++;
    const gt = teamOf(giver);
    const vt = teamOf(victim);
    tlog(
        `DMG#${dmgLogged} giver=${pidOf(giver)}(team ${gt}) -> victim=${pidOf(victim)}(team ${vt}) ` +
            `${gt !== vt ? 'DIFFERENT teams => HOSTILE OK' : '!! SAME team — check assignment !!'}`
    );
}
