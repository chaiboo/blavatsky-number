"""Print the list of figure display names from web/data/graph.json, one per
line, alphabetically sorted. Use this to paste into the Google Form
'Connected to whom in the existing network?' checkbox field.

Run: python scripts/list_figures.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPH = ROOT / "web/data/graph.json"


def main() -> int:
    g = json.loads(GRAPH.read_text(encoding="utf-8"))
    names = sorted(n["name"] for n in g["nodes"])
    print("\n".join(names))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
