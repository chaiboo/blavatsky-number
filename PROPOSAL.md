# The Theosophy Number

A research and prototyping plan for an Erdős-style social-distance graph centered on the modern theosophical movement, with the load-bearing claim that this graph, properly constructed, is a map of how late-nineteenth and early-twentieth-century esoteric, anti-colonial, modernist, and proto-New-Age networks touched each other.

---

## 1. The center: Blavatsky, with Olcott as a structural footnote

Use **Helena Petrovna Blavatsky (HPB)** as the singular center. The Blavatsky-distance is the headline metric.

The case for HPB over the alternatives is not sentimental. It is graph-theoretic and historiographic.

- **Olcott** is closer to a hub than a source. He is the institutional spine of the Theosophical Society, but most of the people you would want to count as theosophists came to the movement through HPB's writings and only met Olcott as an administrator. Centering on Olcott would over-weight Adyar bureaucrats and under-weight the literary/occultist wing. He should be the second-most-central node, not the center.
- **Annie Besant** is downstream of HPB by definition (she joined the TS in 1889 after reviewing *The Secret Doctrine*). Centering on Besant produces a graph that effectively starts in 1889 and is heavily Anglo-Indian and Co-Masonic. Useful as a *time-sliced* center (see Section 5) but not as the canonical one.
- **Leadbeater** is too compromised and too narrow — his network is real but is dominated by ES (Esoteric Section) inner circles, the Liberal Catholic Church, and the Krishnamurti project. Centering on him is centering on a sub-clique.
- **Krishnamurti** breaks the graph in the wrong way. K's interesting connections (Huxley, Bohm, Iyer, Anita Desai's circle) all happen *after* he dissolved the Order of the Star in 1929, by which point he is explicitly not a theosophist. A K-center metric is a different project — call it the Krishnamurti-number — and worth doing separately.
- **Steiner** broke off in 1912/1913 to found Anthroposophy. A Steiner-center pulls in the entire German-speaking esoteric milieu (Morgenstern, Kandinsky, Beuys eventually) but loses most of the South Asian and Anglo-American networks. Again, a separate project.

**Recommendation:** ship the Blavatsky-number as v1. Build the architecture so that swapping the center is a single function argument. Then publish parallel Krishnamurti-, Steiner-, and Besant-distance views as companion artifacts. The comparison between the four centers *is itself the analysis* — it visualizes the schisms in the movement as differences in graph topology.

## 2. Edges: a tiered definition, because one definition will not work

The single hardest design decision. Co-authorship — the Erdős criterion — is nearly useless here. HPB co-authored almost nothing in the strict sense; *Isis Unveiled* and *The Secret Doctrine* are nominally solo, the Mahatma Letters are pseudonymous, and most theosophical "collaboration" took the form of editing each other's periodicals or transcribing each other's lectures.

Adopt a **tiered edge schema**, where each edge carries a type label and a strength weight. Different analyses can filter to different tiers.

**Tier 1 — hard edges (high evidentiary standard, low ambiguity):**
- Documented in-person meeting attested in correspondence, diaries, or contemporary reportage (Olcott's *Old Diary Leaves* alone yields hundreds of these for the 1875–1907 period).
- Co-authored or co-edited publication, including periodical co-editorship (HPB and Olcott on *The Theosophist*; HPB and Mabel Collins on *Lucifer*).
- Documented chela-guru / initiation relationship, where "documented" means appearing in TS records, ES rolls, or the subject's own published account.
- Known correspondent — at least one surviving letter in either direction in a published or archived collection.

**Tier 2 — soft edges (institutional co-presence):**
- Membership in the same lodge during overlapping years (requires lodge rolls).
- Attendance at the same TS Convention (Adyar conventions are well-documented from 1882 onward; American Section conventions from 1886).
- Contribution to the same issue of a TS periodical.

**Tier 3 — speculative edges (aspirational, flag separately):**
- Cited / quoted / dedicated work to.
- Attended the same lecture (almost never reconstructible except for celebrity audiences — Yeats at HPB's London lodge, for instance).
- "Influenced by" claims in secondary literature.

**The honest constraint:** Tier 2 edges will collapse the graph. By 1907, more or less every named theosophist has attended a convention with more or less every other named theosophist within two hops via Adyar or Point Loma. The interesting structure lives in **Tier 1 weighted by frequency** — a graph where Olcott-Blavatsky is a thick edge (decades of cohabitation) and Yeats-Blavatsky is a thin one (a few lodge meetings in 1887–1890).

Build the graph multi-edge from the start. Each edge is `(source, target, type, year, source_document, weight)`. Do not collapse to a simple graph until the very last visualization step, and even then, collapse with care.

## 3. Sources: what actually exists, what is tractable, what is fantasy

Ranked roughly by ratio of (signal extracted) / (effort required).

**High-yield, available now:**
- **Blavatsky's *Collected Writings* (BCW), 15 volumes**, edited by Boris de Zirkoff. Heavily indexed with named-person index in vol. 15. Full text is on theosociety.org and Hathitrust. This alone yields several hundred Tier 1 edges centered on HPB.
- **Olcott's *Old Diary Leaves*, 6 volumes.** Available on theosociety.org and IAPSOP. The single richest source for 1875–1906 social network reconstruction. Olcott names everyone he meets, often with dates. This is the spine of the v1 graph.
- **The Mahatma Letters to A.P. Sinnett** (Barker edition, 1923; Chronological edition, 1993). Defines the inner-circle network of the early TS.
- **IAPSOP (iapsop.com)** — the International Association for the Preservation of Spiritualist and Occult Periodicals. Has scanned runs of *The Theosophist*, *Lucifer*, *The Path*, *The Theosophical Review*, *The Word*, and dozens of adjacent periodicals. OCR quality varies — the late-nineteenth-century print is often clean enough, the hand-set Adyar press from the 1880s is rougher. This is your periodical co-presence layer.
- **Wikipedia + Wikidata.** Category:Theosophists has roughly 200–300 entries depending on subcategories. Wikidata properties P737 ("influenced by"), P184 ("doctoral advisor", less useful), P802 ("student"), P3373 ("sibling"), and the free-text "known for" / "influenced" infobox fields give you a rough Tier 3 graph in an afternoon. Use this as the seed list, not as ground truth.

**Medium-yield, requires more work:**
- **Theosophical Society Adyar archives.** Membership rolls exist but are not fully digitized. The Adyar Library and Research Centre catalog is online but searching membership records typically requires email correspondence with the archivist. Realistic for a v2, not a v1.
- **Theosophical Society Pasadena (theosociety.org)** has a smaller but more openly accessible archive, including digitized Judge-era American Section materials.
- **United Lodge of Theosophists (ULT)** maintains a separate publishing and membership tradition (Robert Crosbie schism, 1909). Their archives are less centralized.
- **Krotona Institute (Ojai)** archives — the American ES hub from 1912 onward.
- **Letters from the Masters of the Wisdom**, series 1 and 2, edited by C. Jinarajadasa.
- **WorldCat / VIAF authority records** for disambiguation. Critical for the John-Smith problem (there are at least three theosophical figures named some variant of "Cooper").

**Hard or paywalled:**
- **The Theosophist** post-1950 — paywalled at TS Adyar; not strictly necessary for the Blavatsky-era graph.
- **Steiner's Gesamtausgabe** (the Rudolf Steiner Press collected works) — partially translated, partially behind institutional access.
- **Krishnamurti Foundation archives** at Brockwood Park and Ojai — accessible to researchers in person, less so remotely.
- **Original-language sources in Sanskrit, Hindi, Telugu, Bengali, Tamil.** Subbiah Iyer, Bhagavan Das, Damodar K. Mavalankar, the Adyar pandits — these are the nodes that get systematically under-weighted in any Anglophone source mining. Flag this as a known bias of the v1 graph and revisit in a later iteration with a collaborator who reads the relevant scripts. This is a real methodological limitation, not a footnote.

## 4. Why this matters beyond a parlor game

The intellectual payoff is not "Bertrand Russell has a Blavatsky number of 3." The payoff is that a properly constructed theosophical-distance graph is a **structural map of late-modern heterodox cosmopolitanism**.

Consider what a single high-degree node like Annie Besant connects:
- HPB and Charles Bradlaugh (secularism, free thought)
- The Indian National Congress (she was president in 1917) and thus Gandhi, Tilak, the Nehrus
- Bernard Shaw, the Fabian Society, the Bloomsbury periphery
- The early British women's suffrage movement
- Krishnamurti and, through him, Aldous Huxley, David Bohm, Iris Murdoch's milieu
- Co-Masonry and Liberal Catholicism

That is not a sectarian story. That is a map of how anti-colonial politics, early feminism, vegetarianism, animal welfare, theatrical modernism, and the prehistory of the New Age share infrastructure. The theosophical-distance graph is *the visible substrate* of that infrastructure.

This is the scholarly framing that distinguishes the project from a fan-wiki exercise. The literature it speaks to: Joscelyn Godwin's *The Theosophical Enlightenment*, Mark Bevir's work on theosophy and the Indian National Congress, Catherine Wessinger on Besant, Olav Hammer on esoteric epistemology, Egil Asprem's *The Problem of Disenchantment*, Wouter Hanegraaff's Amsterdam school. Position the project there.

## 5. Variants worth building, in order of payoff per unit effort

1. **Time-sliced graph.** Render the graph at 1885, 1895, 1907 (Olcott's death), 1925 (Krishnamurti as World Teacher), 1934 (Besant's death), 1947 (independence). The schisms — Judge in 1895, Steiner in 1913, Krishnamurti in 1929 — become visible as topological events. This is the single most interesting variant because it makes the graph *narrate*.
2. **Weighted edges by contact frequency.** Olcott-HPB is a different kind of edge than Yeats-HPB; refusing to encode that throws away signal. Use letter count + co-residence months + co-publication count as a composite weight.
3. **Doctrinal-similarity graph as a parallel layer.** Train embeddings (sentence-transformers, or fine-tuned on the BCW + adjacent corpus) on each author's writings, and compute a doctrinal-distance graph in parallel with the social-distance graph. The disagreement between the two graphs is the analysis: where are people socially close but doctrinally distant (HPB and Olcott on ritual), or socially distant but doctrinally close (Steiner and certain American theosophists post-1913)?
4. **Adversarial distance.** Distance via shared antagonists. Crowley to HPB through their mutual hostilities (Mathers, Westcott, the Hermetic Order of the Golden Dawn). The Solovyov / SPR / Coulomb-affair network of accusers. This produces a "shadow graph" that is structurally informative.
5. **Cross-tradition extensions.** Once the core graph is stable, extend to: Gurdjieff (via Ouspensky and Orage), Jung (via the Eranos circle and Mead), Yeats (via the Dublin lodge and the Golden Dawn), Mondrian, Kandinsky, Scriabin (via theosophical color theory), Hilma af Klint, L. Frank Baum (a documented TS member), Edison, Tesla (rumored but harder to source). The Baum and af Klint connections are particularly valuable for visualization-as-argument purposes — they make the graph legible to art-historical and literary audiences.

## 6. Minimum viable prototype — a weekend's work

The constraint: feasible in 8–12 hours of focused work, produces something legitimately interesting, and establishes the data model so that v2 is an extension rather than a rewrite.

**Day 1 (4–6 hours):**
1. Pull `Category:Theosophists` and recursive subcategories from Wikipedia via the MediaWiki API. Get the list of names (~250 candidate nodes).
2. For each name, fetch the Wikidata item. Extract: birth/death dates, nationality, P737 ("influenced by"), and the free-text influences from the article infobox.
3. Build a directed graph in `networkx` from those relations. Compute Blavatsky-distance for every node. Save to a Parquet or JSON file with provenance fields.
4. First sanity check: who has Blavatsky-distance 1? Should be roughly the inner circle — Olcott, Sinnett, Judge, Besant (after 1889), Mead, Mabel Collins, Damodar. If Wikipedia's "influenced by" fields produce wildly wrong distance-1 nodes, that itself is a finding about Wikipedia's coverage of esoteric history, and worth a note.

**Day 2 (4–6 hours):**
5. Layer in a hand-curated edge set from *Old Diary Leaves* and the BCW name index. Even 100 manually-entered Tier 1 edges materially change the graph.
6. Build a small Streamlit (or Observable, given your existing workflow) app: search a name, get their Blavatsky-distance, see the shortest path with edge types annotated, see the local neighborhood. The shortest-path-with-annotations view is the killer feature; it is the thing a non-technical reader will understand immediately.
7. One bespoke visualization: a radial layout with HPB at center, distance as radius, year-of-first-contact as angular position. Color by tradition (TS-Adyar, TS-Pasadena, ULT, Anthroposophy, Krishnamurti circle, art/literature, politics). This visualization is the pitch — it is what gets shared.

**v2 increments, in order:**
- Mine *Old Diary Leaves* programmatically. The text is on theosociety.org as HTML. A named-entity recognition pass plus manual correction yields several hundred dated meetings. This is the single highest-leverage data-extraction task.
- Add the BCW vol. 15 index as structured edges. The index is already a hand-curated edge list; it just needs to be parsed.
- Add a periodical co-contribution layer from IAPSOP table-of-contents pages.
- Add the time-slice view.
- Begin extending into adjacent traditions (Gurdjieff, Golden Dawn, anthroposophy).

## 7. Things to decide before writing code

- **Disambiguation strategy.** Use VIAF IDs as canonical identifiers from day one. Wikipedia titles change; VIAF IDs do not. Names like "C. W. Leadbeater," "Charles Webster Leadbeater," and "Bishop Leadbeater" must collapse to one node.
- **What counts as a node.** Strictly individuals, or also institutions (lodges, periodicals, publishing houses)? Recommend individuals only for v1; institutional nodes are a v2 enrichment that turns the graph bipartite and is more powerful but heavier.
- **Dead-end policy.** People with no outgoing or incoming edges in your sources — drop them or keep as isolates? Keep them as isolates with a flag; their existence in the candidate list but absence from the edge set is itself data about historiographic visibility.
- **License and provenance.** Every edge needs a source citation field. Not optional. This is the difference between something a researcher can cite and something a researcher will not touch.

## 8. What to ship publicly, and where

- Code and data: GitHub repo, MIT license on the code, CC-BY on the derived edge data.
- The headline artifact: an Observable notebook with the radial visualization plus the search-a-name-get-a-path interaction. Observable is the right venue here because the audience overlap with your existing Religion x AI work is high.
- A short essay (~2000 words) framing the project for a DH / religious-studies audience. Pitch to *Cultural Analytics* or, less formally, to *The Revealer* (NYU) or *Marginalia Review of Books*. Aeon if you want a wider audience. The essay leads with the Annie-Besant-as-bridge example because it works as a hook and exemplifies the method.
- A weekend-built Streamlit demo as the technical proof of concept, kept separate from the publication-quality Observable artifact.

The cleanest version of this project is small, opinionated, well-sourced, and visually distinctive. Resist the temptation to make it comprehensive before it is interesting.
