// TouchlineLeafIndex — registers the Touchline LEAF scenarios and (optionally) auto-runs them
// in order when the Lens starts, printing one PASS/FAIL line per scenario.
// autoRun is OFF by default so normal previews are not driven by the tests.
import {DefaultScenarioManager} from "Leaf.lspkg/Scenarios/scenario/manager/DefaultLeafScenarioManager"
import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {TouchlinePlacementScenario} from "./TouchlinePlacementScenario"
import {TouchlinePlayerCardScenario} from "./TouchlinePlayerCardScenario"
import {TouchlineReplayScenario} from "./TouchlineReplayScenario"
import {TouchlineShotArcScenario} from "./TouchlineShotArcScenario"
import {TouchlineSkipReachScenario} from "./TouchlineSkipReachScenario"
import {TouchlineSkipScenario} from "./TouchlineSkipScenario"

@component
export class TouchlineLeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "dc1-placement", typename: TouchlinePlacementScenario.getTypeName()},
    {id: "dc5-skip", typename: TouchlineSkipScenario.getTypeName()},
    {id: "dc2-replay", typename: TouchlineReplayScenario.getTypeName()},
    {id: "dc3-shot-arc", typename: TouchlineShotArcScenario.getTypeName()},
    {id: "dc4-player-card", typename: TouchlinePlayerCardScenario.getTypeName()},
    {id: "ik-skip-reach", typename: TouchlineSkipReachScenario.getTypeName()},
  ]

  @ui.label('<span style="color: #60A5FA;">TouchlineLeafIndex – LEAF scenarios for the 5 done criteria</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Run every registered scenario in order when the Lens starts (turn off for normal use)")
  autoRun: boolean = false
  @ui.group_end

  onAwake(): void {
    if (!this.autoRun) return
    this.createEvent("OnStartEvent").bind(() => {
      this.runAll()
    })
  }

  private async runAll(): Promise<void> {
    const mgr = DefaultScenarioManager.getInstance()
    await sleep(500)
    const results: string[] = []
    for (const id of mgr.listScenarioIds()) {
      try {
        await mgr.startScenario(id)
        results.push(`PASS ${id}`)
        print(`[TouchlineLEAF] PASS ${id}`)
      } catch (e) {
        results.push(`FAIL ${id}: ${e}`)
        print(`[TouchlineLEAF] FAIL ${id}: ${e}`)
      }
      await sleep(500)
    }
    print(`[TouchlineLEAF] SUMMARY ${results.join(" | ")}`)
  }
}
