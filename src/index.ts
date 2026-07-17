// ============================================================================
// FFA GUNMASTER — ENTRY POINT (vertical slice 1)
// ============================================================================
// The 28-team FFA scheme (DESIGN.md): team 1 = landing zone (size 4), teams
// 2..28 = solo slots. Match start splits team 1 onto solo slots; bots keep a
// MIN_PLAYERS floor with persistent identities (name/stats/ladder survive
// respawns); humans replace bots as they join. First to finish the ladder wins.
//
// Slice 1: team split, bot backfill/replace, ladder + weapon give, anti-spawn-
// kill spawn picks (distance + rolling LOS danger), CustomFFA scoreboard, win.
// Later slices: amped FX tiers, promo/demo powerups, HUD/VO polish.
// ============================================================================

import { Events } from 'bf6-portal-utils/events/index.ts';
import { Timers } from 'bf6-portal-utils/timers/index.ts';

import { DEBUG_MODE } from './config.ts';
import { initSlots, splitLandingTeam, assignHumanToSlot, releaseHumanSlot, humanCount, botSlots } from './teams.ts';
import {
    adoptBotPlayer,
    allIdentities,
    backfillNeeded,
    despawnBot,
    getIdentity,
    identityByCurrentPlayerId,
    pickReplaceableBot,
    respawnBot,
    spawnBotIntoFreeSlot,
} from './roster.ts';
import { applyTierWeapon, onLadderKill, progressOf, removeHuman, resetLadder } from './ladder.ts';
import { initSpawns, pickSpawn, startLosSampler, stopLosSampler } from './spawns.ts';
import { cleanupAmped, clearAmpedState, initAmped, startAmpedDetector } from './amped.ts';

const SK = (): mod.Any => mod.stringkeys;

let matchOver = false;
let gameStarted = false;

// Human stats (bots carry theirs on the roster identity).
interface HumanStats {
    kills: number;
    deaths: number;
}
const humanStats: Map<number, HumanStats> = new Map();

// Bot bodies awaiting adoption: spawner-driven deploys are matched FIFO to
// identities that have no current body.
const pendingBotIdentityIds: number[] = [];

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[FFA] ${msg}`);
}

function statsOfHuman(playerId: number): HumanStats {
    let s = humanStats.get(playerId);
    if (!s) {
        s = { kills: 0, deaths: 0 };
        humanStats.set(playerId, s);
    }
    return s;
}

function updateScoreboardFor(player: mod.Player): void {
    try {
        const playerId = mod.GetObjId(player);
        const rec = progressOf(player);
        const isBot = mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier);
        const ident = isBot ? identityByCurrentPlayerId(playerId) : null;
        const kills = isBot ? (ident?.kills ?? 0) : statsOfHuman(playerId).kills;
        const deaths = isBot ? (ident?.deaths ?? 0) : statsOfHuman(playerId).deaths;
        // Columns: Gun # (1-based tier), Kills, Deaths — sorted by Gun #.
        mod.SetScoreboardPlayerValues(player, (rec?.ladderIndex ?? 0) + 1, kills, deaths);
    } catch {}
}

/** Best spawn position right now (falls back to a ring near origin pre-map-pass). */
function bestSpawnPos(excludePlayerId: number, salt: number): mod.Vector {
    const picked = pickSpawn(excludePlayerId);
    if (picked) return picked.pos;
    const angle = (salt % 12) * ((Math.PI * 2) / 12);
    return mod.CreateVector(Math.cos(angle) * 25, 0, Math.sin(angle) * 25);
}

function ensureBotFloor(): void {
    if (matchOver) return;
    let need = backfillNeeded();
    let guard = 0;
    while (need > 0 && guard < 30) {
        const ident = spawnBotIntoFreeSlot(bestSpawnPos(-1, allIdentities().length + guard));
        if (!ident) break;
        pendingBotIdentityIds.push(ident.id);
        need--;
        guard++;
    }
}

function announceAndEnd(winner: mod.Player): void {
    if (matchOver) return;
    matchOver = true;
    stopLosSampler();
    cleanupAmped();
    try {
        const winnerTeam = mod.GetTeam(winner);
        log('MATCH OVER — ladder complete');
        Timers.setTimeout(() => {
            try {
                mod.EndGameMode(winnerTeam);
            } catch {}
        }, 4000);
    } catch {}
}

// ============================================================================
// LIFECYCLE
// ============================================================================
Events.OnGameModeStarted.subscribe(() => {
    log('========== FFA GUNMASTER START ==========');
    matchOver = false;
    gameStarted = true;
    initSlots();
    resetLadder();
    initSpawns();
    startLosSampler();
    initAmped();
    startAmpedDetector();

    // Per-player FFA scoreboard: Gun # / Kills / Deaths, sorted by Gun #.
    try {
        mod.SetScoreboardType(mod.ScoreboardType.CustomFFA);
        mod.SetScoreboardColumnNames(
            mod.Message(SK().ffa.scoreboard.gun),
            mod.Message(SK().ffa.scoreboard.kills),
            mod.Message(SK().ffa.scoreboard.deaths)
        );
        mod.SetScoreboardColumnWidths(1, 1, 1);
        mod.SetScoreboardSorting(1, true);
    } catch {}

    // THE SPLIT: landing-team players -> their own solo slots (safe pre-deploy window).
    const everyone: mod.Player[] = [];
    try {
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        for (let i = 0; i < n; i++) everyone.push(mod.ValueInArray(arr, i) as mod.Player);
    } catch {}
    splitLandingTeam(everyone);

    // Fill to the floor with persistent-identity bots, then deploy everyone.
    ensureBotFloor();
    mod.SetSpawnMode(mod.SpawnModes.AutoSpawn);
    mod.DeployAllPlayers();
});

Events.OnPlayerJoinGame.subscribe((player: mod.Player) => {
    if (matchOver) return;
    try {
        if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return;
    } catch {}
    // Joiner lands on team 1 (it has room, incl. for parties). Seat on a solo
    // slot while still undeployed; if slots are full, the least-progressed bot
    // gives up its seat (human replaces bot — the 12-floor stays intact).
    Timers.setTimeout(() => {
        try {
            if (!mod.IsPlayerValid(player)) return;
            let teamId = assignHumanToSlot(player);
            if (teamId === null) {
                const sacrifice = pickReplaceableBot();
                if (sacrifice) {
                    despawnBot(sacrifice);
                    teamId = assignHumanToSlot(player);
                }
            }
            log(`joiner seated on solo team ${teamId ?? 'NONE (server full)'}`);
        } catch {}
    }, 500); // let the engine finish seating them on the landing team first
});

Events.OnPlayerDeployed.subscribe((player: mod.Player) => {
    if (matchOver) return;
    try {
        const playerId = mod.GetObjId(player);
        const isBot = mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier);

        if (isBot) {
            // Adopt this body into the oldest identity awaiting one.
            if (identityByCurrentPlayerId(playerId) === null && pendingBotIdentityIds.length > 0) {
                const identityId = pendingBotIdentityIds.shift() as number;
                adoptBotPlayer(player, identityId);
            }
        } else {
            // AutoSpawn placed them wherever — move to the best-scored spawn point.
            const pos = bestSpawnPos(playerId, playerId);
            try {
                mod.Teleport(player, pos, 0);
            } catch {}
        }

        // Everyone deploys with their current ladder card.
        applyTierWeapon(player);
        updateScoreboardFor(player);
    } catch {}
});

Events.OnPlayerEarnedKill.subscribe((killer: mod.Player, victim: mod.Player) => {
    if (matchOver) return;
    try {
        if (!mod.IsPlayerValid(killer)) return;
        const killerId = mod.GetObjId(killer);
        const victimId = mod.GetObjId(victim);
        if (killerId === victimId) return; // suicide

        // Stats.
        if (mod.GetSoldierState(killer, mod.SoldierStateBool.IsAISoldier)) {
            const ident = identityByCurrentPlayerId(killerId);
            if (ident) ident.kills++;
        } else {
            statsOfHuman(killerId).kills++;
        }

        // Ladder.
        const outcome = onLadderKill(killer);
        if (outcome === 'promoted') {
            applyTierWeapon(killer); // new gun on the spot, gun-game style
        } else if (outcome === 'finished') {
            updateScoreboardFor(killer);
            announceAndEnd(killer);
            return;
        }
        updateScoreboardFor(killer);
    } catch {}
});

Events.OnPlayerDied.subscribe((player: mod.Player) => {
    if (matchOver) return;
    try {
        const playerId = mod.GetObjId(player);
        if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) {
            const ident = identityByCurrentPlayerId(playerId);
            if (ident) {
                ident.deaths++;
                ident.currentPlayerId = null;
                // Respawn the SAME identity after a beat: same slot, same ladder spot,
                // spawner relocated to the current best-scored position.
                Timers.setTimeout(() => {
                    if (matchOver) return;
                    const still = getIdentity(ident.id);
                    if (still) {
                        pendingBotIdentityIds.push(still.id);
                        respawnBot(still, bestSpawnPos(-1, still.id));
                    }
                }, 3000);
            }
        } else {
            statsOfHuman(playerId).deaths++;
        }
        updateScoreboardFor(player);
    } catch {}
});

Events.OnPlayerLeaveGame.subscribe((playerId: number) => {
    releaseHumanSlot(playerId);
    removeHuman(playerId);
    clearAmpedState(playerId);
    humanStats.delete(playerId);
    // Refill the floor shortly after (not instantly mid-firefight).
    Timers.setTimeout(() => {
        if (!matchOver) ensureBotFloor();
    }, 2000);
    log(`player ${playerId} left; slot freed (humans=${humanCount()}, bots=${botSlots().length})`);
});
