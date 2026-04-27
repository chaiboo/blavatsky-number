"""Assemble the multi-edge graph and cache distances from the canonical centers.

Edge types:
  - cooccurrence : symmetric, from edges_cooccurrence.parquet
  - directed_authorship : when source_author is set, the edge gets a directed
    twin from author -> mentioned_other (because Besant-on-Olcott is different
    signal than Olcott-on-Besant).
  - adversarial : symmetric, from edges_adversarial.parquet
  - wiki_link : currently NOT populated — theosophy.wiki Cloudflare-blocked
    us. Reserved type for v2 when a non-Cloudflare archival mirror is found.

Edge weight: log1p of count, plus a small bonus for being licensed by the
adversarial lexicon. Distances use 1/weight as edge cost so a thicker edge
is a shorter walk.

Centers cached: blavatsky_h_p, olcott_h_s, besant_annie, leadbeater_c_w,
                krishnamurti_j, steiner_rudolf, crowley_a.

Output:
  data/processed/graph.gpickle
  data/processed/graph.graphml
  data/processed/distances.parquet
"""

from __future__ import annotations

import math
import pickle
import sys
from pathlib import Path

import networkx as nx
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))


CENTERS = [
    "blavatsky_h_p",
    "olcott_h_s",
    "besant_annie",
    "leadbeater_c_w",
    "krishnamurti_j",
    "steiner_rudolf",
    "crowley_a",
]


def aggregate_edges(edges: pd.DataFrame, edge_type: str) -> pd.DataFrame:
    if "year" not in edges.columns:
        edges["year"] = None

    def _safe_min(s):
        vals = [int(y) for y in s if pd.notna(y) and y]
        return int(min(vals)) if vals else None

    def _safe_max(s):
        vals = [int(y) for y in s if pd.notna(y) and y]
        return int(max(vals)) if vals else None

    grouped = (
        edges.groupby(["src", "dst"])
        .agg(
            n=("weight_raw", "sum"),
            first_year=("year", _safe_min),
            last_year=("year", _safe_max),
            doc_count=("doc_id", "nunique"),
        )
        .reset_index()
    )
    grouped["edge_type"] = edge_type
    grouped["weight"] = grouped["n"].apply(lambda n: math.log1p(float(n)))
    return grouped


def build_graphs(
    seeds: pd.DataFrame, cooc: pd.DataFrame, adv: pd.DataFrame
) -> tuple[nx.MultiDiGraph, nx.Graph, nx.Graph]:
    """Build the multi-edge directed graph plus two simple-graph projections
    (friendly = cooccurrence, hostile = adversarial) for distance queries."""
    G = nx.MultiDiGraph()
    for _, r in seeds.iterrows():
        G.add_node(
            r["id"],
            display_name=r["display_name"],
            tradition=r["tradition"],
            birth=r["birth"] or None,
            death=r["death"] or None,
            wikidata_qid=r["wikidata_qid"] or None,
        )

    cooc_agg = aggregate_edges(cooc, "cooccurrence")
    adv_agg = aggregate_edges(adv, "adversarial")

    # Add symmetric cooccurrence edges (both directions in the MultiDiGraph)
    for _, r in cooc_agg.iterrows():
        for src, dst in [(r["src"], r["dst"]), (r["dst"], r["src"])]:
            G.add_edge(
                src, dst,
                key=f"cooc:{r['first_year'] or 0}",
                edge_type="cooccurrence",
                weight=r["weight"],
                n=int(r["n"]),
                first_year=r["first_year"],
                last_year=r["last_year"],
                doc_count=int(r["doc_count"]),
            )
    for _, r in adv_agg.iterrows():
        for src, dst in [(r["src"], r["dst"]), (r["dst"], r["src"])]:
            G.add_edge(
                src, dst,
                key=f"adv:{r['first_year'] or 0}",
                edge_type="adversarial",
                weight=r["weight"],
                n=int(r["n"]),
                first_year=r["first_year"],
                last_year=r["last_year"],
                doc_count=int(r["doc_count"]),
            )

    # Directed authorship edges: when an author writes a document, all
    # entities mentioned are reachable directionally from the author.
    auth = cooc[cooc.source_author.notna() & (cooc.source_author != "")]
    if len(auth):
        directional = (
            auth.groupby(["source_author", "src"]).size().reset_index(name="n")
        ).rename(columns={"source_author": "_author", "src": "_target"})
        directional2 = (
            auth.groupby(["source_author", "dst"]).size().reset_index(name="n")
        ).rename(columns={"source_author": "_author", "dst": "_target"})
        all_dir = pd.concat([directional, directional2])
        all_dir = all_dir[all_dir._author != all_dir._target]
        all_dir = all_dir.groupby(["_author", "_target"]).n.sum().reset_index()
        for _, r in all_dir.iterrows():
            if r["_author"] not in G or r["_target"] not in G:
                continue
            G.add_edge(
                r["_author"], r["_target"],
                key=f"auth",
                edge_type="directed_authorship",
                weight=math.log1p(float(r["n"])) * 0.5,  # half-weight; less directly evidentiary
                n=int(r["n"]),
            )

    # Friendly projection: undirected, edges = cooccurrence + (half-weight)
    # directed_authorship; we DROP adversarial from the friendly graph.
    friendly = nx.Graph()
    for n, attrs in G.nodes(data=True):
        friendly.add_node(n, **attrs)
    for u, v, k, attrs in G.edges(keys=True, data=True):
        if attrs["edge_type"] == "adversarial":
            continue
        if friendly.has_edge(u, v):
            friendly[u][v]["weight"] = max(friendly[u][v]["weight"], attrs["weight"])
            friendly[u][v]["n"] = friendly[u][v].get("n", 0) + attrs.get("n", 0)
        else:
            friendly.add_edge(u, v, weight=attrs["weight"], n=attrs.get("n", 0))

    # Hostile projection: undirected, edges = adversarial only.
    hostile = nx.Graph()
    for n, attrs in G.nodes(data=True):
        hostile.add_node(n, **attrs)
    for u, v, k, attrs in G.edges(keys=True, data=True):
        if attrs["edge_type"] != "adversarial":
            continue
        if hostile.has_edge(u, v):
            hostile[u][v]["weight"] = max(hostile[u][v]["weight"], attrs["weight"])
            hostile[u][v]["n"] = hostile[u][v].get("n", 0) + attrs.get("n", 0)
        else:
            hostile.add_edge(u, v, weight=attrs["weight"], n=attrs.get("n", 0))

    return G, friendly, hostile


def cache_distances(friendly: nx.Graph, hostile: nx.Graph, centers: list[str]) -> pd.DataFrame:
    rows = []
    for graph_name, g in [("friendly", friendly), ("hostile", hostile)]:
        for c in centers:
            if c not in g:
                continue
            # Hop count (unweighted) and weighted distance (1/weight as cost).
            try:
                hops = nx.single_source_shortest_path_length(g, c)
            except Exception:
                hops = {}
            # For weighted: a thicker edge should be a shorter walk.
            for u, v, d in g.edges(data=True):
                d["cost"] = 1.0 / max(d.get("weight", 0.001), 0.001)
            try:
                weighted = nx.single_source_dijkstra_path_length(g, c, weight="cost")
            except Exception:
                weighted = {}
            for n in g.nodes:
                rows.append({
                    "graph": graph_name,
                    "center": c,
                    "node": n,
                    "hops": hops.get(n),
                    "weighted_distance": weighted.get(n),
                    "reachable": n in hops,
                })
    return pd.DataFrame(rows)


def load_edge_supplement(seeds: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load the curated edges_supplement.csv and split by type."""
    path = ROOT / "data/raw/edges_supplement.csv"
    if not path.exists():
        return pd.DataFrame(), pd.DataFrame()
    seed_ids = set(seeds["id"])
    s = pd.read_csv(path)
    s = s[s.src.isin(seed_ids) & s.dst.isin(seed_ids)].copy()
    s["doc_id"] = s["source_citation"]
    s["source_author"] = None
    s["year"] = None
    s["window_id"] = "supplement"
    s["snippet"] = s["note"]
    s["weight_raw"] = 5  # curated = strong evidentiary weight (5x default)
    cooc = s[s.edge_type == "cooccurrence"].drop(columns=["edge_type", "note", "source_citation"])
    adv = s[s.edge_type == "adversarial"].copy()
    if len(adv):
        adv["is_structural"] = True
        adv["is_lexical"] = False
        adv["licensed_by"] = [["curated_supplement"]] * len(adv)
        adv["lex_terms_in_window"] = [[]] * len(adv)
        adv = adv.drop(columns=["edge_type", "note", "source_citation"])
    return cooc, adv


def main() -> int:
    seeds = pd.read_parquet(ROOT / "data/processed/seed_nodes.parquet")
    cooc = pd.read_parquet(ROOT / "data/processed/edges_cooccurrence.parquet")
    adv = pd.read_parquet(ROOT / "data/processed/edges_adversarial.parquet")
    sup_cooc, sup_adv = load_edge_supplement(seeds)
    if len(sup_cooc):
        cooc = pd.concat([cooc, sup_cooc], ignore_index=True)
    if len(sup_adv):
        adv = pd.concat([adv, sup_adv], ignore_index=True)
    print(f"[graph] seeds={len(seeds)} cooc_rows={len(cooc)} (+{len(sup_cooc)} curated) adv_rows={len(adv)} (+{len(sup_adv)} curated)")

    # Persist the merged sources so the app can look up snippets for any edge
    # without needing to know whether it came from text or curation.
    cooc.to_parquet(ROOT / "data/processed/edges_cooccurrence_all.parquet", index=False)
    adv.to_parquet(ROOT / "data/processed/edges_adversarial_all.parquet", index=False)

    G, friendly, hostile = build_graphs(seeds, cooc, adv)
    print(f"[graph] multigraph: nodes={G.number_of_nodes()} edges={G.number_of_edges()}")
    print(f"[graph] friendly: nodes={friendly.number_of_nodes()} edges={friendly.number_of_edges()}")
    print(f"[graph] hostile:  nodes={hostile.number_of_nodes()} edges={hostile.number_of_edges()}")

    # Save graph
    out_dir = ROOT / "data/processed"
    with open(out_dir / "graph.gpickle", "wb") as f:
        pickle.dump({"multi": G, "friendly": friendly, "hostile": hostile}, f)
    # GraphML rejects None values; coerce.
    def _coerce(g: nx.Graph) -> nx.Graph:
        h = g.copy()
        for n, attrs in list(h.nodes(data=True)):
            for k, v in list(attrs.items()):
                if v is None:
                    h.nodes[n][k] = ""
        for u, v, attrs in list(h.edges(data=True)):
            for k, val in list(attrs.items()):
                if val is None:
                    h[u][v][k] = ""
        return h

    nx.write_graphml(_coerce(friendly), out_dir / "graph_friendly.graphml")
    nx.write_graphml(_coerce(hostile), out_dir / "graph_hostile.graphml")
    print(f"[graph] wrote graph.gpickle and graphml")

    # Distances
    dists = cache_distances(friendly, hostile, CENTERS)
    dists.to_parquet(out_dir / "distances.parquet", index=False)
    print(f"[graph] wrote distances.parquet ({len(dists)} rows)")

    # Sanity print
    print("\n[graph] friendly distance from blavatsky_h_p (hop counts):")
    sub = dists[(dists.graph == "friendly") & (dists.center == "blavatsky_h_p") & dists.reachable].sort_values(["hops", "weighted_distance"])
    print(sub.head(20).to_string(index=False))

    print("\n[graph] hostile distance from crowley_a:")
    sub = dists[(dists.graph == "hostile") & (dists.center == "crowley_a") & dists.reachable].sort_values(["hops", "weighted_distance"])
    print(sub.head(20).to_string(index=False))

    # Top entities by total weight in friendly graph (sanity check)
    deg = sorted(
        ((n, sum(d.get("weight", 0) for _, _, d in friendly.edges(n, data=True)))
         for n in friendly.nodes),
        key=lambda x: x[1], reverse=True,
    )
    print("\n[graph] top 20 nodes by sum of incident edge weight (friendly):")
    seeds_idx = seeds.set_index("id")
    for n, w in deg[:20]:
        nm = seeds_idx.loc[n, "display_name"] if n in seeds_idx.index else n
        print(f"  {n:30s} {nm:35s} weight_sum={w:.2f}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
