// TouchlineTimelineView — the timeline strip along the near touchline with one pinchable
// marker per shot (goals larger and glowing). Data-driven count, so markers are script-built
// under the authored "Timeline" root.
// Owns: marker visuals, lane layout, hover highlight, pulse animation, passed/future tint.
// Emits onMarkerPinched(momentId). Must not: start replays or play audio itself.
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Moment} from "./Data/MatchTypes"
import {MATCH} from "./Data/MatchData"
import {PITCH_LEN_CM, PITCH_WID_CM} from "./TouchlinePitchSpace"
import {addBox, scaleColor, tinted} from "./TouchlineVisuals"

interface Marker {
  moment: Moment
  root: SceneObject
  visual: SceneObject
  rmv: RenderMeshVisual
  color: vec4
  baseSize: number
  pulseStart: number
  hovered: boolean
}

@component
export class TouchlineTimelineView extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TouchlineTimelineView – goal & shot markers</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Unlit base material (cloned per marker)")
  unlitMaterial: Material

  @input
  @hint("Sphere mesh for markers")
  sphereMesh: RenderMesh

  @input
  @hint("Box mesh for the strip")
  boxMesh: RenderMesh
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Goal marker diameter, cm")
  @widget(new SliderWidget(1, 5, 0.1))
  goalMarkerCm: number = 2.6

  @input
  @hint("Shot marker diameter, cm")
  @widget(new SliderWidget(0.6, 4, 0.1))
  shotMarkerCm: number = 1.6

  @input
  @hint("Pinch-area diameter for every marker, cm")
  @widget(new SliderWidget(1.5, 5, 0.1))
  pinchDiameterCm: number = 3

  @input
  @hint("Distance of the first lane outside the near touchline, cm")
  @widget(new SliderWidget(0.5, 8, 0.1))
  firstLaneGapCm: number = 3

  @input
  @hint("Spacing between marker lanes, cm (markers that would overlap move to the next lane)")
  @widget(new SliderWidget(2, 6, 0.1))
  laneSpacingCm: number = 3

  @input
  @hint("Marker height above the table, cm")
  @widget(new SliderWidget(0.5, 5, 0.1))
  markerHeightCm: number = 1.6

  @input
  @hint("Pulse duration when the clock reaches a marker, seconds")
  @widget(new SliderWidget(0.3, 4, 0.1))
  pulseSec: number = 2

  @input('vec4', '{1,0.86,0.3,1}')
  @widget(new ColorWidget())
  @hint("Goal marker colour")
  goalColor: vec4

  @input('vec4', '{0.85,0.9,1,1}')
  @widget(new ColorWidget())
  @hint("Shot marker colour")
  shotColor: vec4

  @input('vec4', '{0.7,0.75,0.8,1}')
  @widget(new ColorWidget())
  @hint("Timeline strip colour")
  stripColor: vec4

  @input
  @hint("Brightness of markers the clock has not reached yet (0..1)")
  @widget(new SliderWidget(0.1, 1, 0.05))
  futureBrightness: number = 0.45

  @input
  @hint("Brightness of goal markers the clock has not reached yet (0..1)")
  @widget(new SliderWidget(0.1, 1, 0.05))
  futureGoalBrightness: number = 0.85
  @ui.group_end

  private markers: Marker[] = []
  private clockSec = 0
  private activeId: string | null = null
  private readonly pinchEvent = new Event<string>()

  get onMarkerPinched(): PublicApi<string> {
    return this.pinchEvent.publicApi()
  }

  onAwake(): void {
    if (!this.unlitMaterial || !this.sphereMesh || !this.boxMesh) {
      print("[TouchlineTimelineView] missing material/mesh inputs")
      return
    }
    this.build()
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  /** Clock position drives passed/future brightness. */
  setClock(sec: number): void {
    this.clockSec = sec
  }

  /** Highlight the marker being replayed (null = none). */
  setActive(id: string | null): void {
    this.activeId = id
  }

  pulse(id: string): void {
    const m = this.markers.find((k) => k.moment.id === id)
    if (m) m.pulseStart = getTime()
  }

  isPulsing(id: string): boolean {
    const m = this.markers.find((k) => k.moment.id === id)
    return !!m && m.pulseStart >= 0 && getTime() - m.pulseStart < this.pulseSec
  }

  private build(): void {
    const L = PITCH_LEN_CM / 2
    const z0 = PITCH_WID_CM / 2 + this.firstLaneGapCm
    // Strip (with half-time and full-time ticks) just inside the first lane.
    const strip = addBox(this.sceneObject, "TimelineStrip", this.boxMesh, tinted(this.unlitMaterial, this.stripColor),
      new vec3(PITCH_LEN_CM, 0.1, 0.25), new vec3(0, 0.05, z0 - 1.6))
    strip.getSceneObject().name = "TimelineStrip"
    for (const sec of [2700, 5400, 6300]) {
      addBox(this.sceneObject, `Tick${sec}`, this.boxMesh, tinted(this.unlitMaterial, this.stripColor),
        new vec3(0.2, 0.1, 1.0), new vec3(this.xFor(sec), 0.05, z0 - 1.6))
    }

    // Lane layout: goals first (lane 0 if free), then shots; a marker that would overlap a
    // neighbour in its lane drops to the next lane.
    const minGap = this.pinchDiameterCm + 0.1
    const ordered = MATCH.moments.slice().sort((a, b) => (a.isGoal === b.isGoal ? a.sec - b.sec : a.isGoal ? -1 : 1))
    const placedX: number[][] = []
    for (const m of ordered) {
      const x = this.xFor(m.sec)
      let lane = 0
      while (placedX[lane] && placedX[lane].some((px) => Math.abs(px - x) < minGap)) lane++
      if (!placedX[lane]) placedX[lane] = []
      placedX[lane].push(x)
      this.markers.push(this.makeMarker(m, new vec3(Math.max(-L, Math.min(L, x)), this.markerHeightCm, z0 + lane * this.laneSpacingCm)))
    }
  }

  private xFor(sec: number): number {
    return -PITCH_LEN_CM / 2 + (PITCH_LEN_CM * sec) / MATCH.endSec
  }

  private makeMarker(m: Moment, pos: vec3): Marker {
    const root = global.scene.createSceneObject(`Marker_${m.id}`)
    root.setParent(this.sceneObject)
    root.getTransform().setLocalPosition(pos)
    const collider = root.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createSphereShape()
    shape.radius = this.pinchDiameterCm / 2
    collider.shape = shape
    collider.fitVisual = false
    const interactable = root.createComponent(Interactable.getTypeName()) as Interactable
    const visual = global.scene.createSceneObject("MarkerVisual")
    visual.setParent(root)
    const size = m.isGoal ? this.goalMarkerCm : this.shotMarkerCm
    const color = m.isGoal ? this.goalColor : this.shotColor
    const rmv = addBox(visual, m.isGoal ? "GoalOrb" : "ShotOrb", this.sphereMesh, tinted(this.unlitMaterial, color),
      new vec3(size, size, size), vec3.zero())
    const marker: Marker = {moment: m, root, visual, rmv, color, baseSize: 1, pulseStart: -1, hovered: false}
    interactable.onHoverEnter.add(() => (marker.hovered = true))
    interactable.onHoverExit.add(() => (marker.hovered = false))
    interactable.onTriggerEnd.add(() => this.pinchEvent.invoke(m.id))
    return marker
  }

  private tick(): void {
    const now = getTime()
    for (const mk of this.markers) {
      let s = mk.hovered ? 1.3 : 1
      const passed = mk.moment.sec <= this.clockSec
      let bright = passed ? 1 : mk.moment.isGoal ? this.futureGoalBrightness : this.futureBrightness
      if (mk.pulseStart >= 0) {
        const age = now - mk.pulseStart
        if (age < this.pulseSec) {
          const w = Math.sin((age / this.pulseSec) * Math.PI * 4)
          s *= 1 + 0.45 * Math.abs(w) * (1 - age / this.pulseSec)
          bright = 1.25
        }
      }
      if (mk.moment.isGoal) s *= 1 + 0.08 * Math.sin(now * 3 + mk.moment.sec) // gentle glow breathing
      if (this.activeId === mk.moment.id) {
        s *= 1.35
        bright = 1.3
      }
      mk.visual.getTransform().setLocalScale(new vec3(s, s, s))
      mk.rmv.mainMaterial.mainPass.baseColor = scaleColor(mk.color, bright)
    }
  }
}
