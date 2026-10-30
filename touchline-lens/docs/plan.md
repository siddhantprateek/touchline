# Touchline: structural plan

A 3D miniature pitch on the coffee table, a second screen for the match on TV. It shows formations live and replays big moments in 3D, and goals curl out of the table into the room.

- Design intent: [`devpost/design-brief.md`](../devpost/design-brief.md). The brief is the source of truth for what to build. This file covers how.
- Platform: SPECS. It's built and demoed in the Lens Studio 5.23 preview only.
- Data: [StatsBomb open data](https://github.com/statsbomb/open-data), pre-processed offline into one bundled TypeScript module.

---

## 1. Where the project is today

`touchline-lens/` is an untouched **SPECS Base Template**:

| Path | State |
|---|---|
| `touchline-lens.esproj` | Lens Studio 5.23.2, `lensClientCompatibilities: Spectacles` |
| `Assets/Scene.scene` | Camera Object, Lighting, SIK hand visuals / `HandInteractor`, `SIKLogLevelConfiguration` |
| `Assets/Render/` | Device camera texture, render target, `Echopark.hdr` env map |
| `Packages/` | `SpectaclesInteractionKit.lspkg`, `SpectaclesUIKit.lspkg` (both already installed) |
| `.mcp.json` | `lens-studio` MCP on `localhost:50040` (also registered at user scope) |
| `AGENTS.md` / `CLAUDE.md` | Lens Studio-managed agent reference (cm units, `BaseScriptComponent`, MCP-only rule) |

There are no scripts, materials or prefabs yet. Everything below is new.

---

## 2. The data: what StatsBomb gives us and what it doesn't

### Chosen match
**2022 FIFA World Cup Final, Argentina 3–3 France** (`competition_id 43`, `season_id 106`, `match_id 3869685`). It has 360 data.

| File | Size | Use |
|---|---|---|
| `data/events/3869685.json` | 3.7 MB, 4,407 events | timeline, replays, touches, formations |
| `data/three-sixty/3869685.json` | 9.0 MB, 3,683 frames | other players' positions during replays |
| `data/lineups/3869685.json` | small | shirt numbers, names, positions for player cards |

The final has six goals, so the timeline is full and each kind of replay gets used:

| Period | Clock | Scorer | Type | Shot freeze-frame | 360 |
|---|---|---|---|---|---|
| 1 | 22:24 | Messi | Penalty | – | ✔ |
| 1 | 35:22 | Di María | Open play: **hero replay** (the team move) | 8 players | ✔ |
| 2 | 79:24 | Mbappé | Penalty | – | ✔ |
| 2 | 80:59 | Mbappé | Open play (volley) | 11 | ✔ |
| 4 (ET) | 107:58 | Messi | Open play | 10 | ✔ |
| 4 (ET) | 117:05 | Mbappé | Penalty | – | ✔ |

There are 38 shots in total. The 30 from normal and extra time become timeline markers; the 8 from the penalty shootout are left out.

### Data facts the design has to respect
1. **StatsBomb is event data, not tracking data.** We get the ball's start and end location and the acting player for each event, and *snapshots* of other players (360 frames and shot freeze-frames). We don't get continuous player runs. Replays are **reconstructed** by interpolating between snapshots. This is already listed in the brief's risks.
2. **360 player dots are anonymous.** They have `teammate`, `actor` and `keeper` flags but no player id. Only the event's actor has a known identity.
3. **Every event is normalized so the acting team attacks left→right** on a 120 × 80 pitch (x along the length, y across the width, origin at the top-left corner). The pipeline must un-flip away-team events and 360 frames into one fixed frame.
4. Shot `end_location` has a z (height, in yards). For goals we use it to aim the final point of the pop-out arc inside the net.
5. **Licence:** the StatsBomb public data user agreement requires crediting StatsBomb. We'll add a small "Data: StatsBomb" credit under the scoreboard, plus the logo and link in the README.

### Offline pipeline: `tools/statsbomb/`

```
tools/statsbomb/
  fetch.py          # download events / lineups / three-sixty for one match_id → raw/ (gitignored)
  build_match.py    # raw/*.json → Assets/Scripts/Data/MatchData.ts
  README.md         # how to regenerate, licence and attribution
```

`tools/` lives outside `Assets/`, so Lens Studio never imports the 13 MB of raw JSON. Run Python with `-I -X utf8`, because the raw files contain non-ASCII names that break Windows' cp1252 default.

`build_match.py` does the following:

1. **Fixed frame.** Use home team (Argentina) → attacks +x in every period. For away-team events and their 360 frames, x' = 120 − x, y' = 80 − y. (Ignore half-time end swaps: on a coffee table a fixed orientation is easier to read. See open decisions.)
2. **Lineups and formations.** From the two `Starting XI` events (`tactics.formation`, `tactics.lineup[].position.id`), map each StatsBomb position id → a (x, y) slot template for the formation dots. Apply `Substitution` and `Tactical Shift` events so the dots change over time.
3. **Moments.** Make one entry per `Shot`: id, period, match clock in seconds, team, player, outcome, `isGoal`, `isPenalty`.
4. **Replay track per moment.** Walk back from the shot through the same `possession` (and cap it at about 12 s and about 8 ball events):
   - **Ball keyframes:** for each Pass / Carry / Dribble / Shot, `location` at `t`, then `end_location` at `t + duration`.
   - **Actor keyframes:** the named player is at the ball's location for their own event.
   - **The other 21 tokens:** take the 360 frame for each event in the chain and **match dots frame to frame** (greedy nearest-neighbour inside each team, actor fixed). This turns snapshots into 22 continuous tracks. Fill gaps where a player is outside `visible_area` by holding their last position, or by their formation slot if we've never seen them.
   - **Penalties:** synthetic track. Shooter run-up to the spot, keeper on the line, ball to `end_location`.
5. **Touches.** For each player, store a sorted array of clock seconds of their on-ball events (Pass, Carry, Ball Receipt, Dribble, Shot, Clearance…). The card shows `count(t ≤ now)`, so touches update with the simulated clock.
6. **Output:** one `MatchData.ts` that exports a typed `const`, budgeted at **< 250 kB**. Values are rounded to 0.1 units and dictionary-coded where repeated. A TS module avoids any question about JSON-asset loading at runtime.

### Bundled data shape (`Assets/Scripts/Data/MatchTypes.ts`)

```ts
export interface PlayerInfo { id: number; name: string; short: string; number: number; position: string; team: 0 | 1; touches: number[] }
export interface FormationSpan { fromSec: number; slots: { playerId: number; x: number; y: number }[] } // per team
export interface Moment { id: string; sec: number; label: string; team: 0 | 1; playerId: number; isGoal: boolean; isPenalty: boolean; replay: Replay }
export interface Replay {
  durationSec: number
  ball: Key3[]                               // [t, x, y, z]
  tokens: { team: 0 | 1; playerId: number | null; keys: Key2[] }[]  // 22 tracks; playerId null = anonymous
  shot: { from: [number, number]; to: [number, number, number] }   // drives the pop-out arc
}
type Key2 = [t: number, x: number, y: number]
type Key3 = [t: number, x: number, y: number, z: number]
export interface MatchData { home: TeamInfo; away: TeamInfo; players: PlayerInfo[]; formations: [FormationSpan[], FormationSpan[]]; moments: Moment[]; goalsTimeline: { sec: number; team: 0 | 1 }[] }
```

---

## 3. Space: pitch coordinates → centimetres

The pitch is 60 × 40 cm and StatsBomb's is 120 × 80, so **1 StatsBomb unit = 0.5 cm**. That's a clean scale.

```
PitchSpace.toLocal(sx, sy, sz = 0):
  x_cm =  (sx - 60) * 0.5          // −30 … +30 along the length (left→right as the user sees it)
  z_cm =  (sy - 40) * 0.5          // −20 … +20 across; near touchline toward the user
  y_cm =  sz * 0.5 + 0.3           // lift tokens just above the turf
```

The pitch's long axis runs across the user's view (left to right), parallel to the TV. That way both goals stay inside SPECS' roughly 32° horizontal view at about 1.2 m.

Real-world placements (from the brief; values marked *(default)* there):

| Element | Position (relative to user start) | Size |
|---|---|---|
| Coffee table (virtual) | 120 cm forward, top at 45 cm high | ~90 × 55 cm |
| Pitch | on the table top, centred | 60 × 40 cm |
| TV panel (virtual, *open decision*) | 220 cm forward, centre ~100 cm high | ~100 × 57 cm |
| Timeline strip | along the near touchline, 2 cm outside it | 60 × 1 cm, markers ~3 cm |
| Replay slider | below the timeline strip | ~30 cm |
| Skip button | near-right corner | ~5 cm |
| Scoreboard / LIVE clock | 10 cm above the far touchline, faces the user | ~16 × 5 cm |
| Player card | beside the pinched player, faces the user | ~8 × 5 cm |
| Players | tokens on the pitch | ~1.5 cm visual, **~4 cm pinch collider** |

On start, `TableAnchor` places the root once, relative to the camera's start pose: forward on the horizontal plane, table top about 45 cm above the floor. It doesn't follow the head after that.

Colours: the display is additive (black is transparent). Use a mid-green, light pitch lines, **light blue / white for Argentina, bright royal blue with a white outline for France**, and light text. Never put dark UI on dark.

---

## 4. Runtime architecture

### State machine (owned by `TouchlineController`)

```
          ┌──────────── pinch marker ────────────┐
          │                                      ▼
   ┌─────────────┐   skip  ┌──────────┐    ┌───────────────┐
   │    LIVE     │────────▶│  JUMP    │    │    REPLAY     │
   │ clock runs  │◀────────│ clock →  │    │ clock paused  │
   │ formation   │         │ next mark│    │ table dims    │
   │ dots        │         └──────────┘    │ tokens animate│
   └─────────────┘◀───── replay ends / ────│ slider shown  │
                         pinch marker again└───────────────┘
                                                 │ goal & t ≥ shot
                                                 ▼
                                          ShotArc pop-out → back into net
```

- **LIVE.** `MatchClock` advances simulated match time. Default 1 match-second per 0.1 real seconds (10×, *tunable*), so the demo reaches a goal in seconds. It starts at **21:30**, 54 s of match time before Messi's penalty. When the clock passes a moment, its marker pulses and the crowd roar plays.
- **REPLAY(momentId).** The clock pauses. `ReplayPlayer` drives `t ∈ [0, duration]`, either automatically or from the slider. Pitch and table brightness drop to about 60 %. When it ends, it goes back to LIVE at the paused clock.
- **Skip.** `MatchClock.jumpTo(nextMoment.sec − 3)`. The marker then pulses normally.

### Scene hierarchy (new objects under one root)

```
Touchline (TableAnchor, TouchlineController)
├── Table                       // virtual coffee table mesh
├── TV                          // optional, see open decisions
└── Pitch (PitchSpace)
    ├── Turf + Lines + Goals    // PitchBuilder (procedural or simple mesh + texture)
    ├── Tokens                  // 22 × PlayerToken prefab (visual + 4 cm collider + SIK Interactable)
    ├── Ball
    ├── ShotArc                 // trail + ball clone for pop-out
    ├── Timeline                // strip + N × MomentMarker prefab (SIK PinchButton)
    ├── ReplaySlider            // UI Kit Slider, hidden in LIVE
    ├── SkipButton              // UI Kit button: "Skip to next moment ⏭"
    ├── Scoreboard              // "ARG 1–0 FRA · LIVE 67:12" + "Data: StatsBomb"
    ├── PlayerCard              // single reused card
    └── Audio                   // crowd roar (spatial, on pitch), kick, net
```

### Scripts: `Assets/Scripts/`

| Module | Responsibility | Depends on |
|---|---|---|
| `Data/MatchTypes.ts` | interfaces above | – |
| `Data/MatchData.ts` | **generated**, do not hand-edit | MatchTypes |
| `Core/PitchSpace.ts` | StatsBomb ↔ local cm; Hermite/linear key sampling helpers | – |
| `Core/MatchClock.ts` | simulated clock, speed, `jumpTo`, `pause/resume`, `onMomentReached` event | MatchData |
| `Core/TouchlineController.ts` | state machine; wires views together; single owner of state | all views |
| `Core/TableAnchor.ts` | one-shot placement relative to camera on start | – |
| `View/PitchBuilder.ts` | turf, lines, goals at 0.5 cm/unit | PitchSpace |
| `View/FormationView.ts` | positions the 22 tokens at formation slots for current clock; gentle idle drift | MatchData, PitchSpace |
| `View/PlayerToken.ts` | one token: team colour, highlight on hover, `onPinched(playerId)` | SIK |
| `View/TimelineView.ts` | markers laid out by `sec / 7200 × 60 cm` (extra time compressed); goal markers larger and glowing; pulse | MatchData, SIK |
| `View/ReplayPlayer.ts` | samples ball and token tracks at `t`; `setT()` for the slider; `onFinished` | PitchSpace |
| `View/ShotArc.ts` | goal-only: cubic Bézier from shot location, peak ~25 cm above table and ~15 cm toward the user, back down into the net at `shot.to`; ~1.6 s; trail | PitchSpace |
| `View/PlayerCard.ts` | shows number, short name, position, `touches ≤ now`; auto-fade after 4 s | MatchData, MatchClock |
| `View/Scoreboard.ts` | score from `goalsTimeline ≤ now`, `LIVE mm:ss` | MatchClock |
| `UI/SkipButton.ts`, `UI/ReplayScrubber.ts` | thin UI Kit wrappers that call the controller | UI Kit |
| `Audio/CrowdAudio.ts` | roar on moment reached (louder for goals), net sound on arc landing | – |

Rules: views never talk to each other, only to `TouchlineController`. All SIK and UI Kit subscriptions bind in `OnStartEvent`, not `onAwake` (SIK init order). Everything is in cm.

### Player identity during replays
Only the **actors** in a replay have known identities (see data fact 2). The plan:
- In **LIVE**, every token is a lineup player, so every token is pinchable.
- In **REPLAY**, named tokens (actors) are pinchable and get a subtle ring. Anonymous tokens show their team colour only and ignore pinches.

---

## 5. Build order (each step ends visible in the preview)

| # | Milestone | Proves | Done criterion |
|---|---|---|---|
| 0 | `tools/statsbomb` pipeline → `MatchData.ts` (< 250 kB), with a sanity script that prints moments + goal tracks | data shape | – |
| 1 | `TableAnchor` + table + `PitchBuilder` at 60 × 40 cm | placement and scale | **1** |
| 2 | `MatchClock` + `Scoreboard` + `FormationView` (22 dots) | LIVE mode | – |
| 3 | `TimelineView` markers + pulse + `CrowdAudio` + `SkipButton` | timeline | **5** |
| 4 | `ReplayPlayer` on the Di María goal (hero), dimming, auto-return to LIVE | replay | **2** |
| 5 | `ShotArc` pop-out on goals | the wow moment | **3** |
| 6 | `PlayerToken` pinch + `PlayerCard` fade | cards | **4** |
| 7 | `ReplayScrubber` slider | scrubbing | – |
| 8 | Polish: colours on additive display, token hit areas, StatsBomb credit | comfort | – |
| 9 | *(stretch)* Penalty prediction: before a penalty moment, drag a target into the goal mouth, then reveal | mini-game | – |

## 6. LEAF tests (one per done criterion)

| # | Scenario | Assert |
|---|---|---|
| 1 | Start the Lens | `Pitch` world bounds ≈ 60 × 40 cm (±2), top surface ≈ table top, within 0.6–1.6 m of the camera |
| 2 | Pinch the 35:22 goal marker | state = REPLAY; ball and ≥ 10 tokens change position over 1 s; table dimmed |
| 3 | Same replay, run to end | `ShotArc` ball reaches y ≥ table + 20 cm, then ends inside the goal volume |
| 4 | Pinch a token in LIVE | `PlayerCard` enabled with that player's number; alpha → 0 within 5 s |
| 5 | Pinch Skip at 21:30 | clock jumps to ≈ 22:21 (next marker − 3 s); the next marker pulses |

## 7. Open decisions (the learner's call)

1. **Virtual TV in the scene?** It makes "below the TV" read in the demo video, but it's extra geometry. Currently planned as a simple panel.
2. **Fixed pitch orientation vs. real half-time end swaps.** Planned as fixed (Argentina always attacking right) for readability.
3. **Which goal opens the demo video.** The Di María team move (35:22) is planned as the hero.
4. **Clock speed.** 10× is planned. Real time would never reach a goal in a 3-minute video.
5. **Should anonymous players be pinchable in replays?** Planned: no (see §4).

## 8. Out of scope for this version
Live broadcast sync, real TV or table recognition, more than one match, the penalty shootout (period 5), true player tracking, multiplayer, persistence between sessions.
