# theosophy-number

A multi-center, tiered, adversarial-aware social-distance graph for the modern theosophical movement, extracted from `The Theosophist` (1879–1934) and a basket of per-author Adyar-era corpora.

The center is swappable. The friendly graph and the hostile graph are constructed in parallel — not as flavors of one graph but as two views on a single archive. Crowley-distance is a real metric here, computed exactly the way Blavatsky-distance is, and read off a different edge set.

The front door is the static web artifact in [`web/`](web/) — open `web/index.html` (over `python -m http.server`) and type a name. The whole product is one input, one number, one path, with the corpus snippets that license each edge.

See `PROPOSAL.md` for the methodological and historiographic argument behind the project.

## What you get when you run this

- 111 named figures: the 19th-c. Adyar inner circle (HPB, Olcott, Besant, Leadbeater, Sinnett, Judge, Subba Row, Damodar, Mead, Mabel Collins, the Keightleys, the Arundales, Jinarajadasa, Wadia, Hartmann, Hübbe-Schleiden); the Krishnamurti axis (J.K., Nityananda); the Anthroposophy / Pasadena / ULT / Roerich / Bailey branches; fellow-travelers (Yeats, Gandhi, Tilak, Vivekananda, Ramakrishna, Shankara, Patanjali); the **modernist outsiders the gazetteer pulls in** (Mondrian, Kandinsky, Klee, Hilma af Klint, Scriabin, Edison, Crookes, Wallace, Bohm, Jung, William James, Bergson, Buber, Aldous Huxley, Bernard Shaw, Conan Doyle, Joyce, Eliot, Lawrence, Pound, AE Russell, Maeterlinck, L. Frank Baum, Bradlaugh, Sarojini Naidu, Jawaharlal Nehru, Despard, Pankhurst, Dion Fortune, Manly P. Hall, A. E. Waite, Eliphas Lévi); and the documented enemies (Hodgson/SPR, Solovyov, Emma + Alexis Coulomb, Mathers, Westcott, Crowley, Guénon).
- Friendly co-occurrence edges aggregated from the corpus, weighted by log(n).
- Adversarial edges from `(is_structural, is_lexical)` window analysis with the licensing terms preserved per row.
- Cached distances from seven canonical centers — Blavatsky, Olcott, Besant, Leadbeater, Krishnamurti, Steiner, Crowley — on both graphs.
- A static web artifact (`web/index.html`) that surfaces shortest paths with the corpus snippets that license each edge — radial layout, ranked tables, both graphs, all seven centers, deep-linkable via URL hash.

## Headline finding (sanity check)

Top 20 nodes by sum of incident friendly-edge weight: Besant, Blavatsky, Olcott, Leadbeater, Sinnett, Judge, Krishnamurti, Jinarajadasa, Mead, B. Keightley, Subba Row, G. Arundale, Shankara, Hartmann, Bhagavan Das, W. R. Old, Patanjali, A. Keightley, Mabel Collins, Fullerton. This is exactly the Adyar inner circle that the proposal predicts; the gazetteer and windowing are not producing a degenerate ranking.

## How to run

```bash
# from the repo root
uv venv .venv --python 3.11
uv pip install --python .venv/bin/python -e .

# pipeline (each stage caches; re-run only as needed)
.venv/bin/python scripts/01_seed_from_wiki.py        # ~5s
.venv/bin/python scripts/02_extract_cooccurrence.py  # ~6 min
.venv/bin/python scripts/03_adversarial_edges.py     # ~6 min
.venv/bin/python scripts/04_build_graph.py           # ~10s
.venv/bin/python scripts/05_export_web.py            # ~2s, writes web/data/graph.json

# front-end
cd web && python -m http.server 8000
# then open http://localhost:8000/
```

The first thing to look at: open the front-end, switch to **Hostile**, pick `Aleister Crowley` as the center, choose `Helena Petrovna Blavatsky` as the target. You should see a 2-hop path through Westcott (or Mathers, depending on which Golden-Dawn tie ranks shorter for your build) with the licensing snippets inline. Direct link: [`#graph=hostile&center=crowley_a&target=blavatsky_h_p`](web/index.html#graph=hostile&center=crowley_a&target=blavatsky_h_p&view=radial).

## Repository layout

```
theosophy-number/
├── PROPOSAL.md                 # methodological argument
├── README.md                   # you are here
├── pyproject.toml
├── src/theosophy_number/
│   ├── normalize.py            # OCR pathology fixers (light touch)
│   ├── gazetteer.py            # alias -> regex matcher
│   └── windows.py              # 3000-char overlapping windows
├── scripts/
│   ├── 01_seed_from_wiki.py    # Wikidata SPARQL + supplement -> seed_nodes.parquet
│   ├── 02_extract_cooccurrence.py
│   ├── 03_adversarial_edges.py
│   ├── 04_build_graph.py
│   └── 05_export_web.py        # serialise the graph + snippets to web/data/graph.json
├── web/                        # static research artifact (no backend, no build step)
│   ├── index.html
│   ├── style.css
│   ├── app.js                  # D3 v7 from CDN; in-browser Dijkstra
│   ├── data/graph.json         # ~900 KB — nodes, edges, snippets, distances
│   ├── README.md
│   └── screenshots/
└── data/
    ├── raw/
    │   ├── adversarial_lexicon.txt
    │   ├── seed_supplement.csv
    │   └── edges_supplement.csv
    └── processed/
        ├── seed_nodes.parquet
        ├── edges_cooccurrence.parquet
        ├── edges_cooccurrence_all.parquet  (raw + curated)
        ├── edges_adversarial.parquet
        ├── edges_adversarial_all.parquet   (raw + curated)
        ├── distances.parquet
        ├── graph.gpickle
        ├── graph_friendly.graphml
        └── graph_hostile.graphml
```

## Design decisions, briefly

**Multi-center from day one.** Bhuvana's call. The graph caches distances from seven centers: Blavatsky, Olcott, Besant, Leadbeater, Krishnamurti, Steiner, Crowley. Adding an eighth is a constant-time edit at the top of `04_build_graph.py`.

**Gazetteer over NER.** Rather than spaCy, a curated alias list compiled into a single regex with named groups. One linear scan per document. On 19th-c. OCR with honorifics, Sanskrit/Tamil names, and split tokens, an interpretable wordlist trades recall for *audit-ability*: every match is traceable to an alias you put in the file.

**Windows over articles.** Article boundaries in the OCR are unreliable (running heads, page numbers, cosmetic dividers that don't survive OCR). 3000-char windows with 500-char overlap is conservative — co-occurrence within ~600 words is a weaker claim than co-occurrence in the same article, but it's a *checkable* claim. Every edge has a snippet you can read.

**Two graphs, not one.** The friendly graph (cooccurrence + half-weight directed authorship + curated `cooccurrence` supplement edges) and the hostile graph (windows licensed by polemic vocabulary + structural edges to tagged adversaries + curated `adversarial` supplement edges) share node identity and provenance schema but are kept structurally separate. Distances are computed independently. This is the right choice for the historical question — being structurally close to Crowley is *not* the same kind of fact as being structurally close to HPB.

**Curated supplements are first-class.** `data/raw/edges_supplement.csv` contains a small set of well-attested edges that the corpus systematically underrepresents (Crowley/Mathers/Westcott Golden Dawn ties; Solovyov/Hodgson SPR collaboration; Guénon's anti-theosophy critique). They live in source, are merged at graph-build time, and carry citation metadata.

**Edge weight = log1p(count).** Anti-saturation; a 1000-cooccurrence pair (Olcott–HPB) doesn't completely dominate path-finding over a 50-cooccurrence pair. Distance cost = 1/weight, so dijkstra prefers thicker edges.

## Known limitations and what's punted

1. **theosophy.wiki was unreachable.** The MediaWiki API at `https://theosophy.wiki/w/api.php` is gated by a Cloudflare browser-challenge that scripted clients don't pass. The proposal allowed a fall-back to Wikidata + a hand-curated supplement, and that is what shipped. **A v2 should re-attempt with `cloudscraper` or by mirroring the wiki dump if one is published.**

2. **Crowley, Guénon, and Gurdjieff have zero in-corpus mentions.** This is a *finding*, not a bug — *The Theosophist* and the Adyar press do not mention them, which is itself diagnostic of how the movement drew its rhetorical boundary. Their edges in the graph come from the curated supplement only.

3. **Wikidata returned only 18 explicit theosophists.** Wikidata's coverage of esoteric figures is thin; SPARQL on `P463 (member of) -> Theosophical Society` and on `P106 (occupation) -> theosophist` is a low-recall query. The supplement (62 hand-curated rows) does the heavy lifting. A v2 should run a broader Wikidata + DBpedia + VIAF cross-reference pass and probably scrape `Category:Theosophists` from Wikipedia (not theosophy.wiki).

4. **Per-author corpora are unevenly sized.** Lucifer/Theosophical Review is 30MB (20 volumes); Blavatsky/Besant/Olcott/Leadbeater are 2-8MB each. The directed-authorship edges are therefore biased by available volume count, not by actual prolificacy.

5. **OCR noise is real.** Long-s, broken kerning, page-number interleaves, and hyphenation-across-line-breaks are all present. The normalizer handles the worst patterns but is intentionally conservative — over-normalization corrupts position offsets and confuses provenance. Some name variants (e.g. "Subba\nRow" with a hard line break) are not currently merged with their no-newline counterparts.

6. **No time-slicing yet.** Edges carry `first_year` and `last_year` metadata, so the graph at 1885 / 1895 / 1907 / 1925 / 1934 is a query away. The front-end does not currently expose a year-brush; that is the next-most-valuable add (it would make the 1895 Judge schism and the 1913 Steiner break visible as topological events).

7. **No doctrinal-distance layer yet.** The proposal sketches a parallel embedding-based graph; not built. Embedding the 55-volume Theosophist plus per-author corpora with `sentence-transformers/all-mpnet-base-v2` is a few hours of GPU time and would produce an interesting overlay.

8. **No time-slicing in the front-end yet.** Edges carry `first_year` and `last_year` metadata and the JSON exposes them, but the radial does not slice by year. A year-brush would make the 1895 Judge schism, the 1907 Olcott death, and the 1929 Krishnamurti dissolution visible as topological events; it is the next-most-valuable add.

## What's in v2

- Time-slicing in the front-end (year-brush on the radial; `first_year`/`last_year` are already in `web/data/graph.json`).
- Doctrinal-similarity overlay (sentence-transformer embeddings on per-author corpora) as a third graph layer alongside friendly and hostile.
- Mahatma Letters and Old Diary Leaves as structured edge sources (the proposal's Day-2 task — not yet implemented).
- Wikipedia `Category:Theosophists` recursive crawl as a broader seed.
- `cloudscraper` against theosophy.wiki for Theosopedia infoboxes.
- Egocentric subgraph view per node (one-click "what's around X") and an annotated tour through the canonical 1875–1934 inflection points.

## Provenance

- Source corpus paths are absolute and live outside the repo: `/.../adyar-lexicon/data/processed/theosophical/the_theosophist/` (55 vols, 1879–1934) and `/.../adyar-lexicon/data/raw/theosophical/{besant,blavatsky,leadbeater,olcott,lucifer}/`.
- `the_path/` is currently empty in the source tree; the script picks it up if files are added.
- Wikidata queries dated 2026-04-25.

## License

Code: MIT. Derived edge data: CC-BY. Source citations preserved on every edge.
