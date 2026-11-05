// TouchlineGoalCelebration — the moment a goal arc lands: a burst of kit-coloured confetti out of
// the net and a "GOAL" banner that pops up over the goal, facing the user.
// Owns: the confetti pool and the banner. Lives under the pitch space (pitch-local cm), like
// TouchlineShotArc. Must not: play audio or change state itself.
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import {PITCH_LEN_CM} from "./TouchlinePitchSpace"
import {addBox, Kit, tinted} from "./TouchlineVisuals"

interface Bit {
  so: SceneObject
  pos: vec3
  vel: vec3
  size: number
}

@component
export class TouchlineGoalCelebration extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TouchlineGoalCelebration – confetti + GOAL banner</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Unlit base material for the confetti")
  unlitMaterial: Material

  @input
  @hint("Sphere mesh for the confetti")
  sphereMesh: RenderMesh
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Number of confetti bits")
  @widget(new SliderWidget(6, 60, 1))
  bitCount: number = 50

  @input
  @hint("Confetti launch speed, cm/s")
  @widget(new SliderWidget(10, 120, 1))
  launchSpeed: number = 65

  @input
  @hint("Gravity on the confetti, cm/s²")
  @widget(new SliderWidget(0, 300, 5))
  gravity: number = 110

  @input
  @hint("How long the celebration lasts, seconds")
  @widget(new SliderWidget(0.5, 4, 0.1))
  durationSec: number = 1.6

  @input
  @hint("Banner text")
  bannerText: string = "GOAL!"

  @input
  @hint("Banner text size")
  @widget(new SliderWidget(40, 1200, 10))
  bannerSize: number = 260

  @input
  @hint("Banner height above the goal, cm")
  @widget(new SliderWidget(2, 30, 0.5))
  bannerLiftCm: number = 9
  @ui.group_end

  private bits: Bit[] = []
  private mats: Material[] = []
  private banner: SceneObject
  private bannerText_: Text
  private start = -1

  onAwake(): void {
    if (!this.unlitMaterial || !this.sphereMesh) {
      print("[TouchlineGoalCelebration] missing material/mesh inputs")
      return
    }
    // Two tint slots (shirt / stripe), recoloured per goal.
    this.mats = [tinted(this.unlitMaterial, vec4.one()), tinted(this.unlitMaterial, vec4.one())]
    for (let i = 0; i < this.bitCount; i++) {
      const so = global.scene.createSceneObject(`Confetti${i}`)
      so.setParent(this.sceneObject)
      addBox(so, "Bit", this.sphereMesh, this.mats[i % 2], vec3.one(), vec3.zero())
      so.enabled = false
      this.bits.push({so, pos: vec3.zero(), vel: vec3.zero(), size: 0.5})
    }
    // "GoalBanner" is the LEAF lookup contract.
    this.banner = global.scene.createSceneObject("GoalBanner")
    this.banner.setParent(this.sceneObject)
    const bb = this.banner.createComponent(Billboard.getTypeName()) as Billboard
    bb.xAxisEnabled = true
    bb.yAxisEnabled = true
    const textSO = global.scene.createSceneObject("GoalBannerText")
    textSO.setParent(this.banner)
    const t = textSO.createComponent("Component.Text") as Text
    t.text = this.bannerText
    t.size = this.bannerSize
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.depthTest = false
    this.bannerText_ = t
    this.banner.enabled = false
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  /** Celebrate a goal that landed at `at` (pitch-local cm) for the team wearing `kit`. */
  play(at: vec3, kit: Kit): void {
    if (!this.banner) return
    this.mats[0].mainPass.baseColor = kit.shirt
    this.mats[1].mainPass.baseColor = kit.striped ? kit.stripe : kit.shorts
    this.bannerText_.textFill.color = kit.shirt
    // Spray back out of the net, toward the pitch and up.
    const back = at.x >= 0 ? -1 : 1
    for (const b of this.bits) {
      const yaw = (Math.random() - 0.5) * Math.PI * 0.9
      const up = 0.6 + Math.random() * 0.9
      const dir = new vec3(back * Math.cos(yaw), up, Math.sin(yaw)).normalize()
      b.pos = at
      b.vel = dir.uniformScale(this.launchSpeed * (0.55 + Math.random() * 0.6))
      b.size = 0.5 + Math.random() * 0.5
      b.so.enabled = true
    }
    const goalX = (at.x >= 0 ? 1 : -1) * (PITCH_LEN_CM / 2)
    this.banner.getTransform().setLocalPosition(new vec3(goalX * 0.8, this.bannerLiftCm, 0))
    this.banner.enabled = true
    this.start = getTime()
    this.tick()
  }

  cancel(): void {
    this.start = -1
    for (const b of this.bits) b.so.enabled = false
    if (this.banner) this.banner.enabled = false
  }

  isPlaying(): boolean {
    return this.start >= 0
  }

  private tick(): void {
    if (this.start < 0) return
    const dt = Math.min(getDeltaTime(), 0.05)
    const age = (getTime() - this.start) / this.durationSec
    if (age >= 1) {
      this.cancel()
      return
    }
    const fade = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3
    for (const b of this.bits) {
      b.vel = new vec3(b.vel.x * 0.985, b.vel.y - this.gravity * dt, b.vel.z * 0.985)
      b.pos = b.pos.add(b.vel.uniformScale(dt))
      if (b.pos.y < 0.2) {
        b.pos = new vec3(b.pos.x, 0.2, b.pos.z)
        b.vel = new vec3(b.vel.x * 0.5, 0, b.vel.z * 0.5)
      }
      const t = b.so.getTransform()
      t.setLocalPosition(b.pos)
      const s = b.size * fade
      t.setLocalScale(new vec3(s, s, s))
    }
    // Banner: overshoot pop on the way in, then fade out with the confetti.
    const pop = age < 0.15 ? 1.25 * (age / 0.15) : age < 0.25 ? 1.25 - (age - 0.15) * 2.5 : 1
    const bs = Math.max(0.01, pop * fade)
    this.banner.getTransform().setLocalScale(new vec3(bs, bs, bs))
  }
}
