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

## Photo credits

Player portraits on the player card are freely licensed images from Wikimedia Commons (CC BY / CC BY-SA / CC0), modified for the card: cropped to head and shoulders, scaled, and the original background removed (`touchline-lens/tools/photos/cutout_photos.py`). The modified portraits are shared under the same licence as each original. Authors and full licence terms are on each linked file page; machine-readable credits are in `touchline-lens/tools/photos/credits.json`.

| Player | Licence | Source |
|---|---|---|
| Adrien Rabiot | CC BY-SA 4.0 | [Adrien Rabiot France v Senegal 16 June 2026-371 ](https://commons.wikimedia.org/wiki/File:Adrien_Rabiot_France_v_Senegal_16_June_2026-371_(cropped).jpg) |
| Alexis Mac Allister | CC BY-SA 4.0 | [Alexis Mac Allister Argentina v Spain 19 July 20](https://commons.wikimedia.org/wiki/File:Alexis_Mac_Allister_Argentina_v_Spain_19_July_2026-162_(cropped).jpg) |
| Antoine Griezmann | CC BY-SA 2.0 | [Antoine Griezmann (51100409504) (cropped).jpg](https://commons.wikimedia.org/wiki/File:Antoine_Griezmann_(51100409504)_(cropped).jpg) |
| Aurélien Tchouaméni | CC BY-SA 4.0 | [Aurelien Tchouameni France v Senegal 16 June 202](https://commons.wikimedia.org/wiki/File:Aurelien_Tchouameni_France_v_Senegal_16_June_2026-447_(cropped).jpg) |
| Axel Disasi | CC BY-SA 4.0 | [AxelDisasi.jpg](https://commons.wikimedia.org/wiki/File:AxelDisasi.jpg) |
| Cristian Romero | CC BY-SA 4.0 | [Cristian Romero Argentina v Egypt 7 July 2026-10](https://commons.wikimedia.org/wiki/File:Cristian_Romero_Argentina_v_Egypt_7_July_2026-108.jpg) |
| Dayot Upamecano | CC BY-SA 4.0 | [Dayot Upamecano France v Senegal 16 June 2026-40](https://commons.wikimedia.org/wiki/File:Dayot_Upamecano_France_v_Senegal_16_June_2026-402_(cropped).jpg) |
| Eduardo Camavinga | CC BY 2.0 | [Ofrenda de la Liga y la Champions-13-L.Millán (5](https://commons.wikimedia.org/wiki/File:Ofrenda_de_la_Liga_y_la_Champions-13-L.Mill%C3%A1n_(52109790215)_(cropped).jpg) |
| Emiliano Martínez | CC BY-SA 4.0 | [Emiliano Martinez Argentina v Spain 19 July 2026](https://commons.wikimedia.org/wiki/File:Emiliano_Martinez_Argentina_v_Spain_19_July_2026-269.jpg) |
| Enzo Fernández | CC BY-SA 4.0 | [Enzo Fernandez Argentina v Spain 19 July 2026-05](https://commons.wikimedia.org/wiki/File:Enzo_Fernandez_Argentina_v_Spain_19_July_2026-050_(cropped).jpg) |
| Germán Pezzella | CC BY 2.5 | [Germán Pezella en los premios Jorge Newbery 2024](https://commons.wikimedia.org/wiki/File:Germ%C3%A1n_Pezella_en_los_premios_Jorge_Newbery_2024_(cropped).jpg) |
| Gonzalo Montiel | CC BY-SA 4.0 | [Gonzalo Montiel Argentina v Spain 19 July 2026-2](https://commons.wikimedia.org/wiki/File:Gonzalo_Montiel_Argentina_v_Spain_19_July_2026-265.jpg) |
| Hugo Lloris | CC BY-SA 3.0 | [Lloris 2018 (cropped).jpg](https://commons.wikimedia.org/wiki/File:Lloris_2018_(cropped).jpg) |
| Ibrahima Konaté | CC BY-SA 4.0 | [Ibrahima Konate France v Senegal 16 June 2026-51](https://commons.wikimedia.org/wiki/File:Ibrahima_Konate_France_v_Senegal_16_June_2026-516_(cropped).jpg) |
| Jules Koundé | CC BY-SA 4.0 | [Jules Kounde France v Senegal 16 June 2026-449 (](https://commons.wikimedia.org/wiki/File:Jules_Kounde_France_v_Senegal_16_June_2026-449_(cropped).jpg) |
| Julián Álvarez | CC BY-SA 4.0 | [Julian Alvarez Argentina v Spain 19 July 2026-05](https://commons.wikimedia.org/wiki/File:Julian_Alvarez_Argentina_v_Spain_19_July_2026-052_(cropped).jpg) |
| Kingsley Coman | CC BY-SA 4.0 | [Kingsley Coman (2019) (cropped).jpg](https://commons.wikimedia.org/wiki/File:Kingsley_Coman_(2019)_(cropped).jpg) |
| Kylian Mbappé | CC BY-SA 4.0 | [Kylian Mbappe France v Senegal 16 June 2026-391 ](https://commons.wikimedia.org/wiki/File:Kylian_Mbappe_France_v_Senegal_16_June_2026-391_(cropped).jpg) |
| Lautaro Martínez | CC BY-SA 4.0 | [Lautaro Martinez Argentina v Spain 19 July 2026-](https://commons.wikimedia.org/wiki/File:Lautaro_Martinez_Argentina_v_Spain_19_July_2026-049_(cropped).jpg) |
| Leandro Paredes | CC BY-SA 4.0 | [Leandro Paredes Argentina v Egypt 7 July 2026-04](https://commons.wikimedia.org/wiki/File:Leandro_Paredes_Argentina_v_Egypt_7_July_2026-048.jpg) |
| Lionel Messi | CC BY-SA 4.0 | [Leo Messi Argentina v Egypt 7 July 2026-1.jpg](https://commons.wikimedia.org/wiki/File:Leo_Messi_Argentina_v_Egypt_7_July_2026-1.jpg) |
| Marcos Acuña | CC BY-SA 3.0 | [Argentina - Colombia 2022 (52) (cropped).jpg](https://commons.wikimedia.org/wiki/File:Argentina_-_Colombia_2022_(52)_(cropped).jpg) |
| Marcus Thuram | CC BY-SA 4.0 | [Marcus Thuram France v Senegal 16 June 2026-261 ](https://commons.wikimedia.org/wiki/File:Marcus_Thuram_France_v_Senegal_16_June_2026-261_(cropped).jpg) |
| Nahuel Molina | CC BY-SA 4.0 | [Nahuel Molina Argentina v Spain 19 July 2026-023](https://commons.wikimedia.org/wiki/File:Nahuel_Molina_Argentina_v_Spain_19_July_2026-023.jpg) |
| Nicolás Otamendi | CC BY-SA 4.0 | [Nicolas Otamendi Argentina v Egypt 7 July 2026-0](https://commons.wikimedia.org/wiki/File:Nicolas_Otamendi_Argentina_v_Egypt_7_July_2026-030.jpg) |
| Nicolás Tagliafico | CC BY-SA 4.0 | [Nicolas Tagliafico Argentina v Spain 19 July 202](https://commons.wikimedia.org/wiki/File:Nicolas_Tagliafico_Argentina_v_Spain_19_July_2026-165.jpg) |
| Olivier Giroud | CC BY-SA 3.0 | [Olivier Giroud 2018.jpg](https://commons.wikimedia.org/wiki/File:Olivier_Giroud_2018.jpg) |
| Ousmane Dembélé | CC BY-SA 4.0 | [Ousmane Dembele France v Senegal 16 June 2026-34](https://commons.wikimedia.org/wiki/File:Ousmane_Dembele_France_v_Senegal_16_June_2026-341_(cropped).jpg) |
| Paulo Dybala | CC BY-SA 4.0 | [Матч «Динамо» - «Ювентус» 0-2. 20 октября 2020 г](https://commons.wikimedia.org/wiki/File:%D0%9C%D0%B0%D1%82%D1%87_%C2%AB%D0%94%D0%B8%D0%BD%D0%B0%D0%BC%D0%BE%C2%BB_-_%C2%AB%D0%AE%D0%B2%D0%B5%D0%BD%D1%82%D1%83%D1%81%C2%BB_0-2._20_%D0%BE%D0%BA%D1%82%D1%8F%D0%B1%D1%80%D1%8F_2020_%D0%B3%D0%BE%D0%B4%D0%B0_%E2%80%94_1153905_(cropped).jpg) |
| Randal Kolo Muani | CC0 | [Randal Kolo Muani 2020.jpg](https://commons.wikimedia.org/wiki/File:Randal_Kolo_Muani_2020.jpg) |
| Raphaël Varane | CC BY-SA 3.0 | [Liver-RM (8) (Varane).jpg](https://commons.wikimedia.org/wiki/File:Liver-RM_(8)_(Varane).jpg) |
| Rodrigo De Paul | CC BY-SA 4.0 | [Rodrigo De Paul Argentina v Spain 19 July 2026-0](https://commons.wikimedia.org/wiki/File:Rodrigo_De_Paul_Argentina_v_Spain_19_July_2026-054.jpg) |
| Theo Hernández | CC BY-SA 4.0 | [Theo Hernandez France v Norway 26 June 26-122.jp](https://commons.wikimedia.org/wiki/File:Theo_Hernandez_France_v_Norway_26_June_26-122.jpg) |
| Youssouf Fofana | CC BY 2.0 | [Youssouf Fofana (footballer, born 1999) (cropped](https://commons.wikimedia.org/wiki/File:Youssouf_Fofana_(footballer,_born_1999)_(cropped).jpg) |
| Ángel Di María | CC BY-SA 3.0 | [NIG-ARG (5).jpg](https://commons.wikimedia.org/wiki/File:NIG-ARG_(5).jpg) |
