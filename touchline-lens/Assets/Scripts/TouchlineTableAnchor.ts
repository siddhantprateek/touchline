// TouchlineTableAnchor — one-shot placement of the whole Touchline root relative to the
// camera's start pose: forward on the horizontal plane, table top at table height.
// Owns: only this root's world transform, once. It does not follow the head afterwards.
// Expects: cameraObject wired. Must not: run gameplay or move anything after placement.
@component
export class TouchlineTableAnchor extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TouchlineTableAnchor – place table + pitch in front of the user</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("The main camera (Specs device-tracked camera)")
  cameraObject: SceneObject
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Distance from the user's start position to the table centre, cm")
  @widget(new SliderWidget(60, 250, 5))
  tableDistanceCm: number = 120

  @input
  @hint("Eye height above the floor at start (seated on a sofa ≈ 120), cm")
  @widget(new SliderWidget(80, 190, 1))
  eyeHeightCm: number = 120

  @input
  @hint("Coffee-table height (floor to table top), cm")
  @widget(new SliderWidget(25, 90, 1))
  tableHeightCm: number = 45

  @input
  @hint("Angle of the pitch centre below a straight-ahead gaze, degrees. SPECS shows about ±18° vertically, so ~15 keeps the whole pitch in view at start. 0 = use eye/table heights instead.")
  @widget(new SliderWidget(0, 30, 1))
  pitchBelowGazeDeg: number = 10

  @input
  @hint("Frames to wait for tracking before placing")
  @widget(new SliderWidget(1, 30, 1))
  settleFrames: number = 3
  @ui.group_end

  private placed = false

  onAwake(): void {
    let frames = 0
    const ev = this.createEvent("UpdateEvent")
    ev.bind(() => {
      frames++
      if (frames < this.settleFrames) return
      this.place()
      ev.enabled = false
    })
  }

  isPlaced(): boolean {
    return this.placed
  }

  /** Place the root now (also callable again to re-centre). */
  place(): void {
    if (!this.cameraObject) {
      print("[TouchlineTableAnchor] cameraObject not wired — keeping authored placement")
      this.placed = true
      return
    }
    const camT = this.cameraObject.getTransform()
    const camPos = camT.getWorldPosition()
    const look = camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    let flat = new vec3(look.x, 0, look.z)
    if (flat.length < 1e-3) flat = new vec3(0, 0, -1)
    flat = flat.normalize()
    const drop =
      this.pitchBelowGazeDeg > 0
        ? this.tableDistanceCm * Math.tan((this.pitchBelowGazeDeg * Math.PI) / 180)
        : this.eyeHeightCm - this.tableHeightCm
    const pos = camPos.add(flat.uniformScale(this.tableDistanceCm)).add(new vec3(0, -drop, 0))
    // Root +Z must point back toward the user.
    const towardUser = flat.uniformScale(-1)
    const yaw = Math.atan2(towardUser.x, towardUser.z)
    const t = this.getTransform()
    t.setWorldPosition(pos)
    t.setWorldRotation(quat.angleAxis(yaw, vec3.up()))
    this.placed = true
  }
}
