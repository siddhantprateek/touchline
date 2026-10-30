// TouchlineScrubberUI — replay slider along the near edge, visible only during a replay.
// Owns: BackPlate + caption + UIKit Slider. Passive view: setProgress() from the controller,
// onScrub(value 0..1) back when the *user* drags. Must not: drive the replay itself.
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"

const FONT_SIZE_SCALE = 1.0
const CAPTION = {size: 38, weight: 500}

@component
export class TouchlineScrubberUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TouchlineScrubberUI – replay scrub slider</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Caption above the slider")
  caption: string = "Replay · drag to scrub"

  @input
  @hint("Slider track length in cm")
  @widget(new SliderWidget(10, 50, 0.5))
  sliderLengthCm: number = 30

  @input
  @hint("Viewing distance in cm used to scale the caption")
  @widget(new SliderWidget(60, 250, 5))
  viewDistanceCm: number = 140
  @ui.group_end

  private slider: Slider
  private captionText: Text
  private settingFromCode = false
  private wantVisible = false
  private body: SceneObject
  private readonly scrubEvent = new Event<number>()

  /** User-initiated scrub (0..1). Programmatic setProgress() does not fire this. */
  get onScrub(): PublicApi<number> {
    return this.scrubEvent.publicApi()
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const bb = this.sceneObject.createComponent(Billboard.getTypeName()) as Billboard
    bb.xAxisEnabled = true
    bb.yAxisEnabled = true

    this.body = global.scene.createSceneObject("ScrubberBody")
    this.body.setParent(this.sceneObject)
    const backPlate = this.body.createComponent(BackPlate.getTypeName()) as BackPlate

    const content = global.scene.createSceneObject("ScrubberContent")
    content.setParent(this.body)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.width = this.sliderLengthCm + 2
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = 0.5
    flex.paddingTop = 0.7
    flex.paddingBottom = 0.8
    flex.paddingLeft = 1
    flex.paddingRight = 1
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    const items: FlexItem[] = []
    const capSO = global.scene.createSceneObject("ScrubberCaption")
    capSO.setParent(content)
    capSO.getTransform().setLocalPosition(new vec3(0, 0, 0.15))
    const t = capSO.createComponent("Component.Text") as Text
    t.text = this.caption
    t.depthTest = true
    t.size = CAPTION.size * FONT_SIZE_SCALE * (this.viewDistanceCm / 110)
    ;(t as Text & {weight?: number}).weight = CAPTION.weight
    t.textFill.color = new vec4(1, 1, 1, 0.8)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.layoutRect = Rect.create(-0.5, 0.5, -0.5, 0.5)
    const capItem = capSO.createComponent(FlexItem.getTypeName()) as FlexItem
    capItem.alignSelf = FlexAlignSelf.Stretch
    capItem.overrideHeight = 1.4
    items.push(capItem)
    this.captionText = t

    // SceneObject name "ReplaySlider" is the LEAF lookup contract.
    const sliderSO = global.scene.createSceneObject("ReplaySlider")
    sliderSO.setParent(content)
    this.slider = sliderSO.createComponent(Slider.getTypeName()) as Slider
    this.slider.size = new vec3(this.sliderLengthCm, 2.0, 1) // BEFORE init
    this.slider.currentValue = 0
    this.slider.onValueChange.add((v: number) => {
      if (!this.settingFromCode) this.scrubEvent.invoke(v)
    })
    items.push(sliderSO.createComponent(FlexItem.getTypeName()) as FlexItem)
    // children carry FlexItem; auto-discovered on layout start (addItems before init throws)

    // Start hidden only after UIKit components have initialised (they init on OnStart;
    // disabling earlier would stop them from ever initialising).
    let frames = 0
    const hideLater = this.createEvent("UpdateEvent")
    hideLater.bind(() => {
      frames++
      if (frames < 3) return
      hideLater.enabled = false
      this.body.enabled = this.wantVisible
    })
  }

  show(title: string): void {
    this.wantVisible = true
    if (this.captionText) this.captionText.text = `${title}  ·  drag to scrub`
    if (this.body) this.body.enabled = true
  }

  hide(): void {
    this.wantVisible = false
    if (this.body) this.body.enabled = false
  }

  isVisible(): boolean {
    return this.wantVisible
  }

  setProgress(v: number): void {
    if (!this.slider) return
    this.settingFromCode = true
    this.slider.currentValue = Math.max(0, Math.min(1, v))
    this.settingFromCode = false
  }
}
