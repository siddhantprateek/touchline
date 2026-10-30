# Touchline

### A second screen for football that isn't a screen.

[GitHub](https://github.com/siddhantprateek/touchline) · Built for [Learn AR with SPECS](https://learn-specs.devpost.com/)

You're on the sofa, the match is on TV, and a goal goes in. **Touchline puts a 3D miniature pitch on your coffee table, so you can replay that goal in 3D without picking up your phone.**

Pinch the goal marker. Tiny players run the attacking move, and the final shot curls off the table into your room before dropping into the net.


## The problem

Watching football at home now means two screens. The match is on the TV, and your phone is in your hand for the replay, the lineup or the "who was that?" moment. Every time you look down, you miss the next attack.

You've probably done all of these:

- A goal goes in and you wait for the broadcast replay, which shows one camera angle, once.
- You open an app to check who made the pass, and by the time you find it, play has restarted.
- You squint at a flat 2D replay on a 6-inch screen, trying to work out the angle the striker had.

The phone is the wrong shape for this. It pulls your eyes away from the TV and flattens a 3D sport into a rectangle. Touchline keeps your eyes up, puts the replay right below the TV, and lets you lean in and see the move from any side.

## What you get

| | |
|---|---|
| **A pitch on your table** | A 60 × 40 cm pitch sits flat on the coffee table, below eye level and in front of the TV |
| **Live formations** | Calm dots show both teams' shape and update as substitutions and tactical shifts happen |
| **A timeline of moments** | Every shot gets a marker along the near touchline. Goals are bigger and glow. New moments pulse with a soft crowd roar |
| **3D replays** | Pinch any marker and the players replay the move with real event and positioning data. The rest of the table dims slightly |
| **The pop-out goal** | On goals only, the ball leaves the table, arcs about 25 cm into the room and drops back into the net |
| **Player cards** | Pinch a player to see shirt number, name, position and touches so far. The card fades by itself after about 4 seconds |
| **Scrub and skip** | Drag a slider to scrub a replay slowly, or press **Skip to next moment** to jump the clock |

## How it works

```
StatsBomb open data -> fixed pitch frame -> moments + replay tracks -> MatchData.ts
                                                                           |
          LIVE (clock runs, formations) <-> REPLAY (tokens animate, arc on goals)
```

1. **Fetch** one match from StatsBomb open data: events, lineups and 360 freeze-frames (about 13 MB of JSON).
2. **Normalize** to a fixed frame. StatsBomb records every event from the acting team's point of view, so the away team's events are flipped and both teams share one pitch.
3. **Build moments.** Each of the 30 shots becomes a timeline marker with its own replay.
4. **Reconstruct replays.** The ball follows the passes, carries and shot of the attack. The 22 players are placed from 360 freeze-frames and matched frame to frame into continuous tracks.
5. **Bundle** everything into one 101 kB TypeScript module that ships inside the Lens. No network needed.
6. **Run** a simple state machine in the Lens: LIVE, where the simulated clock runs and dots show formations, and REPLAY, where the clock pauses and the move plays out.

We're honest about what the data can and can't do. StatsBomb is event data, not player tracking: it records where the ball went and snapshots of where players stood, not their continuous runs. Replays show the shape of a move, smoothed between real snapshots. Only the players on the ball are named; the rest show their team colour.

### The stand-in for live sync

The Lens Studio preview can't sync with a real broadcast, so Touchline plays a recorded match on a simulated clock. A **LIVE** label and a **Skip to next moment** button stand in for real-time sync. The clock starts at 21:30, 54 seconds before the first goal, and runs at 10× so the demo reaches a goal in seconds.

### The match

**Argentina 3–3 France, December 2022.** Six goals, three penalties and 360 data for every one of them.

| Clock | Scorer | Type |
|---|---|---|
| 22' | Messi | Penalty |
| 35' | Di María | Open play, the team move used as the hero replay |
| 79' | Mbappé | Penalty |
| 80' | Mbappé | Open play, volley |
| 107' | Messi | Open play |
| 117' | Mbappé | Penalty |

## Tested in the preview

Every done criterion from the design brief has a LEAF test that runs in the Lens Studio preview.

| # | Done criterion | Result |
|---|---|---|
| 1 | Placing the Lens shows the pitch on the table at the planned size (60 × 40 cm ± 2) | ✅ Pass |
| 2 | Pinching the goal marker replays the attacking move with at least 10 animated players | ✅ Pass |
| 3 | The final shot rises 20 cm or more above the table and lands between the posts, under the bar | ✅ Pass |
| 4 | Pinching a player shows their card with shirt number, and it fades out within 5 s | ✅ Pass |
| 5 | Skip jumps the clock to 3 s before the next marker, and that marker pulses | ✅ Pass |

## Try it

You need [Lens Studio](https://ar.snap.com/lens-studio) 5.23 or later. No SPECS glasses needed.

1. Open `touchline-lens/touchline-lens.esproj`.
2. In the Preview panel, switch to **Interactive Preview**.
3. WASD moves, Q and E go down and up, right-drag looks around, and a click acts as a pinch.

**Regenerate the match data** (optional, needs Python 3.11+):

```bash
cd touchline-lens/tools/statsbomb
python -I -X utf8 fetch.py
python -I -X utf8 build_match.py
```

Pass a different StatsBomb `match_id` to both scripts to load another match.

## Built with

Lens Studio 5.23, SPECS, Spectacles Interaction Kit, Spectacles UI Kit, LEAF, CLAD (Snap's Lens building agents), TypeScript, Python, and [StatsBomb open data](https://github.com/statsbomb/open-data).

## Repository map

| Folder | Contents |
|---|---|
| [`touchline-lens/`](touchline-lens) | The Lens Studio project |
| [`touchline-lens/Assets/Scripts/`](touchline-lens/Assets/Scripts) | Lens scripts: controller, clock, views, UI and LEAF tests |
| [`touchline-lens/Assets/Scripts/Data/`](touchline-lens/Assets/Scripts/Data) | Generated match data and its types |
| [`touchline-lens/tools/statsbomb/`](touchline-lens/tools/statsbomb) | Data pipeline: fetch and build |
| [`touchline-lens/devpost/`](touchline-lens/devpost/design-brief.md) | The design brief |
| [`touchline-lens/docs/`](touchline-lens/docs/plan.md) | The structural plan |

## What's next

- Sync with a live match feed instead of a recorded one
- More matches, chosen from a menu on the table
- The penalty prediction mini-game: drag a target to where you think the kick goes, then watch it
- Real player tracking data for true off-ball runs

