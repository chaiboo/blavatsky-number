"""Build the seed node table.

Sources, in order:
  1. Wikidata SPARQL — anyone with P463 (member of) -> Theosophical Society
     (Q327625), TS Adyar (Q17070077), TS Pasadena (Q7779142), TS America
     (Q2419362), or occupation P106 = theosophist (Q1925236).
  2. Hand-curated supplement (data/raw/seed_supplement.csv) — the 19th-c.
     inner circle that Wikidata under-covers, plus the adversaries
     (Crowley, Solovyov, the Coulombs, Hodgson, Mathers, Westcott, Guénon).

theosophy.wiki is gated by Cloudflare browser-challenge — the API is not
accessible to scripted clients. We document this in README and proceed.

Output: data/processed/seed_nodes.parquet
Schema: id, display_name, aliases (list[str]), birth, death, wikidata_qid,
        tradition, source.
"""

from __future__ import annotations

import csv
import sys
import time
import unicodedata
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))


WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
USER_AGENT = "TheosophyNumberBot/0.1 (academic; rb12295@gmail.com)"

# Theosophical Society (parent), Adyar, Pasadena, America-section, Point Loma
# variants. Q1925236 is the occupation 'theosophist'.
SPARQL = """
SELECT DISTINCT ?person ?personLabel ?birth ?death
       (GROUP_CONCAT(DISTINCT ?aliasLabel; separator="||") AS ?aliases)
WHERE {
  {
    VALUES ?org { wd:Q327625 wd:Q17070077 wd:Q7779142 wd:Q2419362 }
    ?person wdt:P463 ?org .
  } UNION {
    ?person wdt:P106 wd:Q1925236 .
  }
  ?person wdt:P31 wd:Q5 .
  OPTIONAL { ?person wdt:P569 ?birth . }
  OPTIONAL { ?person wdt:P570 ?death . }
  OPTIONAL { ?person skos:altLabel ?aliasLabel . FILTER(LANG(?aliasLabel)="en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?person ?personLabel ?birth ?death
"""


def _slug(label: str) -> str:
    s = unicodedata.normalize("NFKD", label).encode("ascii", "ignore").decode()
    s = "".join(c if c.isalnum() else "_" for c in s.lower()).strip("_")
    while "__" in s:
        s = s.replace("__", "_")
    return s


def fetch_wikidata() -> pd.DataFrame:
    print("[seed] querying Wikidata SPARQL ...", flush=True)
    r = requests.get(
        WIKIDATA_SPARQL,
        params={"query": SPARQL},
        headers={"Accept": "application/sparql-results+json", "User-Agent": USER_AGENT},
        timeout=60,
    )
    r.raise_for_status()
    bindings = r.json()["results"]["bindings"]
    rows = []
    for b in bindings:
        qid = b["person"]["value"].rsplit("/", 1)[-1]
        label = b.get("personLabel", {}).get("value", qid)
        if label.startswith("Q") and label[1:].isdigit():
            # No English label — skip; the corpus is English.
            continue
        birth = (b.get("birth", {}).get("value") or "")[:10]
        death = (b.get("death", {}).get("value") or "")[:10]
        aliases_raw = b.get("aliases", {}).get("value", "")
        aliases = [a for a in aliases_raw.split("||") if a]
        rows.append({
            "id": _slug(label),
            "display_name": label,
            "aliases": aliases,
            "birth": birth,
            "death": death,
            "wikidata_qid": qid,
            "tradition": "theosophy_wikidata",
            "source": "wikidata",
        })
    df = pd.DataFrame(rows)
    print(f"[seed] wikidata rows: {len(df)}", flush=True)
    return df


def fetch_supplement() -> pd.DataFrame:
    csv_path = ROOT / "data" / "raw" / "seed_supplement.csv"
    rows = []
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for r in reader:
            if not r["node_id"] or not r["display_name"]:
                continue
            if "duplicate" in (r.get("note") or "").lower() or "disambig" in (r.get("note") or "").lower():
                continue
            aliases = [a for a in (r["aliases"] or "").split("|") if a]
            rows.append({
                "id": r["node_id"],
                "display_name": r["display_name"],
                "aliases": aliases,
                "birth": r["birth"],
                "death": r["death"],
                "wikidata_qid": r["wikidata_qid"],
                "tradition": r["tradition"] or "theosophy_supplement",
                "source": "supplement",
            })
    df = pd.DataFrame(rows)
    print(f"[seed] supplement rows: {len(df)}", flush=True)
    return df


def merge(wiki: pd.DataFrame, supp: pd.DataFrame) -> pd.DataFrame:
    # Supplement is authoritative — it carries the tradition labels and
    # adversary annotations we curated. Merge by QID first, then by
    # case-insensitive display_name fallback.
    merged: dict[str, dict] = {}

    # Index supplement by QID and by name
    by_qid: dict[str, dict] = {}
    by_name: dict[str, dict] = {}
    for r in supp.to_dict("records"):
        if r["wikidata_qid"]:
            by_qid[r["wikidata_qid"]] = r
        by_name[r["display_name"].lower()] = r

    # Start with wiki rows; overlay supplement when matched
    for r in wiki.to_dict("records"):
        sup = by_qid.get(r["wikidata_qid"]) or by_name.get(r["display_name"].lower())
        if sup:
            # Use supplement's id/aliases/tradition; keep wiki's birth/death
            # if supplement is missing them.
            merged_row = dict(sup)
            merged_row["aliases"] = sorted({*sup["aliases"], *r["aliases"], r["display_name"]})
            merged_row["birth"] = sup["birth"] or r["birth"]
            merged_row["death"] = sup["death"] or r["death"]
            merged_row["wikidata_qid"] = sup["wikidata_qid"] or r["wikidata_qid"]
            merged_row["source"] = "wikidata+supplement"
        else:
            merged_row = dict(r)
            merged_row["aliases"] = sorted({*r["aliases"], r["display_name"]})
        merged[merged_row["id"]] = merged_row

    # Add supplement rows not in wiki
    for r in supp.to_dict("records"):
        if r["id"] in merged:
            continue
        merged_row = dict(r)
        merged_row["aliases"] = sorted({*r["aliases"], r["display_name"]})
        merged[merged_row["id"]] = merged_row

    out = pd.DataFrame(list(merged.values()))
    # Final cleanup: ensure aliases is a list and drop duplicates of obvious
    # noise (single-letter aliases, period-only).
    def clean(aliases: list[str]) -> list[str]:
        return sorted({a.strip() for a in aliases if a and len(a.strip()) >= 3})
    out["aliases"] = out["aliases"].apply(clean)
    return out


def main() -> int:
    out_path = ROOT / "data" / "processed" / "seed_nodes.parquet"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        wiki = fetch_wikidata()
    except Exception as e:
        print(f"[seed] WARN wikidata failed: {e}", flush=True)
        wiki = pd.DataFrame(columns=["id", "display_name", "aliases", "birth", "death", "wikidata_qid", "tradition", "source"])
    supp = fetch_supplement()
    merged = merge(wiki, supp)
    print(f"[seed] merged rows: {len(merged)}", flush=True)
    print(f"[seed] traditions: {merged['tradition'].value_counts().to_dict()}", flush=True)
    merged.to_parquet(out_path, index=False)
    print(f"[seed] wrote {out_path}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
