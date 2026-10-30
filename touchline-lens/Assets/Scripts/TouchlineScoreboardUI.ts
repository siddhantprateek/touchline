// TouchlineScoreboardUI — floating score + clock label above the far touchline.
// Owns: the scoreboard panel (BackPlate + FlexLayout column of three text rows) and the
// "Data: StatsBomb" credit. Passive view: the controller pushes score/clock via setters.
// Must not: compute score or time, or know about match state.
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"

// ── Typography: the single source of truth for text size + weight ────────────
const FONT_SIZE_SCALE = 1.0
type TextRole =
  | "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2"
  | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700},
  Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700},
  Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700},
  Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500},
  Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500},
  Caption: {size: 38, weight: 500},
}
function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

@component
export class TouchlineScoreboardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TouchlineScoreboardUI – score, LIVE clock, data credit</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Short label for the home team (no crests or tournament branding)")
  homeLabel: string = "ARG"

  @input
  @hint("Short label for the away team")
  awayLabel: string = "FRA"

  @input
  @hint("Data credit shown under the scoreboard (required by the StatsBomb licence)")
  creditText: string = "Data: StatsBomb"

  @input
  @hint("Viewing distance in cm used to scale the text roles")
  @widget(new SliderWidget(60, 250, 5))
  viewDistanceCm: number = 140

  @input
  @hint("Panel content width in cm")
  @widget(new SliderWidget(10, 40, 0.5))
  panelWidthCm: number = 21

  @input('vec4', '{1,1,1,1}')
  @widget(new ColorWidget())
  @hint("Score line colour")
  scoreColor: vec4

  @input('vec4', '{0.55,1,0.6,1}')
  @widget(new ColorWidget())
  @hint("Clock colour while LIVE")
  liveColor: vec4

  @input('vec4', '{1,0.85,0.4,1}')
  @widget(new ColorWidget())
  @hint("Clock colour while a replay is playing")
  replayColor: vec4
  @ui.group_end

  private scoreText: Text
  private clockText: Text

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const bb = this.sceneObject.createComponent(Billboard.getTypeName()) as Billboard
    bb.xAxisEnabled = true
    bb.yAxisEnabled = true

    const backPlate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate

    const content = global.scene.createSceneObject("ScoreboardContent")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.width = this.panelWidthCm
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Stretch
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = 0.3
    flex.paddingTop = 0.8
    flex.paddingBottom = 0.8
    flex.paddingLeft = 1.0
    flex.paddingRight = 1.0
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    const items: FlexItem[] = []
    const score = this.addLine(content, "ScoreText", this.composeScore(0, 0), "Headline1", 2.0, items)
    score.textFill.color = this.scoreColor
    this.scoreText = score
    this.clockText = this.addLine(content, "ClockText", "LIVE 00:00", "Subheadline", 1.4, items)
    this.clockText.textFill.color = this.liveColor
    const credit = this.addLine(content, "CreditText", this.creditText, "Caption", 1.2, items)
    credit.textFill.color = new vec4(1, 1, 1, 0.6)
    // children carry FlexItem; auto-discovered on layout start (addItems before init throws)
  }

  /** Push the current score. */
  setScore(home: number, away: number): void {
    if (this.scoreText) this.scoreText.text = this.composeScore(home, away)
  }

  /** Push the clock line, e.g. "LIVE 21:30" or "REPLAY 35:22 · Di María". */
  setClock(label: string, isReplay: boolean): void {
    if (!this.clockText) return
    this.clockText.text = label
    this.clockText.textFill.color = isReplay ? this.replayColor : this.liveColor
  }

  /** Current clock line (read by tests). */
  getClockLabel(): string {
    return this.clockText ? this.clockText.text : ""
  }

  private composeScore(home: number, away: number): string {
    return `${this.homeLabel}  ${home} – ${away}  ${this.awayLabel}`
  }

  private addLine(
    parent: SceneObject,
    name: string,
    text: string,
    role: TextRole,
    heightCm: number,
    items: FlexItem[],
  ): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, 0.15))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, role, this.viewDistanceCm)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-0.5, 0.5, -0.5, 0.5)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    item.overrideHeight = heightCm
    items.push(item)
    return t
  }
}
