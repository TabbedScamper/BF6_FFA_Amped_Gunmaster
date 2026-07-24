// ============================================================================
// FFA GUNMASTER — BOT MANAGER (Deadlock sense-think-act brain, FFA-adapted)
// ============================================================================
// Uses the Deadlock bot AI (bot-ai/) — probabilistic LOS-gated detection,
// AISetTarget + AIForceFire aggression (this is why they actually HIT), memory,
// and human-feel movement. Adapted to FFA via bot-ai/ffa-deps (every other alive
// soldier is an enemy). Two loops: the brain tick (sense-think-act) and the LOS
// raycast round-robin (one cast/tick). Raycast results route back via the
// OnRayCast events below.
// ============================================================================

import { Events } from 'bf6-portal-utils/events/index.ts';
import { Timers } from 'bf6-portal-utils/timers/index.ts';
import { DEBUG_MODE } from './config.ts';
import { botSlots } from './teams.ts';
import { getIdentity } from './roster.ts';
import { spawnMarkerPositions } from './spawns.ts';
import { getBotBrain, removeBotBrainById, clearAllBotBrains } from './bot-ai/brain.ts';
import { clearAiFlagCache } from './bot-ai/ai-flags.ts';
import { SENSOR_CONFIG } from './bot-ai/sensors.ts';
import { updateLos, onRayHit, onRayMiss, clearLos } from './bot-ai/los.ts';

const BRAIN_TICK_MS = 200; // sense-think-act cadence
const LOS_TICK_MS = 100; // one LOS raycast per tick (round-robin)

let brainInterval: number | null = null;
let losInterval: number | null = null;

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Bots] ${msg}`);
}

/** Snapshot ALL players once into an id->player map (P11: minimize mod.* calls).
 *  The old resolvePlayer() re-scanned mod.AllPlayers() for EVERY bot, so currentBots()
 *  cost O(bots x players) engine calls — ~16x32 per call, run in BOTH the 5 Hz brain
 *  loop and the 10 Hz LOS loop (~7.7k engine calls/sec just to FIND the bots). One
 *  snapshot per tick collapses that to O(players) and a map lookup per bot. */
function snapshotPlayers(): Map<number, mod.Player> {
    const m: Map<number, mod.Player> = new Map();
    try {
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        for (let i = 0; i < n; i++) {
            const p = mod.ValueInArray(arr, i) as mod.Player;
            try {
                if (mod.IsPlayerValid(p)) m.set(mod.GetObjId(p), p);
            } catch {}
        }
    } catch {}
    return m;
}

/** Live engine players currently embodying a bot identity, resolved from a
 *  once-per-tick player snapshot (no per-bot AllPlayers rescan). */
function currentBots(snap: Map<number, mod.Player>): mod.Player[] {
    const out: mod.Player[] = [];
    for (const { identityId } of botSlots()) {
        const ident = getIdentity(identityId);
        if (!ident || ident.currentPlayerId === null) continue;
        const bot = snap.get(ident.currentPlayerId);
        if (bot) out.push(bot);
    }
    return out;
}

function tickBrains(): void {
    const snap = snapshotPlayers();
    for (const bot of currentBots(snap)) {
        try {
            const brain = getBotBrain(bot);
            brain.setSpawnPositionsGetter(() => spawnMarkerPositions());
            brain.tick();
        } catch {}
    }
}

function tickLos(): void {
    try {
        updateLos(currentBots(snapshotPlayers()), SENSOR_CONFIG.SIGHT_RANGE);
    } catch {}
}

export function startBotDirector(): void {
    if (brainInterval === null) brainInterval = Timers.setInterval(tickBrains, BRAIN_TICK_MS);
    if (losInterval === null) losInterval = Timers.setInterval(tickLos, LOS_TICK_MS);
    log('bot brains started (sense-think-act + LOS)');
}

export function stopBotDirector(): void {
    if (brainInterval !== null) {
        Timers.clearInterval(brainInterval);
        brainInterval = null;
    }
    if (losInterval !== null) {
        Timers.clearInterval(losInterval);
        losInterval = null;
    }
    clearLos();
    clearAllBotBrains();
}

/** Trigger-happy retaliation: a bot that gets shot locks onto the shooter. */
export function notifyBotDamaged(victim: mod.Player, attacker: mod.Player): void {
    try {
        if (!mod.GetSoldierState(victim, mod.SoldierStateBool.IsAISoldier)) return;
        const brain = getBotBrain(victim);
        let attackerPos: mod.Vector | undefined;
        try {
            attackerPos = mod.GetSoldierState(attacker, mod.SoldierStateVector.GetPosition);
        } catch {}
        brain.onDamaged(attacker, attackerPos);
    } catch {}
}

/** Clean up a dead/removed bot's brain (a new one is made when it respawns).
 *  Deletes by ID directly — the dead body is often already unresolvable, and the
 *  old resolve-then-remove path silently leaked stale brains all match. */
export function clearBotState(playerId: number): void {
    removeBotBrainById(playerId);
    clearAiFlagCache(playerId); // drop cached AIEnable*/AISetTarget state with the body
}

// Route raycast LOS-probe results back to the LOS manager.
Events.OnRayCastHit.subscribe((bot: mod.Player, point: mod.Vector) => {
    onRayHit(bot, point);
});
Events.OnRayCastMissed.subscribe((bot: mod.Player) => {
    onRayMiss(bot);
});
