// ============================================================================
// FFA GUNMASTER — BOT DIRECTOR (lightweight, raycast-free)
// ============================================================================
// Deadlock's full sense-think-act brain (memory + sensors + per-bot LOS
// raycasts) would blow the raycast budget on top of the amped-FX + spawn-LOS
// casts. We don't need it here: every bot is on its OWN solo team, so the
// engine's native AI already treats everyone as hostile and handles target
// acquisition + LOS-gated shooting for free.
//
// This director just keeps bots ACTIVE and pushing toward fights, on a cadence,
// using pure distance math (NO raycasts):
//   - find the nearest living OTHER soldier (ClosestPlayerTo, minus self)
//   - AISetTarget + AIEnableShooting so they shoot when they can see them
//   - AIValidatedMoveToBehavior toward them (corpus: AISetTarget alone doesn't
//     move; re-issue a validated move-to on a cadence)
//   - if nobody is near, roam to a random spawn marker so they don't idle
// ============================================================================

import { Timers } from 'bf6-portal-utils/timers/index.ts';
import { DEBUG_MODE } from './config.ts';
import { botSlots } from './teams.ts';
import { getIdentity } from './roster.ts';
import { spawnMarkerPositions } from './spawns.ts';
import { nearestPowerupPos } from './powerups.ts';

const BOT_TICK_MS = 300; // director cadence (cheap; no raycasts)
const ENGAGE_RANGE = 60; // within this, push toward the target; else roam
const REPATH_MOVE_MS = 900; // don't spam move-to; re-issue at most this often

interface BotDirectorState {
    lastMoveAt: number;
    roamTarget: mod.Vector | null;
}
const state: Map<number, BotDirectorState> = new Map();
let directorInterval: number | null = null;

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Bots] ${msg}`);
}

function stateOf(playerId: number): BotDirectorState {
    let s = state.get(playerId);
    if (!s) {
        s = { lastMoveAt: 0, roamTarget: null };
        state.set(playerId, s);
    }
    return s;
}

/** Nearest living OTHER soldier to a position (excludes the given id). Pure math. */
function nearestOther(pos: mod.Vector, selfId: number): { player: mod.Player; dist: number } | null {
    let best: mod.Player | null = null;
    let bestDist = Infinity;
    try {
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        for (let i = 0; i < n; i++) {
            const p = mod.ValueInArray(arr, i) as mod.Player;
            try {
                if (!mod.IsPlayerValid(p)) continue;
                if (mod.GetObjId(p) === selfId) continue;
                if (!mod.GetSoldierState(p, mod.SoldierStateBool.IsAlive)) continue;
                const pp = mod.GetSoldierState(p, mod.SoldierStateVector.GetPosition);
                const d = mod.DistanceBetween(pos, pp);
                if (d < bestDist) { bestDist = d; best = p; }
            } catch {}
        }
    } catch {}
    return best ? { player: best, dist: bestDist } : null;
}

function pickRoam(markers: mod.Vector[], salt: number): mod.Vector | null {
    if (markers.length === 0) return null;
    return markers[(salt + Math.floor(Math.random() * markers.length)) % markers.length];
}

function tickBot(bot: mod.Player, markers: mod.Vector[], now: number): void {
    try {
        if (!mod.IsPlayerValid(bot)) return;
        if (!mod.GetSoldierState(bot, mod.SoldierStateBool.IsAlive)) return;
        const selfId = mod.GetObjId(bot);
        const pos = mod.GetSoldierState(bot, mod.SoldierStateVector.GetPosition);
        const st = stateOf(selfId);

        const target = nearestOther(pos, selfId);
        if (target && target.dist <= ENGAGE_RANGE) {
            // Engage: aim + shoot; push toward them on a cadence.
            try {
                mod.AISetTarget(bot, target.player);
                mod.AIEnableShooting(bot, true);
            } catch {}
            if (now - st.lastMoveAt >= REPATH_MOVE_MS) {
                st.lastMoveAt = now;
                st.roamTarget = null;
                try {
                    const tp = mod.GetSoldierState(target.player, mod.SoldierStateVector.GetPosition);
                    mod.AISetMoveSpeed(bot, mod.MoveSpeed.Run);
                    mod.AIValidatedMoveToBehavior(bot, tp);
                } catch {}
            }
        } else {
            // Roam toward a spawn marker to find action.
            if (now - st.lastMoveAt >= REPATH_MOVE_MS || st.roamTarget === null) {
                st.lastMoveAt = now;
                // Prefer grabbing a nearby powerup; else wander a spawn marker.
                st.roamTarget = nearestPowerupPos(pos, 45) ?? pickRoam(markers, selfId);
                if (st.roamTarget) {
                    try {
                        mod.AISetMoveSpeed(bot, mod.MoveSpeed.Run);
                        mod.AIValidatedMoveToBehavior(bot, st.roamTarget);
                    } catch {}
                }
            }
        }
    } catch {}
}

/** Resolve the engine player currently embodying each bot identity, then tick it. */
function tickAllBots(): void {
    const markers = spawnMarkerPositions();
    const now = Date.now();
    for (const { identityId } of botSlots()) {
        const ident = getIdentity(identityId);
        if (!ident || ident.currentPlayerId === null) continue;
        const bot = resolvePlayer(ident.currentPlayerId);
        if (bot) tickBot(bot, markers, now);
    }
}

/** Find a live mod.Player by ObjId (bots are re-adopted on deploy). */
function resolvePlayer(playerId: number): mod.Player | null {
    try {
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        for (let i = 0; i < n; i++) {
            const p = mod.ValueInArray(arr, i) as mod.Player;
            try {
                if (mod.IsPlayerValid(p) && mod.GetObjId(p) === playerId) return p;
            } catch {}
        }
    } catch {}
    return null;
}

export function startBotDirector(): void {
    if (directorInterval !== null) return;
    directorInterval = Timers.setInterval(tickAllBots, BOT_TICK_MS);
    log('bot director started');
}

export function stopBotDirector(): void {
    if (directorInterval !== null) {
        Timers.clearInterval(directorInterval);
        directorInterval = null;
    }
}

export function clearBotState(playerId: number): void {
    state.delete(playerId);
}
