# Devpost submission: Touchline

Paste each section into the matching field on the Devpost "Enter a Submission" form.

---

## Tagline

A second screen for football that isn't a screen. Replay any goal in 3D on your coffee table, without picking up your phone.

---

## Inspiration

Watching football at home now means two screens. The match is on the TV, and the phone is in your hand for the replay, the lineup and the "who made that pass?" moment. Every time you look down, you miss the next attack.

The phone is the wrong shape for it. It pulls your eyes away from the TV and flattens a 3D sport into a 6-inch rectangle. A goal goes in, and you get one broadcast angle, once.

Glasses can do what a phone can't: put the replay in your room, at the right size, right where you're already looking. So we asked a simple question: what if the second screen was the coffee table?

## What it does

Touchline puts a 60 × 40 cm 3D pitch flat on your coffee table, below the TV.

- **Live formations.** During play, calm dots show both teams' shape. They update as substitutions and tactical shifts happen.
- **A timeline of moments.** Every shot gets a marker along the near edge of the pitch. Goals are bigger and glow. When a new moment happens, its marker pulses with a soft crowd roar from the table.
- **3D replays.** Pinch a marker and the tiny players run the attacking move, built from real match data. The rest of the table dims slightly so the move stands out.
- **The pop-out goal.** On goals only, the shot curls off the table about 25 cm into your room, then drops back into the net. It only happens on goals, so it stays special.
- **Player cards.** Pinch a player to see their shirt number, name, position and touches so far. The card fades by itself after about 4 seconds.
- **Scrub and skip.** Drag a slider to scrub a replay slowly, or press **Skip to next moment** to jump ahead.

The demo uses Argentina 3–3 France from December 2022: six goals, three penalties, 30 moments in total. The hero replay is Di María's 35th-minute team goal.

Since the preview can't sync with a real broadcast, a recorded match plays on a simulated clock. A **LIVE** label and the Skip button stand in for real-time sync.

**Who it's for:** football fans watching at home who want to understand a moment, not just see it again. **Why glasses:** on a phone you look away from the TV and squint at a flat replay. Here the replay sits right below the TV, in 3D, and you can lean in and see the angle the striker had.

## How we built it

**Planning first, with the Devpost Learn skill pack.** The `plan-lens` skill interviewed us about the idea and checked each answer against AR design habits and what the Lens Studio preview can do. The result is a design brief (`devpost/design-brief.md`) with placement in centimetres, the interactions, when things show and hide, and five done criteria. We followed it with a structural plan (`docs/plan.md`) that covers the data pipeline, coordinate mapping, state machine and script modules.

**The data pipeline.** We used [StatsBomb open data](https://github.com/statsbomb/open-data): events, lineups and 360 freeze-frames for one match, about 13 MB of JSON. A Python script:
1. flips the away team's events so both teams share one fixed pitch (StatsBomb records every event from the acting team's point of view)
2. turns each of the 30 shots into a moment
3. rebuilds each replay: the ball follows the passes, carries and shot, and the 22 players are matched frame to frame from 360 snapshots into continuous tracks
4. writes everything into one 101 kB TypeScript module that ships inside the Lens, with no network needed

StatsBomb's pitch is 120 × 80 units, so on a 60 × 40 cm table pitch, one unit is exactly 0.5 cm.

**The build, with CLAD.** We handed the approved brief to CLAD's Specs Experience Builder, which worked in Lens Studio through the Lens Studio MCP. It generated the crowd roar and net sounds locally, then wrote the TypeScript components. Then it bootstrapped the scene:
- a virtual coffee table and TV
- the pitch, built in code
- 22 player tokens with 4 cm pinch areas
- the timeline
- the replay player and shot arc
- the scoreboard, player card, slider and Skip button, built with Spectacles UI Kit

A single controller owns the state (LIVE or REPLAY). The views never talk to each other.

**Testing, with LEAF.** Each done criterion has a LEAF scenario that runs in the preview. All five pass: the pitch is placed at the right size, the goal replay animates, the shot arc rises and lands in the net, the player card appears and fades, and Skip jumps the clock.

## Challenges we ran into

- **Event data isn't tracking data.** StatsBomb records where the ball went and snapshots of where players stood, not continuous runs. We rebuilt motion by matching anonymous 360 dots from frame to frame and smoothing between them. Replays show the shape of a move, not exact runs, and we say so.
- **Only the player on the ball has a name.** 360 dots are anonymous. Named players (the ones touching the ball, plus the keepers) are pinchable in replays; the rest show their team colour.
- **Tiny players, big fingers.** At this scale a player is about 1.5 cm tall. Each one gets an invisible 4 cm pinch area, so pinching stays forgiving.
- **The display is additive.** On SPECS, black renders as transparent, so the whole Lens uses light colours and light text.
- **No live broadcast in the preview.** We made the stand-in obvious and honest: a simulated clock, a LIVE label, and a Skip button.

## Accomplishments that we're proud of

- The pop-out goal. Watching the ball leave the table into the room is the moment glasses can do and a phone can't.
- Real match data, not hand-animated players. Every replay comes from the actual events of the match.
- All five done criteria pass as automated LEAF tests in the preview.
- A clean data pipeline: one command regenerates the Lens data for any StatsBomb match.

## What we learned

- **The design matters more than the code.** The planning interview changed the idea: the pitch went from a floating panel to the coffee table, and the pop-out became goals-only so it stays special.
- **Put information on the thing it's about.** The score floats above the far end of the pitch, and the player card appears next to the player you pinched.
- **Show things when needed, then get out of the way.** Cards fade by themselves and the table dims only during replays.
- **Fake the sensing, keep the response.** The preview can't watch a TV, so the simulated clock stands in for sync while everything after it is real.

## What's next for Touchline

- Sync with a live match feed instead of a recorded one
- A menu on the table to pick from more matches
- The penalty prediction mini-game: drag a target to where you think the kick goes, then watch it
- Real player tracking data for true off-ball runs

---

## Built with

lens-studio, specs, spectacles-interaction-kit, spectacles-ui-kit, clad, lens-studio-mcp, leaf, typescript, python, statsbomb

## Links

- Repo: https://github.com/siddhantprateek/touchline
- Video: *(add the YouTube link once it's uploaded)*

## Credit

Data provided by StatsBomb, used under the StatsBomb public data user agreement. No team crests or tournament branding are used.
