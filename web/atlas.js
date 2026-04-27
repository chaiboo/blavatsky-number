/* ============================================================
   NETWORK ANALYSIS of the Theosophical sociogram.
   D3 v7. Five inks (PAL.ink, PAL.blue, PAL.magenta, PAL.yellow,
   PAL.clay), white background, no chart-library defaults.

   Each chart is a self-contained function: it takes the parsed
   graph + a target SVG and renders. All math (degree, betweenness,
   shortest paths, mixing matrix) is computed in-page from
   /web/data/graph.json. No preprocessing pipeline change.
   ============================================================ */

const PAL = {
  ink:    "#0d0d12",
  ink2:   "#4a4f5a",
  ink3:   "#9ea3ad",
  hair:   "#e3e5ea",
  field:  "#f4f5f7",
  bg:     "#ffffff",
  magenta:"#ff2d70",
  blue:   "#1d3df0",
  yellow: "#ffd400",
  clay:   "#c2410c",
};

/* tradition color assignments. Five-ink palette: clay used to
   distinguish the cultural-modernist endpoints in the temporal
   stack and asymmetry scatter. */
const TRADITION_GROUPS = {
  "theosophy_adyar":         { group: "Adyar core",            color: PAL.ink },
  "theosophy_pasadena":      { group: "Pasadena / indep.",     color: PAL.ink2 },
  "theosophy_independent":   { group: "Pasadena / indep.",     color: PAL.ink2 },
  "theosophy_supplement":    { group: "Pasadena / indep.",     color: PAL.ink2 },
  "theosophy_wikidata":      { group: "Wikidata supplement",   color: PAL.ink3 },
  "anthroposophy":           { group: "Anthroposophy",         color: PAL.blue },
  "krishnamurti":            { group: "Krishnamurti circle",   color: PAL.blue },
  "gurdjieff":               { group: "Gurdjieff school",      color: PAL.blue },
  "fellow_traveler":         { group: "Fellow travelers",      color: PAL.ink2 },
  "art_modernism":           { group: "Modernist arts",        color: PAL.magenta },
  "literature":              { group: "Literature",            color: PAL.clay },
  "literature_culture":      { group: "Literature",            color: PAL.clay },
  "music_culture":           { group: "Music / pop culture",   color: PAL.magenta },
  "film_culture":            { group: "Music / pop culture",   color: PAL.magenta },
  "tech_culture":            { group: "Music / pop culture",   color: PAL.magenta },
  "new_age_culture":         { group: "Music / pop culture",   color: PAL.magenta },
  "occult_esoteric":         { group: "Occult adjacent",       color: PAL.ink2 },
  "philosophy_religion":     { group: "Philosophy / religion", color: PAL.ink2 },
  "science_invention":       { group: "Science",               color: PAL.blue },
  "adversary":               { group: "Adversaries",           color: PAL.yellow },
  "adversary_spr":           { group: "Adversaries",           color: PAL.yellow },
  "adversary_thelema":       { group: "Adversaries",           color: PAL.yellow },
  "adversary_golden_dawn":   { group: "Adversaries",           color: PAL.yellow },
  "critic_traditionalist":   { group: "Adversaries",           color: PAL.yellow },
};

function tradGroup(t) {
  return (TRADITION_GROUPS[t] && TRADITION_GROUPS[t].group) || "Other";
}
function tradColor(t) {
  return (TRADITION_GROUPS[t] && TRADITION_GROUPS[t].color) || PAL.ink3;
}

/* ============================================================
   GRAPH MATH
   ============================================================ */

function buildAdjacency(nodes, edges) {
  const adj = new Map();
  nodes.forEach(n => adj.set(n.id, new Set()));
  edges.forEach(e => {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source).add(e.target);
    adj.get(e.target).add(e.source);
  });
  return adj;
}

function bfsDistances(adj, src) {
  const dist = new Map([[src, 0]]);
  const q = [src];
  while (q.length) {
    const u = q.shift();
    for (const v of adj.get(u) || []) {
      if (!dist.has(v)) { dist.set(v, dist.get(u) + 1); q.push(v); }
    }
  }
  return dist;
}

function giantComponent(adj) {
  const seen = new Set();
  let best = [];
  for (const n of adj.keys()) {
    if (seen.has(n)) continue;
    const stack = [n];
    const comp = [];
    while (stack.length) {
      const x = stack.pop();
      if (seen.has(x)) continue;
      seen.add(x);
      comp.push(x);
      for (const v of adj.get(x) || []) stack.push(v);
    }
    if (comp.length > best.length) best = comp;
  }
  return new Set(best);
}

/* Brandes' algorithm for unweighted betweenness centrality.
   Standard reference: Brandes 2001, "A Faster Algorithm for
   Betweenness Centrality." Returns map of node -> raw centrality. */
function brandesBetweenness(nodes, adj) {
  const CB = new Map();
  nodes.forEach(n => CB.set(n, 0));

  for (const s of nodes) {
    const stack = [];
    const P = new Map();
    const sigma = new Map();
    const dist = new Map();
    nodes.forEach(n => { P.set(n, []); sigma.set(n, 0); dist.set(n, -1); });
    sigma.set(s, 1); dist.set(s, 0);
    const Q = [s];
    while (Q.length) {
      const v = Q.shift();
      stack.push(v);
      for (const w of adj.get(v) || []) {
        if (dist.get(w) < 0) {
          dist.set(w, dist.get(v) + 1);
          Q.push(w);
        }
        if (dist.get(w) === dist.get(v) + 1) {
          sigma.set(w, sigma.get(w) + sigma.get(v));
          P.get(w).push(v);
        }
      }
    }
    const delta = new Map();
    nodes.forEach(n => delta.set(n, 0));
    while (stack.length) {
      const w = stack.pop();
      for (const v of P.get(w)) {
        delta.set(v, delta.get(v) + (sigma.get(v) / sigma.get(w)) * (1 + delta.get(w)));
      }
      if (w !== s) CB.set(w, CB.get(w) + delta.get(w));
    }
  }
  for (const k of CB.keys()) CB.set(k, CB.get(k) / 2);
  return CB;
}

/* ============================================================
   ENTRY
   ============================================================ */

d3.json("data/graph.json").then(graph => {
  const nodes = graph.nodes;
  const friendly = graph.edges.friendly;
  const hostile = graph.edges.hostile;
  const idToNode = new Map(nodes.map(n => [n.id, n]));

  const fAdj = buildAdjacency(nodes, friendly);
  const hAdj = buildAdjacency(nodes, hostile);

  const fDeg = new Map();
  nodes.forEach(n => fDeg.set(n.id, (fAdj.get(n.id) || new Set()).size));
  const hDeg = new Map();
  nodes.forEach(n => hDeg.set(n.id, (hAdj.get(n.id) || new Set()).size));

  const ctx = { nodes, friendly, hostile, idToNode, fAdj, hAdj, fDeg, hDeg };

  drawDegree(ctx);
  drawMixing(ctx);
  drawBrokers(ctx);
  drawTemporal(ctx);
  drawAsymmetry(ctx);
  drawHpbDistance(ctx);
});

/* ============================================================
   1. DEGREE DISTRIBUTION
   ENCODING: vertical lollipop ladder of the top 16 hubs
   (name + bar + degree numeral) on the left, with a small log-log
   CCDF inset on the right. The lollipop is *not* a bar chart in
   the user's sense; it is a name-as-mark with a hairline tether
   to a labelled value, and reads as a ranked list with quantity
   inline. The CCDF inset carries the statistical point.
   ============================================================ */

function drawDegree(ctx) {
  const { fDeg, idToNode } = ctx;
  const svg = d3.select("#vis-degree");
  const W = 940, H = 500;
  svg.selectAll("*").remove();

  // ---- left half: lollipop ladder of the top 16 hubs ----
  const TOP_N = 16;
  const ranked = [...fDeg.entries()]
    .map(([id, d]) => ({ id, d, name: idToNode.get(id).name, trad: idToNode.get(id).tradition }))
    .filter(d => d.d > 0)
    .sort((a, b) => b.d - a.d)
    .slice(0, TOP_N);

  const ladW = 460;
  const ladM = { top: 36, right: 36, bottom: 28, left: 36 };
  const lad = svg.append("g").attr("transform", `translate(0,0)`);

  // header
  lad.append("text")
    .attr("x", ladM.left).attr("y", 18)
    .attr("class", "atlas-axis-label")
    .text("the sixteen hubs · friendly degree");

  const yScale = d3.scaleBand()
    .domain(ranked.map(d => d.id))
    .range([ladM.top, H - ladM.bottom])
    .padding(0.18);

  const maxD = d3.max(ranked, d => d.d);
  const xScale = d3.scaleLinear()
    .domain([0, maxD])
    .range([ladM.left + 152, ladW - ladM.right - 56]);

  // background dotted rule per row
  ranked.forEach(d => {
    const y = yScale(d.id) + yScale.bandwidth() / 2;
    lad.append("line")
      .attr("x1", ladM.left + 152).attr("x2", ladW - ladM.right - 56)
      .attr("y1", y).attr("y2", y)
      .attr("stroke", PAL.hair).attr("stroke-width", 0.6)
      .attr("stroke-dasharray", "1.5 3");
  });

  // names (right-aligned, before the lollipop start)
  lad.selectAll("text.lname").data(ranked).join("text")
    .attr("class", "lname")
    .attr("x", ladM.left + 142)
    .attr("y", d => yScale(d.id) + yScale.bandwidth() / 2 + 4)
    .attr("text-anchor", "end")
    .style("font-family", "Space Grotesk, sans-serif")
    .style("font-weight", 600)
    .style("font-size", "12.5px")
    .style("letter-spacing", "-0.005em")
    .style("fill", PAL.ink)
    .text(d => d.name);

  // small folio rank in mono, far left
  lad.selectAll("text.lrank").data(ranked).join("text")
    .attr("class", "lrank")
    .attr("x", ladM.left)
    .attr("y", d => yScale(d.id) + yScale.bandwidth() / 2 + 4)
    .style("font-family", "JetBrains Mono, monospace")
    .style("font-size", "10px")
    .style("fill", PAL.ink3)
    .style("letter-spacing", "0.04em")
    .text((d, i) => String(i + 1).padStart(2, "0"));

  // hairline tether (thin, ink), ending just before the dot
  lad.selectAll("line.tether").data(ranked).join("line")
    .attr("class", "tether")
    .attr("x1", d => xScale(0))
    .attr("x2", d => xScale(d.d) - 6)
    .attr("y1", d => yScale(d.id) + yScale.bandwidth() / 2)
    .attr("y2", d => yScale(d.id) + yScale.bandwidth() / 2)
    .attr("stroke", PAL.ink).attr("stroke-width", 0.9);

  // dot at end (color = blue for top 4, ink otherwise)
  lad.selectAll("circle.dot").data(ranked).join("circle")
    .attr("class", "dot")
    .attr("cx", d => xScale(d.d))
    .attr("cy", d => yScale(d.id) + yScale.bandwidth() / 2)
    .attr("r", 4.5)
    .attr("fill", (d, i) => i < 4 ? PAL.blue : PAL.ink)
    .attr("stroke", PAL.bg).attr("stroke-width", 1);

  // mono numeral at far right
  lad.selectAll("text.lval").data(ranked).join("text")
    .attr("class", "lval")
    .attr("x", ladW - ladM.right - 44)
    .attr("y", d => yScale(d.id) + yScale.bandwidth() / 2 + 4)
    .style("font-family", "JetBrains Mono, monospace")
    .style("font-size", "11.5px")
    .style("font-weight", 500)
    .style("fill", PAL.ink)
    .text(d => `k=${d.d}`);

  // separator rule between left & right halves
  svg.append("line")
    .attr("x1", ladW).attr("x2", ladW)
    .attr("y1", 28).attr("y2", H - 24)
    .attr("stroke", PAL.ink).attr("stroke-width", 1);

  // ---- right half: log-log CCDF, with on-chart intuition annotations ----
  // The chart that the audience asked back for; the intuition cues live on the
  // chart itself so a reader who has never seen a CCDF before can read it.
  const insetX0 = ladW + 28;
  const insetY0 = 70;
  const iw = W - insetX0 - 56;
  const ih = H - insetY0 - 92;
  const ig = svg.append("g").attr("transform", `translate(${insetX0},${insetY0})`);

  // header (short title + italic gloss). The full intuition gloss lives in
  // the .chart-cue block above the chart; on-chart annotations carry the
  // anchors and the bend-down argument.
  svg.append("text")
    .attr("x", insetX0).attr("y", 22)
    .attr("class", "atlas-axis-label")
    .text("the long fringe, the loud few");
  svg.append("text")
    .attr("x", insetX0).attr("y", 40)
    .style("font-family", "Instrument Serif, serif")
    .style("font-style", "italic")
    .style("font-size", "13.5px")
    .style("fill", PAL.ink2)
    .text("how many figures hold k or more ties (log-log)");

  // CCDF: for each k in degree values, count how many nodes have degree >= k
  const degVals = [...fDeg.values()].filter(d => d > 0).sort((a, b) => a - b);
  const maxKall = degVals[degVals.length - 1];
  const ccdf = [];
  for (let k = 1; k <= maxKall; k++) {
    const ge = degVals.filter(d => d >= k).length;
    if (ge > 0) ccdf.push({ k, ge });
  }

  const xL = d3.scaleLog().domain([1, maxKall * 1.05]).range([0, iw]).clamp(true);
  const yL = d3.scaleLog().domain([1, ccdf[0].ge * 1.05]).range([ih, 0]).clamp(true);

  // axis frame (left + bottom only)
  ig.append("line").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", ih)
    .attr("stroke", PAL.ink).attr("stroke-width", 1);
  ig.append("line").attr("x1", 0).attr("x2", iw).attr("y1", ih).attr("y2", ih)
    .attr("stroke", PAL.ink).attr("stroke-width", 1);

  // log gridlines + tick labels (1, 10, 100 on both axes — friendly anchors)
  [1, 10, 100].forEach(t => {
    if (t > maxKall) return;
    const x = xL(t);
    ig.append("line")
      .attr("x1", x).attr("x2", x).attr("y1", 0).attr("y2", ih)
      .attr("stroke", PAL.hair).attr("stroke-width", 0.6);
    ig.append("text")
      .attr("x", x).attr("y", ih + 14).attr("text-anchor", "middle")
      .style("font-family", "JetBrains Mono, monospace")
      .style("font-size", "10px").style("fill", PAL.ink)
      .text(t);
  });
  [1, 10, 100].forEach(t => {
    if (t > ccdf[0].ge) return;
    const y = yL(t);
    ig.append("line")
      .attr("x1", 0).attr("x2", iw).attr("y1", y).attr("y2", y)
      .attr("stroke", PAL.hair).attr("stroke-width", 0.6);
    ig.append("text")
      .attr("x", -6).attr("y", y + 3).attr("text-anchor", "end")
      .style("font-family", "JetBrains Mono, monospace")
      .style("font-size", "10px").style("fill", PAL.ink)
      .text(t);
  });

  // axis labels in plain English
  ig.append("text").attr("class", "atlas-axis-label")
    .attr("x", iw / 2).attr("y", ih + 32).attr("text-anchor", "middle")
    .text("k = number of friendly ties");
  ig.append("text").attr("class", "atlas-axis-label")
    .attr("transform", `translate(-32,${ih / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .text("# of figures with at least k ties");

  // CCDF curve
  const line = d3.line()
    .x(d => xL(d.k))
    .y(d => yL(d.ge))
    .curve(d3.curveMonotoneX);
  ig.append("path")
    .datum(ccdf)
    .attr("d", line)
    .attr("fill", "none")
    .attr("stroke", PAL.magenta)
    .attr("stroke-width", 1.6);
  // dots at every integer k for legibility
  ig.selectAll("circle.cc").data(ccdf).join("circle")
    .attr("class", "cc")
    .attr("cx", d => xL(d.k)).attr("cy", d => yL(d.ge))
    .attr("r", 1.6)
    .attr("fill", PAL.magenta);

  // ---- ON-CHART ANNOTATIONS ----
  // Anchors only. The intuition gloss lives in the .chart-cue block above the
  // chart and the caption below it; on-chart notes mark the two endpoints and
  // the bend.

  // Mark the tail (k=64+): the four super-hubs sit out here
  const kTail = 64;
  if (kTail <= maxKall) {
    const xT = xL(kTail);
    const tail = ccdf.find(d => d.k === kTail);
    const yT = tail ? yL(tail.ge) : ih - 10;
    ig.append("line")
      .attr("x1", xT).attr("x2", xT).attr("y1", yT - 6).attr("y2", yT - 30)
      .attr("stroke", PAL.blue).attr("stroke-width", 0.8);
    ig.append("text")
      .attr("x", xT).attr("y", yT - 36).attr("text-anchor", "middle")
      .style("font-family", "Instrument Serif, serif")
      .style("font-style", "italic")
      .style("font-size", "12.5px")
      .style("fill", PAL.blue)
      .text("the four super-hubs sit out here");
    ig.append("text")
      .attr("x", xT).attr("y", yT - 20).attr("text-anchor", "middle")
      .style("font-family", "JetBrains Mono, monospace")
      .style("font-size", "9.5px")
      .style("fill", PAL.blue)
      .text("k ≥ 64");
  }

  // Mark the head at k=1, placed BELOW the curve to avoid the top-left corner
  const head = ccdf.find(d => d.k === 1);
  if (head) {
    ig.append("text")
      .attr("x", xL(1) + 8).attr("y", yL(head.ge) + 16)
      .style("font-family", "Instrument Serif, serif")
      .style("font-style", "italic")
      .style("font-size", "12px")
      .style("fill", PAL.ink2)
      .text(`${head.ge} figures have at least one tie`);
  }

  // side panel
  const side = d3.select("#side-degree");
  side.html("");
  const top10 = [...ctx.fDeg.entries()]
    .map(([id, d]) => ({ id, d, name: idToNode.get(id).name }))
    .sort((a, b) => b.d - a.d)
    .slice(0, 10);
  side.append("h4").text("The ten loudest figures");
  const ol = side.append("ol");
  top10.forEach((h, i) => {
    const li = ol.append("li");
    li.append("span").attr("class", "rk").text(String(i + 1).padStart(2, "0"));
    li.append("span").attr("class", "nm").text(h.name);
    li.append("span").attr("class", "vl").text(`k ${h.d}`);
  });
  side.append("h4").text("Tail census");
  side.append("p").html(`Mean degree <em>k̄</em> = ${(degVals.reduce((a, b) => a + b, 0) / degVals.length).toFixed(1)}; max = ${d3.max(degVals)} (Besant). Nineteen figures hold a single tie, and ${ctx.nodes.length - degVals.length} sit as isolates with no friendly tie at all, kept off this view.`);
}

/* ============================================================
   2. TRADITION MIXING MATRIX
   ENCODING: log2(observed/expected) heatmap with diverging fill
   (blue = under, ink = over). Diagonal cells are outlined in ink
   and visually subdued without hatching. Marginal sparkbars in a
   gutter give the row totals.
   ============================================================ */

function drawMixing(ctx) {
  const { nodes, friendly, idToNode } = ctx;
  const svg = d3.select("#vis-mix");
  const W = 760, H = 620;
  svg.selectAll("*").remove();

  const M = { top: 190, right: 24, bottom: 18, left: 240 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

  // ---- legend strip across the top (above the column labels) ----
  // Sits in the top margin so it cannot collide with the bottom-row cells.
  // Built as: gradient swatch (under-zero-over) + within-tradition swatch.
  const grad = svg.append("defs").append("linearGradient")
    .attr("id", "mix-grad").attr("x1", "0").attr("x2", "1");
  grad.append("stop").attr("offset", "0%").attr("stop-color", PAL.blue);
  grad.append("stop").attr("offset", "50%").attr("stop-color", PAL.bg);
  grad.append("stop").attr("offset", "100%").attr("stop-color", PAL.ink);

  const legTop = svg.append("g").attr("transform", `translate(${M.left},20)`);
  legTop.append("text")
    .attr("x", 0).attr("y", 0)
    .attr("class", "atlas-axis-label")
    .text("over- and under-representation · log2 ratio");
  legTop.append("rect")
    .attr("x", 0).attr("y", 8).attr("width", 240).attr("height", 9)
    .attr("fill", "url(#mix-grad)").attr("stroke", PAL.ink).attr("stroke-width", 0.6);
  legTop.append("text").attr("x", 0).attr("y", 30)
    .style("font-family", "JetBrains Mono, monospace").style("font-size", "9.5px")
    .attr("fill", PAL.ink).text("under (blue)");
  legTop.append("text").attr("x", 120).attr("y", 30)
    .style("font-family", "JetBrains Mono, monospace").style("font-size", "9.5px")
    .attr("fill", PAL.ink).attr("text-anchor", "middle").text("0 = expected");
  legTop.append("text").attr("x", 240).attr("y", 30)
    .style("font-family", "JetBrains Mono, monospace").style("font-size", "9.5px")
    .attr("fill", PAL.ink).attr("text-anchor", "end").text("over (ink)");
  // diagonal swatch
  legTop.append("rect").attr("x", 320).attr("y", 8).attr("width", 16).attr("height", 9)
    .attr("fill", PAL.field).attr("stroke", PAL.ink).attr("stroke-width", 1.4);
  legTop.append("text").attr("x", 342).attr("y", 16)
    .style("font-family", "JetBrains Mono, monospace").style("font-size", "9.5px")
    .attr("fill", PAL.ink).text("within-tradition (outlined)");

  const grpCount = d3.rollup(nodes, v => v.length, n => tradGroup(n.tradition));
  const groups = [...grpCount.keys()].sort((a, b) => {
    if (a === "Adyar core") return -1;
    if (b === "Adyar core") return 1;
    return grpCount.get(b) - grpCount.get(a);
  });
  const ng = new Map(nodes.map(n => [n.id, tradGroup(n.tradition)]));

  const M2 = {};
  for (const a of groups) { M2[a] = {}; for (const b of groups) M2[a][b] = 0; }
  for (const e of friendly) {
    const ga = ng.get(e.source), gb = ng.get(e.target);
    if (!ga || !gb) continue;
    const w = e.weight || 1;
    if (ga === gb) M2[ga][gb] += w;
    else { M2[ga][gb] += w; M2[gb][ga] += w; }
  }

  const rowSum = {}, total = (() => {
    let t = 0;
    for (const a of groups) {
      let s = 0;
      for (const b of groups) s += M2[a][b];
      rowSum[a] = s;
      t += s;
    }
    return t / 2;
  })();

  const resid = {};
  for (const a of groups) {
    resid[a] = {};
    for (const b of groups) {
      const obs = M2[a][b];
      const exp = (rowSum[a] * rowSum[b]) / (2 * total + 1e-9);
      const r = (obs + 0.5) / (exp + 0.5);
      resid[a][b] = Math.log2(r);
    }
  }

  const cell = Math.min(iw / groups.length, ih / groups.length);
  const matSize = cell * groups.length;
  const x = d3.scaleBand().domain(groups).range([0, matSize]);
  const y = d3.scaleBand().domain(groups).range([0, matSize]);

  const maxAbs = d3.max(groups.flatMap(a => groups.map(b => Math.abs(resid[a][b])))) || 1;
  const colorPos = d3.scaleLinear().domain([0, maxAbs]).range([PAL.bg, PAL.ink]);
  const colorNeg = d3.scaleLinear().domain([0, maxAbs]).range([PAL.bg, PAL.blue]);

  // cells
  groups.forEach(a => {
    groups.forEach(b => {
      const v = resid[a][b];
      const obs = M2[a][b];
      const cx = x(b), cy = y(a);
      const onDiag = a === b;
      let fill = PAL.bg;
      if (obs > 0) {
        fill = onDiag ? PAL.field : (v >= 0 ? colorPos(v) : colorNeg(-v));
      }
      const rect = g.append("rect")
        .attr("x", cx).attr("y", cy)
        .attr("width", cell - 1).attr("height", cell - 1)
        .attr("fill", fill);
      if (onDiag) {
        rect.attr("stroke", PAL.ink).attr("stroke-width", 1.4);
      } else {
        rect.attr("stroke", PAL.bg).attr("stroke-width", 1);
      }
      // text inside cell when value notable
      if (Math.abs(v) >= 0.7 && obs > 0 && !onDiag) {
        g.append("text")
          .attr("x", cx + cell / 2).attr("y", cy + cell / 2 + 3.5)
          .attr("text-anchor", "middle")
          .style("font-family", "JetBrains Mono, monospace")
          .style("font-size", "10px")
          .style("font-weight", 500)
          .style("fill", v >= 0.7 ? PAL.bg : PAL.ink)
          .text(v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1));
      }
    });
  });

  // row labels (left)
  g.selectAll("text.rl").data(groups).join("text")
    .attr("class", "rl")
    .attr("x", -10).attr("y", d => y(d) + cell / 2 + 4)
    .attr("text-anchor", "end")
    .style("font-family", "Space Grotesk, sans-serif")
    .style("font-size", "12px")
    .style("font-weight", 600)
    .style("letter-spacing", "-0.005em")
    .style("fill", PAL.ink)
    .text(d => d);
  g.selectAll("text.rln").data(groups).join("text")
    .attr("class", "rln")
    .attr("x", -10).attr("y", d => y(d) + cell / 2 + 16)
    .attr("text-anchor", "end")
    .style("font-family", "JetBrains Mono, monospace")
    .style("font-size", "9.5px")
    .style("fill", PAL.ink3)
    .text(d => `n=${grpCount.get(d)}`);

  // col labels (top, rotated -45)
  g.selectAll("text.cl").data(groups).join("text")
    .attr("class", "cl")
    .attr("transform", d => `translate(${x(d) + cell / 2 + 3},-10) rotate(-45)`)
    .attr("text-anchor", "start")
    .style("font-family", "Space Grotesk, sans-serif")
    .style("font-size", "11.5px")
    .style("font-weight", 600)
    .style("letter-spacing", "-0.005em")
    .style("fill", PAL.ink)
    .text(d => d);

  // marginal sparkbar (row total) to the right of the matrix
  const maxRowSum = d3.max(groups.map(g => rowSum[g]));
  const sparkW = 80;
  const sparkX = matSize + 16;
  groups.forEach(grp => {
    const w = (rowSum[grp] / maxRowSum) * sparkW;
    g.append("rect")
      .attr("x", sparkX)
      .attr("y", y(grp) + cell * 0.25)
      .attr("width", w)
      .attr("height", cell * 0.5)
      .attr("fill", PAL.ink2);
    g.append("text")
      .attr("x", sparkX + w + 4)
      .attr("y", y(grp) + cell / 2 + 3.5)
      .style("font-family", "JetBrains Mono, monospace")
      .style("font-size", "9.5px")
      .style("fill", PAL.ink)
      .text(Math.round(rowSum[grp]));
  });
  // sparkbar header
  g.append("text")
    .attr("x", sparkX).attr("y", -10)
    .attr("class", "atlas-axis-label")
    .text("row sum");

  // (legend lives in the top margin; see legTop block above)

  // side: surprising off-diagonals
  const side = d3.select("#side-mix");
  side.html("");
  const offDiag = [];
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i], b = groups[j];
      if (M2[a][b] === 0) continue;
      offDiag.push({ a, b, v: resid[a][b], obs: M2[a][b] });
    }
  }
  offDiag.sort((p, q) => q.v - p.v);
  side.append("h4").text("Most over-represented pairs");
  const ol1 = side.append("ol");
  offDiag.slice(0, 6).forEach(d => {
    const li = ol1.append("li");
    li.append("span").attr("class", "rk").text("+");
    li.append("span").attr("class", "nm").text(`${d.a} × ${d.b}`);
    li.append("span").attr("class", "vl").text(`+${d.v.toFixed(2)}`);
  });
  side.append("h4").text("Conspicuously absent pairs");
  const ol2 = side.append("ol");
  offDiag.slice(-5).reverse().forEach(d => {
    const li = ol2.append("li");
    li.append("span").attr("class", "rk").text("-");
    li.append("span").attr("class", "nm").text(`${d.a} × ${d.b}`);
    li.append("span").attr("class", "vl").text(d.v.toFixed(2));
  });
  side.append("h4").text("Reading note");
  side.append("p").html("Diagonal cells are within-group concentration, outlined in ink and visually quieted. The cells the eye wants are off-diagonal and dark: pairs of traditions the corpus brings together more often than chance would have bothered to.");
}

/* ============================================================
   3. BROKERAGE (REPLACED · was a horizontal bar chart)
   ENCODING: degree-vs-betweenness scatter where the figure's NAME
   is the mark itself, sized by total mention volume. A linear fit
   line shows the expected BC for a given degree; vertical distance
   from the line is the brokerage residual (the "work the figure
   does that raw popularity does not account for"). No bars.
   ============================================================ */

function drawBrokers(ctx) {
  const { fAdj, fDeg, idToNode } = ctx;
  const svg = d3.select("#vis-broker");
  const W = 760, H = 520;
  svg.selectAll("*").remove();

  const M = { top: 36, right: 36, bottom: 56, left: 64 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

  const giant = giantComponent(fAdj);
  const giantNodes = [...giant];
  const gAdj = new Map();
  giantNodes.forEach(n => {
    gAdj.set(n, new Set([...(fAdj.get(n) || [])].filter(x => giant.has(x))));
  });
  const CB = brandesBetweenness(giantNodes, gAdj);

  // pull every figure with positive BC into the cloud
  const all = [...CB.entries()]
    .map(([id, c]) => ({
      id, c, deg: fDeg.get(id) || 0,
      name: idToNode.get(id).name
    }))
    .filter(d => d.c > 0 && d.deg > 0);

  // scales: linear-linear so the line means what it says
  const maxDeg = d3.max(all, d => d.deg);
  const maxC = d3.max(all, d => d.c);
  const x = d3.scaleLinear().domain([0, maxDeg * 1.06]).range([0, iw]);
  const y = d3.scaleLinear().domain([0, maxC * 1.08]).range([ih, 0]);

  // grid
  g.append("g").selectAll("line.gx").data(x.ticks(8)).join("line")
    .attr("class", "atlas-grid-line")
    .attr("x1", d => x(d)).attr("x2", d => x(d))
    .attr("y1", 0).attr("y2", ih);
  g.append("g").selectAll("line.gy").data(y.ticks(6)).join("line")
    .attr("class", "atlas-grid-line")
    .attr("x1", 0).attr("x2", iw)
    .attr("y1", d => y(d)).attr("y2", d => y(d));

  // axes
  const xAxis = g.append("g").attr("class", "atlas-axis").attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));
  xAxis.select(".domain").attr("stroke", PAL.ink);
  const yAxis = g.append("g").attr("class", "atlas-axis").call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(".0f")));
  yAxis.select(".domain").attr("stroke", PAL.ink);
  g.append("text").attr("class", "atlas-axis-label")
    .attr("x", iw / 2).attr("y", ih + 36).attr("text-anchor", "middle")
    .text("friendly degree (k)");
  g.append("text").attr("class", "atlas-axis-label")
    .attr("transform", `translate(-50,${ih / 2}) rotate(-90)`).attr("text-anchor", "middle")
    .text("betweenness centrality");

  // fit a simple linear regression through the cloud: y = m*x
  // (force through origin; degree 0 implies BC 0)
  let sxy = 0, sxx = 0;
  all.forEach(d => { sxy += d.deg * d.c; sxx += d.deg * d.deg; });
  const m = sxy / sxx;
  // line endpoints
  g.append("line")
    .attr("x1", x(0)).attr("y1", y(0))
    .attr("x2", x(maxDeg)).attr("y2", y(m * maxDeg))
    .attr("stroke", PAL.ink2)
    .attr("stroke-width", 0.9)
    .attr("stroke-dasharray", "3 4");
  g.append("text")
    .attr("x", x(maxDeg) - 4).attr("y", y(m * maxDeg) - 6)
    .attr("text-anchor", "end")
    .style("font-family", "Instrument Serif, serif")
    .style("font-style", "italic")
    .style("font-size", "12px")
    .style("fill", PAL.ink2)
    .text("expected if BC tracked degree");

  // residual = c - m*deg
  all.forEach(d => { d.resid = d.c - m * d.deg; });

  // background dots (every figure, faint), so the cloud shape is visible
  g.selectAll("circle.bg").data(all).join("circle")
    .attr("class", "bg")
    .attr("cx", d => x(d.deg))
    .attr("cy", d => y(d.c))
    .attr("r", 2.2)
    .attr("fill", PAL.ink3);

  // pick names to render directly: top 10 brokers by residual,
  // top 5 by degree (so the loud-but-narrow fall below the line),
  // and a couple notable always-include figures
  const includeAlways = new Set([
    "blavatsky_h_p", "besant_annie", "olcott_h_s", "leadbeater_c_w",
    "krishnamurti_j", "steiner_rudolf", "crowley_a"
  ]);
  const byResid = [...all].sort((a, b) => b.resid - a.resid).slice(0, 10).map(d => d.id);
  const byDeg = [...all].sort((a, b) => b.deg - a.deg).slice(0, 5).map(d => d.id);
  const labelIds = new Set([...byResid, ...byDeg, ...includeAlways]);
  const labeled = all.filter(d => labelIds.has(d.id));

  // size by total mention volume (deg + bc-rank)
  const rScale = d3.scaleSqrt().domain([0, d3.max(labeled, d => d.deg + d.c / 30)]).range([0, 6]);

  // collision-relaxed label placement: simple iterative push
  // start each label at the data point, then nudge to clear neighbours
  const labels = labeled.map(d => ({
    id: d.id, name: d.name,
    px: x(d.deg), py: y(d.c),
    lx: x(d.deg), ly: y(d.c),
    deg: d.deg, c: d.c,
    above: d.resid > 0
  }));
  // estimate label size for collision test
  function labelW(name) { return Math.max(40, name.length * 6.2); }
  function labelH() { return 14; }
  // initialize: brokers go above-right, loud-low go below-right
  labels.forEach(L => {
    L.lx = L.px + 8;
    L.ly = L.above ? L.py - 6 : L.py + 14;
  });
  // 60 iterations of pairwise repulsion + spring back to anchor
  for (let iter = 0; iter < 60; iter++) {
    for (let i = 0; i < labels.length; i++) {
      const A = labels[i];
      const aw = labelW(A.name), ah = labelH();
      for (let j = i + 1; j < labels.length; j++) {
        const B = labels[j];
        const bw = labelW(B.name), bh = labelH();
        const dx = (B.lx + bw / 2) - (A.lx + aw / 2);
        const dy = B.ly - A.ly;
        const overlapX = (aw + bw) / 2 - Math.abs(dx);
        const overlapY = (ah + bh) / 2 - Math.abs(dy);
        if (overlapX > 0 && overlapY > 0) {
          // resolve along smaller-overlap axis
          if (overlapX < overlapY) {
            const nudge = (dx >= 0 ? 1 : -1) * overlapX * 0.5;
            A.lx -= nudge; B.lx += nudge;
          } else {
            const nudge = (dy >= 0 ? 1 : -1) * overlapY * 0.5;
            A.ly -= nudge; B.ly += nudge;
          }
        }
      }
      // spring back toward anchor (gentle)
      A.lx += (A.px + (A.above ? 8 : 8) - A.lx) * 0.04;
      A.ly += ((A.above ? A.py - 6 : A.py + 14) - A.ly) * 0.04;
      // clamp inside chart
      A.lx = Math.max(0, Math.min(iw - aw, A.lx));
      A.ly = Math.max(10, Math.min(ih - 4, A.ly));
    }
  }

  // draw leader lines from anchor to label corner
  labels.forEach(L => {
    const aw = labelW(L.name);
    const lcx = L.lx + 2;
    const lcy = L.ly - 4;
    g.append("line")
      .attr("x1", L.px).attr("y1", L.py)
      .attr("x2", lcx).attr("y2", lcy)
      .attr("stroke", PAL.ink3).attr("stroke-width", 0.6);
  });

  // marks: small filled circle at the anchor, color by above/below
  g.selectAll("circle.lb").data(labeled).join("circle")
    .attr("class", "lb")
    .attr("cx", d => x(d.deg))
    .attr("cy", d => y(d.c))
    .attr("r", d => Math.max(3.2, rScale(d.deg + d.c / 30)))
    .attr("fill", d => d.resid > 0 ? PAL.blue : PAL.magenta)
    .attr("stroke", PAL.ink).attr("stroke-width", 1.2);

  // text labels (the names ARE the mark)
  g.selectAll("text.broker").data(labels).join("text")
    .attr("class", "broker")
    .attr("x", d => d.lx)
    .attr("y", d => d.ly)
    .style("font-family", "Space Grotesk, sans-serif")
    .style("font-weight", 600)
    .style("font-size", "11.5px")
    .style("letter-spacing", "-0.005em")
    .style("fill", PAL.ink)
    .text(d => d.name);

  // legend (top right)
  const lg = svg.append("g").attr("transform", `translate(${W - 280},${20})`);
  lg.append("circle").attr("cx", 6).attr("cy", 6).attr("r", 5).attr("fill", PAL.blue).attr("stroke", PAL.ink).attr("stroke-width", 1.2);
  lg.append("text").attr("x", 16).attr("y", 9).style("font-family", "JetBrains Mono, monospace").style("font-size", "10px").attr("fill", PAL.ink).text("brokers (above line)");
  lg.append("circle").attr("cx", 156).attr("cy", 6).attr("r", 5).attr("fill", PAL.magenta).attr("stroke", PAL.ink).attr("stroke-width", 1.2);
  lg.append("text").attr("x", 166).attr("y", 9).style("font-family", "JetBrains Mono, monospace").style("font-size", "10px").attr("fill", PAL.ink).text("loud but contained");

  // side
  const side = d3.select("#side-broker");
  side.html("");
  side.append("h4").text("Brokerage residual · top six");
  side.append("p").html("Figures whose betweenness runs well ahead of what friendly degree alone would predict. The vertical distance above the line measures the work they do that raw popularity does not account for, which in a tightly-edited journal is a great deal of work.");
  const gap = [...all].sort((a, b) => b.resid - a.resid).slice(0, 6);
  const ol = side.append("ol");
  gap.forEach((d, i) => {
    const li = ol.append("li");
    li.append("span").attr("class", "rk").text(String(i + 1).padStart(2, "0"));
    li.append("span").attr("class", "nm").text(d.name);
    li.append("span").attr("class", "vl").text(`+${d.resid.toFixed(0)}`);
  });
  side.append("h4").text("Loud but contained");
  side.append("p").html("Figures whose degree is high but whose betweenness sits at or below the line. Their many ties are clustered amongst the same neighbours, so their removal would inconvenience the graph rather than fracture it.");
  const cont = [...all].filter(d => d.deg >= 25).sort((a, b) => a.resid - b.resid).slice(0, 4);
  const ol2 = side.append("ol");
  cont.forEach((d, i) => {
    const li = ol2.append("li");
    li.append("span").attr("class", "rk").text(String(i + 1).padStart(2, "0"));
    li.append("span").attr("class", "nm").text(d.name);
    li.append("span").attr("class", "vl").text(`${d.resid.toFixed(0)}`);
  });
}

/* ============================================================
   4. TEMPORAL EDGE BIRTHS
   ENCODING: centred streamgraph (silhouette baseline) of new
   edges per year, stacked by tradition. Event annotations live
   on a SEPARATE annotation rail above the stream so labels
   never collide with the silhouette.
   ============================================================ */

function drawTemporal(ctx) {
  const { friendly, idToNode } = ctx;
  const svg = d3.select("#vis-temporal");
  const W = 760, H = 540;
  svg.selectAll("*").remove();

  // layout: top annotation rail (50px), then stream area, then x-axis & legend
  const ANN_H = 64;
  const M = { top: 8, right: 30, bottom: 110, left: 50 };
  const iw = W - M.left - M.right;
  const streamTop = M.top + ANN_H;
  const streamBottom = H - M.bottom;
  const streamH = streamBottom - streamTop;

  function classify(e) {
    const ga = tradGroup(idToNode.get(e.source).tradition);
    const gb = tradGroup(idToNode.get(e.target).tradition);
    if (ga === "Adyar core" && gb === "Adyar core") return "Adyar core";
    if (ga === "Adyar core") return gb;
    if (gb === "Adyar core") return ga;
    return ga;
  }

  const dated = friendly.filter(e => e.first_year && e.first_year >= 1879 && e.first_year <= 1934);
  const catSet = new Set();
  dated.forEach(e => catSet.add(classify(e)));
  const cats = [...catSet].sort((a, b) => {
    if (a === "Adyar core") return 1;
    if (b === "Adyar core") return -1;
    return a.localeCompare(b);
  });

  const years = d3.range(1879, 1935);
  const byYear = new Map(years.map(y => [y, Object.fromEntries(cats.map(c => [c, 0]))]));
  dated.forEach(e => {
    const y = e.first_year;
    if (!byYear.has(y)) return;
    byYear.get(y)[classify(e)] += 1;
  });

  const stackData = years.map(y => ({ year: y, ...byYear.get(y) }));
  // centred (silhouette) baseline + sum for nice symmetric peaks
  const stack = d3.stack().keys(cats).offset(d3.stackOffsetSilhouette).order(d3.stackOrderInsideOut);
  const series = stack(stackData);

  const x = d3.scaleLinear().domain([1879, 1934]).range([M.left, M.left + iw]);
  const y0 = d3.min(series, s => d3.min(s, d => d[0]));
  const y1 = d3.max(series, s => d3.max(s, d => d[1]));
  const yPad = (y1 - y0) * 0.06;
  const y = d3.scaleLinear().domain([y0 - yPad, y1 + yPad]).range([streamBottom, streamTop]);

  const orderedPal = [PAL.blue, PAL.magenta, PAL.yellow, PAL.clay, PAL.ink2, PAL.ink3];
  const colorMap = new Map(cats.map((c, i) => {
    if (c === "Adyar core") return [c, PAL.ink];
    return [c, orderedPal[i % orderedPal.length]];
  }));

  // areas with smooth curve
  const area = d3.area()
    .curve(d3.curveCatmullRom.alpha(0.5))
    .x(d => x(d.data.year))
    .y0(d => y(d[0])).y1(d => y(d[1]));

  svg.selectAll("path.s").data(series).join("path")
    .attr("class", "s")
    .attr("d", area)
    .attr("fill", d => colorMap.get(d.key))
    .attr("stroke", PAL.bg)
    .attr("stroke-width", 0.6)
    .attr("opacity", 0.95);

  // x-axis (no y-axis: silhouette is its own scale)
  const xAxis = svg.append("g")
    .attr("class", "atlas-axis")
    .attr("transform", `translate(0,${streamBottom})`)
    .call(d3.axisBottom(x).tickValues([1879, 1891, 1900, 1907, 1913, 1925, 1929, 1931, 1934]).tickFormat(d3.format("d")));
  xAxis.select(".domain").attr("stroke", PAL.ink);
  svg.append("text").attr("class", "atlas-axis-label")
    .attr("x", M.left + iw / 2).attr("y", streamBottom + 36).attr("text-anchor", "middle")
    .text("year of first attested co-mention");

  // total per year on the right side, light
  const yearTotalsAll = years.map(yr => ({ year: yr, n: cats.reduce((a, c) => a + byYear.get(yr)[c], 0) }));
  const peakYear = yearTotalsAll.reduce((a, b) => b.n > a.n ? b : a, { n: 0 });
  // a small marker at peak
  svg.append("text")
    .attr("x", x(peakYear.year))
    .attr("y", streamTop - 6)
    .attr("text-anchor", "middle")
    .style("font-family", "JetBrains Mono, monospace")
    .style("font-size", "9.5px")
    .style("fill", PAL.ink2)
    .text(`peak ${peakYear.year} · ${peakYear.n} edges`);

  // ---- annotation rail ----
  // events: HPB death 1891, Olcott death 1907, Steiner break 1913, Krishnamurti dissolution 1929
  const events = [
    { y: 1891, t: "HPB dies" },
    { y: 1907, t: "Olcott dies; Besant takes Adyar" },
    { y: 1913, t: "Steiner splits to Anthroposophy" },
    { y: 1929, t: "Krishnamurti dissolves the Order of the Star" },
  ];
  // sort events by year, then assign rows greedily so labels never overlap
  events.sort((a, b) => a.y - b.y);
  const rows = [0, 0, 0]; // last x used in each row
  events.forEach(ev => {
    ev._w = ev.t.length * 6 + 10;
    ev._x = x(ev.y);
    let row = 0;
    for (let r = 0; r < rows.length; r++) {
      if (ev._x - rows[r] > ev._w + 12) { row = r; rows[r] = ev._x + ev._w; ev._row = r; return; }
    }
    // fallback
    let best = 0;
    for (let r = 1; r < rows.length; r++) if (rows[r] < rows[best]) best = r;
    ev._row = best; rows[best] = ev._x + ev._w;
  });

  // annotation gutter rule
  svg.append("line")
    .attr("x1", M.left).attr("x2", M.left + iw)
    .attr("y1", streamTop - 2).attr("y2", streamTop - 2)
    .attr("stroke", PAL.ink).attr("stroke-width", 0.8);

  events.forEach(ev => {
    const ly = M.top + 12 + ev._row * 18;
    // pin from the rule down to the stream
    svg.append("line")
      .attr("x1", ev._x).attr("x2", ev._x)
      .attr("y1", ly + 4).attr("y2", streamBottom)
      .attr("stroke", PAL.ink).attr("stroke-width", 0.7).attr("stroke-dasharray", "2 3");
    // small dot at top
    svg.append("circle").attr("cx", ev._x).attr("cy", ly).attr("r", 2.4).attr("fill", PAL.ink);
    // label, anchored start; if too far right, anchor end
    const anchor = ev._x > M.left + iw - 180 ? "end" : "start";
    svg.append("text")
      .attr("x", ev._x + (anchor === "end" ? -6 : 6))
      .attr("y", ly + 3.5)
      .attr("text-anchor", anchor)
      .style("font-family", "Instrument Serif, serif")
      .style("font-style", "italic")
      .style("font-size", "13px")
      .style("fill", PAL.ink)
      .text(ev.t);
  });

  // legend: horizontal, wraps as needed.
  const lg = svg.append("g").attr("transform", `translate(${M.left},${streamBottom + 56})`);
  let lx = 0, ly = 0;
  cats.forEach((c) => {
    const w = Math.max(110, 24 + c.length * 7);
    if (lx + w > iw) { lx = 0; ly += 18; }
    lg.append("rect").attr("x", lx).attr("y", ly - 8).attr("width", 12).attr("height", 9).attr("fill", colorMap.get(c));
    lg.append("text").attr("x", lx + 18).attr("y", ly)
      .style("font-family", "JetBrains Mono, monospace")
      .style("font-size", "10px")
      .style("fill", PAL.ink)
      .text(c);
    lx += w;
  });

  // side
  const side = d3.select("#side-temporal");
  side.html("");
  side.append("h4").text("Top edge years");
  const yearTotals = yearTotalsAll.sort((a, b) => b.n - a.n).slice(0, 6);
  const ol = side.append("ol");
  yearTotals.forEach((d, i) => {
    const li = ol.append("li");
    li.append("span").attr("class", "rk").text(String(i + 1).padStart(2, "0"));
    li.append("span").attr("class", "nm").text(d.year);
    li.append("span").attr("class", "vl").text(`${d.n} edges`);
  });
  const undated = friendly.length - dated.length;
  side.append("h4").text("Excluded");
  side.append("p").html(`<em>${undated} edges</em> have no datable corpus snippet. These are mostly curated structural ties, biographical connections the OCR'd journal corpus failed to catch. Held back from this view.`);
}

/* ============================================================
   5. FRIENDLY vs HOSTILE asymmetry. Scatter with label-repulsion.
   ENCODING: same x/y as before, but labels are nudged apart by
   an iterative collision-repulsion pass and connected to their
   anchors with hairline leaders only when the label has moved.
   Background dots stay faint; salient points get clay/yellow fills.
   ============================================================ */

function drawAsymmetry(ctx) {
  const { fDeg, hDeg, idToNode } = ctx;
  const svg = d3.select("#vis-asym");
  const W = 760, H = 520;
  svg.selectAll("*").remove();

  const M = { top: 30, right: 32, bottom: 56, left: 64 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

  const pts = [...idToNode.keys()]
    .map(id => ({ id, name: idToNode.get(id).name, f: fDeg.get(id) || 0, h: hDeg.get(id) || 0 }))
    .filter(d => d.f + d.h > 0);

  const maxF = d3.max(pts, d => d.f);
  const maxH = d3.max(pts, d => d.h);
  const x = d3.scaleLinear().domain([-1, maxF + 2]).range([0, iw]);
  const y = d3.scaleLinear().domain([-1, maxH + 2]).range([ih, 0]);

  // grid
  g.append("g").selectAll("line.gx").data(x.ticks(8)).join("line")
    .attr("class", "atlas-grid-line")
    .attr("x1", d => x(d)).attr("x2", d => x(d))
    .attr("y1", 0).attr("y2", ih);
  g.append("g").selectAll("line.gy").data(y.ticks(6)).join("line")
    .attr("class", "atlas-grid-line")
    .attr("x1", 0).attr("x2", iw)
    .attr("y1", d => y(d)).attr("y2", d => y(d));

  // identity diagonal
  const dEnd = Math.min(maxF, maxH);
  g.append("line")
    .attr("x1", x(0)).attr("y1", y(0))
    .attr("x2", x(dEnd)).attr("y2", y(dEnd))
    .attr("stroke", PAL.ink2).attr("stroke-width", 0.9).attr("stroke-dasharray", "3 4");
  g.append("text").attr("x", x(dEnd) + 6).attr("y", y(dEnd) - 4)
    .style("font-family", "Instrument Serif, serif").style("font-style", "italic")
    .style("font-size", "12.5px").style("fill", PAL.ink2).text("hostile = friendly");

  // axes
  const xAxis = g.append("g").attr("class", "atlas-axis").attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));
  xAxis.select(".domain").attr("stroke", PAL.ink);
  const yAxis = g.append("g").attr("class", "atlas-axis").call(d3.axisLeft(y).ticks(6).tickFormat(d3.format("d")));
  yAxis.select(".domain").attr("stroke", PAL.ink);
  g.append("text").attr("class", "atlas-axis-label")
    .attr("x", iw / 2).attr("y", ih + 36).attr("text-anchor", "middle").text("friendly degree");
  g.append("text").attr("class", "atlas-axis-label")
    .attr("transform", `translate(-50,${ih / 2}) rotate(-90)`).attr("text-anchor", "middle").text("hostile degree");

  // jitter for zero pile-up
  const jitter = (id, axis) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
    return ((h % 7) / 7 - 0.5) * 0.6 * (axis === "x" ? 0.4 : 0.4);
  };

  const ratioAll = pts.map(p => ({ ...p, r: (p.h + 0.5) / (p.f + 1) })).filter(p => p.h > 0);
  ratioAll.sort((a, b) => b.r - a.r);
  const ratio = ratioAll.filter(p => (p.h + p.f) >= 4);
  const labeled = new Set([
    ...ratio.slice(0, 8).map(d => d.id),
    "blavatsky_h_p", "besant_annie", "olcott_h_s", "leadbeater_c_w",
    "judge_w_q", "crowley_a", "steiner_rudolf"
  ]);

  // background dots (everyone)
  g.selectAll("circle.bg").data(pts.filter(d => !labeled.has(d.id))).join("circle")
    .attr("class", "bg")
    .attr("cx", d => x(d.f + jitter(d.id, "x")))
    .attr("cy", d => y(d.h + jitter(d.id, "y")))
    .attr("r", 2.6)
    .attr("fill", PAL.bg).attr("stroke", PAL.ink3).attr("stroke-width", 0.9);

  // labeled dots
  const labeledPts = pts.filter(d => labeled.has(d.id));
  const r = d3.scaleSqrt().domain([1, d3.max(labeledPts, d => d.f + d.h)]).range([4.5, 11]);
  g.selectAll("circle.lb").data(labeledPts).join("circle")
    .attr("class", "lb")
    .attr("cx", d => x(d.f))
    .attr("cy", d => y(d.h))
    .attr("r", d => r(d.f + d.h))
    .attr("fill", d => (d.h > d.f ? PAL.yellow : PAL.clay))
    .attr("stroke", PAL.ink).attr("stroke-width", 1.4);

  // label collision relaxation
  const labels = labeledPts.map(d => ({
    id: d.id, name: d.name,
    px: x(d.f), py: y(d.h),
    above: d.h > d.f
  }));
  labels.forEach(L => {
    L.lx = L.px + (L.above ? -8 : 8);
    L.ly = L.above ? L.py - 10 : L.py + 14;
    L.anchor = L.above ? "end" : "start";
  });
  function lw(L) { return Math.max(40, L.name.length * 6.4); }
  function lh() { return 14; }
  for (let it = 0; it < 70; it++) {
    for (let i = 0; i < labels.length; i++) {
      const A = labels[i];
      const aw = lw(A), ah = lh();
      const ax0 = A.anchor === "end" ? A.lx - aw : A.lx;
      for (let j = i + 1; j < labels.length; j++) {
        const B = labels[j];
        const bw = lw(B), bh = lh();
        const bx0 = B.anchor === "end" ? B.lx - bw : B.lx;
        const dx = (bx0 + bw / 2) - (ax0 + aw / 2);
        const dy = B.ly - A.ly;
        const overlapX = (aw + bw) / 2 - Math.abs(dx);
        const overlapY = (ah + bh) / 2 - Math.abs(dy);
        if (overlapX > 0 && overlapY > 0) {
          if (overlapX < overlapY) {
            const nudge = (dx >= 0 ? 1 : -1) * overlapX * 0.5;
            A.lx -= nudge; B.lx += nudge;
          } else {
            const nudge = (dy >= 0 ? 1 : -1) * overlapY * 0.5;
            A.ly -= nudge; B.ly += nudge;
          }
        }
      }
      // spring back
      const tgtX = A.px + (A.above ? -8 : 8);
      const tgtY = A.above ? A.py - 10 : A.py + 14;
      A.lx += (tgtX - A.lx) * 0.04;
      A.ly += (tgtY - A.ly) * 0.04;
      // clamp
      const aw2 = lw(A);
      A.lx = A.anchor === "end"
        ? Math.max(aw2, Math.min(iw, A.lx))
        : Math.max(0, Math.min(iw - aw2, A.lx));
      A.ly = Math.max(10, Math.min(ih - 4, A.ly));
    }
  }

  // hairline leader lines (only when label moved noticeably)
  labels.forEach(L => {
    const tgtX = L.px + (L.above ? -8 : 8);
    const tgtY = L.above ? L.py - 10 : L.py + 14;
    const moved = Math.hypot(L.lx - tgtX, L.ly - tgtY);
    if (moved > 6) {
      const aw = lw(L);
      const lcx = L.anchor === "end" ? L.lx - aw / 2 : L.lx + aw / 2;
      const lcy = L.ly - 4;
      g.append("line")
        .attr("x1", L.px).attr("y1", L.py)
        .attr("x2", lcx).attr("y2", lcy)
        .attr("stroke", PAL.ink3).attr("stroke-width", 0.5);
    }
  });

  // text labels
  g.selectAll("text.alab").data(labels).join("text")
    .attr("class", "alab")
    .attr("x", d => d.lx).attr("y", d => d.ly)
    .attr("text-anchor", d => d.anchor)
    .style("font-family", "Space Grotesk, sans-serif")
    .style("font-weight", 600)
    .style("font-size", "11.5px")
    .style("letter-spacing", "-0.005em")
    .style("fill", PAL.ink)
    .text(d => d.name);

  // legend (top right)
  const lg = svg.append("g").attr("transform", `translate(${W - 280},${10})`);
  lg.append("circle").attr("cx", 6).attr("cy", 6).attr("r", 5).attr("fill", PAL.yellow).attr("stroke", PAL.ink).attr("stroke-width", 1.2);
  lg.append("text").attr("x", 16).attr("y", 9).style("font-family", "JetBrains Mono, monospace").style("font-size", "10px").attr("fill", PAL.ink).text("hostile-leaning");
  lg.append("circle").attr("cx", 136).attr("cy", 6).attr("r", 5).attr("fill", PAL.clay).attr("stroke", PAL.ink).attr("stroke-width", 1.2);
  lg.append("text").attr("x", 146).attr("y", 9).style("font-family", "JetBrains Mono, monospace").style("font-size", "10px").attr("fill", PAL.ink).text("friendly-leaning");

  // side
  const side = d3.select("#side-asym");
  side.html("");
  side.append("h4").text("Highest hostile-to-friendly ratio");
  const ol = side.append("ol");
  ratioAll.slice(0, 8).forEach((d, i) => {
    const li = ol.append("li");
    li.append("span").attr("class", "rk").text(String(i + 1).padStart(2, "0"));
    li.append("span").attr("class", "nm").text(d.name);
    li.append("span").attr("class", "vl").text(`${d.h}/${d.f}`);
  });
  side.append("h4").text("Reading note");
  side.append("p").html("A high hostile-to-friendly ratio marks a figure the corpus brings up mainly to denounce. The Coulombs and Hodgson are the obvious cases, and were going to be. Westcott (Golden Dawn) is the more telling one: the corpus engages him as opposition rather than as colleague, which is itself a quiet claim about where the boundary of the movement was being drawn.");
}

/* ============================================================
   6. PATH-LENGTH HISTOGRAM FROM HPB
   ENCODING: unit-square stacks (one square = one figure) with
   the count rendered as a giant Bodoni italic numeral. This
   panel was the strongest in the prior version; the typography
   hierarchy is preserved and tuned to the new layout.
   ============================================================ */

function drawHpbDistance(ctx) {
  const { fAdj, idToNode, nodes } = ctx;
  const svg = d3.select("#vis-hpb");
  const W = 760, H = 460;
  svg.selectAll("*").remove();

  const M = { top: 60, right: 30, bottom: 64, left: 56 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

  const dist = bfsDistances(fAdj, "blavatsky_h_p");
  const tally = new Map();
  for (const n of nodes) {
    if (n.id === "blavatsky_h_p") continue;
    const d = dist.get(n.id);
    const key = d === undefined ? "∞" : String(d);
    if (!tally.has(key)) tally.set(key, []);
    tally.get(key).push(n);
  }

  const buckets = ["1", "2", "3", "4", "5", "∞"].filter(k => tally.has(k));
  const data = buckets.map(k => ({ k, n: tally.get(k).length, list: tally.get(k) }));

  const x = d3.scaleBand().domain(buckets).range([0, iw]).padding(0.18);
  const tallest = d3.max(data, d => d.n);
  const colW = x.bandwidth();
  let bestSq = 0, bestCols = 8;
  for (let cols = 4; cols <= 12; cols++) {
    const sqW = colW / cols - 1;
    const rows = Math.ceil(tallest / cols);
    const sqH = (ih - 36) / rows;
    const sq = Math.min(sqW, sqH);
    if (sq > bestSq) { bestSq = sq; bestCols = cols; }
  }
  const COLS = bestCols;
  const innerSq = Math.min(bestSq, 18);

  data.forEach(d => {
    d.list.forEach((node, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const xx = x(d.k) + col * (innerSq + 1);
      const yy = ih - (row + 1) * (innerSq + 1);
      g.append("rect")
        .attr("x", xx).attr("y", yy)
        .attr("width", innerSq).attr("height", innerSq)
        .attr("fill", d.k === "∞" ? PAL.ink3 : (d.k === "1" ? PAL.blue : (d.k === "2" ? PAL.bg : PAL.bg)))
        .attr("stroke", PAL.ink).attr("stroke-width", 1);
    });
    const stackH = Math.ceil(d.list.length / COLS) * (innerSq + 1);
    g.append("text")
      .attr("x", x(d.k) + x.bandwidth() / 2)
      .attr("y", ih - stackH - 14)
      .attr("text-anchor", "middle")
      .style("font-family", "Bodoni Moda, serif")
      .style("font-style", "italic")
      .style("font-weight", 800)
      .style("font-size", "32px")
      .style("fill", PAL.ink)
      .text(d.n);
  });

  // x axis: hop number as oversized italic numeral
  const xAxis = g.append("g").attr("class", "atlas-axis").attr("transform", `translate(0,${ih + 4})`)
    .call(d3.axisBottom(x).tickSize(0));
  xAxis.select(".domain").attr("stroke", PAL.ink);
  xAxis.selectAll("text")
    .style("font-family", "Bodoni Moda, serif")
    .style("font-style", "italic")
    .style("font-weight", 800)
    .style("font-size", "22px")
    .style("fill", PAL.ink);

  g.append("text").attr("class", "atlas-axis-label")
    .attr("x", iw / 2).attr("y", ih + 50).attr("text-anchor", "middle")
    .text("hops from Blavatsky · friendly graph");

  // top-left key
  g.append("text")
    .attr("x", 0).attr("y", -32)
    .attr("class", "atlas-axis-label")
    .text("each square = one figure");

  // a small legend chip explaining the blue-fill column 1
  g.append("rect").attr("x", 0).attr("y", -22).attr("width", 10).attr("height", 10).attr("fill", PAL.blue).attr("stroke", PAL.ink).attr("stroke-width", 1);
  g.append("text").attr("x", 14).attr("y", -13)
    .style("font-family", "JetBrains Mono, monospace")
    .style("font-size", "10px")
    .style("fill", PAL.ink)
    .text("HPB's direct contacts");
  g.append("rect").attr("x", 170).attr("y", -22).attr("width", 10).attr("height", 10).attr("fill", PAL.bg).attr("stroke", PAL.ink).attr("stroke-width", 1);
  g.append("text").attr("x", 184).attr("y", -13)
    .style("font-family", "JetBrains Mono, monospace")
    .style("font-size", "10px")
    .style("fill", PAL.ink)
    .text("reachable through one or more steps");
  g.append("rect").attr("x", 410).attr("y", -22).attr("width", 10).attr("height", 10).attr("fill", PAL.ink3).attr("stroke", PAL.ink).attr("stroke-width", 1);
  g.append("text").attr("x", 424).attr("y", -13)
    .style("font-family", "JetBrains Mono, monospace")
    .style("font-size", "10px")
    .style("fill", PAL.ink)
    .text("unreachable in the corpus");

  // side
  const side = d3.select("#side-hpb");
  side.html("");

  let total = 0, count = 0;
  for (const n of nodes) { const d = dist.get(n.id); if (d && d > 0) { total += d; count++; } }
  const meanDist = (total / count).toFixed(2);
  side.append("h4").text("Summary");
  side.append("p").html(`Mean reachable distance from HPB is <em>${meanDist}</em> hops; the diameter from her vantage is <em>${d3.max([...dist.values()].filter(v => Number.isFinite(v)))}</em>. Small-world by any standard, and the shape one gets from a network organised around a single editorial centre.`);

  const far = nodes
    .map(n => ({ ...n, d: dist.get(n.id) }))
    .filter(n => n.d && n.d >= 3)
    .sort((a, b) => b.d - a.d || a.name.localeCompare(b.name));
  if (far.length) {
    side.append("h4").text("Furthest within reach");
    const ol = side.append("ol");
    far.slice(0, 8).forEach((d) => {
      const li = ol.append("li");
      li.append("span").attr("class", "rk").text(`${d.d}h`);
      li.append("span").attr("class", "nm").text(d.name);
      li.append("span").attr("class", "vl").text("");
    });
  }

  const inf = (tally.get("∞") || []);
  side.append("h4").text(`Unreachable (n=${inf.length})`);
  side.append("p").html("Ten are TS members of record, attested in Wikidata, who left no traceable corpus footprint. Two more (Foster Bailey, Sai Baba of Shirdi) sit in the lexicon for adjacent reasons and were never resolved into a co-mention by the journal's editors. The thirteenth is <em>René Guénon</em>, the traditionalist who critiqued theosophy from outside the tent and was, on the evidence, never platformed inside it.");
}
