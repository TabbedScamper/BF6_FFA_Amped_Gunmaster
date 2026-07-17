// ============================================================================
// FFA GUNMASTER — THE WEAPON LADDER
// ============================================================================
// Gun-game core: KILLS_PER_TIER kills advance you one tier; finish the last
// tier's kills to WIN. Tiers are the named, attachment-VALIDATED cards from
// Deadlock's arsenal (every barrel/magazine checked against its weapon's real
// family). Order follows the classic Undead-Gunmaster ramp: pistols -> SMGs ->
// carbines -> ARs -> LMGs -> DMRs -> snipers -> shotguns. Amped tiers with
// their custom raycast FX slot in above these in a later pass (DESIGN step 4).
//
// Progress lives OUTSIDE the engine player: humans keyed by playerId, bots on
// their persistent roster identity (so a bot keeps its gun through respawns).
// ============================================================================

import { KILLS_PER_TIER, DEBUG_MODE } from './config.ts';
import { identityByCurrentPlayerId } from './roster.ts';

const A = mod.WeaponAttachments;
const W = mod.Weapons;

export interface LadderTier {
    weapon: mod.Weapons;
    cardName: string; // display name (strings key wiring comes with the HUD pass)
    attachments: mod.WeaponAttachments[];
}

// Starter ladder — 12 validated cards, pistols to power. (Amped tiers: DESIGN step 4.)
export const LADDER: LadderTier[] = [
    { weapon: W.Sidearm_P18, cardName: 'GLITTER PEN', attachments: [A.Scope_R_MR_100x, A.Muzzle_CQB_Suppressor, A.Barrel_39_Pencil, A.Magazine_17rnd_Fast_Mag] },
    { weapon: W.Sidearm_M44, cardName: 'HIGH NOON', attachments: [A.Scope_Iron_Sights, A.Barrel_675_Factory, A.Ammo_Match_Grade] },
    { weapon: W.SMG_KV9, cardName: 'SEWING MACHINE', attachments: [A.Scope_Aperture_Sight, A.Right_50_mW_Green, A.Muzzle_CQB_Suppressor, A.Barrel_55_Fluted, A.Bottom_Canted_Stubby, A.Magazine_17rnd_Fast_Mag, A.Ammo_Hollow_Point] },
    { weapon: W.SMG_UMG_40, cardName: 'OFFICE MEMO', attachments: [A.Scope_Aperture_Sight, A.Right_50_mW_Green, A.Muzzle_CQB_Suppressor, A.Barrel_200mm_Fluted, A.Bottom_Canted_Stubby, A.Magazine_25rnd_Fast_Mag, A.Ammo_Hollow_Point] },
    { weapon: W.Carbine_M4A1, cardName: 'STANDARD ISSUE', attachments: [A.Scope_R_MR_100x, A.Muzzle_Linear_Comp, A.Barrel_145_Carbine, A.Magazine_20rnd_Fast_Mag, A.Bottom_Low_Profile_Stubby, A.Ergonomic_Improved_Mag_Catch, A.Top_5_mW_Green] },
    { weapon: W.Carbine_M277, cardName: 'PAPERWORK', attachments: [A.Scope_PVQ_31_400x, A.Muzzle_Lightened_Suppressor, A.Barrel_16_Rifle, A.Bottom_Full_Angled, A.Magazine_15rnd_Fast_Mag, A.Ergonomic_Improved_Mag_Catch, A.Top_5_mW_Green] },
    { weapon: W.AssaultRifle_M433, cardName: 'HR APPROVED', attachments: [A.Scope_Iron_Sights, A.Muzzle_Double_port_Brake, A.Barrel_145_Alt, A.Magazine_20rnd_Magazine, A.Ergonomic_Match_Trigger, A.Ammo_Polymer_Case, A.Left_120_mW_Blue, A.Right_Flashlight] },
    { weapon: W.AssaultRifle_KORD_6P67, cardName: 'SIBERIAN EXPRESS', attachments: [A.Scope_SU_123_150x, A.Muzzle_Double_port_Brake, A.Barrel_415mm_Fluted, A.Bottom_Canted_Stubby, A.Magazine_30rnd_Fast_Mag, A.Right_50_mW_Blue] },
    { weapon: W.LMG_DRS_IAR, cardName: 'SUPPRESSING OPINION', attachments: [A.Scope_RO_S_125x, A.Muzzle_Lightened_Suppressor, A.Barrel_165_LSW, A.Bottom_Canted_Stubby, A.Magazine_30rnd_Fast_Mag, A.Top_50_mW_Blue] },
    { weapon: W.DMR_M39_EMR, cardName: 'SCENIC ROUTE', attachments: [A.Scope_Iron_Sights, A.Muzzle_Linear_Comp, A.Barrel_22_E3_Long, A.Right_50_mW_Blue, A.Bottom_Bipod, A.Magazine_15rnd_Magazine, A.Ammo_Hollow_Point] },
    { weapon: W.Sniper_SV_98, cardName: 'WHITE FEATHER', attachments: [A.Scope_TS_HD_600x, A.Scope_Canted_Iron_Sights, A.Muzzle_Long_Suppressor, A.Barrel_650mm_Fluted, A.Right_120_mW_Blue, A.Bottom_Slim_Angled, A.Magazine_10rnd_Magazine] },
    { weapon: W.Shotgun_M87A1, cardName: 'THE LANDLORD', attachments: [A.Scope_Iron_Sights, A.Bottom_Full_Angled, A.Right_50_mW_Green, A.Left_Flashlight] },
];

export interface LadderProgress {
    ladderIndex: number;
    tierKills: number;
}

// Humans keyed by playerId. Bots live on their roster identity.
const humanProgress: Map<number, LadderProgress> = new Map();

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Ladder] ${msg}`);
}

export function resetLadder(): void {
    humanProgress.clear();
}

/** Resolve a participant's progress record (human map or bot identity). */
export function progressOf(player: mod.Player): LadderProgress | null {
    try {
        const playerId = mod.GetObjId(player);
        if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) {
            const ident = identityByCurrentPlayerId(playerId);
            return ident; // BotIdentity structurally satisfies LadderProgress
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
    if (!rec) return null;
    const idx = Math.min(rec.ladderIndex, LADDER.length - 1);
    return LADDER[idx];
}

/** Equip the participant's current-tier card (primary only; knife always). */
export function applyTierWeapon(player: mod.Player): void {
    const tier = currentTier(player);
    if (!tier) return;
    try {
        try {
            mod.RemoveEquipment(player, mod.InventorySlots.PrimaryWeapon);
        } catch {}
        try {
            mod.RemoveEquipment(player, mod.InventorySlots.SecondaryWeapon);
        } catch {}
        try {
            mod.RemoveEquipment(player, mod.InventorySlots.MeleeWeapon);
        } catch {}
        mod.AddEquipment(player, mod.Gadgets.Melee_Combat_Knife, mod.InventorySlots.MeleeWeapon);

        const pkg = mod.CreateNewWeaponPackage();
        for (const attachment of tier.attachments) {
            mod.AddAttachmentToWeaponPackage(attachment, pkg);
        }
        mod.AddEquipment(player, tier.weapon, pkg);
        log(`equipped tier ${Math.min(progressOf(player)?.ladderIndex ?? 0, LADDER.length - 1)} (${tier.cardName})`);
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
    if (rec.ladderIndex >= LADDER.length) {
        rec.ladderIndex = LADDER.length - 1; // stay on final card for the victory lap
        return 'finished';
    }
    return 'promoted';
}

/** Powerup hooks: shift tiers by +/-n (clamped). Returns the new index. */
export function shiftTiers(player: mod.Player, delta: number): number {
    const rec = progressOf(player);
    if (!rec) return 0;
    rec.ladderIndex = Math.max(0, Math.min(LADDER.length - 1, rec.ladderIndex + delta));
    rec.tierKills = 0;
    return rec.ladderIndex;
}

export function ladderLength(): number {
    return LADDER.length;
}

export function removeHuman(playerId: number): void {
    humanProgress.delete(playerId);
}
