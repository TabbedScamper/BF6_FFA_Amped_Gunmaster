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
// CONTENTS (this file wires everything together; each is a "// ===" banner below):
//   • SFX ROUTING ....... promotion / demotion / finale stings + playSfx()
//   • MODULE STATE ...... match flags + the per-player bookkeeping maps
//   • HELPERS ........... deploy/respawn, spawn-pos pick, bot pump, team seating,
//                         teardown (stopAllLoops), leader + result-row builders
//   • LIFECYCLE ......... OnGameModeStarted — the big match-setup handler
//   • EVENT HANDLERS .... the match spine, in the order they fire:
//        OnPlayerJoinGame → OnPlayerDeployed → OnPlayerEarnedKill →
//        OnPlayerDied → OnPlayerLeaveGame → OnTimeLimitReached → OnPlayerDamaged
// New to the mode? Read ARCHITECTURE.md, then follow OnGameModeStarted top-to-bottom.
// ============================================================================

import { Events } from 'bf6-portal-utils/events/index.ts';
import { Timers } from 'bf6-portal-utils/timers/index.ts';

import { BUILD_TAG, DEBUG_MODE, BOT_BACKFILL_DELAY_MS, BOT_SPAWN_STAGGER_MS, SPATIAL_LOAD_POLL_S, SPATIAL_LOAD_MAX_TRIES, MAX_PLAYERS, BOT_COUNT, HUMAN_TEAM_BASE, BOT_TEAM_BASE, HUMAN_RESPAWN_MS, DEPLOY_RETRY_MS, DEPLOY_MAX_ATTEMPTS, BLACK_FADE_OUT_MS, BLACK_SETTLE_MS, BOT_RESPAWN_MS, READY_COUNTDOWN_S, MAP_CARD_DELAY_MS, DEMOTION_MAX_BACK, sfxVol } from './config.ts';
import { startIntro, onboardForIntro } from './intro.ts';
import { scheduleMapCard } from './map-card.ts';
import { markSpawned } from './bot-ai/spawn-protect.ts';
import { initMusic, musicOnFight, musicOnMatchEnd, announceFight, startTimeVO, announceFinaleAlarm, stopMusicSystem, streakMusicOnKill, streakMusicOnDeath, clearStreakMusic } from './music.ts';
import { initSlots, splitLandingTeam, assignHumanToSlot, releaseHumanSlot, slotOfHuman, humanCount, botSlots, isOnActiveTeam } from './teams.ts';
import { tlog, startLogFlush, stopLogFlush, logRosterSnapshot, logHostileDamage, teamOf, pidOf, isBotPlayer } from './test-log.ts';
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
import { applyTierWeapon, demotionLoss, giveStarterKnife, ladderLength, onFinaleTier, onLadderKill, onThrowingKnifeTier, progressOf, removeHuman, resetLadder, shiftTiers } from './ladder.ts';
import { initSpawns, pickSpawn, spawnCount, spawnMarkerPositions, startLosSampler, stopLosSampler } from './spawns.ts';
import { cleanupAmped, clearAmpedState, initAmped, startAmpedDetector } from './amped.ts';
import { clearBotState, notifyBotDamaged, startBotDirector, stopBotDirector } from './bots.ts';
import { aiCombatFlags } from './bot-ai/ai-flags.ts';
import {
    clearPowerupState,
    initPowerups,
    onDeathBackfireDemotion,
    onKillOffloadDemotion,
    startPowerups,
    stopPowerups,
    setPowerupHud,
    hasPendingDemotion,
    takeDemoCallout,
    takeLockCallout,
    trySpawnAtDeath,
} from './powerups.ts';
import { clearDemotionWarning, destroyAllHuds, destroyHud, endBlackHold, ensureHud, hideHud, refreshMiniBoard, screenFlash, setDemotionWarning, showCallout, showDemotionCallout, showDemotionLockedCallout, showGetAKill, showHud, showKillerDemotedVictim, showPowerupPromotion, showPromotion, showWinner, startBlackHold, updateHud, updateKillProgress } from './hud.ts';
import { activate, benchPlayer, benchedCount, clearBench, enforceBench, isBenched, peekBenched, removeBenched } from './bench.ts';
import { announceFirstBlood, announceKillstreak, clearAnnouncements, STREAK_MILESTONES, streakWordMessage } from './announce.ts';
import { showResults, clearResults, type ResultRow } from './result-ui.ts';

const SK = (): mod.Any => mod.stringkeys;

// ============================================================================
// SFX ROUTING — the one-shot UI stings (promotion / demotion / finale) and the
// playSfx() helper that spawns → plays → auto-cleans them. Amped WEAPON audio is
// separate (amped.ts); this is only the notification/prestige stings.
// ============================================================================
// Core gunmaster SFX, matched to the Undead Gunmaster archive (SFX_CONFIG).
const RS = mod.RuntimeSpawn_Common;
const SFX_PROMOTION = RS.SFX_UI_Notification_Primary_D_2D;
const SFX_DEMOTION = RS.SFX_UI_Gauntlet_Heist_EnemyCapturedCache_OneShot2D; // plays on the red demotion flash
const SFX_DEMOTION_ALT = RS.SFX_UI_Notification_SharedGamemode_GameModeCritical_OneShot2D; // 50/50 alt
const demotionSfx = (): mod.RuntimeSpawn_Common => (Math.random() < 0.5 ? SFX_DEMOTION : SFX_DEMOTION_ALT);
// Endgame stings: reaching the last guns should FEEL different from a normal promotion. The two
// non-knife finale guns share a "you're in the endgame / everyone's hunting you" cue; the final
// throwing-knife tier gets its own. Both run ~3.3-3.4s (see the 5000ms cleanup below — no cutoff).
// FINALE promotion stings — the last 3 guns escalate through the FieldUpgrade rank
// series IN ORDER: 3rd-from-last -> RankOne, 2nd-from-last -> RankTwo, knife -> RankFinal.
const SFX_FINALE_RANKS = [
    RS.SFX_UI_Notification_FieldUpgrade_RankOne_OneShot2D,   // 3rd-from-last (first finale gun)
    RS.SFX_UI_Notification_FieldUpgrade_RankTwo_OneShot2D,   // 2nd-from-last
    RS.SFX_UI_Notification_FieldUpgrade_RankFinal_OneShot2D, // LAST (throwing knife)
];
// A "safe"/reassuring tone for a demotion the lock fully blocked (green DEMOTION LOCKED respawn).
const SFX_LOCKED = RS.SFX_UI_Notification_ObjectiveSecured_FillIn_Positive_OneShot2D;
function playSfx(sfx: mod.RuntimeSpawn_Common, player: mod.Player, amp: number): void {
    try {
        const obj = mod.SpawnObject(sfx, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0)) as mod.SFX;
        mod.PlaySound(obj, sfxVol(amp), player);
        // Cleanup ONLY — no StopSound. 5s outlasts the longest sting we route through here (promotion
        // D_2D ~3.8s / finale ~3.4s), so nothing is clipped. The amped weapon is the sole cut sound.
        Timers.setTimeout(() => {
            try {
                mod.UnspawnObject(obj as unknown as mod.Object);
            } catch {}
        }, 5000);
    } catch {}
}

// ============================================================================
// MODULE STATE — match-wide flags + the per-player bookkeeping maps. (Bots carry
// their kills/deaths on the roster IDENTITY, not here; humanStats is humans-only.)
// ============================================================================
let matchOver = false;
let gameStarted = false;
let firstBloodAwarded = false;
let teamWatchdogInterval: number | null = null;
const killstreaks: Map<number, number> = new Map();
const RED_FLASH = mod.CreateVector(1, 0.15, 0.15); // demotion respawn screen-flash colour
const GREEN_FLASH = mod.CreateVector(0.2, 1, 0.35); // demotion-LOCKED respawn screen-flash (safe)
// victimId -> the engine id of whoever last killed them (for the kill-cam team swap on death).
const lastKiller: Map<number, number> = new Map();
// playerId -> their OWN solo team, for anyone CURRENTLY swapped onto their killer's team by the
// kill-cam. If the match ends while a player is mid-kill-cam, their restore timer is cancelled by
// matchOver — so we MUST restore them here before EndGameMode, or a victim the winner killed
// seconds before winning would be stranded on the winner's team and get the VICTORY callout.
const killcamSwapped: Map<number, number> = new Map();
// FALSE during the match-start intro (players frozen, HUD hidden, weapon withheld, no bots yet);
// flips TRUE at "FIGHT!". Gates bot spawning + the weapon-give-on-deploy so the intro owns them.
let matchLive = false;
const knifeFinishing: Set<number> = new Set(); // re-entrancy guard for the knife insta-kill

// Human stats (bots carry theirs on the roster identity).
interface HumanStats {
    kills: number;
    deaths: number;
}
const humanStats: Map<number, HumanStats> = new Map();

// Bot bodies awaiting adoption: spawner-driven deploys are matched FIFO to
// identities that have no current body.
const pendingBotIdentityIds: number[] = [];

// ============================================================================
// HELPERS — the plumbing the event handlers below lean on: deploy/respawn drivers,
// spawn-position pick, the staggered bot-spawn pump, human team-seating, teardown
// (stopAllLoops / announceAndEnd), and the leader + end-screen row builders.
// ============================================================================
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

/** Quick self-verifying force-deploy: after a human is undeployed (DEPLOY spawn mode), hammer
 *  DeployPlayer every DEPLOY_RETRY_MS until they're actually in the match (alive), then stop. This
 *  minimizes the deploy-screen flash — a single DeployPlayer can take a beat to land, so we re-assert
 *  until IsAlive confirms it took (or we hit DEPLOY_MAX_ATTEMPTS and give up). SetRedeployTime(0)
 *  before each attempt, or the deploy silently no-ops while a redeploy countdown is up. */
function forceDeployUntilAlive(player: mod.Player, attemptsLeft: number, onAlive?: () => void): void {
    // onAlive (fade out + flash) fires ONLY when the player is CONFIRMED in the match (IsAlive), or
    // as a last-resort after the give-up cap so they're never stuck black. If the player left or the
    // match ended, we do NOT fade — the overlay is cleared elsewhere (destroyHud / match end). This
    // guarantees the black never lifts before they're actually deployed.
    if (matchOver || !mod.IsPlayerValid(player)) return;
    try {
        let alive = false;
        try { alive = mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive); } catch {}
        if (alive) { if (onAlive) { try { onAlive(); } catch {} } return; } // CONFIRMED deployed
        try { mod.SetRedeployTime(player, 0); } catch {}
        try { mod.DeployPlayer(player); } catch {}
        if (attemptsLeft <= 1) { if (onAlive) { try { onAlive(); } catch {} } return; } // give-up safety
        Timers.setTimeout(() => forceDeployUntilAlive(player, attemptsLeft - 1, onAlive), DEPLOY_RETRY_MS);
    } catch {}
}

/** Best spawn position right now (falls back to a ring near origin pre-map-pass). */
function bestSpawnPos(excludePlayerId: number, salt: number): { pos: mod.Vector; yaw: number } {
    const picked = pickSpawn(excludePlayerId);
    if (picked) return { pos: picked.pos, yaw: picked.yaw };
    const angle = (salt % 12) * ((Math.PI * 2) / 12);
    return { pos: mod.CreateVector(Math.cos(angle) * 25, 0, Math.sin(angle) * 25), yaw: 0 };
}

// Bots are spawned ONE PER TICK (staggered), never all-at-once. Spawning 16 AI in one
// synchronous frame made the engine deploy them then cull all 16 ~1s later (Discord P18).
// A single pump loop reschedules itself until the bot floor is met; a guard flag stops
// overlapping pumps when ensureBotFloor is re-called (e.g. on a bot leaving).
let botPumpRunning = false;
function pumpBotSpawn(): void {
    if (matchOver || backfillNeeded() <= 0) {
        botPumpRunning = false;
        return;
    }
    const ident = spawnBotIntoFreeSlot(bestSpawnPos(-1, allIdentities().length).pos);
    if (ident) pendingBotIdentityIds.push(ident.id);
    Timers.setTimeout(pumpBotSpawn, BOT_SPAWN_STAGGER_MS); // next bot on a later tick
}
function ensureBotFloor(): void {
    if (matchOver || !matchLive || botPumpRunning) return; // no bots until the intro says "FIGHT!"
    if (backfillNeeded() <= 0) return;
    botPumpRunning = true;
    pumpBotSpawn();
}

/** Current valid, non-AI (human) players — the intro's freeze/UI targets. */
function humanPlayers(): mod.Player[] {
    const out: mod.Player[] = [];
    try {
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        for (let i = 0; i < n; i++) {
            const p = mod.ValueInArray(arr, i) as mod.Player;
            try {
                if (mod.IsPlayerValid(p) && !mod.GetSoldierState(p, mod.SoldierStateBool.IsAISoldier)) out.push(p);
            } catch {}
        }
    } catch {}
    return out;
}

/** Seat a human on a free team. Humans and bots share the 16 declared teams, so when the
 *  pool is full the surplus is a BOT — evict the lowest-progress bot (bots yield to
 *  humans) and retry. Returns the teamId, or null only when all 16 are held by HUMANS
 *  (caller then benches into the FIFO queue). */
function seatHumanEvictingBot(player: mod.Player): number | null {
    let teamId = assignHumanToSlot(player);
    if (teamId !== null) return teamId;
    const bot = pickReplaceableBot();
    if (bot) {
        despawnBot(bot); // frees its team; the human takes it
        teamId = assignHumanToSlot(player);
    }
    return teamId;
}

// Stop every recurring loop/timer the mod runs. MUST fire before the world tears down
// (match end OR host quitting a local match) — otherwise a 50ms/100ms/2s timer fires
// mid-teardown and calls into a dead engine, hard-crashing the game on leave.
let loopsStopped = false;
function stopAllLoops(): void {
    if (loopsStopped) return;
    loopsStopped = true;
    // STEP-BY-STEP logging: a HARD engine crash is NOT caught by try/catch, so the last
    // "STEP n" line written before the log ends names exactly which teardown call crashed.
    tlog('stopAllLoops STEP0: begin');
    matchOver = true; // also halts the self-rescheduling bot-spawn pump
    // TIMERS/STATE ONLY — never destroy engine objects at teardown. At match end / host exit
    // the engine is ALREADY tearing down the world; calling UnspawnObject / DeleteUIWidget on
    // an already-freed prop or widget is what hard-crashed the game on leave. We only stop our
    // recurring loops (so no timer fires into a dead engine) and let the engine reclaim its
    // own props, FX, and UI. (stopPowerups(false) clears its intervals but skips the despawns;
    // clearAnnouncements / cleanupAmped / destroyAllHuds are intentionally NOT called here.)
    tlog('stopAllLoops STEP1: stopLosSampler');
    try { stopLosSampler(); } catch {}
    tlog('stopAllLoops STEP2: stopBotDirector');
    try { stopBotDirector(); } catch {}
    tlog('stopAllLoops STEP3: stopPowerups(timers only)');
    try { stopPowerups(false); } catch {}
    tlog('stopAllLoops STEP4: stopLogFlush');
    try { stopLogFlush(); } catch {}
    tlog('stopAllLoops STEP5: watchdog');
    if (teamWatchdogInterval !== null) {
        try {
            Timers.clearInterval(teamWatchdogInterval);
        } catch {}
        teamWatchdogInterval = null;
    }
    tlog('stopAllLoops STEP6: DONE');
}

function announceAndEnd(winner: mod.Player, byTimeLimit: boolean = false): void {
    if (matchOver) return;
    stopAllLoops();
    stopMusicSystem(); // time-VO interval off
    musicOnMatchEnd(); // all per-player music off (results screen silent by design)
    // NO object cleanup at match end — cleanupAmped() (FX UnspawnObject) removed; the engine
    // reclaims FX/props/UI when the mode ends. Re-freeing them was crashing the game on exit.
    clearBench(); // state + re-enable deploy only (no object destruction)
    // KILL-CAM SAFETY: restore anyone still swapped onto their killer's team — their restore
    // timer was just cancelled by matchOver (set inside stopAllLoops). Without this, a victim
    // the winner killed seconds before winning is on the WINNER'S team right now and would get
    // the VICTORY callout at EndGameMode. They're dead/undeployed, so SetTeam sticks.
    for (const [pid, ownTeam] of killcamSwapped) {
        try {
            const p = resolvePlayerById(pid);
            if (p && mod.IsPlayerValid(p)) mod.SetTeam(p, mod.GetTeam(ownTeam));
        } catch {}
    }
    killcamSwapped.clear();
    // Custom VICTORY/DEFEAT leaderboard screen (per-player title + shared board + VO).
    try {
        showResults(buildResultRows(mod.GetObjId(winner)), mod.GetObjId(winner));
    } catch {}
    try {
        log(`MATCH OVER — ${byTimeLimit ? 'time limit (leader wins)' : 'ladder complete'}`);
        Timers.setTimeout(() => {
            // NO destroyAllHuds() here — deleting HUD widgets as the mode ends re-frees widgets
            // the engine is already tearing down (the exit crash). The engine clears all UI on
            // EndGameMode; our results screen shows over the HUD for the brief window until then.
            // End on the WINNER'S TEAM. In this true-FFA model every player is on their own
            // solo runtime team (see teams.ts), so the winner's team contains only them —
            // that team gets the VICTORY callout, everyone else DEFEAT. (This replaces the old
            // player-overload, which dated back to when the whole lobby shared one team.)
            try {
                mod.EndGameMode(mod.GetTeam(winner));
            } catch {
                try {
                    mod.EndGameMode(mod.GetTeam(0)); // winner gone (left?) -> draw
                } catch {}
            }
        }, 6000);
    } catch {}
}

// The engine is ending the mode (normal end OR the host quitting a local match) — halt
// every mod loop NOW so nothing fires into the tearing-down world (fixes the leave-crash).
Events.OnGameModeEnding.subscribe(() => {
    tlog('OnGameModeEnding FIRED');
    stopAllLoops();
    tlog('OnGameModeEnding: after stopAllLoops');
});

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
function buildResultRows(winnerId?: number): ResultRow[] {
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
    // The WINNER (got the last kill / finished the ladder) is ALWAYS #1 on the end screen — even if
    // another player is on the same top tier with more kills. Lift their row to the front after sorting.
    if (winnerId !== undefined) {
        const wi = rows.findIndex((r) => { try { return mod.GetObjId(r.player) === winnerId; } catch { return false; } });
        if (wi > 0) { const [w] = rows.splice(wi, 1); rows.unshift(w); }
    }
    return rows;
}

// ============================================================================
// LIFECYCLE
// ============================================================================
Events.OnGameModeStarted.subscribe(async () => {
    log(`========== FFA GUNMASTER START (build ${BUILD_TAG}) ==========`);
    initMusic(); // FIRST LINE OF BUSINESS: start the Radio package load + scheduled play attempts
    matchOver = false;
    matchLive = false; // the intro will flip this true at "FIGHT!"
    gameStarted = true;
    firstBloodAwarded = false;
    killstreaks.clear();
    lastKiller.clear();
    killcamSwapped.clear();
    // TRUE FFA: every human and bot is on its OWN runtime team (see teams.ts), so
    // everyone is already an enemy — friendly fire is OFF (no teammates exist to
    // teamkill; keeping it off also prevents a stray same-team hit if two entities
    // ever momentarily share the gate team).
    // AI->human damage is intentionally NOT set here — the Portal site's AI damage
    // setting governs how hard bots hit. (Calling SetAIToHumanDamageModifier would
    // override that slider.)
    try {
        mod.SetFriendlyFire(false);
    } catch {}
    clearResults();
    // Reset the bench and re-enable deploy for everyone. Guards against a spurious
    // pre-start bench: a player who joined before this event ran hit the join
    // handler while the slot table was still empty, got "no free slot," and was
    // wrongly benched (EnablePlayerDeploy false) -> black screen. Clearing here
    // un-benches them before the split + DeployAllPlayers below.
    clearBench();
    initSlots();
    resetLadder();
    initAmped();
    startAmpedDetector();
    // NOTE: startBotDirector() is deferred to "FIGHT!" (onFight below) so bots don't roam during
    // the frozen intro — they drop in when the match goes live.
    initPowerups();
    startPowerups();
    setPowerupHud({ refresh: updateHud, setDemotionWarning, clearDemotionWarning, powerupPromo: showPowerupPromotion, demoLoaded: showGetAKill });

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
    // Seat everyone present onto solo slots; OVERFLOW (more humans than MAX_PLAYERS
    // at match start) goes straight to the freecam bench with queue status.
    for (const p of splitLandingTeam(everyone)) benchPlayer(p);

    // Spatial marker objects don't register the instant the mode starts — reading a
    // marker position too early returns the phantom ~0,0,0 (this was the black-screen
    // cause: 0/32 markers -> no valid spawns). Proven fix (TDM): WAIT for spatial
    // objects to load before reading them. Poll initSpawns() until the markers appear
    // (or we hit the cap), THEN start the LOS sampler and deploy — so the very first
    // spawn already uses real marker coordinates.
    let tries = 0;
    do {
        initSpawns();
        if (spawnCount() > 0) break;
        await mod.Wait(SPATIAL_LOAD_POLL_S);
        if (matchOver) return;
    } while (++tries < SPATIAL_LOAD_MAX_TRIES);
    if (spawnCount() === 0) log('WARNING: no spawn markers loaded after wait — deploying at HQ');
    startLosSampler();

    // Deploy the human player(s) FIRST so they spawn in cleanly, THEN backfill bots
    // a beat later. Bots self-deploy via their AI spawners (they don't need
    // DeployAllPlayers), so the human's deploy never competes with a burst of bot
    // spawns at match start.
    // AUTOSPAWN for the countdown so everyone is spawned in cleanly for the intro (no deploy screen
    // up front). At "FIGHT!" we switch to DEPLOY: from then on a dead player goes to the deploy
    // screen and never auto-respawns, so OUR HUMAN_RESPAWN_MS timer owns the redeploy (we bounce them
    // past the deploy screen with an undeploy -> deploy loop; see OnPlayerDied).
    mod.SetSpawnMode(mod.SpawnModes.AutoSpawn);
    mod.DeployAllPlayers();
    // MATCH-START INTRO: freeze everyone + play the choreographed reveal synced to the sound,
    // then flip the match live at "FIGHT!" (which starts the bot director + spawns bots). If the
    // intro is disabled (READY_COUNTDOWN_S <= 0), go live immediately with no freeze.
    if (READY_COUNTDOWN_S > 0) {
        startIntro({
            humans: humanPlayers,
            giveWeapon: (p: mod.Player) => applyTierWeapon(p),
            onFight: () => {
                mod.SetSpawnMode(mod.SpawnModes.Deploy); // countdown over -> match mode (we own respawn)
                matchLive = true;
                musicOnFight(); // everyone's per-player music starts LOW (countdown stayed silent)
                announceFight(); // global "round start" VO
                startTimeVO(); // 120/60/30s warnings (only if the page set a time limit)
                startBotDirector();
                if (!matchOver) ensureBotFloor();
                // MAP CREDIT CARD — a few seconds after FIGHT (so the FIGHT sting clears first):
                // "MAP: <name>" then "MADE BY: ..." synced to the Gauntlet "Qualified" sting.
                scheduleMapCard(humanPlayers, MAP_CARD_DELAY_MS);
            },
        });
    } else {
        mod.SetSpawnMode(mod.SpawnModes.Deploy); // no countdown -> straight to match mode
        matchLive = true;
        musicOnFight();
        announceFight();
        startTimeVO();
        startBotDirector();
    }
    // ── FFA solo-team test: the round HAS started (this event fired). Arm the
    //    admin-log flush and snapshot each human's team once deploys settle.
    tlog(`ROUND START build=${BUILD_TAG} humans=${humanCount()} bots=${botSlots().length}`);
    // CONFIG assertion: MAX_PLAYERS must equal the number of capacity-4 teams you
    // declared on the portal page (solo teams HUMAN_TEAM_BASE..HUMAN_TEAM_BASE+MAX_PLAYERS-1).
    // If these don't match the portal page, you'll see mis-benching or shared teams.
    tlog(
        `CONFIG maxHumans=${MAX_PLAYERS} soloTeams=${HUMAN_TEAM_BASE}..${HUMAN_TEAM_BASE + MAX_PLAYERS - 1} ` +
            `botTarget=${BOT_COUNT} => declare ${MAX_PLAYERS} teams @cap4 on the portal page`
    );
    // TEAM VALIDITY PROBE (crash diag): does mod.GetTeam(id) resolve for the team ids the
    // mod targets? SetTeam fails "team input being invalid" if a team isn't declared, which
    // also blocks bot spawns. Each GetTeam in its own try so one bad id can't abort the loop.
    const probeTeams = (lo: number, hi: number, label: string): void => {
        const ok: number[] = [];
        const bad: number[] = [];
        for (let t = lo; t <= hi; t++) {
            let obj = -999;
            try {
                obj = mod.GetObjId(mod.GetTeam(t));
            } catch {
                obj = -999;
            }
            if (obj >= 0) ok.push(t);
            else bad.push(t);
        }
        tlog(`TEAMPROBE ${label}: valid=[${ok.join(',')}] invalid=[${bad.join(',')}]`);
    };
    probeTeams(HUMAN_TEAM_BASE, HUMAN_TEAM_BASE + MAX_PLAYERS - 1, 'human(1-16)');
    probeTeams(BOT_TEAM_BASE, BOT_TEAM_BASE + BOT_COUNT - 1, 'bot(50-65)');

    startLogFlush();
    Timers.setTimeout(() => {
        if (!matchOver) logRosterSnapshot('post-deploy');
    }, 1500);
    // SURVIVAL PROBE (crash/bot diag): how many bots are actually ALIVE in the world a few
    // seconds after spawn, vs how many identities the mod thinks exist. If liveBots is 0
    // (or << identities), the engine culled them (same-frame spawn = P18, or an AI/player
    // cap in the experience settings) — the staggered spawner + a higher cap should fix it.
    Timers.setTimeout(() => {
        if (matchOver) return;
        let liveBots = 0;
        let liveHumans = 0;
        try {
            const arr = mod.AllPlayers();
            const n = mod.CountOf(arr);
            for (let i = 0; i < n; i++) {
                const p = mod.ValueInArray(arr, i) as mod.Player;
                try {
                    if (!mod.IsPlayerValid(p)) continue;
                    if (mod.GetSoldierState(p, mod.SoldierStateBool.IsAISoldier)) liveBots++;
                    else liveHumans++;
                } catch {}
            }
        } catch {}
        tlog(`SURVIVAL@8s: liveBots=${liveBots} liveHumans=${liveHumans} botIdentities=${botSlots().length}`);
    }, 8000);
    Timers.setTimeout(() => {
        if (!matchOver) ensureBotFloor();
        // First standings draw once the lobby is populated. After this, standings
        // refresh ONLY on kills — the old 1s delete/recreate loop made it flicker.
        Timers.setTimeout(() => {
            if (!matchOver) {
                try {
                    refreshMiniBoard(buildResultRows());
                } catch {}
            }
        }, 2000);
    }, BOT_BACKFILL_DELAY_MS);

    // TEAM WATCHDOG: a single SetTeam at match start was NOT sticking (humans stayed
    // on gate team 1 while bots sat on team 2). Every 2s, force any non-benched human
    // who is NOT actually on team 2 through the full seat cycle (undeploy -> SetTeam ->
    // redeploy) until the engine agrees. assignHumanToSlot logs the engine's read-back
    // team so PortalLog shows whether each attempt stuck.
    if (teamWatchdogInterval === null) {
        teamWatchdogInterval = Timers.setInterval(() => {
            if (matchOver) return;
            try {
                const arr = mod.AllPlayers();
                const n = mod.CountOf(arr);
                for (let i = 0; i < n; i++) {
                    const p = mod.ValueInArray(arr, i) as mod.Player;
                    try {
                        if (!mod.IsPlayerValid(p)) continue;
                        if (mod.GetSoldierState(p, mod.SoldierStateBool.IsAISoldier)) continue;
                        const pid = mod.GetObjId(p);
                        if (isBenched(pid)) continue; // benched players stay queued
                        if (isOnActiveTeam(p)) continue; // engine agrees -> nothing to do
                        // Stuck off its solo team: clear stale bookkeeping, re-seat.
                        releaseHumanSlot(pid);
                        const teamId = seatHumanEvictingBot(p);
                        if (teamId !== null) {
                            try {
                                mod.DeployPlayer(p);
                            } catch {}
                            log(`watchdog: forced player ${pid} toward solo team ${teamId}`);
                        } else {
                            benchPlayer(p); // all 16 solo slots full -> FIFO queue
                        }
                    } catch {}
                }
            } catch {}
        }, 2000);
    }
});

// ============================================================================
// EVENT HANDLERS — the match spine, in roughly the order they fire per player:
// join → deploy → (kill / die) → leave, plus the time-limit and knife-finish hooks.
// (OnGameModeStarted above under LIFECYCLE is the one-time match-setup handler.)
// ============================================================================
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
            // Pre-start joiners are seated by splitLandingTeam() at match start, not
            // here. Running now (slots not yet initialized) would find "no free slot"
            // and wrongly BENCH them -> black screen. Bail until the match is live.
            if (!gameStarted) return;
            const teamId = seatHumanEvictingBot(player);
            if (teamId === null) {
                // All 16 solo slots taken -> bench into the FIFO spectator queue;
                // promoted (oldest first) when an active player leaves.
                benchPlayer(player);
            } else {
                // assignHumanToSlot UNDEPLOYED them to move onto their solo team -> redeploy.
                try {
                    mod.DeployPlayer(player);
                } catch {}
                log(`joiner seated on active team ${teamId}`);
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
        tlog(`DEPLOY id=${pidOf(player)} team=${teamOf(player)} isBot=${isBotPlayer(player)}`);

        const playerId = mod.GetObjId(player);
        const isBot = mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier);
        // ANTI-SPAWN-CAMP: start this player's target-immunity window so bots won't ACQUIRE them
        // for SPAWN_TARGET_IMMUNITY_MS (targeting-side only — see bot-ai/spawn-protect.ts).
        markSpawned(playerId);

        if (isBot) {
            if (identityByCurrentPlayerId(playerId) === null) {
                if (pendingBotIdentityIds.length > 0) {
                    // Brand-new bot: adopt into the oldest identity awaiting a body.
                    adoptBotPlayer(player, pendingBotIdentityIds.shift() as number);
                } else {
                    // RESPAWNED bot: respawnBot nulls currentPlayerId but nothing was
                    // re-adopting the new engine player -> the bot fell out of
                    // currentBots(), its brain never ticked again, and it stood still
                    // forever after its first death. Re-adopt by TEAM (each bot has a
                    // unique team, so the match is exact); fall back to any orphan.
                    let orphanId: number | null = null;
                    try {
                        const teamObj = mod.GetObjId(mod.GetTeam(player));
                        for (const ident of allIdentities()) {
                            if (ident.currentPlayerId !== null || ident.teamId === null) continue;
                            if (mod.GetObjId(mod.GetTeam(ident.teamId)) === teamObj) {
                                orphanId = ident.id;
                                break;
                            }
                            if (orphanId === null) orphanId = ident.id; // fallback: first orphan
                        }
                    } catch {}
                    if (orphanId !== null) adoptBotPlayer(player, orphanId);
                }
            }
            // Enable aim + fire; the bot DIRECTOR (bots.ts) drives target + movement
            // via AISetTarget (aim) + AIValidatedMoveToBehavior on a cadence. Do NOT
            // set AIBattlefieldBehavior — it's mutually exclusive with AISetTarget, and
            // without a target the bots don't aim (they missed everything).
            // FORCE: fresh engine body — prime the change-detect cache with a real call.
            aiCombatFlags(player, true, true, true);
            // FRESH placement AT MATERIALIZE TIME — same treatment as humans. The
            // AI_Spawner position is only where the engine first drops the bot, and it's
            // unreliable for spacing: (a) the respawnBot pick is ~1-2s stale by the time
            // the AI actually appears, so players can have walked into the "clear" spot;
            // (b) SetObjectTransform on the reused spawner may silently no-op (Discord:
            // several object types never move), which would pin every respawn to the
            // bot's FIRST marker while the picker protects the intended one. Re-pick and
            // Teleport NOW — the bot's position is decided the instant it exists, with a
            // live 20m bubble against everyone currently alive (and it faces the arena
            // centre like every other spawn).
            if (spawnCount() > 0) {
                const s = bestSpawnPos(playerId, playerId);
                try { mod.Teleport(player, s.pos, s.yaw); } catch {}
            }
        } else {
            // AutoSpawn placed them at their team HQ (a valid on-map spot). Only
            // override to a best-scored spawn marker if we actually loaded valid
            // markers — NEVER teleport into the void if marker reads failed (that's
            // the black-screen-on-spawn guard: a non-physical marker reports ~0,0,0,
            // i.e. world origin ~60m under this map).
            if (spawnCount() > 0) {
                const s = bestSpawnPos(playerId, playerId);
                try {
                    // Orient the player to the marker's facing (its yaw) so they spawn looking at
                    // the play area, not into a wall.
                    mod.Teleport(player, s.pos, s.yaw);
                } catch {}
            }
            // NOTE: no SetPlayerIncomingDamageFactor spawn protection — the 0->1 reset
            // was leaving players PERMANENTLY invincible (bots/players couldn't hurt a
            // human, but humans/bots still killed bots). Anti-spawn-kill is handled by
            // the distance/LOS-scored spawn markers instead. Re-add protection only via
            // a mechanism proven to reset (this one didn't).
            mod.SetPlayerIncomingDamageFactor(player, 1); // ensure normal damage intake
            // CAMERA RE-ASSERT: cures the corpus stuck-camera bug ("camera set while on
            // the deploy screen sticks for the rest of the game") — every real deploy
            // hard-resets to first person, so a promoted bench-freecam can never linger.
            try { mod.SetCameraTypeForPlayer(player, mod.Cameras.FirstPerson); } catch {}
        }

        // Everyone deploys with their current ladder card — EXCEPT during the intro, where they
        // hold ONLY a starter knife until the sound's weapon-give beat swaps in the full loadout.
        if (matchLive) applyTierWeapon(player);
        else giveStarterKnife(player);
        updateScoreboardFor(player);
        if (!isBot) {
            ensureHud(player);
            updateHud(player);
            if (!matchLive) {
                // Match hasn't gone live yet (intro): freeze + hide the HUD; the intro choreography
                // reveals it and gives the weapon on the beats. Covers late joiners mid-intro too.
                onboardForIntro(player);
            } else {
                showHud(player); // reveal the Custom UI again (it was hidden while dead/spectating)
                // DEMOTED respawn (undead-gunmaster style): red full-screen flash + the red
                // "DEMOTED / N GUNS" box takeover — queued when a demotion actually landed
                // (marked-kill victim OR own-charge backfire). The new lower tier is on the bar now.
                const demoted = takeDemoCallout(playerId);
                const lockedSave = takeLockCallout(playerId);
                if (demoted > 0) {
                    // Wait a beat so the player is FULLY deployed before the red screen flash +
                    // demotion SFX + DEMOTED box (firing mid-deploy looked/felt off).
                    Timers.setTimeout(() => {
                        if (matchOver || !mod.IsPlayerValid(player)) return;
                        try { playSfx(demotionSfx(), player, 2.0); } catch {} // 50/50 between the two demotion stings
                        screenFlash(player, RED_FLASH, 600);
                        showDemotionCallout(player, demoted);
                    }, 900); // after the black overlay fully clears (alive + settle + fade)
                } else if (lockedSave) {
                    // A demotion was applied but the demotion LOCK fully blocked it — the player kept
                    // their gun. Green screen flash + green "DEMOTION LOCKED" box + a "safe" sound.
                    Timers.setTimeout(() => {
                        if (matchOver || !mod.IsPlayerValid(player)) return;
                        try { playSfx(SFX_LOCKED, player, 2.0); } catch {}
                        screenFlash(player, GREEN_FLASH, 600);
                        showDemotionLockedCallout(player);
                    }, 900); // after the black overlay fully clears
                } else if (hasPendingDemotion(playerId) > 0) {
                    // Still carrying a live charge on respawn -> nag "GET A KILL!" (red cards persist).
                    showGetAKill(player);
                }
            }
        }
    } catch {}
});

Events.OnPlayerEarnedKill.subscribe((killer: mod.Player, victim: mod.Player) => {
    if (matchOver) return;
    try {
        if (!mod.IsPlayerValid(killer)) return;
        tlog(
            `KILL killer=${pidOf(killer)}(team ${teamOf(killer)}) victim=${pidOf(victim)}(team ${teamOf(victim)}) ` +
                `${teamOf(killer) !== teamOf(victim) ? 'HOSTILE OK' : '!! SAME team !!'}`
        );
        const killerId = mod.GetObjId(killer);
        const victimId = mod.GetObjId(victim);
        if (killerId === victimId) return; // suicide
        lastKiller.set(victimId, killerId); // kill-cam: spectate this killer on the victim's death

        // DEMOTION-CHARGE BOUNTY (captured NOW, before onKillOffloadDemotion clears the killer's
        // charge and before the victim's OnPlayerDied backfire clears theirs): a kill "involves a
        // charge" if the killer was carrying one (they clutched) OR the victim was (bounty kill).
        const killerHadCharge = hasPendingDemotion(killerId) > 0;
        const victimHadCharge = hasPendingDemotion(victimId) > 0;
        // If the VICTIM was carrying a charge, killing them backfires it (they lose guns) — preview
        // how many NOW, before the victim's death handler applies/clears it, so the KILLER'S callout
        // can show "DEMOTED <victim> -N" for this case too (not just offloading the killer's own charge).
        const victimChargeLoss = victimHadCharge ? demotionLoss(victim, hasPendingDemotion(victimId)) : 0;
        const beforeIdx = progressOf(killer)?.ladderIndex ?? 0;

        // Stats.
        const killerIsBot = mod.GetSoldierState(killer, mod.SoldierStateBool.IsAISoldier);
        if (killerIsBot) {
            const ident = identityByCurrentPlayerId(killerId);
            if (ident) ident.kills++;
        } else {
            statsOfHuman(killerId).kills++;
        }

        // Achievement callouts — HUMANS ONLY (bots are excluded from the notification
        // system). First blood goes to the first HUMAN kill (a bot never consumes it).
        if (!killerIsBot && !firstBloodAwarded) {
            firstBloodAwarded = true;
            announceFirstBlood(killer);
        }
        const streak = (killstreaks.get(killerId) ?? 0) + 1;
        killstreaks.set(killerId, streak);
        if (!killerIsBot) streakMusicOnKill(killer, streak); // volume ramps with the streak (caps 6 kills -> 2.0)
        if (!killerIsBot && STREAK_MILESTONES.includes(streak)) {
            announceKillstreak(killer, streak); // lobby-wide banner + escalating SFX. The box callout is
            // queued in priority order below (after any DEMOTED/PROMOTED notes), not shown here.
        }

        // Hot-potato: if the killer was carrying a demotion charge, dump it on the victim. The return
        // is the guns the victim actually lost (0 if none/locked) — drives the killer's callout below.
        const victimGunsKnocked = onKillOffloadDemotion(killer, victim);

        // Ladder.
        const outcome = onLadderKill(killer);
        if (outcome === 'finished') {
            updateScoreboardFor(killer);
            showWinner(killer); // gold "WINNER!" box note
            announceAndEnd(killer);
            return;
        }
        // Demotion-charge bounty: ONE extra instant promotion if this kill involved a charge —
        // additive on top of the normal ladder kill, so a "second kill" that already promoted now
        // skips the next gun too (net +2). Covers BOTH the killer-clutched and killed-a-carrier cases.
        if (killerHadCharge || victimHadCharge) shiftTiers(killer, 1);
        const gained = (progressOf(killer)?.ladderIndex ?? beforeIdx) - beforeIdx;
        if (gained > 0) {
            applyTierWeapon(killer); // new gun(s) on the spot, gun-game style
            // FIRST player to reach the finale guns: lobby-wide VO tension beat (the
            // finalist hears the winning line, everyone else the losing one). Once/match.
            if (onFinaleTier(killer)) announceFinaleAlarm(killer);
            if (!killerIsBot) {
                screenFlash(killer); // bright blue prestige pop
                // Tier-aware promotion sting: the final throwing-knife tier gets its own cue, the
                // other finale guns share the "endgame" cue, everything below is the normal one.
                // Last 3 guns escalate RankOne -> RankTwo -> RankFinal by ladder position
                // (fromEnd: 2 = first finale gun, 1 = second, 0 = the knife).
                const fromEnd = ladderLength() - 1 - (progressOf(killer)?.ladderIndex ?? 0);
                const promoSfx = fromEnd <= 2 ? SFX_FINALE_RANKS[2 - fromEnd] : SFX_PROMOTION;
                playSfx(promoSfx, killer, 2.0); // archive SFX_CONFIG.PROMOTION
            }
            updateHud(killer); // the promotion box note is queued in the ordered block below
        } else {
            updateKillProgress(killer); // cheap kills-text bump (no image rebuild)
        }
        // KILL CALLOUTS — queued so they play back-to-back in PRIORITY order (each ~3.6s):
        //   1) DEMOTED <victim> -N   (this kill dumped a demotion charge on the victim)
        //   2) PROMOTED +N           (this kill moved the killer up the ladder)
        //   3) killstreak milestone word
        // The blue promotion screen-flash + SFX already fired above; these are only the box notes.
        if (!killerIsBot) {
            // Guns the victim lost THIS kill — from offloading the killer's own charge (case A) or from
            // killing a charge-carrier whose charge backfires (case B). Show DEMOTED for either.
            const demotedVictimGuns = victimGunsKnocked > 0 ? victimGunsKnocked : victimChargeLoss;
            if (demotedVictimGuns > 0) showKillerDemotedVictim(killer, victim, demotedVictimGuns);
            if (gained > 0) showPromotion(killer, gained);
            if (STREAK_MILESTONES.includes(streak)) showCallout(killer, streakWordMessage(streak), streak);
        }
        updateScoreboardFor(killer);
        // Standings refresh ON KILLS ONLY (the old 1s loop flickered).
        try {
            refreshMiniBoard(buildResultRows());
        } catch {}
    } catch {}
});

Events.OnPlayerDied.subscribe((player: mod.Player) => {
    if (matchOver) return;
    try {
        const playerId = mod.GetObjId(player);
        // Clear the death-drop weapon pack (loot) so it doesn't litter the arena — gun-game gives
        // weapons via the ladder; players never pick up drops. UnspawnAllLoot is global (not per-
        // corpse) and does NOT touch our powerups (those are spawned objects, not loot). Wait 1s so
        // the pack has fully dropped/settled before we clear it.
        Timers.setTimeout(() => { if (!matchOver) { try { mod.UnspawnAllLoot(); } catch {} } }, 1000);
        // Hot-potato backfire: died still holding a demotion charge -> demote self (applies on
        // respawn; the red flash + SFX + DEMOTED box fire there via takeDemoCallout).
        onDeathBackfireDemotion(player);
        killstreaks.set(playerId, 0);
        streakMusicOnDeath(player); // streak broken -> their music stops, shared volume recomputed
        // Weighted powerup drop at the death location (cooldown + chance inside).
        try {
            trySpawnAtDeath(mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition));
        } catch {}
        // The red "DEMOTED / N GUNS" box takeover + screen flash + demotion SFX all fire on the
        // player's RESPAWN once they're fully deployed (queued via takeDemoCallout), not here.
        // RESPAWN — under DEPLOY spawn mode the engine sends the dead player to the deploy screen and
        // never auto-respawns, so OUR timers are the only redeploy clock. Bots respawn via their AI
        // spawner; humans get the undeploy->deploy bounce (below) after HUMAN_RESPAWN_MS.
        const diedBot = mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier);
        if (diedBot) {
            // Let the bot RAGDOLL (AISetUnspawnOnDead is false), THEN clear the corpse a couple
            // seconds later so bodies don't pile up — right before respawnBot spawns the fresh AI.
            // (This undeploy is corpse-cleanup only; bots don't spectate, so it doesn't touch the
            // spectator flow the human no-undeploy rule protects.)
            Timers.setTimeout(() => {
                if (matchOver) return;
                try { if (mod.IsPlayerValid(player)) mod.UndeployPlayer(player); } catch {}
            }, Math.max(1000, BOT_RESPAWN_MS - 500));
            const ident = identityByCurrentPlayerId(playerId);
            if (ident) {
                ident.deaths++;
                ident.currentPlayerId = null;
                // Respawn the SAME identity: same slot, same ladder spot, spawner relocated
                // to the current best-scored position.
                Timers.setTimeout(() => {
                    if (matchOver) return;
                    const still = getIdentity(ident.id);
                    if (still) {
                        pendingBotIdentityIds.push(still.id);
                        respawnBot(still, bestSpawnPos(-1, still.id).pos);
                    }
                }, BOT_RESPAWN_MS);
            }
        } else {
            statsOfHuman(playerId).deaths++;
            hideHud(player); // hide the Custom UI while dead (shown again on respawn)
            const ownTeam = slotOfHuman(playerId); // their tracked solo team (re-asserted on redeploy)
            lastKiller.delete(playerId);
            // DEPLOY spawn-mode respawn. Slam a black overlay up IMMEDIATELY and HOLD it (re-asserted so
            // it survives the death->deploy-screen UI transition) through the whole dead window. After
            // HUMAN_RESPAWN_MS: undeploy + hammer-deploy behind the black; once CONFIRMED alive, hold
            // BLACK_SETTLE_MS more (screen fully in-world) THEN quick-fade out. The red DEMOTED flash (if
            // any) fires on OnPlayerDeployed, timed to land after the fade clears.
            startBlackHold(player);
            Timers.setTimeout(() => {
                const endBlack = (): void => endBlackHold(player, BLACK_FADE_OUT_MS);
                // Confirmed alive (or gave up): keep black a beat so the screen finishes transitioning
                // to the world, THEN quick-fade out — fixes the deploy screen peeking through at the end.
                const release = (): void => { Timers.setTimeout(endBlack, BLACK_SETTLE_MS); };
                if (matchOver || !mod.IsPlayerValid(player)) { endBlack(); return; }
                try {
                    try { if (ownTeam !== null) mod.SetTeam(player, mod.GetTeam(ownTeam)); } catch {}
                    try { mod.SetRedeployTime(player, 0); } catch {}
                    try { mod.UndeployPlayer(player); } catch {}
                    forceDeployUntilAlive(player, DEPLOY_MAX_ATTEMPTS, release);
                } catch { endBlack(); }
            }, HUMAN_RESPAWN_MS);
        }
        updateScoreboardFor(player);
    } catch {}
});

Events.OnPlayerLeaveGame.subscribe((playerId: number) => {
    const wasBenched = isBenched(playerId);
    const freedSoloTeam = releaseHumanSlot(playerId); // non-null if they held a solo slot
    const wasHuman = freedSoloTeam !== null || wasBenched; // bots never hold a human slot/bench
    removeHuman(playerId);
    removeBenched(playerId);

    // LAST human leaving (host quitting) = the match is tearing down. Stop every loop and
    // BAIL before the heavy per-player cleanup below — deleting UI widgets / unspawning
    // objects mid-teardown is what hard-crashes the game on exit. The bookkeeping above
    // is cheap + safe; everything else can be skipped because the world is going away.
    tlog(`LEAVE pid=${playerId} wasHuman=${wasHuman} humansLeft=${humanCount()} benched=${benchedCount()}`);
    if (wasHuman && humanCount() === 0 && benchedCount() === 0) {
        tlog('LEAVE: last human -> stopAllLoops');
        stopAllLoops();
        return;
    }
    // Match already ending/over -> the engine is tearing the world down. Skip ALL per-player
    // object cleanup (destroyHud deletes UI widgets, clearPowerupState can unspawn) so we never
    // re-free something the engine already removed (the exit crash). Only cheap bookkeeping ran.
    if (matchOver) return;

    clearAmpedState(playerId);
    clearBotState(playerId);
    clearStreakMusic(playerId); // leaver's streak entry out of the shared-volume pool
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
    const teamId = seatHumanEvictingBot(player); // SetTeam onto a free / bot-vacated slot
    if (teamId === null) return; // no slot after all — leave benched
    activate(player); // un-park: inputs, vulnerability, first-person, deploy rights
    // CATCH-UP ENTRY: start at the LOWEST active ladder index (tied with last place)
    // WITH DEMOTION PROTECTION — peak is inflated so the floor sits AT the entry
    // index: early demotions get fully absorbed (green DEMOTION PROTECTION callout,
    // PROTECTED squares under the entry gun) instead of knocking a fresh player down.
    try {
        const rec = progressOf(player);
        if (rec) {
            let lowest = Number.MAX_SAFE_INTEGER;
            for (const r of buildResultRows()) {
                try { if (mod.GetObjId(r.player) !== id) lowest = Math.min(lowest, r.gun - 1); } catch {}
            }
            if (lowest === Number.MAX_SAFE_INTEGER) lowest = 0;
            rec.ladderIndex = lowest;
            rec.tierKills = 0;
            rec.peakIndex = lowest + DEMOTION_MAX_BACK; // floor = lowest -> protected at entry
        }
    } catch {}
    try {
        mod.SetRedeployTime(player, 0);
        mod.DeployPlayer(player); // OnPlayerDeployed wires weapon/HUD/spawn-teleport normally
    } catch {}
    // Announce their protected entry once the deploy has settled.
    Timers.setTimeout(() => {
        try { if (mod.IsPlayerValid(player) && !matchOver) showDemotionLockedCallout(player); } catch {}
    }, 1500);
    log(`promoted benched ${id} -> solo team ${teamId} (catch-up + protection)`);
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

// Final tier is the throwing knife, which the engine does NOT one-shot. When a
// player on the knife tier lands ANY hit (they only carry knives), finish the
// kill with lethal damage credited to THEM — so it instant-kills and the kill
// feed correctly shows the thrower.
Events.OnPlayerDamaged.subscribe((victim: mod.Player, giver: mod.Player) => {
    if (matchOver) return;
    try {
        if (!mod.IsPlayerValid(giver) || !mod.IsPlayerValid(victim)) return;
        logHostileDamage(victim, giver); // FFA test: proves cross-team hits register
        const vid = mod.GetObjId(victim);
        if (mod.GetObjId(giver) === vid) return; // no self-finish
        // Trigger-happy: a shot bot locks onto whoever shot it (Deadlock brain).
        notifyBotDamaged(victim, giver);
        // DAMAGE BOOST for the LAST weapon only (the throwing knife, which the engine won't one-shot):
        // any hit from a player currently on the knife tier instantly kills. Checked per-hit, so a
        // player who is demoted off the knife loses it and re-earns it automatically on ranking back up.
        // (The other finale guns — M250 / PSR — are real weapons and deal normal damage.)
        if (!onThrowingKnifeTier(giver)) return;
        if (knifeFinishing.has(vid)) return; // don't re-enter on our own damage
        if (!mod.GetSoldierState(victim, mod.SoldierStateBool.IsAlive)) return;
        knifeFinishing.add(vid);
        mod.DealDamage(victim, 1000, giver); // insane damage -> instant kill, credited to the finisher
        Timers.setTimeout(() => {
            knifeFinishing.delete(vid); // clear guard (survives async re-fire)
        }, 200);
    } catch {}
});
