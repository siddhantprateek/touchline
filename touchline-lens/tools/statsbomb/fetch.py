"""Download one StatsBomb open-data match (events, lineups, 360) into raw/.

Usage: python -I -X utf8 fetch.py [match_id]   (default: 3869685, 2022 World Cup final)
"""
import os
import sys
import urllib.request

BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"
HERE = os.path.dirname(os.path.abspath(__file__))


def fetch(match_id: str) -> None:
    raw = os.path.join(HERE, "raw")
    os.makedirs(raw, exist_ok=True)
    for kind in ("events", "lineups", "three-sixty"):
        dest = os.path.join(raw, f"{kind}_{match_id}.json")
        if os.path.exists(dest):
            print(f"have {dest}")
            continue
        url = f"{BASE}/{kind}/{match_id}.json"
        print(f"get  {url}")
        urllib.request.urlretrieve(url, dest)


if __name__ == "__main__":
    fetch(sys.argv[1] if len(sys.argv) > 1 else "3869685")
