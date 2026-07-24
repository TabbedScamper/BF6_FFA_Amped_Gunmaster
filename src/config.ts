// ============================================================================
// FFA GUNMASTER — CONFIGURATION
// ============================================================================
// TRUE-FFA via RUNTIME SOLO TEAMS (no friendly fire). Every playing human AND
// bot sits on its OWN team, so everyone is natively hostile — proper red-diamond
// / health-bar / hit feedback, no teamkill stats. This is the exact scheme the
// bots already used successfully (roster.ts: each bot on its own team 3+); we now
// do the same for humans.
//
// HARD CONSTRAINT (proven in PortalLog 2026-07-18): SetTeam on a human ONLY works
// for teams DECLARED on the portal page — targeting an UNDECLARED team throws a
// "SwitchTeam" exception and the player stays put. (Bots dodge this because
// SpawnAIFromAISpawner INSTANTIATES them on the team; human switching can't.) So
// every solo team a human uses MUST be declared.
//
// (History: the "31 solo teams give no damage" conclusion was a SPAWN-PROTECTION
// bug, not a team/faction issue — fixed. Solo teams damage correctly.)
//
// Flow: a joiner lands on team 1 (the gate), then gets SetTeam'd onto its OWN
// DECLARED solo team (2, 3, 4, ...) pre-deploy (the safe SetTeam window) and plays.
// Over MAX_PLAYERS active => BENCHED on team 1, promoted onto a free solo team the
// moment a seat frees. Bots live on a high UNDECLARED range (50+), spawned via AI.
//
// PORTAL PAGE (every team CAPACITY 4 so a 4-party can host — we seat 1 each):
//   - TEAM 1        = capacity 4 (the GATE: seats joiners/parties, holds the bench).
//   - TEAM 2,3,4,.. = capacity 4 each, ONE per FFA slot (up to your max humans).
//   Friendly fire OFF. Max players = slots + bench headroom. Enable bot backfill if
//   you need small lobbies to START (separate from hosting — the round-start min).
// ============================================================================

// Build tag — printed in the match-start log line so PortalLog always proves WHICH
// build produced it (we lost a debugging day to an old bundle being tested).
export const BUILD_TAG = '2026-07-19ba-bench-overflow-at-start';

// (no dedicated gate team anymore — with 16 solo teams every declared team is a
// solo slot. Team 1 doubles as the bench-parking zone: benched spectators sit on
// whatever team the engine placed them, undeployed, so they never affect FFA.)

// HUMANS each get their OWN team starting here (2, 3, 4, ...). TWO hard rules,
// both proven in-game:
//  1. SetTeam on a human ONLY works for teams DECLARED on the portal page —
//     targeting an undeclared team throws "SwitchTeam" and no-ops (PortalLog
//     2026-07-18: SetTeam->100 failed 38/38, player stuck on team 1).
//  2. You CANNOT host with a party if ANY declared team's CAPACITY < party size:
//     the host check loops the teams and blocks. So every declared team must be
//     capacity >= 4.
// Reconciled: DECLARE 16 teams (1..16) EACH AT CAPACITY 4, one active human per team
// (16-player FFA). Capacity 4 passes the party host check; 1 deployed occupant per
// team gives solo-team hostility (no friendly fire). Total capacity 16*4 = 64 = the
// engine's player cap — the extra 3 slots/team are host-check padding + bench parking.
export const HUMAN_TEAM_BASE = 1;

// BOTS each get their OWN team starting here (50, 51, ...). Unlike humans, AI CAN be
// spawned onto UNDECLARED teams (SpawnAIFromAISpawner instantiates the team), so bots
// live on a HIGH range that is DISJOINT from the declared human range (2..49) — a
// human and a bot must never share a team id (that would make them friendly).
export const BOT_TEAM_BASE = 50;

// Bots FILL the empty declared teams (humans + bots share the 16-team pool, one per
// team). Actual bots = min(BOT_COUNT, MAX_PLAYERS - humans); bots yield their team to a
// joining human. So BOT_COUNT is the CAP on bots, not additive. Set 0 for pure-human.
export const BOT_COUNT = 16;

// Deploy human players FIRST at match start, then backfill bots this many ms later,
// so the player spawns in cleanly before a burst of bot spawns. Bots self-deploy via
// their AI spawners, so this delay doesn't hold anything else up.
export const BOT_BACKFILL_DELAY_MS = 1500;

// Bots MUST be spawned one-per-tick, never a same-frame burst — the BF6 engine won't
// keep AI multi-spawned in a single frame (Discord perf rule P18: they deploy then get
// culled ~1s later). ensureBotFloor spawns one bot per this interval until BOT_COUNT.
export const BOT_SPAWN_STAGGER_MS = 250;

// Spatial marker objects don't register the instant the mode starts — reading a
// marker's position too early returns the phantom ~0,0,0 (the proven TDM pattern is
// to WAIT before reading spatial positions). At match start we poll initSpawns()
// every POLL_S seconds until the markers load, up to MAX_TRIES, THEN deploy — so the
// very first spawn already uses real marker coordinates. Raise MAX_TRIES if a big map
// loads slowly.
export const SPATIAL_LOAD_POLL_S = 1;
export const SPATIAL_LOAD_MAX_TRIES = 10;

// Max ACTIVE HUMANS = number of declared solo teams (1..16). Humans beyond this are
// benched into a FIFO spectator queue and promoted (oldest first) when a slot frees.
// MUST equal the number of capacity-4 teams you declare on the portal page.
export const MAX_PLAYERS = 16;

// Benched (over-capacity) players get a FREECAM to fly around the map while they
// wait, instead of staring at a dead deploy screen. Restored to FirstPerson on
// promotion (and re-asserted on every deploy — corpus: cameras set while a player
// is on the deploy screen can get STUCK, so the deploy-side re-assert is the cure).
export const BENCH_FREECAM = true;

// Brief invuln on (re)spawn so you don't die the instant you appear in a 31-player
// FFA. Full damage-immunity for a short window (via SetPlayerIncomingDamageFactor).
export const SPAWN_PROTECTION_MS = 1500;

// ANTI-SPAWN-CAMP (targeting side): bots won't ACQUIRE a freshly-spawned player as a target for this
// long after they deploy, so nobody gets insta-locked the instant they materialize. Purely a
// targeting filter (bot-ai/spawn-protect.ts) — NOT damage immunity (that was removed for leaving
// players invincible). A fresh spawn that SHOOTS a bot still gets retaliation. Humans and bots.
export const SPAWN_TARGET_IMMUNITY_MS = 3000;

// ▶ SPAWN FACING: 'marker' copies each spawn marker's PLACED rotation (rotate the
// prop in Godot to aim the spawn — players face exactly where the marker points);
// 'center' ignores marker rotation and faces the arena centroid instead.
export type SpawnFacingMode = 'marker' | 'center';
export const SPAWN_FACING_MODE: SpawnFacingMode = 'marker';

// ▶ SPAWN Y-LIFT (meters). The spawn teleport uses each marker's pivot Y verbatim,
// so a marker buried in/under the terrain would drop players into the ground. This
// lift is ADDED to every marker's Y at teleport time, letting you sink the marker
// mesh out of sight (up to this depth) and still spawn players cleanly on top of it.
// Also a general safety cushion so nobody spawns clipped into the floor.
export const SPAWN_Y_LIFT = 1;

// The match ends when someone FINISHES the ladder. If the portal page also sets a
// TIME LIMIT, OnTimeLimitReached ends it and the current LEADER (highest gun, then
// most kills) wins — so a stalemate can never hang the match.

// No friendly fire needed — every active player is on their own solo team.
export const REQUIRES_FRIENDLY_FIRE = false;

// ============================================================================
// MUSIC + VOICE-OVER
// ============================================================================
// Lobby RADIO through the READY countdown + back under the results screen.
// Channels (official Aryo docs): 0 HipHop(17trk) 1 Rock(18) 2 BF-Themes(10)
// 3 Reggaeton(2) 4 Biome 5 Classical(32) 6 Pop(15). Tracks are 0-indexed.
// PER-PLAYER STREAK MUSIC (no countdown/lobby music by design): every human's music
// starts VERY LOW the moment they spawn into the live match, and each kill ramps it
// linearly — BASE_AMP at 0 kills up to MAX_AMP at CAP_KILLS. Death stops it; respawn
// restarts it at BASE. NOTE (official Aryo docs): the engine CLAMPS amplitude to 0-3,
// so values above 3 flatten — kept as configured so it self-heals if the clamp lifts.
// Known engine bug: the amplitude param is GLOBAL — the highest live streak drives the
// volume every listener hears (degrades to true per-player when DICE fix it).
export const MUSIC_ENABLED = true;
export const STREAK_MUSIC_ENABLED = true;
export const STREAK_MUSIC_CHANNEL = 1; // Rock (channels: 0 HipHop 1 Rock 2 BF-Themes 5 Classical 6 Pop)
// The match playlist: SHUFFLED fresh each match, queued in the shuffled order, and
// the queue loops — so every match runs a different rotation of these Rock tracks.
export const STREAK_MUSIC_TRACKS: number[] = [0, 1, 3, 10, 11, 15];
export const STREAK_MUSIC_BASE_AMP = 2.3; // spawn-in volume (0 kills)
export const STREAK_MUSIC_MAX_AMP = 4.0; // volume at CAP_KILLS (engine clamps to 3 for now)
export const STREAK_MUSIC_CAP_KILLS = 8; // full volume by the 8th kill

// VO beats: global "FIGHT!" call, 120/60/30s time warnings, and the finale alarm
// (finalist hears the winning line, everyone else the losing one).
export const VO_ENABLED = true;

// ============================================================================
// LADDER
// ============================================================================
// Kills needed to advance one weapon tier.
export const KILLS_PER_TIER = 2;

// ▶ HOW MANY GUNS the match goes through (before the finale gadget tiers).
//   Total ladder length = LADDER_GUN_TIERS + FINALE. Raise for a longer match.
//   0 = THE WHOLE ROSTER. The pool is now the full 92 UGZ variants (46 stock + 46 amped), so we
//   SAMPLE 47 of them each match (a fresh random draw) -> 47 + 3 finale = 50 tiers. Set 0 for a
//   marathon through all 92, or lower for a shorter match.
export const LADDER_GUN_TIERS = 47;

// ▶ ROTATION TYPE — what kind of gun progression each match uses:
//   'shuffled' : random mix of base + amped guns (default; fresh every match)
//   'classic'  : base guns in class order, pistols -> shotguns (skill ramp)
//   'amped'    : amped (FX) guns favored — the flashy playlist
//   'base'     : base guns only, shuffled (no amped FX tiers)
export type LadderRotation = 'shuffled' | 'classic' | 'amped' | 'base';
export const LADDER_ROTATION: LadderRotation = 'shuffled';

// Demotions can never push a player below tier 0.
// Promotion/demotion powerup magnitudes are 1/2/3 tiers (see powerups module).

// ============================================================================
// DEBUG
// ============================================================================
// Gates every `if (DEBUG_MODE) console.log(...)` in the mod. EACH console.log is a
// disk write to PortalLog — with 32 players a test match wrote ~5,000 [Ladder]/
// [Spawns]/[Roster]/[FFA] debug lines, real per-event I/O. Keep FALSE for release/
// perf; flip true only for a local solo debugging session.
export const DEBUG_MODE = true; // TEMP: diagnosing a match-start crash (checkpoints in log)

// ── FFA solo-team test instrumentation (test-log.ts). TEST_LOG prints [FFATEST]
//    lines (round start, per-human team, deploys, hostile kills/damage) and arms
//    SendPortalLogToAdmin() so an ONLINE ("Host") match streams the result to the
//    admin's PortalLog.txt. Set false for release. LOG_FLUSH_MS: admin-flush period
//    (quota applies per session — raise it if flushes stop arriving mid-test).
export const TEST_LOG = true; // TEMP: diagnosing match-start crash
export const LOG_FLUSH_MS = 15000;

// ============================================================================
// AUDIO — MASTER SFX VOLUME (Deadlock pattern)
// ============================================================================
// One knob for every sound effect: all PlaySound call sites route their base
// volume through sfxVol(). PlayVO has NO volume parameter (SDK), so lowering
// SFX is what makes announcer lines stand out.
// ============================================================================
export const SFX_MASTER_VOLUME = 0.4;

export function sfxVol(base: number = 1.0): number {
    return base * SFX_MASTER_VOLUME;
}

// ============================================================================
// RESPAWN  (DEPLOY spawn mode — WE own the redeploy clock)
// ============================================================================
// EXPERIMENT: SpawnMode is DEPLOY (was Spectating). On death a human waits
// HUMAN_RESPAWN_MS, then UndeployPlayer, and a QUICK loop hammers force-deploy
// (starting the SAME tick as the undeploy) every DEPLOY_RETRY_MS until they're
// actually in the match (alive) — minimizing the deploy-screen flash. SetRedeployTime(0)
// is set before each deploy or the force-deploy silently no-ops while a redeploy countdown
// is up (community-confirmed). Bots respawn via their AI spawner after BOT_RESPAWN_MS.
export const HUMAN_RESPAWN_MS = 4000; // dead human -> undeploy (start of the respawn cycle)
export const DEPLOY_RETRY_MS = 100; // quick force-deploy loop interval (re-tries until alive)
export const DEPLOY_MAX_ATTEMPTS = 40; // safety cap on the loop (~4s of retries) then give up
export const BLACK_FADE_OUT_MS = 250; // quick fade-out once the player is fully spawned back in
export const BLACK_SETTLE_MS = 400; // hold black this long AFTER confirmed-alive so the screen fully
// transitions in-world before the fade-out (fixes the deploy screen peeking through at the end)
export const BOT_RESPAWN_MS = 3000; // dead bot identity -> respawn via AI spawner
// KILL CAM: a Spectating-mode feature (spectate your killer). It does NOT apply under DEPLOY spawn
// mode (a dead player sits on the deploy screen, not a spectate cam), so it is currently disabled.
export const KILLCAM_ENABLED = false;
// "GET READY" freeze + countdown at match start (Deadlock-style): freezes humans, shows a big
// countdown + plays the tick/final SFX, then unfreezes and spawns the bots. Gives everyone a beat
// to join and get ready. Seconds; 0 disables the whole thing (match starts live immediately).
export const READY_COUNTDOWN_S = 15;

// MAP CREDIT CARD — after "FIGHT!", wait this long before the map-credit card + its sound plays,
// so the FIGHT sting (SFX_UI_Notification_Primary_G_2D) fully clears first and doesn't clash with
// the credit sound (SFX_UI_Gauntlet_EOM_Qualified_OneShot2D, ~5.5s). The card runs ~5.5s.
export const MAP_CARD_DELAY_MS = 2500;
// Demotion lock: a demotion can never drop a player more than this many guns below their
// CURRENT gun (relative floor). e.g. on gun 12 a big charge stops at gun 8; on gun 5 -> gun 1.
export const DEMOTION_MAX_BACK = 4;

// ============================================================================
// AMPED WEAPONS (cosmetic FX + sound, NO damage advantage — PvP-fair)
// ============================================================================
// FX firing uses a per-tick ammo-delta detector (no on-fired event in the SDK);
// each FX placement raycasts via the shared Raycast module. Cooldown throttles
// full-auto so we respect the ~1 raycast/tick budget (corpus-confirmed).
export const AMPED_FX_COOLDOWN_MS = 120; // min gap between FX raycasts per player
export const AMPED_HIT_SFX_AMP = 1.5; // amped hit sound volume — played RAW (bypasses the SFX master; >1 amplifies)
export const AMPED_SOUND_CUTOFF_MS = 500; // per-voice: how long each amped pop rings before it self-trims
export const AMPED_SOUND_VOICES = 3; // how many amped pops can OVERLAP; the (N+1)th steals the oldest voice
export const AMPED_FX_RAY_RANGE = 500; // how far to look for a surface to place FX

// SIGNATURE AOE — the FX objects are purely visual, so these radius/DOT damage
// values are what actually makes the explosive/raygun/fire effects DO something.
// Applied to ALL soldiers (players AND bots) in radius, minus the shooter.
// DealDamage(target, dmg, attacker) credits the shooter -> ladder promotion works.
export const AMPED_EXPLOSION_RADIUS = 5.5; // M45A1 "CAMARO" explosive rounds (slight range boost)
export const AMPED_EXPLOSION_DAMAGE = 70; // slight damage boost (was 55)
export const AMPED_RAYGUN_RADIUS = 5.5; // M44 raygun (slight range boost)
export const AMPED_RAYGUN_DAMAGE = 65; // slight damage boost (was 50)
export const AMPED_FIRE_RADIUS = 2.5; // shotgun fire splash
export const AMPED_FIRE_DOT_DAMAGE = 12; // per tick
export const AMPED_FIRE_DOT_TICKS = 4;
export const AMPED_FIRE_DOT_INTERVAL_MS = 700;

// Chain-freeze (the sniper signature) — rebuilt PLAYER-SAFE:
// SetSoldierEffect(FreezeStatusEffect) + SetPlayerMovementSpeedMultiplier work
// on humans AND bots (the old AI-only immobilize silently no-oped on humans).
// A fair slow, not a stunlock; no damage.
export const CHAIN_FREEZE_RADIUS = 6; // meters between chain hops
export const CHAIN_FREEZE_SLOW = 0.5; // movement-speed multiplier while frosted
export const CHAIN_FREEZE_DURATION_MS = 2000; // how long the frost/slow lasts
export const CHAIN_FREEZE_MAX_TARGETS = 4; // cap the chain (perf + balance)

// ============================================================================
// POWERUPS (promotion + demotion only — no nuke/perks)
// ============================================================================
// Drop at PLAYER DEATH LOCATIONS with a weighted rarity roll (the Undead model —
// no map markers needed; a player's death position is a valid physical coord).
// PROMOTION: pick up -> immediately climb N tiers (N = 1/2/3).
// DEMOTION (hot potato): pick up -> your NEXT KILL demotes the victim N tiers;
//   but if you DIE first, the demotion backfires onto YOU (−N tiers).
export const POWERUP_DROP_CHANCE = 0.35; // chance a given death drops a powerup
export const POWERUP_SPAWN_COOLDOWN_MS = 2000; // min gap between drops (whole match)
export const POWERUP_MAX_CONCURRENT = 10; // cap live powerups in the world
export const POWERUP_PICKUP_RADIUS = 2.5; // meters
export const POWERUP_LIFETIME_MS = 25000; // despawn if nobody grabs it

// Weighted drop table (relative weights; promotion slightly favored). Higher
// magnitudes are rarer. Trim/retune freely.
export interface PowerupDrop {
    kind: 'promo' | 'demo';
    magnitude: number;
    weight: number;
}
export const POWERUP_DROP_TABLE: PowerupDrop[] = [
    { kind: 'promo', magnitude: 1, weight: 30 },
    { kind: 'promo', magnitude: 2, weight: 16 },
    { kind: 'promo', magnitude: 3, weight: 7 },
    { kind: 'demo', magnitude: 1, weight: 22 },
    { kind: 'demo', magnitude: 2, weight: 12 },
    { kind: 'demo', magnitude: 3, weight: 6 },
];
