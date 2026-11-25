"""Verify and vendor the approved V16 catalogue card fronts (no network or database).

Run from the official project: python3 scripts/import-approved-card-art.py /path/to/approved/dist
The approved Dark Mastermind JPEG is owner-supplied separately; this imports the V16 baseline too.
"""
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import json
import re
import sys

PINNED = {
    "artwork/artwork-manifest.json": "d64588af742dfe17df59f598877bede3149b8cf206a45ee41e5277208f09da3a",
    "catalog-data/media.json": "75bbd58c8e069170f43d2e7ec405c5c6877940da19afad1de3204ba26896a2eb",
    "catalog-data/en-luna-fantasy.json": "a0e011335bb72cf48fcddc1dc8230e51d0e1961e16ea8769747adbde30ebcd63",
    "catalog-data/en-grand-fantasy.json": "2aa058c8ed597562b8c904d2a10309c571e6bedfb0f08e1e4ef76100a058f2fe",
    "catalog-data/en-faction-war.json": "123698687534d8a6dcba02ed9f63a3eeca21e84247c481b466f041f0a07a581d",
    "en/luna-fantasy/index.html": "0887b294fb592f0f2da1a95f45f28218c648a6d202a0eb3e09d2c963eb681691",
    "en/grand-fantasy/index.html": "41cc6ef1d470646eebacb8cadb8692ad666db6685f5f7afce6e273a1cfa89949",
    "en/faction-war/index.html": "49ef8a678ba836a097fe09c7c962da53c15b752e2e73ceb81db74911f1cd8923",
}
FACTIONS = {
    name: name.lower().replace(" ", "_")
    for name in ("Beasts", "Colossals", "Dragons", "Knights", "Lunarians", "Moon Creatures",
                 "Mythical Creatures", "Strange Beings", "Supernatural", "Underworld", "Warriors")
}
WP = Path(__file__).resolve().parents[1]


def check(condition, detail):
    if not condition:
        raise ValueError(detail)


class PublishedCards(HTMLParser):
    """The frozen public HTML declares each card's actual category, title and source."""
    def __init__(self):
        super().__init__()
        self.rows = {}
        self.capture_heading = False
        self.faction = None
        self.rarity = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cl = set(a.get("class", "").split())
        if tag == "h2" and "lp-faction-title" in cl:
            self.capture_heading = True
            self.faction = ""
        if tag == "div" and "card-item" in cl:
            self.rarity, = (c.removeprefix("card-") for c in cl if c.startswith("card-") and c != "card-item")
        if tag == "img" and cl.intersection({"lp-card-image", "card-image"}):
            source = a["data-original-src"]
            check(source not in self.rows, f"Duplicate HTML source {source}")
            group = (FACTIONS[self.faction.strip()] if "lp-card-image" in cl else self.rarity)
            self.rows[source] = (a["alt"], group, a["src"].split("?")[0])

    def handle_data(self, value):
        if self.capture_heading:
            self.faction += value

    def handle_endtag(self, tag):
        if tag == "h2":
            self.capture_heading = False


def main(root):
    source = {}
    for rel, expected in PINNED.items():
        content = (root / rel).read_bytes()
        check(sha256(content).hexdigest() == expected, f"Pinned V16 file mismatch: {rel}")
        source[rel] = content
    manifest = json.loads(source["artwork/artwork-manifest.json"])["items"]
    manifest = {item["id"]: item for item in manifest}
    media = json.loads(source["catalog-data/media.json"])
    cohorts = {}
    files = {}
    art_receipts = {}

    for page, surface, count in (
        ("luna-fantasy", "fantasy", 162), ("grand-fantasy", "fantasy", 121), ("faction-war", "faction", 326)
    ):
        rows = json.loads(source[f"catalog-data/en-{page}.json"])
        shown = PublishedCards()
        shown.feed(source[f"en/{page}/index.html"].decode())
        check(len(rows) == len(shown.rows) == count, f"Unexpected {page} row count")
        group_rows = {}
        for row in rows:
            card_id = row["id"]
            check(re.fullmatch(r"LUNA-\d{4}", card_id) and card_id not in group_rows, f"Invalid/duplicate {card_id}")
            entry = manifest[card_id]
            name = row["alt"]
            url = row["src"]
            url_parts = urlsplit(url)
            mapped = media[url]
            label, group, html_thumb = shown.rows[url]
            check(url_parts.scheme == "https" and url_parts.netloc == "assets.lunarian.app"
                  and not url_parts.fragment and re.fullmatch(r"v=\d+", url_parts.query), f"Unexpected versioned source {url}")
            check(entry["surface"] == surface and entry["originalUrl"] == url and mapped["id"] == card_id,
                  f"Manifest/media original binding mismatch for {card_id}")
            check(label == name and name in {entry["name"], *entry["names"]["en"]}, f"Name mismatch for {card_id}")
            if surface == "faction":
                check(re.fullmatch(r"/LunaPairs/[a-z0-9_]+\.png", url_parts.path), url_parts.path)
                check(url_parts.path.removeprefix("/LunaPairs/").startswith(f"{group}_"),
                      f"Official Faction source disagrees with its published group for {card_id}")
            else:
                expected_group = url_parts.path.split("/")[2].lower()
                if expected_group == "mythical":
                    check(group == "secret" and page == "luna-fantasy", f"Unexpected Mythical placement {card_id}")
                else:
                    check(expected_group == group, f"Rarity mismatch {card_id}")
            group_rows[card_id] = [url, name, group, card_id]
            if page == "grand-fantasy":
                continue

            pair = []
            for tier, key, dims in (("thumb", "thumb", (320, 480)), ("medium", "detail", (640, 960))):
                art = entry["assets"][tier]["webp"]
                rel = f"{surface}/{card_id}/{tier}.webp"
                check(art["path"] == rel and mapped[key].split("?")[0] == f"/artwork/{rel}",
                      f"{tier} path mismatch for {card_id}")
                check(tier != "thumb" or html_thumb == f"/artwork/{rel}", f"Published thumb mismatch for {card_id}")
                check((art["width"], art["height"]) == dims, f"Unexpected {tier} dimensions for {card_id}")
                payload = (root / "artwork" / rel).read_bytes()
                check(len(payload) == art["bytes"] and sha256(payload).hexdigest() == art["sha256"],
                      f"Unapproved raster bytes: {rel}")
                files[rel] = payload
                pair.append(art["sha256"])
            art_receipts[card_id] = pair
        cohorts[page] = group_rows

    luna, grand, faction = (cohorts[k] for k in ("luna-fantasy", "grand-fantasy", "faction-war"))
    check(not luna.keys() & faction.keys(), "The two independent rosters share a release ID")
    check(grand == {card_id: row for card_id, row in luna.items() if row[2] != "secret"},
          "The published Grand roster is not the exact 121-card non-Secret subset")
    check(len(files) == 976 and len(art_receipts) == 488, "Incomplete or duplicate raster receipt")
    check(faction["LUNA-0608"][1:3] == ["Great Deer", "mythical_creatures"], "Great Deer exception changed")

    for rel, payload in files.items():
        dst = WP / "public/luna-cinematic/cards" / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if not dst.exists() or dst.read_bytes() != payload:
            dst.write_bytes(payload)
    index = {
        "fantasy": [luna[card_id] for card_id in sorted(luna)],
        "faction": [faction[card_id] for card_id in sorted(faction)],
    }
    receipt = {
        "approvedReleaseGit": "5aaac7d4b79e75086aac15ad10c040d2fff448ec",
        "approvedZipSha256": "233878c36305b2fac696d4f9bb9c3601641f63035cd802da32fcb14a17e7c0cf",
        "pinnedInputs": PINNED,
        "grandIds": sorted(grand),
        "rasterSha256": dict(sorted(art_receipts.items())),
    }
    paths = {
        "src/lib/cinematic/release-card-index.json": index,
        "tests/fixtures/luna-v16-card-art-receipt.json": receipt,
    }
    for path, data in paths.items():
        output = WP / path
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Verified 162 Luna + 326 Faction rows; 121 Grand reuse. {len(files)} rasters; {sum(map(len, files.values())):,} bytes.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(Path(sys.argv[1]))
