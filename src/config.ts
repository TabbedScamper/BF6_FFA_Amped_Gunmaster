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
