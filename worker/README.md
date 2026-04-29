# suggest-worker

Cloudflare Worker that takes form posts from `web/suggest.html` and creates
GitHub Issues in `chaiboo/blavatsky-number`. Submitters need no account.

## Deploy

```bash
cd worker

# 1. Auth wrangler (browser-based, one-time)
wrangler login

# 2. Create a fine-grained Personal Access Token at
#    https://github.com/settings/personal-access-tokens/new
#      - Resource owner: chaiboo
#      - Repository access: only chaiboo/blavatsky-number
#      - Repository permissions: Issues = Read and write
#    Copy the token, then:
wrangler secret put GH_PAT
# (paste when prompted)

# 3. Deploy
wrangler deploy
```

After deploy, wrangler prints a URL like
`https://blavatsky-suggest.<your-account>.workers.dev`. Paste that into
`web/suggest.js` as `WORKER_URL`, commit, push.

## Local dev

```bash
wrangler dev
# serves on http://localhost:8787
```

To test locally with the front-end, set `WORKER_URL = "http://localhost:8787"`
in `web/suggest.js` temporarily.

## Configuration

`wrangler.toml`:
- `GH_REPO`: target repo for Issues.
- `ALLOWED_ORIGINS`: comma-separated origins permitted to POST. Add your
  Pages domain plus any local dev origin.

## Updating

```bash
wrangler deploy   # redeploys src/worker.js
```

To rotate the PAT:
```bash
wrangler secret put GH_PAT   # overwrites the secret
```
