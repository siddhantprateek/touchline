"""Fetch freely licensed player portraits from Wikimedia Commons (via each player's Wikidata image).

Run:  python -I -X utf8 tools/photos/fetch_photos.py
Writes Assets/Players/<statsbomb id>.jpg (256 px wide) and tools/photos/credits.json.
Only CC BY, CC BY-SA, CC0 and public-domain files are kept; anything else is skipped so the
card falls back to the placeholder portrait.
"""
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "Assets" / "Players"
UA = {"User-Agent": "TouchlineLens/1.0 (hackathon project; contact via GitHub siddhantprateek/touchline)"}
FOOTBALLER = "Q937857"

# StatsBomb id -> name to search (the data names are long legal names).
PLAYERS = {
    2972: "Marcus Thuram", 3009: "Kylian Mbappé", 3026: "Adrien Rabiot", 3099: "Hugo Lloris",
    3604: "Olivier Giroud", 4445: "Jules Koundé", 5477: "Ousmane Dembélé", 5485: "Raphaël Varane",
    5487: "Antoine Griezmann", 6704: "Theo Hernández", 7439: "Axel Disasi", 8217: "Kingsley Coman",
    8519: "Dayot Upamecano", 10481: "Aurélien Tchouaméni", 11135: "Ibrahima Konaté",
    11990: "Youssouf Fofana", 22097: "Randal Kolo Muani", 24778: "Eduardo Camavinga",
    2995: "Ángel Di María", 3090: "Nicolás Otamendi", 5503: "Lionel Messi",
    5507: "Nicolás Tagliafico", 5743: "Paulo Dybala", 6909: "Emiliano Martínez",
    7161: "Germán Pezzella", 7797: "Rodrigo De Paul", 11456: "Lautaro Martínez",
    16308: "Leandro Paredes", 19597: "Marcos Acuña", 20572: "Cristian Romero",
    27886: "Alexis Mac Allister", 28263: "Gonzalo Montiel", 29201: "Nahuel Molina",
    29560: "Julián Álvarez", 38718: "Enzo Fernández",
}


def api(base, params):
    url = base + "?" + urllib.parse.urlencode(params)
    return json.loads(get(url))


def get(url):
    for attempt in range(6):
        try:
            time.sleep(0.8)
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as ex:
            if ex.code != 429 or attempt == 5:
                raise
            time.sleep(15 * (attempt + 1))


def wikidata_image(name):
    s = api("https://www.wikidata.org/w/api.php", {
        "action": "wbsearchentities", "search": name, "language": "en", "limit": 6, "format": "json"})
    for hit in s.get("search", []):
        e = api("https://www.wikidata.org/w/api.php", {
            "action": "wbgetentities", "ids": hit["id"], "props": "claims", "format": "json"})
        claims = e["entities"][hit["id"]].get("claims", {})
        jobs = [c["mainsnak"]["datavalue"]["value"]["id"] for c in claims.get("P106", []) if "datavalue" in c["mainsnak"]]
        if FOOTBALLER not in jobs:
            continue
        for c in claims.get("P18", []):
            if "datavalue" in c["mainsnak"]:
                return hit["id"], c["mainsnak"]["datavalue"]["value"]
    return None, None


def commons_info(filename):
    j = api("https://commons.wikimedia.org/w/api.php", {
        "action": "query", "titles": "File:" + filename, "prop": "imageinfo", "iiprop": "url|extmetadata",
        "iiurlwidth": 256, "format": "json"})
    page = next(iter(j["query"]["pages"].values()))
    ii = page["imageinfo"][0]
    md = ii["extmetadata"]
    strip = lambda s: re.sub(r"<[^>]+>", "", s or "").strip()
    return {
        "thumb": ii["thumburl"],
        "page": ii["descriptionurl"],
        "license": strip(md.get("LicenseShortName", {}).get("value")),
        "artist": strip(md.get("Artist", {}).get("value")),
    }


def license_ok(lic):
    l = lic.lower()
    if "nc" in l.split() or "-nc" in l or "nd" in l.replace("and", "").split():
        return False
    return l.startswith("cc by") or l.startswith("cc0") or "public domain" in l or l == "pd"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cpath = ROOT / "tools" / "photos" / "credits.json"
    credits = {int(k): v for k, v in json.loads(cpath.read_text(encoding="utf-8")).items()} if cpath.exists() else {}
    for pid, name in PLAYERS.items():
        if pid in credits and (OUT / f"{pid}.jpg").exists():
            continue
        try:
            qid, fn = wikidata_image(name)
            if not fn:
                print(f"{pid} {name}: no Wikidata image")
                continue
            info = commons_info(fn)
            if not license_ok(info["license"]):
                print(f"{pid} {name}: skipped, licence '{info['license']}'")
                continue
            data = get(info["thumb"])
            (OUT / f"{pid}.jpg").write_bytes(data)
            credits[pid] = {"name": name, "file": fn, "license": info["license"], "artist": info["artist"], "page": info["page"]}
            print(f"{pid} {name}: ok ({info['license']}, {len(data)//1024} kB)")
        except Exception as ex:  # keep going; a missing photo just means the placeholder
            print(f"{pid} {name}: failed {ex}", file=sys.stderr)
    cpath.write_text(json.dumps(credits, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{len(credits)} photos kept")


if __name__ == "__main__":
    main()
