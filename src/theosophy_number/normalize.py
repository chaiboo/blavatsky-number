"""OCR normalization for late 19th / early 20th c. theosophical print.

The Theosophist scans run from 1879 onward; the early Adyar press is hand-set,
heavily ligatured, and OCR'd with pre-2010 engines. We normalize *minimally* and
*reversibly enough* to preserve offsets — the goal is matching, not pretty text.

Specific OCR pathologies observed in this corpus:

  - Long-s ('ſ') rendered as 'f' or 'l': "Madame Blavatfky"
  - Hyphenation across line breaks: "Bla-\nvatsky"
  - Stray spaces inside words from broken kerning: "B l a v a t s k y"
  - Missing or wrong vowels: "Olcofct", "Blavalsky"
  - Page numbers and headers interleaved mid-paragraph
  - Mixed case from running heads: "THEOSOPHIST" mid-sentence

We do not try to fix all of these. We collapse intra-word spacing only when
flanked by uppercase ASCII (a strong signal of a broken proper noun), and we
de-hyphenate at line breaks. Everything else is left to fuzzy alias matching.
"""

from __future__ import annotations

import re

# De-hyphenate across line breaks: "Bla-\nvatsky" -> "Blavatsky".
# We only do this when both sides are alphabetic to avoid eating list dashes.
_LINE_HYPHEN = re.compile(r"([A-Za-z])-\s*\n\s*([A-Za-z])")

# Collapse runs of internal whitespace inside what looks like a fractured proper
# noun: "B l a v a t s k y" -> "Blavatsky". Triggered only when we see >=4
# single-letter uppercase tokens in a row, to avoid mangling normal prose.
_FRACTURED = re.compile(r"\b(?:[A-Z]\s){3,}[A-Z]\b")

# Soft hyphen, zero-width chars, BOM
_INVISIBLE = re.compile(r"[­​‌‍﻿]")


def normalize(text: str) -> str:
    """Light, idempotent normalization. Preserves length-ish; do not rely on
    exact character offsets back to the source."""
    text = _INVISIBLE.sub("", text)
    text = _LINE_HYPHEN.sub(r"\1\2", text)

    def _heal(m: re.Match) -> str:
        return m.group(0).replace(" ", "")

    text = _FRACTURED.sub(_heal, text)
    # Collapse 3+ spaces to 2 (preserves paragraph rhythm of OCR'd two-space
    # indents but avoids huge whitespace seas).
    text = re.sub(r" {3,}", "  ", text)
    return text


def detect_year(filename: str) -> int | None:
    """Pull the first 4-digit year from a filename like v012_1890_1891.txt."""
    m = re.search(r"(1[7-9]\d{2}|20[0-2]\d)", filename)
    return int(m.group(1)) if m else None
