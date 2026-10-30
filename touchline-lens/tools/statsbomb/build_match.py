"""Turn raw StatsBomb JSON into Assets/Scripts/Data/MatchData.ts.

Fixed frame: the home team attacks +x (toward x = 120) for the whole match.
StatsBomb normalizes every event so the acting team attacks left->right, so
away-team events and their 360 frames are flipped: x' = 120 - x, y' = 80 - y.

Usage: python -I -X utf8 build_match.py [match_id]
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "Assets", "Scripts", "Data", "MatchData.ts")

MAX_REPLAY_SEC = 12.0
MAX_BALL_EVENTS = 8
BALL_TYPES = {"Pass", "Carry", "Dribble", "Shot", "Ball Receipt*"}
TOUCH_TYPES = {
    "Pass", "Ball Receipt*", "Dribble", "Shot", "Clearance", "Interception",
    "Ball Recovery", "Block", "Goal Keeper", "Miscontrol",
}

# Formation slot per StatsBomb position id, for a team attacking +x, in its own half-ish.
# StatsBomb y grows "downward", so a team facing +x has its right side at high y.
SLOTS = {
    1: (5, 40),
    2: (24, 70), 3: (20, 54), 4: (20, 40), 5: (20, 26), 6: (24, 10),
    7: (32, 72), 8: (32, 8),
    9: (33, 52), 10: (32, 40), 11: (33, 28),
    12: (43, 70), 13: (40, 52), 14: (40, 40), 15: (40, 28), 16: (43, 10),
    17: (52, 70), 18: (48, 54), 19: (48, 40), 20: (48, 26), 21: (52, 10),
    22: (56, 50), 23: (57, 40), 24: (56, 30), 25: (52, 40),
}


def r(v: float) -> float:
    return round(v, 1)


def ts_to_sec(ts: str) -> float:
    h, m, s = ts.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def clock_sec(e) -> int:
    return e["minute"] * 60 + e["second"]


def short_name(p) -> str:
    nick = p.get("player_nickname")
    if nick:
        return nick
    return p["player_name"].split(" ")[-1]


def load(match_id: str):
    raw = os.path.join(HERE, "raw")

    def rd(kind):
        with open(os.path.join(raw, f"{kind}_{match_id}.json"), encoding="utf-8") as f:
            return json.load(f)

    return rd("events"), rd("lineups"), rd("three-sixty")


def build(match_id: str) -> dict:
    events, lineups, frames360 = load(match_id)
    frames = {f["event_uuid"]: f for f in frames360}

    starting = [e for e in events if e["type"]["name"] == "Starting XI"]
    home_id = starting[0]["team"]["id"]
    away_id = starting[1]["team"]["id"]
    team_idx = {home_id: 0, away_id: 1}

    def to_fixed(team: int, loc):
        x, y = loc[0], loc[1]
        if team == 1:
            x, y = 120 - x, 80 - y
        return (x, y) if len(loc) < 3 else (x, y, loc[2])

    def slot_fixed(team: int, pos_id: int):
        x, y = SLOTS.get(pos_id, (40, 40))
        return to_fixed(team, (x, y))

    # Players
    players = {}
    for t in lineups:
        ti = team_idx[t["team_id"]]
        for p in t["lineup"]:
            pos = p["positions"][0]["position"] if p["positions"] else "Substitute"
            players[p["player_id"]] = {
                "id": p["player_id"], "name": p["player_name"], "short": short_name(p),
                "number": p["jersey_number"], "position": pos, "team": ti, "touches": [],
            }
    for e in events:
        if e["type"]["name"] in TOUCH_TYPES and "player" in e and e["period"] <= 4:
            pl = players.get(e["player"]["id"])
            if pl is not None:
                pl["touches"].append(clock_sec(e))

    # Formation spans: Starting XI, then Substitution / Tactical Shift updates.
    current = [{}, {}]   # team -> {playerId: posId}
    spans = [[], []]

    def push_span(team: int, sec: int):
        slots = [
            {"playerId": pid, "x": r(slot_fixed(team, pos)[0]), "y": r(slot_fixed(team, pos)[1])}
            for pid, pos in current[team].items()
        ]
        if spans[team] and spans[team][-1]["fromSec"] == sec:
            spans[team][-1]["slots"] = slots
        else:
            spans[team].append({"fromSec": sec, "slots": slots})

    for e in events:
        name = e["type"]["name"]
        if e["period"] > 4:
            break
        ti = team_idx.get(e["team"]["id"])
        if name in ("Starting XI", "Tactical Shift"):
            current[ti] = {p["player"]["id"]: p["position"]["id"] for p in e["tactics"]["lineup"]}
            push_span(ti, clock_sec(e) if name == "Tactical Shift" else 0)
        elif name == "Substitution":
            out_id = e["player"]["id"]
            in_id = e["substitution"]["replacement"]["id"]
            pos = current[ti].pop(out_id, e["position"]["id"])
            current[ti][in_id] = pos
            push_span(ti, clock_sec(e))

    def formation_at(team: int, sec: int):
        chosen = spans[team][0]
        for s in spans[team]:
            if s["fromSec"] <= sec:
                chosen = s
        return chosen["slots"]

    keeper_ids = [None, None]

    def keeper_at(team: int, sec: int):
        for s in formation_at(team, sec):
            pid = s["playerId"]
            if players.get(pid, {}).get("position") == "Goalkeeper":
                return pid
        return keeper_ids[team]

    # Moments: every shot in periods 1-4.
    by_index = sorted(events, key=lambda e: e["index"])
    moments = []
    goals = []
    for shot in by_index:
        if shot["type"]["name"] != "Shot" or shot["period"] > 4:
            continue
        moments.append(build_moment(shot, by_index, frames, team_idx, to_fixed,
                                    formation_at, keeper_at, players))
        if shot["shot"]["outcome"]["name"] == "Goal":
            goals.append({"sec": clock_sec(shot), "team": team_idx[shot["team"]["id"]]})
    for e in by_index:
        if e["type"]["name"] == "Own Goal For" and e["period"] <= 4:
            goals.append({"sec": clock_sec(e), "team": team_idx[e["team"]["id"]]})
    goals.sort(key=lambda g: g["sec"])

    def team_info(t):
        return {"id": t["team_id"], "name": t["team_name"],
                "short": t["team_name"][:3].upper()}

    teams = {t["team_id"]: t for t in lineups}
    used = {p["playerId"] for side in spans for s in side for p in s["slots"]}
    used |= {m["playerId"] for m in moments}
    return {
        "matchId": int(match_id),
        "home": team_info(teams[home_id]),
        "away": team_info(teams[away_id]),
        "endSec": max(clock_sec(e) for e in events if e["period"] <= 4),
        "players": [p for p in players.values() if p["id"] in used],
        "formations": spans,
        "moments": moments,
        "goals": goals,
    }


def build_moment(shot, by_index, frames, team_idx, to_fixed, formation_at, keeper_at, players):
    team = team_idx[shot["team"]["id"]]
    sec = clock_sec(shot)
    is_pen = shot["shot"]["type"]["name"] == "Penalty"
    is_goal = shot["shot"]["outcome"]["name"] == "Goal"
    shooter = shot["player"]["id"]

    # Ball-carrying chain in the same possession, ending at the shot.
    chain = []
    if not is_pen:
        shot_t = ts_to_sec(shot["timestamp"])
        for e in reversed(by_index[: by_index.index(shot) + 1]):
            if e["period"] != shot["period"] or e["possession"] != shot["possession"]:
                break
            if e["type"]["name"] not in BALL_TYPES or e["team"]["id"] != shot["team"]["id"]:
                continue
            if shot_t - ts_to_sec(e["timestamp"]) > MAX_REPLAY_SEC:
                break
            chain.append(e)
            if sum(1 for c in chain if c["type"]["name"] != "Ball Receipt*") >= MAX_BALL_EVENTS:
                break
        chain.reverse()
    if not chain:
        chain = [shot]

    t0 = ts_to_sec(chain[0]["timestamp"])
    lead = 1.2 if is_pen else 0.0

    def rel(e):
        return ts_to_sec(e["timestamp"]) - t0 + lead

    ball = []
    actor_keys = {}   # playerId -> [(t, x, y)]
    for e in chain:
        et = team_idx[e["team"]["id"]]
        t = rel(e)
        loc = to_fixed(et, e["location"])
        ball.append((t, loc[0], loc[1], 0.0))
        actor_keys.setdefault(e["player"]["id"], []).append((t, loc[0], loc[1]))
        kind = e["type"]["name"]
        dur = e.get("duration") or 0.0
        sub = {"Pass": "pass", "Carry": "carry", "Shot": "shot"}.get(kind)
        if sub and "end_location" in e.get(sub, {}):
            end = to_fixed(et, e[sub]["end_location"])
            dur = max(dur, 0.3)
            z = end[2] if len(end) > 2 else 0.0
            ball.append((t + dur, end[0], end[1], z))
            if kind == "Carry":
                actor_keys[e["player"]["id"]].append((t + dur, end[0], end[1]))

    if is_pen:
        spot = to_fixed(team, shot["location"])
        dirx = 1 if team == 0 else -1
        actor_keys[shooter] = [(0.0, spot[0] - dirx * 6, spot[1] + 2), (lead, spot[0] - dirx * 0.8, spot[1])]
        ball.insert(0, (0.0, spot[0], spot[1], 0.0))

    duration = max(b[0] for b in ball) + 1.0

    # 22 tokens: known actors + keepers get identity, the rest are anonymous.
    tokens = []
    for ti in (0, 1):
        known = [pid for pid in actor_keys if players.get(pid, {}).get("team") == ti]
        gk = keeper_at(ti, sec)
        if gk is not None and gk not in known:
            known.append(gk)
        form = {s["playerId"]: (s["x"], s["y"]) for s in formation_at(ti, sec)}
        team_tokens = []
        for pid in known:
            team_tokens.append({"team": ti, "playerId": pid, "keys": [], "home": form.get(pid)})
        for pid, xy in form.items():
            if len(team_tokens) >= 11:
                break
            if pid in known:
                continue
            team_tokens.append({"team": ti, "playerId": None, "keys": [], "home": xy})
        tokens.extend(team_tokens)

    def last_pos(tok):
        if tok["keys"]:
            return tok["keys"][-1][1:]
        return tok["home"] or (60, 40)

    # Walk 360 frames in time order and assign dots to tokens.
    for e in chain:
        f = frames.get(e["id"])
        if not f:
            continue
        t = rel(e) if not is_pen else 0.0
        et = team_idx[e["team"]["id"]]
        taken = set()
        dots = []
        for d in f["freeze_frame"]:
            dteam = et if d["teammate"] else 1 - et
            x, y = to_fixed(et, d["location"])
            dots.append((dteam, x, y, d["actor"], d["keeper"]))
        # Pass 1: actor and keepers go to their named tokens.
        rest = []
        for dteam, x, y, actor, keeper in dots:
            target = None
            if actor:
                target = next((k for k in tokens if k["playerId"] == e["player"]["id"]), None)
            elif keeper:
                gk = keeper_at(dteam, sec)
                target = next((k for k in tokens if k["playerId"] == gk and k["team"] == dteam), None)
            if target is not None and id(target) not in taken:
                target["keys"].append((t, x, y))
                taken.add(id(target))
            else:
                rest.append((dteam, x, y))
        # Pass 2: greedy nearest-neighbour by distance to each token's last position.
        pairs = []
        for di, (dteam, x, y) in enumerate(rest):
            for tok in tokens:
                if tok["team"] != dteam or id(tok) in taken:
                    continue
                lx, ly = last_pos(tok)
                pairs.append(((x - lx) ** 2 + (y - ly) ** 2, di, tok))
        pairs.sort(key=lambda p: p[0])
        used_dots = set()
        for _, di, tok in pairs:
            if di in used_dots or id(tok) in taken:
                continue
            dteam, x, y = rest[di]
            tok["keys"].append((t, x, y))
            taken.add(id(tok))
            used_dots.add(di)

    # Merge actor ball-keys into their tokens, then finalize.
    out_tokens = []
    for tok in tokens:
        keys = list(tok["keys"])
        if tok["playerId"] in actor_keys:
            keys = keys + actor_keys[tok["playerId"]]
        if not keys:
            hx, hy = tok["home"] or (60, 40)
            keys = [(0.0, hx, hy)]
        keys.sort(key=lambda k: k[0])
        dedup = []
        for k in keys:
            if dedup and abs(dedup[-1][0] - k[0]) < 1e-3:
                dedup[-1] = k
            else:
                dedup.append(k)
        out_tokens.append({
            "team": tok["team"],
            "playerId": tok["playerId"],
            "keys": [[r(k[0]), r(k[1]), r(k[2])] for k in dedup],
        })

    end = to_fixed(team, shot["shot"]["end_location"])
    start = to_fixed(team, shot["location"])
    pl = players.get(shooter, {})
    mm, ss = divmod(sec, 60)
    return {
        "id": shot["id"][:8],
        "sec": sec,
        "label": f"{mm}' {pl.get('short', '')}" + (" (pen)" if is_pen else ""),
        "team": team,
        "playerId": shooter,
        "isGoal": is_goal,
        "isPenalty": is_pen,
        "replay": {
            "durationSec": r(duration),
            "ball": [[r(b[0]), r(b[1]), r(b[2]), r(b[3])] for b in sorted(ball, key=lambda b: b[0])],
            "tokens": out_tokens,
            "shot": {"from": [r(start[0]), r(start[1])],
                     "to": [r(end[0]), r(end[1]), r(end[2] if len(end) > 2 else 0.0)]},
        },
    }


HEADER = """// GENERATED by tools/statsbomb/build_match.py. Do not hand-edit.
// Data provided by StatsBomb (https://github.com/statsbomb/open-data),
// used under the StatsBomb public data user agreement.
import { MatchData } from "./MatchTypes"

export const MATCH: MatchData = """


def main():
    match_id = sys.argv[1] if len(sys.argv) > 1 else "3869685"
    data = build(match_id)
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(HEADER + body + "\n")
    goals = [m for m in data["moments"] if m["isGoal"]]
    print(f"wrote {os.path.normpath(OUT)} ({len(body) // 1024} kB)")
    print(f"{len(data['players'])} players, {len(data['moments'])} moments, {len(goals)} goals")
    for m in goals:
        named = sum(1 for t in m["replay"]["tokens"] if t["playerId"] is not None)
        keys = sum(len(t["keys"]) for t in m["replay"]["tokens"])
        print(f"  {m['label']:<22} {m['replay']['durationSec']:>5}s  ball keys {len(m['replay']['ball']):>2}  "
              f"tokens {len(m['replay']['tokens'])} ({named} named, {keys} keys)")


if __name__ == "__main__":
    main()
