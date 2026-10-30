// TouchlineReplayScenario — Touchline LEAF scenario (see TouchlineLeafHelpers for lookup contracts).
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {controller, ensureLive, HERO_MOMENT, log, scriptOn} from "./TouchlineLeafHelpers"
import {TouchlineFormationView} from "./TouchlineFormationView"

/** Done criterion 2: pinching the goal marker replays the attacking move with animated players. */
@component
export class TouchlineReplayScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    await ensureLive()
    await new DefaultLeafInteractor().trigger(findInteractableByName(`Marker_${HERO_MOMENT}`))
    await sleep(150)
    const c = controller()
    expect(c.state, "state after pinching the goal marker").toBe("REPLAY")
    expect(c.activeMomentId, "replaying the pinched moment").toBe(HERO_MOMENT)
    expect(c.isDimmed, "table and pitch dimmed during the replay").toBe(true)
    const ball = findSceneObjectByName("ReplayBall")
    const formation = scriptOn<TouchlineFormationView>("Tokens", TouchlineFormationView.getTypeName())
    const ball0 = ball.getTransform().getLocalPosition()
    const tok0 = formation.getTokenLocalPositions()
    await sleep(1000)
    const ball1 = ball.getTransform().getLocalPosition()
    const tok1 = formation.getTokenLocalPositions()
    let moved = 0
    for (let i = 0; i < Math.min(tok0.length, tok1.length); i++) if (tok0[i].distance(tok1[i]) > 0.05) moved++
    log(`ball moved ${ball0.distance(ball1).toFixed(2)} cm, ${moved}/${tok1.length} tokens moved in 1 s`)
    expect(ball.enabled, "replay ball visible").toBe(true)
    expect(ball0.distance(ball1) > 0.5, "ball moves during the replay").toBe(true)
    expect(moved >= 10, `>= 10 tokens animate (got ${moved})`).toBe(true)
  }
}
