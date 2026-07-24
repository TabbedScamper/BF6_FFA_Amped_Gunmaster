// ============================================================================
// FFA GUNMASTER — PERSISTENT BOT ROSTER (ported from Deadlock, extended)
// ============================================================================
// A bot identity owns: a name, a scoreboard row, kills/deaths, AND its ladder
// position — all of which survive the bot's death/respawn cycle, so the same
// "player" visibly climbs the gun ladder on the scoreboard. Bots enforce the
// MIN_PLAYERS floor and are replaced 1:1 by joining humans.
// ============================================================================

import { DEBUG_MODE, BOT_COUNT, MAX_PLAYERS } from './config.ts';
import { botSlots, claimSlotForBot, freeBotTeamId, releaseBotSlot, humanCount } from './teams.ts';

export interface BotIdentity {
    id: number;
    name: string;
    // live linkage
    currentPlayerId: number | null; // the engine player currently embodying this identity
    teamId: number | null; // solo slot currently claimed
    spawner: mod.Spawner | null; // runtime AI_Spawner owning this bot
    // persistent stats (survive respawns)
    kills: number;
    deaths: number;
    ladderIndex: number; // current gun tier
    tierKills: number; // kills toward next tier
}

// Deliberately deadpan competitive-lobby names.
// Bot names — the curated Deadlock roster (kept originals + top-active Portal
// Hub Discord members). Shuffle-bag draw; refills when exhausted.
const BOT_NAME_POOL: string[] = [
    // Kept from the original pool
    'Hope',
    'DaPa',
    'dfanz0r',
    'BMO',
    'Andy6170',
    'Boxshards',
    // Top-active Portal Hub Discord members
    'Ariistuujj',
    'Lemon64k',
    'Phiality',
    'mikedeluca_',
    'gala_vs',
    'nightfyre',
    'Guzma',
    'muj',
    'TonisGaming',
    'joslick76',
    'ty_ger07',
    'Cyphr',
    'Renette',
    'Markebarca',
    'Bennen',
    'TabbedScamper',
    'F4rus',
    'defined_edits',
];

const identities: Map<number, BotIdentity> = new Map();
let nextIdentityId = 1;
let shuffledNames: string[] = [];

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Roster] ${msg}`);
}

// On this template a RAW string in mod.Message renders as "unknown" — text must be
// a REGISTERED key. Bot names are flat top-level "bot_<slug>" keys; look up
// dynamically (flat top-level works; nested does not).
function botNameMessage(name: string): mod.Message {
    // Deadlock's exact form — renders "Hope [BOT]" in the game-native nametag/killfeed. A BARE
    // single-token raw string (mod.Message('Hope')) instead renders "unknown string" (the game
    // treats a single token as a failed string-KEY lookup), so the " [BOT]" suffix is required
    // to make it a literal. The stray "\[" the player saw is a SEPARATE issue: it's our custom
    // leaderboard escaping "[" in a UI-text widget (fixed there), NOT this native name.
    return mod.Message(name + ' [BOT]');
}

/**
 * Display name for ANY player in CUSTOM UI text. The engine SANITIZES dynamic
 * player-name substitution (mod.Message(player)) in custom UI-text widgets,
 * escaping markup chars — a bot's literal "Hope [BOT]" name rendered as
 * "Hope \[BOT]" on the TOP PLAYERS board. REGISTERED strings render brackets
 * literally, and strings.json already has a bot_<name> key per roster name —
 * so bots resolve through their registered key; humans keep Message(player).
 */
export function playerDisplayMessage(p: mod.Player): mod.Message {
    try {
        if (mod.GetSoldierState(p, mod.SoldierStateBool.IsAISoldier)) {
            const ident = identityByCurrentPlayerId(mod.GetObjId(p));
            if (ident) {
                // Key rule (matches strings.json): lowercase, trailing underscores
                // stripped ("mikedeluca_" -> bot_mikedeluca, "ty_ger07" -> bot_ty_ger07).
                const key = (mod.stringkeys as mod.Any)['bot_' + ident.name.toLowerCase().replace(/_+$/, '')];
                if (key !== undefined) return mod.Message(key);
            }
        }
    } catch {}
    return mod.Message(p);
}

function takeName(): string {
    if (shuffledNames.length === 0) {
        shuffledNames = [...BOT_NAME_POOL];
        for (let i = shuffledNames.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledNames[i], shuffledNames[j]] = [shuffledNames[j], shuffledNames[i]];
        }
    }
    return shuffledNames.pop() as string;
}

export function getIdentity(identityId: number): BotIdentity | null {
    return identities.get(identityId) ?? null;
}

export function identityByCurrentPlayerId(playerId: number): BotIdentity | null {
    for (const ident of identities.values()) {
        if (ident.currentPlayerId === playerId) return ident;
    }
    return null;
}

export function allIdentities(): BotIdentity[] {
    return [...identities.values()];
}

/** Link a freshly deployed AI player back to the identity that spawned it. */
export function adoptBotPlayer(bot: mod.Player, identityId: number): void {
    const ident = identities.get(identityId);
    if (!ident) return;
    try {
        ident.currentPlayerId = mod.GetObjId(bot);
        log(`identity ${ident.id} (${ident.name}) embodied by player ${ident.currentPlayerId}`);
    } catch {}
}

/**
 * Spawn a bot into a free solo slot via a runtime AI_Spawner (Deadlock pattern).
 * The identity persists; the engine player is disposable.
 */
export function spawnBotIntoFreeSlot(position: mod.Vector): BotIdentity | null {
    // Each bot gets its OWN team (3, 4, 5, ...) — natively hostile to everyone,
    // no friendly-fire / same-team-AI-damage dependency. Kept across respawns.
    const teamId = freeBotTeamId();
    if (teamId === null) {
        log('no free slot for bot');
        return null;
    }
    const ident: BotIdentity = {
        id: nextIdentityId++,
        name: takeName(),
        currentPlayerId: null,
        teamId,
        spawner: null,
        kills: 0,
        deaths: 0,
        ladderIndex: 0,
        tierKills: 0,
    };
    try {
        const team = mod.GetTeam(teamId);
        const spawner = mod.SpawnObject(
            mod.RuntimeSpawn_Common.AI_Spawner,
            position,
            mod.CreateVector(0, 0, 0)
        ) as unknown as mod.Spawner;
        // FALSE: keep the dead bot's body so it RAGDOLLS normally (TRUE made it instantly poof out
        // of existence on death). The corpse is cleared a beat later by the delayed undeploy in the
        // OnPlayerDied bot branch, before respawnBot spawns a fresh AI.
        mod.AISetUnspawnOnDead(spawner, false);
        ident.spawner = spawner;
        mod.SpawnAIFromAISpawner(spawner, mod.SoldierClass.Assault, botNameMessage(ident.name), team);
        identities.set(ident.id, ident);
        claimSlotForBot(teamId, ident.id);
        log(`bot ${ident.name} (identity ${ident.id}) -> own team ${teamId}`);
        return ident;
    } catch (e) {
        // Crash diag: surface WHY a bot failed (e.g. invalid bot team, no spawner).
        console.log(`[Roster] BOT SPAWN FAILED on team ${teamId}: ${e}`);
        return null;
    }
}

/** Respawn an existing identity's bot (same slot, same stats/ladder). */
export function respawnBot(ident: BotIdentity, position: mod.Vector): void {
    if (ident.teamId === null) return;
    try {
        const team = mod.GetTeam(ident.teamId);
        if (ident.spawner) {
            try {
                mod.SetObjectTransform(
                    ident.spawner as unknown as mod.Object,
                    mod.CreateTransform(position, mod.CreateVector(0, 0, 0))
                );
            } catch {}
            // Same registered-key name as the initial spawn — a raw string here left
            // every RESPAWNED bot nameless ("unknown string").
            mod.SpawnAIFromAISpawner(ident.spawner, mod.SoldierClass.Assault, botNameMessage(ident.name), team);
        }
        ident.currentPlayerId = null; // re-adopted on deploy
    } catch {}
}

/** Remove one bot (for human replacement or shutdown). Frees its slot. */
export function despawnBot(ident: BotIdentity): void {
    try {
        if (ident.currentPlayerId !== null) {
            // Best effort: undeploy the current body.
            // (Body lookup happens engine-side; stale ids are tolerated.)
        }
        if (ident.spawner) {
            try {
                mod.UnspawnAllAIsFromAISpawner(ident.spawner);
            } catch {}
            try {
                mod.UnspawnObject(ident.spawner as unknown as mod.Object);
            } catch {}
        }
    } catch {}
    releaseBotSlot(ident.id);
    identities.delete(ident.id);
    log(`bot ${ident.name} (identity ${ident.id}) despawned; slot freed`);
}

/** Pick the bot to sacrifice when a human needs a seat: lowest ladder progress. */
export function pickReplaceableBot(): BotIdentity | null {
    let pick: BotIdentity | null = null;
    for (const { identityId } of botSlots()) {
        const ident = identities.get(identityId);
        if (!ident) continue;
        if (
            pick === null ||
            ident.ladderIndex < pick.ladderIndex ||
            (ident.ladderIndex === pick.ladderIndex && ident.kills < pick.kills)
        ) {
            pick = ident;
        }
    }
    return pick;
}

/**
 * FILL-EMPTY-TEAMS bot target: bots occupy the declared teams humans haven't taken, so
 * the target is min(BOT_COUNT, free teams) = min(BOT_COUNT, MAX_PLAYERS - humans). As
 * humans join, the target shrinks and index.ts evicts the surplus bots. Spawned one per
 * tick (Discord P18: never same-frame multi-spawn).
 */
export function backfillNeeded(): number {
    const target = Math.min(BOT_COUNT, MAX_PLAYERS - humanCount());
    return Math.max(0, target - botSlots().length);
}
