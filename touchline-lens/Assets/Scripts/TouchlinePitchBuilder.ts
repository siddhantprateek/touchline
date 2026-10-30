// TouchlinePitchBuilder — builds the 60 x 40 cm miniature pitch (turf, markings, goals)
// under its own SceneObject. Regular geometry derived from the pitch standard, so it is
// script-built under the authored "Pitch" root (Hard Rule 5: regular content).
// Owns: pitch visuals and their dimming. Must not: know about match state.
import {PITCH_LEN_CM, PITCH_WID_CM, SB_TO_CM, TURF_TOP_CM} from "./TouchlinePitchSpace"
import {addBox, scaleColor, tinted} from "./TouchlineVisuals"

const LINE_H = 0.06

@component
export class TouchlinePitchBuilder extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TouchlinePitchBuilder – turf, lines, goals</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Unlit base material (cloned and tinted per part)")
  unlitMaterial: Material

  @input
  @hint("Box mesh used for turf, lines and goal frames")
  boxMesh: RenderMesh

  @input
  @hint("Sphere/cylinder-free spots are drawn with this mesh")
  sphereMesh: RenderMesh
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input('vec4', '{0.16,0.52,0.22,1}')
  @widget(new ColorWidget())
  @hint("Turf colour (mid green — the display is additive, keep it bright enough)")
  turfColor: vec4

  @input('vec4', '{0.2,0.6,0.26,1}')
  @widget(new ColorWidget())
  @hint("Colour of the alternate mowing stripes")
  stripeColor: vec4

  @input('vec4', '{0.92,0.95,0.92,1}')
  @widget(new ColorWidget())
  @hint("Pitch line colour")
  lineColor: vec4

  @input('vec4', '{0.4,0.42,0.45,1}')
  @widget(new ColorWidget())
  @hint("Goal net colour (faint on an additive display)")
  netColor: vec4

  @input
  @hint("Line width in cm")
  @widget(new SliderWidget(0.1, 0.6, 0.01))
  lineWidthCm: number = 0.22

  @input
  @hint("Visual goal height multiplier (1 = true scale, 1.33 cm)")
  @widget(new SliderWidget(1, 3, 0.05))
  goalHeightScale: number = 1.5
  @ui.group_end

  private parts: {rmv: RenderMeshVisual; color: vec4}[] = []
  private dim = 1

  onAwake(): void {
    if (!this.unlitMaterial || !this.boxMesh) {
      print("[TouchlinePitchBuilder] missing unlitMaterial/boxMesh input")
      return
    }
    this.build()
  }

  /** Multiply all pitch colours by f (1 = normal, ~0.6 = dimmed during replays). */
  setDim(f: number): void {
    this.dim = f
    for (const p of this.parts) p.rmv.mainMaterial.mainPass.baseColor = scaleColor(p.color, f)
  }

  getDim(): number {
    return this.dim
  }

  private part(name: string, mesh: RenderMesh, color: vec4, size: vec3, center: vec3): RenderMeshVisual {
    const rmv = addBox(this.sceneObject, name, mesh, tinted(this.unlitMaterial, color), size, center)
    this.parts.push({rmv, color})
    return rmv
  }

  private line(name: string, x0: number, z0: number, x1: number, z1: number): void {
    const w = this.lineWidthCm
    const y = TURF_TOP_CM + LINE_H / 2
    if (Math.abs(z1 - z0) < 1e-4) {
      this.part(name, this.boxMesh, this.lineColor, new vec3(Math.abs(x1 - x0) + w, LINE_H, w), new vec3((x0 + x1) / 2, y, z0))
    } else {
      this.part(name, this.boxMesh, this.lineColor, new vec3(w, LINE_H, Math.abs(z1 - z0) + w), new vec3(x0, y, (z0 + z1) / 2))
    }
  }

  private build(): void {
    const L = PITCH_LEN_CM / 2
    const W = PITCH_WID_CM / 2
    // Turf (named "Turf" — LEAF test contract) + six mowing stripes on top.
    this.part("Turf", this.boxMesh, this.turfColor, new vec3(PITCH_LEN_CM, TURF_TOP_CM, PITCH_WID_CM), new vec3(0, TURF_TOP_CM / 2, 0))
    const stripes = 6
    for (let i = 0; i < stripes; i += 2) {
      const w = PITCH_LEN_CM / stripes
      const cx = -L + w * (i + 0.5)
      this.part(`Stripe${i}`, this.boxMesh, this.stripeColor, new vec3(w, 0.02, PITCH_WID_CM), new vec3(cx, TURF_TOP_CM + 0.01, 0))
    }
    // Touchlines, goal lines, halfway line.
    this.line("NearTouchline", -L, W, L, W)
    this.line("FarTouchline", -L, -W, L, -W)
    this.line("LeftGoalLine", -L, -W, -L, W)
    this.line("RightGoalLine", L, -W, L, W)
    this.line("HalfwayLine", 0, -W, 0, W)
    // Penalty areas (18 yd deep, 44 yd wide) and goal areas (6 yd deep, 20 yd wide).
    for (const side of [-1, 1]) {
      const gx = side * L
      const box = (deep: number, wide: number, tag: string) => {
        const d = deep * SB_TO_CM
        const hw = (wide / 2) * SB_TO_CM
        const ix = gx - side * d
        this.line(`${tag}Front${side}`, ix, -hw, ix, hw)
        this.line(`${tag}SideA${side}`, Math.min(gx, ix), -hw, Math.max(gx, ix), -hw)
        this.line(`${tag}SideB${side}`, Math.min(gx, ix), hw, Math.max(gx, ix), hw)
      }
      box(18, 44, "PenaltyBox")
      box(6, 20, "GoalBox")
      if (this.sphereMesh) {
        const spotX = gx - side * 12 * SB_TO_CM
        this.part(`PenaltySpot${side}`, this.sphereMesh, this.lineColor, new vec3(0.4, 0.06, 0.4), new vec3(spotX, TURF_TOP_CM + 0.03, 0))
      }
      this.buildGoal(side)
    }
    // Centre circle (10 yd radius) as short segments + centre spot.
    const r = 10 * SB_TO_CM
    const segs = 28
    for (let i = 0; i < segs; i++) {
      const a = ((i + 0.5) / segs) * Math.PI * 2
      const segLen = (2 * Math.PI * r) / segs + 0.05
      const so = this.part(`Circle${i}`, this.boxMesh, this.lineColor, new vec3(segLen, LINE_H, this.lineWidthCm), vec3.zero())
      const t = so.getSceneObject().getTransform()
      const p = new vec3(Math.cos(a) * r, TURF_TOP_CM + LINE_H / 2, Math.sin(a) * r)
      t.setLocalPosition(p.add(t.getLocalPosition()))
      t.setLocalRotation(quat.angleAxis(-a + Math.PI / 2, vec3.up()))
    }
    if (this.sphereMesh) {
      this.part("CentreSpot", this.sphereMesh, this.lineColor, new vec3(0.45, 0.06, 0.45), new vec3(0, TURF_TOP_CM + 0.03, 0))
    }
  }

  private buildGoal(side: number): void {
    const L = PITCH_LEN_CM / 2
    const halfW = 4 * SB_TO_CM // posts at y = 36 / 44
    const h = 2.67 * SB_TO_CM * this.goalHeightScale
    const depth = 1.2
    const post = 0.18
    const base = TURF_TOP_CM
    const x = side * L
    const backX = x + side * depth
    for (const z of [-halfW, halfW]) {
      this.part(`GoalPost${side}_${z}`, this.boxMesh, this.lineColor, new vec3(post, h, post), new vec3(x, base + h / 2, z))
    }
    this.part(`Crossbar${side}`, this.boxMesh, this.lineColor, new vec3(post, post, halfW * 2 + post), new vec3(x, base + h, 0))
    // Net: back panel, roof, two side panels (thin, faint).
    this.part(`NetBack${side}`, this.boxMesh, this.netColor, new vec3(0.05, h, halfW * 2), new vec3(backX, base + h / 2, 0))
    this.part(`NetRoof${side}`, this.boxMesh, this.netColor, new vec3(depth, 0.05, halfW * 2), new vec3((x + backX) / 2, base + h, 0))
    for (const z of [-halfW, halfW]) {
      this.part(`NetSide${side}_${z}`, this.boxMesh, this.netColor, new vec3(depth, h, 0.05), new vec3((x + backX) / 2, base + h / 2, z))
    }
  }
}
