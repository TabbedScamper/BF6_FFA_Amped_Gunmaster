// ============================================================================
// FFA GUNMASTER — CONFIGURATION
// ============================================================================
// The 28-team FFA scheme (see DESIGN.md):
//   - Portal page: 28 teams; TEAM 1 = size 4 (the LANDING ZONE where the engine
//     seats joiners/parties); teams 2..28 = size 1 (solo slots).
//   - At match start (and for every later joiner) team 1 is SPLIT: each player
//     is SetTeam'd onto their own empty solo slot, so EVERYONE is cross-team
//     hostile — true FFA with no friendly-fire dependency.
//   - Bots keep a MIN_PLAYERS floor, each on its own solo team, with persistent
//     identities (name + scoreboard row + ladder position survive respawns).
// ============================================================================

// The landing-zone team (portal page: size 4 so parties can seat before the split).
export const LANDING_TEAM_ID = 1;

// Solo slots: teams FIRST..LAST inclusive (portal page: size 1 each).
export const FIRST_SOLO_TEAM_ID = 2;
export const LAST_SOLO_TEAM_ID = 28; // 27 solo slots. VERIFY in-game: 28 teams supported.

// Minimum bodies in the match at all times — bots fill up to this, humans replace bots.
export const MIN_PLAYERS = 12;

// Hard cap of simultaneous participants we manage (solo slots bound this).
export const MAX_PLAYERS = 27;

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
