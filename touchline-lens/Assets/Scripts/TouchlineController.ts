// TouchlineController — the state machine (LIVE / REPLAY, with Skip as an instant jump)
// and the single owner of match state: the simulated clock, the active replay, dimming.
// Expects: every view/UI @input wired by the scene bootstrap. Views never talk to each other;
// they report intent through events and receive state through setters from here.
// Must not: build geometry or UI itself.
import {Moment} from "./Data/MatchTypes"
import {MATCH} from "./Data/MatchData"
import {TouchlineAudioController} from "./TouchlineAudioController"
import {TouchlineFormationView} from "./TouchlineFormationView"
import {TouchlineMatchClock} from "./TouchlineMatchClock"
import {TouchlinePitchBuilder} from "./TouchlinePitchBuilder"
import {formatClock} from "./TouchlinePitchSpace"
import {TouchlinePlayerCardUI} from "./TouchlinePlayerCardUI"
import {ReplayFrame, TouchlineReplayPlayer} from "./TouchlineReplayPlayer"
import {TouchlineScoreboardUI} from "./TouchlineScoreboardUI"
import {TouchlineScrubberUI} from "./TouchlineScrubberUI"
import {TouchlineShotArc} from "./TouchlineShotArc"
import {TouchlineSkipUI} from "./TouchlineSkipUI"
import {TouchlineTimelineView} from "./TouchlineTimelineView"
import {scaleColor} from "./TouchlineVisuals"

export type TouchlineState = "LIVE" | "REPLAY"

@component
export class TouchlineController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TouchlineController – LIVE / REPLAY state machine</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Root of the virtual coffee table (its meshes dim during replays)")
  tableRoot: SceneObject
  @input
  @hint("Pitch builder (turf/lines/goals)")
  pitch: TouchlinePitchBuilder
  @input
  @hint("22 player tokens")
  formation: TouchlineFormationView
  @input
  @hint("Goal/shot timeline markers")
  timeline: TouchlineTimelineView
  @input
  @hint("Replay playback (ball + token tracks)")
  replay: TouchlineReplayPlayer
  @input
  @hint("Goal pop-out arc")
  shotArc: TouchlineShotArc
  @input
  @hint("Crowd roar / net audio")
  audio: TouchlineAudioController
  @input
  @hint("Score + LIVE clock label")
  scoreboard: TouchlineScoreboardUI
  @input
  @hint("Skip to next moment button")
  skip: TouchlineSkipUI
  @input
  @hint("Replay scrub slider")
  scrubber: TouchlineScrubberUI
  @input
  @hint("Player card")
  card: TouchlinePlayerCardUI
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Simulated clock start, match seconds (1290 = 21:30, 54 s before the first goal)")
  @widget(new SliderWidget(0, 7400, 1))
  startClockSec: number = 1290

  @input
  @hint("Simulated clock speed (match seconds per real second)")
  @widget(new SliderWidget(1, 60, 1))
  clockSpeed: number = 10

  @input
  @hint("Skip lands this many match seconds before the next marker")
  @widget(new SliderWidget(0, 15, 0.5))
  skipLeadSec: number = 3

  @input
  @hint("Table + pitch brightness during a replay (1 = no dimming)")
  @widget(new SliderWidget(0.2, 1, 0.05))
  replayDim: number = 0.6

  @input
  @hint("Seconds to hold on the net after a goal arc lands before returning to LIVE")
  @widget(new SliderWidget(0, 5, 0.1))
  goalHoldSec: number = 1.4

  @input
  @hint("Seconds to hold on the last frame of a non-goal replay")
  @widget(new SliderWidget(0, 5, 0.1))
  shotHoldSec: number = 0.8
  @ui.group_end

  private clock: TouchlineMatchClock
  private sorted: Moment[] = []
  private _state: TouchlineState = "LIVE"
  private active: Moment | null = null
  private endAt = -1
  private dimmed = false
  private tableParts: {rmv: RenderMeshVisual; color: vec4}[] = []

  // ── Readouts (used by LEAF scenarios) ──────────────────────────────────────
  get state(): TouchlineState {
    return this._state
  }
  get clockSec(): number {
    return this.clock ? this.clock.sec : 0
  }
  get isDimmed(): boolean {
    return this.dimmed
  }
  get activeMomentId(): string | null {
    return this.active ? this.active.id : null
  }
  /** Sorted moments (ascending sec). */
  get moments(): Moment[] {
    return this.sorted
  }

  onAwake(): void {
    this.sorted = MATCH.moments.slice().sort((a, b) => a.sec - b.sec)
    this.clock = new TouchlineMatchClock(this.startClockSec, this.clockSpeed, this.sorted, MATCH.endSec)
    // SIK / UIKit subscriptions bind in OnStart (SIK init order).
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  private onStart(): void {
    const missing = ["pitch", "formation", "timeline", "replay", "shotArc", "audio", "scoreboard", "skip", "scrubber", "card"].filter(
      (k) => !(this as unknown as Record<string, unknown>)[k],
    )
    if (missing.length) {
      print("[TouchlineController] unwired inputs: " + missing.join(", "))
      return
    }
    this.collectTableParts()
    this.timeline.onMarkerPinched.add((id) => this.onMarkerPinched(id))
    this.formation.onTokenPinched.add((pid) => this.onTokenPinched(pid))
    this.skip.onSkip.add(() => this.skipToNext())
    this.scrubber.onScrub.add((v) => this.onScrub(v))
    this.replay.onFrame.add((f) => this.onReplayFrame(f))
    this.replay.onShotReached.add((m) => this.onShotReached(m))
    this.replay.onFinished.add(() => (this.endAt = getTime() + this.shotHoldSec))
    this.shotArc.onLanded.add(() => this.onArcLanded())
    this.formation.showFormation(this.clock.sec)
    this.refreshLiveUI()
  }

  // ── Intents ────────────────────────────────────────────────────────────────
  /** Pinch on a timeline marker: replay it (pinching the active marker again ends the replay). */
  onMarkerPinched(id: string): void {
    if (this._state === "REPLAY" && this.active && this.active.id === id) {
      this.endReplay()
      return
    }
    const m = this.sorted.find((k) => k.id === id)
    if (m) this.startReplay(m)
  }

  /** Skip: jump the clock to (next marker − lead). Ends any replay first. */
  skipToNext(): void {
    if (this._state === "REPLAY") this.endReplay()
    const next = this.clock.nextMoment(this.skipLeadSec)
    if (!next) return
    this.clock.jumpTo(next.sec - this.skipLeadSec)
    this.formation.showFormation(this.clock.sec)
    this.refreshLiveUI()
  }

  private onTokenPinched(playerId: number): void {
    const p = MATCH.players.find((k) => k.id === playerId)
    const pos = this.formation.getTokenWorldPosition(playerId)
    if (!p || !pos) return
    const now = this.active ? this.active.sec : this.clock.sec
    const touches = p.touches.filter((s) => s <= now).length
    const kit = this.formation.kitFor(p.team, p.position === "Goalkeeper")
    this.card.showPlayer(p.id, p.number, p.short, p.position, touches, p.team === 0, pos, kit)
  }

  private onScrub(v: number): void {
    if (this._state !== "REPLAY") return
    const end = this.replay.endTime()
    const target = v * end
    if (Math.abs(target - this.replay.getTime()) < end * 0.02) return
    this.shotArc.cancel()
    this.endAt = -1
    this.replay.seek(target)
  }

  // ── State transitions ──────────────────────────────────────────────────────
  private startReplay(m: Moment): void {
    this.shotArc.cancel()
    this.active = m
    this._state = "REPLAY"
    this.endAt = -1
    this.clock.running = false
    this.setDim(true)
    this.timeline.setActive(m.id)
    this.card.hide()
    this.scrubber.show(`${formatClock(m.sec)} ${this.shortLabel(m)}`)
    this.scoreboard.setClock(`REPLAY ${formatClock(m.sec)} · ${this.shortLabel(m)}`, true)
    this.replay.play(m)
  }

  private endReplay(): void {
    this.replay.stop()
    this.shotArc.cancel()
    this.active = null
    this._state = "LIVE"
    this.endAt = -1
    this.clock.running = true
    this.setDim(false)
    this.timeline.setActive(null)
    this.scrubber.hide()
    this.formation.showFormation(this.clock.sec)
    this.refreshLiveUI()
  }

  private onReplayFrame(f: ReplayFrame): void {
    if (this._state !== "REPLAY") return
    this.formation.showReplayFrame(f.tokens, false)
    this.scrubber.setProgress(f.duration > 0 ? f.t / f.duration : 0)
  }

  private onShotReached(m: Moment): void {
    if (this._state !== "REPLAY") return
    this.shotArc.play(m.replay.shot.from, m.replay.shot.to)
  }

  private onArcLanded(): void {
    this.audio.playNet()
    this.audio.playRoar(true)
    this.endAt = getTime() + this.goalHoldSec
  }

  private tick(): void {
    if (!this.clock || !this.timeline) return
    if (this._state === "LIVE") {
      const crossed = this.clock.tick(getDeltaTime())
      for (const m of crossed) {
        this.timeline.pulse(m.id)
        this.audio.playRoar(m.isGoal)
      }
      if (crossed.length) this.formation.showFormation(this.clock.sec)
      this.refreshLiveUI()
    } else if (this.endAt > 0 && getTime() >= this.endAt) {
      this.endReplay()
    }
  }

  private refreshLiveUI(): void {
    let h = 0
    let a = 0
    for (const g of MATCH.goals) {
      if (g.sec <= this.clock.sec) {
        if (g.team === 0) h++
        else a++
      }
    }
    this.scoreboard.setScore(h, a)
    this.scoreboard.setClock(`LIVE ${formatClock(this.clock.sec)}`, false)
    this.timeline.setClock(this.clock.sec)
  }

  private shortLabel(m: Moment): string {
    const p = MATCH.players.find((k) => k.id === m.playerId)
    const who = p ? p.short : m.label
    return m.isGoal ? `${who} goal` : `${who} shot`
  }

  private setDim(on: boolean): void {
    this.dimmed = on
    const f = on ? this.replayDim : 1
    this.pitch.setDim(f)
    for (const p of this.tableParts) p.rmv.mainMaterial.mainPass.baseColor = scaleColor(p.color, f)
  }

  private collectTableParts(): void {
    if (!this.tableRoot) return
    const walk = (so: SceneObject) => {
      const rmv = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      if (rmv && rmv.mainMaterial) {
        rmv.mainMaterial = rmv.mainMaterial.clone()
        this.tableParts.push({rmv, color: rmv.mainMaterial.mainPass.baseColor})
      }
      for (let i = 0; i < so.getChildrenCount(); i++) walk(so.getChild(i))
    }
    walk(this.tableRoot)
  }
}
