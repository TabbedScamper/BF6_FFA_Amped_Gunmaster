// ============================================================================
// FFA GUNMASTER SIM — compat shim over modsim
// ============================================================================
// Builds the global `mod` object the bundle expects from the compiled modsim,
// patching the gaps found in the API audit (2026-07-19):
//   - modsim's AddUIText/Container/Button/Image push to parent.children but
//     RETURN NOTHING -> wrap to return the created widget (our GameUI needs it).
//   - 32 runtime functions missing (AIEnable*, IsInventorySlotActive, DealDamage,
//     DirectionTowards, SetRedeployTime, DeployAllPlayers, ...) -> real impls
//     where behavior matters, logged no-ops otherwise (auto-stub).
//   - 4 enum bags missing (AiInput, SpotStatus, SoldierEffects, SpectatingGroup)
//     and modsim's Weapons/Attachments enums are partial -> proxy enums that
//     fall back to unique "<Enum>.<Member>" strings (=== safe, Map-key safe).
//   - GetSoldierState THROWS on unimplemented states (e.g. IsFiring) -> safe wrap.
//   - Teleport DROPS the facing arg -> wrap records {pos,facing} per player for
//     the spawn-facing assertions.
//   - RayCast is a stub -> wire to the bundle's exported OnRayCastHit/Missed
//     (mode: 'hit' | 'miss' | 'drop').
//   - Message(playerObject) -> renders the player name like the game does.
// IMPORTANT: proxy (not copy) over modsim's exports — `export let stringkeys`
// is reassigned by SetStrings and a copy would go stale.
// ============================================================================
'use strict';

function makeEnumBag(name, real) {
    const memo = new Map();
    const base = real ?? {};
    return new Proxy(base, {
        get(t, p) {
            if (p in t) return t[p];
            if (typeof p !== 'string') return undefined;
            if (!memo.has(p)) memo.set(p, `${name}.${p}`);
            return memo.get(p);
        },
    });
}

function buildMod(modsim, opts = {}) {
    const raycastMode = opts.raycastMode ?? 'hit'; // 'hit' = LOS blocked (danger decays)
    const stubLog = new Map(); // name -> call count (report which stubs were exercised)
    const teleports = []; // { id, x, y, z, facing, simTime }
    let bundleRef = null; // set later via setBundle() (RayCast needs its handlers)

    const note = (name) => stubLog.set(name, (stubLog.get(name) ?? 0) + 1);

    // --- UI adders: return the widget modsim silently pushed -----------------
    function uiWrap(orig) {
        return function (...args) {
            const parent =
                args.find((a) => a && typeof a === 'object' && Array.isArray(a.children)) ?? modsim.uiRoot;
            const before = parent.children.length;
            orig(...args);
            if (parent.children.length > before) {
                const w = parent.children[parent.children.length - 1];
                if (!w.children) w.children = [];
                return w;
            }
            return null; // no overload matched — caller guards handle null
        };
    }

    // Minimal weapon/gadget image widgets (modsim has no equivalent at all).
    function makeImageStub(kind) {
        return function (name, pos, size, anchor, _item, parent, _pkg) {
            note(kind);
            const p = parent && Array.isArray(parent.children) ? parent : modsim.uiRoot;
            const w = {
                type: 'UIWidget', uiType: kind, name, position: pos, size, anchor,
                parent: p, visible: true, children: [],
            };
            p.children.push(w);
            return w;
        };
    }

    const zero = () => modsim.CreateVector(0, 0, 0);

    const patches = {
        // ---- real implementations (behavior matters) ------------------------
        IsInventorySlotActive: (_p, _slot) => { note('IsInventorySlotActive'); return true; }, // forceHoldSlot terminates
        GetInventoryAmmo: () => { note('GetInventoryAmmo'); return 30; },
        DirectionTowards: (a, b) => {
            const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
            const l = Math.hypot(dx, dy, dz) || 1;
            return modsim.CreateVector(dx / l, dy / l, dz / l);
        },
        Normalize: (v) => {
            const l = Math.hypot(v.x, v.y, v.z) || 1;
            return modsim.CreateVector(v.x / l, v.y / l, v.z / l);
        },
        DotProduct: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
        DealDamage: (target, amount, giver) => {
            note('DealDamage');
            target.currentHealth -= amount;
            if (target.currentHealth <= 0 && target.isAlive) modsim.KillPlayer(target, giver ?? target);
        },
        DeployAllPlayers: () => {
            note('DeployAllPlayers');
            for (const p of modsim.AllPlayers().array) modsim.DeployPlayer(p);
        },
        UnspawnAllAIsFromAISpawner: (spawner) => {
            note('UnspawnAllAIsFromAISpawner');
            const s = spawner;
            if (s && s.spawnedList) {
                for (const grunt of s.spawnedList) modsim.aiUnspawns.push(grunt);
                s.spawnedList = [];
            }
        },
        // ---- observability wraps -------------------------------------------
        Teleport: (player, pos, facing) => {
            teleports.push({
                id: player.ObjId, x: pos.x, y: pos.y, z: pos.z,
                facing, simTime: modsim.GetRoundTime(),
            });
            return modsim.Teleport(player, pos, facing);
        },
        GetSoldierState: (player, state) => {
            try {
                return modsim.GetSoldierState(player, state);
            } catch {
                if (state in modsim.SoldierStateVector) return zero();
                if (state in modsim.SoldierStateNumber) return 0;
                return false; // bools (IsFiring, IsManDown, ...)
            }
        },
        Message: (fmt, ...rest) => {
            if (fmt && typeof fmt === 'object') {
                if (fmt.type === 'Player') return modsim.Message(String(fmt.name ?? `Player${fmt.ObjId}`));
                if (fmt.type === 'Message') return fmt;
            }
            return modsim.Message(fmt, ...rest);
        },
        RayCast: (player, _start, _end) => {
            note(`RayCast(${raycastMode})`);
            if (!bundleRef || raycastMode === 'drop') return;
            queueMicrotask(() => {
                try {
                    if (raycastMode === 'hit') bundleRef.OnRayCastHit?.(player, zero(), zero());
                    else bundleRef.OnRayCastMissed?.(player);
                } catch (e) {
                    console.warn('[sim] raycast handler threw:', e.message);
                }
            });
        },
        // ---- UI ------------------------------------------------------------
        // Direct builders for the full-arity SDK signatures — modsim's argsMatch
        // dispatcher rejects some valid shapes (undefined receiver, etc). Arg
        // order is the canonical SDK one used by both our GameUI and the utils
        // UIText/UIContainer classes. Short arities fall through to modsim.
        AddUIText: function (...a) {
            if (a.length >= 15) {
                const parent = a[4] && Array.isArray(a[4].children) ? a[4] : modsim.uiRoot;
                const w = {
                    type: 'UIWidget', uiType: 'Text', name: a[0], position: a[1], size: a[2],
                    anchor: a[3], parent, visible: a[5], padding: a[6], bgColor: a[7],
                    bgAlpha: a[8], bgFill: a[9], message: a[10], textSize: a[11],
                    textColor: a[12], textAlpha: a[13], textAnchor: a[14], children: [],
                };
                if (a[15] !== undefined) w.depth = a[15];
                if (a[16] !== undefined) w.restrict = a[16];
                parent.children.push(w);
                return w;
            }
            return uiWrap(modsim.AddUIText)(...a);
        },
        AddUIContainer: function (...a) {
            if (a.length >= 10) {
                const parent = a[4] && Array.isArray(a[4].children) ? a[4] : modsim.uiRoot;
                const w = {
                    type: 'UIWidget', uiType: 'Container', name: a[0], position: a[1], size: a[2],
                    anchor: a[3], parent, visible: a[5], padding: a[6], bgColor: a[7],
                    bgAlpha: a[8], bgFill: a[9], children: [],
                };
                if (a[10] !== undefined) w.depth = a[10];
                if (a[11] !== undefined) w.restrict = a[11];
                parent.children.push(w);
                return w;
            }
            return uiWrap(modsim.AddUIContainer)(...a);
        },
        AddUIButton: uiWrap(modsim.AddUIButton),
        AddUIImage: uiWrap(modsim.AddUIImage),
        AddUIWeaponImage: makeImageStub('WeaponImage'),
        AddUIGadgetImage: makeImageStub('GadgetImage'),
        // ---- partial/missing enums -----------------------------------------
        Weapons: makeEnumBag('Weapons', modsim.Weapons),
        WeaponAttachments: makeEnumBag('WeaponAttachments', modsim.WeaponAttachments),
        Gadgets: makeEnumBag('Gadgets', modsim.Gadgets),
        RuntimeSpawn_Common: makeEnumBag('RuntimeSpawn_Common', modsim.RuntimeSpawn_Common),
        RuntimeSpawn_Aftermath: makeEnumBag('RuntimeSpawn_Aftermath', modsim.RuntimeSpawn_Aftermath),
        AiInput: makeEnumBag('AiInput'),
        SpotStatus: makeEnumBag('SpotStatus'),
        SoldierEffects: makeEnumBag('SoldierEffects'),
        SpectatingGroup: makeEnumBag('SpectatingGroup'),
    };

    // Anything else missing becomes a logged no-op that can also act as an enum
    // bag if property-accessed (callable Proxy, memoized per name).
    const autoStubs = new Map();
    function autoStub(name) {
        if (!autoStubs.has(name)) {
            const bag = makeEnumBag(name);
            const fn = new Proxy(function () { note(name); }, {
                get: (t, p) => (p in t ? t[p] : bag[p]),
            });
            autoStubs.set(name, fn);
        }
        return autoStubs.get(name);
    }

    const M = new Proxy(modsim, {
        get(t, p) {
            if (p in patches) return patches[p];
            if (p in t) return t[p];
            if (typeof p !== 'string') return undefined;
            return autoStub(p);
        },
        set(t, p, v) { t[p] = v; return true; },
        has() { return true; },
    });

    return {
        mod: M,
        teleports,
        stubLog,
        setBundle: (b) => { bundleRef = b; },
    };
}

module.exports = { buildMod };
