"""Windowing strategy.

The Theosophist volumes are bound annual collections — hundreds of articles,
notes, editorials, correspondence per volume. Article boundaries in the OCR are
unreliable (running heads, page numbers interleave; section dividers are
cosmetic glyphs that don't survive OCR). Rather than fake article segmentation,
we use overlapping fixed-character windows of ~3000 characters with 500-char
overlap. At ~5 chars/word that's ~600 words per window, which is roughly the
length of a long editorial paragraph or short news note — the right scale for
"these two figures are mentioned in the same context."

This is methodologically conservative: a co-occurrence within 600 words is a
weaker claim than co-occurrence in the same article, but it's a *checkable*
claim — every edge has a window snippet you can read.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator


@dataclass(frozen=True)
class Window:
    window_id: str
    start: int
    end: int
    text: str


def windows(text: str, *, doc_id: str, size: int = 3000, stride: int = 2500) -> Iterator[Window]:
    """Yield overlapping windows. stride < size gives overlap = size - stride."""
    n = len(text)
    if n <= size:
        yield Window(window_id=f"{doc_id}::w0", start=0, end=n, text=text)
        return
    i = 0
    k = 0
    while i < n:
        end = min(i + size, n)
        yield Window(
            window_id=f"{doc_id}::w{k}",
            start=i,
            end=end,
            text=text[i:end],
        )
        if end == n:
            break
        i += stride
        k += 1
