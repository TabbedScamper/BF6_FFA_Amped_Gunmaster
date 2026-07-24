// ============================================================================
// FFA GUNMASTER — MAP DETECTION + CREDITS
// ============================================================================
// Identifies WHICH map the mode is running on so the match-start MAP card can
// name it + credit its creators.
//
// WHY NOT mod.IsCurrentMap / GetHQ:
//   - mod.IsCurrentMap is broken (community consensus: always returns Abbasid).
//   - GetObjectPosition(GetHQ(1)) hits the non-physical-object bug (reads ~0,0,0),
//     the same reason spawns.ts only reads PHYSICAL markers.
// So we key off the ONE physical, runtime-readable, per-map-unique coordinate we
// have: the XZ CENTROID of the spawn markers (ObjId 101-135). Each creator's map
// places those markers differently, so its centroid is a stable fingerprint.
//
// We scan the marker id range DIRECTLY here (not via spawns.ts) so detection tracks
// the actual markers the maps use (101-135) and is robust to a map having 32-35 of
// them — the centroid is just the mean of whichever are present.
//
// ADD A MAP:
//   1. strings.json: add  ffa.mapcard.<key>  and  ffa.mapcard.<key>_by.
//   2. Signature = floored XZ centroid of that map's 101-135 markers — compute it
//      offline from the .spatial.json, OR run the map once and read the
//      "[MapCard] unknown map signature 'X,Z'" console line, then add a row below.
// ============================================================================

const SK = (): mod.Any => mod.stringkeys;

// Spawn-marker ObjId range the maps use (inclusive). Absent ids on a given map are skipped.
const MARKER_ID_LO = 101;
const MARKER_ID_HI = 135;

export interface MapCredit {
    line1: mod.Message; // e.g. "MAP:   INFERNO"
    line2: mod.Message; // e.g. "MADE BY:   HANSMAN030 & DARIVAN"
}

interface MapRow {
    x: number; // signature centroid X (floored)
    z: number; // signature centroid Z (floored)
    line1: () => mod.Message;
    line2: () => mod.Message;
}

// Each row's (x,z) is the floored XZ centroid of that map's spawn markers (101-135).
const REGISTRY: MapRow[] = [
    // INFERNO — built on MP_Limestone, by HANSMAN030 & DARIVAN. 35 markers, centroid (296.5, 48.4).
    { x: 296, z: 48, line1: () => mod.Message(SK().ffa.mapcard.inferno), line2: () => mod.Message(SK().ffa.mapcard.inferno_by) },
    // AIRPORT (Terminal) — by TABBEDSCAMPER & CYPHR. 35 markers, centroid (-39.6, -338.9).
    { x: -40, z: -339, line1: () => mod.Message(SK().ffa.mapcard.airport), line2: () => mod.Message(SK().ffa.mapcard.airport_by) },
    // HOSPITAL — by TABBEDSCAMPER & LANGUORIAN. 35 markers, centroid (200.1, -8.6).
    { x: 200, z: -9, line1: () => mod.Message(SK().ffa.mapcard.hospital), line2: () => mod.Message(SK().ffa.mapcard.hospital_by) },
];

// Nearest registered signature within this many metres wins — absorbs float drift and the
// small centroid shift if a marker or two fails to read on a given map.
const TOLERANCE_M = 12;

/** Mean XZ of this map's physical spawn markers (101-135), or null if none read yet. */
function markerCentroid(): { x: number; z: number } | null {
    let sx = 0, sz = 0, n = 0;
    for (let id = MARKER_ID_LO; id <= MARKER_ID_HI; id++) {
        try {
            const obj = mod.GetSpatialObject(id);
            const p = mod.GetObjectPosition(obj);
            const x = mod.XComponentOf(p), y = mod.YComponentOf(p), z = mod.ZComponentOf(p);
            // Non-physical / not-present objects report ~0,0,0 (known runtime bug) — skip them,
            // exactly like spawns.ts initSpawns does.
            if (Math.abs(x) < 1 && Math.abs(y) < 1 && Math.abs(z) < 1) continue;
            sx += x; sz += z; n++;
        } catch {
            // marker id not present on this map — skip
        }
    }
    if (n === 0) return null;
    return { x: sx / n, z: sz / n };
}

/** The detected map's credit lines, or null if the map isn't registered / markers not ready. */
export function detectMapCredit(): MapCredit | null {
    const c = markerCentroid();
    if (!c) return null;
    let best: MapRow | null = null;
    let bestD = Infinity;
    for (const r of REGISTRY) {
        const d = Math.hypot(r.x - c.x, r.z - c.z);
        if (d < bestD) { bestD = d; best = r; }
    }
    if (best && bestD <= TOLERANCE_M) return { line1: best.line1(), line2: best.line2() };
    // Unknown map — surface its signature so it can be added to REGISTRY above.
    try {
        console.log(`[MapCard] unknown map signature '${Math.round(c.x)},${Math.round(c.z)}' — add it to REGISTRY (map-registry.ts)`);
    } catch {}
    return null;
}
