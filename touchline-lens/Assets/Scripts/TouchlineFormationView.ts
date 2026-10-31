// TouchlineFormationView — the 22 player tokens (runtime-built, data-driven count).
// Owns: token visuals, their 4 cm SIK pinch colliders, hover highlight, formation layout
// for the current clock, and placing tokens from a replay frame pushed by the controller.
// Emits onTokenPinched(playerId). Must not: read the clock itself or decide state.
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FormationSpan} from "./Data/MatchTypes"
import {MATCH} from "./Data/MatchData"
import {toLocal} from "./TouchlinePitchSpace"
import {addBox, Kit, scaleColor, tinted} from "./TouchlineVisuals"

export interface TokenPlacement {
  team: 0 | 1
  playerId: number | null
  x: number // StatsBomb units
  y: number
}

interface Token {
  root: SceneObject
  visual: SceneObject
  ring: SceneObject
  interactable: Interactable
  collider: ColliderComponent
  parts: {rmv: RenderMeshVisual; color: vec4}[]
  numberText: Text
  team: 0 | 1
  keeper: boolean
  playerId: number | null
  target: vec3
  phase: number
  hovered: boolean
}

@component
export class TouchlineFormationView extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TouchlineFormationView – 22 pinchable player tokens</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Unlit base material (cloned per token part)")
  unlitMaterial: Material

  @input
  @hint("Cylinder mesh for the token discs")
  cylinderMesh: RenderMesh
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Token visual diameter in cm")
  @widget(new SliderWidget(0.8, 3, 0.05))
  tokenDiameterCm: number = 1.7

  @input
  @hint("Shirt-number text size (Lens Studio text points; ~36 gives digits about 0.8 cm tall)")
  @widget(new SliderWidget(12, 80, 1))
  numberSize: number = 36

  @input
  @hint("Invisible pinch-area diameter in cm (larger than the token so tiny players are easy to pinch)")
  @widget(new SliderWidget(1.5, 6, 0.1))
  pinchDiameterCm: number = 4

  @input
  @hint("Scale applied to a token while it is aimed at")
  @widget(new SliderWidget(1, 2, 0.05))
  hoverScale: number = 1.35

  @input
  @hint("Idle drift amplitude in LIVE mode, cm")
  @widget(new SliderWidget(0, 1.5, 0.05))
  idleDriftCm: number = 0.35

  @input
  @hint("How quickly tokens glide to new positions (higher = snappier)")
  @widget(new SliderWidget(1, 30, 0.5))
  followSpeed: number = 8

  @input('vec4', '{0.3,0.65,1,1}')
  @widget(new ColorWidget())
  @hint("Argentina shirt colour (celeste); deep enough that the white number stays readable")
  homeColor: vec4

  @input('vec4', '{1,1,1,1}')
  @widget(new ColorWidget())
  @hint("Argentina shirt stripes (white)")
  homeAccent: vec4

  @input('vec4', '{0.12,0.16,0.45,1}')
  @widget(new ColorWidget())
  @hint("Argentina shorts: the base ring (navy; real black would vanish on the additive display)")
  homeShorts: vec4

  @input('vec4', '{0.75,1,0.15,1}')
  @widget(new ColorWidget())
  @hint("Argentina goalkeeper shirt")
  homeKeeper: vec4

  @input('vec4', '{1,0.5,0.1,1}')
  @widget(new ColorWidget())
  @hint("France goalkeeper shirt")
  awayKeeper: vec4

  @input('vec4', '{1,0.15,0.2,1}')
  @widget(new ColorWidget())
  @hint("France shirt stripe (red)")
  awayStripe: vec4

  @input('vec4', '{1,1,1,1}')
  @widget(new ColorWidget())
  @hint("Shirt-number colour (white; avoid black, it disappears on the additive display)")
  numberColor: vec4

  @input('vec4', '{0.18,0.36,1,1}')
  @widget(new ColorWidget())
  @hint("France token body (bright royal blue)")
  awayColor: vec4

  @input('vec4', '{1,1,1,1}')
  @widget(new ColorWidget())
  @hint("France shorts: the base ring (white)")
  awayOutline: vec4

  @input('vec4', '{1,0.85,0.35,1}')
  @widget(new ColorWidget())
  @hint("Ring under named (pinchable) players during a replay")
  namedRingColor: vec4
  @ui.group_end

  private tokens: Token[] = []
  private readonly shirtNumbers = new Map<number, number>(MATCH.players.map((p) => [p.id, p.number]))
  private readonly positions = new Map<number, string>(MATCH.players.map((p) => [p.id, p.position]))
  private dim = 1
  private replayMode = false
  private readonly pinchEvent = new Event<number>()

  get onTokenPinched(): PublicApi<number> {
    return this.pinchEvent.publicApi()
  }

  onAwake(): void {
    if (!this.unlitMaterial || !this.cylinderMesh) {
      print("[TouchlineFormationView] missing unlitMaterial/cylinderMesh input")
      return
    }
    for (let i = 0; i < 22; i++) this.tokens.push(this.makeToken(i, i < 11 ? 0 : 1))
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  /** LIVE: lay tokens out on the formation active at `clockSec`. */
  showFormation(clockSec: number): void {
    this.replayMode = false
    for (const team of [0, 1] as const) {
      const span = this.spanAt(MATCH.formations[team], clockSec)
      const slots = span ? span.slots : []
      for (let k = 0; k < 11; k++) {
        const tok = this.tokens[team * 11 + k]
        const slot = slots[k]
        if (!slot) {
          tok.root.enabled = false
          continue
        }
        tok.root.enabled = true
        this.assign(tok, team, slot.playerId, true, false)
        tok.target = toLocal(slot.x, slot.y)
      }
    }
  }

  /** REPLAY: place tokens from a sampled frame. Named tokens are pinchable and ringed. */
  showReplayFrame(frame: TokenPlacement[], snap: boolean): void {
    this.replayMode = true
    for (let i = 0; i < this.tokens.length; i++) {
      const tok = this.tokens[i]
      const p = frame[i]
      if (!p) {
        tok.root.enabled = false
        continue
      }
      tok.root.enabled = true
      const named = p.playerId !== null
      this.assign(tok, p.team, p.playerId, named, named)
      tok.target = toLocal(p.x, p.y)
      if (snap) tok.root.getTransform().setLocalPosition(tok.target)
    }
  }

  setDim(f: number): void {
    this.dim = f
    for (const tok of this.tokens) this.applyColors(tok)
  }

  /** World position of the token currently showing `playerId`, or null. */
  getTokenWorldPosition(playerId: number): vec3 | null {
    for (const tok of this.tokens) {
      if (tok.root.enabled && tok.playerId === playerId) return tok.root.getTransform().getWorldPosition()
    }
    return null
  }

  /** Kit colours for a team (used by the player card portrait so it matches the coin). */
  kitFor(team: 0 | 1, keeper: boolean): Kit {
    const home = team === 0
    return {
      shirt: keeper ? (home ? this.homeKeeper : this.awayKeeper) : home ? this.homeColor : this.awayColor,
      shorts: home ? this.homeShorts : this.awayOutline,
      stripe: home ? this.homeAccent : this.awayStripe,
      striped: !keeper,
    }
  }

  /** Local positions of all enabled tokens (read by tests). */
  getTokenLocalPositions(): vec3[] {
    return this.tokens.filter((t) => t.root.enabled).map((t) => t.root.getTransform().getLocalPosition())
  }

  private spanAt(spans: FormationSpan[], sec: number): FormationSpan | null {
    let best: FormationSpan | null = null
    for (const s of spans) if (s.fromSec <= sec && (!best || s.fromSec >= best.fromSec)) best = s
    return best ?? (spans.length ? spans[0] : null)
  }

  private assign(tok: Token, team: 0 | 1, playerId: number | null, pinchable: boolean, ring: boolean): void {
    const keeper = playerId !== null && this.positions.get(playerId) === "Goalkeeper"
    if (tok.team !== team || tok.keeper !== keeper) {
      tok.team = team
      tok.keeper = keeper
      this.rebuildVisual(tok)
    }
    tok.playerId = playerId
    const shirt = playerId !== null ? this.shirtNumbers.get(playerId) : undefined
    tok.numberText.text = shirt !== undefined ? String(shirt) : ""
    tok.root.name = playerId !== null ? `Token_${playerId}` : `Token_anon`
    tok.interactable.enabled = pinchable
    tok.collider.enabled = pinchable
    tok.ring.enabled = ring
  }

  private tick(): void {
    const dt = getDeltaTime()
    const now = getTime()
    const k = 1 - Math.exp(-this.followSpeed * dt)
    for (const tok of this.tokens) {
      if (!tok.root.enabled) continue
      const t = tok.root.getTransform()
      let target = tok.target
      if (!this.replayMode && this.idleDriftCm > 0) {
        target = target.add(
          new vec3(Math.sin(now * 0.7 + tok.phase) * this.idleDriftCm, 0, Math.cos(now * 0.53 + tok.phase * 1.7) * this.idleDriftCm),
        )
      }
      const cur = t.getLocalPosition()
      t.setLocalPosition(this.replayMode ? target : vec3.lerp(cur, target, k))
      const s = tok.hovered ? this.hoverScale : 1
      tok.visual.getTransform().setLocalScale(new vec3(s, s, s))
    }
  }

  private makeToken(i: number, team: 0 | 1): Token {
    const root = global.scene.createSceneObject(`Token_${i}`)
    root.setParent(this.sceneObject)
    // Collider + Interactable on a unit-scale, identity-rotation root (Hard Rule 6);
    // visuals are scaled children.
    const collider = root.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createSphereShape()
    shape.radius = this.pinchDiameterCm / 2
    collider.shape = shape
    collider.fitVisual = false
    const interactable = root.createComponent(Interactable.getTypeName()) as Interactable
    const visual = global.scene.createSceneObject("TokenVisual")
    visual.setParent(root)
    const ring = global.scene.createSceneObject("NamedRing")
    ring.setParent(root)
    // Shirt number lying flat on the coin's top face, reading upright from the user's side (+Z).
    const numberSO = global.scene.createSceneObject("ShirtNumber")
    numberSO.setParent(visual)
    const nt = numberSO.getTransform()
    nt.setLocalPosition(new vec3(0, 0.34, 0))
    nt.setLocalRotation(quat.angleAxis(-Math.PI / 2, vec3.right()))
    const numberText = numberSO.createComponent("Component.Text") as Text
    numberText.text = ""
    numberText.size = this.numberSize
    numberText.horizontalAlignment = HorizontalAlignment.Center
    numberText.verticalAlignment = VerticalAlignment.Center
    numberText.horizontalOverflow = HorizontalOverflow.Overflow
    numberText.verticalOverflow = VerticalOverflow.Overflow
    numberText.depthTest = true
    numberText.textFill.color = this.numberColor
    const tok: Token = {
      root,
      visual,
      ring,
      interactable,
      collider,
      parts: [],
      numberText,
      team,
      keeper: false,
      playerId: null,
      target: vec3.zero(),
      phase: i * 1.37,
      hovered: false,
    }
    const ringRmv = addBox(ring, "Ring", this.cylinderMesh, tinted(this.unlitMaterial, this.namedRingColor),
      new vec3(this.tokenDiameterCm * 1.5, 0.05, this.tokenDiameterCm * 1.5), new vec3(0, -0.28, 0))
    ringRmv.getSceneObject().name = "RingDisc"
    ring.enabled = false
    this.rebuildVisual(tok)
    interactable.onHoverEnter.add(() => (tok.hovered = true))
    interactable.onHoverExit.add(() => (tok.hovered = false))
    interactable.onTriggerEnd.add(() => {
      if (tok.playerId !== null) this.pinchEvent.invoke(tok.playerId)
    })
    return tok
  }

  private rebuildVisual(tok: Token): void {
    for (const p of tok.parts) p.rmv.getSceneObject().destroy()
    tok.parts = []
    const d = this.tokenDiameterCm
    const add = (name: string, color: vec4, size: vec3, center: vec3) => {
      const rmv = addBox(tok.visual, name, this.cylinderMesh, tinted(this.unlitMaterial, color), size, center)
      tok.parts.push({rmv, color})
    }
    const home = tok.team === 0
    const shirt = tok.keeper ? (home ? this.homeKeeper : this.awayKeeper) : home ? this.homeColor : this.awayColor
    // Base ring = shorts; body = shirt; stripes sit on the shirt top, either side of the number.
    add("Shorts", home ? this.homeShorts : this.awayOutline, new vec3(d * 1.12, 0.45, d * 1.12), new vec3(0, -0.06, 0))
    add("Shirt", shirt, new vec3(d * 0.92, 0.6, d * 0.92), vec3.zero())
    if (!tok.keeper) {
      const stripe = home ? this.homeAccent : this.awayStripe
      const r = d * 0.46
      const offsets = home ? [-0.62, -0.45, 0.45, 0.62] : [-0.6, 0.6]
      for (const o of offsets) {
        const x = o * r * 1.35
        const half = Math.sqrt(Math.max(r * r - x * x, 0.01)) * 0.9
        add("Stripe", stripe, new vec3(d * 0.09, 0.05, half * 2), new vec3(x, 0.31, 0))
      }
    }
    this.applyColors(tok)
  }

  private applyColors(tok: Token): void {
    for (const p of tok.parts) p.rmv.mainMaterial.mainPass.baseColor = scaleColor(p.color, this.dim)
    tok.numberText.textFill.color = scaleColor(this.numberColor, this.dim)
  }
}
