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
    // Size in the pitch's own axes (a world AABB inflates when the preview camera is yawed).
    const ext = turf.mesh.aabbMax.sub(turf.mesh.aabbMin)
    const ws = turf.getTransform().getWorldScale()
    const size = new vec3(ext.x * ws.x, ext.y * ws.y, ext.z * ws.z)
    const tableTop = table.worldAabbMax().y
    const centre = tMin.add(tMax).uniformScale(0.5)
    const cam = findSceneObjectByName("Camera Object").getTransform().getWorldPosition()
    const dist = centre.distance(cam)
    log(`pitch ${size.x.toFixed(1)} x ${size.z.toFixed(1)} cm, turf top ${tMax.y.toFixed(1)}, table top ${tableTop.toFixed(1)}, distance ${dist.toFixed(1)} cm`)
    expect(Math.abs(size.x - 60) <= 2, `pitch length ${size.x} ≈ 60 cm`).toBe(true)
    expect(Math.abs(size.z - 40) <= 2, `pitch width ${size.z} ≈ 40 cm`).toBe(true)
    expect(tMin.y >= tableTop - 0.5 && tMax.y - tableTop <= 1.5, "turf sits on the table top").toBe(true)
    expect(dist >= 60 && dist <= 160, `pitch ${dist} cm from the camera (60–160)`).toBe(true)
    // Whole pitch inside SPECS' ~±18° vertical view from the start pose (camera looking straight ahead).
    const camT = findSceneObjectByName("Camera Object").getTransform()
    const fwd = camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    for (const p of [centre, new vec3(centre.x, tMax.y, tMax.z), new vec3(centre.x, tMax.y, tMin.z)]) {
      const dir = p.sub(cam).normalize()
      const deg = (Math.acos(Math.max(-1, Math.min(1, dir.dot(fwd)))) * 180) / Math.PI
      log(`pitch point ${deg.toFixed(1)}° off gaze`)
      expect(deg <= 18.5, `pitch point ${deg.toFixed(1)}° off gaze (≤ 18.5)`).toBe(true)
    }
  }
}
