/* ===========================================================
   SUGGEST A FIGURE — front-end controller.

   Loads graph.json so the "Connected to whom" tag input is
   always backed by the live figure list. POSTs JSON to the
   Cloudflare Worker, which creates a GitHub Issue.
   =========================================================== */

const WORKER_URL = "https://blavatsky-suggest.88chaiboo88.workers.dev";

const state = {
  figures: [],            // [{id, name}]
  selected: new Map(),    // id -> name
  active: -1,             // index in current suggest list
  matches: [],            // current suggestions
};

// ---------- load figures ----------
async function loadFigures() {
  const resp = await fetch("data/graph.json");
  if (!resp.ok) throw new Error(`graph.json: ${resp.status}`);
  const data = await resp.json();
  state.figures = data.nodes
    .map(n => ({ id: n.id, name: n.name, lname: n.name.toLowerCase() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- tag input ----------
function rankFigures(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (const f of state.figures) {
    if (state.selected.has(f.id)) continue;
    if (f.lname === q) out.push({ ...f, score: 100 });
    else if (f.lname.startsWith(q)) out.push({ ...f, score: 60 });
    else if (f.lname.includes(q)) out.push({ ...f, score: 30 });
  }
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return out.slice(0, 10);
}

function renderChips() {
  const root = document.getElementById("tag-chips");
  if (!state.selected.size) {
    root.innerHTML = "";
    return;
  }
  root.innerHTML = [...state.selected.entries()].map(([id, name]) =>
    `<span class="chip-tag" data-id="${id}">${name}<button type="button" aria-label="remove ${name}" data-remove="${id}">×</button></span>`
  ).join("");
}

function renderSuggest() {
  const ul = document.getElementById("tag-suggest");
  if (!state.matches.length) {
    ul.innerHTML = "";
    ul.hidden = true;
    return;
  }
  ul.innerHTML = state.matches.map((m, i) =>
    `<li class="${i === state.active ? 'act' : ''}" data-id="${m.id}">${m.name}</li>`
  ).join("");
  ul.hidden = false;
}

function selectMatch(id, name) {
  if (!id) return;
  if (!name) {
    const f = state.figures.find(x => x.id === id);
    if (!f) return;
    name = f.name;
  }
  state.selected.set(id, name);
  document.getElementById("f-conn-input").value = "";
  state.matches = [];
  state.active = -1;
  renderChips();
  renderSuggest();
}

function removeChip(id) {
  state.selected.delete(id);
  renderChips();
}

function wireTagInput() {
  const inp = document.getElementById("f-conn-input");
  const ul = document.getElementById("tag-suggest");
  const chips = document.getElementById("tag-chips");

  inp.addEventListener("input", () => {
    state.matches = rankFigures(inp.value);
    state.active = state.matches.length ? 0 : -1;
    renderSuggest();
  });
  inp.addEventListener("focus", () => {
    if (inp.value) {
      state.matches = rankFigures(inp.value);
      state.active = state.matches.length ? 0 : -1;
      renderSuggest();
    }
  });
  inp.addEventListener("blur", () => setTimeout(() => { ul.hidden = true; }, 150));
  inp.addEventListener("keydown", e => {
    if (!state.matches.length) {
      if (e.key === "Backspace" && !inp.value && state.selected.size) {
        // remove last chip on empty backspace
        const lastId = [...state.selected.keys()].pop();
        removeChip(lastId);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") { state.active = Math.min(state.matches.length - 1, state.active + 1); renderSuggest(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { state.active = Math.max(0, state.active - 1); renderSuggest(); e.preventDefault(); }
    else if (e.key === "Enter" || e.key === "Tab") {
      if (state.active >= 0) {
        e.preventDefault();
        const m = state.matches[state.active];
        selectMatch(m.id, m.name);
      }
    } else if (e.key === "Escape") {
      state.matches = [];
      renderSuggest();
    }
  });

  ul.addEventListener("mousedown", e => {
    const li = e.target.closest("li");
    if (!li) return;
    selectMatch(li.dataset.id);
  });

  chips.addEventListener("click", e => {
    const b = e.target.closest("button[data-remove]");
    if (!b) return;
    removeChip(b.dataset.remove);
  });
}

// ---------- submission ----------
function setStatus(msg, kind = "") {
  const el = document.getElementById("form-status");
  el.textContent = msg;
  el.className = `form-status ${kind}`;
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;

  // honeypot
  if (form.website.value) return;

  const name = form.name.value.trim();
  const why = form.why.value.trim();
  const citation = form.citation.value.trim();

  if (!name || !why || !citation) {
    setStatus("Name, reason, and citation are required.", "err");
    return;
  }
  if (state.selected.size === 0) {
    setStatus("Pick at least one existing figure they're connected to.", "err");
    return;
  }

  const payload = {
    name,
    aliases: form.aliases.value.trim(),
    tie: form.tie.value,
    connections: [...state.selected.entries()].map(([id, n]) => ({ id, name: n })),
    why,
    citation,
    submitterName: form.submitterName.value.trim(),
    submitterEmail: form.submitterEmail.value.trim(),
  };

  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  setStatus("Sending…", "pending");

  try {
    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      const detail = data.error || `${resp.status} ${resp.statusText}`;
      throw new Error(detail);
    }
    setStatus("Sent. Thanks — I'll review it.", "ok");
    form.reset();
    state.selected.clear();
    renderChips();
  } catch (err) {
    setStatus(`Couldn't send: ${err.message}. Try again or email me.`, "err");
  } finally {
    btn.disabled = false;
  }
}

// ---------- boot ----------
loadFigures()
  .then(() => {
    wireTagInput();
    document.getElementById("suggest-form").addEventListener("submit", handleSubmit);
    if (WORKER_URL.includes("REPLACE_ME")) {
      setStatus("Worker URL not configured yet — set WORKER_URL in suggest.js.", "err");
    }
  })
  .catch(err => {
    setStatus(`Failed to load figures: ${err.message}`, "err");
  });
