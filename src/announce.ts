// ============================================================================
// FFA GUNMASTER — LOBBY ANNOUNCEMENTS (first blood, killstreaks)
// ============================================================================
// Upgraded from the old TDM export: same idea (a global top-center banner that
// calls out first blood + killstreak milestones with escalating rank-up SFX),
// rebuilt on the current UI components (UIContainer/UIText) with a Timer-based
// show/hide instead of an async slide (avoids async-in-handler risk). Global
// receiver = the whole lobby sees it. Names render via mod.Message(key, player).
// ============================================================================

import { Timers } from 'bf6-portal-utils/timers/index.ts';
import { UIContainer } from 'bf6-portal-utils/ui/components/container/index.ts';
import { UIText } from 'bf6-portal-utils/ui/components/text/index.ts';
import { sfxVol, DEBUG_MODE } from './config.ts';
import { playerDisplayMessage } from './roster.ts';

const RS = mod.RuntimeSpawn_Common;
const SK = (): mod.Any => mod.stringkeys;
const ZERO = mod.CreateVector(0, 0, 0);

const GOLD = mod.CreateVector(1, 0.9, 0.15);
const RED = mod.CreateVector(1, 0.35, 0.35);

// Killstreak milestones -> banner word + escalating rank-up SFX.
// FACTORS OF 2 (KILLS_PER_TIER = 2): every milestone lands exactly on a weapon-swap
// upgrade, so a callout always coincides with a gun change. spree=4, rampage=8,
// unstoppable=12, godlike=16.
export const STREAK_MILESTONES = [4, 8, 12, 16];
function streakWord(count: number): mod.Any {
    if (count >= 16) return SK().ffa.feed.streak_word_godlike;
    if (count >= 12) return SK().ffa.feed.streak_word_unstoppable;
    if (count >= 8) return SK().ffa.feed.streak_word_rampage;
    return SK().ffa.feed.streak_word_spree;
}
// Each milestone gets a DISTINCT sound. The old set were all "RankUp" jingles that blurred
// together (and godlike collided with the winner sting). These escalate in weight — a light
// positive ding at spree up to a heavy field-upgrade unlock at godlike — and every one is unique
// vs first-blood (RankUp_Extra) and the winner (AccoladeCareerBest).
// Alternate killstreak stings mixed in at random so streaks don't always sound the same.
const STREAK_MIXINS: mod.RuntimeSpawn_Common[] = [
    RS.SFX_UI_Gauntlet_Dogtags_OneShot2D,
    RS.SFX_UI_Gauntlet_EOM_ReinforcementCardReveal_OneShot2D,
];
function streakSfx(count: number): mod.RuntimeSpawn_Common {
    // ~1/3 of the time play one of the mix-in stings (random) instead of the tier sound.
    if (Math.random() < 0.34) return STREAK_MIXINS[Math.floor(Math.random() * STREAK_MIXINS.length)];
    if (count >= 16) return RS.SFX_UI_Notification_Primary_J_2D; // GODLIKE
    if (count >= 12) return RS.SFX_UI_Notification_Primary_D_2D; // UNSTOPPABLE
    if (count >= 8) return RS.SFX_UI_Notification_Primary_C_2D;  // RAMPAGE
    return RS.SFX_UI_Notification_Primary_A_2D;                  // SPREE (4)
}

/** The streak word Message for a given count (for the Notification-Box callout). */
export function streakWordMessage(count: number): mod.Message {
    return mod.Message(streakWord(count));
}
const FIRST_BLOOD_SFX = RS.SFX_UI_EOR_RankUp_Extra_OneShot2D;

// Only one banner at a time (newest wins).
let container: UIContainer | null = null;
let clearTimer: number | null = null;

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Announce] ${msg}`);
}

function playGlobal(sfx: mod.RuntimeSpawn_Common, amp: number): void {
    try {
        const obj = mod.SpawnObject(sfx, ZERO, ZERO) as mod.SFX;
        mod.PlaySound(obj, sfxVol(amp)); // no target = whole lobby
        // Let the sting play to its natural end (longest of these is first-blood at ~3.4s). We ONLY
        // clean up the spawned SFX object afterwards — no StopSound. The amped weapon is the only
        // sound we deliberately cut short (per design); everything else plays in full.
        Timers.setTimeout(() => {
            try {
                mod.UnspawnObject(obj as unknown as mod.Object);
            } catch {}
        }, 5000);
    } catch {}
}

function clearBanner(): void {
    if (clearTimer !== null) {
        try {
            Timers.clearTimeout(clearTimer);
        } catch {}
        clearTimer = null;
    }
    if (container) {
        try {
            container.delete();
        } catch {}
        container = null;
    }
}

function showBanner(title: mod.Message, line: mod.Message, titleColor: mod.Vector, ms: number): void {
    clearBanner();
    // Global (no receiver) top-center banner.
    container = new UIContainer({
        anchor: mod.UIAnchor.TopCenter,
        y: 120,
        width: 420,
        height: 70,
        bgAlpha: 0,
        bgFill: mod.UIBgFill.None,
        visible: true,
        depth: mod.UIDepth.AboveGameUI,
    });
    new UIText({
        parent: container,
        anchor: mod.UIAnchor.TopCenter,
        x: 0,
        y: 0,
        width: 420,
        height: 30,
        message: title,
        textSize: 26,
        textColor: titleColor,
        textAlpha: 1,
        textAnchor: mod.UIAnchor.Center,
        visible: true,
    });
    new UIText({
        parent: container,
        anchor: mod.UIAnchor.TopCenter,
        x: 0,
        y: 30,
        width: 420,
        height: 24,
        message: line,
        textSize: 18,
        textColor: mod.CreateVector(1, 1, 1),
        textAlpha: 1,
        textAnchor: mod.UIAnchor.Center,
        visible: true,
    });
    clearTimer = Timers.setTimeout(clearBanner, ms);
}

export function announceFirstBlood(killer: mod.Player): void {
    try {
        showBanner(mod.Message(SK().ffa.feed.firstblood_title), playerDisplayMessage(killer), GOLD, 3500);
        playGlobal(FIRST_BLOOD_SFX, 1); // at master level
        log('first blood');
    } catch {}
}

export function announceKillstreak(player: mod.Player, count: number): void {
    try {
        // NO banner: the Notification-Box callout (hud.showCallout) is the killstreak
        // notification now. The old top-center banner rendered BEHIND that box (overlapping
        // it). Keep only the escalating rank-up SFX.
        playGlobal(streakSfx(count), 1); // amp 1.0 -> sits AT master level (sfxVol multiplies by master)
        log(`killstreak ${count}`);
    } catch {}
}

/** Lobby-wide WINNER banner (ladder finished, or leader at the time limit). */
export function announceWinner(winner: mod.Player, byTimeLimit: boolean): void {
    try {
        const title = mod.Message(byTimeLimit ? SK().ffa.feed.timewinner : SK().ffa.feed.winner);
        showBanner(title, playerDisplayMessage(winner), GOLD, 8000);
        playGlobal(RS.SFX_UI_Scorelog_AccoladeCareerBest_OneShot2D, 1); // at master level
        log('winner announced');
    } catch {}
}

export function clearAnnouncements(): void {
    clearBanner();
}
