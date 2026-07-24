// ============================================================================
// FFA GUNMASTER — GAME UI HELPER (ported verbatim from the Undead Gunmaster)
// ============================================================================
// The PROVEN UI path: raw mod.AddUIContainer / mod.AddUIText parented to
// mod.GetUIRoot(), retrieved by name via mod.FindUIWidgetWithName. This is what
// actually renders in-game (the bf6-portal-utils UIContainer/UIText components did
// not show up here). Messages are built by the CALLER with mod.Message(...); raw
// strings are fine (SDK: Message(msg: string | number | Player)).
// ============================================================================

function isAI(receiver: mod.Player | mod.Team): boolean {
    try {
        return mod.GetSoldierState(receiver as mod.Player, mod.SoldierStateBool.IsAISoldier);
    } catch {
        return false; // Team or non-player — not an AI to skip
    }
}

let _uiReady = false;
let _uiRoot: mod.UIWidget | null = null;
let _uiZero: mod.Vector | null = null;
let _uiFailLogged = false;

function ensureUIReady(): boolean {
    if (_uiReady) return true;
    try {
        _uiRoot = mod.GetUIRoot();
        _uiZero = mod.CreateVector(0, 0, 0);
        if (_uiRoot && _uiZero) {
            _uiReady = true;
            return true;
        }
    } catch {
        // UI not ready yet
    }
    if (!_uiFailLogged) {
        _uiFailLogged = true;
        try {
            console.log('[GameUI] GetUIRoot NOT READY — widget creation returning null');
        } catch {}
    }
    return false;
}

export const GameUI = {
    vec(x: number, y: number, z: number = 0): mod.Vector {
        return mod.CreateVector(x, y, z);
    },

    rgb(r: number, g: number, b: number): mod.Vector {
        return mod.CreateVector(r, g, b);
    },

    container(
        name: string,
        opts: {
            pos?: mod.Vector;
            size?: mod.Vector;
            anchor?: mod.UIAnchor;
            parent?: mod.UIWidget | null;
            visible?: boolean;
            padding?: number;
            bgColor?: mod.Vector;
            bgAlpha?: number;
            fill?: mod.UIBgFill;
            depth?: mod.UIDepth;
            receiver?: mod.Player | mod.Team;
        } = {}
    ): mod.UIWidget | null {
        try {
            if (!name || !ensureUIReady()) return null;
            if (!_uiRoot || !_uiZero) return null;

            const pos = opts.pos ?? _uiZero;
            const size = opts.size ?? mod.CreateVector(100, 100, 0);
            const anchor = opts.anchor ?? mod.UIAnchor.Center;
            const parent = opts.parent ?? _uiRoot;
            const visible = opts.visible ?? true;
            const padding = opts.padding ?? 0;
            const bgColor = opts.bgColor ?? _uiZero;
            const bgAlpha = opts.bgAlpha ?? 0;
            const fill = opts.fill ?? mod.UIBgFill.None;
            const depth = opts.depth ?? mod.UIDepth.AboveGameUI;
            const receiver = opts.receiver;

            if (!parent) return null;
            if (receiver && isAI(receiver)) return null;

            if (receiver) {
                mod.AddUIContainer(name, pos, size, anchor, parent, visible, padding, bgColor, bgAlpha, fill, depth, receiver);
            } else {
                mod.AddUIContainer(name, pos, size, anchor, parent, visible, padding, bgColor, bgAlpha, fill);
            }
            return mod.FindUIWidgetWithName(name);
        } catch {
            return null;
        }
    },

    text(
        name: string,
        msg: mod.Message,
        opts: {
            pos?: mod.Vector;
            size?: mod.Vector;
            anchor?: mod.UIAnchor;
            parent?: mod.UIWidget | null;
            visible?: boolean;
            padding?: number;
            bgColor?: mod.Vector;
            bgAlpha?: number;
            fill?: mod.UIBgFill;
            fontSize?: number;
            color?: mod.Vector;
            alpha?: number;
            textAnchor?: mod.UIAnchor;
            depth?: mod.UIDepth;
            receiver?: mod.Player | mod.Team;
        } = {}
    ): mod.UIWidget | null {
        try {
            if (!name || !msg || !ensureUIReady()) return null;
            if (!_uiRoot || !_uiZero) return null;

            const pos = opts.pos ?? _uiZero;
            const size = opts.size ?? mod.CreateVector(200, 40, 0);
            const anchor = opts.anchor ?? mod.UIAnchor.Center;
            const parent = opts.parent ?? _uiRoot;
            const visible = opts.visible ?? true;
            const padding = opts.padding ?? 0;
            const bgColor = opts.bgColor ?? _uiZero;
            const bgAlpha = opts.bgAlpha ?? 0;
            const fill = opts.fill ?? mod.UIBgFill.None;
            const fontSize = opts.fontSize ?? 24;
            const color = opts.color ?? mod.CreateVector(1, 1, 1);
            const alpha = opts.alpha ?? 1;
            const textAnchor = opts.textAnchor ?? mod.UIAnchor.Center;
            const depth = opts.depth ?? mod.UIDepth.AboveGameUI;
            const receiver = opts.receiver;

            if (!parent) return null;
            if (receiver && isAI(receiver)) return null;

            if (receiver) {
                mod.AddUIText(name, pos, size, anchor, parent, visible, padding, bgColor, bgAlpha, fill, msg, fontSize, color, alpha, textAnchor, depth, receiver);
            } else {
                mod.AddUIText(name, pos, size, anchor, parent, visible, padding, bgColor, bgAlpha, fill, msg, fontSize, color, alpha, textAnchor);
            }
            return mod.FindUIWidgetWithName(name);
        } catch {
            return null;
        }
    },

    /** Weapon card art. Passing the weaponPackage renders its ATTACHMENTS too
     *  (positioned by the game). Scoped by its parent's receiver. */
    weaponImage(
        name: string,
        weapon: mod.Weapons,
        pos: mod.Vector,
        size: mod.Vector,
        parent: mod.UIWidget | null,
        pkg?: mod.WeaponPackage | null
    ): mod.UIWidget | null {
        try {
            if (!name || !parent || !ensureUIReady()) return null;
            if (pkg) {
                mod.AddUIWeaponImage(name, pos, size, mod.UIAnchor.Center, weapon, parent, pkg);
            } else {
                mod.AddUIWeaponImage(name, pos, size, mod.UIAnchor.Center, weapon, parent);
            }
            return mod.FindUIWidgetWithName(name);
        } catch {
            return null;
        }
    },

    /** Gadget OUTLINE image (finale tiers). Scoped by its parent's receiver. */
    gadgetImage(name: string, gadget: mod.Gadgets, pos: mod.Vector, size: mod.Vector, parent: mod.UIWidget | null): mod.UIWidget | null {
        try {
            if (!name || !parent || !ensureUIReady()) return null;
            mod.AddUIGadgetImage(name, pos, size, mod.UIAnchor.Center, gadget, parent);
            return mod.FindUIWidgetWithName(name);
        } catch {
            return null;
        }
    },

    deleteWidget(widget: mod.UIWidget | null | undefined): void {
        if (!widget) return;
        try {
            mod.DeleteUIWidget(widget);
        } catch {
            // Widget may already be deleted
        }
    },
};
