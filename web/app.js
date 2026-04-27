/* ===========================================================
   YOUR BLAVATSKY NUMBER, front-end controller.

   One screen, one verb (query), one number, one path.
   Risograph palette. D3 v7 only for the force sim.
   =========================================================== */

const MODE = { friendly: "friendly", hostile: "hostile" };

const state = {
  mode: MODE.friendly,
  center: "blavatsky_h_p",
  target: null,
  data: null,
};

// Palette echoes the CSS, used for SVG ink & chip swatches.
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
};

/* famous chips: curated, recognizable. Shuffled per session so the rail isn't
   always the same order. The .chips-rail scrolls (max-height: 26vh) so the
   giant numeral is never pushed off-screen no matter how many we throw in. */
const FAMOUS_CHIPS_POOL = [
  // Contemporary music
  "bowie_d", "page_j", "harrison_g", "lennon_j",
  "jay_z", "beyonce", "madonna", "del_rey_l",
  "nicks_s", "smith_p", "manson_m", "p_orridge_g",
  // Film, tech, writers, new age
  "lynch_d", "cruise_t", "brand_r", "jobs_s",
  "moore_a", "morrison_g", "wilson_r_a",
  "tolle_e", "ram_dass", "oprah", "hubbard_l_ron", "lavey_a",
  // Modernism and pre-WWII letters/arts
  "yeats_w_b", "edison_thomas", "kandinsky_w", "mondrian_piet",
  "scriabin_a", "af_klint_hilma", "huxley_aldous", "jung_c_g",
  "baum_l_frank", "conan_doyle_a", "joyce_james", "shaw_g_b",
  "eliot_t_s", "lawrence_d_h", "klee_paul",
  "pound_ezra", "maeterlinck_m", "russell_ae",
  // Philosophy and science
  "james_william", "bergson_henri", "buber_martin",
  "wallace_a_r", "crookes_william", "bohm_david",
  // Politics and Indian independence
  "gandhi_m", "nehru_j", "naidu_sarojini", "bradlaugh_charles",
  "pankhurst_emmeline", "tilak_b_g",
  // Adversaries / Golden Dawn / Crowley axis
  "crowley_a", "parsons_j", "mathers_s_l", "guenon_rene",
  "hodgson_richard", "westcott_william", "waite_a_e",
  // Adyar inner circle
  "olcott_h_s", "besant_annie", "krishnamurti_j", "steiner_rudolf",
  "fortune_dion", "leadbeater_c_w", "judge_w_q", "sinnett_a_p",
  "bailey_alice", "mead_g_r_s", "tingley_katherine", "collins_mabel",
  "arundale_rukmini", "hall_manly_p", "levi_eliphas",
  // Roerichs and Russian-orbit theosophy
  "roerich_nicholas", "roerich_helena",
  // Indian gurus / fellow travellers
  "vivekananda_s", "yogananda_p", "ramakrishna", "ramana_maharshi",
  "maharishi_m",
  // Gurdjieff / Fourth Way
  "gurdjieff_g_i", "ouspensky_p_d",
];

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Show the whole pool (shuffled). The chip rail scrolls vertically, so volume
// is fine, the goal here is breadth: a reader should be able to find someone
// they know without typing.
const FAMOUS_CHIPS = shuffled(FAMOUS_CHIPS_POOL);

/* ---------- HAND-WRITTEN EDGE NARRATIVES ----------
   Keys are alphabetically-sorted "id1|id2". Each value is one plain-English
   sentence explaining the actual historical relationship. This is the content
   that makes a "Bowie 3" mean something, the corpus snippets exist as evidence,
   but they aren't the explanation. */
const EDGE_NARRATIVES = {
  // ---- HPB direct ties ----
  "blavatsky_h_p|mathers_s_l":
    "Blavatsky personally inducted <strong>Mathers</strong> into the Theosophical Society in London in 1887; he soon co-founded the Hermetic Order of the Golden Dawn, drawing on her circle for ritual material.",
  "blavatsky_h_p|olcott_h_s":
    "<strong>Olcott</strong> co-founded the Theosophical Society with Blavatsky in New York in 1875 and ran it as President-Founder until his death in 1907.",
  "blavatsky_h_p|besant_annie":
    "<strong>Besant</strong> succeeded Blavatsky as the central public face of the Theosophical Society after her death in 1891 and ran the Adyar headquarters from 1907 to 1933.",
  "blavatsky_h_p|krishnamurti_j":
    "<strong>Krishnamurti</strong> was 'discovered' by Leadbeater on Adyar Beach in 1909 and groomed by the inner circle as the coming World Teacher, until he dissolved the Order of the Star in 1929 and walked away.",
  "blavatsky_h_p|leadbeater_c_w":
    "<strong>Leadbeater</strong> joined the TS in 1883, became Blavatsky's pupil, and ran Adyar's clairvoyant research wing through the early twentieth century.",
  "blavatsky_h_p|steiner_rudolf":
    "<strong>Steiner</strong> ran the German Section of the Theosophical Society from 1902 until his break with Adyar in 1913, when he founded the Anthroposophical Society.",
  "blavatsky_h_p|fortune_dion":
    "<strong>Dion Fortune</strong> (Violet Firth) trained in TS-derived occult orders in the 1910s and built the Society of the Inner Light directly on theosophical and Golden Dawn foundations.",
  "blavatsky_h_p|yeats_w_b":
    "<strong>Yeats</strong> joined Blavatsky's London Lodge in 1888 and remained close enough to her circle that he later told friends she was the most impressive person he ever met.",
  "blavatsky_h_p|edison_thomas":
    "<strong>Edison</strong> joined the Theosophical Society in 1878, Olcott personally signed him up, and corresponded with Blavatsky about the etheric body and the phonograph.",
  "blavatsky_h_p|conan_doyle_a":
    "<strong>Conan Doyle</strong> moved through Blavatsky's London circle in the late 1880s and stayed publicly in spiritualist-theosophical territory for the rest of his life.",
  "blavatsky_h_p|shaw_g_b":
    "<strong>Shaw</strong> attended Blavatsky's Lansdowne Road salon in the late 1880s; Besant's conversion to theosophy in 1889 famously broke up his Fabian circle.",
  "blavatsky_h_p|gandhi_m":
    "<strong>Gandhi</strong> met Blavatsky and Besant in London as a law student in 1889 and read the Bhagavad Gītā for the first time at the urging of two TS members.",
  "blavatsky_h_p|bradlaugh_charles":
    "<strong>Bradlaugh</strong> was Besant's longtime co-editor and political partner; her break with him in 1889 to follow Blavatsky was the public scandal of London freethought.",
  "blavatsky_h_p|crookes_william":
    "<strong>Crookes</strong> investigated Blavatsky's phenomena under SPR auspices and joined the TS in 1883 while remaining a Fellow of the Royal Society.",
  "blavatsky_h_p|judge_w_q":
    "<strong>Judge</strong> co-founded the TS with Blavatsky and Olcott in 1875 and ran the American Section until his death in 1896.",
  "blavatsky_h_p|vivekananda_s":
    "<strong>Vivekananda</strong> moved through theosophical lecture networks during his 1893 Chicago tour; both worked the same Vedanta-and-occultism circuit in the 1890s, though he later distanced himself.",
  "blavatsky_h_p|arundale_george":
    "<strong>Arundale</strong> grew up inside Adyar (his aunt was Francesca Arundale, an early TS member) and rose to become the fourth international President in 1934.",

  // ---- Mathers / Crowley axis ----
  "crowley_a|mathers_s_l":
    "<strong>Crowley</strong> joined Mathers's Golden Dawn in November 1898 and was initiated through every grade before the two fell out spectacularly in 1904.",
  "bowie_d|crowley_a":
    "<strong>Bowie</strong> name-checks Crowley on Hunky Dory ('I'm closer to the Golden Dawn / immersed in Crowley's uniform') and was reading him obsessively through his Berlin years.",
  "crowley_a|page_j":
    "<strong>Jimmy Page</strong> bought Crowley's Loch Ness estate Boleskine House in 1970, collected his manuscripts, and underwrote a Crowley reissue press through the decade.",
  "crowley_a|jay_z":
    "<strong>Jay-Z</strong> has worn 'Do What Thou Wilt', Crowley's Thelemic motto, on his Rocawear hoodie and tour merch since 2013.",
  "crowley_a|madonna":
    "<strong>Madonna</strong>'s Ray of Light era and 'Frozen' video drew openly on Crowley-derived ceremonial magic, paralleling her Kabbalah Centre study.",
  "crowley_a|del_rey_l":
    "<strong>Lana Del Rey</strong>'s songbook reaches for Crowley directly, 'Hope Is a Dangerous Thing' and the NFR era are full of Thelemic and Aeon imagery.",
  "crowley_a|p_orridge_g":
    "<strong>Genesis P-Orridge</strong> co-founded Thee Temple ov Psychick Youth in 1981 explicitly as a working order in the Crowley–Spare lineage.",
  "crowley_a|moore_a":
    "<strong>Alan Moore</strong> declared himself a magician on his fortieth birthday in 1993 and has cited Crowley as a primary precedent across Promethea, From Hell, and Jerusalem.",
  "crowley_a|morrison_g":
    "<strong>Grant Morrison</strong> cites Crowley throughout The Invisibles and his prose work; his 'chaos magic' lineage runs straight through Thelema.",
  "crowley_a|wilson_r_a":
    "<strong>Robert Anton Wilson</strong> wrote book-length on Crowley (Cosmic Trigger, Prometheus Rising) and built the Illuminatus! mythos on Thelemic scaffolding.",
  "crowley_a|lavey_a":
    "<strong>LaVey</strong> founded the Church of Satan in 1966 with Crowley's Book of the Law as one of its acknowledged precedents.",

  // ---- post-Crowley pop ----
  "bowie_d|smith_p":
    "<strong>Patti Smith</strong> and Bowie performed and recorded together repeatedly through the 1970s; both were anchored in the same Burroughs-Crowley occult-rock circle in New York and London.",
  "lavey_a|manson_m":
    "<strong>Marilyn Manson</strong> was made an honorary 'Reverend' of LaVey's Church of Satan in 1994; LaVey is a load-bearing presence in the band's early aesthetic and mythology.",
  "beyonce|jay_z":
    "<strong>Beyoncé</strong> and Jay-Z have been married since 2008 and have collaborated on each other's records throughout (4:44, Lemonade, Everything Is Love).",

  // ---- Yogananda axis ----
  "olcott_h_s|yogananda_p":
    "<strong>Yogananda</strong>'s teachers moved through the Anglo-Indian reform networks Olcott had spent the 1880s seeding, by the 1920s, Adyar and the Self-Realization Fellowship were drawing from the same well.",
  "harrison_g|yogananda_p":
    "<strong>George Harrison</strong> kept Yogananda's portrait on the Sgt. Pepper's cover (1967) and stayed in the Self-Realization Fellowship orbit for the rest of his life.",
  "jobs_s|yogananda_p":
    "<strong>Steve Jobs</strong> reread Autobiography of a Yogi every year from his teens onward and asked for it to be the only book given out at his memorial service in 2011.",

  // ---- Maharishi / Vivekananda axis ----
  "maharishi_m|vivekananda_s":
    "<strong>Maharishi</strong>'s guru Brahmananda Saraswati was a Shankaracharya in the same Advaita Vedanta lineage Vivekananda had popularised in the West a half-century earlier.",
  "lennon_j|maharishi_m":
    "<strong>The Beatles</strong> studied Transcendental Meditation with Maharishi at Rishikesh in early 1968; the trip produced most of the White Album.",
  "lynch_d|maharishi_m":
    "<strong>David Lynch</strong> has practised TM since 1973, founded the David Lynch Foundation to teach Maharishi's technique, and recorded interviews with him for years.",

  // ---- Besant axis ----
  "besant_annie|kandinsky_w":
    "<strong>Kandinsky</strong>'s Concerning the Spiritual in Art (1911) cites Besant and Leadbeater's Thought-Forms (1905) directly as a source for his colour theory.",
  "besant_annie|scriabin_a":
    "<strong>Scriabin</strong> kept Besant's writings in marked-up Russian translation and built the late mystic-chord works and unfinished Mysterium on theosophical scaffolding.",
  "besant_annie|eliot_t_s":
    "<strong>T. S. Eliot</strong> read Besant and the early TS literature in his Harvard years; The Waste Land's 'Madame Sosostris' is a half-mocking nod to that scene.",
  "besant_annie|nehru_j":
    "<strong>Nehru</strong> came up politically through Besant's Indian Home Rule League; she was Indian National Congress President in 1917 when he was a young Congress recruit.",
  "besant_annie|parsons_j":
    "<strong>Jack Parsons</strong> entered the occult through American TS chapters in the 1930s before moving to Crowley's Agapé Lodge in Pasadena, Besant's network was a common entry point.",

  // ---- Parsons → Hubbard → Cruise ----
  "hubbard_l_ron|parsons_j":
    "<strong>L. Ron Hubbard</strong> moved into Parsons's Pasadena house in 1945, joined his Babalon Working, and left with Parsons's girlfriend and money; Scientology emerged a few years later.",
  "cruise_t|hubbard_l_ron":
    "<strong>Tom Cruise</strong> has been a public Scientologist since 1990 and an OT VIII auditor; Hubbard's writings are the foundational scripture.",

  // ---- Krishnamurti axis ----
  "brand_r|krishnamurti_j":
    "<strong>Russell Brand</strong> cites Krishnamurti repeatedly across his recovery books and dharma-talk material as a primary teacher.",
  "krishnamurti_j|tolle_e":
    "<strong>Eckhart Tolle</strong> has named Krishnamurti as the modern teacher closest to his own 'Power of Now' position; both sit in the same lineage of post-religious nondualism.",
  "ram_dass|tolle_e":
    "<strong>Ram Dass</strong> and Tolle shared the same American satsang circuit from the 1990s on; their books co-led the new-age reading list of that era.",
  "oprah|tolle_e":
    "<strong>Oprah</strong>'s Soul Series picked up A New Earth in 2008, a ten-week televised book club that put Tolle on every American bedside table.",
  "huxley_aldous|krishnamurti_j":
    "<strong>Aldous Huxley</strong> was Krishnamurti's longtime friend in California and wrote the foreword to The First and Last Freedom (1954).",
  "huxley_aldous|lawrence_d_h":
    "<strong>D. H. Lawrence</strong> and Huxley were close at the end of Lawrence's life; Huxley edited Lawrence's letters in 1932 and they shared the Adyar-adjacent California fellow travellers.",
  "bohm_david|krishnamurti_j":
    "<strong>David Bohm</strong> and Krishnamurti held twenty years of recorded dialogues (collected as The Ending of Time, 1985); Bohm's late physics is hard to disentangle from Krishnamurti's framing.",

  // ---- Steiner axis ----
  "mondrian_piet|steiner_rudolf":
    "<strong>Mondrian</strong> joined the Dutch Theosophical Society in 1909 and read Steiner's lectures alongside Schoenmaekers; De Stijl is unintelligible without that frame.",
  "af_klint_hilma|steiner_rudolf":
    "<strong>Hilma af Klint</strong> showed her abstract Paintings for the Temple to Steiner in 1908 and corresponded with him; he reportedly told her no one would understand them for fifty years.",
  "klee_paul|steiner_rudolf":
    "<strong>Klee</strong> read Steiner from his Bauhaus years onward; the Pedagogical Sketchbook leans on Steiner-style colour and form theory.",

  // ---- Fortune → Nicks ----
  "fortune_dion|nicks_s":
    "<strong>Stevie Nicks</strong> has cited Fortune's Mystical Qabalah and Psychic Self-Defense as direct influences on her Welsh-witch persona since the late 1970s.",

  // ---- Yeats → Joyce ----
  "joyce_james|yeats_w_b":
    "<strong>Joyce</strong> read Yeats compulsively, parodied his theosophy in Ulysses ('A. E., the master mystic'), and was inside the same Dublin literary-occult scene in 1902–04.",

  // ---- Judge → Baum ----
  "baum_l_frank|judge_w_q":
    "<strong>L. Frank Baum</strong> joined Judge's American Section TS in 1892; the Wizard of Oz cosmology is shot through with theosophical numerology.",

  // ---- Mead axis (HPB's secretary, the actual London bridge to the next generation) ----
  "blavatsky_h_p|mead_g_r_s":
    "<strong>G. R. S. Mead</strong> was Blavatsky's personal secretary in London from 1889 until her death in 1891 and edited her Collected Writings; after the split with Adyar he founded the Quest Society, which kept the same conversation alive into the 1920s.",
  "crowley_a|mead_g_r_s":
    "<strong>Crowley</strong> moved through Mead's London occult-and-Gnostic lecture circuit in the late 1890s; Mead's Quest Society sat next door to the Golden Dawn world Crowley was working in.",
  "jung_c_g|mead_g_r_s":
    "<strong>Carl Jung</strong> read Mead's Gnostic translations closely (Pistis Sophia, Fragments of a Faith Forgotten) and corresponded with him; Mead's reconstructions sit underneath Jung's Seven Sermons to the Dead and his late alchemical writing.",

  // ---- Vivekananda via Besant (the actual Dijkstra route) ----
  "besant_annie|vivekananda_s":
    "<strong>Vivekananda</strong> and Besant shared the Anglo-Indian Vedanta lecture economy of the 1890s, both were on the Chicago World's Parliament of Religions circuit and corresponded via the same Calcutta-London channels.",

  // ---- Gandhi via Besant (the Dijkstra route, corpus prefers this to direct) ----
  "besant_annie|gandhi_m":
    "<strong>Gandhi</strong> met Besant in London as a law student in 1889 and stayed in her political orbit for thirty years, she preceded him as Indian National Congress President in 1917.",

  // ---- Edison via Olcott (Dijkstra prefers the corpus-attested route) ----
  "edison_thomas|olcott_h_s":
    "<strong>Edison</strong> joined the Theosophical Society in 1878, Olcott personally signed him up, and corresponded with him about the etheric body and the phonograph.",

  // ---- Conan Doyle via Leadbeater ----
  "conan_doyle_a|leadbeater_c_w":
    "<strong>Conan Doyle</strong> moved through the same London occult-and-spiritualist scene Leadbeater anchored from 1883 onward; both were on the late-Victorian psychical-research lecture circuit.",
};

function edgeNarrativeKey(a, b) {
  return [a, b].sort().join("|");
}
function edgeNarrative(a, b) {
  return EDGE_NARRATIVES[edgeNarrativeKey(a, b)] || null;
}

const TRADITION_LABEL = {
  theosophy_adyar:        "Adyar",
  theosophy_pasadena:     "Pasadena",
  theosophy_independent:  "Independent",
  theosophy_supplement:   "TS curated",
  theosophy_wikidata:     "Wikidata-attested",
  krishnamurti:           "Krishnamurti axis",
  anthroposophy:          "Anthroposophy",
  gurdjieff:              "Gurdjieff / Fourth Way",
  fellow_traveler:        "Fellow traveller",
  art_modernism:          "Art / modernism",
  literature:             "Literature",
  science_invention:      "Science / invention",
  philosophy_religion:    "Philosophy / religion",
  occult_esoteric:        "Occult / esoteric",
  music_culture:          "Music",
  film_culture:           "Film",
  tech_culture:           "Tech",
  literature_culture:     "Letters",
  new_age_culture:        "New age",
  adversary:              "Adversary",
  adversary_spr:          "Adversary (SPR)",
  adversary_thelema:      "Adversary (Thelema)",
  adversary_golden_dawn:  "Adversary (Golden Dawn)",
  critic_traditionalist:  "Critic (Traditionalist)",
};

const TRADITION_INK = {
  // Most figures share one ink (magenta) on the friendly graph.
  // Adversaries and critics get the hostile ink (yellow over ink).
  // Famous outsiders get the blue ink (this puts Edison, Kandinsky, etc.
  // visually on a different plane from the inner Adyar circle).
  theosophy_adyar:        PAL.magenta,
  theosophy_pasadena:     PAL.magenta,
  theosophy_independent:  PAL.magenta,
  theosophy_supplement:   PAL.magenta,
  theosophy_wikidata:     PAL.ink3,
  krishnamurti:           PAL.magenta,
  anthroposophy:          PAL.magenta,
  gurdjieff:              PAL.blue,
  fellow_traveler:        PAL.blue,
  art_modernism:          PAL.blue,
  literature:             PAL.blue,
  science_invention:      PAL.blue,
  philosophy_religion:    PAL.blue,
  occult_esoteric:        PAL.blue,
  music_culture:          PAL.blue,
  film_culture:           PAL.blue,
  tech_culture:           PAL.blue,
  literature_culture:     PAL.blue,
  new_age_culture:        PAL.blue,
  adversary:              PAL.yellow,
  adversary_spr:          PAL.yellow,
  adversary_thelema:      PAL.yellow,
  adversary_golden_dawn:  PAL.yellow,
  critic_traditionalist:  PAL.yellow,
};

// ---------- data loading ----------
async function load() {
  const resp = await fetch("data/graph.json");
  if (!resp.ok) throw new Error(`graph.json: ${resp.status}`);
  const data = await resp.json();
  state.data = data;
  data.nodeById = Object.fromEntries(data.nodes.map(n => [n.id, n]));
  data.adj = { friendly: {}, hostile: {} };
  for (const which of ["friendly", "hostile"]) {
    for (const n of data.nodes) data.adj[which][n.id] = [];
    for (const e of data.edges[which]) {
      const cost = 1 / Math.max(e.weight, 0.001);
      data.adj[which][e.source].push({ other: e.target, cost, edge: e });
      data.adj[which][e.target].push({ other: e.source, cost, edge: e });
    }
  }
  // Edge index for fast pair lookup (so the canvas can paint edge metadata).
  data.edgeByPair = { friendly: {}, hostile: {} };
  for (const which of ["friendly", "hostile"]) {
    for (const e of data.edges[which]) {
      const k1 = `${e.source}|${e.target}`;
      const k2 = `${e.target}|${e.source}`;
      data.edgeByPair[which][k1] = e;
      data.edgeByPair[which][k2] = e;
    }
  }
  return data;
}

// ---------- Dijkstra ----------
function shortestPath(adj, src, dst) {
  if (src === dst) return { path: [src], edges: [], dist: 0 };
  const dist = {}, prev = {};
  for (const k of Object.keys(adj)) dist[k] = Infinity;
  dist[src] = 0;
  const pq = [[0, src]];
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, u] = pq.shift();
    if (u === dst) break;
    if (d > dist[u]) continue;
    for (const { other, cost, edge } of adj[u] || []) {
      const nd = d + cost;
      if (nd < dist[other]) {
        dist[other] = nd;
        prev[other] = { from: u, edge };
        pq.push([nd, other]);
      }
    }
  }
  if (dist[dst] === Infinity) return null;
  const path = [], edges = [];
  let cur = dst;
  while (cur !== src) {
    path.push(cur);
    edges.push(prev[cur].edge);
    cur = prev[cur].from;
  }
  path.push(src);
  path.reverse();
  edges.reverse();
  return { path, edges, dist: dist[dst] };
}

// ---------- name search ----------
// Build a single search index over display name + aliases
function buildSearchIndex() {
  const idx = [];
  for (const n of state.data.nodes) {
    const haystack = [n.name];
    // common short forms, pull last name, "First Last", and any obvious shorts
    const parts = n.name.split(/\s+/);
    if (parts.length >= 2) {
      haystack.push(parts[parts.length - 1]);
      haystack.push(`${parts[0]} ${parts[parts.length - 1]}`);
    }
    idx.push({
      id: n.id,
      name: n.name,
      tradition: n.tradition,
      keys: haystack.map(s => s.toLowerCase()),
    });
  }
  return idx;
}

function rankedSearch(idx, q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (const r of idx) {
    let best = -1;
    for (const k of r.keys) {
      if (k === q) { best = 100; break; }
      if (k.startsWith(q)) { best = Math.max(best, 60 - k.length / 2); }
      else if (k.includes(q)) { best = Math.max(best, 30 - k.length / 4); }
    }
    if (best >= 0) out.push({ ...r, score: best });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 8);
}

// ---------- chips ----------
function buildChips() {
  const root = document.getElementById("chips");
  const html = FAMOUS_CHIPS
    .filter(id => state.data.nodeById[id])
    .map(id => {
      const n = state.data.nodeById[id];
      return `<button class="chip" data-id="${id}">${shortName(n.name)}</button>`;
    })
    .join("");
  root.innerHTML = html;
  root.addEventListener("click", e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    selectTarget(b.dataset.id);
  });
}

function shortName(name) {
  // Friendlier display in chips: prefer short last-name when it's distinctive
  // and distinct enough, fall back to display name.
  const known = {
    "Helena Petrovna Blavatsky": "Blavatsky",
    "Henry Steel Olcott": "Olcott",
    "Annie Besant": "Besant",
    "Charles Webster Leadbeater": "Leadbeater",
    "Jiddu Krishnamurti": "Krishnamurti",
    "Rudolf Steiner": "Steiner",
    "Aleister Crowley": "Crowley",
    "Helena Roerich": "H. Roerich",
    "Nicholas Roerich": "N. Roerich",
    "Mohandas Karamchand Gandhi": "Gandhi",
    "Jawaharlal Nehru": "Nehru",
    "Sarojini Naidu": "Naidu",
    "Thomas Edison": "Edison",
    "Wassily Kandinsky": "Kandinsky",
    "Piet Mondrian": "Mondrian",
    "Hilma af Klint": "af Klint",
    "Alexander Scriabin": "Scriabin",
    "L. Frank Baum": "Baum",
    "Aldous Huxley": "Huxley",
    "George Bernard Shaw": "Shaw",
    "Arthur Conan Doyle": "Conan Doyle",
    "T. S. Eliot": "Eliot",
    "James Joyce": "Joyce",
    "D. H. Lawrence": "Lawrence",
    "Ezra Pound": "Pound",
    "Carl Jung": "Jung",
    "William James": "W. James",
    "Henri Bergson": "Bergson",
    "William Butler Yeats": "Yeats",
    "Charles Bradlaugh": "Bradlaugh",
    "Alfred Russel Wallace": "Wallace",
    "William Crookes": "Crookes",
    "David Bohm": "Bohm",
    "Dion Fortune": "Fortune",
    "Manly P. Hall": "M. Hall",
    "A. E. Waite": "Waite",
    "Eliphas Levi": "Lévi",
    "Paul Klee": "Klee",
    "René Guénon": "Guénon",
    "Samuel Liddell Mathers": "Mathers",
    "L. Ron Hubbard": "Hubbard",
    "Anton LaVey": "LaVey",
    "Maurice Maeterlinck": "Maeterlinck",
    "George William Russell": "AE",
    "Martin Buber": "Buber",
    "Emmeline Pankhurst": "Pankhurst",
    "Bal Gangadhar Tilak": "Tilak",
    "Richard Hodgson": "Hodgson",
    "William Wynn Westcott": "Westcott",
    "William Quan Judge": "Judge",
    "Alfred Percy Sinnett": "Sinnett",
    "Alice Bailey": "A. Bailey",
    "G. R. S. Mead": "Mead",
    "Katherine Tingley": "Tingley",
    "Mabel Collins": "Collins",
    "Rukmini Devi Arundale": "R. Arundale",
    "Swami Vivekananda": "Vivekananda",
    "Paramahansa Yogananda": "Yogananda",
    "Ramana Maharshi": "Ramana",
    "Maharishi Mahesh Yogi": "Maharishi",
    "George Gurdjieff": "Gurdjieff",
    "P. D. Ouspensky": "Ouspensky",
    "Oprah Winfrey": "Oprah",
  };
  return known[name] || name;
}

// ---------- input wiring ----------
function wireInput() {
  const inp = document.getElementById("q");
  const sug = document.getElementById("suggest");
  let actIdx = -1;
  let last = [];
  let idx = null;

  function refresh() {
    if (!idx) idx = buildSearchIndex();
    const v = inp.value;
    last = rankedSearch(idx, v);
    if (!last.length) {
      sug.innerHTML = "";
      sug.hidden = true;
      return;
    }
    actIdx = 0;
    sug.innerHTML = last.map((r, i) => {
      const ink = TRADITION_INK[r.tradition] || PAL.ink3;
      const td = TRADITION_LABEL[r.tradition] || r.tradition;
      return `<li class="${i === 0 ? 'act' : ''}" data-id="${r.id}">
        <span class="sw" style="background:${ink}"></span>
        <span>${r.name}</span>
        <span class="meta">${td}</span>
      </li>`;
    }).join("");
    sug.hidden = false;
  }

  inp.addEventListener("input", refresh);
  inp.addEventListener("focus", refresh);
  inp.addEventListener("blur", () => setTimeout(() => { sug.hidden = true; }, 150));
  inp.addEventListener("keydown", e => {
    if (sug.hidden || !last.length) return;
    if (e.key === "ArrowDown") { actIdx = Math.min(last.length - 1, actIdx + 1); paintAct(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { actIdx = Math.max(0, actIdx - 1); paintAct(); e.preventDefault(); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (last[actIdx]) {
        selectTarget(last[actIdx].id);
        sug.hidden = true;
      }
    } else if (e.key === "Escape") {
      sug.hidden = true;
    }
  });

  sug.addEventListener("mousedown", e => {
    const li = e.target.closest("li");
    if (!li) return;
    selectTarget(li.dataset.id);
    sug.hidden = true;
  });

  function paintAct() {
    sug.querySelectorAll("li").forEach((li, i) => li.classList.toggle("act", i === actIdx));
  }

  // mode flip
  const flip = document.getElementById("flip");
  flip.dataset.mode = state.mode;
  flip.addEventListener("click", () => {
    state.mode = state.mode === MODE.friendly ? MODE.hostile : MODE.friendly;
    flip.dataset.mode = state.mode;
    if (state.target) render();
    else paintEmpty();
  });

  // quick-tries (in the empty provenance panel)
  document.getElementById("prov").addEventListener("click", e => {
    const b = e.target.closest(".quick-tries button");
    if (!b) return;
    if (b.dataset.mode === "hostile") {
      state.mode = MODE.hostile;
      document.getElementById("flip").dataset.mode = "hostile";
    } else if (state.mode !== "friendly" && b.dataset.mode !== "hostile") {
      state.mode = MODE.friendly;
      document.getElementById("flip").dataset.mode = "friendly";
    }
    selectTarget(b.dataset.target);
  });
}

// ---------- selection: the moment that drives everything ----------
function selectTarget(id) {
  if (!state.data.nodeById[id]) return;
  state.target = id;
  document.getElementById("q").value = state.data.nodeById[id].name;
  document.getElementById("suggest").hidden = true;
  // mark active chip
  document.querySelectorAll(".chip").forEach(c => c.classList.toggle("is-on", c.dataset.id === id));
  render();
  writeHash();
}

// ---------- empty state ----------
function paintEmpty() {
  const result = document.getElementById("result");
  result.classList.remove("is-hostile");
  result.classList.add("no-path");
  document.getElementById("num").textContent = "·";
  document.getElementById("num-shadow").textContent = "·";
  document.getElementById("post").textContent = "type a name to begin.";

  const svg = d3.select("#viz");
  svg.selectAll("*").remove();
  drawIdleCanvas(svg);

  // empty provenance panel was the default, keep it.
  if (!document.querySelector(".prov-empty")) {
    document.getElementById("prov").innerHTML = `
      <div class="prov-empty">
        <p>Pick a name. The path draws itself, and every step says what the connection actually is.</p>
        <div class="quick-tries">
          <button data-target="edison_thomas">Edison</button>
          <button data-target="kandinsky_w">Kandinsky</button>
          <button data-target="yeats_w_b">Yeats</button>
          <button data-target="gandhi_m">Gandhi</button>
          <button data-target="huxley_aldous">Huxley</button>
          <button data-target="jung_c_g">Jung</button>
          <button data-target="crowley_a" data-mode="hostile">Crowley (hostile)</button>
        </div>
      </div>`;
  }
}

// idle canvas: a horizontal preview of the kind of path that will appear when
// the user picks a name. Same geometry, same disc/edge logic, with the steps
// labelled so "hop" stops being jargon.
function drawIdleCanvas(svg) {
  const W = 720, H = 720, cy = H / 2;

  // four positions across the canvas, evenly spaced, mirror drawPath layout
  const positions = [
    { x: 120, label: "Helena P. Blavatsky", role: "center", caption: "hop 0" },
    { x: 320, label: "an intermediate",     role: "mid",    caption: "hop 1" },
    { x: 520, label: "an intermediate",     role: "mid",    caption: "hop 2" },
    { x: 660, label: "the person you pick", role: "target", caption: "hop 3" },
  ];

  // dashed edges between adjacent positions (idle, not yet a real path)
  for (let i = 0; i < positions.length - 1; i++) {
    svg.append("line")
      .attr("x1", positions[i].x).attr("y1", cy)
      .attr("x2", positions[i + 1].x).attr("y2", cy)
      .attr("stroke", PAL.ink3)
      .attr("stroke-width", 2.5)
      .attr("stroke-dasharray", "5 7")
      .attr("opacity", 0.55);
  }

  // discs
  for (const p of positions) {
    const g = svg.append("g").attr("transform", `translate(${p.x},${cy})`);
    const r = p.role === "mid" ? 18 : 24;
    g.append("circle")
      .attr("r", r + 2)
      .attr("fill", PAL.bg)
      .attr("stroke", PAL.ink)
      .attr("stroke-width", 2);
    g.append("circle")
      .attr("r", r)
      .attr("fill", p.role === "center" ? PAL.ink
                  : p.role === "target" ? PAL.bg
                  : PAL.bg)
      .attr("stroke", p.role === "target" ? PAL.ink3 : PAL.ink)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", p.role === "target" ? "3 4" : null);
    if (p.role === "center") {
      g.append("text")
        .attr("text-anchor", "middle").attr("dy", "0.36em")
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", 10).attr("font-weight", 600)
        .attr("fill", PAL.bg).text("0");
    } else if (p.role === "target") {
      g.append("text")
        .attr("text-anchor", "middle").attr("dy", "0.36em")
        .attr("font-family", "Instrument Serif").attr("font-style", "italic")
        .attr("font-size", 22).attr("fill", PAL.ink3).text("?");
    }
  }

  // hop captions BELOW each disc
  positions.forEach((p, i) => {
    svg.append("text")
      .attr("x", p.x).attr("y", cy + 44)
      .attr("text-anchor", "middle")
      .attr("font-family", "JetBrains Mono")
      .attr("font-size", 10)
      .attr("fill", PAL.ink2)
      .attr("letter-spacing", "0.06em")
      .text(p.caption);
  });

  // person labels ABOVE each disc
  positions.forEach((p, i) => {
    svg.append("text")
      .attr("x", p.x).attr("y", cy - 36)
      .attr("text-anchor", "middle")
      .attr("font-family", "Instrument Serif").attr("font-style", "italic")
      .attr("font-size", p.role === "mid" ? 14 : 16)
      .attr("fill", p.role === "mid" ? PAL.ink2 : PAL.ink)
      .text(p.label);
  });

  // top caption: define the metaphor
  svg.append("text")
    .attr("x", W / 2).attr("y", 90)
    .attr("text-anchor", "middle")
    .attr("font-family", "Space Grotesk")
    .attr("font-weight", 600)
    .attr("font-size", 16)
    .attr("fill", PAL.ink)
    .text("a hop is a documented connection between two people.");
  svg.append("text")
    .attr("x", W / 2).attr("y", 114)
    .attr("text-anchor", "middle")
    .attr("font-family", "Instrument Serif").attr("font-style", "italic")
    .attr("font-size", 16)
    .attr("fill", PAL.ink2)
    .text("your number is how many it takes to reach Blavatsky.");

  // bottom caption: example reading
  svg.append("text")
    .attr("x", W / 2).attr("y", H - 110)
    .attr("text-anchor", "middle")
    .attr("font-family", "JetBrains Mono")
    .attr("font-size", 10)
    .attr("fill", PAL.ink3)
    .attr("letter-spacing", "0.08em")
    .text("EXAMPLE PATH (3 HOPS): YOU → SOMEONE → SOMEONE → BLAVATSKY");
}

// ---------- ENGLISH NUMBER  ----------
const NUM_WORD = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
function numWord(n) { return NUM_WORD[n] || `${n}`; }

// ---------- render: the heart of the app ----------
function render() {
  if (!state.target) { paintEmpty(); return; }
  const adj = state.data.adj[state.mode];
  const path = shortestPath(adj, state.center, state.target);
  paintNumber(path);
  drawPath(path);
  paintProvenance(path);
}

// ---- the giant number ----
function paintNumber(path) {
  const result = document.getElementById("result");
  const num = document.getElementById("num");
  const shadow = document.getElementById("num-shadow");
  const post = document.getElementById("post");
  result.classList.toggle("is-hostile", state.mode === "hostile");
  const targetName = state.data.nodeById[state.target].name;

  if (!path) {
    result.classList.add("no-path");
    num.textContent = "∞";
    shadow.textContent = "∞";
    if (state.mode === "hostile") {
      post.innerHTML = `<strong>${targetName}</strong> has no <em>hostile</em> path to Blavatsky in this corpus. They aren't tagged as adversary and don't appear in adversarial co-occurrences. Try the <em>friendly</em> graph.`;
    } else {
      post.innerHTML = `<strong>${targetName}</strong> isn't reachable from Blavatsky on the friendly graph. They're in the seed list but the corpus has no co-occurrence with anyone who is.`;
    }
    return;
  }
  result.classList.remove("no-path");
  const hops = path.path.length - 1;

  num.textContent = `${hops}`;
  shadow.textContent = `${hops}`;

  const tone = state.mode === "hostile" ? "polemic" : "in-print";
  if (hops === 0) {
    post.innerHTML = `<strong>${targetName}</strong> <em>is</em> Blavatsky.`;
    return;
  }
  if (hops === 1) {
    post.innerHTML = `<span class="pill">${state.mode === 'hostile' ? 'attacks' : '1 hop'}</span><strong>${targetName}</strong> ${state.mode === 'hostile' ? 'is documented as a direct adversary of Blavatsky' : 'is connected to Blavatsky directly'}. The relationship is on the right.`;
    return;
  }
  post.innerHTML = `<span class="pill">${hops} hop${hops===1?'':'s'}</span><strong>${targetName}</strong> is ${numWord(hops)} ${tone} handshakes from Blavatsky, through <strong>${hops - 1}</strong> intermediate${hops - 1 === 1 ? '' : 's'}. The chain is on the right.`;
}

function pathInk(path) {
  return state.mode === "hostile" ? PAL.yellow : PAL.blue;
}

// ---- drawing the path with a force sim ----
let _sim = null;

function drawPath(path) {
  const svg = d3.select("#viz");
  svg.selectAll("*").remove();
  if (_sim) _sim.stop();

  const svgEl = svg.node();
  const rect = svgEl.getBoundingClientRect();
  const W = 720, H = 720;
  const cx = W / 2, cy = H / 2;

  if (!path) {
    drawIdleCanvas(svg);
    return;
  }

  // Layout: center HPB at left-center, target at right-center, intermediates
  // strung between them. Then run a tiny sim to relax (and let the user drag).
  const N = path.path.length;
  const span = Math.min(W - 160, 600);
  const xstart = (W - span) / 2;
  const nodeData = path.path.map((id, i) => {
    const x = xstart + (span * (i / Math.max(N - 1, 1)));
    return {
      id,
      x, y: cy + (i % 2 === 0 ? -8 : 8),
      vx: 0, vy: 0,
      fx: i === 0 ? x : null,
      fy: i === 0 ? cy : null,
      i,
    };
  });
  const linkData = [];
  for (let i = 0; i < N - 1; i++) {
    linkData.push({ source: nodeData[i], target: nodeData[i + 1], edge: path.edges[i] });
  }

  const tint = state.mode === "hostile" ? "tint-hostile" : "tint-friendly";

  // light grid behind, just enough to give the canvas texture
  const gridG = svg.append("g").attr("class", "bg-grid");
  for (let x = 30; x <= W; x += 60) {
    gridG.append("line").attr("x1", x).attr("y1", 0).attr("x2", x).attr("y2", H);
  }
  for (let y = 30; y <= H; y += 60) {
    gridG.append("line").attr("x1", 0).attr("y1", y).attr("x2", W).attr("y2", y);
  }

  // edge SHADOW first (the riso-overlap second-ink trick)
  const edgeShadow = svg.append("g").attr("class", `edge-shadows ${tint}`)
    .selectAll("path")
    .data(linkData)
    .join("path")
    .attr("class", `edge-shadow ${tint}`);

  // primary edge ink
  const edge = svg.append("g").attr("class", `edges ${tint}`)
    .selectAll("path")
    .data(linkData)
    .join("path")
    .attr("class", `edge on-path ${tint}`);

  // (we used to paint an "n=12" label on each edge, but bare n was opaque
  // jargon. The right-hand provenance panel already says "12 sources from
  // the corpus" plainly, no need to repeat it here.)

  // node groups
  const nodeG = svg.append("g").attr("class", "nodes")
    .selectAll("g")
    .data(nodeData, d => d.id)
    .join("g")
    .attr("class", d => {
      const cls = ["node", tint];
      if (d.id === state.center) cls.push("is-center");
      else if (d.id === state.target) cls.push("is-target");
      else cls.push("on-path");
      return cls.join(" ");
    });

  nodeG.append("circle").attr("class", "bg-disc")
    .attr("r", d => d.id === state.center || d.id === state.target ? 24 : 18);
  nodeG.append("circle").attr("class", "disc")
    .attr("r", d => d.id === state.center || d.id === state.target ? 22 : 16)
    .on("click", (_, d) => {
      if (d.id !== state.center) selectTarget(d.id);
    });
  // small hop counter inside
  nodeG.append("text").attr("class", "hop-num")
    .attr("text-anchor", "middle").attr("dy", "0.36em")
    .text(d => `${d.i}`);

  // labels, alternate above/below so they don't collide
  nodeG.append("text").attr("class", "label serif")
    .attr("text-anchor", "middle")
    .attr("dy", d => (d.i % 2 === 0 ? -32 : 36))
    .text(d => state.data.nodeById[d.id].name);

  // hop-distance pill below the label (year first-mention), tasteful
  nodeG.append("text").attr("class", "label")
    .attr("text-anchor", "middle")
    .attr("font-family", "JetBrains Mono")
    .attr("font-size", 9.5)
    .attr("fill", PAL.ink2)
    .attr("dy", d => (d.i % 2 === 0 ? -48 : 52))
    .text(d => {
      const n = state.data.nodeById[d.id];
      const y = (n.birth || "").slice(0, 4);
      return y ? `b. ${y}` : "";
    });

  // simulation with link & charge
  _sim = d3.forceSimulation(nodeData)
    .force("link", d3.forceLink(linkData).distance(d => 110 + 14 * (d.edge.n ? Math.log2(1 + d.edge.n) : 1)).strength(0.5))
    .force("charge", d3.forceManyBody().strength(-260))
    .force("center", d3.forceCenter(cx, cy).strength(0.02))
    .force("y", d3.forceY(cy).strength(0.04))
    .alpha(0.7)
    .alphaDecay(0.02)
    .on("tick", tick);

  function tick() {
    // keep the canvas frame
    for (const d of nodeData) {
      d.x = Math.max(60, Math.min(W - 60, d.x));
      d.y = Math.max(60, Math.min(H - 60, d.y));
    }
    edge.attr("d", d => `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`);
    // riso shadow offset down-right, the second ink kissing the first
    edgeShadow.attr("d", d => `M${d.source.x + 5},${d.source.y + 5} L${d.target.x + 5},${d.target.y + 5}`);
    nodeG.attr("transform", d => `translate(${d.x},${d.y})`);
  }

  // (drag was previously enabled but only had aesthetic value, the path is
  // tiny, intermediates are pinned-feeling already, and rearranging didn't
  // teach anything. Click on a non-center node to re-query, which is the
  // useful interaction.)
  nodeG.selectAll("circle.disc").style("cursor", d =>
    d.id === state.center ? "default" : "pointer"
  );
}

// ---- provenance panel ----
function paintProvenance(path) {
  const prov = document.getElementById("prov");
  if (!path) {
    const targetName = state.data.nodeById[state.target].name;
    prov.innerHTML = `
      <div class="no-path-msg">
        <strong>${targetName}</strong> ${state.mode === 'hostile' ? "isn't an adversary on this graph." : "doesn't reach the Adyar inner circle in this corpus."}
        <button id="flipnow">try ${state.mode === 'hostile' ? 'friendly' : 'hostile'}</button>
      </div>
      <p style="font-family:Instrument Serif; font-style:italic; font-size:16px; line-height:1.5; color:#4a4f5a; margin-top: 16px;">
        The corpus is finite. Some figures are in the seed list because they belong in the conversation
        (Steiner's son-in-law, a peripheral SPR member, etc.) but never share a page with anyone
        already in the network. Their unreachability is the finding, not a bug.
      </p>`;
    document.getElementById("flipnow").addEventListener("click", () => {
      state.mode = state.mode === "hostile" ? "friendly" : "hostile";
      document.getElementById("flip").dataset.mode = state.mode;
      render();
    });
    return;
  }

  const tint = state.mode === "hostile" ? "tint-hostile" : "";
  const N = path.path.length;
  const center = state.data.nodeById[state.center];
  const target = state.data.nodeById[state.target];

  // breadcrumb
  const strip = path.path.map((nid, i) => {
    const n = state.data.nodeById[nid];
    const isT = i === N - 1;
    return `<span class="step ${isT ? 'is-target' : ''}" data-id="${nid}">${shortName(n.name)}</span>`;
  }).join('<span class="arrow">→</span>');

  // edge blocks: each one leads with a hand-written narrative sentence.
  // The corpus snippet is folded behind a "show source" toggle so it doesn't
  // shout over the sentence that actually explains the connection.
  const blocks = path.edges.map((e, i) => {
    const a = state.data.nodeById[path.path[i]];
    const b = state.data.nodeById[path.path[i + 1]];
    const yspan = (e.first_year && e.last_year && e.first_year !== e.last_year)
      ? `${e.first_year}–${e.last_year}`
      : (e.first_year ? `${e.first_year}` : "n.d.");

    const narr = edgeNarrative(a.id, b.id);
    let narrHtml;
    if (narr) {
      narrHtml = `<p class="edge-narr">${narr}</p>`;
    } else if (e.snippets.length) {
      // No hand-written narrative; report what the corpus says, plainly.
      narrHtml = `<p class="edge-narr edge-narr-auto"><strong>${a.name}</strong> and <strong>${b.name}</strong> appear together <strong>${e.n}</strong> time${e.n === 1 ? '' : 's'} in <em>The Theosophist</em>${e.first_year ? ` (first noted ${yspan})` : ''}. No hand-written gloss yet, the source quote below is what the corpus gives us.</p>`;
    } else {
      narrHtml = `<p class="edge-narr edge-narr-auto"><strong>${a.name}</strong> and <strong>${b.name}</strong> are linked through a curated bridge, a well-attested historical tie that <em>The Theosophist</em> itself never printed. The citation lives in <code>data/raw/edges_supplement.csv</code>.</p>`;
    }

    // Sources: one collapsible block, citations only. The Theosophist OCR is
    // noisy enough that quoting it gives the false impression of garbled
    // Victorian English, the citation is the trustworthy artefact.
    let sourcesHtml = "";
    if (e.snippets.length) {
      const items = e.snippets.slice(0, 6).map(s => {
        const author = s.author ? ` · ${shortName(state.data.nodeById[s.author]?.name || s.author)}` : "";
        const doc = s.doc || "(uncited)";
        const yr = s.year ? ` · ${s.year}` : "";
        return `<li><div class="src-cite">${doc}${yr}${author}</div></li>`;
      }).join("");
      const more = e.snippets.length > 6 ? ` (+${e.snippets.length - 6} more)` : "";
      sourcesHtml = `
        <details class="edge-sources">
          <summary>${e.snippets.length} citation${e.snippets.length === 1 ? '' : 's'} from the corpus${more}</summary>
          <ul>${items}</ul>
        </details>`;
    }

    return `<div class="edge-bk ${tint}">
      <div class="edge-bk-head">
        <div class="edge-bk-step">step ${i + 1} of ${path.edges.length}</div>
        <div class="edge-bk-pair"><em>${a.name}</em> → <em>${b.name}</em></div>
      </div>
      ${narrHtml}
      ${sourcesHtml}
    </div>`;
  }).join("");

  prov.innerHTML = `
    <div class="path-strip ${tint}">${strip}</div>
    ${blocks}`;

  // breadcrumb is clickable to re-target
  prov.querySelectorAll(".path-strip .step").forEach(s => {
    s.addEventListener("click", () => {
      if (s.dataset.id !== state.center) selectTarget(s.dataset.id);
    });
  });
}

// ---------- URL hash ----------
function readHash() {
  const h = (location.hash || "").replace(/^#/, "");
  if (!h) return;
  const params = Object.fromEntries(h.split("&").map(p => p.split("=").map(decodeURIComponent)));
  if (params.mode && [MODE.friendly, MODE.hostile].includes(params.mode)) state.mode = params.mode;
  if (params.target && state.data.nodeById[params.target]) state.target = params.target;
  document.getElementById("flip").dataset.mode = state.mode;
}

function writeHash() {
  const parts = [`mode=${state.mode}`];
  if (state.target) parts.push(`target=${state.target}`);
  history.replaceState(null, "", "#" + parts.join("&"));
}

// ---------- boot ----------
load().then(() => {
  buildChips();
  wireInput();
  readHash();
  if (state.target) {
    document.getElementById("q").value = state.data.nodeById[state.target].name;
    document.querySelectorAll(".chip").forEach(c => c.classList.toggle("is-on", c.dataset.id === state.target));
    render();
  } else {
    paintEmpty();
  }
  window.addEventListener("hashchange", () => {
    readHash();
    if (state.target) render();
    else paintEmpty();
  });
}).catch(err => {
  document.body.innerHTML = `<div style="padding:60px;font-family:JetBrains Mono;color:#0d0d12">
    <h1 style="font-family:Space Grotesk;color:#ff2d70">graph.json failed to load.</h1>
    <p>${err.message}</p>
    <p>If you opened <code>index.html</code> directly via <code>file://</code>, browsers block <code>fetch()</code>.
    From <code>web/</code>, run <code>python -m http.server 8000</code> and visit <code>http://localhost:8000/</code>.</p>
  </div>`;
});
