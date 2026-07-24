// ============================================================================
// FFA GUNMASTER — THE WEAPON LADDER
// ============================================================================
// Gun-game core: KILLS_PER_TIER kills advance you one tier; finish the last
// tier's kills to WIN. Everyone shares ONE shuffled ladder per match (fair —
// same guns, same order for all). Built each match from:
//   GUN_POOL (base cards) + AMPED_POOL (FX versions, shuffled THROUGHOUT)
//   -> shuffle, take LADDER_GUN_TIERS -> append FINALE_TIERS (hard gadgets).
//
// AMPED = cosmetic prestige: identical damage to the base gun, but drives the
// custom hit-FX + amped sounds (slice 3). NO damage advantage (PvP-fair).
//
// FINALE = gadget-only tiers (breach-charge launcher, then throwing knife) —
// the classic gun-game "earn it the hard way" ending.
//
// Progress lives OUTSIDE the engine player: humans keyed by playerId, bots on
// their persistent roster identity (so a bot keeps its gun through respawns).
// ============================================================================

import { Timers } from 'bf6-portal-utils/timers/index.ts';
import { KILLS_PER_TIER, LADDER_GUN_TIERS, LADDER_ROTATION, DEMOTION_MAX_BACK, DEBUG_MODE } from './config.ts';
import { identityByCurrentPlayerId } from './roster.ts';

const A = mod.WeaponAttachments;
const W = mod.Weapons;
const G = mod.Gadgets;

// REAL weapon names (no funky renames). Amped tiers render as "AMPED <name>".
// Displayed on the top weapon bar + current-weapon card via mod.Message(string).
const WEAPON_NAMES: Map<mod.Weapons, string> = new Map<mod.Weapons, string>([
    [W.AssaultRifle_AK4D, 'AK4D'],
    [W.AssaultRifle_KORD_6P67, 'KORD 6P67'],
    [W.AssaultRifle_M433, 'M433'],
    [W.AssaultRifle_VCR_2, 'VCR-2'],
    [W.LMG_M250, 'M250'],
    [W.Sniper_PSR, 'PSR'],
    [W.Carbine_AK_205, 'AK-205'],
    [W.Carbine_M277, 'M277'],
    [W.Carbine_M4A1, 'M4A1'],
    [W.Carbine_SOR_300SC, 'SOR-300SC'],
    [W.DMR_GRT_CPS, 'GRT CPS'],
    [W.DMR_M39_EMR, 'M39 EMR'],
    [W.LMG_DRS_IAR, 'DRS IAR'],
    [W.LMG_L110, 'L110'],
    [W.LMG_M121_A2, 'M121 A2'],
    [W.LMG_M_60, 'M60'],
    [W.SMG_CZ3A1, 'CZ3A1'],
    [W.SMG_KV9, 'KV9'],
    [W.SMG_SGX, 'SGX'],
    [W.SMG_UMG_40, 'UMG-40'],
    [W.Shotgun__185KS_K, '185KS-K'],
    [W.Sidearm_ES_57, 'ES-57'],
    [W.Sidearm_GGH_22, 'GGH-22'],
    [W.Sidearm_M44, 'M44'],
    [W.Sidearm_M45A1, 'M45A1'],
    [W.Sidearm_P18, 'P18'],
    [W.Sidearm_VZ_61, 'VZ-61'],
    [W.Sniper_M2010_ESR, 'M2010 ESR'],
    [W.Sniper_Mini_Scout, 'MINI SCOUT'],
    [W.Sniper_SV_98, 'SV-98'],
    // Rest of the 46-gun UGZ roster — without these the bar/card fell back to "0".
    [W.AssaultRifle_B36A4, 'B36A4'],
    [W.AssaultRifle_SOR_556_Mk2, 'SOR-556'],
    [W.AssaultRifle_TR_7, 'TR-7'],
    [W.AssaultRifle_NVO_228E, 'NVO-228E'],
    [W.AssaultRifle_L85A3, 'L85A3'],
    [W.Shotgun_M87A1, 'M87A1'],
    [W.Shotgun_M1014, 'M1014'],
    [W.Sidearm_M357_Trait, 'M357'],
    [W.DMR_LMR27, 'LMR27'],
    [W.DMR_SVK_86, 'SVK-86'],
    [W.DMR_SVDM, 'SVDM'],
    [W.LMG_RPKM, 'RPKM'],
    [W.LMG_M123K, 'M123K'],
    [W.LMG_KTS100_MK8, 'KTS100 MK8'],
    [W.LMG_M240L, 'M240L'],
    [W.SMG_PW5A3, 'PW5A3'],
    [W.SMG_PW7A2, 'PW7A2'],
    [W.SMG_USG_90, 'USG-90'],
    [W.SMG_SCW_10, 'SCW-10'],
    [W.SMG_SL9, 'SL9'],
    [W.Carbine_M417_A2, 'M417 A2'],
    [W.Carbine_GRT_BC, 'GRT-BC'],
    [W.Carbine_QBZ_192, 'QBZ-192'],
    [W.Carbine_SG_553R, 'SG-553R'],
]);
const GADGET_NAMES: Map<mod.Gadgets, string> = new Map<mod.Gadgets, string>([
    [G.Launcher_Breaching_Projectile, 'BREACH LAUNCHER'],
    [G.Throwable_Throwing_Knife, 'THROWING KNIFE'],
]);

/** The real display name for a tier: "AMPED M45A1", "M4A1", "THROWING KNIFE", … */
export function tierDisplayName(tier: LadderTier | null): string {
    if (!tier) return '';
    if (tier.gadget !== undefined) return GADGET_NAMES.get(tier.gadget) ?? 'GADGET';
    if (tier.weapon !== undefined) {
        const base = WEAPON_NAMES.get(tier.weapon) ?? 'WEAPON';
        return tier.isAmped ? `AMPED ${base}` : base;
    }
    return '';
}

export interface LadderTier {
    // Gun tier: set `weapon`. Gadget-finale tier: set `gadget` + `slot`.
    weapon?: mod.Weapons;
    gadget?: mod.Gadgets;
    slot?: mod.InventorySlots;
    cardName: string;
    attachments?: mod.WeaponAttachments[];
    isAmped?: boolean; // drives the amped FX/sound system (slice 3)
}

// ---------------------------------------------------------------------------
// BASE GUN POOL — validated attachments (families checked against each weapon).
// Optics/lasers are universal (family-agnostic); barrels/mags are family-locked.
// Includes the 5 weapons added since the old mode: VCR-2, GRT CPS, M121 A2,
// CZ3A1, VZ-61.
// ---------------------------------------------------------------------------
const GUN_POOL: LadderTier[] = [
    // Full 46-weapon STOCK roster imported from Undead Ground Zero (exact stock attachment loadouts).
    { weapon: W.AssaultRifle_M433, cardName: 'HR APPROVED', attachments: [A.Barrel_145_Standard, A.Magazine_20rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.AssaultRifle_B36A4, cardName: 'B36A4', attachments: [A.Barrel_480mm_Factory, A.Magazine_20rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.AssaultRifle_SOR_556_Mk2, cardName: 'SOR-556', attachments: [A.Barrel_145_Factory, A.Magazine_20rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.AssaultRifle_AK4D, cardName: 'OLD RELIABLE', attachments: [A.Barrel_450mm_Factory, A.Magazine_15rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.AssaultRifle_TR_7, cardName: 'TR-7', attachments: [A.Barrel_17_Factory, A.Magazine_10rnd_Fast_Mag, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.AssaultRifle_KORD_6P67, cardName: 'SIBERIAN EXPRESS', attachments: [A.Barrel_415mm_Factory, A.Magazine_30rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.AssaultRifle_NVO_228E, cardName: 'NVO-228E', attachments: [A.Barrel_409mm_Factory, A.Magazine_20rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.AssaultRifle_L85A3, cardName: 'L85A3', attachments: [A.Barrel_518mm_Factory, A.Magazine_20rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Shotgun_M87A1, cardName: 'THE LANDLORD', attachments: [A.Barrel_20_Factory, A.Magazine_5_Shell_Tube, A.Ammo_Buckshot, A.Scope_Iron_Sights] },
    { weapon: W.Shotgun_M1014, cardName: 'M1014', attachments: [A.Barrel_185_Factory, A.Magazine_4_Shell_Tube, A.Ammo_Buckshot, A.Scope_Iron_Sights] },
    { weapon: W.Shotgun__185KS_K, cardName: 'SEVERANCE PACKAGE', attachments: [A.Barrel_430mm_Factory, A.Magazine_4rnd_Magazine, A.Ammo_Buckshot, A.Scope_Iron_Sights] },
    { weapon: W.Sidearm_P18, cardName: 'GLITTER PEN', attachments: [A.Barrel_39_Factory, A.Magazine_17rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Sidearm_ES_57, cardName: 'STAPLE GUN', attachments: [A.Barrel_122mm_Factory, A.Magazine_20rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Sidearm_M45A1, cardName: 'THE ACCOUNTANT', attachments: [A.Barrel_5_Factory, A.Bottom_Laser_Light_Combo_Green, A.Magazine_7rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Sidearm_M44, cardName: 'HIGH NOON', attachments: [A.Barrel_675_Factory, A.Magazine_6rnd_Speedloader, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Sidearm_M357_Trait, cardName: 'M357', attachments: [A.Barrel_5_Factory, A.Magazine_8rnd_Speedloader, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Sniper_M2010_ESR, cardName: 'PERFORMANCE REVIEW', attachments: [A.Barrel_24_Full, A.Magazine_5rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Sniper_SV_98, cardName: 'WHITE FEATHER', attachments: [A.Barrel_650mm_Factory, A.Magazine_10rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Sniper_PSR, cardName: 'LAST WARNING', attachments: [A.Barrel_26_Factory, A.Magazine_7rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.DMR_M39_EMR, cardName: 'SCENIC ROUTE', attachments: [A.Barrel_22_Factory, A.Magazine_15rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.DMR_LMR27, cardName: 'LMR27', attachments: [A.Barrel_215_Factory, A.Bottom_Factory_Angled, A.Magazine_10rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.DMR_SVK_86, cardName: 'SVK-86', attachments: [A.Barrel_560mm_Factory, A.Magazine_10rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.DMR_SVDM, cardName: 'SVDM', attachments: [A.Barrel_550mm_Factory, A.Magazine_5rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.LMG_L110, cardName: 'PINK SLIP', attachments: [A.Barrel_349mm_SB, A.Magazine_100rnd_Belt_Pouch, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.LMG_DRS_IAR, cardName: 'SUPPRESSING OPINION', attachments: [A.Barrel_165_Basic, A.Magazine_30rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.LMG_M_60, cardName: 'COMPANY PICNIC', attachments: [A.Barrel_17_Factory, A.Magazine_50rnd_Loose_Belt, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.LMG_RPKM, cardName: 'RPKM', attachments: [A.Barrel_590mm_Factory, A.Magazine_30rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.LMG_M123K, cardName: 'M123K', attachments: [A.Barrel_612mm_VMW, A.Magazine_100rnd_Belt_Pouch, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.LMG_M250, cardName: 'OVERTIME', attachments: [A.Barrel_556mm_Prototype, A.Magazine_50rnd_Belt_Pouch, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.LMG_KTS100_MK8, cardName: 'KTS100 MK8', attachments: [A.Barrel_508mm_Mk8, A.Magazine_45rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.LMG_M240L, cardName: 'M240L', attachments: [A.Barrel_20_Lima, A.Magazine_50rnd_Loose_Belt, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.SMG_SGX, cardName: 'VENDING MACHINE', attachments: [A.Barrel_6_Standard, A.Magazine_30rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.SMG_PW5A3, cardName: 'PW5A3', attachments: [A.Barrel_225mm_Factory, A.Magazine_20rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.SMG_PW7A2, cardName: 'PW7A2', attachments: [A.Barrel_180mm_Standard, A.Magazine_20rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.SMG_UMG_40, cardName: 'OFFICE MEMO', attachments: [A.Barrel_200mm_Factory, A.Magazine_25rnd_Magazine, A.Ammo_FMJ, A.Scope_CQB_Sights] },
    { weapon: W.SMG_USG_90, cardName: 'USG-90', attachments: [A.Barrel_264mm_Factory, A.Magazine_50rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.SMG_KV9, cardName: 'SEWING MACHINE', attachments: [A.Barrel_55_Factory, A.Magazine_17rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.SMG_SCW_10, cardName: 'SCW-10', attachments: [A.Barrel_68_Factory, A.Magazine_15rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.SMG_SL9, cardName: 'SL9', attachments: [A.Barrel_11_Heavy, A.Bottom_Factory_Angled, A.Magazine_30rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Carbine_M4A1, cardName: 'STANDARD ISSUE', attachments: [A.Barrel_145_Carbine, A.Magazine_20rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Carbine_M277, cardName: 'PAPERWORK', attachments: [A.Barrel_16_Custom, A.Magazine_15rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Carbine_AK_205, cardName: 'RED TAPE', attachments: [A.Barrel_314mm_Prototype, A.Magazine_30rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Carbine_M417_A2, cardName: 'M417 A2', attachments: [A.Barrel_165_Rifle, A.Magazine_10rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Carbine_GRT_BC, cardName: 'GRT-BC', attachments: [A.Barrel_145_Alt, A.Magazine_30rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Carbine_QBZ_192, cardName: 'QBZ-192', attachments: [A.Barrel_105_Factory, A.Magazine_30rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
    { weapon: W.Carbine_SG_553R, cardName: 'SG-553R', attachments: [A.Barrel_303mm_LB, A.Magazine_20rnd_Magazine, A.Ammo_FMJ, A.Scope_Iron_Sights] },
];

// ---------------------------------------------------------------------------
// AMPED POOL — the 20 base guns that have custom FX configs, marked isAmped.
// Same weapon + attachments as their base card; the FX/sound system (slice 3)
// keys off isAmped, NOT damage. Universal optic/laser only where a validated
// family set isn't reused, so nothing mismatches.
// ---------------------------------------------------------------------------
const AMPED_POOL: LadderTier[] = [
    // Same 46 weapons in AMPED form (UGZ amped loadouts). Per-weapon combat FX lives in amped.ts WEAPON_FX.
    { weapon: W.AssaultRifle_M433, isAmped: true, cardName: 'AMPED M433', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_165_Fluted, A.Bottom_Slim_Angled, A.Magazine_40rnd_Fast_Mag, A.Ammo_Hollow_Point, A.Ergonomic_Magwell_Flare, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Top_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.AssaultRifle_B36A4, isAmped: true, cardName: 'AMPED B36A4', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_391mm_CQB, A.Bottom_Slim_Angled, A.Magazine_45rnd_Fast_Mag, A.Ammo_Synthetic_Tip, A.Ergonomic_Match_Trigger, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Top_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.AssaultRifle_SOR_556_Mk2, isAmped: true, cardName: 'AMPED SOR-556', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_18_Custom, A.Bottom_Slim_Angled, A.Magazine_45rnd_Fast_Mag, A.Ammo_Synthetic_Tip, A.Ergonomic_Rail_Cover, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Top_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.AssaultRifle_AK4D, isAmped: true, cardName: 'AMPED AK4D', attachments: [A.Muzzle_CQB_Suppressor, A.Barrel_409mm_US, A.Bottom_Slim_Angled, A.Magazine_30rnd_Magazine, A.Ammo_Hollow_Point, A.Ergonomic_Match_Trigger, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.AssaultRifle_TR_7, isAmped: true, cardName: 'AMPED TR-7', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_415mm_Fluted, A.Bottom_Ribbed_Stubby, A.Magazine_30rnd_Magazine, A.Ammo_Hollow_Point, A.Ergonomic_Improved_Mag_Catch, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Right_Flashlight] },
    { weapon: W.AssaultRifle_KORD_6P67, isAmped: true, cardName: 'AMPED KORD 6P67', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_415mm_Fluted, A.Bottom_Slim_Angled, A.Magazine_45rnd_Fast_Mag, A.Ammo_Hollow_Point, A.Ergonomic_Match_Trigger, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Right_Laser_Light_Combo_Green] },
    { weapon: W.AssaultRifle_NVO_228E, isAmped: true, cardName: 'AMPED NVO-228E', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_409mm_Cut, A.Bottom_Slim_Angled, A.Magazine_40rnd_Fast_Mag, A.Ammo_Hollow_Point, A.Ergonomic_Match_Trigger, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.AssaultRifle_L85A3, isAmped: true, cardName: 'AMPED L85A3', attachments: [A.Muzzle_CQB_Suppressor, A.Barrel_442_mm_CQB, A.Bottom_Slim_Angled, A.Magazine_45rnd_Fast_Mag, A.Ammo_Synthetic_Tip, A.Ergonomic_Match_Trigger, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Top_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.Shotgun_M87A1, isAmped: true, cardName: 'AMPED M87A1', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_20_Factory, A.Bottom_Slim_Angled, A.Magazine_7_Shell_Tube, A.Ammo_Slugs, A.Scope_Mini_Flex_100x, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.Shotgun_M1014, isAmped: true, cardName: 'AMPED M1014', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_185_Factory, A.Bottom_Slim_Angled, A.Magazine_6_Shell_Tube, A.Ammo_Slugs, A.Scope_Mini_Flex_100x, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.Shotgun__185KS_K, isAmped: true, cardName: 'AMPED 185KS-K', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_430mm_Cut, A.Bottom_Slim_Angled, A.Magazine_8rnd_Fast_Mag, A.Ammo_Slugs, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.Sidearm_P18, isAmped: true, cardName: 'AMPED P18', attachments: [A.Muzzle_CQB_Suppressor, A.Barrel_39_Pencil, A.Bottom_Laser_Light_Combo_Green, A.Magazine_21rnd_Magazine, A.Ammo_Hollow_Point, A.Ergonomic_Improved_Mag_Catch, A.Scope_Mini_Flex_100x] },
    { weapon: W.Sidearm_ES_57, isAmped: true, cardName: 'AMPED ES-57', attachments: [A.Muzzle_CQB_Suppressor, A.Barrel_122mm_Pencil, A.Bottom_Laser_Light_Combo_Green, A.Magazine_30rnd_Magazine, A.Ammo_Hollow_Point, A.Ergonomic_Improved_Mag_Catch, A.Scope_Mini_Flex_100x] },
    { weapon: W.Sidearm_M45A1, isAmped: true, cardName: 'CAMARO', attachments: [A.Muzzle_CQB_Suppressor, A.Barrel_5_Pencil, A.Bottom_Laser_Light_Combo_Green, A.Magazine_11rnd_Magazine, A.Ammo_Hollow_Point, A.Ergonomic_Improved_Mag_Catch, A.Scope_Mini_Flex_100x] },
    { weapon: W.Sidearm_M44, isAmped: true, cardName: 'RAYGUN', attachments: [A.Barrel_837_Long, A.Magazine_6rnd_Speedloader, A.Ammo_Hollow_Point, A.Scope_3VZR_175x] },
    { weapon: W.Sidearm_M357_Trait, isAmped: true, cardName: 'AMPED M357', attachments: [A.Barrel_5_Factory, A.Bottom_Laser_Light_Combo_Green, A.Magazine_8rnd_Moon_Clip, A.Ammo_Hollow_Point, A.Scope_Mini_Flex_100x] },
    { weapon: W.Sniper_M2010_ESR, isAmped: true, cardName: 'AMPED M2010 ESR', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_26_Carbon, A.Bottom_Classic_Grip_Pod, A.Magazine_8rnd_Fast_Mag, A.Ammo_Tungsten_Core, A.Ergonomic_DLC_Bolt, A.Scope_1p88_Variable, A.Top_120_mW_Blue, A.Left_Range_Finder] },
    { weapon: W.Sniper_SV_98, isAmped: true, cardName: 'AMPED SV-98', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_514mm_Carbine, A.Bottom_Classic_Grip_Pod, A.Magazine_10rnd_Magazine, A.Ammo_Tungsten_Core, A.Ergonomic_DLC_Bolt, A.Scope_1p88_Variable, A.Scope_Canted_Iron_Sights, A.Left_Range_Finder, A.Right_120_mW_Blue] },
    { weapon: W.Sniper_PSR, isAmped: true, cardName: 'AMPED PSR', attachments: [A.Muzzle_CQB_Suppressor, A.Barrel_27_MK22, A.Bottom_Classic_Grip_Pod, A.Magazine_10rnd_Magazine, A.Ammo_Tungsten_Core, A.Ergonomic_DLC_Bolt, A.Scope_1p88_Variable, A.Scope_Anti_Glare_Coating, A.Top_120_mW_Blue, A.Left_Range_Finder] },
    { weapon: W.DMR_M39_EMR, isAmped: true, cardName: 'AMPED M39 EMR', attachments: [A.Muzzle_Long_Suppressor, A.Barrel_16_Short, A.Bottom_Slim_Angled, A.Magazine_25rnd_Magazine, A.Ammo_Hollow_Point, A.Ergonomic_Improved_Mag_Catch, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.DMR_LMR27, isAmped: true, cardName: 'AMPED LMR27', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_215_Fluted, A.Bottom_Full_Angled, A.Magazine_20rnd_Fast_Mag, A.Ammo_Hollow_Point, A.Ergonomic_Improved_Mag_Catch, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.DMR_SVK_86, isAmped: true, cardName: 'AMPED SVK-86', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_457mm_Urban, A.Bottom_Slim_Angled, A.Magazine_10rnd_Fast_Mag, A.Ammo_Hollow_Point, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Top_120_mW_Blue, A.Left_Flashlight] },
    { weapon: W.DMR_SVDM, isAmped: true, cardName: 'AMPED SVDM', attachments: [A.Muzzle_Long_Suppressor, A.Barrel_565mm_Fluted, A.Bottom_Slim_Angled, A.Magazine_20rnd_Magazine, A.Ammo_Hollow_Point, A.Ergonomic_Improved_Mag_Catch, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.LMG_L110, isAmped: true, cardName: 'AMPED L110', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_349mm_Fluted, A.Bottom_Slim_Angled, A.Magazine_200rnd_Belt_Box, A.Ammo_Hollow_Point, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.LMG_DRS_IAR, isAmped: true, cardName: 'AMPED DRS IAR', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_145_Carbine, A.Bottom_Slim_Angled, A.Magazine_60rnd_Magazine, A.Ammo_Synthetic_Tip, A.Ergonomic_Rail_Cover, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Top_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.LMG_M_60, isAmped: true, cardName: 'AMPED M60', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_17_Fluted, A.Bottom_Slim_Angled, A.Magazine_100rnd_Belt_Pouch, A.Ammo_Hollow_Point, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.LMG_RPKM, isAmped: true, cardName: 'AMPED RPKM', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_419mm_Boar_F, A.Bottom_Slim_Angled, A.Magazine_75rnd_Drum, A.Ammo_Synthetic_Tip, A.Ergonomic_Magwell_Flare, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.LMG_M123K, isAmped: true, cardName: 'AMPED M123K', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_370mm_Compact, A.Bottom_Full_Angled, A.Magazine_200rnd_Belt_Box, A.Ammo_Hollow_Point, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.LMG_M250, isAmped: true, cardName: 'AMPED M250', attachments: [A.Muzzle_CQB_Suppressor, A.Barrel_406mm_Standard, A.Bottom_Slim_Angled, A.Magazine_100rnd_Belt_Pouch, A.Ammo_Hollow_Point, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Top_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.LMG_KTS100_MK8, isAmped: true, cardName: 'AMPED KTS100', attachments: [A.Muzzle_CQB_Suppressor, A.Barrel_330mm_Mk3, A.Bottom_Slim_Angled, A.Magazine_100rnd_Drum_Mag, A.Ammo_Synthetic_Tip, A.Ergonomic_Rail_Cover, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Right_Laser_Light_Combo_Green] },
    { weapon: W.LMG_M240L, isAmped: true, cardName: 'AMPED M240L', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_20_OH, A.Bottom_Slim_Angled, A.Magazine_100rnd_Belt_Box, A.Ammo_Hollow_Point, A.Ergonomic_Rail_Cover, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.SMG_SGX, isAmped: true, cardName: 'AMPED SGX', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_45_Compact, A.Bottom_Compact_Handstop, A.Magazine_41rnd_Magazine, A.Ammo_Hollow_Point, A.Scope_Mini_Flex_100x, A.Top_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.SMG_PW5A3, isAmped: true, cardName: 'AMPED PW5A3', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_245mm_Custom, A.Bottom_Compact_Handstop, A.Magazine_40rnd_Magazine, A.Ammo_Synthetic_Tip, A.Ergonomic_Improved_Mag_Catch, A.Scope_Mini_Flex_100x, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.SMG_PW7A2, isAmped: true, cardName: 'AMPED PW7A2', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_180mm_Prototype, A.Bottom_Compact_Handstop, A.Magazine_40rnd_Magazine, A.Ammo_Synthetic_Tip, A.Ergonomic_Improved_Mag_Catch, A.Scope_Mini_Flex_100x, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.SMG_UMG_40, isAmped: true, cardName: 'AMPED UMG-40', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_200mm_Fluted, A.Bottom_Compact_Handstop, A.Magazine_36rnd_Magazine, A.Ammo_Synthetic_Tip, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.SMG_USG_90, isAmped: true, cardName: 'AMPED USG-90', attachments: [A.Muzzle_CQB_Suppressor, A.Barrel_264mm_Fluted, A.Bottom_Compact_Handstop, A.Magazine_50rnd_Magazine, A.Ammo_Hollow_Point, A.Ergonomic_Improved_Mag_Catch, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.SMG_KV9, isAmped: true, cardName: 'AMPED KV9', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_55_Fluted, A.Bottom_Compact_Handstop, A.Magazine_27rnd_Magazine, A.Ammo_Hollow_Point, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Top_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.SMG_SCW_10, isAmped: true, cardName: 'AMPED SCW-10', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_68_Fluted, A.Bottom_Compact_Handstop, A.Magazine_25rnd_Magazine, A.Ammo_Hollow_Point, A.Ergonomic_Improved_Mag_Catch, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Top_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.SMG_SL9, isAmped: true, cardName: 'AMPED SL9', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_9_Fluted, A.Bottom_Compact_Handstop, A.Magazine_60rnd_Magazine, A.Ammo_Synthetic_Tip, A.Ergonomic_Improved_Mag_Catch, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Right_Laser_Light_Combo_Green] },
    { weapon: W.Carbine_M4A1, isAmped: true, cardName: 'AMPED M4A1', attachments: [A.Muzzle_CQB_Suppressor, A.Barrel_125_Fluted, A.Bottom_Slim_Angled, A.Magazine_40rnd_Fast_Mag, A.Ammo_Hollow_Point, A.Ergonomic_Rail_Cover, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Top_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.Carbine_M277, isAmped: true, cardName: 'AMPED M277', attachments: [A.Muzzle_Long_Suppressor, A.Barrel_13_Fluted, A.Bottom_Slim_Angled, A.Magazine_30rnd_Magazine, A.Ammo_Hollow_Point, A.Ergonomic_Magwell_Flare, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Top_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.Carbine_AK_205, isAmped: true, cardName: 'AMPED AK-205', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_314mm_Fluted, A.Bottom_Slim_Angled, A.Magazine_50rnd_Magazine, A.Ammo_Synthetic_Tip, A.Ergonomic_Magwell_Flare, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_Flashlight, A.Right_120_mW_Blue] },
    { weapon: W.Carbine_M417_A2, isAmped: true, cardName: 'AMPED M417', attachments: [A.Muzzle_CQB_Suppressor, A.Barrel_12_Assaulter, A.Bottom_Slim_Angled, A.Magazine_25rnd_Magazine, A.Ammo_Hollow_Point, A.Ergonomic_Magwell_Flare, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Top_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.Carbine_GRT_BC, isAmped: true, cardName: 'AMPED GRT-BC', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_10_Factory, A.Bottom_Compact_Handstop, A.Magazine_45rnd_Fast_Mag, A.Ammo_Hollow_Point, A.Ergonomic_Improved_Mag_Catch, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Right_Laser_Light_Combo_Green] },
    { weapon: W.Carbine_QBZ_192, isAmped: true, cardName: 'AMPED QBZ-192', attachments: [A.Muzzle_Standard_Suppressor, A.Barrel_145_Common, A.Bottom_Slim_Angled, A.Magazine_40rnd_Magazine, A.Ammo_Synthetic_Tip, A.Ergonomic_Rail_Cover, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Top_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.Carbine_SG_553R, isAmped: true, cardName: 'AMPED SG-553R', attachments: [A.Muzzle_Lightened_Suppressor, A.Barrel_240mm_Fluted, A.Bottom_Slim_Angled, A.Magazine_40rnd_Fast_Mag, A.Ammo_Hollow_Point, A.Ergonomic_Improved_Mag_Catch, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Left_Flashlight, A.Right_120_mW_Blue] },
];

// ---------------------------------------------------------------------------
// FINALE — always the LAST tiers. The breach charge + Rorsch were pulled: gadget/battle-pickup
// slots don't force-switch reliably (players kept holding the old gun). Replaced with two AMPED
// weapons (the PrimaryWeapon slot switches cleanly), each fresh vs the pools. Both still get the
// finale insta-kill boost + amped FX/sound. The throwing knife stays as the 1-kill finisher.
// ---------------------------------------------------------------------------
const FINALE_TIERS: LadderTier[] = [
    { weapon: W.LMG_M250, isAmped: true, cardName: 'EVICTION NOTICE', attachments: [A.Muzzle_CQB_Suppressor, A.Barrel_406mm_Standard, A.Bottom_Slim_Angled, A.Magazine_100rnd_Belt_Pouch, A.Ammo_Hollow_Point, A.Scope_Mini_Flex_100x, A.Scope_Canted_Iron_Sights, A.Top_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.Sniper_PSR, isAmped: true, cardName: 'TERMINATION', attachments: [A.Muzzle_CQB_Suppressor, A.Barrel_27_MK22, A.Bottom_Classic_Grip_Pod, A.Magazine_10rnd_Magazine, A.Ammo_Tungsten_Core, A.Ergonomic_DLC_Bolt, A.Scope_1p88_Variable, A.Scope_Anti_Glare_Coating, A.Top_120_mW_Blue, A.Left_Range_Finder] },
    { gadget: G.Throwable_Throwing_Knife, slot: mod.InventorySlots.Throwable, cardName: 'RESIGNATION LETTER' },
];

// Every slot ANY ladder tier grants into: guns -> PrimaryWeapon, the two finale
// gadget tiers -> MiscGadget (Breaching Projectile) and Throwable (Throwing Knife).
// applyTierWeapon clears exactly these before granting the new tier, so a promotion
// never leaves the previous tier's item behind. Add a slot here if a new tier ever
// grants into one (else the old grant would survive across tiers).
const MOD_GRANT_SLOTS: mod.InventorySlots[] = [
    mod.InventorySlots.PrimaryWeapon,
    mod.InventorySlots.MiscGadget,
    mod.InventorySlots.Throwable,
];

// The active, shuffled ladder for THIS match (built by resetLadder).
let currentLadder: LadderTier[] = [];

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export interface LadderProgress {
    ladderIndex: number;
    tierKills: number;
    peakIndex?: number; // highest tier ever reached — the demotion floor is this minus DEMOTION_MAX_BACK
}

// Humans keyed by playerId. Bots live on their roster identity.
const humanProgress: Map<number, LadderProgress> = new Map();

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Ladder] ${msg}`);
}

/** Build the gun list for this match per the LADDER_ROTATION toggle. */
function buildGunList(): LadderTier[] {
    // 0 (or negative) = the WHOLE roster: take every gun in the pool.
    const n = LADDER_GUN_TIERS > 0 ? LADDER_GUN_TIERS : Number.MAX_SAFE_INTEGER;
    switch (LADDER_ROTATION) {
        case 'classic':
            // Base guns in their listed (class) order — a deterministic skill ramp.
            return GUN_POOL.slice(0, n);
        case 'amped': {
            // Amped guns favored; top up from base if the ladder is longer than the pool.
            const amped = shuffle(AMPED_POOL);
            if (amped.length >= n) return amped.slice(0, n);
            return [...amped, ...shuffle(GUN_POOL).slice(0, n - amped.length)];
        }
        case 'base':
            return shuffle(GUN_POOL).slice(0, n);
        case 'shuffled':
        default:
            return shuffle([...GUN_POOL, ...AMPED_POOL]).slice(0, n);
    }
}

/** Build a fresh ladder for a new match (rotation-aware). */
export function resetLadder(): void {
    humanProgress.clear();
    const guns = buildGunList();
    currentLadder = [...guns, ...FINALE_TIERS];
    log(`built ladder (${LADDER_ROTATION}): ${currentLadder.length} tiers (${guns.length} guns + ${FINALE_TIERS.length} finale)`);
}

export function ladderLength(): number {
    return currentLadder.length;
}

/** The tier at an absolute ladder index (for the top weapon bar). */
export function tierAt(index: number): LadderTier | null {
    if (index < 0 || index >= currentLadder.length) return null;
    return currentLadder[index];
}

/** A weapon package (weapon + its attachments) for the card art. The game renders
 *  the attachments on the AddUIWeaponImage automatically when given this package.
 *  Returns null for gadget-only tiers (no weapon image). */
export function tierWeaponPackage(tier: LadderTier | null): mod.WeaponPackage | null {
    if (!tier || tier.weapon === undefined) return null;
    try {
        const pkg = mod.CreateNewWeaponPackage();
        for (const a of tier.attachments ?? []) {
            mod.AddAttachmentToWeaponPackage(a, pkg);
        }
        return pkg;
    } catch {
        return null;
    }
}

/** Resolve a participant's progress record (human map or bot identity). */
export function progressOf(player: mod.Player): LadderProgress | null {
    try {
        const playerId = mod.GetObjId(player);
        if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) {
            return identityByCurrentPlayerId(playerId); // BotIdentity satisfies LadderProgress
        }
        let rec = humanProgress.get(playerId);
        if (!rec) {
            rec = { ladderIndex: 0, tierKills: 0, peakIndex: 0 };
            humanProgress.set(playerId, rec);
        }
        return rec;
    } catch {
        return null;
    }
}

export function currentTier(player: mod.Player): LadderTier | null {
    const rec = progressOf(player);
    if (!rec || currentLadder.length === 0) return null;
    return currentLadder[Math.min(rec.ladderIndex, currentLadder.length - 1)];
}

// On this template, raw strings in mod.Message render as "missing" — text must be a
// REGISTERED key. Weapon display names live as flat top-level keys "wn_<slug>";
// look them up dynamically (flat top-level access works; nested does not).
function nameSlug(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/** A Message for a tier's REAL weapon name, via its registered "wn_<slug>" key. */
export function cardNameMessage(tier: LadderTier | null): mod.Message {
    const name = tierDisplayName(tier);
    const sk = mod.stringkeys as mod.Any;
    if (name.length === 0) return mod.Message(sk.ffa.num.n, 0); // renders "0" as a safe blank-ish
    const key = sk['wn_' + nameSlug(name)];
    return key !== undefined ? mod.Message(key) : mod.Message(sk.ffa.num.n, 0);
}

export function tierIsAmped(player: mod.Player): boolean {
    return currentTier(player)?.isAmped === true;
}

/** True if the player is on the final throwing-knife tier (for the insta-kill hook). */
export function onThrowingKnifeTier(player: mod.Player): boolean {
    return currentTier(player)?.gadget === mod.Gadgets.Throwable_Throwing_Knife;
}

/** True while the player is on ANY of the last 3 (FINALE) tiers — the breach charge, the Rorsch,
 *  and the throwing knife. All three get the insta-kill damage boost while held. */
export function onFinaleTier(player: mod.Player): boolean {
    const rec = progressOf(player);
    if (!rec) return false;
    return rec.ladderIndex >= currentLadder.length - FINALE_TIERS.length;
}

/**
 * Equip the participant's current-tier card and FORCE-SWITCH to it.
 * The ForceSwitchInventory call fixes the respawn bug where a gadget/knife tier
 * left the player holding nothing until the slot was cycled manually.
 */
const HOLD_RETRY_MS = 150;   // gap between force-switch re-asserts
const HOLD_MAX_ATTEMPTS = 6; // asserts at ~0,150,...,750ms — covers laggy gadget/battle-pickup deploys

/**
 * Force the player to actually HOLD `slot`, VERIFY it took, and retry until it does (self-verifying).
 * `ForceSwitchInventory` can silently no-op for a frame on gadget/battle-pickup/melee slots right
 * after a grant (respawn/promotion), leaving the player holding the previous item. `IsInventorySlotActive`
 * reports the CURRENTLY-HELD slot, so each attempt polls it first: if we're already holding the target
 * we stop, otherwise we re-assert the switch and schedule another check — up to HOLD_MAX_ATTEMPTS.
 * Guns normally confirm on the second poll (one timer); the finale items just take a few more.
 */
function forceHoldSlot(player: mod.Player, slot: mod.InventorySlots, attemptsLeft: number): void {
    try {
        if (!mod.IsPlayerValid(player)) return;
        // A prior assert may have already landed us on the slot — check before re-switching.
        let held = false;
        try { held = mod.IsInventorySlotActive(player, slot); } catch {}
        if (held) return; // confirmed holding it — done
        try { mod.ForceSwitchInventory(player, slot); } catch {}
        if (attemptsLeft <= 1) return; // out of retries — best effort, leave it
        Timers.setTimeout(() => forceHoldSlot(player, slot, attemptsLeft - 1), HOLD_RETRY_MS);
    } catch {}
}

/** Give ONLY the starter combat knife — the intro holds this the moment they deploy, until the
 *  sound's weapon-give beat swaps in the full ladder loadout. */
export function giveStarterKnife(player: mod.Player): void {
    try {
        mod.AddEquipment(player, mod.Gadgets.Melee_Combat_Knife, mod.InventorySlots.MeleeWeapon);
        forceHoldSlot(player, mod.InventorySlots.MeleeWeapon, HOLD_MAX_ATTEMPTS);
    } catch {}
}

export function applyTierWeapon(player: mod.Player): void {
    const tier = currentTier(player);
    if (!tier) return;
    try {
        // Clear ONLY the slots the mod itself ever grants into (the previous tier's
        // item), so promotions swap cleanly (gun->gadget and gadget->gun both drop the
        // old grant). We no longer wipe Secondary/GadgetOne/GadgetTwo/ClassGadget: the
        // portal page restricts every player weapon/vehicle/gadget, so those slots are
        // always empty here — clearing them was pure "removed equipment" log spam.
        // (MeleeWeapon is re-added below with the same knife every time, so it's not in
        // the clear set.) MOD_GRANT_SLOTS must list every slot any ladder tier uses.
        for (const slot of MOD_GRANT_SLOTS) {
            try {
                // GUARD before removing: RemoveEquipment on an EMPTY slot THROWS
                // (Exception: NoWeaponOnSlot). QuickJS captures a full stack trace and
                // writes it to PortalLog on every throw — ~4,300 in one test match, a
                // real hot-path cost on deploy+promotion across 32 players. Checking
                // first turns the throw into a cheap boolean.
                if (mod.IsInventorySlotActive(player, slot)) mod.RemoveEquipment(player, slot);
            } catch {}
        }
        // Knife is always available (and IS the weapon on the final tier).
        mod.AddEquipment(player, mod.Gadgets.Melee_Combat_Knife, mod.InventorySlots.MeleeWeapon);

        let activeSlot: mod.InventorySlots;
        if (tier.gadget !== undefined && tier.slot !== undefined) {
            // Gadget-only finale tier.
            mod.AddEquipment(player, tier.gadget, tier.slot);
            activeSlot = tier.slot;
        } else if (tier.weapon !== undefined) {
            const pkg = mod.CreateNewWeaponPackage();
            for (const attachment of tier.attachments ?? []) {
                mod.AddAttachmentToWeaponPackage(attachment, pkg);
            }
            // EXPLICIT PrimaryWeapon slot — every tier's gun replaces the last, no
            // matter its class (the archive pattern).
            mod.AddEquipment(player, tier.weapon, pkg, mod.InventorySlots.PrimaryWeapon);
            activeSlot = mod.InventorySlots.PrimaryWeapon;
        } else {
            activeSlot = mod.InventorySlots.MeleeWeapon; // knife-only
        }

        // THE FIX: force the player to actually HOLD the tier item on (re)spawn, and VERIFY it took.
        // The FINALE tiers (breach charge, Rorsch, throwing knife) can fail to switch on the first call
        // (gadget + battle-pickup slots), leaving the player holding the previous gun. forceHoldSlot
        // polls the currently-held slot and re-asserts until the player is actually holding activeSlot
        // (guns confirm almost immediately; the finale items retry through the window if needed).
        forceHoldSlot(player, activeSlot, HOLD_MAX_ATTEMPTS);

        // NOTE: no ammo top-off. SetInventoryMagazineAmmo(999) THREW (Exception:
        // SetAmmoRequest) for every weapon whose max magazine is < 999 — a flood on each
        // deploy/promotion across all bots + the player. Unlimited magazines are handled
        // by the portal experience settings instead, so the mod never touches ammo.

        log(`equipped "${tier.cardName}"${tier.isAmped ? ' [AMPED]' : ''} -> slot ${activeSlot}`);
    } catch {}
}

export type KillOutcome = 'progress' | 'promoted' | 'finished';

/** Register a ladder kill. Returns what happened (promotion re-equips elsewhere). */
/** Kills required to CLEAR a given tier: the FINAL tier (the throwing knife) wins on just 1 kill;
 *  every other tier needs the normal KILLS_PER_TIER. */
export function killsForTier(index: number): number {
    return index >= currentLadder.length - 1 ? 1 : KILLS_PER_TIER;
}

export function onLadderKill(killer: mod.Player): KillOutcome {
    const rec = progressOf(killer);
    if (!rec) return 'progress';
    rec.tierKills++;
    if (rec.tierKills < killsForTier(rec.ladderIndex)) return 'progress';
    rec.tierKills = 0;
    rec.ladderIndex++;
    if (rec.ladderIndex >= currentLadder.length) {
        rec.ladderIndex = currentLadder.length - 1; // stay on final card for the victory lap
        bumpPeak(rec);
        return 'finished';
    }
    bumpPeak(rec);
    return 'promoted';
}

/** Track the highest tier a player has ever reached — the demotion floor hangs off this. */
function bumpPeak(rec: LadderProgress): void {
    if (rec.peakIndex === undefined || rec.ladderIndex > rec.peakIndex) rec.peakIndex = rec.ladderIndex;
}

/** Lowest tier index a demotion can leave a record at: PEAK minus DEMOTION_MAX_BACK (>= 0). A
 *  player can never be knocked more than DEMOTION_MAX_BACK guns below their best; the floor
 *  ratchets UP as they climb. */
function demotionFloorIndex(rec: LadderProgress): number {
    const peak = rec.peakIndex ?? rec.ladderIndex;
    return Math.max(0, peak - DEMOTION_MAX_BACK);
}

/** The demotion-floor tier index for a player — the HUD renders NO weapon cards below this, so the
 *  empty previous slots make the lock visible (at the floor, all previous slots are empty). */
export function demotionFloor(player: mod.Player): number {
    const rec = progressOf(player);
    if (!rec) return 0;
    return demotionFloorIndex(rec);
}

/** How many guns a player WOULD lose if demoted by `n` right now (respects the floor). Does NOT
 *  apply the demotion — used to PREVIEW a charge-carrier's backfire for the killer's callout. */
export function demotionLoss(player: mod.Player, n: number): number {
    const rec = progressOf(player);
    if (!rec || n <= 0) return 0;
    return Math.max(0, Math.min(n, rec.ladderIndex - demotionFloorIndex(rec)));
}

/** Powerup hooks: shift tiers by +/-n (clamped). Returns the new index. */
export function shiftTiers(player: mod.Player, delta: number): number {
    const rec = progressOf(player);
    if (!rec) return 0;
    const from = rec.ladderIndex;
    let target = from + delta;
    // DEMOTION LOCK: a demotion never drops you more than DEMOTION_MAX_BACK guns below your
    // CURRENT gun (relative floor). Only applies to demotions (delta < 0); promotions uncapped.
    if (delta < 0) target = Math.max(target, from - DEMOTION_MAX_BACK);
    rec.ladderIndex = Math.max(0, Math.min(currentLadder.length - 1, target));
    rec.tierKills = 0;
    return rec.ladderIndex;
}

export function removeHuman(playerId: number): void {
    humanProgress.delete(playerId);
}
