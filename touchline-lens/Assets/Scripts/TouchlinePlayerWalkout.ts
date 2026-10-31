// TouchlinePlayerWalkout — FIFA-style walk-out: a small stylised figure in the player's kit
// (face, hair, number front and back) steps off his token and walks toward the viewer to a
// line-up spot at the table's near edge, where it stands under the player card.
// Owns: the figure's geometry, walk animation and lifetime. Passive: the controller calls
// walkOut()/stop(). Must not: read match data or decide state. No real photos are used
// (none are licensed); the face is a generic stylised one.
import {addBox, scaleColor, tinted} from "./TouchlineVisuals"

export interface Kit {
  shirt: vec4
  shorts: vec4
  stripe: vec4
  /** Stripes shown on the shirt (outfield only). */
  striped: boolean
}

interface Figure {
  root: SceneObject
  armL: SceneObject
  armR: SceneObject
  legL: SceneObject
  legR: SceneObject
  head: SceneObject
  parts: {rmv: RenderMeshVisual; color: vec4}[]
}

@component
export class TouchlinePlayerWalkout extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TouchlinePlayerWalkout – player walks toward you</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Unlit base material (cloned per part)")
  unlitMaterial: Material

  @input
  @hint("Cylinder mesh (limbs, torso)")
  cylinderMesh: RenderMesh

  @input
  @hint("Sphere mesh (head, hair, eyes)")
  sphereMesh: RenderMesh
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Figure height in cm")
  @widget(new SliderWidget(6, 24, 0.5))
  heightCm: number = 11

  @input
  @hint("Line-up spot: distance toward the viewer from the pitch centre, cm (pitch is 40 cm wide, so ~31 is just past the near edge)")
  @widget(new SliderWidget(20, 50, 1))
  arriveZCm: number = 31

  @input
  @hint("Line-up spot height above the turf, cm")
  @widget(new SliderWidget(0, 15, 0.5))
  arriveYCm: number = 1

  @input
  @hint("Seconds the walk takes")
  @widget(new SliderWidget(0.6, 4, 0.1))
  walkSec: number = 1.7

  @input
  @hint("Leg and arm swing speed while walking")
  @widget(new SliderWidget(4, 20, 0.5))
  stepRate: number = 11

  @input('vec4', '{1,0.78,0.62,1}')
  @widget(new ColorWidget())
  @hint("Skin tone (stylised; bright, because dark vanishes on the additive display)")
  skinColor: vec4

  @input('vec4', '{0.55,0.36,0.2,1}')
  @widget(new ColorWidget())
  @hint("Hair colour")
  hairColor: vec4

  @input('vec4', '{1,1,1,1}')
  @widget(new ColorWidget())
  @hint("Socks, eye whites and shirt numbers")
  whiteColor: vec4

  @input('vec4', '{0.25,0.45,1,1}')
  @widget(new ColorWidget())
  @hint("Pupils (blue; dark would disappear)")
  pupilColor: vec4
  @ui.group_end

  private fig: Figure | null = null
  private startLocal = vec3.zero()
  private startedAt = -1
  private active = false
  private dim = 1

  onAwake(): void {
    if (!this.unlitMaterial || !this.cylinderMesh || !this.sphereMesh) {
      print("[TouchlinePlayerWalkout] missing material/mesh input")
      return
    }
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  /** Start a walk-out from `startWorld` (the pinched token) in the given kit. */
  walkOut(startWorld: vec3, kit: Kit, shirtNumber: number): void {
    if (!this.unlitMaterial || !this.cylinderMesh || !this.sphereMesh) return
    this.stop()
    this.fig = this.build(kit, shirtNumber)
    const local = this.sceneObject.getTransform().getInvertedWorldTransform().multiplyPoint(startWorld)
    this.startLocal = new vec3(local.x, local.y - 0.3, local.z)
    this.startedAt = getTime()
    this.active = true
    this.fig.root.getTransform().setLocalPosition(this.startLocal)
    this.fig.root.getTransform().setLocalScale(vec3.one().uniformScale(0.3))
  }

  stop(): void {
    this.active = false
    this.startedAt = -1
    if (this.fig) {
      this.fig.root.destroy()
      this.fig = null
    }
  }

  setDim(f: number): void {
    this.dim = f
  }

  isWalking(): boolean {
    return this.active && this.fig !== null
  }

  /** World position where the figure's feet end up. */
  getArrivalWorld(): vec3 {
    return this.sceneObject.getTransform().getWorldTransform().multiplyPoint(this.arrival())
  }

  /** World position of the top of the figure's head at the line-up spot. */
  getHeadTopWorld(): vec3 {
    return this.getArrivalWorld().add(new vec3(0, this.heightCm, 0))
  }

  /** Walk progress 0..1 (read by tests). */
  get progress(): number {
    if (!this.active || this.startedAt < 0) return 0
    return Math.min(1, (getTime() - this.startedAt) / this.walkSec)
  }

  private arrival(): vec3 {
    return new vec3(0, 0.4 + this.arriveYCm, this.arriveZCm)
  }

  private tick(): void {
    if (!this.active || !this.fig) return
    const u = this.progress
    const e = u * u * (3 - 2 * u)
    const t = this.fig.root.getTransform()
    t.setLocalPosition(vec3.lerp(this.startLocal, this.arrival(), e))
    t.setLocalScale(vec3.one().uniformScale(0.3 + 0.7 * Math.min(1, e * 1.6)))
    const walking = u < 1
    const swing = walking ? Math.sin((getTime() - this.startedAt) * this.stepRate) * 0.55 : 0
    this.fig.legL.getTransform().setLocalRotation(quat.angleAxis(swing, vec3.right()))
    this.fig.legR.getTransform().setLocalRotation(quat.angleAxis(-swing, vec3.right()))
    this.fig.armL.getTransform().setLocalRotation(quat.angleAxis(-swing * 0.9, vec3.right()))
    this.fig.armR.getTransform().setLocalRotation(quat.angleAxis(swing * 0.9, vec3.right()))
    const sway = walking ? 0 : Math.sin(getTime() * 1.6) * 0.04
    this.fig.head.getTransform().setLocalRotation(quat.angleAxis(sway, vec3.up()))
  }

  private build(kit: Kit, shirtNumber: number): Figure {
    const k = this.heightCm / 14 // dimensions below are written for a 14 cm figure
    const root = global.scene.createSceneObject("WalkoutFigure")
    root.setParent(this.sceneObject)
    const parts: {rmv: RenderMeshVisual; color: vec4}[] = []
    const add = (parent: SceneObject, name: string, mesh: RenderMesh, color: vec4, size: vec3, center: vec3): void => {
      const rmv = addBox(parent, name, mesh, tinted(this.unlitMaterial, scaleColor(color, this.dim)), size.uniformScale(k), center.uniformScale(k))
      parts.push({rmv, color})
    }
    const pivot = (name: string, parent: SceneObject, pos: vec3): SceneObject => {
      const so = global.scene.createSceneObject(name)
      so.setParent(parent)
      so.getTransform().setLocalPosition(pos.uniformScale(k))
      return so
    }
    const cyl = this.cylinderMesh
    const sph = this.sphereMesh

    // Legs hang from hip pivots at y = 4.6: white sock + shorts-coloured boot.
    const legL = pivot("LegL", root, new vec3(-0.85, 4.6, 0))
    const legR = pivot("LegR", root, new vec3(0.85, 4.6, 0))
    for (const leg of [legL, legR]) {
      add(leg, "Sock", cyl, this.whiteColor, new vec3(1.5, 4.0, 1.5), new vec3(0, -2.3, 0))
      add(leg, "Boot", cyl, kit.shorts, new vec3(1.7, 0.6, 2.3), new vec3(0, -4.3, 0.3))
    }
    add(root, "Shorts", cyl, kit.shorts, new vec3(4.2, 2.2, 3.0), new vec3(0, 5.2, 0))
    add(root, "Shirt", cyl, kit.shirt, new vec3(4.4, 4.4, 3.1), new vec3(0, 8.4, 0))
    if (kit.striped) {
      for (const x of [-1.5, -0.5, 0.5, 1.5]) {
        add(root, "Stripe", cyl, kit.stripe, new vec3(0.35, 4.3, 3.2), new vec3(x, 8.4, 0))
      }
    }
    // Arms swing from the shoulders at y = 10.3: sleeve in shirt colour, hand in skin.
    const armL = pivot("ArmL", root, new vec3(-2.55, 10.3, 0))
    const armR = pivot("ArmR", root, new vec3(2.55, 10.3, 0))
    for (const arm of [armL, armR]) {
      add(arm, "Sleeve", cyl, kit.shirt, new vec3(1.1, 2.2, 1.1), new vec3(0, -1.1, 0))
      add(arm, "Hand", sph, this.skinColor, new vec3(1.0, 1.0, 1.0), new vec3(0, -2.7, 0))
    }
    // Head: skin sphere, hair cap on top/back, simple face on +Z (toward the viewer).
    const head = pivot("Head", root, new vec3(0, 12.2, 0))
    add(head, "Face", sph, this.skinColor, new vec3(3.4, 3.6, 3.4), new vec3(0, 0.3, 0))
    add(head, "Hair", sph, this.hairColor, new vec3(3.6, 2.2, 3.6), new vec3(0, 1.6, -0.35))
    for (const x of [-0.72, 0.72]) {
      add(head, "EyeWhite", sph, this.whiteColor, new vec3(0.85, 0.85, 0.5), new vec3(x, 0.55, 1.55))
      add(head, "Pupil", sph, this.pupilColor, new vec3(0.42, 0.42, 0.3), new vec3(x, 0.55, 1.78))
    }
    add(head, "Mouth", cyl, new vec4(1, 0.45, 0.5, 1), new vec3(1.0, 0.18, 0.3), new vec3(0, -0.65, 1.62))
    // Shirt numbers: big on the back, small on the chest.
    const num = (name: string, pos: vec3, yaw: number, size: number): void => {
      const so = global.scene.createSceneObject(name)
      so.setParent(root)
      so.getTransform().setLocalPosition(pos.uniformScale(k))
      so.getTransform().setLocalRotation(quat.angleAxis(yaw, vec3.up()))
      so.getTransform().setLocalScale(vec3.one().uniformScale(k))
      const t = so.createComponent("Component.Text") as Text
      t.text = String(shirtNumber)
      t.size = size
      t.horizontalAlignment = HorizontalAlignment.Center
      t.verticalAlignment = VerticalAlignment.Center
      t.horizontalOverflow = HorizontalOverflow.Overflow
      t.verticalOverflow = VerticalOverflow.Overflow
      t.depthTest = true
      t.textFill.color = this.whiteColor
    }
    num("NumberBack", new vec3(0, 8.6, -1.62), Math.PI, 60)
    num("NumberChest", new vec3(0, 9.4, 1.62), 0, 24)
    return {root, armL, armR, legL, legR, head, parts}
  }
}
