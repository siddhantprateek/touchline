// TouchlineSkipUI — the "Skip to next moment" button at the near-right corner of the pitch.
// Owns: one UIKit Button (icon + label as its single ElementContent face). Passive view:
// reports user intent through onSkip. Must not: touch the clock itself.
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"

const ICON_SKIP: Texture = requireAsset("../Icons/skip_next.png") as Texture

const FONT_SIZE_SCALE = 1.0
function roleSize(size: number, distanceCm: number): number {
  return size * FONT_SIZE_SCALE * (distanceCm / 110)
}
const BUTTON_ROLE_SIZE = 39 // "Button" role (Medium)

@component
export class TouchlineSkipUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TouchlineSkipUI – "Skip to next moment" button</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Button label")
  label: string = "Skip to next moment"

  @input
  @hint("Button width in cm (must fit the label + icon)")
  @widget(new SliderWidget(5, 25, 0.5))
  widthCm: number = 15

  @input
  @hint("Button height in cm")
  @widget(new SliderWidget(2, 8, 0.1))
  heightCm: number = 3.6

  @input
  @hint("Viewing distance in cm used to scale the label")
  @widget(new SliderWidget(60, 250, 5))
  viewDistanceCm: number = 140
  @ui.group_end

  private readonly skipEvent = new Event<void>()
  /** Fired when the user pinches the button. */
  get onSkip(): PublicApi<void> {
    return this.skipEvent.publicApi()
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const bb = this.sceneObject.createComponent(Billboard.getTypeName()) as Billboard
    bb.xAxisEnabled = true
    bb.yAxisEnabled = true

    // The SceneObject name "SkipButton" is the LEAF lookup contract.
    const so = global.scene.createSceneObject("SkipButton")
    so.setParent(this.sceneObject)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(this.widthCm, this.heightCm, 1)
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.text = this.label
    ec.leadingIcon = ICON_SKIP
    ec.textSize = roleSize(BUTTON_ROLE_SIZE, this.viewDistanceCm)
    btn.onTriggerUp.add(() => this.skipEvent.invoke())
  }
}
