// TouchlineSkipScenario — Touchline LEAF scenario (see TouchlineLeafHelpers for lookup contracts).
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {controller, ensureLive, log, scriptOn, waitFor} from "./TouchlineLeafHelpers"
import {TouchlineTimelineView} from "./TouchlineTimelineView"

/** Done criterion 5: "Skip to next moment" jumps the simulated clock to the next marker. */
@component
export class TouchlineSkipScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    await ensureLive()
    const c = controller()
    const before = c.clockSec
    const next = c.moments.find((m) => m.sec - 3 > before + 0.01)
    expect(next !== undefined, "there is a next marker").toBe(true)
    await new DefaultLeafInteractor().trigger(findInteractableByName("SkipButton"))
    await sleep(100)
    const after = controller().clockSec
    log(`clock ${before.toFixed(1)} -> ${after.toFixed(1)}, next marker ${next.id} at ${next.sec}`)
    // jump lands at next.sec - 3 (plus at most ~0.2 s of clock running at 10x after the jump)
    expect(after >= next.sec - 3 - 0.01 && after <= next.sec - 3 + 2.5, `clock jumped to ≈ ${next.sec - 3}`).toBe(true)
    const timeline = scriptOn<TouchlineTimelineView>("Timeline", TouchlineTimelineView.getTypeName())
    const pulsed = await waitFor(() => timeline.isPulsing(next.id), 2500)
    expect(pulsed, `marker ${next.id} pulses when the clock reaches it`).toBe(true)
  }
}
