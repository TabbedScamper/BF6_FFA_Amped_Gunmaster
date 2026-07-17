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

import { KILLS_PER_TIER, LADDER_GUN_TIERS, DEBUG_MODE } from './config.ts';
import { identityByCurrentPlayerId } from './roster.ts';

const A = mod.WeaponAttachments;
const W = mod.Weapons;
const G = mod.Gadgets;

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
    // The 5 newest SDK weapons (VCR-2, CZ3A1, M121 A2, GRT CPS, VZ-61) are typed via
    // src/sdk-augment.d.ts (bf6-portal-mod-types npm pkg lags the installed SDK 1.3.3.0).
    // Pistols
    { weapon: W.Sidearm_P18, cardName: 'GLITTER PEN', attachments: [A.Scope_R_MR_100x, A.Muzzle_CQB_Suppressor, A.Barrel_39_Pencil, A.Magazine_17rnd_Fast_Mag] },
    { weapon: W.Sidearm_M44, cardName: 'HIGH NOON', attachments: [A.Scope_Iron_Sights, A.Barrel_675_Factory, A.Ammo_Match_Grade] },
    { weapon: W.Sidearm_M45A1, cardName: 'THE ACCOUNTANT', attachments: [A.Scope_R_MR_100x, A.Muzzle_Single_port_Brake, A.Barrel_5_Pencil, A.Magazine_11rnd_Magazine] },
    { weapon: W.Sidearm_ES_57, cardName: 'STAPLE GUN', attachments: [A.Scope_RO_S_125x, A.Muzzle_CQB_Suppressor, A.Barrel_122mm_Pencil] },
    { weapon: W.Sidearm_GGH_22, cardName: 'LUNCH MONEY', attachments: [A.Scope_R_MR_100x, A.Muzzle_CQB_Suppressor, A.Barrel_114mm_Pencil] },
    { weapon: W.Sidearm_VZ_61, cardName: 'PAPER JAM', attachments: [A.Scope_Iron_Sights] },
    // SMGs
    { weapon: W.SMG_KV9, cardName: 'SEWING MACHINE', attachments: [A.Scope_Aperture_Sight, A.Right_50_mW_Green, A.Muzzle_CQB_Suppressor, A.Barrel_55_Fluted, A.Bottom_Canted_Stubby, A.Magazine_17rnd_Fast_Mag] },
    { weapon: W.SMG_UMG_40, cardName: 'OFFICE MEMO', attachments: [A.Scope_Aperture_Sight, A.Right_50_mW_Green, A.Muzzle_CQB_Suppressor, A.Barrel_200mm_Fluted, A.Bottom_Canted_Stubby, A.Magazine_25rnd_Fast_Mag] },
    { weapon: W.SMG_SGX, cardName: 'VENDING MACHINE', attachments: [A.Scope_Aperture_Sight, A.Muzzle_CQB_Suppressor, A.Barrel_6_Fluted, A.Magazine_30rnd_Fast_Mag] },
    { weapon: W.SMG_CZ3A1, cardName: 'GROUP CHAT', attachments: [A.Scope_Iron_Sights, A.Muzzle_CQB_Suppressor] },
    // Carbines
    { weapon: W.Carbine_M4A1, cardName: 'STANDARD ISSUE', attachments: [A.Scope_R_MR_100x, A.Muzzle_Linear_Comp, A.Barrel_145_Carbine, A.Magazine_20rnd_Fast_Mag, A.Bottom_Low_Profile_Stubby, A.Top_5_mW_Green] },
    { weapon: W.Carbine_M277, cardName: 'PAPERWORK', attachments: [A.Scope_PVQ_31_400x, A.Muzzle_Lightened_Suppressor, A.Barrel_16_Rifle, A.Bottom_Full_Angled, A.Magazine_15rnd_Fast_Mag, A.Top_5_mW_Green] },
    { weapon: W.Carbine_AK_205, cardName: 'RED TAPE', attachments: [A.Scope_RO_S_125x, A.Muzzle_CQB_Suppressor, A.Bottom_Canted_Stubby] },
    { weapon: W.Carbine_SOR_300SC, cardName: 'FIELD TRIP', attachments: [A.Scope_R_MR_100x, A.Muzzle_Lightened_Suppressor, A.Bottom_Low_Profile_Stubby] },
    // ARs
    { weapon: W.AssaultRifle_M433, cardName: 'HR APPROVED', attachments: [A.Scope_Iron_Sights, A.Muzzle_Double_port_Brake, A.Barrel_145_Alt, A.Magazine_20rnd_Magazine, A.Ergonomic_Match_Trigger, A.Left_120_mW_Blue] },
    { weapon: W.AssaultRifle_KORD_6P67, cardName: 'SIBERIAN EXPRESS', attachments: [A.Scope_SU_123_150x, A.Muzzle_Double_port_Brake, A.Barrel_415mm_Fluted, A.Bottom_Canted_Stubby, A.Magazine_30rnd_Fast_Mag, A.Right_50_mW_Blue] },
    { weapon: W.AssaultRifle_AK4D, cardName: 'OLD RELIABLE', attachments: [A.Scope_Osa_7_100x, A.Muzzle_Compensated_Brake, A.Barrel_450mm_Standard, A.Magazine_15rnd_Fast_Mag, A.Bottom_Full_Angled] },
    { weapon: W.AssaultRifle_VCR_2, cardName: 'FINE PRINT', attachments: [A.Scope_RO_S_125x, A.Muzzle_CQB_Suppressor] },
    // LMGs
    { weapon: W.LMG_DRS_IAR, cardName: 'SUPPRESSING OPINION', attachments: [A.Scope_RO_S_125x, A.Muzzle_Lightened_Suppressor, A.Barrel_165_LSW, A.Bottom_Canted_Stubby, A.Magazine_30rnd_Fast_Mag, A.Top_50_mW_Blue] },
    { weapon: W.LMG_M_60, cardName: 'COMPANY PICNIC', attachments: [A.Scope_RO_S_125x, A.Muzzle_Compensated_Brake, A.Barrel_17_Cut, A.Magazine_50rnd_Loose_Belt, A.Bottom_Bipod] },
    { weapon: W.LMG_M121_A2, cardName: 'ALL HANDS EMAIL', attachments: [A.Scope_RO_S_125x, A.Bottom_Bipod] },
    // DMRs
    { weapon: W.DMR_M39_EMR, cardName: 'SCENIC ROUTE', attachments: [A.Scope_Iron_Sights, A.Muzzle_Linear_Comp, A.Barrel_22_E3_Long, A.Right_50_mW_Blue, A.Bottom_Bipod, A.Magazine_15rnd_Magazine] },
    { weapon: W.DMR_GRT_CPS, cardName: 'COLD BREW', attachments: [A.Scope_ST_Prism_500x, A.Muzzle_Lightened_Suppressor] },
    // Snipers
    { weapon: W.Sniper_SV_98, cardName: 'WHITE FEATHER', attachments: [A.Scope_TS_HD_600x, A.Scope_Canted_Iron_Sights, A.Muzzle_Long_Suppressor, A.Barrel_650mm_Fluted, A.Right_120_mW_Blue, A.Bottom_Slim_Angled, A.Magazine_10rnd_Magazine] },
    { weapon: W.Sniper_Mini_Scout, cardName: 'POCKET PHYSICS', attachments: [A.Scope_S_VPS_600x, A.Scope_Canted_Iron_Sights, A.Muzzle_CQB_Suppressor, A.Barrel_16_Pencil, A.Right_120_mW_Blue] },
    // Shotguns
    { weapon: W.Shotgun_M87A1, cardName: 'THE LANDLORD', attachments: [A.Scope_Iron_Sights, A.Bottom_Full_Angled, A.Right_50_mW_Green, A.Left_Flashlight] },
    { weapon: W.Shotgun_DB_12, cardName: 'HALLWAY LAWYER', attachments: [A.Scope_Iron_Sights, A.Bottom_Full_Angled, A.Right_50_mW_Green] },
];

// ---------------------------------------------------------------------------
// AMPED POOL — the 20 base guns that have custom FX configs, marked isAmped.
// Same weapon + attachments as their base card; the FX/sound system (slice 3)
// keys off isAmped, NOT damage. Universal optic/laser only where a validated
// family set isn't reused, so nothing mismatches.
// ---------------------------------------------------------------------------
const AMPED_POOL: LadderTier[] = [
    { weapon: W.Sidearm_M45A1, isAmped: true, cardName: 'CAMARO', attachments: [A.Scope_R_MR_100x, A.Muzzle_Single_port_Brake, A.Barrel_5_Pencil, A.Magazine_11rnd_Magazine] },
    { weapon: W.Sidearm_P18, isAmped: true, cardName: 'AMPED P18', attachments: [A.Scope_R_MR_100x, A.Muzzle_CQB_Suppressor, A.Barrel_39_Pencil, A.Magazine_17rnd_Fast_Mag] },
    { weapon: W.Sidearm_M44, isAmped: true, cardName: 'RAYGUN', attachments: [A.Scope_Iron_Sights, A.Barrel_675_Factory, A.Ammo_Match_Grade] },
    { weapon: W.Sidearm_GGH_22, isAmped: true, cardName: 'AMPED GGH-22', attachments: [A.Scope_R_MR_100x, A.Muzzle_CQB_Suppressor, A.Barrel_114mm_Pencil] },
    { weapon: W.SMG_KV9, isAmped: true, cardName: 'AMPED KV9', attachments: [A.Scope_Aperture_Sight, A.Muzzle_CQB_Suppressor, A.Barrel_55_Fluted, A.Magazine_17rnd_Fast_Mag] },
    { weapon: W.SMG_SGX, isAmped: true, cardName: 'AMPED SGX', attachments: [A.Scope_Aperture_Sight, A.Muzzle_CQB_Suppressor, A.Barrel_6_Fluted, A.Magazine_30rnd_Fast_Mag] },
    { weapon: W.Carbine_M4A1, isAmped: true, cardName: 'AMPED M4A1', attachments: [A.Scope_R_MR_100x, A.Muzzle_Linear_Comp, A.Barrel_145_Carbine, A.Magazine_20rnd_Fast_Mag, A.Bottom_Low_Profile_Stubby] },
    { weapon: W.Carbine_AK_205, isAmped: true, cardName: 'AMPED AK-205', attachments: [A.Scope_RO_S_125x, A.Muzzle_CQB_Suppressor, A.Bottom_Canted_Stubby] },
    { weapon: W.Carbine_SOR_300SC, isAmped: true, cardName: 'AMPED SOR-300SC', attachments: [A.Scope_R_MR_100x, A.Muzzle_Lightened_Suppressor, A.Bottom_Low_Profile_Stubby] },
    { weapon: W.AssaultRifle_M433, isAmped: true, cardName: 'AMPED M433', attachments: [A.Scope_Iron_Sights, A.Muzzle_Double_port_Brake, A.Barrel_145_Alt, A.Magazine_20rnd_Magazine] },
    { weapon: W.AssaultRifle_AK4D, isAmped: true, cardName: 'AMPED AK4D', attachments: [A.Scope_Osa_7_100x, A.Muzzle_Compensated_Brake, A.Barrel_450mm_Standard, A.Magazine_15rnd_Fast_Mag] },
    { weapon: W.LMG_L110, isAmped: true, cardName: 'AMPED L110', attachments: [A.Scope_RO_S_125x, A.Bottom_Bipod] },
    { weapon: W.LMG_M_60, isAmped: true, cardName: 'AMPED M60', attachments: [A.Scope_RO_S_125x, A.Muzzle_Compensated_Brake, A.Barrel_17_Cut, A.Magazine_50rnd_Loose_Belt, A.Bottom_Bipod] },
    { weapon: W.Sniper_M2010_ESR, isAmped: true, cardName: 'AMPED M2010 ESR', attachments: [A.Scope_TS_HD_600x, A.Scope_Canted_Iron_Sights, A.Muzzle_Long_Suppressor, A.Barrel_24_Fluted, A.Magazine_5rnd_Fast_Mag] },
    { weapon: W.Sniper_SV_98, isAmped: true, cardName: 'AMPED SV-98', attachments: [A.Scope_TS_HD_600x, A.Muzzle_Long_Suppressor, A.Barrel_650mm_Fluted, A.Magazine_10rnd_Magazine] },
    { weapon: W.Sniper_Mini_Scout, isAmped: true, cardName: 'AMPED MINI SCOUT', attachments: [A.Scope_S_VPS_600x, A.Muzzle_CQB_Suppressor, A.Barrel_16_Pencil] },
    { weapon: W.Shotgun_M1014, isAmped: true, cardName: 'AMPED M1014', attachments: [A.Scope_Iron_Sights, A.Bottom_Full_Angled, A.Right_50_mW_Green] },
    { weapon: W.Shotgun_M87A1, isAmped: true, cardName: 'AMPED M87A1', attachments: [A.Scope_Iron_Sights, A.Bottom_Full_Angled, A.Left_Flashlight] },
    { weapon: W.Shotgun_DB_12, isAmped: true, cardName: 'AMPED DB-12', attachments: [A.Scope_Iron_Sights, A.Bottom_Full_Angled, A.Right_50_mW_Green] },
];

// ---------------------------------------------------------------------------
// FINALE — always the LAST tiers, in order: hard gadget kills, then the knife.
// (The respawn "force-equip the gadget" fix in index.ts makes these playable.)
// ---------------------------------------------------------------------------
const FINALE_TIERS: LadderTier[] = [
    { gadget: G.Launcher_Breaching_Projectile, slot: mod.InventorySlots.MiscGadget, cardName: 'EVICTION NOTICE' },
    { gadget: G.Throwable_Throwing_Knife, slot: mod.InventorySlots.Throwable, cardName: 'RESIGNATION LETTER' },
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
}

// Humans keyed by playerId. Bots live on their roster identity.
const humanProgress: Map<number, LadderProgress> = new Map();

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Ladder] ${msg}`);
}

/** Build a fresh shuffled ladder for a new match. */
export function resetLadder(): void {
    humanProgress.clear();
    const guns = shuffle([...GUN_POOL, ...AMPED_POOL]).slice(0, LADDER_GUN_TIERS);
    currentLadder = [...guns, ...FINALE_TIERS];
    log(`built ladder: ${currentLadder.length} tiers (${guns.length} guns + ${FINALE_TIERS.length} finale)`);
}

export function ladderLength(): number {
    return currentLadder.length;
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
            rec = { ladderIndex: 0, tierKills: 0 };
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

export function tierIsAmped(player: mod.Player): boolean {
    return currentTier(player)?.isAmped === true;
}

/**
 * Equip the participant's current-tier card and FORCE-SWITCH to it.
 * The ForceSwitchInventory call fixes the respawn bug where a gadget/knife tier
 * left the player holding nothing until the slot was cycled manually.
 */
export function applyTierWeapon(player: mod.Player): void {
    const tier = currentTier(player);
    if (!tier) return;
    try {
        // Clear all weapon-ish slots for a clean re-equip.
        for (const slot of [
            mod.InventorySlots.PrimaryWeapon,
            mod.InventorySlots.SecondaryWeapon,
            mod.InventorySlots.MiscGadget,
            mod.InventorySlots.Throwable,
            mod.InventorySlots.MeleeWeapon,
        ]) {
            try {
                mod.RemoveEquipment(player, slot);
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
            mod.AddEquipment(player, tier.weapon, pkg);
            activeSlot = mod.InventorySlots.PrimaryWeapon;
        } else {
            activeSlot = mod.InventorySlots.MeleeWeapon; // knife-only
        }

        // THE FIX: force the player to actually hold the tier item on (re)spawn.
        try {
            mod.ForceSwitchInventory(player, activeSlot);
        } catch {}

        log(`equipped "${tier.cardName}"${tier.isAmped ? ' [AMPED]' : ''} -> slot ${activeSlot}`);
    } catch {}
}

export type KillOutcome = 'progress' | 'promoted' | 'finished';

/** Register a ladder kill. Returns what happened (promotion re-equips elsewhere). */
export function onLadderKill(killer: mod.Player): KillOutcome {
    const rec = progressOf(killer);
    if (!rec) return 'progress';
    rec.tierKills++;
    if (rec.tierKills < KILLS_PER_TIER) return 'progress';
    rec.tierKills = 0;
    rec.ladderIndex++;
    if (rec.ladderIndex >= currentLadder.length) {
        rec.ladderIndex = currentLadder.length - 1; // stay on final card for the victory lap
        return 'finished';
    }
    return 'promoted';
}

/** Powerup hooks: shift tiers by +/-n (clamped). Returns the new index. */
export function shiftTiers(player: mod.Player, delta: number): number {
    const rec = progressOf(player);
    if (!rec) return 0;
    rec.ladderIndex = Math.max(0, Math.min(currentLadder.length - 1, rec.ladderIndex + delta));
    rec.tierKills = 0;
    return rec.ladderIndex;
}

export function removeHuman(playerId: number): void {
    humanProgress.delete(playerId);
}
