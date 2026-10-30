// TouchlinePlayerCardUI — the quick player card shown beside a pinched token.
// Owns: one reused card (BackPlate + FlexLayout column: title row with close button,
// position, touches) and its own show/fade timing (view-local state only).
// Passive view: the controller calls showPlayer(...). Must not: look up match data.
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"

const ICON_CLOSE: Texture = requireAsset("../Icons/close.png") as Texture

const FONT_SIZE_SCALE = 1.0
type TextRole = "Subheadline" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Subheadline: {size: 41, weight: 700},
  Body: {size: 39, weight: 500},
  Caption: {size: 38, weight: 500},
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

@component
export class TouchlinePlayerCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TouchlinePlayerCardUI – pinch-a-player card</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Seconds the card stays fully visible before it starts to fade")
  @widget(new SliderWidget(0.5, 10, 0.1))
  holdSec: number = 3.4

  @input
  @hint("Fade-out duration in seconds")
  @widget(new SliderWidget(0.1, 3, 0.05))
  fadeSec: number = 0.6

  @input
  @hint("Card content width in cm")
  @widget(new SliderWidget(6, 20, 0.5))
  widthCm: number = 13

  @input
  @hint("Card height above the pinched player, in cm")
  @widget(new SliderWidget(2, 20, 0.5))
  liftCm: number = 7

  @input
  @hint("Viewing distance in cm used to scale the text roles")
  @widget(new SliderWidget(60, 250, 5))
  viewDistanceCm: number = 140

  @input
  @hint("Label prefix for the touches line")
  touchesLabel: string = "Touches so far"

  @input('vec4', '{0.62,0.85,1,1}')
  @widget(new ColorWidget())
  @hint("Title colour for home-team players")
  homeColor: vec4

  @input('vec4', '{0.55,0.68,1,1}')
  @widget(new ColorWidget())
  @hint("Title colour for away-team players")
  awayColor: vec4
  @ui.group_end

  private body: SceneObject
  private titleText: Text
  private positionText: Text
  private touchesText: Text
  private texts: Text[] = []
  private baseAlphas: number[] = []
  private shownAt = -1
  private wantVisible = false
  private _alpha = 0
  private _playerId = -1

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const bb = this.sceneObject.createComponent(Billboard.getTypeName()) as Billboard
    bb.xAxisEnabled = true
    bb.yAxisEnabled = true

    // "PlayerCardBody" is the LEAF lookup contract (enabled while the card shows).
    this.body = global.scene.createSceneObject("PlayerCardBody")
    this.body.setParent(this.sceneObject)
    const backPlate = this.body.createComponent(BackPlate.getTypeName()) as BackPlate

    const content = global.scene.createSceneObject("PlayerCardContent")
    content.setParent(this.body)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.width = this.widthCm
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Stretch
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = 0.25
    flex.paddingTop = 0.7
    flex.paddingBottom = 0.8
    flex.paddingLeft = 0.9
    flex.paddingRight = 0.9
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    const items: FlexItem[] = []

    // Title row: name (grows) + close icon button.
    const row = global.scene.createSceneObject("CardTitleRow")
    row.setParent(content)
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rowFlex.direction = FlexDirection.Row
    rowFlex.justifyContent = FlexJustify.SpaceBetween
    rowFlex.alignItems = FlexAlign.Center
    rowFlex.width = -1
    rowFlex.height = 2.2
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.alignSelf = FlexAlignSelf.Stretch
    rowItem.overrideHeight = 2.2
    items.push(rowItem)

    const rowItems: FlexItem[] = []
    const titleWidth = this.widthCm - 1.8 - 2.6
    this.titleText = this.addRowText(row, "CardTitle", "#00 Player Name", "Subheadline", titleWidth, rowItems)
    this.titleText.horizontalAlignment = HorizontalAlignment.Left

    const closeSO = global.scene.createSceneObject("CardCloseButton")
    closeSO.setParent(row)
    const closeBtn = closeSO.createComponent(Button.getTypeName()) as Button
    closeBtn.size = new vec3(2.2, 2.2, 1)
    const ec = closeSO.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.leadingIcon = ICON_CLOSE
    closeBtn.onTriggerUp.add(() => this.hide())
    rowItems.push(closeSO.createComponent(FlexItem.getTypeName()) as FlexItem)
    // children carry FlexItem; auto-discovered on layout start (addItems before init throws)

    this.positionText = this.addColumnText(content, "CardPosition", "Position", "Caption", items)
    this.touchesText = this.addColumnText(content, "CardTouches", `${this.touchesLabel}: 0`, "Caption", items)
    this.positionText.textFill.color = new vec4(1, 1, 1, 0.75)
    // children carry FlexItem; auto-discovered on layout start (addItems before init throws)

    this.texts = [this.titleText, this.positionText, this.touchesText]
    this.baseAlphas = this.texts.map((t) => t.textFill.color.w)

    let frames = 0
    const hideLater = this.createEvent("UpdateEvent")
    hideLater.bind(() => {
      frames++
      if (frames < 3) return
      hideLater.enabled = false
      this.body.enabled = this.wantVisible
    })

    this.createEvent("UpdateEvent").bind(() => this.tickFade())
  }

  /** Show the card beside a player. `worldPos` is the token's world position. */
  showPlayer(
    playerId: number,
    shirtNumber: number,
    shortName: string,
    position: string,
    touches: number,
    isHome: boolean,
    worldPos: vec3,
  ): void {
    if (!this.titleText) return
    this._playerId = playerId
    this.titleText.text = `#${shirtNumber} ${shortName}`
    this.positionText.text = position
    this.touchesText.text = `${this.touchesLabel}: ${touches}`
    const c = isHome ? this.homeColor : this.awayColor
    this.titleText.textFill.color = new vec4(c.x, c.y, c.z, 1)
    this.baseAlphas[0] = 1
    this.getTransform().setWorldPosition(worldPos.add(new vec3(0, this.liftCm, 0)))
    this.wantVisible = true
    this.body.enabled = true
    this.body.getTransform().setLocalScale(vec3.one())
    this.shownAt = getTime()
    this.applyAlpha(1)
  }

  hide(): void {
    this.wantVisible = false
    this.shownAt = -1
    this.applyAlpha(0)
    if (this.body) this.body.enabled = false
  }

  /** 0..1 — current visibility of the card (read by tests). */
  get alpha(): number {
    return this._alpha
  }

  get playerId(): number {
    return this._playerId
  }

  isShowing(): boolean {
    return this.wantVisible
  }

  getTitle(): string {
    return this.titleText ? this.titleText.text : ""
  }

  private tickFade(): void {
    if (this.shownAt < 0) return
    const age = getTime() - this.shownAt
    if (age <= this.holdSec) return
    const u = (age - this.holdSec) / Math.max(0.01, this.fadeSec)
    if (u >= 1) {
      this.hide()
      return
    }
    this.applyAlpha(1 - u)
    const s = 1 - 0.12 * u
    this.body.getTransform().setLocalScale(new vec3(s, s, s))
  }

  private applyAlpha(a: number): void {
    this._alpha = a
    for (let i = 0; i < this.texts.length; i++) {
      const c = this.texts[i].textFill.color
      this.texts[i].textFill.color = new vec4(c.x, c.y, c.z, this.baseAlphas[i] * a)
    }
  }

  private addRowText(
    parent: SceneObject,
    name: string,
    text: string,
    role: TextRole,
    widthCm: number,
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
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -1.1, 1.1)
    items.push(so.createComponent(FlexItem.getTypeName()) as FlexItem)
    return t
  }

  private addColumnText(parent: SceneObject, name: string, text: string, role: TextRole, items: FlexItem[]): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, 0.15))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, role, this.viewDistanceCm)
    t.horizontalAlignment = HorizontalAlignment.Left
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-0.5, 0.5, -0.5, 0.5)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    item.overrideHeight = 1.5
    items.push(item)
    return t
  }
}
