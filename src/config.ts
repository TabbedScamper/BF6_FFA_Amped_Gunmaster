// ============================================================================
// FFA GUNMASTER — CONFIGURATION
// ============================================================================
// The 32-team FFA scheme (portal site caps teams at 32). Portal page:
//   - TEAM 1 = size 4 (the GATE: where the engine seats joiners/parties, and
//     where over-capacity players are BENCHED as spectators).
//   - Teams 2..32 = size 1 => 31 SOLO slots (the 31 ACTIVE players).
//   - Total team capacity = 4 + 31 = 35 (31 active + up to 4 benched).
//
// Flow: a joiner lands on team 1, then gets SetTeam'd onto a free solo slot
// (pre-deploy = the safe SetTeam window) and plays — so every ACTIVE player is
// on their OWN team => clean FFA, NO friendly-fire dependency.
//   - Up to 31 active (the 31 solo teams).
//   - Joiners 32..35: no free solo slot => BENCHED on team 1 via
//     EnablePlayerDeploy(false) + spectate-anyone; promoted to a solo slot the
//     moment an active player leaves (proven pattern — deluca's S&D).
//   - The 36th join is blocked naturally by team capacity (all 35 slots full);
//     it auto-frees when someone leaves (we do NOT use the irreversible
//     DisablePlayerJoin).
// Set the experience's max-players to 35 (or whatever the site allows up to it).
// Bots (backfill to MIN_PLAYERS) only exist below 12 humans; benching only above
// 31 — never coincide.
// ============================================================================

// The gate team (portal page: size 4 — landing dock + bench for the overflow 4).
export const LANDING_TEAM_ID = 1;

// Solo slots: teams FIRST..LAST inclusive (portal page: size 1 each). 2..32 = 31 slots.
export const FIRST_SOLO_TEAM_ID = 2;
export const LAST_SOLO_TEAM_ID = 32;

// Minimum bodies in the match at all times — bots fill up to this, humans replace bots.
export const MIN_PLAYERS = 12;

// Max ACTIVE players (= number of solo teams). Extras are benched as spectators.
export const MAX_PLAYERS = 31;

// Brief invuln on (re)spawn so you don't die the instant you appear in a 31-player
// FFA. Full damage-immunity for a short window (via SetPlayerIncomingDamageFactor).
export const SPAWN_PROTECTION_MS = 1500;

// The match ends when someone FINISHES the ladder. If the portal page also sets a
// TIME LIMIT, OnTimeLimitReached ends it and the current LEADER (highest gun, then
// most kills) wins — so a stalemate can never hang the match.

// No friendly fire needed — every active player is on their own solo team.
export const REQUIRES_FRIENDLY_FIRE = false;

// ============================================================================
// LADDER
// ============================================================================
// Kills needed to advance one weapon tier.
export const KILLS_PER_TIER = 2;

// ▶ HOW MANY GUNS the match goes through (before the 2 gadget finale tiers).
//   Total ladder length = LADDER_GUN_TIERS + 2. Raise for a longer match.
export const LADDER_GUN_TIERS = 13;

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
// true: solo testing — force the full bot floor + verbose PortalLog telemetry.
// false: release — quiet logs, normal backfill.
export const DEBUG_MODE = true;

// ============================================================================
// AUDIO — MASTER SFX VOLUME (Deadlock pattern)
// ============================================================================
// One knob for every sound effect: all PlaySound call sites route their base
// volume through sfxVol(). PlayVO has NO volume parameter (SDK), so lowering
// SFX is what makes announcer lines stand out.
// ============================================================================
export const SFX_MASTER_VOLUME = 0.6;

export function sfxVol(base: number = 1.0): number {
    return base * SFX_MASTER_VOLUME;
}

// ============================================================================
// AMPED WEAPONS (cosmetic FX + sound, NO damage advantage — PvP-fair)
// ============================================================================
// FX firing uses a per-tick ammo-delta detector (no on-fired event in the SDK);
// each FX placement raycasts via the shared Raycast module. Cooldown throttles
// full-auto so we respect the ~1 raycast/tick budget (corpus-confirmed).
export const AMPED_FX_COOLDOWN_MS = 120; // min gap between FX raycasts per player
export const AMPED_HIT_SFX_AMP = 6.0; // base amplitude for the amped hit sound (routed via sfxVol)
export const AMPED_SOUND_CUTOFF_MS = 100; // crisp cutoff to avoid sound spam
export const AMPED_FX_RAY_RANGE = 500; // how far to look for a surface to place FX

// SIGNATURE AOE — the FX objects are purely visual, so these radius/DOT damage
// values are what actually makes the explosive/raygun/fire effects DO something.
// Applied to ALL soldiers (players AND bots) in radius, minus the shooter.
// DealDamage(target, dmg, attacker) credits the shooter -> ladder promotion works.
export const AMPED_EXPLOSION_RADIUS = 4; // M45A1 "CAMARO" explosive rounds
export const AMPED_EXPLOSION_DAMAGE = 55;
export const AMPED_RAYGUN_RADIUS = 4; // M44 raygun
export const AMPED_RAYGUN_DAMAGE = 50;
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
export const POWERUP_DROP_CHANCE = 0.1; // chance a given death drops a powerup
export const POWERUP_SPAWN_COOLDOWN_MS = 6000; // min gap between drops (whole match)
export const POWERUP_MAX_CONCURRENT = 4; // cap live powerups in the world
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
