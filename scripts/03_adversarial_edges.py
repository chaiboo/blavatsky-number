"""Score co-occurrences for adversarial / hostile signal.

Two distinct signals, both producing edges in `edges_adversarial.parquet`:

  1. STRUCTURAL: any pair where at least one node is tagged adversary*
     (adversary, adversary_spr, adversary_thelema, adversary_golden_dawn,
     critic_traditionalist) is automatically an adversarial co-occurrence.
     Crowley appearing in the same window as Mathers is hostile by
     historiographic stipulation, even if the surrounding prose is neutral.

  2. LEXICAL: any pair (regardless of tradition) where the surrounding window
     contains adversarial vocabulary from data/raw/adversarial_lexicon.txt
     above a threshold count, AND where the lexical hits are within ~600
     chars of at least one of the two entity surfaces.

The output is keyed in parallel to edges_cooccurrence.parquet — same window_id
schema — so the friendly graph and the adversarial graph share provenance.
We carry the matched lexical terms in `licensed_by` for auditability: every
adversarial edge can be defended with the words that licensed it.
"""

from __future__ import annotations

import sys
from pathlib import Path

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

ADVERSARIAL_TRADITIONS = {
    "adversary",
    "adversary_spr",
    "adversary_thelema",
    "adversary_golden_dawn",
    "critic_traditionalist",
}


def load_lexicon() -> list[str]:
    path = ROOT / "data/raw/adversarial_lexicon.txt"
    out = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        out.append(line.lower())
    return out


def list_files() -> list[tuple[Path, str | None, int | None]]:
    files: list[tuple[Path, str | None, int | None]] = []
    for p in sorted(THEOSOPHIST_DIR.glob("v*_*.txt")):
        files.append((p, None, detect_year(p.name)))
    AUTHOR_DIRS = {
        "besant": "besant_annie",
        "blavatsky": "blavatsky_h_p",
        "leadbeater": "leadbeater_c_w",
        "olcott": "olcott_h_s",
        "lucifer": None,
        "the_path": None,
    }
    for sub, author_id in AUTHOR_DIRS.items():
        d = RAW_DIR / sub
        if not d.exists():
            continue
        for p in sorted(d.iterdir()):
            if p.suffix.lower() in {".txt", ".htm", ".html"}:
                files.append((p, author_id, detect_year(p.name)))
    return files


def main() -> int:
    seeds = pd.read_parquet(ROOT / "data/processed/seed_nodes.parquet")
    table = {r["id"]: list(r["aliases"]) + [r["display_name"]]
             for _, r in seeds.iterrows()}
    gaz = Gazetteer(table)
    print(f"[adv] gazetteer covers {len(gaz)} nodes", flush=True)

    adv_set = set(seeds.loc[seeds.tradition.isin(ADVERSARIAL_TRADITIONS), "id"])
    print(f"[adv] adversarial nodes: {len(adv_set)} -> {sorted(adv_set)}", flush=True)

    lex = load_lexicon()
    print(f"[adv] lexicon has {len(lex)} terms", flush=True)
    # Compile lexicon as one regex (case-insensitive). We intentionally do not
    # use word boundaries on multi-word phrases (e.g. "broken with") because
    # the OCR may insert stray spaces or punctuation.
    import re
    lex_pat = re.compile(
        r"(?i)\b(?:" + "|".join(re.escape(t) for t in lex) + r")\b"
    )

    files = list_files()
    print(f"[adv] processing {len(files)} files", flush=True)

    out_rows: list[dict] = []
    for path, author, year in tqdm(files, desc="files"):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            print(f"[adv] skip {path.name}: {e}")
            continue
        text = normalize(text)
        doc_id = f"{path.parent.name}/{path.name}"
        for w in windows(text, doc_id=doc_id):
            hits = list(gaz.scan(w.text))
            if len(hits) < 2:
                continue
            lex_hits = [(m.start(), m.group(0)) for m in lex_pat.finditer(w.text)]
            lex_terms_in_window = sorted({t.lower() for _, t in lex_hits})

            # Pre-collect entity positions per node_id
            nid_to_pos: dict[str, list[tuple[int, int]]] = {}
            for h in hits:
                nid_to_pos.setdefault(h.node_id, []).append((h.start, h.end))

            ids = sorted(nid_to_pos)
            for i in range(len(ids)):
                for j in range(i + 1, len(ids)):
                    a, b = ids[i], ids[j]
                    is_structural = (a in adv_set) or (b in adv_set)
                    # Lexical: at least one lexicon hit within 600 chars of
                    # either entity. We only fire LEXICAL when both entities
                    # are within 600 chars of a polemic word — otherwise the
                    # mention may be coincidental.
                    is_lexical = False
                    licensed_by: list[str] = []
                    if lex_hits:
                        a_pos = nid_to_pos[a]
                        b_pos = nid_to_pos[b]
                        for lp, lt in lex_hits:
                            close_a = any(abs(lp - p[0]) <= 600 for p in a_pos)
                            close_b = any(abs(lp - p[0]) <= 600 for p in b_pos)
                            if close_a and close_b:
                                is_lexical = True
                                if lt.lower() not in licensed_by:
                                    licensed_by.append(lt.lower())
                    if not (is_structural or is_lexical):
                        continue
                    # Snippet around the closest pair of hits
                    a_pos = nid_to_pos[a][0]
                    b_pos = nid_to_pos[b][0]
                    lo = min(a_pos[0], b_pos[0])
                    hi = max(a_pos[1], b_pos[1])
                    mid = (lo + hi) // 2
                    s_lo = max(0, mid - 200)
                    s_hi = min(len(w.text), mid + 200)
                    snippet = w.text[s_lo:s_hi].replace("\n", " ")
                    out_rows.append({
                        "src": a,
                        "dst": b,
                        "doc_id": doc_id,
                        "source_author": author,
                        "year": year,
                        "window_id": w.window_id,
                        "snippet": snippet,
                        "is_structural": is_structural,
                        "is_lexical": is_lexical,
                        "licensed_by": licensed_by,
                        "lex_terms_in_window": lex_terms_in_window,
                        "weight_raw": 1,
                    })

    df = pd.DataFrame(out_rows)
    out_path = ROOT / "data/processed/edges_adversarial.parquet"
    df.to_parquet(out_path, index=False)
    print(f"[adv] wrote {len(df)} adversarial edges to {out_path}", flush=True)

    if len(df):
        top = (
            df.groupby(["src", "dst"])
            .size()
            .reset_index(name="n")
            .sort_values("n", ascending=False)
            .head(20)
        )
        print("[adv] top 20 adversarial edges:")
        print(top.to_string(index=False))

        struct = df[df.is_structural].groupby(["src", "dst"]).size().reset_index(name="n").sort_values("n", ascending=False).head(10)
        print("\n[adv] top STRUCTURAL adversarial edges (involve a tagged adversary):")
        print(struct.to_string(index=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
