---
status: approved
---

# Design brief: Touchline

## The one spatial moment
Evening, watching a match on the sofa. A goal happens. Instead of waiting for the TV replay, I pinch the goal marker on the table. Tiny players replay the move, and the shot curls out of the table into my room.

## Why it belongs on glasses
- Uses: draws in the world (a 3D pitch on the coffee table, a shot that leaves the table into the room); leaves your body free (eyes stay up near the TV, no phone in hand).
- Why it's better than the phone or laptop version: "On a phone I look away from the TV and squint at a flat replay. Here the replay sits right below the TV, in 3D, and I can lean in and see the angle the striker had."

## Product or overlay
- Type: product. It's a second screen next to the TV, but it doesn't read the TV.
- What the real version would sense: a live match feed synced to the broadcast clock.
- Stand-in for the preview: a recorded match (StatsBomb open data, 2022 World Cup final, Argentina 3–3 France) played on a simulated clock. A "LIVE 67:12" label and a "Skip to next moment" button stand in for real-time sync.

## Where things live
- Where the user is looking during the main task: down at the coffee table, in front of and below the TV.
- Coffee table: a virtual table at real size, about 45 cm high and about 1.2 m in front of where the user starts (default). The preview has no real table.
- TV: a simple flat TV panel on the far side of the table, about 2.2 m from the user, so the "below the TV" layout reads in the demo (default; see open questions).
- Pitch: about 60 × 40 cm, flat on the coffee table, below eye level and in front of the TV.
- Timeline: a thin strip along the near edge of the pitch, with glowing markers for goals and shots. Markers about 3 cm (default), so they're easy to pinch.
- Score and clock: a small floating label above the far end of the pitch, about 10 cm up (default).
- Replay slider: along the near edge, next to the timeline, about 30 cm long (default). It shows only during a replay.
- "Skip to next moment" button: at the near-right corner of the pitch, about 5 cm (default).
- Player card: appears beside a player when pinched, about 8 × 5 cm (default), facing the user, and fades after a few seconds.

## Hands and input
- Pinch a timeline marker to replay that moment.
- Pinch a player for a quick card: shirt number, position, touches.
- Drag a slider to scrub through the replay slowly.
- Pinch "Skip to next moment" to jump the clock to the next marker.
- Optional mini-game, only if time allows: before a penalty, drag a target where you predict it goes, then watch the result.
- Targets are big and highlight when aimed at. Players are tiny at this scale (about 1.5 cm), so each one gets a larger invisible pinch area, about 4 cm (default).
- Voice: none.

## When things show
- Formation dots: shown during normal play, as calm dots in each team's colour.
- Goal and shot markers: pulse on the timeline with a soft crowd-roar sound when the simulated clock reaches them.
- Replay: players animate and the rest of the table dims slightly. The slider appears. When the replay ends, it goes back to formation dots.
- Pop-out shot: only on goals, so it stays special.
- Player card: shows when a player is pinched, fades by itself after about 4 seconds (default).
- If something needs attention out of view: the crowd-roar sound plays from the pitch, so the sound itself points the way.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Placing the Lens shows the pitch on the table at the planned size.
2. Pinching the goal marker replays the attacking move with animated players.
3. The final shot arcs off the table into the room and returns into the net.
4. Pinching a player shows their card, which fades out by itself.
5. "Skip to next moment" jumps the simulated clock to the next marker.

## Out of scope
- Syncing with a real broadcast or a live data feed.
- Recognizing the real TV or the real table.
- Real player tracking. The data has event positions and freeze-frames, not continuous movement, so replays are reconstructed from those.
- Any matches other than the one bundled recorded match.
- Penalty prediction mini-game, unless time allows after the five done criteria pass.

## Risks and open questions
- Replays are reconstructed, not filmed. Between data snapshots, players' movement is smoothed, so it shows the shape of the move rather than exact runs.
- Players are small at 60 × 40 cm. Larger invisible pinch areas help, but neighbouring players may overlap.
- The ball leaving the table needs real empty space in front of the table. Fine in the preview, but feel unproven on real glasses.
- Open question: should the virtual TV panel be in the scene, or is the pitch on its own enough for the demo?
- StatsBomb open data needs credit to StatsBomb in the Lens and the repo.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.
- The structural plan with data pipeline and module layout is in `docs/plan.md`.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
