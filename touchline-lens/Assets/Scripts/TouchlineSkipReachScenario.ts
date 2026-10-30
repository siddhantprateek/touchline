// TouchlineSkipReachScenario — Touchline LEAF scenario (see TouchlineLeafHelpers for lookup contracts).
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep, withTimeout} from "Leaf.lspkg/Utils/common/Utils"
import {controller, ensureLive, log} from "./TouchlineLeafHelpers"

/** Extra (not a done criterion): IK reach to the Skip button — a reachability finding, not a gate. */
@component
export class TouchlineSkipReachScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    await ensureLive()
    const before = controller().clockSec
    const ik = createIKInteractor()
    await withTimeout(ik.trigger(findInteractableByName("SkipButton")), 20000, "IK trigger on SkipButton timed out")
    await sleep(300)
    log(`IK skip: clock ${before.toFixed(1)} -> ${controller().clockSec.toFixed(1)}`)
    expect(controller().clockSec > before + 3, "IK pinch on Skip advanced the clock").toBe(true)
  }
}
