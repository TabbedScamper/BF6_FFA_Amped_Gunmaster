// ============================================================================
// FFA GUNMASTER — PER-PLAYER STREAK MUSIC + VOICE-OVER BEATS
// ============================================================================
// MUSIC DESIGN (no countdown/lobby music by request): the Radio station is ARMED
// at mode start (loaded + tuned + queued, NOT played), then each human's music
// starts LOW the moment they're in the live match — at "FIGHT!" for the starting
// wave, on redeploy for respawns — and every kill turns their volume up
// (BASE_AMP at 0 kills, linear to MAX_AMP at CAP_KILLS). Death stops it.
//
// PROVEN-WORKING RADIO RECIPE (community reference code, verified in-game):
//   stop-sequence (NextQueuedTrack -> Stop -> ClearQueue)
//   Wait(1)
//   LoadMusic(Radio)   <- EVERY sequence, not once at start
//   set channel/params + queue tracks
//   Wait(1)            <- the gap between queueing and playing matters
//   PlayMusic(Radio_Play)
//
// KNOWN ENGINE FACTS: amplitude CLAMPS to 0-3 (official docs) — configured values
// above 3 flatten until DICE lift the clamp. SetMusicParam applies GLOBALLY even
// with a player arg (filed bug) — the highest live streak drives the volume every
// listener hears; degrades to true per-player volume when fixed.
//
// VO: PlayVO with no target = GLOBAL, with a player = that player only (flags
// Hotel/India only support select events — we stay on Alpha, the safe one).
// Beats: "FIGHT!" round-start call, time-remaining warnings (120/60/30s), and
// the finale alarm — the player who reaches the last guns hears the "winning"
// line while every other human hears the "losing" one.
// ============================================================================

import { Timers } from 'bf6-portal-utils/timers/index.ts';
import {
    DEBUG_MODE, MUSIC_ENABLED, VO_ENABLED,
    STREAK_MUSIC_ENABLED, STREAK_MUSIC_CHANNEL, STREAK_MUSIC_TRACKS,
    STREAK_MUSIC_BASE_AMP, STREAK_MUSIC_MAX_AMP, STREAK_MUSIC_CAP_KILLS,
} from './config.ts';

const RS = mod.RuntimeSpawn_Common;
const ZERO = mod.CreateVector(0, 0, 0);

function log(msg: string): void {
    if (DEBUG_MODE) console.log(`[Music] ${msg}`);
}

function eachHuman(cb: (p: mod.Player) => void): void {
    try {
        const arr = mod.AllPlayers();
        const n = mod.CountOf(arr);
        for (let i = 0; i < n; i++) {
            const p = mod.ValueInArray(arr, i) as mod.Player;
            try {
                if (mod.IsPlayerValid(p) && !mod.GetSoldierState(p, mod.SoldierStateBool.IsAISoldier)) cb(p);
            } catch {}
        }
    } catch {}
}

// --- Radio plumbing ---------------------------------------------------------
async function radioStopSequence(): Promise<void> {
    try {
        mod.PlayMusic(mod.MusicEvents.Radio_NextQueuedTrack);
        mod.PlayMusic(mod.MusicEvents.Radio_Stop);
        mod.PlayMusic(mod.MusicEvents.Radio_ClearQueue);
    } catch {}
}

/** PACED ARMING — 5s-between-every-step proved the wrong-track bug was pure
 *  timing (rock played correctly). Walked back to targeted waits: the LONG gaps
 *  stay where the engine actually needs them (after LoadMusic — package load is
 *  slow per Aryo — and after the channel switch, which must settle before the
 *  queue captures from it). Total ~13s, inside the 15s countdown, so the play
 *  fires right AT "FIGHT!". If the wrong track ever returns, raise these waits
 *  back toward 5 (the proven-safe pacing). */
let armed = false;
let playRequested = false;

// PRE-ARM = the SILENT-ONLY steps (load/channel/amplitude, which need settle
// time). The QUEUE stays EMPTY until FIGHT! — per official docs "if the queue is
// empty, nothing will play", so early music is structurally impossible (a build
// that queued during the countdown had music leaking in before FIGHT).
async function armStreakStation(): Promise<void> {
    await radioStopSequence();
    console.log('[Music] step 1: stop-sequence fired');
    await mod.Wait(2);
    try { mod.LoadMusic(mod.MusicPackages.Radio); console.log('[Music] step 2: LoadMusic(Radio)'); } catch {}
    await mod.Wait(5); // package load — the slow one
    try {
        mod.SetMusicParam(mod.MusicParams.Radio_Channel, STREAK_MUSIC_CHANNEL);
        console.log(`[Music] step 3: Radio_Channel = ${STREAK_MUSIC_CHANNEL}`);
    } catch {}
    await mod.Wait(3); // channel settle — queueing too early captured the wrong station
    try {
        mod.SetMusicParam(mod.MusicParams.Radio_Amplitude, STREAK_MUSIC_BASE_AMP);
        console.log(`[Music] step 4: amp=${STREAK_MUSIC_BASE_AMP} — pre-arm done (queue stays EMPTY until FIGHT)`);
    } catch {}
    armed = true;
    if (playRequested) void doGlobalPlay();
}

/** FIGHT!: queue the freshly shuffled playlist NOW, then play — the recipe's
 *  queue->Wait(1)->Play tail runs here, so music lands ~1s after "FIGHT!". */
async function doGlobalPlay(): Promise<void> {
    try {
        mod.SetMusicParam(mod.MusicParams.Radio_ContinueQueueOnTrackEnd, 1);
        mod.SetMusicParam(mod.MusicParams.Radio_LoopQueuedTracks, 1);
        // Fresh SHUFFLE each match (Fisher-Yates), queued in shuffled order; the queue
        // loops, so the whole rotation repeats all match.
        const order = [...STREAK_MUSIC_TRACKS];
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        for (const t of order) mod.SetMusicParam(mod.MusicParams.Radio_QueueTrackNumber, t);
        console.log(`[Music] FIGHT: queued shuffled playlist [${order.join(', ')}]`);
    } catch {}
    await mod.Wait(1); // recipe gap between queueing and playing
    try {
        applyAmp();
        mod.PlayMusic(mod.MusicEvents.Radio_Play); // GLOBAL
        musicRunning = true;
        console.log('[Music] global Radio_Play fired');
    } catch {}
}

/** OnGameModeStarted (first line): arm the station. NO play — the countdown stays
 *  music-free by design; playback begins per-player once the match is live. */
export function initMusic(): void {
    if (!MUSIC_ENABLED) return;
    void armStreakStation();
}

// --- Per-player streak music -------------------------------------------------
// playerId -> current streak, for everyone whose music is ON (alive in live match).
const streakers: Map<number, number> = new Map();

function ampFor(kills: number): number {
    const k = Math.min(kills, STREAK_MUSIC_CAP_KILLS);
    return STREAK_MUSIC_BASE_AMP + (k / STREAK_MUSIC_CAP_KILLS) * (STREAK_MUSIC_MAX_AMP - STREAK_MUSIC_BASE_AMP);
}

// Amplitude param is GLOBAL (engine bug): the highest live streak sets the volume every listener hears.
let lastAppliedAmp = -1;
let ampTimer: number | null = null;

/** DEBOUNCED + de-duped amplitude write. A busy FFA fired a SetMusicParam on EVERY kill/death (even
 *  when the value didn't change); when one landed on the radio's auto track-switch (queue advance) it
 *  glitched the stream — silence, or a stuck/looping track (the "dies during a switch" bug). We now
 *  coalesce to at most one write per ~300ms and skip no-op writes, so a param write almost never
 *  collides with a track switch. The streak volume-ramp still tracks within ~300ms (imperceptible). */
function applyAmp(): void {
    if (ampTimer !== null) return; // a write is already scheduled; it reads the latest pool at fire time
    ampTimer = Timers.setTimeout(() => {
        ampTimer = null;
        let top = 0;
        for (const s of streakers.values()) if (s > top) top = s;
        const amp = ampFor(top);
        if (Math.abs(amp - lastAppliedAmp) < 0.01) return; // unchanged — don't poke the radio mid-track
        lastAppliedAmp = amp;
        try { mod.SetMusicParam(mod.MusicParams.Radio_Amplitude, amp); } catch {}
    }, 300);
}

// TARGETED Radio_Play is BROKEN: it played a wrong/untuned track in-game, and
// Aryo's docs only document the player arg for STOPPING ("you can stop a sound
// specifically for one of those groups") — never for playing. So playback is ONE
// GLOBAL stream (the correctly-tuned Rock track, started once at FIGHT), and the
// kill-ramp drives the GLOBAL amplitude (which is global anyway per the param
// bug): your streak turns the music up for the lobby, capped per config. Music is
// NOT stopped on death — the resume path would force a global restart; the ~5s
// death window just keeps the current volume.
let musicRunning = false;

/** "FIGHT!": start the single global stream, LOW. If the slow diagnostic arming
 *  is still in flight, the play is DEFERRED until the final arm step completes. */
export function musicOnFight(): void {
    if (!MUSIC_ENABLED || !STREAK_MUSIC_ENABLED || musicRunning) return;
    if (!armed) {
        playRequested = true;
        console.log('[Music] FIGHT before armed — play deferred until arming completes');
        return;
    }
    doGlobalPlay();
}

/** Kill: their streak grew — turn the volume knob up (top live streak wins). */
export function streakMusicOnKill(player: mod.Player, streak: number): void {
    if (!MUSIC_ENABLED || !STREAK_MUSIC_ENABLED) return;
    try {
        streakers.set(mod.GetObjId(player), streak);
        applyAmp();
        log(`streak ${streak} -> amp ${ampFor(streak).toFixed(2)}`);
    } catch {}
}

/** Death: their streak leaves the volume pool (stream keeps playing — targeted
 *  stop would need a global restart to undo, see header note). */
export function streakMusicOnDeath(player: mod.Player): void {
    if (!MUSIC_ENABLED || !STREAK_MUSIC_ENABLED) return;
    try {
        if (streakers.delete(mod.GetObjId(player))) applyAmp();
    } catch {}
}

/** Player left — drop their entry without touching a (gone) player object. */
export function clearStreakMusic(playerId: number): void {
    if (streakers.delete(playerId)) applyAmp();
}

/** Match over: all music off (results screen is silent by design). */
export function musicOnMatchEnd(): void {
    if (!MUSIC_ENABLED) return;
    streakers.clear();
    if (ampTimer !== null) { try { Timers.clearTimeout(ampTimer); } catch {} ampTimer = null; }
    lastAppliedAmp = -1;
    void radioStopSequence();
}

// --- VO ---------------------------------------------------------------------
function playVO(event: mod.VoiceOverEvents2D, target?: mod.Player): void {
    if (!VO_ENABLED) return;
    try {
        const vo = mod.SpawnObject(RS.SFX_VOModule_OneShot2D, ZERO, ZERO) as mod.VO;
        if (target !== undefined) mod.PlayVO(vo, event, mod.VoiceOverFlags.Alpha, target);
        else mod.PlayVO(vo, event, mod.VoiceOverFlags.Alpha); // no target = whole lobby
        Timers.setTimeout(() => {
            try { mod.UnspawnObject(vo as unknown as mod.Object); } catch {}
        }, 8000);
    } catch {}
}

/** "FIGHT!": global round-start call. */
export function announceFight(): void {
    playVO(mod.VoiceOverEvents2D.RoundStartGeneric);
}

// Time-remaining warnings, each fired ONCE when the clock crosses the threshold.
// Crossing-detection (prev > T >= now) means a page with NO time limit (remaining
// reads 0/garbage from the start) can never fire them.
const TIME_VO: { at: number; event: () => mod.VoiceOverEvents2D; fired: boolean }[] = [
    { at: 120, event: () => mod.VoiceOverEvents2D.Time120Left, fired: false },
    { at: 60, event: () => mod.VoiceOverEvents2D.Time60Left, fired: false },
    { at: 30, event: () => mod.VoiceOverEvents2D.Time30Left, fired: false },
];
let timeVoTimer: number | null = null;
let lastRemaining = -1;

export function startTimeVO(): void {
    if (!VO_ENABLED || timeVoTimer !== null) return;
    timeVoTimer = Timers.setInterval(() => {
        try {
            const r = mod.GetMatchTimeRemaining();
            if (r > 0 && lastRemaining > 0) {
                for (const t of TIME_VO) {
                    if (!t.fired && lastRemaining > t.at && r <= t.at) {
                        t.fired = true;
                        playVO(t.event());
                        log(`time VO at ${t.at}s`);
                    }
                }
            }
            lastRemaining = r;
        } catch {}
    }, 1000);
}

export function stopTimeVO(): void {
    if (timeVoTimer !== null) {
        try { Timers.clearInterval(timeVoTimer); } catch {}
        timeVoTimer = null;
    }
}

// Finale alarm: the FIRST player to reach the finale guns hears the "late-game
// winning" line; every OTHER human hears the "losing" one — the lobby-wide
// "someone is about to win" tension beat. Once per match.
let finaleAnnounced = false;
export function announceFinaleAlarm(finalist: mod.Player): void {
    if (!VO_ENABLED || finaleAnnounced) return;
    finaleAnnounced = true;
    try {
        const fid = mod.GetObjId(finalist);
        eachHuman((p) => {
            playVO(mod.GetObjId(p) === fid ? mod.VoiceOverEvents2D.ProgressLateWinning
                : mod.VoiceOverEvents2D.ProgressLateLosing, p);
        });
        log('finale alarm VO');
    } catch {}
}

/** Match teardown: stop timers (music stop is musicOnMatchEnd, called by the results flow). */
export function stopMusicSystem(): void {
    stopTimeVO();
}
