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

const RS = mod.RuntimeSpawn_Common;
const SK = (): mod.Any => mod.stringkeys;
const ZERO = mod.CreateVector(0, 0, 0);

const GOLD = mod.CreateVector(1, 0.9, 0.15);
const RED = mod.CreateVector(1, 0.35, 0.35);

// Killstreak milestones -> banner word + escalating rank-up SFX.
export const STREAK_MILESTONES = [3, 5, 7, 10];
function streakWord(count: number): mod.Any {
    if (count >= 10) return SK().ffa.feed.streak_word_godlike;
    if (count >= 7) return SK().ffa.feed.streak_word_unstoppable;
    if (count >= 5) return SK().ffa.feed.streak_word_rampage;
    return SK().ffa.feed.streak_word_spree;
}
function streakSfx(count: number): mod.RuntimeSpawn_Common {
    if (count >= 10) return RS.SFX_UI_Scorelog_AccoladeCareerBest_OneShot2D;
    if (count >= 7) return RS.SFX_UI_EOR_MasteryRankUp_OneShot2D;
    if (count >= 5) return RS.SFX_UI_EOR_RankUp_Extra_OneShot2D;
    return RS.SFX_UI_EOR_RankUp_Normal_OneShot2D;
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
        Timers.setTimeout(() => {
            try {
                mod.StopSound(obj);
            } catch {}
            try {
                mod.UnspawnObject(obj as unknown as mod.Object);
            } catch {}
        }, 1500);
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

function showBanner(title: mod.Any, line: mod.Any, titleColor: mod.Vector, ms: number): void {
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
        message: mod.Message(title),
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
        message: mod.Message(line),
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
        showBanner(SK().ffa.feed.firstblood_title, mod.Message(SK().ffa.feed.firstblood_line, killer) as mod.Any, GOLD, 3500);
        playGlobal(FIRST_BLOOD_SFX, 8);
        log('first blood');
    } catch {}
}

export function announceKillstreak(player: mod.Player, count: number): void {
    try {
        showBanner(
            streakWord(count),
            mod.Message(SK().ffa.feed.streak_line, player, count) as mod.Any,
            count >= 10 ? RED : GOLD,
            3500
        );
        playGlobal(streakSfx(count), 8);
        log(`killstreak ${count}`);
    } catch {}
}

/** Lobby-wide WINNER banner (ladder finished, or leader at the time limit). */
export function announceWinner(winner: mod.Player, byTimeLimit: boolean): void {
    try {
        const title = mod.Message(byTimeLimit ? 'TIME! WINNER' : 'WINNER');
        showBanner(title as mod.Any, mod.Message(winner) as mod.Any, GOLD, 8000);
        playGlobal(RS.SFX_UI_Scorelog_AccoladeCareerBest_OneShot2D, 9);
        log('winner announced');
    } catch {}
}

export function clearAnnouncements(): void {
    clearBanner();
}
