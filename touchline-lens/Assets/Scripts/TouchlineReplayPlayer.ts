// TouchlineReplayPlayer — plays one moment's reconstructed replay: advances replay time,
// samples the ball + 22 token tracks, owns the replay ball visual.
// Emits onFrame (token placements for the controller to push to the formation view),
// onShotReached (goal replays freeze at the shot so the pop-out arc can take over) and
// onFinished. Must not: touch the clock, UI or other views directly.
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Moment} from "./Data/MatchTypes"
import {TokenPlacement} from "./TouchlineFormationView"
import {sampleKey2, sampleKey3, toLocal} from "./TouchlinePitchSpace"
import {addBox, tinted} from "./TouchlineVisuals"

export interface ReplayFrame {
  t: number
  duration: number
  tokens: TokenPlacement[]
}

@component
export class TouchlineReplayPlayer extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TouchlineReplayPlayer – reconstructed move playback</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Unlit base material for the ball")
  unlitMaterial: Material

  @input
  @hint("Sphere mesh for the ball")
  sphereMesh: RenderMesh
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Replay speed (1 = real time)")
  @widget(new SliderWidget(0.25, 3, 0.05))
  playbackRate: number = 1

  @input
  @hint("Ball diameter, cm (true scale would be 0.1 cm — exaggerated so it reads)")
  @widget(new SliderWidget(0.4, 2.5, 0.05))
  ballDiameterCm: number = 1

  @input('vec4', '{1,1,1,1}')
  @widget(new ColorWidget())
  @hint("Ball colour")
  ballColor: vec4
  @ui.group_end

  private moment: Moment | null = null
  private t = 0
  private playing = false
  private shotT = Infinity
  private shotFired = false
  private ball: SceneObject
  private readonly frameEvent = new Event<ReplayFrame>()
  private readonly shotEvent = new Event<Moment>()
  private readonly finishedEvent = new Event<Moment>()

  get onFrame(): PublicApi<ReplayFrame> {
    return this.frameEvent.publicApi()
  }
  get onShotReached(): PublicApi<Moment> {
    return this.shotEvent.publicApi()
  }
  get onFinished(): PublicApi<Moment> {
    return this.finishedEvent.publicApi()
  }

  onAwake(): void {
    if (this.unlitMaterial && this.sphereMesh) {
      // "ReplayBall" is the LEAF lookup contract.
      this.ball = global.scene.createSceneObject("ReplayBall")
      this.ball.setParent(this.sceneObject)
      const d = this.ballDiameterCm
      addBox(this.ball, "BallVisual", this.sphereMesh, tinted(this.unlitMaterial, this.ballColor), new vec3(d, d, d), vec3.zero())
      this.ball.enabled = false
    }
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  play(m: Moment): void {
    this.moment = m
    this.t = 0
    this.playing = true
    this.shotFired = false
    this.shotT = m.isGoal ? this.findShotTime(m) : Infinity
    if (this.ball) this.ball.enabled = true
    this.emitFrame(true)
  }

  stop(): void {
    this.playing = false
    this.moment = null
    if (this.ball) this.ball.enabled = false
  }

  /** Jump to a time in seconds (from the scrubber). Re-arms the shot for goal replays. */
  seek(t: number): void {
    if (!this.moment) return
    const end = this.endTime()
    this.t = Math.max(0, Math.min(end, t))
    if (this.t < this.shotT) this.shotFired = false
    this.playing = true
    if (this.ball) this.ball.enabled = true
    this.emitFrame(true)
  }

  isPlaying(): boolean {
    return this.playing
  }
  getTime(): number {
    return this.t
  }
  getMoment(): Moment | null {
    return this.moment
  }
  /** Playable length: goal replays end at the shot (the arc takes over). */
  endTime(): number {
    if (!this.moment) return 0
    return this.moment.isGoal ? Math.min(this.shotT, this.moment.replay.durationSec) : this.moment.replay.durationSec
  }
  hideBall(): void {
    if (this.ball) this.ball.enabled = false
  }
  getBallLocalPosition(): vec3 {
    return this.ball ? this.ball.getTransform().getLocalPosition() : vec3.zero()
  }

  private findShotTime(m: Moment): number {
    const keys = m.replay.ball
    const [fx, fy] = m.replay.shot.from
    for (let i = keys.length - 2; i >= 0; i--) {
      if (Math.abs(keys[i][1] - fx) < 0.6 && Math.abs(keys[i][2] - fy) < 0.6) return keys[i][0]
    }
    return keys.length >= 2 ? keys[keys.length - 2][0] : m.replay.durationSec
  }

  private tick(): void {
    if (!this.playing || !this.moment) return
    this.t += getDeltaTime() * this.playbackRate
    const end = this.endTime()
    if (this.t >= end) this.t = end
    this.emitFrame(false)
    if (this.moment.isGoal && !this.shotFired && this.t >= this.shotT - 1e-4) {
      this.shotFired = true
      this.playing = false
      this.hideBall()
      this.shotEvent.invoke(this.moment)
      return
    }
    if (!this.moment.isGoal && this.t >= end) {
      this.playing = false
      const m = this.moment
      this.finishedEvent.invoke(m)
    }
  }

  private emitFrame(snap: boolean): void {
    const m = this.moment
    if (!m) return
    const [bx, by, bz] = sampleKey3(m.replay.ball, this.t)
    if (this.ball) this.ball.getTransform().setLocalPosition(toLocal(bx, by, bz, this.ballDiameterCm / 2))
    const tokens: TokenPlacement[] = m.replay.tokens.slice(0, 22).map((tk) => {
      const [x, y] = sampleKey2(tk.keys, this.t)
      return {team: tk.team, playerId: tk.playerId, x, y}
    })
    this.frameEvent.invoke({t: this.t, duration: this.endTime(), tokens})
    void snap
  }
}
