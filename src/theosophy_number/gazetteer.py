"""Alias gazetteer + multi-pattern matcher.

We do not use a statistical NER model on this corpus. The reasoning: spaCy's
en_core_web_sm has ~85% F1 on clean modern news, but on 19th-c. OCR with
honorifics, Sanskrit/Tamil names, period typography, and split tokens, recall
collapses below 50% and precision is unpredictable. A curated alias list with
regex word-boundary matching is more interpretable, more auditable, and — for a
fixed seed of ~300 nodes — strictly higher precision.

The pattern is built once as a single compiled regex with named groups
(group name = node_id). One linear scan per document, O(text) not O(text * n).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Iterator


def _slug(s: str) -> str:
    """Stable ASCII slug for use as a regex named group."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_").lower()
    return s or "node"


# Aliases we never want to match — too generic, too dangerous.
# "the Founder" / "the Colonel" / "HPB" -> we DO allow HPB, but block
# generic honorific-only tokens that would create thousands of false positives.
BLOCKED_ALIAS_TOKENS = {
    "the founder", "the colonel", "the president", "madame", "colonel",
    "mister", "doctor", "professor", "the editor", "the master",
    "her", "his", "him", "she", "he", "they",
}


@dataclass(frozen=True)
class GazetteerHit:
    node_id: str
    surface: str
    start: int
    end: int


class Gazetteer:
    """Compile an alias table to a single regex; scan a document in one pass."""

    def __init__(self, alias_table: dict[str, list[str]]):
        """alias_table maps node_id -> list of surface forms."""
        self.node_ids = sorted(alias_table.keys())
        self._group_to_node: dict[str, str] = {}
        # Sort aliases longest-first so "Helena Petrovna Blavatsky" wins over
        # "Blavatsky" (regex alternation is leftmost-longest only inside a
        # single group, not across groups).
        all_alts: list[str] = []
        for node_id in self.node_ids:
            group = "n_" + _slug(node_id)
            self._group_to_node[group] = node_id
            aliases = sorted(
                {a.strip() for a in alias_table[node_id] if a and a.strip()},
                key=lambda x: (-len(x), x),
            )
            aliases = [a for a in aliases if a.lower() not in BLOCKED_ALIAS_TOKENS]
            if not aliases:
                continue
            alts = "|".join(re.escape(a) for a in aliases)
            all_alts.append(f"(?P<{group}>{alts})")
        # Word boundaries: \b on each side. Case-sensitive — proper nouns are
        # capitalized in the corpus. Lowering would balloon false positives
        # (e.g. "the path" the periodical vs. "the path" the metaphor).
        pattern = r"\b(?:" + "|".join(all_alts) + r")\b"
        self._regex = re.compile(pattern)

    def scan(self, text: str) -> Iterator[GazetteerHit]:
        for m in self._regex.finditer(text):
            # Identify which named group fired.
            for grp, node_id in self._group_to_node.items():
                if m.group(grp) is not None:
                    yield GazetteerHit(
                        node_id=node_id,
                        surface=m.group(grp),
                        start=m.start(),
                        end=m.end(),
                    )
                    break

    def __len__(self) -> int:
        return len(self.node_ids)
