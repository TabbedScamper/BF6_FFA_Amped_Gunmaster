// ============================================================================
// SDK AUGMENTATION — members the npm `bf6-portal-mod-types` package lags on
// ============================================================================
// bf6-portal-mod-types v2.3.1 is missing 5 weapons that exist in the installed
// SDK 1.3.3.0 types (PortalSDK/code/types/mod/index.d.ts). Ambient enum
// declaration-merging adds them for compile-time typing.
//
// SAFE because `mod` is a `declare namespace` (compile-time only) and the
// bundler emits weapon references BY NAME (e.g. `mod.Weapons.AssaultRifle_VCR_2`,
// fully qualified) — the engine's injected `mod` global provides the runtime
// value. The numeric initializers below are never emitted; they only satisfy
// TS's rule that merged (continuation) enum members carry initializers. Values
// are arbitrarily high to avoid any theoretical confusion.
//
// When bf6-portal-mod-types publishes a version that includes these, delete
// this file and re-run npm install.
// ============================================================================

declare namespace mod {
    export enum Weapons {
        AssaultRifle_VCR_2 = 9001,
        SMG_CZ3A1 = 9002,
        LMG_M121_A2 = 9003,
        DMR_GRT_CPS = 9004,
        Sidearm_VZ_61 = 9005,
    }
}
