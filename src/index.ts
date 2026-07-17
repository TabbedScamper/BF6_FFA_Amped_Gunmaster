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

import { DEBUG_MODE, SPAWN_PROTECTION_MS } from './config.ts';
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
import { applyTierWeapon, ladderLength, onLadderKill, progressOf, removeHuman, resetLadder } from './ladder.ts';
import { initSpawns, pickSpawn, startLosSampler, stopLosSampler } from './spawns.ts';
import { cleanupAmped, clearAmpedState, initAmped, startAmpedDetector } from './amped.ts';
import { clearBotState, startBotDirector, stopBotDirector } from './bots.ts';
import {
    clearPowerupState,
    initPowerups,
    onDeathBackfireDemotion,
    onKillOffloadDemotion,
    startPowerups,
    stopPowerups,
    setPowerupHud,
    hasPendingDemotion,
    trySpawnAtDeath,
} from './powerups.ts';
import { destroyAllHuds, destroyHud, ensureHud, flash, updateHud } from './hud.ts';
import { activate, benchPlayer, benchedCount, clearBench, enforceBench, isBenched, peekBenched, removeBenched } from './bench.ts';
import { announceFirstBlood, announceKillstreak, clearAnnouncements, STREAK_MILESTONES } from './announce.ts';
import { showResults, clearResults, type ResultRow } from './result-ui.ts';

const SK = (): mod.Any => mod.stringkeys;

let matchOver = false;
let gameStarted = false;
let firstBloodAwarded = false;
const killstreaks: Map<number, number> = new Map();

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

function announceAndEnd(winner: mod.Player, byTimeLimit: boolean = false): void {
    if (matchOver) return;
    matchOver = true;
    stopLosSampler();
    cleanupAmped();
    stopBotDirector();
    stopPowerups();
    clearAnnouncements();
    clearBench();
    // Custom VICTORY/DEFEAT leaderboard screen (per-player title + shared board + VO).
    try {
        showResults(buildResultRows(), mod.GetObjId(winner));
    } catch {}
    try {
        const winnerTeam = mod.GetTeam(winner);
        log(`MATCH OVER — ${byTimeLimit ? 'time limit (leader wins)' : 'ladder complete'}`);
        Timers.setTimeout(() => {
            destroyAllHuds();
            try {
                mod.EndGameMode(winnerTeam);
            } catch {}
        }, 6000);
    } catch {}
}

// Current leader among ACTIVE players: highest gun tier, tie-broken by kills.
function getLeader(): mod.Player | null {
    let best: mod.Player | null = null;
    let bestIdx = -1;
    let bestKills = -1;
    try {
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        for (let i = 0; i < n; i++) {
            const p = mod.ValueInArray(arr, i) as mod.Player;
            try {
                if (!mod.IsPlayerValid(p)) continue;
                const pid = mod.GetObjId(p);
                if (isBenched(pid)) continue;
                const idx = progressOf(p)?.ladderIndex ?? 0;
                const isBot = mod.GetSoldierState(p, mod.SoldierStateBool.IsAISoldier);
                const kills = isBot ? (identityByCurrentPlayerId(pid)?.kills ?? 0) : statsOfHuman(pid).kills;
                if (idx > bestIdx || (idx === bestIdx && kills > bestKills)) {
                    best = p;
                    bestIdx = idx;
                    bestKills = kills;
                }
            } catch {}
        }
    } catch {}
    return best;
}

// Snapshot every ACTIVE player's standing for the end-screen leaderboard.
function buildResultRows(): ResultRow[] {
    const rows: ResultRow[] = [];
    const total = ladderLength();
    try {
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        for (let i = 0; i < n; i++) {
            const p = mod.ValueInArray(arr, i) as mod.Player;
            try {
                if (!mod.IsPlayerValid(p)) continue;
                const pid = mod.GetObjId(p);
                if (isBenched(pid)) continue;
                const isBot = mod.GetSoldierState(p, mod.SoldierStateBool.IsAISoldier);
                const gun = (progressOf(p)?.ladderIndex ?? 0) + 1;
                const kills = isBot ? (identityByCurrentPlayerId(pid)?.kills ?? 0) : statsOfHuman(pid).kills;
                const deaths = isBot ? (identityByCurrentPlayerId(pid)?.deaths ?? 0) : statsOfHuman(pid).deaths;
                rows.push({ player: p, gun, total, kills, deaths });
            } catch {}
        }
    } catch {}
    rows.sort((a, b) => b.gun - a.gun || b.kills - a.kills);
    return rows;
}

// ============================================================================
// LIFECYCLE
// ============================================================================
Events.OnGameModeStarted.subscribe(() => {
    log('========== FFA GUNMASTER START ==========');
    matchOver = false;
    gameStarted = true;
    firstBloodAwarded = false;
    killstreaks.clear();
    clearResults();
    initSlots();
    resetLadder();
    initSpawns();
    startLosSampler();
    initAmped();
    startAmpedDetector();
    startBotDirector();
    initPowerups();
    startPowerups();
    setPowerupHud({ flash, refresh: updateHud });

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
                    if (sacrifice.currentPlayerId !== null) clearPowerupState(sacrifice.currentPlayerId);
                    despawnBot(sacrifice);
                    teamId = assignHumanToSlot(player);
                }
            }
            if (teamId === null) {
                // All 32 solo slots are human-held -> bench as a spectator.
                benchPlayer(player);
            } else {
                log(`joiner seated on solo team ${teamId}`);
            }
        } catch {}
    }, 500); // let the engine finish seating them on the landing team first
});

Events.OnPlayerDeployed.subscribe((player: mod.Player) => {
    if (matchOver) return;
    try {
        // Safety net: a benched player who slipped a deploy (spawn-on-friendly) is
        // instantly undeployed before we do anything else.
        if (enforceBench(player)) return;

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
            // Brief spawn protection so you don't die the instant you appear.
            try {
                mod.SetPlayerIncomingDamageFactor(player, 0);
                Timers.setTimeout(() => {
                    try {
                        if (mod.IsPlayerValid(player)) mod.SetPlayerIncomingDamageFactor(player, 1);
                    } catch {}
                }, SPAWN_PROTECTION_MS);
            } catch {}
        }

        // Everyone deploys with their current ladder card.
        applyTierWeapon(player);
        updateScoreboardFor(player);
        if (!isBot) {
            ensureHud(player);
            updateHud(player);
        }
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

        // First blood + killstreak callouts (lobby-wide banner).
        if (!firstBloodAwarded) {
            firstBloodAwarded = true;
            announceFirstBlood(killer);
        }
        const streak = (killstreaks.get(killerId) ?? 0) + 1;
        killstreaks.set(killerId, streak);
        if (STREAK_MILESTONES.includes(streak)) announceKillstreak(killer, streak);

        // Hot-potato: if the killer was carrying a demotion charge, dump it on the victim.
        onKillOffloadDemotion(killer, victim);

        // Ladder.
        const outcome = onLadderKill(killer);
        if (outcome === 'promoted') {
            applyTierWeapon(killer); // new gun on the spot, gun-game style
            flash(killer, 'PROMOTED!', 'green');
            updateHud(killer);
        } else if (outcome === 'finished') {
            updateScoreboardFor(killer);
            flash(killer, 'WINNER!', 'gold', 5000);
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
        // Hot-potato backfire: died still holding a demotion charge -> demote self.
        const backfire = hasPendingDemotion(playerId);
        onDeathBackfireDemotion(player);
        killstreaks.set(playerId, 0);
        // Weighted powerup drop at the death location (cooldown + chance inside).
        try {
            trySpawnAtDeath(mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition));
        } catch {}
        if (backfire > 0 && !mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) {
            flash(player, `DEMOTED!  −${backfire}  (died holding it)`, 'red', 2600);
        }
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
    const wasBenched = isBenched(playerId);
    const freedSoloTeam = releaseHumanSlot(playerId); // non-null if they held a solo slot
    removeHuman(playerId);
    removeBenched(playerId);
    clearAmpedState(playerId);
    clearBotState(playerId);
    clearPowerupState(playerId);
    destroyHud(playerId);
    humanStats.delete(playerId);

    // An ACTIVE player leaving freed a solo slot -> promote the oldest benched.
    if (!matchOver && !wasBenched && freedSoloTeam !== null && benchedCount() > 0) {
        promoteBenched();
    }

    // Refill the floor shortly after (not instantly mid-firefight).
    Timers.setTimeout(() => {
        if (!matchOver) ensureBotFloor();
    }, 2000);
    log(`player ${playerId} left (humans=${humanCount()}, bots=${botSlots().length}, benched=${benchedCount()})`);
});

// Move the oldest benched player into a free solo slot and deploy them.
function promoteBenched(): void {
    const id = peekBenched();
    if (id === null) return;
    const player = resolvePlayerById(id);
    if (!player) {
        removeBenched(id);
        return;
    }
    const teamId = assignHumanToSlot(player); // SetTeam onto the freed solo slot (undeployed = safe)
    if (teamId === null) return; // no slot after all — leave benched
    activate(player); // remove from bench + EnablePlayerDeploy(true)
    try {
        mod.DeployPlayer(player); // OnPlayerDeployed wires ladder/HUD/spawn
    } catch {}
    log(`promoted benched ${id} -> solo team ${teamId}`);
}

function resolvePlayerById(playerId: number): mod.Player | null {
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

// Time limit reached (portal page setting) -> the current LEADER wins, so a
// stalemate (nobody finishes the ladder) can never hang the match.
Events.OnTimeLimitReached.subscribe(() => {
    if (matchOver) return;
    const leader = getLeader();
    if (leader) {
        announceAndEnd(leader, true);
    } else {
        matchOver = true;
        try {
            mod.EndGameMode(mod.GetTeam(1));
        } catch {}
    }
});
