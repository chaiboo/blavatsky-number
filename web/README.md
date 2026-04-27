# web/

The static front-end for the theosophy-number graph. One HTML file, one CSS file,
one JS file; D3 v7 from a CDN; no build step, no bundler, no node_modules. The
entire artifact loads `data/graph.json` (about 900 KB) and runs in the browser
from there — pathfinding included.

## How to view it locally

From this directory:

```bash
python -m http.server 8000
# then open http://localhost:8000/
```

Browsers block `fetch()` over `file://` so double-clicking `index.html` will
not work; it has to come over HTTP. Any static server is fine —
`python -m http.server`, `npx serve`, `caddy file-server`, or whatever you
already have. To deploy, copy this whole directory to any static host (GitHub
Pages, Netlify, S3+CloudFront).

Deep-link via the URL hash:
`#graph=hostile&center=crowley_a&target=blavatsky_h_p&view=radial` is the
canonical 2-hop demo state.

## How `data/graph.json` was built

Run `python scripts/05_export_web.py` from the repo root after the upstream
pipeline (scripts 01–04) has produced `data/processed/graph.gpickle`,
`distances.parquet`, and the `_all` snippet parquets. The export script
serializes 77 nodes (each with pre-computed hop and weighted distance from all
seven canonical centers, on both graphs), 590 friendly edges, and 193 hostile
edges, embedding up to three representative snippets per edge — preferring
structural-then-lexical evidence on the hostile side and longest-context
snippets on the friendly side. Snippets are trimmed to ≈360 characters around
the cooccurrence point. The browser reads the JSON, builds adjacency lists,
runs Dijkstra in JavaScript on the small graph, and renders the radial in D3.
