// ============================================================================
// FFA GUNMASTER — VICTORY / DEFEAT LEADERBOARD SCREEN
// ============================================================================
// Custom end screen on the modern UI components (Deadlock style): a dim overlay
// + a shared leaderboard (rank · name · gun · K · D) + a per-player VICTORY
// (winner) / DEFEAT (everyone else) title, and the GlobalEOMVictory/Defeat VO.
// Shown during the pre-EndGameMode window; wiped when the mode ends.
// ============================================================================

import { UIContainer } from 'bf6-portal-utils/ui/components/container/index.ts';
import { UIText } from 'bf6-portal-utils/ui/components/text/index.ts';
import { Timers } from 'bf6-portal-utils/timers/index.ts';
import { DEBUG_MODE } from './config.ts';
import { playerDisplayMessage } from './roster.ts';

const GOLD = mod.CreateVector(1, 0.85, 0.15);
const RED = mod.CreateVector(1, 0.35, 0.35);
const WHITE = mod.CreateVector(1, 1, 1);
const GREY = mod.CreateVector(0.7, 0.72, 0.78);
const ZERO = mod.CreateVector(0, 0, 0);

const MAX_ROWS = 12; // how many leaderboard rows to show

// mod.Message(rawString) throws NoMatchingOverload on this SDK — the first arg
// must be a registered stringkey. Dynamic values go through the passthrough key.
const SK = (): mod.Any => mod.stringkeys;
const say = (v: mod.Any): mod.Message => mod.Message(SK().ffa.text, v);

export interface ResultRow {
    player: mod.Player;
    gun: number; // 1-based tier
    total: number; // ladder length
    kills: number;
    deaths: number;
}

const elements: UIContainer[] = [];

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Result] ${msg}`);
}

function playVO(event: mod.VoiceOverEvents2D, target: mod.Player): void {
    try {
        const vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, ZERO, ZERO) as mod.VO;
        mod.PlayVO(vo, event, mod.VoiceOverFlags.Alpha, target);
        Timers.setTimeout(() => {
            try {
                mod.UnspawnObject(vo as unknown as mod.Object);
            } catch {}
        }, 6000);
    } catch {}
}

/**
 * Show the end screen. `rows` should already be sorted best-first.
 * `winnerId` is the ObjId of the winning player.
 */
export function showResults(rows: ResultRow[], winnerId: number): void {
    clearResults();

    // Shared dim overlay (global — no receiver).
    const overlay = new UIContainer({
        anchor: mod.UIAnchor.Center,
        x: 0,
        y: 0,
        width: 4000,
        height: 4000,
        bgColor: mod.CreateVector(0, 0, 0),
        bgAlpha: 0.72,
        bgFill: mod.UIBgFill.Solid,
        visible: true,
        depth: mod.UIDepth.AboveGameUI,
    });
    elements.push(overlay);

    // Shared leaderboard panel. Center-anchored, so it grows UP as well as down —
    // compute the height once so the VICTORY/DEFEAT title can sit above its top edge.
    const panelH = 60 + Math.min(rows.length, MAX_ROWS) * 30;
    const panel = new UIContainer({
        anchor: mod.UIAnchor.Center,
        x: 0,
        y: 40,
        width: 560,
        height: panelH,
        bgColor: mod.CreateVector(0.05, 0.06, 0.09),
        bgAlpha: 0.85,
        bgFill: mod.UIBgFill.Solid,
        visible: true,
        depth: mod.UIDepth.AboveGameUI,
    });
    elements.push(panel);

    // Column header row.
    const header = (msg: mod.Message, x: number, w: number, anchor: mod.UIAnchor) =>
        new UIText({
            parent: panel,
            anchor: mod.UIAnchor.TopLeft,
            x,
            y: 10,
            width: w,
            height: 22,
            message: msg,
            textSize: 14,
            textColor: GREY,
            textAlpha: 1,
            textAnchor: anchor,
            visible: true,
        });
    header(mod.Message(SK().ffa.result.h_rank), 16, 30, mod.UIAnchor.CenterLeft);
    header(mod.Message(SK().ffa.result.h_player), 52, 260, mod.UIAnchor.CenterLeft);
    header(mod.Message(SK().ffa.result.h_gun), 330, 70, mod.UIAnchor.Center);
    header(mod.Message(SK().ffa.result.h_k), 430, 50, mod.UIAnchor.Center);
    header(mod.Message(SK().ffa.result.h_d), 494, 50, mod.UIAnchor.Center);

    // Rows.
    const shown = rows.slice(0, MAX_ROWS);
    for (let i = 0; i < shown.length; i++) {
        const r = shown[i];
        const y = 40 + i * 30;
        const isWinner = mod.GetObjId(r.player) === winnerId;
        const rowColor = isWinner ? GOLD : WHITE;
        const cell = (msg: mod.Message, x: number, w: number, anchor: mod.UIAnchor, size: number) =>
            new UIText({
                parent: panel,
                anchor: mod.UIAnchor.TopLeft,
                x,
                y,
                width: w,
                height: 26,
                message: msg,
                textSize: size,
                textColor: rowColor,
                textAlpha: 1,
                textAnchor: anchor,
                visible: true,
            });
        cell(say(i + 1), 16, 30, mod.UIAnchor.CenterLeft, 16);
        cell(playerDisplayMessage(r.player), 52, 260, mod.UIAnchor.CenterLeft, 16); // bots via registered key (no "\[BOT]")
        cell(mod.Message(SK().ffa.result.gun, r.gun, r.total), 330, 70, mod.UIAnchor.Center, 16);
        cell(say(r.kills), 430, 50, mod.UIAnchor.Center, 16);
        cell(say(r.deaths), 494, 50, mod.UIAnchor.Center, 16);
    }

    // Per-player VICTORY / DEFEAT title + VO. Positioned RELATIVE to the panel's top
    // edge (panel top = 40 - panelH/2), not a fixed y: with 12 rows the panel is 420px
    // tall and its top reached -170, which overlapped a hard-coded title at -180
    // (16+ player lobbies). 12px gap + half the 90px title height keeps it clear at
    // any row count.
    const titleY = 40 - panelH / 2 - 12 - 45;
    for (const r of rows) {
        const isWinner = mod.GetObjId(r.player) === winnerId;
        const title = new UIContainer({
            anchor: mod.UIAnchor.Center,
            x: 0,
            y: titleY,
            width: 700,
            height: 90,
            bgAlpha: 0,
            bgFill: mod.UIBgFill.None,
            visible: true,
            depth: mod.UIDepth.AboveGameUI,
            receiver: r.player,
        });
        new UIText({
            parent: title,
            anchor: mod.UIAnchor.Center,
            x: 0,
            y: 0,
            width: 700,
            height: 90,
            message: mod.Message(isWinner ? SK().ffa.result.victory : SK().ffa.result.defeat),
            textSize: 64,
            textColor: isWinner ? GOLD : RED,
            textAlpha: 1,
            textAnchor: mod.UIAnchor.Center,
            visible: true,
        });
        elements.push(title);
        try {
            playVO(isWinner ? mod.VoiceOverEvents2D.GlobalEOMVictory : mod.VoiceOverEvents2D.GlobalEOMDefeat, r.player);
        } catch {}
    }

    log(`shown to ${rows.length} players (winner ${winnerId})`);
}

export function clearResults(): void {
    for (const el of elements) {
        try {
            el.delete();
        } catch {}
    }
    elements.length = 0;
}
