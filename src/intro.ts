// ============================================================================
// FFA GUNMASTER — CINEMATIC MATCH-START INTRO
// ============================================================================
// One 8.5s game sound (SFX_UI_Notification_Primary_E_2D) choreographs the whole
// reveal. Beat map measured from the .ogg (loudness arc):
//   0.00s  play sound; everyone FROZEN, HUD hidden
//   1.25s  FIRST ACCENT -> frame (bar/tab/notification box) snaps in
//   2.45s  mid motif    -> 9 weapon cards cascade in (~55ms apart)
//   2.75s  mid motif    -> WEAPON GIVE (gun in hand) + leaderboard slides in
//   3.50s  valley       -> "GET READY"
//   5.0/5.55/6.05s cresc-> countdown 3 / 2 / 1
//   6.50s  CLIMAX(peak) -> "FIGHT!" + screen flash + UNFREEZE + bots drop in
//   7.30s  decay        -> intro UI destroyed
//
// STYLE follows the Deadlock countdown: big WHITE text with an 8-way BLACK stroke
// outline (±2px copies), a dark box behind the numbers + OutlineThin border, and
// three dashes on each side of a number.
// ============================================================================

import { Timers } from 'bf6-portal-utils/timers/index.ts';
import { GameUI } from './game-ui.ts';
import { READY_COUNTDOWN_S } from './config.ts';
import { introHide, introRevealFrame, introRevealCard, introRevealBoard, introRevealAll } from './hud.ts';
import { aiCombatFlags } from './bot-ai/ai-flags.ts';

const SK = (): mod.Any => mod.stringkeys;
const RS = mod.RuntimeSpawn_Common;
const INTRO_SFX = RS.SFX_UI_Notification_Primary_E_2D;
const FIGHT_SFX = RS.SFX_UI_Notification_Primary_G_2D; // Battlefield-theme kick-off, played on "FIGHT!"
const TOTAL_SLOTS = 9;

// Deadlock palette + sizing.
const WHITE = GameUI.rgb(1, 1, 1);
const BLACK = GameUI.rgb(0, 0, 0);
const DARK_BG = GameUI.rgb(0.2, 0.2, 0.2);
const GRAY_OUTLINE = GameUI.rgb(0.75, 0.75, 0.75);
const OUTLINE_OFFSETS = [
    { x: -2, y: -2 }, { x: 2, y: -2 }, { x: -2, y: 2 }, { x: 2, y: 2 },
    { x: 0, y: -2 }, { x: 0, y: 2 }, { x: -2, y: 0 }, { x: 2, y: 0 },
];
const POS_Y = -180;
const NUMBER_SIZE = 90;
const WORD_SIZE = 54;
const BOX_SIZE = 130;
const DASH_GAP = 8;

// The intro runs for READY_COUNTDOWN_S seconds total (time to load in). A plain Deadlock-style
// number counts down the WHOLE time; the sound + HUD-build only come in for the last ~8.5s, timed
// so the sound's CLIMAX lands exactly on FIGHT at the end. Beat offsets below are ms from the
// SOUND'S start (not the intro's start).
const SOUND_CLIMAX_MS = 6500; // the "FIGHT" peak within the 8.5s sound
const T_FRAME = 1250, T_CARDS = 2450, T_CARD_STEP = 55, T_WEAPON = 2750;
const RE_FREEZE_MS = 500; // re-assert the freeze this often — a deploy can reset input restrictions
const CLEANUP_MS = 900; // hold "FIGHT!" this long after unfreeze, then destroy the intro UI

const BLOCKED_INPUTS = [
    mod.RestrictedInputs.CycleFire, mod.RestrictedInputs.FireWeapon, mod.RestrictedInputs.Interact,
    mod.RestrictedInputs.Jump, mod.RestrictedInputs.MoveForwardBack, mod.RestrictedInputs.MoveLeftRight,
    mod.RestrictedInputs.Reload, mod.RestrictedInputs.SelectCharacterGadget, mod.RestrictedInputs.SelectMelee,
    mod.RestrictedInputs.SelectOpenGadget, mod.RestrictedInputs.SelectThrowable, mod.RestrictedInputs.Sprint,
];

function isAI(p: mod.Player): boolean {
    try { return mod.GetSoldierState(p, mod.SoldierStateBool.IsAISoldier); } catch { return false; }
}

// Freeze cache: the RE_FREEZE interval re-ran the FULL freeze (12 EnableInputRestriction
// natives per human) every tick of the interval — measured ~670 calls per intro. A deploy
// really does reset input restrictions (that's why the interval exists), so keep the
// robustness but only re-assert per player every FREEZE_REASSERT_MS; `force` (used on
// deploy/onboard, where the reset actually happens) always goes through.
const FREEZE_REASSERT_MS = 3000;
const frozenAt: Map<number, number> = new Map(); // playerId -> last full assert
export function freezePlayer(player: mod.Player, force: boolean = false): void {
    try {
        const pid = mod.GetObjId(player);
        const now = Date.now();
        const last = frozenAt.get(pid);
        if (!force && last !== undefined && now - last < FREEZE_REASSERT_MS) return;
        frozenAt.set(pid, now);
        if (isAI(player)) {
            // Bots: stand still + no shoot/target (Deadlock's AI freeze).
            mod.AISetStance(player, mod.Stance.Stand);
            mod.AIIdleBehavior(player);
            aiCombatFlags(player, false, false, true);
        } else {
            for (const i of BLOCKED_INPUTS) mod.EnableInputRestriction(player, i, true);
        }
    } catch {}
}
export function unfreezePlayer(player: mod.Player): void {
    try {
        frozenAt.delete(mod.GetObjId(player));
        if (isAI(player)) {
            aiCombatFlags(player, true, true, true);
        } else {
            for (const i of BLOCKED_INPUTS) mod.EnableInputRestriction(player, i, false);
        }
    } catch {}
}

/** Every valid player (humans + any bots) — the freeze/re-freeze target set. */
function allPlayers(): mod.Player[] {
    const out: mod.Player[] = [];
    try {
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        for (let i = 0; i < n; i++) {
            const p = mod.ValueInArray(arr, i) as mod.Player;
            try { if (mod.IsPlayerValid(p)) out.push(p); } catch {}
        }
    } catch {}
    return out;
}

let running = false;
export function introRunning(): boolean { return running; }

// --- per-human intro widgets (Deadlock-style stroked text + box + dashes) ---
interface IntroUI {
    root: mod.UIWidget | null;
    boxBg: mod.UIWidget | null;
    boxOutline: mod.UIWidget | null;
    outlines: (mod.UIWidget | null)[]; // 8 black stroke copies
    main: mod.UIWidget | null;          // white main text
    dashes: (mod.UIWidget | null)[];    // 3 left + 3 right
}
const ui = new Map<number, IntroUI>();

function buildUI(player: mod.Player): void {
    if (isAI(player)) return;
    const pid = mod.GetObjId(player);
    if (ui.has(pid)) return;
    const root = GameUI.container('intro_' + pid, {
        pos: GameUI.vec(0, POS_Y), size: GameUI.vec(600, 260), anchor: mod.UIAnchor.Center,
        bgColor: BLACK, bgAlpha: 0, fill: mod.UIBgFill.None, receiver: player,
    });
    const boxBg = GameUI.container('introBg_' + pid, {
        pos: GameUI.vec(0, 0), size: GameUI.vec(BOX_SIZE, BOX_SIZE), anchor: mod.UIAnchor.Center, parent: root,
        bgColor: DARK_BG, bgAlpha: 0.12, fill: mod.UIBgFill.Solid, receiver: player,
    });
    const boxOutline = GameUI.container('introBox_' + pid, {
        pos: GameUI.vec(0, 0), size: GameUI.vec(BOX_SIZE, BOX_SIZE), anchor: mod.UIAnchor.Center, parent: root,
        bgColor: GRAY_OUTLINE, bgAlpha: 1, fill: mod.UIBgFill.OutlineThick, receiver: player,
    });
    if (boxBg) mod.SetUIWidgetVisible(boxBg, false);
    if (boxOutline) mod.SetUIWidgetVisible(boxOutline, false);
    // 8 black stroke copies, then the white main text ON TOP.
    const outlines: (mod.UIWidget | null)[] = [];
    for (let i = 0; i < OUTLINE_OFFSETS.length; i++) {
        const o = OUTLINE_OFFSETS[i];
        const t = GameUI.text('introO' + i + '_' + pid, mod.Message(SK().ffa.num.n, 0), {
            pos: GameUI.vec(o.x, o.y), size: GameUI.vec(600, 200), anchor: mod.UIAnchor.Center, parent: root,
            fontSize: NUMBER_SIZE, color: BLACK, receiver: player,
        });
        if (t) mod.SetUIWidgetVisible(t, false);
        outlines.push(t);
    }
    const main = GameUI.text('introM_' + pid, mod.Message(SK().ffa.num.n, 0), {
        pos: GameUI.vec(0, 0), size: GameUI.vec(600, 200), anchor: mod.UIAnchor.Center, parent: root,
        fontSize: NUMBER_SIZE, color: WHITE, receiver: player,
    });
    if (main) mod.SetUIWidgetVisible(main, false);
    // 3 dashes each side (Deadlock look), hidden until a number shows.
    const dashes: (mod.UIWidget | null)[] = [];
    for (let side = 0; side < 2; side++) {
        for (let i = 0; i < 3; i++) {
            const xOff = (BOX_SIZE / 2 + DASH_GAP + i * 12 + 6) * (side === 0 ? -1 : 1);
            const d = GameUI.text('introD' + side + i + '_' + pid, mod.Message(SK().ffa.hud.blank), {
                pos: GameUI.vec(xOff, 0), size: GameUI.vec(20, 30), anchor: mod.UIAnchor.Center, parent: root,
                fontSize: 24, color: WHITE, receiver: player,
            });
            if (d) mod.SetUIWidgetVisible(d, false);
            dashes.push(d);
        }
    }
    ui.set(pid, { root, boxBg, boxOutline, outlines, main, dashes });
}

// --- animation (Deadlock-style: grow box, slam-in number, cascade dashes; black/white) ---
const ANIM_TICK = 33;
const BOX_MIN = 20, BOX_MAX = 130, BOX_GROW_MS = 200, NUM_POP_MS = 240, DASH_STEP_MS = 70, WORD_POP_MS = 420;
const COUNTDOWN_FROM = 6; // the numbers count this -> 1 (all single-digit so they all get box+dashes)
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

function tween(durMs: number, onTick: (t: number) => void): void {
    let elapsed = 0;
    const id = Timers.setInterval(() => {
        elapsed += ANIM_TICK;
        const t = Math.min(elapsed / durMs, 1);
        try { onTick(t); } catch {}
        if (t >= 1) { try { Timers.clearInterval(id); } catch {} }
    }, ANIM_TICK);
}

// Same label on the WHITE main text + all 8 BLACK stroke copies (black/white theme).
function setLabel(u: IntroUI, msg: mod.Message): void {
    if (u.main) { mod.SetUITextLabel(u.main, msg); mod.SetUITextColor(u.main, WHITE); }
    for (const o of u.outlines) if (o) mod.SetUITextLabel(o, msg);
}
function setGroupSize(u: IntroUI, size: number): void {
    if (u.main) { try { mod.SetUITextSize(u.main, size); } catch {} }
    for (const o of u.outlines) if (o) { try { mod.SetUITextSize(o, size); } catch {} }
}
function setGroupAlpha(u: IntroUI, a: number): void {
    if (u.main) { try { mod.SetUITextAlpha(u.main, a); } catch {} }
    for (const o of u.outlines) if (o) { try { mod.SetUITextAlpha(o, a); } catch {} }
}
function showGroup(u: IntroUI, vis: boolean): void {
    if (u.main) mod.SetUIWidgetVisible(u.main, vis);
    for (const o of u.outlines) if (o) mod.SetUIWidgetVisible(o, vis);
}

/** COUNTDOWN NUMBER: box grows min->max (ease-out cubic), number slams in (1.4x -> 1.0x) while
 *  fading in, dashes cascade inside-out — the Deadlock look. */
function animateNumber(pid: number, n: number): void {
    const u = ui.get(pid);
    if (!u) return;
    setLabel(u, mod.Message(SK().ffa.num.n, n));
    showGroup(u, true);
    setGroupAlpha(u, 0);
    if (u.boxBg) { mod.SetUIWidgetSize(u.boxBg, GameUI.vec(BOX_MIN, BOX_MIN)); mod.SetUIWidgetBgAlpha(u.boxBg, 0.12); mod.SetUIWidgetVisible(u.boxBg, true); }
    if (u.boxOutline) { mod.SetUIWidgetSize(u.boxOutline, GameUI.vec(BOX_MIN, BOX_MIN)); mod.SetUIWidgetBgAlpha(u.boxOutline, 1); mod.SetUIWidgetVisible(u.boxOutline, true); }
    for (const d of u.dashes) if (d) { mod.SetUITextLabel(d, mod.Message(SK().ffa.intro.dash)); try { mod.SetUITextAlpha(d, 1); } catch {} mod.SetUIWidgetVisible(d, false); }
    tween(BOX_GROW_MS, (t) => {
        const s = BOX_MIN + (BOX_MAX - BOX_MIN) * easeOutCubic(t);
        if (u.boxBg) mod.SetUIWidgetSize(u.boxBg, GameUI.vec(s, s));
        if (u.boxOutline) mod.SetUIWidgetSize(u.boxOutline, GameUI.vec(s, s));
    });
    tween(NUM_POP_MS, (t) => {
        setGroupAlpha(u, Math.min(t * 1.8, 1));
        setGroupSize(u, NUMBER_SIZE * (1.4 - 0.4 * easeOutCubic(t)));
    });
    for (let i = 0; i < 3; i++) {
        const li = u.dashes[i], ri = u.dashes[3 + i];
        Timers.setTimeout(() => { if (li) mod.SetUIWidgetVisible(li, true); if (ri) mod.SetUIWidgetVisible(ri, true); }, BOX_GROW_MS + i * DASH_STEP_MS);
    }
}

/** GET READY / FIGHT word: black/white, grow->shrink slam pop (no box/dashes). */
function animateWord(pid: number, msg: mod.Message, baseSize: number, overshoot: number): void {
    const u = ui.get(pid);
    if (!u) return;
    if (u.boxBg) mod.SetUIWidgetVisible(u.boxBg, false);
    if (u.boxOutline) mod.SetUIWidgetVisible(u.boxOutline, false);
    for (const d of u.dashes) if (d) mod.SetUIWidgetVisible(d, false);
    setLabel(u, msg);
    showGroup(u, true);
    setGroupAlpha(u, 1);
    tween(WORD_POP_MS, (t) => {
        const scale = t < 0.55
            ? 0.5 + (overshoot - 0.5) * easeOutCubic(t / 0.55)
            : overshoot - (overshoot - 1) * ((t - 0.55) / 0.45);
        setGroupSize(u, baseSize * scale);
    });
}

// Gentle breathing (grow/shrink) for GET READY while it holds; cleared when the numbers start.
let breatheTimer: number | null = null;
let breathePhase = 0;
function startBreathe(baseSize: number): void {
    stopBreathe();
    breathePhase = 0;
    breatheTimer = Timers.setInterval(() => {
        breathePhase += 0.18;
        const scale = 1 + 0.06 * Math.sin(breathePhase);
        for (const [, u] of ui) setGroupSize(u, baseSize * scale);
    }, 60);
}
function stopBreathe(): void {
    if (breatheTimer !== null) { try { Timers.clearInterval(breatheTimer); } catch {} breatheTimer = null; }
}

function destroyUI(pid: number): void {
    GameUI.deleteWidget(ui.get(pid)?.root); // frees all children
    ui.delete(pid);
}

function playIntroSound(): void {
    try {
        const obj = mod.SpawnObject(INTRO_SFX, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
        mod.PlaySound(obj, 0.7); // this ONE cue plays at 0.7 (raw, bypasses the 0.4 SFX master); no target = whole lobby
    } catch {}
}

function playFightSound(): void {
    try {
        const obj = mod.SpawnObject(FIGHT_SFX, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
        mod.PlaySound(obj, 0.8); // Battlefield-theme kick-off on FIGHT (raw, loud); no target = whole lobby
    } catch {}
}

export interface IntroHooks {
    humans(): mod.Player[];
    giveWeapon(player: mod.Player): void; // equip the starting gun (the weapon give)
    onFight(): void; // unfreeze done here; go live (start bots)
}
let hooks: IntroHooks | null = null;
function hf(): mod.Player[] { return hooks?.humans() ?? []; }

/** Freeze + hide-HUD + build the intro UI for a player (initial or a late joiner mid-intro). */
export function onboardForIntro(player: mod.Player): void {
    try {
        if (isAI(player)) return;
        freezePlayer(player, true); // FORCE: a deploy just reset their input restrictions
        introHide(player);
        buildUI(player);
    } catch {}
}

let reFreezeTimer: number | null = null;

export function startIntro(h: IntroHooks): void {
    running = true;
    hooks = h;
    const totalMs = READY_COUNTDOWN_S * 1000;
    const soundStart = Math.max(0, totalMs - SOUND_CLIMAX_MS); // sound so its climax lands on FIGHT

    const countdownStartMs = Math.max(0, (READY_COUNTDOWN_S - COUNTDOWN_FROM) * 1000); // when numbers begin

    for (const p of h.humans()) onboardForIntro(p);
    // ROBUST FREEZE: re-assert on EVERYONE (humans + any bots) every RE_FREEZE_MS for the whole
    // intro — a deploy can reset input restrictions, so a one-shot freeze doesn't hold.
    for (const p of allPlayers()) freezePlayer(p);
    reFreezeTimer = Timers.setInterval(() => { for (const p of allPlayers()) freezePlayer(p); }, RE_FREEZE_MS);

    // "GET READY" (black/white) pops in, then breathes (grow/shrink) through the load-in phase.
    for (const p of hf()) animateWord(mod.GetObjId(p), mod.Message(SK().ffa.intro.get_ready), WORD_SIZE, 1.18);
    Timers.setTimeout(() => startBreathe(WORD_SIZE), WORD_POP_MS + 60);

    // Deadlock-style animated countdown (box grow + slam-in number + dash cascade), COUNTDOWN_FROM..1.
    for (let s = COUNTDOWN_FROM; s >= 1; s--) {
        const at = countdownStartMs + (COUNTDOWN_FROM - s) * 1000;
        Timers.setTimeout(() => {
            if (s === COUNTDOWN_FROM) stopBreathe();
            for (const p of hf()) animateNumber(mod.GetObjId(p), s);
        }, at);
    }

    // Sound + HUD build, timed to the last ~8.5s so the reveal syncs to the audio.
    Timers.setTimeout(playIntroSound, soundStart);
    Timers.setTimeout(() => { for (const p of hf()) introRevealFrame(p); }, soundStart + T_FRAME);
    for (let i = 0; i < TOTAL_SLOTS; i++) {
        Timers.setTimeout(() => { for (const p of hf()) introRevealCard(p, i); }, soundStart + T_CARDS + i * T_CARD_STEP);
    }
    Timers.setTimeout(() => { for (const p of hf()) { hooks?.giveWeapon(p); introRevealBoard(p); } }, soundStart + T_WEAPON);

    // FIGHT — big black/white grow->shrink pop on the sound's climax. NO screen flash.
    Timers.setTimeout(() => {
        stopBreathe();
        playFightSound(); // Battlefield-theme kick-off as "FIGHT!" hits
        if (reFreezeTimer !== null) { try { Timers.clearInterval(reFreezeTimer); } catch {} reFreezeTimer = null; }
        for (const p of allPlayers()) unfreezePlayer(p); // unfreeze humans AND any bots
        frozenAt.clear(); // stragglers (invalid/departed) — nothing stays marked frozen
        for (const p of hf()) {
            animateWord(mod.GetObjId(p), mod.Message(SK().ffa.intro.fight), WORD_SIZE + 20, 1.35);
            introRevealAll(p); // safety: late joiners get a full HUD too
        }
        hooks?.onFight();
    }, totalMs);
    Timers.setTimeout(() => {
        running = false;
        stopBreathe();
        for (const [pid] of [...ui]) destroyUI(pid);
        hooks = null;
    }, totalMs + CLEANUP_MS);
}
