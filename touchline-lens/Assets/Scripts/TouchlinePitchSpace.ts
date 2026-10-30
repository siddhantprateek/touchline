// TouchlinePitchSpace — pure helpers: StatsBomb units <-> pitch-local cm, key sampling.
// Owns: the coordinate mapping (1 StatsBomb unit = 0.5 cm, 120 x 80 -> 60 x 40 cm).
// Pitch-local frame: +X = right (home attacks +X), +Y = up off the turf, +Z = toward the user
// (StatsBomb y = 80 is the near touchline). Origin = pitch centre on the turf surface.
// Must not: touch the scene. Correctness invariants only — no tunables live here.
import {Key2, Key3} from "./Data/MatchTypes"

export const SB_TO_CM = 0.5
export const PITCH_LEN_CM = 60
export const PITCH_WID_CM = 40
/** Height of the turf surface above the table top (turf slab thickness). */
export const TURF_TOP_CM = 0.4
/** Token centre height above the turf. */
export const TOKEN_LIFT_CM = 0.3

export function toLocal(sx: number, sy: number, sz: number = 0, lift: number = TOKEN_LIFT_CM): vec3 {
  return new vec3((sx - 60) * SB_TO_CM, TURF_TOP_CM + sz * SB_TO_CM + lift, (sy - 40) * SB_TO_CM)
}

/** Linear-interpolated position on a Key2 track at time t (clamped at the ends). */
export function sampleKey2(keys: Key2[], t: number): [number, number] {
  if (keys.length === 0) return [60, 40]
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2]]
  const last = keys[keys.length - 1]
  if (t >= last[0]) return [last[1], last[2]]
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a[0] && t <= b[0]) {
      const span = b[0] - a[0]
      const u = span <= 1e-4 ? 1 : smooth((t - a[0]) / span)
      return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]
    }
  }
  return [last[1], last[2]]
}

/** Linear-interpolated ball position on a Key3 track (ball moves at constant speed per segment). */
export function sampleKey3(keys: Key3[], t: number): [number, number, number] {
  if (keys.length === 0) return [60, 40, 0]
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2], keys[0][3]]
  const last = keys[keys.length - 1]
  if (t >= last[0]) return [last[1], last[2], last[3]]
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a[0] && t <= b[0]) {
      const span = b[0] - a[0]
      const u = span <= 1e-4 ? 1 : (t - a[0]) / span
      return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u]
    }
  }
  return [last[1], last[2], last[3]]
}

function smooth(u: number): number {
  return u * u * (3 - 2 * u)
}

/** "mm:ss" for a match-clock second count (minutes keep counting past 90). */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m < 10 ? "0" : ""}${m}:${r < 10 ? "0" : ""}${r}`
}

/** Cubic Bezier point. */
export function bezier(p0: vec3, p1: vec3, p2: vec3, p3: vec3, t: number): vec3 {
  const u = 1 - t
  return p0
    .uniformScale(u * u * u)
    .add(p1.uniformScale(3 * u * u * t))
    .add(p2.uniformScale(3 * u * t * t))
    .add(p3.uniformScale(t * t * t))
}
