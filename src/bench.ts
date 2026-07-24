// ============================================================================
// FFA GUNMASTER — FREECAM BENCH (over-capacity handling, deployed-body design)
// ============================================================================
// The 17th+ human is AUTO-DEPLOYED (a real body exists — this dodges the corpus
// deploy-screen stuck-camera bug entirely), then instantly PARKED:
//   frozen inputs + invulnerable + teleported to the arena's far edge + FREECAM.
// They fly the map while queued, with an "IN QUEUE — #N" status line. They are
// EXCLUDED from everything that matters: the spawn picker's threat scan, bot
// target senses, and the leaderboards (see call sites).
//
// PROMOTION (slot freed): unfreeze + vulnerable + first-person + seated on the
// freed solo team + CATCH-UP ladder entry (lowest active index, demotion floor
// AT that index -> they enter with DEMOTION PROTECTION), then a normal deploy.
// ============================================================================

import { DEBUG_MODE, BENCH_FREECAM } from './config.ts';
import { GameUI } from './game-ui.ts';
import { freezePlayer, unfreezePlayer } from './intro.ts';

const SK = (): mod.Any => mod.stringkeys;
const WHITE = GameUI.rgb(0.94, 0.94, 0.94);

const benchedQueue: number[] = []; // FIFO of playerIds
const benchedSet: Set<number> = new Set();
const queueUi: Map<number, mod.UIWidget> = new Map(); // playerId -> "IN QUEUE" text

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Bench] ${msg}`);
}

// --- queue status UI --------------------------------------------------------
function refreshQueueUi(): void {
    for (let i = 0; i < benchedQueue.length; i++) {
        const w = queueUi.get(benchedQueue[i]);
        if (w) {
            try { mod.SetUITextLabel(w, mod.Message(SK().ffa.hud.queue_pos, i + 1)); } catch {}
        }
    }
}

function showQueueUi(player: mod.Player, id: number): void {
    if (queueUi.has(id)) return;
    const w = GameUI.text('benchq_' + id, mod.Message(SK().ffa.hud.queue_pos, benchedQueue.length), {
        pos: GameUI.vec(0, 90),
        size: GameUI.vec(500, 34),
        anchor: mod.UIAnchor.TopCenter,
        fontSize: 24,
        color: WHITE,
        receiver: player,
    });
    if (w) queueUi.set(id, w);
}

function hideQueueUi(id: number): void {
    const w = queueUi.get(id);
    if (w) {
        try { GameUI.deleteWidget(w); } catch {}
        queueUi.delete(id);
    }
}

// --- bench lifecycle --------------------------------------------------------
/** Bench a player: queue them, then force a deploy — the PARK happens in
 *  enforceBench() the moment that deploy lands. */
export function benchPlayer(player: mod.Player): void {
    try {
        const id = mod.GetObjId(player);
        if (benchedSet.has(id)) return;
        benchedQueue.push(id);
        benchedSet.add(id);
        try { mod.SetRedeployTime(player, 0); } catch {}
        try { mod.DeployPlayer(player); } catch {} // park applied on OnPlayerDeployed via enforceBench
        log(`benched ${id} (queue size ${benchedQueue.length})`);
    } catch {}
}

/**
 * Called FIRST in OnPlayerDeployed: a benched player's deploy is converted into
 * the PARKED state — frozen, invulnerable, stashed at the arena edge, freecam,
 * queue-position UI up. Returns true (caller must stop the normal deploy flow).
 */
export function enforceBench(player: mod.Player): boolean {
    try {
        const id = mod.GetObjId(player);
        if (!benchedSet.has(id)) return false;
        freezePlayer(player, true); // input-restrict everything (intro's proven freeze)
        try { mod.SetPlayerIncomingDamageFactor(player, 0); } catch {} // untouchable statue
        // NO TELEPORT: the engine deploys everyone at the stacked HQ point, and only
        // OUR marker-teleport moves actives into the arena. Skipping it leaves the
        // benched body parked at the HQ stack automatically — no park logic needed.
        if (BENCH_FREECAM) {
            try { mod.SetCameraTypeForPlayer(player, mod.Cameras.Free); } catch {}
        }
        showQueueUi(player, id);
        refreshQueueUi();
        log(`parked ${id} (frozen+invuln+freecam)`);
        return true;
    } catch {
        return false;
    }
}

export function isBenched(playerId: number): boolean {
    return benchedSet.has(playerId);
}

export function benchedCount(): number {
    return benchedQueue.length;
}

export function removeBenched(playerId: number): void {
    benchedSet.delete(playerId);
    hideQueueUi(playerId);
    const i = benchedQueue.indexOf(playerId);
    if (i >= 0) benchedQueue.splice(i, 1);
    refreshQueueUi();
}

/** Oldest benched playerId (FIFO), or null. */
export function peekBenched(): number | null {
    return benchedQueue.length > 0 ? benchedQueue[0] : null;
}

/** Promote to active: un-park completely (inputs, vulnerability, first-person
 *  camera, deploy rights) — the caller then seats + redeploys them. */
export function activate(player: mod.Player): void {
    try {
        removeBenched(mod.GetObjId(player));
        unfreezePlayer(player);
        try { mod.SetPlayerIncomingDamageFactor(player, 1); } catch {}
        try { mod.SetCameraTypeForPlayer(player, mod.Cameras.FirstPerson); } catch {}
        mod.EnablePlayerDeploy(player, true);
    } catch {}
}

/** Reset the bench (match end) and re-enable deploy for everyone. */
export function clearBench(): void {
    for (const id of [...benchedQueue]) hideQueueUi(id);
    benchedQueue.length = 0;
    benchedSet.clear();
    try {
        mod.EnableAllPlayerDeploy(true);
    } catch {}
    try {
        mod.SetCameraTypeForAll(mod.Cameras.FirstPerson); // no freecam stragglers into the next round
    } catch {}
}
