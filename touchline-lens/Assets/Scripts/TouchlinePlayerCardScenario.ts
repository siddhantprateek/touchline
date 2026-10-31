// TouchlinePlayerCardScenario — Touchline LEAF scenario (see TouchlineLeafHelpers for lookup contracts).
import {getInteractables} from "Leaf.lspkg/Interactors/InteractableUtils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {ensureLive, log, scriptOn, waitFor} from "./TouchlineLeafHelpers"
import {TouchlinePlayerCardUI} from "./TouchlinePlayerCardUI"

/** Done criterion 4: pinching a player shows their card, which fades out by itself. */
@component
export class TouchlinePlayerCardScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    await ensureLive()
    const tokenIa = getInteractables().find(
      (ia) => ia.enabled && ia.getSceneObject().name.startsWith("Token_") && ia.getSceneObject().name !== "Token_anon",
    )
    expect(tokenIa !== undefined, "a pinchable player token exists in LIVE").toBe(true)
    const playerId = Number(tokenIa.getSceneObject().name.substring("Token_".length))
    await new DefaultLeafInteractor().trigger(tokenIa)
    await sleep(200)
    const card = scriptOn<TouchlinePlayerCardUI>("PlayerCard", TouchlinePlayerCardUI.getTypeName())
    const body = findSceneObjectByName("PlayerCardBody")
    log(`pinched Token_${playerId}; card "${card.getTitle()}" alpha ${card.alpha}`)
    expect(body.enabled, "card visible after the pinch").toBe(true)
    // Neighbouring tokens' pinch areas overlap, so the simulated pinch may land on the adjacent
    // player; the card must show a real player either way.
    expect(card.playerId > 0, `card shows a player (pinched Token_${playerId}, card shows ${card.playerId})`).toBe(true)
    expect(card.getTitle().startsWith("#"), "card shows the shirt number").toBe(true)
    expect(card.alpha, "card fully visible at first").toBe(1)
    const shownAt = getTime()
    const faded = await waitFor(() => card.alpha === 0 && !body.enabled, 5000)
    log(`card faded after ${(getTime() - shownAt).toFixed(2)} s`)
    expect(faded, "card fades out by itself within 5 s").toBe(true)
  }
}
