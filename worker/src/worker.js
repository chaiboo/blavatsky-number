/**
 * Blavatsky-Number suggestion intake.
 *
 * Receives a JSON POST from web/suggest.html, validates it, and creates a
 * GitHub Issue in the configured repo. The submitter needs no account.
 *
 * Required Worker bindings (wrangler.toml + secrets):
 *   - vars.GH_REPO          e.g. "chaiboo/blavatsky-number"
 *   - vars.ALLOWED_ORIGINS  comma-separated origins allowed to POST
 *   - secret GH_PAT         a fine-grained PAT with "Issues: write" on the repo
 */

const MAX_LEN = {
  name: 200,
  aliases: 400,
  why: 3000,
  citation: 2000,
  submitterName: 200,
  submitterEmail: 200,
  connections: 30,        // number of items
};
const VALID_TIES = new Set(["friendly", "hostile", "both"]);

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const corsOrigin = allowed.includes(origin) ? origin : allowed[0] || "*";

    if (request.method === "OPTIONS") return preflight(corsOrigin);
    if (request.method !== "POST") return json({ error: "method-not-allowed" }, 405, corsOrigin);

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: "invalid-json" }, 400, corsOrigin);
    }

    // honeypot check — front-end has a hidden "website" field; if it's set,
    // it's a bot. (Front end never sends it; harmless if absent.)
    if (data.website) return json({ ok: true, ignored: true }, 200, corsOrigin);

    const errors = validate(data);
    if (errors.length) return json({ error: errors.join("; ") }, 400, corsOrigin);

    const body = formatIssueBody(data);
    const title = `Suggest: ${truncate(data.name.trim(), 80)}`;
    const labels = ["suggestion", `tie:${data.tie}`];

    const ghResp = await fetch(`https://api.github.com/repos/${env.GH_REPO}/issues`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.GH_PAT}`,
        "Accept": "application/vnd.github+json",
        "User-Agent": "blavatsky-suggest-worker",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ title, body, labels }),
    });

    if (!ghResp.ok) {
      const text = await ghResp.text();
      return json({ error: `github-${ghResp.status}`, detail: truncate(text, 400) }, 502, corsOrigin);
    }
    const issue = await ghResp.json();
    return json({ ok: true, issue: issue.number, url: issue.html_url }, 200, corsOrigin);
  },
};

function validate(d) {
  const errs = [];
  const str = (k, max) => {
    if (typeof d[k] !== "string") return null;
    const v = d[k].trim();
    if (v.length > max) errs.push(`${k}-too-long`);
    return v;
  };
  const name = str("name", MAX_LEN.name);
  const why = str("why", MAX_LEN.why);
  const cite = str("citation", MAX_LEN.citation);
  str("aliases", MAX_LEN.aliases);
  str("submitterName", MAX_LEN.submitterName);
  str("submitterEmail", MAX_LEN.submitterEmail);

  if (!name) errs.push("name-required");
  if (!why) errs.push("why-required");
  if (!cite) errs.push("citation-required");

  if (!VALID_TIES.has(d.tie)) errs.push("tie-invalid");

  if (!Array.isArray(d.connections) || d.connections.length === 0) {
    errs.push("connections-required");
  } else if (d.connections.length > MAX_LEN.connections) {
    errs.push("connections-too-many");
  } else {
    for (const c of d.connections) {
      if (!c || typeof c.id !== "string" || typeof c.name !== "string") {
        errs.push("connection-malformed");
        break;
      }
      if (!/^[a-z0-9_]+$/i.test(c.id) || c.id.length > 80) {
        errs.push("connection-id-invalid");
        break;
      }
    }
  }

  return errs;
}

function formatIssueBody(d) {
  const esc = s => String(s || "").trim();
  const conns = d.connections.map(c => `- \`${c.id}\` — ${esc(c.name)}`).join("\n");
  const submitter = (d.submitterName || d.submitterEmail)
    ? `\n\n---\n*Submitted by:* ${esc(d.submitterName) || "anonymous"}${d.submitterEmail ? ` (${esc(d.submitterEmail)})` : ""}`
    : "\n\n---\n*Submitted anonymously.*";

  return `**Name:** ${esc(d.name)}
**Aliases:** ${esc(d.aliases) || "—"}
**Tie type:** \`${d.tie}\`

### Connected to

${conns}

### Why they belong

${esc(d.why)}

### Citation / source

${esc(d.citation)}${submitter}

<sub>Auto-filed via the suggest form on chaiboo.github.io/blavatsky-number/</sub>`;
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin",
    },
  });
}

function preflight(origin) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    },
  });
}

function truncate(s, n) {
  if (typeof s !== "string") return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
