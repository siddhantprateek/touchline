// TouchlineMatchClock — the simulated match clock (stand-in for broadcast sync).
// Owns: current match second, running/paused flag, speed, moment-crossing detection.
// Must not: touch the scene or play audio. The controller owns the instance and reacts
// to the moments it reports.
import {Moment} from "./Data/MatchTypes"

export class TouchlineMatchClock {
  sec: number
  speed: number
  running = true
  private readonly moments: Moment[]
  private readonly endSec: number

  /** @param moments must be sorted by sec ascending. */
  constructor(startSec: number, speed: number, moments: Moment[], endSec: number) {
    this.sec = startSec
    this.speed = speed
    this.moments = moments
    this.endSec = endSec
  }

  /** Advance by real seconds; returns the moments whose sec was crossed this tick. */
  tick(realDt: number): Moment[] {
    if (!this.running) return []
    const prev = this.sec
    this.sec = Math.min(this.endSec, this.sec + realDt * this.speed)
    const crossed: Moment[] = []
    for (const m of this.moments) {
      if (m.sec > prev && m.sec <= this.sec) crossed.push(m)
    }
    return crossed
  }

  /** The first moment that is still ahead of a jump target (sec - leadSec > now). */
  nextMoment(leadSec: number): Moment | null {
    for (const m of this.moments) {
      if (m.sec - leadSec > this.sec + 0.01) return m
    }
    return null
  }

  jumpTo(sec: number): void {
    this.sec = Math.max(0, Math.min(this.endSec, sec))
  }
}

