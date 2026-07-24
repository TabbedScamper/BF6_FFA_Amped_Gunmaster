// ============================================================================
// FFA GUNMASTER — MATCH-START MAP CREDIT CARD
// ============================================================================
// A few seconds AFTER "FIGHT!" (config MAP_CARD_DELAY_MS — so the FIGHT sting
// clears first) a Deadlock-style title card reveals the map + its creators,
// choreographed to one 5.48s game sound (SFX_UI_Gauntlet_EOM_Qualified_OneShot2D,
// measured from 086_..._Qualified_OneShot2D.ogg = 5.477s @ 48k):
//   0.00s  play sound + slam-in  "MAP:   INFERNO"          (white text, 8-way black stroke)
//   ~1.80s second accent -> rise-in  "MADE BY:   ..."  UNDER it        [TUNE IN-GAME]
//   ~4.60s begin fade of both lines as the sting decays                [TUNE IN-GAME]
//   ~5.48s destroy the card (end of sound)
// Same stroked black/white look as the intro (intro.ts). Per-human UI; bots skip.
// The map + creators come from map-registry.ts (physical spawn-marker centroid).
// ============================================================================

import { Timers } from 'bf6-portal-utils/timers/index.ts';
import { GameUI } from './game-ui.ts';
import { detectMapCredit, MapCredit } from './map-registry.ts';

const SK = (): mod.Any => mod.stringkeys;
const RS = mod.RuntimeSpawn_Common;
const CARD_SFX = RS.SFX_UI_Gauntlet_EOM_Qualified_OneShot2D;

// ── beat map, measured from 086_SFX_UI_Gauntlet_EOM_Qualified_OneShot2D.ogg (5.477s @48k):
const SOUND_LEN_MS = 5477;
const BEAT2_MS = 1800;                        // TUNE IN-GAME: "MADE BY" rises on the second accent
const FADE_START_MS = 4600;                   // TUNE IN-GAME: begin fade as the sting decays
const FADE_MS = SOUND_LEN_MS - FADE_START_MS; // fade completes right at end-of-sound
const CARD_SFX_AMP = 0.7;                     // raw (bypasses the SFX master, like the intro cues) — TUNE

// palette + layout (matches intro.ts's Deadlock look)
const WHITE = GameUI.rgb(1, 1, 1);
const BLACK = GameUI.rgb(0, 0, 0);
const OUTLINE_OFFSETS = [
    { x: -2, y: -2 }, { x: 2, y: -2 }, { x: -2, y: 2 }, { x: 2, y: 2 },
    { x: 0, y: -2 }, { x: 0, y: 2 }, { x: -2, y: 0 }, { x: 2, y: 0 },
];
const POS_Y = -150;      // the card block's vertical position (intro sits at -180)
const LINE1_SIZE = 62;   // "MAP: <name>"
const LINE2_SIZE = 40;   // "MADE BY: ..."
const LINE1_Y = -34;     // relative to the block centre
const LINE2_Y = 40;

const ANIM_TICK = 33;
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

function isAI(p: mod.Player): boolean {
    try { return mod.GetSoldierState(p, mod.SoldierStateBool.IsAISoldier); } catch { return false; }
}

function tween(durMs: number, onTick: (t: number) => void): void {
    let elapsed = 0;
    const id = Timers.setInterval(() => {
        elapsed += ANIM_TICK;
        const t = Math.min(elapsed / durMs, 1);
        try { onTick(t); } catch {}
        if (t >= 1) { try { Timers.clearInterval(id); } catch {} }
    }, ANIM_TICK);
}

// One stroked text line = 8 black outline copies + 1 white main, centred at (0, y) in `root`.
interface Line { outlines: (mod.UIWidget | null)[]; main: mod.UIWidget | null; }
interface CardUI { root: mod.UIWidget | null; l1: Line; l2: Line; }
const ui = new Map<number, CardUI>();

function buildLine(pid: number, tag: string, msg: mod.Message, y: number, size: number, root: mod.UIWidget | null, player: mod.Player): Line {
    const outlines: (mod.UIWidget | null)[] = [];
    for (let i = 0; i < OUTLINE_OFFSETS.length; i++) {
        const o = OUTLINE_OFFSETS[i];
        const t = GameUI.text('mc' + tag + 'O' + i + '_' + pid, msg, {
            pos: GameUI.vec(o.x, y + o.y), size: GameUI.vec(760, 96), anchor: mod.UIAnchor.Center, parent: root,
            fontSize: size, color: BLACK, receiver: player,
        });
        if (t) mod.SetUIWidgetVisible(t, false);
        outlines.push(t);
    }
    const main = GameUI.text('mc' + tag + 'M_' + pid, msg, {
        pos: GameUI.vec(0, y), size: GameUI.vec(760, 96), anchor: mod.UIAnchor.Center, parent: root,
        fontSize: size, color: WHITE, receiver: player,
    });
    if (main) mod.SetUIWidgetVisible(main, false);
    return { outlines, main };
}

function lineShow(l: Line, vis: boolean): void {
    if (l.main) mod.SetUIWidgetVisible(l.main, vis);
    for (const o of l.outlines) if (o) mod.SetUIWidgetVisible(o, vis);
}
function lineAlpha(l: Line, a: number): void {
    if (l.main) { try { mod.SetUITextAlpha(l.main, a); } catch {} }
    for (const o of l.outlines) if (o) { try { mod.SetUITextAlpha(o, a); } catch {} }
}
function lineSize(l: Line, size: number): void {
    if (l.main) { try { mod.SetUITextSize(l.main, size); } catch {} }
    for (const o of l.outlines) if (o) { try { mod.SetUITextSize(o, size); } catch {} }
}

function buildUI(player: mod.Player, credit: MapCredit): void {
    if (isAI(player)) return;
    const pid = mod.GetObjId(player);
    if (ui.has(pid)) return;
    const root = GameUI.container('mapcard_' + pid, {
        pos: GameUI.vec(0, POS_Y), size: GameUI.vec(800, 200), anchor: mod.UIAnchor.Center,
        bgColor: BLACK, bgAlpha: 0, fill: mod.UIBgFill.None, receiver: player,
    });
    const l1 = buildLine(pid, '1', credit.line1, LINE1_Y, LINE1_SIZE, root, player);
    const l2 = buildLine(pid, '2', credit.line2, LINE2_Y, LINE2_SIZE, root, player);
    ui.set(pid, { root, l1, l2 });
}

function destroyUI(pid: number): void {
    GameUI.deleteWidget(ui.get(pid)?.root); // frees children
    ui.delete(pid);
}

// Grow->shrink slam pop (Deadlock word style): scale overshoots then settles to 1, alpha fades in.
function popLine(l: Line, baseSize: number, overshoot: number, durMs: number): void {
    lineShow(l, true);
    lineAlpha(l, 0);
    tween(durMs, (t) => {
        lineAlpha(l, Math.min(t * 1.8, 1));
        const scale = t < 0.55
            ? 0.6 + (overshoot - 0.6) * easeOutCubic(t / 0.55)
            : overshoot - (overshoot - 1) * ((t - 0.55) / 0.45);
        lineSize(l, baseSize * scale);
    });
}

function playCardSound(): void {
    try {
        const obj = mod.SpawnObject(CARD_SFX, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
        mod.PlaySound(obj, CARD_SFX_AMP); // no target => whole lobby
    } catch {}
}

/** Show the map-credit card to the given humans (does nothing if the map isn't registered). */
export function showMapCard(humans: mod.Player[]): void {
    const credit = detectMapCredit();
    if (!credit) return; // unknown map — logged in map-registry; no card
    for (const p of humans) { try { if (mod.IsPlayerValid(p) && !isAI(p)) buildUI(p, credit); } catch {} }
    if (ui.size === 0) return;

    playCardSound();
    // beat 1 (0s): "MAP: <name>" slams in.
    for (const [, u] of ui) popLine(u.l1, LINE1_SIZE, 1.25, 380);
    // beat 2 (~1.8s): "MADE BY: ..." rises in under it.
    Timers.setTimeout(() => { for (const [, u] of ui) popLine(u.l2, LINE2_SIZE, 1.15, 340); }, BEAT2_MS);
    // fade both out as the sting decays, completing at end-of-sound.
    Timers.setTimeout(() => {
        tween(FADE_MS, (t) => { const a = 1 - t; for (const [, u] of ui) { lineAlpha(u.l1, a); lineAlpha(u.l2, a); } });
    }, FADE_START_MS);
    // cleanup just after the sound ends.
    Timers.setTimeout(() => { for (const [pid] of [...ui]) destroyUI(pid); }, SOUND_LEN_MS + 150);
}

/** Fire the card `delayMs` after FIGHT so the FIGHT sting doesn't clash with the credit sound. */
export function scheduleMapCard(humans: () => mod.Player[], delayMs: number): void {
    Timers.setTimeout(() => { try { showMapCard(humans()); } catch {} }, delayMs);
}
