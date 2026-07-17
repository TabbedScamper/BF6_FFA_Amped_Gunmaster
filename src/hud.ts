// ============================================================================
// FFA GUNMASTER — HUD (per-player gun/tier display + notifications)
// ============================================================================
// mod.Message accepts raw strings/numbers, so we show live text directly
// (gun name + "GUN X / N") with no per-card string keys. Each human gets a
// receiver-scoped HUD: a persistent bottom bar (current gun + ladder progress)
// and an ephemeral center banner that flashes promotions/demotions.
// ============================================================================

import { Timers } from 'bf6-portal-utils/timers/index.ts';
import { UIContainer } from 'bf6-portal-utils/ui/components/container/index.ts';
import { UIText } from 'bf6-portal-utils/ui/components/text/index.ts';
import { DEBUG_MODE } from './config.ts';
import { currentTier, ladderLength, progressOf } from './ladder.ts';

const COLOR = {
    WHITE: mod.CreateVector(1, 1, 1),
    GREEN: mod.CreateVector(0.3, 1, 0.4),
    RED: mod.CreateVector(1, 0.35, 0.35),
    GOLD: mod.CreateVector(1, 0.85, 0.2),
};

interface PlayerHud {
    container: UIContainer;
    gunLine: UIText;
    banner: UIText;
    bannerTimer: number | null;
}

const huds: Map<number, PlayerHud> = new Map();

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[HUD] ${msg}`);
}

function buildHud(player: mod.Player): PlayerHud {
    const container = new UIContainer({
        anchor: mod.UIAnchor.BottomCenter,
        y: -60,
        width: 600,
        height: 90,
        bgAlpha: 0,
        bgFill: mod.UIBgFill.None,
        visible: true,
        depth: mod.UIDepth.AboveGameUI,
        receiver: player,
    });
    const gunLine = new UIText({
        parent: container,
        anchor: mod.UIAnchor.BottomCenter,
        x: 0,
        y: 0,
        width: 600,
        height: 30,
        message: mod.Message(' '),
        textSize: 22,
        textColor: COLOR.WHITE,
        textAlpha: 1,
        textAnchor: mod.UIAnchor.Center,
        visible: true,
    });
    const banner = new UIText({
        parent: container,
        anchor: mod.UIAnchor.BottomCenter,
        x: 0,
        y: -36,
        width: 600,
        height: 40,
        message: mod.Message(' '),
        textSize: 30,
        textColor: COLOR.GOLD,
        textAlpha: 0,
        textAnchor: mod.UIAnchor.Center,
        visible: true,
    });
    return { container, gunLine, banner, bannerTimer: null };
}

export function ensureHud(player: mod.Player): void {
    try {
        if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return; // humans only
        const id = mod.GetObjId(player);
        if (huds.has(id)) return;
        huds.set(id, buildHud(player));
        log(`created HUD for ${id}`);
    } catch {}
}

/** Refresh the persistent gun/tier line from live ladder state. */
export function updateHud(player: mod.Player): void {
    try {
        if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return;
        const id = mod.GetObjId(player);
        const hud = huds.get(id);
        if (!hud) return;
        const tier = currentTier(player);
        const idx = (progressOf(player)?.ladderIndex ?? 0) + 1;
        const total = ladderLength();
        const name = tier?.cardName ?? '';
        const label = idx >= total ? `FINAL GUN  ·  ${name}` : `GUN ${idx} / ${total}  ·  ${name}`;
        hud.gunLine.setMessage(mod.Message(label));
        hud.gunLine.setTextColor(idx >= total ? COLOR.GOLD : COLOR.WHITE);
    } catch {}
}

type FlashColor = 'green' | 'red' | 'gold' | 'white';
function colorOf(c: FlashColor): mod.Vector {
    return c === 'green' ? COLOR.GREEN : c === 'red' ? COLOR.RED : c === 'gold' ? COLOR.GOLD : COLOR.WHITE;
}

/** Flash a center banner for a beat (promotions, demotions, warnings). */
export function flash(player: mod.Player, text: string, color: FlashColor = 'gold', ms: number = 1800): void {
    try {
        if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return;
        const id = mod.GetObjId(player);
        const hud = huds.get(id);
        if (!hud) return;
        hud.banner.setMessage(mod.Message(text));
        hud.banner.setTextColor(colorOf(color));
        hud.banner.setTextAlpha(1);
        if (hud.bannerTimer !== null) {
            try {
                Timers.clearTimeout(hud.bannerTimer);
            } catch {}
        }
        hud.bannerTimer = Timers.setTimeout(() => {
            try {
                hud.banner.setTextAlpha(0);
            } catch {}
            hud.bannerTimer = null;
        }, ms);
    } catch {}
}

export function destroyHud(playerId: number): void {
    const hud = huds.get(playerId);
    if (!hud) return;
    if (hud.bannerTimer !== null) {
        try {
            Timers.clearTimeout(hud.bannerTimer);
        } catch {}
    }
    try {
        hud.container.delete();
    } catch {}
    huds.delete(playerId);
}

export function destroyAllHuds(): void {
    for (const id of [...huds.keys()]) destroyHud(id);
}
