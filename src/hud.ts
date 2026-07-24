// ============================================================================
// FFA GUNMASTER — HUD (author's Art/UI-Layout, persistent + swap-only)
// ============================================================================
// Faithful to Art/UI-Layout.pdn (measured off the layer PNGs, mapped from the
// 2558x1360 mockup to the SDK's fixed 1920x1080 UI canvas: sx=0.7506, sy=0.7941):
//
//   1. WEAPON BAR (TopCenter)  — 9 cards, current tier ALWAYS the enlarged center
//      card. Black fill (20,24,29) + ORANGE (255,106,0) outline + white weapon image.
//      NO per-card numbers (the author's design). The window slides; card geometry is
//      STATIC (center is always current), so only the 9 images ever swap.
//   2. CURRENT WEAPON PANEL     — hangs directly under the center card: gray (64,64,64
//      @50%) fill + orange outline, "CURRENT WEAPON" / <name> / "N/M KILLS" (gold).
//   3. TOP PLAYERS (BottomLeft) — black header strip + gray body, top-5 rows
//      "rank name gun/total", leader row gold.
//
// PERFORMANCE: every widget is built ONCE per player/viewer. Per-tier updates only
// delete+re-add the small weapon image in a slot whose weapon changed and rewrite
// text via SetUITextLabel/SetUITextColor. Nothing is torn down + rebuilt (perf doc
// P4/P8). Text is registered string keys; names via ladder.cardNameMessage.
// ============================================================================
// CONTENTS (each is a "// ---- NAME ----" banner below — Ctrl-F the name to jump):
//   • Colors / geometry / module state ......... the tunables + per-player widget maps
//   • SHELL ..................................... build the weapon bar + panel ONCE/player
//   • Weapon bar refresh ........................ swap the 9 card images on promotion
//   • Current-weapon panel refresh .............. rewrite name + kills text in place
//   • INTRO CHOREOGRAPHY hooks .................. reveal the HUD piece-by-piece at start
//   • NOTIFICATION BOX .......................... killstreak / PROMOTED / DEMOTED callouts
//   • DEMOTION visuals .......................... paint at-risk cards red / PROTECTED green
//   • Promotion/demotion banner + screen flash .. the coloured full-screen prestige pops
//   • PITCH-BLACK screen fade + DEATH QUOTES .... masks the respawn deploy-screen bounce
//   • TOP PLAYERS ............................... the bottom-left mini standings board
//   • Cleanup ................................... destroyHud / destroyAllHuds (teardown)
// Public API used by index.ts: ensureHud, updateHud, show/hideHud, refreshMiniBoard,
// the show*Callout/showPromotion/showWinner notes, screenFlash, start/endBlackHold.
// ============================================================================

import { Timers } from 'bf6-portal-utils/timers/index.ts';
import { GameUI } from './game-ui.ts';
import { KILLS_PER_TIER, DEBUG_MODE } from './config.ts';
import { cardNameMessage, currentTier, demotionFloor, killsForTier, ladderLength, progressOf, tierAt, tierWeaponPackage } from './ladder.ts';
import { playerDisplayMessage } from './roster.ts';

const SK = (): mod.Any => mod.stringkeys;

// --- Colors (sampled from the Art layers) ---
const WHITE = GameUI.rgb(0.94, 0.94, 0.94); // (240,240,240)
const GOLD = GameUI.rgb(1, 0.85, 0); // (255,216,0) leader row + kills
const ORANGE = GameUI.rgb(1, 0.416, 0); // (255,106,0) card/panel outline
const CARD_BG = GameUI.rgb(0.078, 0.094, 0.114); // (20,24,29) card fill
const PROT_GREEN = GameUI.rgb(0.1, 0.5, 0.22); // "PROTECTED" gun-slot square (below the demotion floor)
const PROT_FONT = 11; // "PROTECTED" label font (fits the 110px card)
const PANEL_BG = GameUI.rgb(0.25, 0.25, 0.25); // (64,64,64) panel + board body
const BLACK = GameUI.rgb(0, 0, 0); // board header strip
const BLUE = GameUI.rgb(0.25, 0.6, 1); // promotion screen flash
const YELLOW = GameUI.rgb(1, 1, 0); // Notification-Box achievement flash
const RED = GameUI.rgb(1, 0.15, 0.15); // demotion flash + at-risk card backgrounds
const GREEN = GameUI.rgb(0.3, 0.95, 0.45); // promotion box-note flash + text
const GRAY_OUTLINE = GameUI.rgb(0.45, 0.45, 0.48); // previous/future card outline (bar behind cards)

// Notification Box (current-weapon panel) achievement-callout timing.
const NOTIFY_FLASH_MS = 300; // yellow flash in / out
const NOTIFY_HOLD_MS = 3000; // callout visible for 3s
const PROMO_FLASH_MS = 150; // quicker flash for the frequent normal-promotion note
const PROMO_HOLD_MS = 700; // normal promotion (every 2 kills): ~1s total takeover
const WINNER_HOLD_MS = 5000; // WINNER! lingers longer
// Panel text default sizes — MUST match the GameUI.text creation below (label/name/kills).
const PANEL_LABEL_FONT = 15, PANEL_NAME_FONT = 20, PANEL_KILLS_FONT = 17;
// Big callout sizes so PROMOTED/DEMOTED fill the box with a large +N/-N under it.
const NOTE_BIG_WORD_FONT = 23, NOTE_BIG_NUM_FONT = 27;

// --- Geometry (virtual 1920x1080; measured from Art/UI-Layout container layer) ---
// The orange is ONE connected shape: a solid BAR behind all 9 cards + a solid center
// TAB down to the notification box. Black card squares sit ON TOP of the orange, so the
// orange shows through the gaps/edges as the outlines. Cards are pinned to y=0 (flush
// to the screen top), so the outline appears on the sides + bottom (never the top).
const BAR_TOP_Y = 0; // 0px from screen top (author requirement)
const SLOT_OFFSETS = [-500, -385, -270, -155, 0, 155, 270, 385, 500]; // x from bar center
const TOTAL_SLOTS = SLOT_OFFSETS.length; // 9
const CENTER_SLOT = 4; // always the current tier (window centers on it)
const NORMAL_W = 110, NORMAL_H = 51;
const CENTER_W = 191, CENTER_H = 90;
const BAR_W = 1140, BAR_H = 168; // container spans the whole connected orange
const ORANGE_BAR_W = 1118, ORANGE_BAR_H = 56; // solid orange bar behind all 9 cards
const ORANGE_TAB_W = 200, ORANGE_TAB_H = 168; // solid orange center tab (frames center card + notif box)

// Notification box (current-weapon panel) — under the center card, framed by the tab,
// same width as the center card.
const PANEL_Y = 94, PANEL_W = 191, PANEL_H = 68;
const PANEL_LABEL_Y = -22, PANEL_NAME_Y = 0, PANEL_KILLS_Y = 23; // from panel center
// 2-line callouts (big WORD + big +N/-N, blank middle): pull both lines toward the box center so
// they don't sit at the very top/bottom with a big gap between them.
const NOTE_TIGHT_WORD_Y = -13, NOTE_TIGHT_NUM_Y = 14;

const LB_LEFT = 24, LB_BOTTOM = 87, LB_W = 248, LB_H = 160; // BottomLeft
const LB_HEADER_H = 27;
const LB_ROWS = 5;
const LB_ROW_Y = [-38, -3, 20, 43, 66]; // row Y offsets from board center

export type FlashColor = 'green' | 'red' | 'gold' | 'white';

export interface BoardRow {
    player: mod.Player;
    gun: number;
    total: number;
    kills: number;
    deaths: number;
}

// --- Persistent widget caches (built ONCE; only images/text mutate) ---
const barContainer: Map<number, mod.UIWidget> = new Map();
const barFill: Map<number, (mod.UIWidget | null)[]> = new Map(); // 9 card fills (parents of images)
const barImg: Map<number, (mod.UIWidget | null)[]> = new Map(); // 9 weapon images (swapped)
const barImgKey: Map<number, string[]> = new Map(); // weapon id currently drawn per slot
const barProt: Map<number, (mod.UIWidget | null)[]> = new Map(); // green "PROTECTED" overlay per slot (demotion floor)
const barFrame: Map<number, (mod.UIWidget | null)[]> = new Map(); // [obar, otab] — for the intro reveal
const panelLabel: Map<number, mod.UIWidget> = new Map(); // "CURRENT WEAPON" line (callout takeover)
const panelName: Map<number, mod.UIWidget> = new Map(); // current-weapon name text
const panelKills: Map<number, mod.UIWidget> = new Map(); // current-weapon "N/M KILLS" text
const panelWidgets: Map<number, mod.UIWidget[]> = new Map(); // [panel, border] for cleanup

// Notification-Box callout state: while a player's box is showing an achievement, the
// normal weapon/kills refresh must NOT overwrite it.
const notifyActive: Set<number> = new Set();
const notifyTimers: Map<number, number[]> = new Map();
// BACKLOG: callouts fired while the box is busy queue here (FIFO) and play back-to-back, so a kill
// that triggers several (DEMOTED victim -> PROMOTED -> killstreak) shows them in sequence, not one.
const notifyQueue: Map<number, Array<() => void>> = new Map();
const NOTIFY_QUEUE_MAX = 3; // cap the backlog so a spree can't stack callouts endlessly
// PERSISTENT "GET A KILL!" state: while carrying a demotion charge the box shows the nag until
// the player gets a kill or dies (clearDemotionWarning clears it). Survives transient callouts —
// updateCurrentWeapon repaints the nag instead of the weapon info while this is set.
const getAKillActive: Set<number> = new Set();

const lbBody: Map<number, mod.UIWidget> = new Map(); // per-viewer board body
const lbRank: Map<string, mod.UIWidget> = new Map(); // `${viewerId}_${row}`
const lbName: Map<string, mod.UIWidget> = new Map();
const lbScore: Map<string, mod.UIWidget> = new Map();

const humans: Map<number, mod.Player> = new Map();
const shellLogged: Set<number> = new Set();

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[HUD] ${msg}`);
}
function isBot(player: mod.Player): boolean {
    try {
        return mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier);
    } catch {
        return false;
    }
}
const blankMsg = (): mod.Message => mod.Message(SK().ffa.hud.blank);
const killsMsg = (k: number, need: number = KILLS_PER_TIER): mod.Message => mod.Message(SK().ffa.hud.kills_full, k, need);
const slashMsg = (a: number, b: number): mod.Message => mod.Message(SK().ffa.num.slash, a, b);
const numMsg = (n: number): mod.Message => mod.Message(SK().ffa.num.n, n);

// ---------------------------------------------------------------------------
// SHELL: weapon bar (9 cards) + current-weapon panel. Built ONCE per player.
// ---------------------------------------------------------------------------
function ensureHudShell(player: mod.Player, pid: number): boolean {
    if (barContainer.has(pid)) return true;

    const container = GameUI.container('wbar_' + pid, {
        pos: GameUI.vec(0, BAR_TOP_Y),
        size: GameUI.vec(BAR_W, BAR_H),
        anchor: mod.UIAnchor.TopCenter,
        receiver: player,
    });
    if (!container) {
        if (!shellLogged.has(pid)) {
            shellLogged.add(pid);
            log(`SHELL ${pid}: bar container FAILED (UI not ready)`);
        }
        return false;
    }
    barContainer.set(pid, container);

    // Solid BAR behind the 9 cards (GREY) + solid center TAB (ORANGE) framing the current
    // card + notification box. Rendered FIRST so the black cards + gray panel sit on top and
    // the backing shows only at the gaps/edges = the outlines. The bar is grey so the
    // previous/future cards get a GREY outline; the orange tab on top makes the CURRENT card
    // (and the notification box) pop orange.
    const obar = GameUI.container('obar_' + pid, {
        pos: GameUI.vec(0, 0),
        size: GameUI.vec(ORANGE_BAR_W, ORANGE_BAR_H),
        anchor: mod.UIAnchor.TopCenter,
        parent: container,
        bgColor: GRAY_OUTLINE,
        bgAlpha: 0.4, // grey outline behind the previous/future cards is semi-transparent
        fill: mod.UIBgFill.Solid,
        receiver: player,
    });
    const otab = GameUI.container('otab_' + pid, {
        pos: GameUI.vec(0, 0),
        size: GameUI.vec(ORANGE_TAB_W, ORANGE_TAB_H),
        anchor: mod.UIAnchor.TopCenter,
        parent: container,
        bgColor: ORANGE,
        bgAlpha: 1,
        fill: mod.UIBgFill.Solid,
        receiver: player,
    });
    barFrame.set(pid, [obar, otab]);

    // 9 black card squares ON TOP of the orange — ALWAYS visible (so every slot shows
    // even at match start / for not-yet-reached tiers); only the weapon image swaps.
    const fills: (mod.UIWidget | null)[] = [];
    for (let i = 0; i < TOTAL_SLOTS; i++) {
        const isCenter = i === CENTER_SLOT;
        fills[i] = GameUI.container('bfill_' + pid + '_' + i, {
            pos: GameUI.vec(SLOT_OFFSETS[i], 0), // top-aligned at y=0 (flush to screen top)
            size: GameUI.vec(isCenter ? CENTER_W : NORMAL_W, isCenter ? CENTER_H : NORMAL_H),
            anchor: mod.UIAnchor.TopCenter,
            parent: container,
            bgColor: CARD_BG,
            bgAlpha: 1,
            // Dark at the BOTTOM fading to fully transparent at the TOP. On these TopCenter cards
            // that's GradientBottom (GradientTop rendered flipped/dark-at-top here). The grey/orange
            // bar behind shows through the fade.
            fill: mod.UIBgFill.GradientBottom,
            receiver: player,
        });
    }
    barFill.set(pid, fills);
    barImg.set(pid, new Array(TOTAL_SLOTS).fill(null));
    barImgKey.set(pid, new Array(TOTAL_SLOTS).fill(''));

    // Notification box (gray) on top of the tab. OPAQUE so the orange tab shows only as
    // the box's OUTLINE (not bleeding through as a tint) — same treatment as the cards.
    const panel = GameUI.container('cwpanel_' + pid, {
        pos: GameUI.vec(0, PANEL_Y),
        size: GameUI.vec(PANEL_W, PANEL_H),
        anchor: mod.UIAnchor.TopCenter,
        parent: container,
        bgColor: PANEL_BG,
        bgAlpha: 1,
        fill: mod.UIBgFill.Solid,
        receiver: player,
    });
    if (panel) {
        panelWidgets.set(pid, [panel]);
        const labelW = GameUI.text('cwlabel_' + pid, mod.Message(SK().ffa.hud.weapon_pos, 1, ladderLength()), {
            pos: GameUI.vec(0, PANEL_LABEL_Y),
            size: GameUI.vec(PANEL_W - 10, 20),
            parent: panel,
            fontSize: 15,
            color: WHITE,
            receiver: player,
        });
        if (labelW) panelLabel.set(pid, labelW);
        const nameW = GameUI.text('cwname_' + pid, cardNameMessage(null), {
            pos: GameUI.vec(0, PANEL_NAME_Y),
            size: GameUI.vec(PANEL_W - 10, 26),
            parent: panel,
            fontSize: 20,
            color: WHITE,
            receiver: player,
        });
        if (nameW) panelName.set(pid, nameW);
        const killsW = GameUI.text('cwkills_' + pid, killsMsg(0), {
            pos: GameUI.vec(0, PANEL_KILLS_Y),
            size: GameUI.vec(PANEL_W - 10, 22),
            parent: panel,
            fontSize: 17,
            color: GOLD,
            receiver: player,
        });
        if (killsW) panelKills.set(pid, killsW);
    }
    if (!shellLogged.has(pid)) {
        shellLogged.add(pid);
        log(`SHELL ${pid}: built (connected orange + 9 cards + notif box)`);
    }
    return true;
}

/** Toggle a green "PROTECTED" overlay (white centered label) on a below-floor gun slot. Created
 *  lazily as a child of the card, then shown/hidden — the demotion floor makes it "PROTECTED". */
function paintProtectedSlot(player: mod.Player, pid: number, i: number, on: boolean, fill: mod.UIWidget | null): void {
    const prot = barProt.get(pid) ?? new Array(TOTAL_SLOTS).fill(null);
    if (on) {
        if (!prot[i] && fill) {
            const g = GameUI.container('bprot_' + pid + '_' + i, {
                pos: GameUI.vec(0, 0),
                size: GameUI.vec(NORMAL_W, NORMAL_H),
                anchor: mod.UIAnchor.Center,
                parent: fill,
                bgColor: PROT_GREEN,
                bgAlpha: 1,
                fill: mod.UIBgFill.Solid,
                receiver: player,
            });
            if (g) {
                GameUI.text('bprottx_' + pid + '_' + i, mod.Message(SK().ffa.hud.protected), {
                    pos: GameUI.vec(0, 0),
                    size: GameUI.vec(NORMAL_W, NORMAL_H),
                    anchor: mod.UIAnchor.Center,
                    parent: g,
                    fontSize: PROT_FONT,
                    color: WHITE,
                    textAnchor: mod.UIAnchor.Center,
                    receiver: player,
                });
            }
            prot[i] = g;
            barProt.set(pid, prot);
        }
        if (prot[i]) { try { mod.SetUIWidgetVisible(prot[i]!, true); } catch {} }
    } else if (prot[i]) {
        try { mod.SetUIWidgetVisible(prot[i]!, false); } catch {}
    }
}

// ---------------------------------------------------------------------------
// Weapon bar refresh — center card is always the current tier, so geometry is
// static; only images swap (and only when a slot's weapon actually changed).
// ---------------------------------------------------------------------------
function updateWeaponBar(player: mod.Player, pid: number): void {
    const rec = progressOf(player);
    const currentIndex = rec?.ladderIndex ?? 0;
    const total = ladderLength();
    const startIndex = currentIndex - CENTER_SLOT; // current lands on the center slot
    // Demotion floor: real-gun cards BELOW it render as green "PROTECTED" squares (not the weapon), so
    // the player SEES they can't be knocked back further than DEMOTION_MAX_BACK guns. At the floor, all
    // previous slots read PROTECTED.
    const floor = demotionFloor(player);

    const fills = barFill.get(pid) ?? [];
    const imgs = barImg.get(pid) ?? [];
    const keys = barImgKey.get(pid) ?? [];
    const dbg: string[] = [];

    for (let i = 0; i < TOTAL_SLOTS; i++) {
        const fill = fills[i]; // black card square — ALWAYS visible; never hidden
        const weaponIndex = startIndex + i;
        const belowFloor = weaponIndex < floor; // locked-out previous gun -> PROTECTED (green)
        // Green "PROTECTED" overlay on real-gun slots below the floor; off for in-range/out-of-range.
        paintProtectedSlot(player, pid, i, weaponIndex >= 0 && belowFloor, fill);
        const tier = weaponIndex >= 0 && weaponIndex < total && !belowFloor ? tierAt(weaponIndex) : null;

        // Empty slot (before tier 0 / past the end): keep the black square, drop the image.
        if (!tier) {
            if (imgs[i]) {
                GameUI.deleteWidget(imgs[i]);
                imgs[i] = null;
                keys[i] = '';
            }
            dbg.push(`${i}:${weaponIndex}:-`);
            continue;
        }

        // Swap the weapon image only when the TIER in this slot changed (no
        // SetUIWeaponImage exists — the weapon is baked in at creation). Key on the tier
        // CARD NAME: `mod.Weapons` enum values ALL stringify to "[Weapons]", so keying on
        // the weapon collapsed every card to one key and froze the whole bar after the
        // first draw. cardName is unique per tier, so the window slides correctly.
        const key = tier.cardName;
        if (keys[i] === key) {
            dbg.push(`${i}:${weaponIndex}:${key}:skip`);
            continue;
        }
        GameUI.deleteWidget(imgs[i]);
        imgs[i] = null;
        const isCenter = i === CENTER_SLOT;
        const imgSize = GameUI.vec(isCenter ? CENTER_W - 8 : NORMAL_W - 6, isCenter ? CENTER_H - 12 : NORMAL_H - 10);
        const imgPos = GameUI.vec(0, 0);
        if (tier.weapon !== undefined) {
            imgs[i] = GameUI.weaponImage('wimg_' + pid + '_' + i, tier.weapon, imgPos, imgSize, fill, tierWeaponPackage(tier));
        } else if (tier.gadget !== undefined) {
            imgs[i] = GameUI.gadgetImage('wimg_' + pid + '_' + i, tier.gadget, imgPos, imgSize, fill);
        }
        keys[i] = key;
        dbg.push(`${i}:${weaponIndex}:${key}:${imgs[i] ? 'ok' : 'NULL'}`);
    }
    log(`BAR pid=${pid} cur=${currentIndex} start=${startIndex} [${dbg.join(' ')}]`);
}

// ---------------------------------------------------------------------------
// Current-weapon panel refresh — text only (name + kills), in place.
// ---------------------------------------------------------------------------
/** Paint the persistent big-red "GET A KILL!" nag into the box (name slot, centered). */
function paintGetAKill(pid: number): void {
    const panel = (panelWidgets.get(pid) ?? [])[0];
    if (panel) { mod.SetUIWidgetBgColor(panel, PANEL_BG); mod.SetUIWidgetBgAlpha(panel, 1); }
    const l = panelLabel.get(pid), n = panelName.get(pid), k = panelKills.get(pid);
    if (l) { mod.SetUITextLabel(l, blankMsg()); try { mod.SetUITextSize(l, PANEL_LABEL_FONT); } catch {} }
    if (n) {
        mod.SetUITextLabel(n, mod.Message(SK().ffa.hud.get_a_kill));
        mod.SetUITextColor(n, YELLOW); // box text is white/yellow only
        try { mod.SetUITextSize(n, NOTE_BIG_WORD_FONT); } catch {}
    }
    if (k) { mod.SetUITextLabel(k, blankMsg()); try { mod.SetUITextSize(k, PANEL_KILLS_FONT); } catch {} }
}

function updateCurrentWeapon(player: mod.Player, pid: number): void {
    if (notifyActive.has(pid)) return; // an achievement callout owns the box right now
    if (getAKillActive.has(pid)) { paintGetAKill(pid); return; } // carrying a charge -> persistent nag
    const rec = progressOf(player);
    const currentIndex = rec?.ladderIndex ?? 0;
    const total = ladderLength();
    const tier = currentTier(player);
    const isFinal = currentIndex >= total - 1;

    // Line 1: "WEAPON N/M" — makes the current ladder position explicit.
    const labelW = panelLabel.get(pid);
    if (labelW) {
        mod.SetUITextLabel(labelW, mod.Message(SK().ffa.hud.weapon_pos, currentIndex + 1, total));
        mod.SetUITextColor(labelW, WHITE);
    }
    const nameW = panelName.get(pid);
    if (nameW) {
        mod.SetUITextLabel(nameW, cardNameMessage(tier));
        // Notification-box text is white or yellow only: special guns (final / amped) = yellow, else white.
        mod.SetUITextColor(nameW, isFinal || tier?.isAmped ? YELLOW : WHITE);
    }
    const killsW = panelKills.get(pid);
    if (killsW) mod.SetUITextLabel(killsW, killsMsg(rec?.tierKills ?? 0, killsForTier(currentIndex)));
}

export function updateHud(player: mod.Player): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        humans.set(pid, player);
        if (!ensureHudShell(player, pid)) return;
        updateWeaponBar(player, pid);
        updateCurrentWeapon(player, pid);
    } catch {}
}

export function ensureHud(player: mod.Player): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        humans.set(pid, player);
        updateHud(player);
        log(`hud ready for ${pid}`);
    } catch {}
}

/** Hide the whole Custom UI (weapon bar + cards + notification box + leaderboard) while the
 *  player is dead/spectating. Toggles ONLY the two top-level containers — their children ride
 *  along — so nothing is destroyed; showHud flips them back on respawn. */
export function hideHud(player: mod.Player): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        const bar = barContainer.get(pid);
        if (bar) mod.SetUIWidgetVisible(bar, false);
        const lb = lbBody.get(pid);
        if (lb) mod.SetUIWidgetVisible(lb, false);
    } catch {}
}

/** Re-show the Custom UI on respawn (see hideHud). */
export function showHud(player: mod.Player): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        const bar = barContainer.get(pid);
        if (bar) mod.SetUIWidgetVisible(bar, true);
        const lb = lbBody.get(pid);
        if (lb) mod.SetUIWidgetVisible(lb, true);
    } catch {}
}

// ---------------------------------------------------------------------------
// INTRO CHOREOGRAPHY hooks — reveal the HUD piece-by-piece, synced to the
// match-start sound (see intro.ts). Everything is hidden by introHide, then
// revealed on the sound's beats: frame on the first accent, cards cascading on
// the mid-motif. The container stays present so children can toggle individually.
// ---------------------------------------------------------------------------
export function introHide(player: mod.Player): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        for (const w of barFrame.get(pid) ?? []) if (w) mod.SetUIWidgetVisible(w, false);
        for (const w of barFill.get(pid) ?? []) if (w) mod.SetUIWidgetVisible(w, false);
        for (const w of barImg.get(pid) ?? []) if (w) mod.SetUIWidgetVisible(w, false);
        for (const w of panelWidgets.get(pid) ?? []) if (w) mod.SetUIWidgetVisible(w, false);
        const lb = lbBody.get(pid); if (lb) mod.SetUIWidgetVisible(lb, false);
    } catch {}
}

/** Reveal the grey bar + orange tab + notification box — the "UI built" accent. */
export function introRevealFrame(player: mod.Player): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        for (const w of barFrame.get(pid) ?? []) if (w) mod.SetUIWidgetVisible(w, true);
        for (const w of panelWidgets.get(pid) ?? []) if (w) mod.SetUIWidgetVisible(w, true);
    } catch {}
}

/** Reveal ONE weapon card (fill + image) — the cascade on the mid-motif. */
export function introRevealCard(player: mod.Player, i: number): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        const f = (barFill.get(pid) ?? [])[i]; if (f) mod.SetUIWidgetVisible(f, true);
        const img = (barImg.get(pid) ?? [])[i]; if (img) mod.SetUIWidgetVisible(img, true);
    } catch {}
}

/** Reveal the leaderboard (during the calm "get ready" stage). */
export function introRevealBoard(player: mod.Player): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        const lb = lbBody.get(pid); if (lb) mod.SetUIWidgetVisible(lb, true);
    } catch {}
}

/** Reveal EVERYTHING at once (FIGHT / late-joiner safety net so nobody is left with a hidden HUD). */
export function introRevealAll(player: mod.Player): void {
    try {
        if (isBot(player)) return;
        introRevealFrame(player);
        for (let i = 0; i < TOTAL_SLOTS; i++) introRevealCard(player, i);
        introRevealBoard(player);
    } catch {}
}

/** Cheap per-kill update: only the panel "N/M KILLS" text (no image work). */
export function updateKillProgress(player: mod.Player): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        if (notifyActive.has(pid) || getAKillActive.has(pid)) return; // callout / nag owns the box
        const killsW = panelKills.get(pid);
        const rec = progressOf(player);
        if (killsW) mod.SetUITextLabel(killsW, killsMsg(rec?.tierKills ?? 0, killsForTier(rec?.ladderIndex ?? 0)));
    } catch {}
}

// ---------------------------------------------------------------------------
// NOTIFICATION BOX — achievement callout (killstreaks). Takes over the player's
// current-weapon panel: flash yellow, show <word>/<name>/<N KILLS> for 5s, flash
// yellow, restore. HUMANS ONLY (callers already gate bots; this double-guards).
// ---------------------------------------------------------------------------
function clearNotifyTimers(pid: number): void {
    for (const t of notifyTimers.get(pid) ?? []) {
        try {
            Timers.clearTimeout(t);
        } catch {}
    }
    notifyTimers.delete(pid);
}

/** Solid-color flash of the panel, texts blanked (the "pop" between states). */
function flashPanel(pid: number, color: mod.Vector): void {
    const panel = (panelWidgets.get(pid) ?? [])[0];
    if (panel) {
        mod.SetUIWidgetBgColor(panel, color);
        mod.SetUIWidgetBgAlpha(panel, 0.95);
    }
    const l = panelLabel.get(pid), n = panelName.get(pid), k = panelKills.get(pid);
    if (l) mod.SetUITextLabel(l, blankMsg());
    if (n) mod.SetUITextLabel(n, blankMsg());
    if (k) mod.SetUITextLabel(k, blankMsg());
}

/** The core Notification-Box animation, shared by EVERY box note (killstreak, promotion,
 *  demotion, winner, get-a-kill): flash <color> (blank) -> reveal 3 lines -> flash <color>
 *  -> restore the viewer's own WEAPON N/M box. line3 === null blanks the kills slot. */
/** Public entry: show a note sequence now, or BACKLOG it behind the callout already on this box.
 *  Callers fire in priority order (DEMOTED victim -> PROMOTED -> killstreak), so FIFO preserves it. */
function runNoteSequence(
    pid: number, viewer: mod.Player, flashColor: mod.Vector,
    l1: mod.Message, l1c: mod.Vector,
    l2: mod.Message, l2c: mod.Vector,
    l3: mod.Message | null, l3c: mod.Vector,
    flashMs: number, holdMs: number,
    l1Font: number = PANEL_LABEL_FONT, l2Font: number = PANEL_NAME_FONT, l3Font: number = PANEL_KILLS_FONT,
    tight: boolean = false,
): void {
    const play = (): void => playNoteNow(pid, viewer, flashColor, l1, l1c, l2, l2c, l3, l3c, flashMs, holdMs, l1Font, l2Font, l3Font, tight);
    if (notifyActive.has(pid)) {
        const q = notifyQueue.get(pid) ?? [];
        if (q.length < NOTIFY_QUEUE_MAX) { q.push(play); notifyQueue.set(pid, q); } // else drop (backlog full)
        return;
    }
    notifyActive.add(pid);
    play();
}

/** After a callout finishes: play the next backlogged one, or clear active + repaint the box. */
function drainNotify(pid: number, viewer: mod.Player): void {
    const q = notifyQueue.get(pid);
    if (q && q.length > 0) {
        const next = q.shift()!;
        if (q.length === 0) notifyQueue.delete(pid);
        next(); // notifyActive stays true -> playNoteNow runs the next sequence back-to-back
        return;
    }
    notifyActive.delete(pid);
    try { if (mod.IsPlayerValid(viewer)) updateCurrentWeapon(viewer, pid); } catch {}
}

function playNoteNow(
    pid: number, viewer: mod.Player, flashColor: mod.Vector,
    l1: mod.Message, l1c: mod.Vector,
    l2: mod.Message, l2c: mod.Vector,
    l3: mod.Message | null, l3c: mod.Vector,
    flashMs: number, holdMs: number,
    l1Font: number, l2Font: number, l3Font: number, tight: boolean,
): void {
    if (!ensureHudShell(viewer, pid)) { drainNotify(pid, viewer); return; }
    clearNotifyTimers(pid);

    // 1) flash (blank text).
    flashPanel(pid, flashColor);

    // 2) reveal the three lines (with per-line font sizes — big for PROMOTED/DEMOTED).
    const t1 = Timers.setTimeout(() => {
        const panel = (panelWidgets.get(pid) ?? [])[0];
        if (panel) {
            mod.SetUIWidgetBgColor(panel, PANEL_BG);
            mod.SetUIWidgetBgAlpha(panel, 1);
        }
        const l = panelLabel.get(pid), n = panelName.get(pid), k = panelKills.get(pid);
        if (l) { mod.SetUITextLabel(l, l1); mod.SetUITextColor(l, l1c); try { mod.SetUITextSize(l, l1Font); } catch {} }
        if (n) { mod.SetUITextLabel(n, l2); mod.SetUITextColor(n, l2c); try { mod.SetUITextSize(n, l2Font); } catch {} }
        if (k) {
            if (l3) { mod.SetUITextLabel(k, l3); mod.SetUITextColor(k, l3c); try { mod.SetUITextSize(k, l3Font); } catch {} }
            else mod.SetUITextLabel(k, blankMsg());
        }
        // TIGHT: pull the word + number toward center (blank-middle 2-line callouts).
        if (tight) {
            try { if (l) mod.SetUIWidgetPosition(l, GameUI.vec(0, NOTE_TIGHT_WORD_Y)); } catch {}
            try { if (k) mod.SetUIWidgetPosition(k, GameUI.vec(0, NOTE_TIGHT_NUM_Y)); } catch {}
        }
    }, flashMs);

    // 3) flash out.
    const t2 = Timers.setTimeout(() => flashPanel(pid, flashColor), flashMs + holdMs);

    // 4) reset the text sizes to the panel defaults, then play the NEXT backlogged callout (or, if
    //    the queue is empty, drainNotify clears active + repaints WEAPON N/M / name / kills).
    const t3 = Timers.setTimeout(() => {
        notifyTimers.delete(pid);
        const panel = (panelWidgets.get(pid) ?? [])[0];
        if (panel) {
            mod.SetUIWidgetBgColor(panel, PANEL_BG);
            mod.SetUIWidgetBgAlpha(panel, 1);
        }
        const l = panelLabel.get(pid), n = panelName.get(pid), k = panelKills.get(pid);
        try { if (l) mod.SetUITextSize(l, PANEL_LABEL_FONT); } catch {}
        try { if (n) mod.SetUITextSize(n, PANEL_NAME_FONT); } catch {}
        try { if (k) mod.SetUITextSize(k, PANEL_KILLS_FONT); } catch {}
        // Restore the panel's normal line positions (a tight callout may have moved them).
        try { if (l) mod.SetUIWidgetPosition(l, GameUI.vec(0, PANEL_LABEL_Y)); } catch {}
        try { if (n) mod.SetUIWidgetPosition(n, GameUI.vec(0, PANEL_NAME_Y)); } catch {}
        try { if (k) mod.SetUIWidgetPosition(k, GameUI.vec(0, PANEL_KILLS_Y)); } catch {}
        drainNotify(pid, viewer);
    }, flashMs + holdMs + flashMs);

    notifyTimers.set(pid, [t1, t2, t3]);
}

/** Killstreak callout on ONE viewer's box: yellow flash, <word>/<achiever name>/<N KILLS>
 *  (so every lobby member sees who's on the streak). */
function runCalloutOnBox(pid: number, viewer: mod.Player, wordMsg: mod.Message, nameMsg: mod.Message, streakCount: number): void {
    runNoteSequence(
        pid, viewer, YELLOW,
        wordMsg, YELLOW,
        nameMsg, WHITE,
        mod.Message(SK().ffa.hud.streak_kills, streakCount), WHITE,
        NOTIFY_FLASH_MS, NOTIFY_HOLD_MS,
    );
}

/** Broadcast an achievement callout to EVERY human's Notification Box, so the whole
 *  lobby sees who's on the streak (not just the achiever). Achiever must be human. */
export function showCallout(achiever: mod.Player, wordMsg: mod.Message, streakCount: number): void {
    try {
        if (isBot(achiever)) return;
        const nameMsg = mod.Message(achiever); // renders the ACHIEVER's name on every box
        for (const [viewerId, viewer] of humans) {
            try {
                if (!mod.IsPlayerValid(viewer)) {
                    destroyHud(viewerId);
                    continue;
                }
                runCalloutOnBox(viewerId, viewer, wordMsg, nameMsg, streakCount);
            } catch {}
        }
    } catch {}
}

/** Cancel any in-flight callout (player left / cleanup). */
export function cancelCallout(playerId: number): void {
    clearNotifyTimers(playerId);
    notifyQueue.delete(playerId);
    notifyActive.delete(playerId);
}

// ---------------------------------------------------------------------------
// DEMOTION visuals — at-risk card backgrounds (while carrying a demotion charge)
// + a red "DEMOTED" callout on respawn. Player's OWN box only (not broadcast).
// ---------------------------------------------------------------------------
/** Paint the CURRENT card + (n-1) previous cards RED — the guns this player will LOSE
 *  if they die while carrying an n-tier demotion charge. */
export function setDemotionWarning(player: mod.Player, n: number): void {
    try {
        if (isBot(player) || n <= 0) return;
        const pid = mod.GetObjId(player);
        if (!ensureHudShell(player, pid)) return;
        // Never mark more cards at-risk than the demotion LOCK can actually take: you can't be
        // knocked below the floor, so clamp the red run to (current - floor). At the floor: nothing.
        const rec = progressOf(player);
        const currentIndex = rec?.ladderIndex ?? 0;
        const effN = Math.min(n, Math.max(0, currentIndex - demotionFloor(player)));
        const fills = barFill.get(pid) ?? [];
        for (let i = 0; i < TOTAL_SLOTS; i++) {
            const f = fills[i];
            if (!f) continue;
            const atRisk = effN > 0 && i <= CENTER_SLOT && i > CENTER_SLOT - effN; // current + (effN-1) left
            mod.SetUIWidgetBgColor(f, atRisk ? RED : CARD_BG);
        }
    } catch {}
}

/** Charge resolved (kill / offload / backfire): clear the at-risk red cards AND the persistent
 *  "GET A KILL!" nag, then restore the box to the normal weapon info. */
export function clearDemotionWarning(player: mod.Player): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        for (const f of barFill.get(pid) ?? []) if (f) mod.SetUIWidgetBgColor(f, CARD_BG);
        getAKillActive.delete(pid); // stop the persistent nag
        if (!notifyActive.has(pid)) updateCurrentWeapon(player, pid); // restore weapon info now
    } catch {}
}

/** Red "DEMOTED / <n> GUNS" takeover of the player's own box (same flash->hold->restore
 *  format as the killstreak callout), shown on the demoted respawn. */
export function showDemotionCallout(player: mod.Player, gunsLost: number): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        runNoteSequence(
            pid, player, RED,
            mod.Message(SK().ffa.hud.demoted), YELLOW,          // "DEMOTED" — big, fills the box
            blankMsg(), WHITE,
            mod.Message(SK().ffa.hud.minus_n, gunsLost), WHITE, // "-N" — big, underneath
            NOTIFY_FLASH_MS, NOTIFY_HOLD_MS,
            NOTE_BIG_WORD_FONT, PANEL_NAME_FONT, NOTE_BIG_NUM_FONT, true,
        );
    } catch {}
}

/** Red "DEMOTED / <victim> / -N" takeover of the KILLER's own box — shown when a kill dumped a
 *  demotion charge onto the victim (hot-potato success). Replaces the killer's PROMOTED note, but
 *  the caller still fires the blue promotion screen flash: they demoted an enemy AND moved up. */
export function showKillerDemotedVictim(player: mod.Player, victim: mod.Player, gunsKnocked: number): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        runNoteSequence(
            pid, player, RED,
            mod.Message(SK().ffa.hud.demoted), YELLOW,             // "DEMOTED"
            playerDisplayMessage(victim), WHITE,                   // victim's name (bots via registered key — no "\[BOT]")
            mod.Message(SK().ffa.hud.minus_n, gunsKnocked), WHITE, // "-N"
            NOTIFY_FLASH_MS, NOTIFY_HOLD_MS,
            // 3 lines -> use the SAME fonts + spacing as the weapon panel (CURRENT WEAPON / name /
            // N/M KILLS) so DEMOTED / <victim> / -N sits evenly and never overlaps. NOT tight.
            PANEL_LABEL_FONT, PANEL_NAME_FONT, PANEL_KILLS_FONT,
        );
    } catch {}
}

/** Green-flash "DEMOTION / PROTECTION" takeover — shown on respawn when a demotion was fully absorbed
 *  by the demotion floor (player kept their gun). Green flash (semantic "safe"), white/yellow text. */
export function showDemotionLockedCallout(player: mod.Player): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        runNoteSequence(
            pid, player, GREEN,
            mod.Message(SK().ffa.hud.demolock_top), YELLOW,  // "DEMOTION" — big
            blankMsg(), WHITE,
            mod.Message(SK().ffa.hud.demolock_bot), WHITE,   // "PROTECTION" — big, underneath
            NOTIFY_FLASH_MS, NOTIFY_HOLD_MS,
            NOTE_BIG_WORD_FONT, PANEL_NAME_FONT, NOTE_BIG_WORD_FONT, true,
        );
    } catch {}
}

/** Green "PROMOTED! / +N" box note for a ladder promotion: quick ~1s takeover, big word + big
 *  number filling the box. magnitude = how many guns jumped this kill (2 when a demotion-bounty
 *  kill lands on your second kill and skips a gun). Own box only. */
export function showPromotion(player: mod.Player, magnitude: number = 1): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        runNoteSequence(
            pid, player, GREEN,
            mod.Message(SK().ffa.hud.promoted), YELLOW,          // "PROMOTED!" — big, fills the box
            blankMsg(), WHITE,
            mod.Message(SK().ffa.hud.plus_n, magnitude), WHITE,  // "+N" — big, underneath
            PROMO_FLASH_MS, PROMO_HOLD_MS,
            NOTE_BIG_WORD_FONT, PANEL_NAME_FONT, NOTE_BIG_NUM_FONT, true,
        );
    } catch {}
}

/** Green "PROMOTED! / +N" box note for a PROMOTION POWERUP: same big headline as a normal
 *  promotion, with the big tier jump "+N" underneath, full hold. Own box only. */
export function showPowerupPromotion(player: mod.Player, magnitude: number): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        runNoteSequence(
            pid, player, GREEN,
            mod.Message(SK().ffa.hud.promoted), YELLOW,          // "PROMOTED!" — big
            blankMsg(), WHITE,
            mod.Message(SK().ffa.hud.plus_n, magnitude), WHITE,  // "+N" — big, underneath
            NOTIFY_FLASH_MS, NOTIFY_HOLD_MS,
            NOTE_BIG_WORD_FONT, PANEL_NAME_FONT, NOTE_BIG_NUM_FONT, true,
        );
    } catch {}
}

/** Gold "WINNER!" box note with the winner's own name underneath. Lingers longer. */
export function showWinner(player: mod.Player): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        runNoteSequence(
            pid, player, GOLD,
            mod.Message(SK().ffa.hud.winner), YELLOW, // "WINNER!"
            mod.Message(player), WHITE,               // winner's own name
            null, WHITE,
            NOTIFY_FLASH_MS, WINNER_HOLD_MS,
        );
    } catch {}
}

/** Bright-red "GET A KILL!" nag — PERSISTENT while carrying a demotion charge. It STAYS in the
 *  box until the player gets a kill or dies (clearDemotionWarning clears the flag). Transient
 *  callouts can still flash over it; they restore back to the nag while the flag is set. */
export function showGetAKill(player: mod.Player): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        if (!ensureHudShell(player, pid)) return;
        clearNotifyTimers(pid); // cancel any in-flight transient callout on this box
        notifyQueue.delete(pid); // the persistent nag supersedes any backlogged callouts
        notifyActive.delete(pid); // this is a persistent state, not a timed callout
        getAKillActive.add(pid); // held until a kill or death
        paintGetAKill(pid); // show it now
    } catch {}
}

// ---------------------------------------------------------------------------
// Promotion/demotion banner — built-in, SELF-CLEARING (no overlap).
// ---------------------------------------------------------------------------
export function flash(player: mod.Player, msg: mod.Message, _color: FlashColor = 'gold', _ms: number = 1800): void {
    try {
        if (isBot(player)) return;
        mod.DisplayHighlightedWorldLogMessage(msg, player);
    } catch {}
}

// Blue promotion screen flash — brief full-screen tint.
// Full-screen overlays are OVERSIZED and Center-anchored so they cover ULTRAWIDE (32:9 and beyond);
// the excess just extends off-screen on narrower displays. 4000 wide was too narrow for 32:9.
const SCREEN_COVER_W = 8000;
const SCREEN_COVER_H = 4500;
const FADE_TICK_MS = 33; // ~30fps alpha-step for the black fade

export function screenFlash(player: mod.Player, color: mod.Vector = BLUE, ms: number = 320): void {
    try {
        if (isBot(player)) return;
        const w = GameUI.container('screenflash_' + mod.GetObjId(player), {
            pos: GameUI.vec(0, 0),
            size: GameUI.vec(SCREEN_COVER_W, SCREEN_COVER_H),
            anchor: mod.UIAnchor.Center,
            bgColor: color,
            bgAlpha: 0.38,
            fill: mod.UIBgFill.Solid,
            receiver: player,
        });
        Timers.setTimeout(() => GameUI.deleteWidget(w), ms);
    } catch {}
}

// ---------------------------------------------------------------------------
// PITCH-BLACK screen fade — masks the deploy screen during the undeploy/deploy respawn bounce.
// AboveGameUI depth draws it over the deploy UI (community-confirmed). Per-player, ultrawide-safe.
// ---------------------------------------------------------------------------
// ⇩ DEATH QUOTES — large white text that fades in with the black and out with it. TO ADD MORE:
// add a "qN" entry under ffa.quotes in strings.json and append q.qN to the array below. That's it.
// Death-screen quotes: [saying, attribution] pairs. To add more, register q<N>/a<N>
// in strings.json (quotes block) and append one [q.q<N>, q.a<N>] entry here.
function quoteItems(): [mod.Any, mod.Any][] {
    const q = SK().ffa.quotes;
    return [
        [q.q0, q.a0], [q.q1, q.a1], [q.q2, q.a2], [q.q3, q.a3], [q.q4, q.a4],
        [q.q5, q.a5], [q.q6, q.a6], [q.q7, q.a7], [q.q8, q.a8], [q.q9, q.a9], [q.q10, q.a10],
        [q.q11, q.a11], [q.q12, q.a12], [q.q13, q.a13], [q.q14, q.a14], [q.q15, q.a15], [q.q16, q.a16],
    ];
}
// Shuffle-bag: cycle through EVERY quote (shuffled) before any repeats, and never repeat the
// same quote back-to-back across a refill. Guarantees a different quote on every death.
let quoteBag: number[] = [];
let lastQuoteIdx = -1;
function refillQuoteBag(count: number): void {
    const idx: number[] = [];
    for (let i = 0; i < count; i++) idx.push(i);
    for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    // Don't let the new bag OPEN with the quote we just showed (avoids a visible repeat).
    if (idx.length > 1 && idx[0] === lastQuoteIdx) [idx[0], idx[1]] = [idx[1], idx[0]];
    quoteBag = idx;
}
function pickQuote(): { quote: mod.Message; attrib: mod.Message } {
    const items = quoteItems();
    if (quoteBag.length === 0) refillQuoteBag(items.length);
    const i = quoteBag.shift() ?? Math.floor(Math.random() * items.length);
    lastQuoteIdx = i;
    const [qk, ak] = items[i];
    return { quote: mod.Message(qk), attrib: mod.Message(ak) };
}
const QUOTE_FONT = 40;          // large centred death quote (bottom-anchored; wraps upward)
const ATTRIB_FONT = 24;         // smaller source line under the quote
const ATTRIB_COL = GameUI.rgb(0.72, 0.72, 0.78); // dim white for the attribution
const QUOTE_FADE_IN_MS = 250;   // quote fades IN this fast (the black itself is instant)
const BLACK_GUARD_MS = 250;     // re-create the overlay this often while held (survives UI-transition wipes)

interface BlackState {
    overlay: mod.UIWidget | null;
    text: mod.UIWidget | null;       // the big quote
    textAttrib: mod.UIWidget | null; // the smaller source line
    quote: mod.Message;
    attrib: mod.Message;
    textIn: number; // 0..1 quote fade-in progress
    out: number;    // 0..1 overall fade-out progress (black + quote together)
    fading: boolean;
    fadeMs: number; // fade-out duration (set on endBlackHold)
}
const blackStates: Map<number, BlackState> = new Map();
const blackAnimTimers: Map<number, number> = new Map();
const blackGuardTimers: Map<number, number> = new Map();

function clearTimerMap(m: Map<number, number>, pid: number): void {
    const t = m.get(pid);
    if (t !== undefined) { try { Timers.clearInterval(t); } catch {} m.delete(pid); }
}

/** (Re)build the overlay + centred quote at the state's current alphas. Re-creating (rather than just
 *  re-asserting alpha) is what survives a full UI-transition wipe. */
function buildBlack(player: mod.Player, pid: number, st: BlackState): void {
    if (st.overlay) { try { GameUI.deleteWidget(st.overlay); } catch {} }
    const overlay = GameUI.container('blackfade_' + pid, {
        pos: GameUI.vec(0, 0), size: GameUI.vec(SCREEN_COVER_W, SCREEN_COVER_H),
        anchor: mod.UIAnchor.Center, bgColor: BLACK, bgAlpha: 1 - st.out,
        fill: mod.UIBgFill.Solid, depth: mod.UIDepth.AboveGameUI, receiver: player,
    }) as mod.UIWidget | null;
    st.overlay = overlay;
    const a = st.textIn * (1 - st.out);
    // Quote is BOTTOM-anchored in a tall box whose bottom edge sits just above screen-center: a
    // long quote wraps to extra lines that grow UPWARD, so its last line's bottom stays fixed and
    // never moves toward the attribution. (Box bottom = pos.y + height/2 = -160 + 150 = -10.)
    st.text = overlay
        ? (GameUI.text('blackquote_' + pid, st.quote, {
            parent: overlay, pos: GameUI.vec(0, -160), size: GameUI.vec(1680, 300),
            anchor: mod.UIAnchor.Center, fontSize: QUOTE_FONT, color: WHITE,
            alpha: a, textAnchor: mod.UIAnchor.BottomCenter, receiver: player,
        }) as mod.UIWidget | null)
        : null;
    // Attribution TOP-anchored: its box top must sit BELOW the quote box bottom (-10). Box top =
    // pos.y - height/2 = 44 - 30 = +14, i.e. a fixed ~24px gap under the quote's last line, always.
    st.textAttrib = overlay
        ? (GameUI.text('blackattrib_' + pid, st.attrib, {
            parent: overlay, pos: GameUI.vec(0, 44), size: GameUI.vec(1400, 60),
            anchor: mod.UIAnchor.Center, fontSize: ATTRIB_FONT, color: ATTRIB_COL,
            alpha: a, textAnchor: mod.UIAnchor.TopCenter, receiver: player,
        }) as mod.UIWidget | null)
        : null;
}

/** Slam a full-screen PITCH-BLACK overlay up (instant, reliable) with a large white DEATH QUOTE that
 *  fades in, and HOLD it (re-created every BLACK_GUARD_MS so the death->deploy-screen transition can't
 *  drop it). Held until endBlackHold, which fades the black + quote out together. */
export function startBlackHold(player: mod.Player): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        clearBlackFade(pid); // fresh
        const pq = pickQuote();
        const st: BlackState = { overlay: null, text: null, textAttrib: null, quote: pq.quote, attrib: pq.attrib, textIn: 0, out: 0, fading: false, fadeMs: 250 };
        blackStates.set(pid, st);
        buildBlack(player, pid, st); // instant black NOW (quote starts transparent)
        // Animator: ramp the quote IN, then (once fading) ramp black + quote OUT together; delete at 0.
        blackAnimTimers.set(pid, Timers.setInterval(() => {
            const s = blackStates.get(pid);
            if (!s) { clearTimerMap(blackAnimTimers, pid); return; }
            if (!s.fading) s.textIn = Math.min(1, s.textIn + FADE_TICK_MS / QUOTE_FADE_IN_MS);
            else s.out = Math.min(1, s.out + FADE_TICK_MS / Math.max(1, s.fadeMs));
            const a = s.textIn * (1 - s.out);
            try { if (s.overlay) mod.SetUIWidgetBgAlpha(s.overlay, 1 - s.out); } catch {}
            try { if (s.text) mod.SetUITextAlpha(s.text, a); } catch {}
            try { if (s.textAttrib) mod.SetUITextAlpha(s.textAttrib, a); } catch {}
            if (s.fading && s.out >= 1) clearBlackFade(pid); // done -> delete overlay + clear timers
        }, FADE_TICK_MS));
        // Guard: re-create the overlay at the current alphas so a transition wipe can't leave it missing.
        blackGuardTimers.set(pid, Timers.setInterval(() => {
            const s = blackStates.get(pid);
            if (s && !s.fading && mod.IsPlayerValid(player)) buildBlack(player, pid, s);
        }, BLACK_GUARD_MS));
    } catch {}
}

/** Begin fading the black + quote OUT over `ms` (call once the player is fully in-world). The animator
 *  handles the ramp-down and final cleanup. Stops the guard so the fade isn't interrupted. */
export function endBlackHold(player: mod.Player, ms: number): void {
    try {
        if (isBot(player)) return;
        const pid = mod.GetObjId(player);
        clearTimerMap(blackGuardTimers, pid);
        const s = blackStates.get(pid);
        if (s) { s.fadeMs = ms; s.fading = true; } else clearBlackFade(pid);
    } catch {}
}

/** Hard-clear a player's black overlay + quote (teardown / leave / fade-complete). */
export function clearBlackFade(playerId: number): void {
    clearTimerMap(blackAnimTimers, playerId);
    clearTimerMap(blackGuardTimers, playerId);
    const s = blackStates.get(playerId);
    if (s) { blackStates.delete(playerId); if (s.overlay) { try { GameUI.deleteWidget(s.overlay); } catch {} } }
}

// ---------------------------------------------------------------------------
// TOP PLAYERS (bottom-left) — build shell once, update rows in place.
// ---------------------------------------------------------------------------
function progressColor(gun: number, total: number): mod.Vector {
    const p = total > 0 ? (gun - 1) / total : 0;
    if (p < 0.33) return GameUI.rgb(1, 0.5, 0.2);
    if (p < 0.66) return GameUI.rgb(1, 1, 0.3);
    return GameUI.rgb(0.3, 1, 0.3);
}

function ensureBoardShell(viewerId: number, viewer: mod.Player): mod.UIWidget | null {
    const existing = lbBody.get(viewerId);
    if (existing) return existing;

    const body = GameUI.container('lbbody_' + viewerId, {
        pos: GameUI.vec(LB_LEFT, LB_BOTTOM),
        size: GameUI.vec(LB_W, LB_H),
        anchor: mod.UIAnchor.BottomLeft,
        bgColor: PANEL_BG,
        bgAlpha: 0.5,
        fill: mod.UIBgFill.Solid,
        receiver: viewer,
    });
    if (!body) return null;
    lbBody.set(viewerId, body);

    // Black header strip + title.
    GameUI.container('lbhdrbg_' + viewerId, {
        pos: GameUI.vec(0, 0),
        size: GameUI.vec(LB_W, LB_HEADER_H),
        anchor: mod.UIAnchor.TopCenter,
        parent: body,
        bgColor: BLACK,
        bgAlpha: 0.85,
        fill: mod.UIBgFill.Solid,
        receiver: viewer,
    });
    GameUI.text('lbhdr_' + viewerId, mod.Message(SK().ffa.board.title), {
        pos: GameUI.vec(0, 6),
        size: GameUI.vec(LB_W - 10, 18),
        anchor: mod.UIAnchor.TopCenter,
        parent: body,
        fontSize: 15,
        color: WHITE,
        receiver: viewer,
    });

    for (let i = 0; i < LB_ROWS; i++) {
        const y = LB_ROW_Y[i];
        const rankW = GameUI.text('lbrank_' + viewerId + '_' + i, blankMsg(), {
            pos: GameUI.vec(8, y),
            size: GameUI.vec(20, 18),
            anchor: mod.UIAnchor.CenterLeft,
            parent: body,
            fontSize: 14,
            color: WHITE,
            textAnchor: mod.UIAnchor.CenterLeft,
            receiver: viewer,
        });
        const nameW = GameUI.text('lbname_' + viewerId + '_' + i, blankMsg(), {
            pos: GameUI.vec(28, y),
            size: GameUI.vec(150, 18),
            anchor: mod.UIAnchor.CenterLeft,
            parent: body,
            fontSize: 14,
            color: WHITE,
            textAnchor: mod.UIAnchor.CenterLeft,
            receiver: viewer,
        });
        const scoreW = GameUI.text('lbscore_' + viewerId + '_' + i, blankMsg(), {
            pos: GameUI.vec(8, y),
            size: GameUI.vec(60, 18),
            anchor: mod.UIAnchor.CenterRight,
            parent: body,
            fontSize: 14,
            color: WHITE,
            textAnchor: mod.UIAnchor.CenterRight,
            receiver: viewer,
        });
        if (rankW) lbRank.set(viewerId + '_' + i, rankW);
        if (nameW) lbName.set(viewerId + '_' + i, nameW);
        if (scoreW) lbScore.set(viewerId + '_' + i, scoreW);
    }
    return body;
}

export function refreshMiniBoard(rows: BoardRow[]): void {
    const top = rows.slice(0, LB_ROWS);
    const count = top.length;
    for (const [viewerId, viewer] of humans) {
        try {
            if (!mod.IsPlayerValid(viewer)) {
                destroyHud(viewerId);
                continue;
            }
            if (!ensureBoardShell(viewerId, viewer)) continue;

            for (let i = 0; i < LB_ROWS; i++) {
                const rankW = lbRank.get(viewerId + '_' + i);
                const nameW = lbName.get(viewerId + '_' + i);
                const scoreW = lbScore.get(viewerId + '_' + i);
                if (i < count) {
                    const r = top[i];
                    const isLeader = i === 0;
                    const isViewer = mod.GetObjId(r.player) === viewerId;
                    const nameColor = isLeader ? GOLD : isViewer ? WHITE : WHITE;
                    if (rankW) {
                        mod.SetUITextLabel(rankW, numMsg(i + 1));
                        mod.SetUITextColor(rankW, isLeader ? GOLD : WHITE);
                    }
                    if (nameW) {
                        // playerDisplayMessage, NOT Message(player): dynamic name substitution
                        // is sanitized in custom UI text — bots rendered as "Hope \[BOT]".
                        mod.SetUITextLabel(nameW, playerDisplayMessage(r.player));
                        mod.SetUITextColor(nameW, nameColor);
                    }
                    if (scoreW) {
                        mod.SetUITextLabel(scoreW, slashMsg(r.gun, r.total));
                        mod.SetUITextColor(scoreW, isLeader ? GOLD : progressColor(r.gun, r.total));
                    }
                } else {
                    if (rankW) mod.SetUITextLabel(rankW, blankMsg());
                    if (nameW) mod.SetUITextLabel(nameW, blankMsg());
                    if (scoreW) mod.SetUITextLabel(scoreW, blankMsg());
                }
            }
        } catch {}
    }
}

// ---------------------------------------------------------------------------
// Cleanup.
// ---------------------------------------------------------------------------
export function destroyHud(playerId: number): void {
    // Delete ONLY the TWO top-level containers — each frees ALL of its children engine-side.
    // CRITICAL: never delete a child widget after its parent container is gone (double-free =
    // hard crash). The panel + bar/tab + cards + panel-texts are all children of barContainer;
    // the leaderboard rows are children of lbBody. So we delete just the containers and drop
    // the cached child refs (no per-child deleteWidget) — a rejoining id rebuilds a fresh shell.
    GameUI.deleteWidget(barContainer.get(playerId)); // frees obar/otab/cards/panel/panel-texts
    GameUI.deleteWidget(lbBody.get(playerId)); // separate top-level container (frees its rows)
    barContainer.delete(playerId);
    barFrame.delete(playerId);
    barFill.delete(playerId);
    barImg.delete(playerId);
    barImgKey.delete(playerId);
    barProt.delete(playerId); // green PROTECTED overlays were children of the cards (freed with them)
    clearNotifyTimers(playerId);
    notifyQueue.delete(playerId);
    notifyActive.delete(playerId);
    getAKillActive.delete(playerId);
    clearBlackFade(playerId); // remove any in-flight black respawn overlay
    panelWidgets.delete(playerId); // ref only — panel was a CHILD of barContainer (already freed)
    panelLabel.delete(playerId);
    panelName.delete(playerId);
    panelKills.delete(playerId);
    lbBody.delete(playerId);
    for (let i = 0; i < LB_ROWS; i++) {
        lbRank.delete(playerId + '_' + i);
        lbName.delete(playerId + '_' + i);
        lbScore.delete(playerId + '_' + i);
    }
    shellLogged.delete(playerId);
    humans.delete(playerId);
}

export function destroyAllHuds(): void {
    for (const id of [...humans.keys()]) destroyHud(id);
    for (const id of [...barContainer.keys()]) destroyHud(id);
    for (const id of [...lbBody.keys()]) destroyHud(id);
}
