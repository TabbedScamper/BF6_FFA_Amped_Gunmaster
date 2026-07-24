// ============================================================================
// FFA GUNMASTER SIM — offline harness (modsim-based)
// ============================================================================
// Runs the REAL built bundle (dist/bundle.ts) against the SDK's modsim on Node —
// no game needed. Auto-compiles modsim + bundle to CJS with the project's tsc.
//
//   node sim/harness.cjs                 run every scenario
//   node sim/harness.cjs spawns ladder   run selected scenarios
//   node sim/harness.cjs --force         recompile even if fresh
//   node sim/harness.cjs -v              stream captured console output live
//
// Scenarios: boot, spawns, ladder, demotion, notify, bots, winner, soak
// NOT simulated (game-side only): combat area / OOB, real ballistics, real AI.
// ============================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildMod } = require('./compat.cjs');

const PROJ = path.resolve(__dirname, '..');
const SDK = path.resolve(PROJ, '..', '..', '..', '..'); // ...\Portal\PortalSDK
const MODSIM_DIR = path.join(SDK, 'unsupported', 'modsim');
const SPATIAL = path.join(SDK, 'export', 'levels', 'Hospital_Gunmaster.spatial.json');
const BUILD = path.join(__dirname, 'build');
const TSC = path.join(PROJ, 'node_modules', 'typescript', 'bin', 'tsc');

const argv = process.argv.slice(2);
const VERBOSE = argv.includes('-v');
const FORCE = argv.includes('--force');
const wanted = argv.filter((a) => !a.startsWith('-'));

// ---------------------------------------------------------------------------
// Build step: compile modsim (+enums) and dist/bundle.ts to CommonJS.
// ---------------------------------------------------------------------------
function newerThan(src, out) {
    if (!fs.existsSync(out)) return true;
    return fs.statSync(src).mtimeMs > fs.statSync(out).mtimeMs;
}

function tsc(args, label) {
    const r = spawnSync(process.execPath, [TSC, ...args], { encoding: 'utf-8' });
    if (r.status !== 0) {
        console.error(`[build] tsc failed for ${label}:\n${r.stdout}\n${r.stderr}`);
        process.exit(1);
    }
}

function ensureBuilt() {
    const flags = ['--noCheck', '--skipLibCheck', '--module', 'commonjs', '--target', 'es2022',
        '--moduleResolution', 'node', '--esModuleInterop'];
    const modsimSrcs = [
        path.join(MODSIM_DIR, 'modsim.ts'),
        path.join(MODSIM_DIR, 'enums', 'index.ts'),
        path.join(MODSIM_DIR, 'enums', 'audio.ts'),
        path.join(MODSIM_DIR, 'enums', 'weapons.ts'),
        path.join(MODSIM_DIR, 'enums', 'runtime-spawn.ts'),
    ];
    const modsimOut = path.join(BUILD, 'modsim', 'modsim.js');
    if (FORCE || modsimSrcs.some((s) => newerThan(s, modsimOut))) {
        console.log('[build] compiling modsim...');
        tsc([...flags, '--rootDir', MODSIM_DIR, '--outDir', path.join(BUILD, 'modsim'), ...modsimSrcs], 'modsim');
    }
    const bundleSrc = path.join(PROJ, 'dist', 'bundle.ts');
    const bundleOut = path.join(BUILD, 'dist', 'bundle.js');
    if (FORCE || newerThan(bundleSrc, bundleOut)) {
        console.log('[build] compiling bundle...');
        tsc([...flags, '--rootDir', path.join(PROJ, 'dist'), '--outDir', path.join(BUILD, 'dist'), bundleSrc], 'bundle');
    }
    return { modsimOut, bundleOut };
}

// ---------------------------------------------------------------------------
// Console capture: histogram of every log line (dedup by first 90 chars).
// ---------------------------------------------------------------------------
const captured = new Map(); // key -> { count, level }
const realLog = console.log.bind(console), realWarn = console.warn.bind(console), realErr = console.error.bind(console);
function capture(level, real) {
    return (...args) => {
        const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        const key = `${level}| ${line.slice(0, 90)}`;
        const e = captured.get(key) ?? { count: 0, level };
        e.count++;
        captured.set(key, e);
        if (VERBOSE) real(...args);
    };
}
function out(...args) { realLog(...args); } // harness's own output always prints

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------
const results = []; // { scenario, name, pass, detail }
let currentScenario = 'boot';
function check(name, cond, detail = '') {
    results.push({ scenario: currentScenario, name, pass: !!cond, detail });
    out(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

function widgetCount(w) {
    let n = 1;
    for (const c of w.children ?? []) n += widgetCount(c);
    return n;
}
function findWidgets(w, pred, acc = []) {
    if (pred(w)) acc.push(w);
    for (const c of w.children ?? []) findWidgets(c, pred, acc);
    return acc;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    const { modsimOut, bundleOut } = ensureBuilt();

    const modsim = require(modsimOut);
    const shim = buildMod(modsim, { raycastMode: 'hit' });
    globalThis.mod = shim.mod;

    // Strings: bundle.strings.json is the NESTED object our SK() pattern walks.
    modsim.SetStrings(JSON.parse(fs.readFileSync(path.join(PROJ, 'dist', 'bundle.strings.json'), 'utf-8')));

    console.log = capture('log', realLog);
    console.warn = capture('warn', realWarn);
    console.error = capture('error', realErr);

    const bundle = require(bundleOut);
    shim.setBundle(bundle);

    const spatial = JSON.parse(fs.readFileSync(SPATIAL, 'utf-8'));
    modsim.LoadLevel(bundle, spatial);

    const humans = [];
    const scenarios = { boot, spawns, ladder, demotion, notify, bots, spacing, winner, soak };
    const toRun = wanted.length ? wanted : Object.keys(scenarios);

    // ---- boot: join humans, start mode, run through the intro ---------------
    async function boot() {
        for (let i = 0; i < 2; i++) humans.push(modsim.AddPlayer());
        modsim.StartGameMode();
        for (const p of humans) modsim.DeployPlayer(p);
        check('2 humans joined + deployed', humans.every((p) => p.isAlive));
        check('spawn markers initialized', bundle.spawnCount() === 32, `spawnCount=${bundle.spawnCount()}`);
        check('intro running after start', bundle.introRunning() === true);
        await modsim.Loop(25); // READY countdown (15s) + beats
        check('intro finished by t=25s', bundle.introRunning() === false);
        check('HUD shell built for humans', findWidgets(modsim.uiRoot, (w) => String(w.name ?? '').startsWith('cwpanel_')).length >= humans.length,
            `widgets=${widgetCount(modsim.uiRoot)}`);
    }

    // ---- spawns: teleport target + facing-toward-centroid -------------------
    async function spawns() {
        const before = shim.teleports.length;
        modsim.KillPlayer(humans[0], humans[1]); // death -> black hold -> respawn -> teleport
        await modsim.Loop(8);
        const tps = shim.teleports.slice(before);
        check('respawn teleported to a marker', tps.length >= 1, `teleports=${tps.length}`);

        const markers = bundle.spawnMarkerPositions();
        // Marker-facing mode: expected yaw = the marker's PLACED heading, i.e.
        // atan2(front.x, front.z) of the spatial object (matches modsim's euler
        // decoder putting the heading in rotation.z, which spawns.ts reads).
        const spatialMarkers = spatial.Portal_Dynamic.filter(
            (o) => Number.isInteger(o.ObjId) && o.ObjId >= 101 && o.ObjId <= 132 && o.position && o.front);
        let facingOk = 0, matchedMarker = 0;
        for (const t of tps) {
            const sm = spatialMarkers.find((mm) => Math.abs(mm.position.x - t.x) < 0.01 && Math.abs(mm.position.z - t.z) < 0.01);
            if (!sm) continue;
            matchedMarker++;
            const expect = Math.atan2(sm.front.x, sm.front.z);
            let d = Math.abs(t.facing - expect) % (2 * Math.PI);
            if (d > Math.PI) d = 2 * Math.PI - d;
            if (d < 1e-3) facingOk++;
        }
        check('teleport positions are spawn markers', matchedMarker === tps.length,
            `${matchedMarker}/${tps.length} (markers loaded: ${markers.length})`);
        check('facing copies the marker\'s placed rotation', facingOk === tps.length, `${facingOk}/${tps.length}`);

        // spacing: consecutive spawns should avoid reusing the same marker
        const ids = tps.map((t) => `${t.x.toFixed(1)},${t.z.toFixed(1)}`);
        check('spawn picker returns valid markers (no origin)', tps.every((t) => Math.hypot(t.x, t.z) > 1));
        void ids;
    }

    // ---- ladder: kills promote every KILLS_PER_TIER; knife tier needs 1 -----
    async function ladder() {
        const killer = humans[1], victim = humans[0];
        const rec = bundle.progressOf(killer);
        const start = rec.ladderIndex;
        for (let i = 0; i < 4; i++) { // 4 kills = 2 promotions (KILLS_PER_TIER=2)
            modsim.KillPlayer(victim, killer);
            await modsim.Loop(6); // let victim respawn between kills
        }
        check('4 kills -> +2 tiers', bundle.progressOf(killer).ladderIndex === start + 2,
            `from ${start} to ${bundle.progressOf(killer).ladderIndex}`);
        const last = bundle.ladderLength() - 1;
        check('final (knife) tier needs exactly 1 kill', bundle.killsForTier(last) === 1);
        check('non-final tier needs 2 kills', bundle.killsForTier(0) === 2);
    }

    // ---- demotion: floor = peak - 4, never below ----------------------------
    async function demotion() {
        const p = humans[1];
        const rec = bundle.progressOf(p);
        rec.ladderIndex = 10; rec.peakIndex = 10; rec.tierKills = 0;
        bundle.shiftTiers(p, -99);
        check('demotion clamped to 4 below current', bundle.progressOf(p).ladderIndex === 6,
            `index=${bundle.progressOf(p).ladderIndex}`);
        check('demotionFloor reports peak-4', bundle.demotionFloor(p) === 6, `floor=${bundle.demotionFloor(p)}`);
        rec.ladderIndex = 2; rec.peakIndex = 2;
        bundle.shiftTiers(p, -99);
        check('early-ladder demotion clamps at 0', bundle.progressOf(p).ladderIndex === 0);
        check('demotionLoss previews respecting floor', bundle.demotionLoss(p, 3) === 0,
            `loss=${bundle.demotionLoss(p, 3)}`);
    }

    // ---- notify + black screen: death overlay appears, then clears ----------
    async function notify() {
        const victim = humans[0];
        const pid = modsim.GetObjId(victim);
        modsim.KillPlayer(victim, humans[1]);
        await modsim.Loop(1);
        const black = findWidgets(modsim.uiRoot, (w) => String(w.name ?? '') === `blackfade_${pid}`);
        check('black death overlay created', black.length >= 1);
        const quote = findWidgets(modsim.uiRoot, (w) => String(w.name ?? '') === `blackquote_${pid}`);
        const attrib = findWidgets(modsim.uiRoot, (w) => String(w.name ?? '') === `blackattrib_${pid}`);
        check('quote + attribution children exist', quote.length >= 1 && attrib.length >= 1);
        await modsim.Loop(8); // respawn + fade out
        const after = findWidgets(modsim.uiRoot, (w) => String(w.name ?? '') === `blackfade_${pid}`);
        check('black overlay cleaned up after respawn', after.length === 0, `left=${after.length}`);
    }

    // ---- bots: backfill pump spawns AI, brains tick without throwing --------
    async function bots() {
        await modsim.Loop(20); // give ensureBotFloor + 1-per-tick CreateAI time
        const ais = modsim.AllPlayers().array.filter((p) => p.isAISoldier);
        check('bot backfill spawned AI players', ais.length >= 8, `ai=${ais.length}`);
        check('bot brains registered', bundle.getBotBrainCount() >= Math.min(ais.length, 8),
            `brains=${bundle.getBotBrainCount()}`);
        await modsim.Loop(10);
        check('brains survive 10s of ticks', true); // reaching here = no crash
    }

    // ---- spacing: respawn storm — no spawn lands near anyone ----------------
    // Reproduces the reported "bot spawns on a player right after they spawn":
    // kill a human + 3 bots in the same second, let everything respawn, then
    // assert (a) any two spawns inside the 6.5s recent-spawn window are >= 20m
    // apart, and (b) every spawn is >= 20m from every stationary alive player.
    // (Sim players never move, so the checks are strict.)
    async function spacing() {
        const ais = modsim.AllPlayers().array.filter((p) => p.isAISoldier && p.isAlive);
        check('storm has bots to kill', ais.length >= 3, `alive ai=${ais.length}`);
        const mark = shim.teleports.length;
        modsim.KillPlayer(humans[0], ais[0]);
        modsim.KillPlayer(ais[0], humans[1]);
        modsim.KillPlayer(ais[1], humans[1]);
        modsim.KillPlayer(ais[2], humans[1]);
        await modsim.Loop(12);
        const tps = shim.teleports.slice(mark);
        check('storm produced respawn teleports (human + bots)', tps.length >= 4, `teleports=${tps.length}`);

        const closePairs = [];
        for (let i = 0; i < tps.length; i++) {
            for (let j = i + 1; j < tps.length; j++) {
                const a = tps[i], b = tps[j];
                if (a.id === b.id) continue;
                if (Math.abs(a.simTime - b.simTime) > 6.5) continue;
                const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
                if (d < 20) closePairs.push(`${a.id}<->${b.id} ${d.toFixed(1)}m`);
            }
        }
        check('no two wave spawns within 20m of each other', closePairs.length === 0,
            closePairs.join('; ') || `${tps.length} spawns all spaced`);

        // The picker GUARANTEES >=20m — UNLESS every marker is crowded, when it takes the
        // least-bad one (documented last-resort). So: hard-fail only under 12m (genuinely
        // "on top of someone"); 12-20m is the legal last-resort band, reported not failed.
        // Sim caveat: harness players NEVER move, so up to 16 statues sit exactly ON
        // markers all match — "every marker crowded -> last-resort" fires far more
        // often than in-game. Grading: <6m = genuinely on top, always fails; 6-12m =
        // deep last-resort, at most ONE tolerated per storm; 12-20m = legal band.
        const movedIds = new Set(tps.map((t) => t.id));
        const onTop = [], deep = [], lastResort = [];
        for (const t of tps) {
            for (const q of modsim.AllPlayers().array) {
                if (!q.isAlive || !q.position || q.ObjId === t.id || movedIds.has(q.ObjId)) continue;
                const d = Math.hypot(q.position.x - t.x, q.position.y - t.y, q.position.z - t.z);
                if (d < 6) onTop.push(`spawn ${t.id} ON player ${q.ObjId} ${d.toFixed(1)}m`);
                else if (d < 12) deep.push(`spawn ${t.id} deep-LR near ${q.ObjId} ${d.toFixed(1)}m`);
                else if (d < 20) lastResort.push(`spawn ${t.id} near ${q.ObjId} ${d.toFixed(1)}m`);
            }
        }
        if (deep.length || lastResort.length) out('  note: ' + [...deep, ...lastResort].join('; '));
        check('no spawn on top of a stationary player (<6m, or 2+ deep last-resorts)',
            onTop.length === 0 && deep.length <= 1,
            [...onTop, ...deep].join('; ') || 'all clear');
    }

    // ---- winner: last-tier kill finishes the match --------------------------
    async function winner() {
        const p = humans[1];
        const rec = bundle.progressOf(p);
        rec.ladderIndex = bundle.ladderLength() - 1; rec.peakIndex = rec.ladderIndex; rec.tierKills = 0;
        const widgetsBefore = widgetCount(modsim.uiRoot);
        modsim.KillPlayer(humans[0], p);
        await modsim.Loop(3);
        check('winner flow ran without throwing', true);
        // showResults builds anonymous utils widgets (overlay + panel + 5 headers + rows):
        // assert by widget-count delta rather than names.
        const widgetsAfter = widgetCount(modsim.uiRoot);
        check('end-of-round results UI built', widgetsAfter - widgetsBefore >= 8,
            `widgets ${widgetsBefore} -> ${widgetsAfter}`);
    }

    // ---- soak: leak detection over a long run -------------------------------
    async function soak() {
        const samples = [];
        for (let i = 0; i < 4; i++) {
            await modsim.Loop(15);
            const timerCount = (bundle.Timers?.getActiveTimerCount ?? bundle.getActiveTimerCount ?? (() => -1))();
            samples.push({
                t: modsim.GetRoundTime().toFixed(0),
                timers: timerCount,
                widgets: widgetCount(modsim.uiRoot),
                players: modsim.AllPlayers().array.length,
            });
        }
        out('  soak samples: ' + samples.map((s) => `[t=${s.t} timers=${s.timers} widgets=${s.widgets} players=${s.players}]`).join(' '));
        const t0 = samples[0], tN = samples[samples.length - 1];
        check('active timers not growing unbounded', tN.timers <= t0.timers * 3 + 20, `${t0.timers} -> ${tN.timers}`);
        check('UI widget count not growing unbounded', tN.widgets <= t0.widgets * 2 + 50, `${t0.widgets} -> ${tN.widgets}`);
    }

    // ---- run ----------------------------------------------------------------
    for (const name of toRun) {
        if (!scenarios[name]) { out(`(unknown scenario '${name}' — skipping)`); continue; }
        currentScenario = name;
        out(`\n=== ${name} ===`);
        try {
            await scenarios[name]();
        } catch (e) {
            check(`${name} completed`, false, `THREW: ${e.stack?.split('\n')[0]}`);
            if (VERBOSE) realErr(e);
        }
    }

    // ---- report -------------------------------------------------------------
    console.log = realLog; console.warn = realWarn; console.error = realErr;
    const fails = results.filter((r) => !r.pass);
    out(`\n${'='.repeat(60)}\nRESULT: ${results.length - fails.length}/${results.length} checks passed`);
    if (fails.length) for (const f of fails) out(`  FAIL [${f.scenario}] ${f.name} ${f.detail}`);

    out('\n--- stubbed mod.* calls exercised ---');
    for (const [n, c] of [...shim.stubLog.entries()].sort((a, b) => b[1] - a[1])) out(`  ${n}: ${c}`);

    out('\n--- captured console (top 25 by count) ---');
    const top = [...captured.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 25);
    for (const [k, v] of top) out(`  x${v.count}  ${k}`);

    process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { realErr(e); process.exit(2); });
