"""Extract co-occurrence edges from the local corpus.

Pipeline per file:
  1. Load text (txt) — for The Theosophist we use the txt; the parquets are
     pre-tokenized but lose paragraph structure.
  2. Normalize OCR pathologies (light touch — see normalize.py).
  3. Slide a 3000-char window with 500-char overlap.
  4. In each window, run the gazetteer regex once.
  5. For each unordered pair of distinct node_ids in the window, emit an edge.

Per-author corpora (besant/, blavatsky/, leadbeater/, olcott/, lucifer/) are
processed too. For these, the *author* of the text is recorded — when Besant
writes about Olcott, that's directional signal: a Besant -> Olcott edge in
addition to the symmetric co-occurrence.

Output: data/processed/edges_cooccurrence.parquet
Columns: src, dst, doc_id, source_author, year, window_id, snippet, weight_raw

`weight_raw` is just 1 per window co-occurrence; aggregation/log-weighting
happens in 04_build_graph.py.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Iterable

import pandas as pd
from tqdm import tqdm

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from theosophy_number.gazetteer import Gazetteer  # noqa: E402
from theosophy_number.normalize import detect_year, normalize  # noqa: E402
from theosophy_number.windows import windows  # noqa: E402

CORPUS_ROOT = Path(
    "/Users/bhuvana/Library/CloudStorage/GoogleDrive-rb12295@gmail.com/My Drive/chaiboo/adyar-lexicon/data"
)
THEOSOPHIST_DIR = CORPUS_ROOT / "processed/theosophical/the_theosophist"
RAW_DIR = CORPUS_ROOT / "raw/theosophical"

# Per-author year heuristics for the raw corpora (no year in filename, but the
# author is bounded by lifespan + publication conventions). When we don't
# know the year of a specific volume, we leave it null and the graph will
# still get the edge with author and doc_id provenance.
AUTHOR_DIRS = {
    "besant": "besant_annie",
    "blavatsky": "blavatsky_h_p",
    "leadbeater": "leadbeater_c_w",
    "olcott": "olcott_h_s",
    "lucifer": None,  # periodical, multi-author
    "the_path": None,  # periodical, multi-author (currently empty)
}


def build_gazetteer(seeds: pd.DataFrame) -> Gazetteer:
    table: dict[str, list[str]] = {}
    for _, row in seeds.iterrows():
        node_id = row["id"]
        aliases = list(row["aliases"]) if row["aliases"] is not None else []
        if row["display_name"] not in aliases:
            aliases = aliases + [row["display_name"]]
        # Drop any alias <3 chars or all-lowercase (the latter would match
        # "morya" mid-sentence as a common word — but morya isn't, so keep
        # case-sensitive matching).
        aliases = [a for a in aliases if len(a.strip()) >= 3]
        if aliases:
            table[node_id] = aliases
    return Gazetteer(table)


def list_files() -> list[tuple[Path, str | None, int | None]]:
    """Return (path, source_author_id, year) tuples for all files to process."""
    files: list[tuple[Path, str | None, int | None]] = []
    # Theosophist: full multi-author periodical
    for p in sorted(THEOSOPHIST_DIR.glob("v*_*.txt")):
        files.append((p, None, detect_year(p.name)))
    # Per-author and per-periodical raw corpora
    for sub, author_id in AUTHOR_DIRS.items():
        d = RAW_DIR / sub
        if not d.exists():
            continue
        for p in sorted(d.iterdir()):
            if p.suffix.lower() in {".txt", ".htm", ".html"}:
                files.append((p, author_id, detect_year(p.name)))
    return files


def extract_pairs_in_window(window_text: str, gaz: Gazetteer) -> set[tuple[str, str, str]]:
    """Return set of (src, dst, snippet_anchor) where src < dst (canonical)."""
    hits = list(gaz.scan(window_text))
    if len(hits) < 2:
        return set()
    # Order hits by position; emit unordered pairs but in canonical order.
    seen_pairs: set[tuple[str, str]] = set()
    out: set[tuple[str, str, str]] = set()
    for i in range(len(hits)):
        for j in range(i + 1, len(hits)):
            a, b = hits[i].node_id, hits[j].node_id
            if a == b:
                continue
            src, dst = sorted((a, b))
            if (src, dst) in seen_pairs:
                continue
            seen_pairs.add((src, dst))
            # Build a snippet anchored on the first hit of either entity in
            # the window — ~250 chars total, centered on the closer hit pair.
            lo = min(hits[i].start, hits[j].start)
            hi = max(hits[i].end, hits[j].end)
            mid = (lo + hi) // 2
            s_lo = max(0, mid - 150)
            s_hi = min(len(window_text), mid + 150)
            snippet = window_text[s_lo:s_hi].replace("\n", " ")
            out.add((src, dst, snippet))
    return out


def process_file(
    path: Path,
    source_author: str | None,
    year: int | None,
    gaz: Gazetteer,
) -> Iterable[dict]:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        print(f"[cooc] skip {path.name}: {e}")
        return
    text = normalize(text)
    doc_id = f"{path.parent.name}/{path.name}"
    for w in windows(text, doc_id=doc_id):
        pairs = extract_pairs_in_window(w.text, gaz)
        for src, dst, snippet in pairs:
            yield {
                "src": src,
                "dst": dst,
                "doc_id": doc_id,
                "source_author": source_author,
                "year": year,
                "window_id": w.window_id,
                "snippet": snippet,
                "weight_raw": 1,
            }


def main() -> int:
    seeds = pd.read_parquet(ROOT / "data/processed/seed_nodes.parquet")
    gaz = build_gazetteer(seeds)
    print(f"[cooc] gazetteer covers {len(gaz)} nodes", flush=True)

    files = list_files()
    print(f"[cooc] processing {len(files)} files", flush=True)

    out_rows: list[dict] = []
    for path, author, year in tqdm(files, desc="files"):
        out_rows.extend(process_file(path, author, year, gaz))

    df = pd.DataFrame(out_rows)
    out_path = ROOT / "data/processed/edges_cooccurrence.parquet"
    df.to_parquet(out_path, index=False)
    print(f"[cooc] wrote {len(df)} edges to {out_path}", flush=True)

    if len(df):
        # Sanity: top edges by raw count.
        top = (
            df.groupby(["src", "dst"])
            .size()
            .reset_index(name="n")
            .sort_values("n", ascending=False)
            .head(20)
        )
        print("[cooc] top 20 edges (raw co-occurrence count):")
        print(top.to_string(index=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
