"""Serialize the friendly + hostile graphs and snippet provenance into a single
JSON bundle the static web artifact (web/index.html) can fetch.

Goals:
  - Single payload, gzippable, ideally <2MB. Currently ~ a few hundred KB after
    snippet pruning.
  - Every edge carries up to 3 representative snippets (longest-context, lexical
    flag preferred for adversarial). Snippets are trimmed to ~360 chars centred
    on whichever name was most recently named.
  - Every node carries pre-computed distances (hops + weighted) from each of the
    seven canonical centers, on each graph. The browser does not recompute
    Dijkstra; it just looks up.
  - For path queries the browser DOES walk the (small) edge list itself — the
    graph is ~70 nodes / ~600 edges, well within the budget for in-browser BFS.

Output: web/data/graph.json
"""

from __future__ import annotations

import json
import math
import pickle
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data/processed"
OUT = ROOT / "web/data/graph.json"

CENTERS = [
    "blavatsky_h_p",
    "olcott_h_s",
    "besant_annie",
    "leadbeater_c_w",
    "krishnamurti_j",
    "steiner_rudolf",
    "crowley_a",
]

SNIPPET_LEN = 360            # characters around the centring point
SNIPPETS_PER_EDGE = 3        # cap per edge


def trim_snippet(text: str, target_len: int = SNIPPET_LEN) -> str:
    """OCR snippets are up to 3000 chars. We need a readable excerpt — take the
    middle (most likely to contain the named co-occurrence) and clean
    line-break artifacts that survived the conservative normaliser."""
    if not isinstance(text, str):
        return ""
    text = text.replace("\n", " ").replace("\r", " ")
    while "  " in text:
        text = text.replace("  ", " ")
    text = text.strip()
    if len(text) <= target_len:
        return text
    start = (len(text) - target_len) // 2
    end = start + target_len
    excerpt = text[start:end]
    # snap to word boundaries so we don't end mid-word
    if start > 0:
        sp = excerpt.find(" ")
        if 0 < sp < 30:
            excerpt = excerpt[sp + 1:]
    if end < len(text):
        sp = excerpt.rfind(" ")
        if sp > target_len - 30:
            excerpt = excerpt[:sp]
    prefix = "" if start == 0 else "… "  # ellipsis only if we cut from the left
    suffix = "" if end >= len(text) else " …"
    return f"{prefix}{excerpt}{suffix}"


def pick_snippets(rows: pd.DataFrame, kind: str, limit: int = SNIPPETS_PER_EDGE) -> list[dict]:
    """Choose the most evidentially valuable snippets for an edge.

    Friendly: prefer rows where snippet is non-empty and longish (more context).
    Hostile: prefer is_structural=True, then is_lexical=True, then by length.
    """
    if not len(rows):
        return []
    rows = rows.copy()
    rows["snippet"] = rows["snippet"].fillna("")
    rows["snip_len"] = rows["snippet"].str.len()
    rows = rows[rows["snippet"] != ""]

    if kind == "hostile" and "is_structural" in rows.columns:
        rows = rows.sort_values(
            ["is_structural", "is_lexical", "snip_len"],
            ascending=[False, False, False],
        )
    else:
        rows = rows.sort_values("snip_len", ascending=False)

    out = []
    seen_docs = set()
    for _, r in rows.iterrows():
        # Diversify across documents so we don't ship three snippets from the
        # same window of one volume.
        doc = r.get("doc_id") or ""
        if doc in seen_docs and len(out) >= 1:
            continue
        seen_docs.add(doc)
        author = r.get("source_author")
        if author is None or (isinstance(author, float) and pd.isna(author)) or author == "":
            author = None
        snip = {
            "snippet": trim_snippet(r.get("snippet", "")),
            "doc": doc if doc else "",
            "year": int(r["year"]) if pd.notna(r.get("year")) else None,
            "window": r.get("window_id") or "",
            "author": author,
        }
        if kind == "hostile":
            lb = r.get("licensed_by")
            if hasattr(lb, "tolist"):
                lb = lb.tolist()
            elif lb is None or (isinstance(lb, float) and pd.isna(lb)):
                lb = []
            snip["licensed_by"] = list(lb)
            snip["is_structural"] = bool(r.get("is_structural", False))
            snip["is_lexical"] = bool(r.get("is_lexical", False))
        out.append(snip)
        if len(out) >= limit:
            break
    return out


def edges_payload(g, kind: str, snippet_df: pd.DataFrame) -> list[dict]:
    """Flatten the undirected projection into JSON edge records."""
    # Group snippet rows by unordered pair for O(E) lookup, not O(E*N).
    snippet_df = snippet_df.copy()
    snippet_df["_pair"] = snippet_df.apply(
        lambda r: tuple(sorted([r["src"], r["dst"]])), axis=1
    )
    pair_groups = {p: sub for p, sub in snippet_df.groupby("_pair", sort=False)}

    out = []
    for u, v, attrs in g.edges(data=True):
        pair = tuple(sorted([u, v]))
        rows = pair_groups.get(pair)
        snippets = pick_snippets(rows, kind) if rows is not None else []
        # Year span: pull from snippet rows if available
        years = (
            [int(y) for y in rows["year"].dropna().unique()] if rows is not None else []
        )
        out.append({
            "source": u,
            "target": v,
            "graph": kind,
            "weight": round(float(attrs.get("weight", 0.0)), 4),
            "n": int(attrs.get("n", 0)),
            "first_year": min(years) if years else None,
            "last_year": max(years) if years else None,
            "snippets": snippets,
        })
    return out


def nodes_payload(seeds: pd.DataFrame, friendly, hostile, distances: pd.DataFrame) -> list[dict]:
    # Index distances for fast lookup
    dist_idx: dict[tuple[str, str, str], dict] = {}
    for _, r in distances.iterrows():
        dist_idx[(r["graph"], r["center"], r["node"])] = {
            "hops": None if pd.isna(r["hops"]) else int(r["hops"]),
            "wd": None if pd.isna(r["weighted_distance"]) else round(float(r["weighted_distance"]), 4),
        }

    def total_weight(g, n):
        return round(sum(d.get("weight", 0.0) for _, _, d in g.edges(n, data=True)), 4)

    out = []
    for _, r in seeds.iterrows():
        nid = r["id"]
        node = {
            "id": nid,
            "name": r["display_name"],
            "tradition": r["tradition"],
            "birth": r["birth"] or None,
            "death": r["death"] or None,
            "qid": r["wikidata_qid"] or None,
            "weight_friendly": total_weight(friendly, nid) if nid in friendly else 0.0,
            "weight_hostile": total_weight(hostile, nid) if nid in hostile else 0.0,
            "distances": {
                "friendly": {
                    c: dist_idx.get(("friendly", c, nid), {"hops": None, "wd": None})
                    for c in CENTERS
                },
                "hostile": {
                    c: dist_idx.get(("hostile", c, nid), {"hops": None, "wd": None})
                    for c in CENTERS
                },
            },
        }
        out.append(node)
    return out


def main() -> int:
    seeds = pd.read_parquet(PROC / "seed_nodes.parquet")
    distances = pd.read_parquet(PROC / "distances.parquet")
    cooc = pd.read_parquet(PROC / "edges_cooccurrence_all.parquet")
    adv = pd.read_parquet(PROC / "edges_adversarial_all.parquet")
    with open(PROC / "graph.gpickle", "rb") as f:
        graphs = pickle.load(f)
    friendly = graphs["friendly"]
    hostile = graphs["hostile"]

    nodes = nodes_payload(seeds, friendly, hostile, distances)
    f_edges = edges_payload(friendly, "friendly", cooc)
    h_edges = edges_payload(hostile, "hostile", adv)

    # Drop edges where the supplement-only entry has no real snippet — they're
    # still in the graph for path-finding, but flag them so the UI can label.
    for e in f_edges + h_edges:
        if not e["snippets"]:
            e["curated_only"] = True

    payload = {
        "meta": {
            "centers": CENTERS,
            "node_count": len(nodes),
            "edge_count_friendly": len(f_edges),
            "edge_count_hostile": len(h_edges),
            "snippet_chars": SNIPPET_LEN,
            "snippets_per_edge": SNIPPETS_PER_EDGE,
            "source_corpus": "The Theosophist 1879-1934 (55 vols) + per-author Adyar/Lucifer/Pasadena subdirs",
        },
        "nodes": nodes,
        "edges": {
            "friendly": f_edges,
            "hostile": h_edges,
        },
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Belt and suspenders: scrub any remaining numpy/pandas NaN that survived
    # the per-field coercion above. JSON-with-NaN is a JSON.parse failure in
    # the browser; we'd rather fail noisily here than silently corrupt the
    # client.
    def _scrub(o):
        if isinstance(o, dict):
            return {k: _scrub(v) for k, v in o.items()}
        if isinstance(o, list):
            return [_scrub(v) for v in o]
        if isinstance(o, float) and (math.isnan(o) or math.isinf(o)):
            return None
        return o
    payload = _scrub(payload)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    size_kb = OUT.stat().st_size / 1024
    print(f"[export] wrote {OUT.relative_to(ROOT)} ({size_kb:.1f} KB)")
    print(f"[export] nodes={len(nodes)} friendly_edges={len(f_edges)} hostile_edges={len(h_edges)}")
    snip_total = sum(len(e['snippets']) for e in f_edges + h_edges)
    print(f"[export] total snippets embedded = {snip_total}")
    print(f"[export] curated-only edges (no snippet): {sum(1 for e in f_edges + h_edges if e.get('curated_only'))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
