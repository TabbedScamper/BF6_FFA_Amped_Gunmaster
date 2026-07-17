// ============================================================================
// FFA GUNMASTER — CONFIGURATION
// ============================================================================
// The 29-team FFA scheme (see DESIGN.md). Portal page:
//   - TEAM 1 = size 4 (the LANDING ZONE where the engine seats joiners/parties).
//   - Teams 2..29 = size 1 => 28 SOLO slots.
//   - Total capacity = 4 + 28 = 32 players.
//
// How the 4 landing slots + 28 solo slots reach 32 (the subtlety):
//   Team 1 is normally a REVOLVING DOOR — landers get SetTeam'd onto their own
//   solo slot (pre-deploy = the safe SetTeam window), so team 1 empties and
//   everyone is cross-team hostile (clean FFA, no friendly-fire dependency).
//   BUT if all 28 solo slots are taken (i.e. > 28 humans present), the extra
//   up-to-4 joiners STAY on team 1 together. For those few to fight each other
//   (same team), FRIENDLY FIRE must be ON in the portal settings.
//   => 29 teams supports the full 32. You do NOT need 32 or 33 teams.
//
// Why this is safe with bots: bots only exist below the MIN_PLAYERS floor
// (< 12 humans), and team-1 overflow only happens above 28 humans — the two
// never coincide, so a human never shares team 1 with a bot that won't shoot it.
// ============================================================================

// The landing-zone team (portal page: size 4 so a full 4-party can seat, then split).
export const LANDING_TEAM_ID = 1;

// Solo slots: teams FIRST..LAST inclusive (portal page: size 1 each). 2..29 = 28 slots.
export const FIRST_SOLO_TEAM_ID = 2;
export const LAST_SOLO_TEAM_ID = 29;

// Minimum bodies in the match at all times — bots fill up to this, humans replace bots.
export const MIN_PLAYERS = 12;

// Hard cap of simultaneous participants (28 solo homes + up to 4 sharing team 1).
export const MAX_PLAYERS = 32;

// REQUIRED portal setting when the lobby can exceed 28 humans: Friendly Fire ON
// (so the <=4 who share team 1 in the overflow case can damage each other).
export const REQUIRES_FRIENDLY_FIRE = true;

// ============================================================================
// LADDER
// ============================================================================
// Kills needed to advance one weapon tier.
export const KILLS_PER_TIER = 2;

// How many GUN tiers (base + amped, shuffled) before the gadget finale tiers.
// Total ladder length = LADDER_GUN_TIERS + (# of FINALE_TIERS, currently 2).
export const LADDER_GUN_TIERS = 13;

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
// Spawn at dedicated PHYSICAL marker props (0,0,0 rule) — ObjIds 201.. .
// PROMOTION: pick up -> immediately climb N tiers (N = 1/2/3).
// DEMOTION (hot potato): pick up -> your NEXT KILL demotes the victim N tiers;
//   but if you DIE first, the demotion backfires onto YOU (−N tiers).
export const POWERUP_MARKER_IDS: number[] = [201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212];
export const POWERUP_SPAWN_INTERVAL_MS = 18000; // try to spawn one this often
export const POWERUP_MAX_CONCURRENT = 3; // cap live powerups on the map
export const POWERUP_PICKUP_RADIUS = 2.5; // meters
export const POWERUP_LIFETIME_MS = 30000; // despawn if nobody grabs it
export const POWERUP_DEMOTION_CHANCE = 0.4; // 40% of spawns are demotions
export const POWERUP_MAGNITUDE_WEIGHTS = [0.6, 0.3, 0.1]; // P(1x), P(2x), P(3x)
