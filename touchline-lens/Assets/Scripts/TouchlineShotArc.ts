// TouchlineShotArc — goal-only pop-out: the ball leaves the table on a cubic Bezier (peak
// above the table, bulging toward the user) and drops back into the net, with a trail.
// Owns: the arc ball, trail pool, arc timing, and the measured peak/landing (read by tests).
// Emits onLanded. Must not: play audio or change state itself.
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {bezier, PITCH_LEN_CM, toLocal} from "./TouchlinePitchSpace"
import {addBox, tinted} from "./TouchlineVisuals"

@component
export class TouchlineShotArc extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TouchlineShotArc – goal pop-out arc into the room</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Unlit base material for ball and trail")
  unlitMaterial: Material

  @input
  @hint("Sphere mesh for ball and trail beads")
  sphereMesh: RenderMesh
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Arc duration in seconds")
  @widget(new SliderWidget(0.6, 4, 0.05))
  durationSec: number = 1.6

  @input
  @hint("Peak height above the table, cm")
  @widget(new SliderWidget(5, 60, 1))
  peakHeightCm: number = 25

  @input
  @hint("How far the arc bulges toward the user, cm")
  @widget(new SliderWidget(0, 40, 1))
  towardUserCm: number = 15

  @input
  @hint("Ball diameter at the peak, cm (grows from the table-size ball)")
  @widget(new SliderWidget(0.5, 4, 0.05))
  peakBallDiameterCm: number = 2.2

  @input
  @hint("Ball diameter on the table, cm")
  @widget(new SliderWidget(0.4, 2.5, 0.05))
  ballDiameterCm: number = 1

  @input
  @hint("How deep into the net the ball lands, cm")
  @widget(new SliderWidget(0, 1.2, 0.05))
  netDepthCm: number = 0.7

  @input
  @hint("Number of trail beads")
  @widget(new SliderWidget(4, 40, 1))
  trailCount: number = 22

  @input
  @hint("Trail bead lifetime, seconds")
  @widget(new SliderWidget(0.1, 2, 0.05))
  trailLifeSec: number = 0.7

  @input('vec4', '{1,1,1,1}')
  @widget(new ColorWidget())
  @hint("Arc ball colour")
  ballColor: vec4

  @input('vec4', '{1,0.85,0.4,1}')
  @widget(new ColorWidget())
  @hint("Trail colour")
  trailColor: vec4
  @ui.group_end

  /** Highest ball height above the table reached by the last arc, cm (test readout). */
  lastPeakCm = 0
  /** Pitch-local landing point of the last arc (test readout). */
  lastLanding: vec3 = vec3.zero()

  private ball: SceneObject
  private trail: {so: SceneObject; born: number}[] = []
  private trailIdx = 0
  private lastDrop = 0
  private start = -1
  private p0 = vec3.zero()
  private p1 = vec3.zero()
  private p2 = vec3.zero()
  private p3 = vec3.zero()
  private readonly landedEvent = new Event<void>()

  get onLanded(): PublicApi<void> {
    return this.landedEvent.publicApi()
  }

  onAwake(): void {
    if (!this.unlitMaterial || !this.sphereMesh) {
      print("[TouchlineShotArc] missing material/mesh inputs")
      return
    }
    // "ShotArcBall" is the LEAF lookup contract.
    this.ball = global.scene.createSceneObject("ShotArcBall")
    this.ball.setParent(this.sceneObject)
    addBox(this.ball, "ArcBallVisual", this.sphereMesh, tinted(this.unlitMaterial, this.ballColor), vec3.one(), vec3.zero())
    this.ball.enabled = false
    const trailMat = tinted(this.unlitMaterial, this.trailColor)
    for (let i = 0; i < this.trailCount; i++) {
      const so = global.scene.createSceneObject(`Trail${i}`)
      so.setParent(this.sceneObject)
      addBox(so, "Bead", this.sphereMesh, trailMat, new vec3(0.6, 0.6, 0.6), vec3.zero())
      so.enabled = false
      this.trail.push({so, born: -1})
    }
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  /** Start the arc from a StatsBomb shot origin to the StatsBomb end point (x, y, z). */
  play(from: [number, number], to: [number, number, number]): void {
    if (!this.ball) return
    this.p0 = toLocal(from[0], from[1], 0, this.ballDiameterCm / 2)
    const end = toLocal(to[0], to[1], to[2], this.ballDiameterCm / 2)
    const side = to[0] >= 60 ? 1 : -1
    this.p3 = new vec3(side * (PITCH_LEN_CM / 2 + this.netDepthCm), end.y, end.z)
    // Equal-height control points: cubic peak = 0.75 * control height above the endpoints.
    const ctrlUp = (this.peakHeightCm - Math.max(this.p0.y, this.p3.y)) / 0.75
    const ctrlToward = this.towardUserCm / 0.75
    const a = vec3.lerp(this.p0, this.p3, 0.25)
    const b = vec3.lerp(this.p0, this.p3, 0.75)
    this.p1 = new vec3(a.x, Math.max(this.p0.y, this.p3.y) + ctrlUp, a.z + ctrlToward)
    this.p2 = new vec3(b.x, Math.max(this.p0.y, this.p3.y) + ctrlUp, b.z + ctrlToward)
    this.start = getTime()
    this.lastDrop = 0
    this.lastPeakCm = 0
    this.ball.enabled = true
    this.place(0)
  }

  cancel(): void {
    this.start = -1
    if (this.ball) this.ball.enabled = false
    for (const b of this.trail) {
      b.so.enabled = false
      b.born = -1
    }
  }

  isPlaying(): boolean {
    return this.start >= 0
  }

  private place(u: number): void {
    const p = bezier(this.p0, this.p1, this.p2, this.p3, u)
    const t = this.ball.getTransform()
    t.setLocalPosition(p)
    const grow = Math.sin(u * Math.PI)
    const d = this.ballDiameterCm + (this.peakBallDiameterCm - this.ballDiameterCm) * grow
    t.setLocalScale(new vec3(d, d, d))
    if (p.y > this.lastPeakCm) this.lastPeakCm = p.y
  }

  private tick(): void {
    const now = getTime()
    for (const b of this.trail) {
      if (b.born < 0) continue
      const age = (now - b.born) / this.trailLifeSec
      if (age >= 1) {
        b.so.enabled = false
        b.born = -1
        continue
      }
      const s = 1 - age
      b.so.getTransform().setLocalScale(new vec3(s, s, s))
    }
    if (this.start < 0) return
    const u = Math.min(1, (now - this.start) / this.durationSec)
    this.place(u)
    if (now - this.lastDrop > this.durationSec / this.trailCount) {
      this.lastDrop = now
      const bead = this.trail[this.trailIdx % this.trail.length]
      this.trailIdx++
      bead.so.enabled = true
      bead.born = now
      bead.so.getTransform().setLocalPosition(this.ball.getTransform().getLocalPosition())
    }
    if (u >= 1) {
      this.start = -1
      this.lastLanding = this.ball.getTransform().getLocalPosition()
      this.landedEvent.invoke()
    }
  }
}
