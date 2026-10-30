// TouchlineLeafHelpers — shared helpers for the Touchline LEAF scenarios, one per design-brief done criterion (+ one IK
// reachability check). Scenarios share one live Lens instance, so every assertion is relative
// to the state read at the start of the scenario.
// Scene-object names used here are the lookup contracts declared in the Lens scripts:
//   "Touchline" (controller), "Turf", "TableTop", "Camera Object", "Marker_<momentId>",
//   "Token_<playerId>", "SkipButton", "ReplayBall", "ShotArcBall", "PlayerCardBody", "PlayerCard".
import {findInteractableByName, getInteractables} from "Leaf.lspkg/Interactors/InteractableUtils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep, withTimeout} from "Leaf.lspkg/Utils/common/Utils"
import {TouchlineController} from "./TouchlineController"
import {TouchlineFormationView} from "./TouchlineFormationView"
import {TouchlinePlayerCardUI} from "./TouchlinePlayerCardUI"
import {TouchlineShotArc} from "./TouchlineShotArc"
import {TouchlineTimelineView} from "./TouchlineTimelineView"

export const HERO_MOMENT = "ef86f4d9" // 35:22 Di María (open-play goal, hero replay)

export function controller(): TouchlineController {
  return findSceneObjectByName("Touchline").getComponent(TouchlineController.getTypeName()) as TouchlineController
}
export function scriptOn<T>(objName: string, typeName: unknown): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return findSceneObjectByName(objName).getComponent(typeName as any) as unknown as T
}
export function log(msg: string): void {
  print(`[TouchlineLEAF] ${msg}`)
}
export async function waitFor(cond: () => boolean, timeoutMs: number, stepMs = 50): Promise<boolean> {
  const start = getTime()
  while (getTime() - start < timeoutMs / 1000) {
    if (cond()) return true
    await sleep(stepMs)
  }
  return cond()
}
export async function ensureLive(): Promise<void> {
  const c = controller()
  if (c.state === "REPLAY") {
    // Pinching the active marker again ends the replay (documented state transition).
    const id = c.activeMomentId
    await new DefaultLeafInteractor().trigger(findInteractableByName(`Marker_${id}`))
    await waitFor(() => controller().state === "LIVE", 2000)
  }
}

