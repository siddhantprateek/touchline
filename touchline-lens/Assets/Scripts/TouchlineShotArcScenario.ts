// TouchlineShotArcScenario — Touchline LEAF scenario (see TouchlineLeafHelpers for lookup contracts).
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {controller, ensureLive, HERO_MOMENT, log, scriptOn, waitFor} from "./TouchlineLeafHelpers"
import {TouchlineShotArc} from "./TouchlineShotArc"

/** Done criterion 3: the final shot arcs off the table into the room and returns into the net. */
@component
export class TouchlineShotArcScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const c0 = controller()
    if (!(c0.state === "REPLAY" && c0.activeMomentId === HERO_MOMENT)) {
      await ensureLive()
      await new DefaultLeafInteractor().trigger(findInteractableByName(`Marker_${HERO_MOMENT}`))
    }
    const arc = scriptOn<TouchlineShotArc>("ShotArc", TouchlineShotArc.getTypeName())
    const arcBall = findSceneObjectByName("ShotArcBall")
    // Sample the arc ball every frame: peak height above the table, and the bulge toward the user.
    let peak = 0
    let maxDrop = 0
    let maxToward = -999
    const started = await waitFor(() => arc.isPlaying(), 15000, 16)
    expect(started, "goal replay reaches the shot and starts the arc").toBe(true)
    while (arc.isPlaying()) {
      const p = arcBall.getTransform().getLocalPosition()
      peak = Math.max(peak, p.y)
      maxDrop = Math.max(maxDrop, peak - p.y)
      maxToward = Math.max(maxToward, p.z)
      await sleep(16)
    }
    const land = arc.lastLanding
    log(`arc peak ${peak.toFixed(1)} cm, max drop ${maxDrop.toFixed(2)} cm, max toward user z=${maxToward.toFixed(1)}, landing (${land.x.toFixed(1)}, ${land.y.toFixed(1)}, ${land.z.toFixed(1)})`)
    // A driven shot: height only climbs (no lob that drops into the net).
    expect(maxDrop <= 0.05, "ball never comes back down on the way to the net").toBe(true)    // Goal volume (pitch-local): behind the goal line, between the posts (±2 cm), under the bar.
    expect(Math.abs(land.x) >= 29.9 && Math.abs(land.x) <= 31.3, "lands behind the goal line").toBe(true)
    expect(Math.abs(land.z) <= 2.1, "lands between the posts").toBe(true)
    expect(land.y >= 0 && land.y <= 2.5, "lands under the crossbar").toBe(true)
    const back = await waitFor(() => controller().state === "LIVE", 4000)
    expect(back, "returns to LIVE after the goal").toBe(true)
  }
}
