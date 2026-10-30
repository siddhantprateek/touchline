// TouchlinePlacementScenario — Touchline LEAF scenario (see TouchlineLeafHelpers for lookup contracts).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log} from "./TouchlineLeafHelpers"

/** Done criterion 1: placing the Lens shows the pitch on the table at the planned size. */
@component
export class TouchlinePlacementScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const turf = findSceneObjectByName("Turf").getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const table = findSceneObjectByName("TableTop").getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const tMin = turf.worldAabbMin()
    const tMax = turf.worldAabbMax()
    const size = tMax.sub(tMin)
    const tableTop = table.worldAabbMax().y
    const centre = tMin.add(tMax).uniformScale(0.5)
    const cam = findSceneObjectByName("Camera Object").getTransform().getWorldPosition()
    const dist = centre.distance(cam)
    log(`pitch ${size.x.toFixed(1)} x ${size.z.toFixed(1)} cm, turf top ${tMax.y.toFixed(1)}, table top ${tableTop.toFixed(1)}, distance ${dist.toFixed(1)} cm`)
    expect(Math.abs(size.x - 60) <= 2, `pitch length ${size.x} ≈ 60 cm`).toBe(true)
    expect(Math.abs(size.z - 40) <= 2, `pitch width ${size.z} ≈ 40 cm`).toBe(true)
    expect(tMin.y >= tableTop - 0.5 && tMax.y - tableTop <= 1.5, "turf sits on the table top").toBe(true)
    expect(dist >= 60 && dist <= 160, `pitch ${dist} cm from the camera (60–160)`).toBe(true)
  }
}
