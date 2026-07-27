# Atlas ChatGPT Capture Bookmarklet

One-click capture of the current ChatGPT conversation straight into the Atlas conspect pipeline — no copy-paste, no ChatGPT export, no fighting DOM virtualization.

## How it works

1. Reads the conversation via ChatGPT's own internal API (`/api/auth/session` for the access token, `/backend-api/conversation/<id>` for the full message tree) using your existing logged-in browser session — the same way the ChatGPT web page itself loads your conversation. No API key, no subscription needed.
2. Opens a small **relay page**, hosted on a separate dedicated server (not the main Atlas VPS), and hands it the extracted text via `postMessage`.
3. The relay page POSTs the text to the `Atlas - Kie Adapter` workflow's `atlas-capture` webhook, which runs it through the same conspect → GitHub-commit pipeline as the form.

### Why a relay page instead of posting directly?

chatgpt.com sets a strict Content-Security-Policy that blocks `fetch()` from the page to arbitrary third-party domains (confirmed via a `Refused to connect... violates the Content Security Policy` console error). No amount of CORS configuration on the receiving end fixes this — CSP is enforced by the browser based on the *page's* policy, independent of the target server. `window.open()` to a different origin isn't restricted the same way, so the bookmarklet opens a small page on a separate server and relays the data to it via `postMessage`, and *that* page (unaffected by chatgpt.com's CSP) does the actual `fetch()`.

The relay page also can't be hosted through the main Atlas VPS's existing reverse proxy (Nginx Proxy Manager) — that proxy adds a `Content-Security-Policy: sandbox` header (without `allow-same-origin`) to responses, which would sandbox the relay page into an opaque origin and break its own same-origin `fetch()` to the webhook. So the relay page lives on a small separate free-tier VPS instead, with a plain unmodified nginx (no CSP headers at all).

## Install (once)

1. Show your browser's bookmarks bar (Ctrl+Shift+B in Chrome/Edge).
2. Right-click the bookmarks bar → **Add page** (or **New bookmark**) — do **not** just paste the URL into the address bar, modern browsers refuse to execute `javascript:` URLs typed/pasted there (anti-self-XSS protection). It must be triggered by clicking an actual saved bookmark.
3. **Name**: `Atlas Capture`
4. **URL**: paste your own generated bookmarklet URI (see Source below — the committed `.js` has a placeholder, not the real relay URL).
5. Save.

## Use

1. Open a conversation on chatgpt.com (URL must look like `chatgpt.com/c/<id>`).
2. Click the **Atlas Capture** bookmark.
3. A small popup window opens, shows status ("Отправляю в Atlas…" → "Готово!"), and auto-closes after ~2 seconds. The conspect appears in `Projects/Atlas/logs/` within a few seconds.

## Source

- `chatgpt-capture-bookmarklet.js` — readable source. `RELAY_URL` is a placeholder here; fill in your actual relay page URL before minifying/using.
- The minified, URI-encoded `javascript:` bookmark string and the relay page's own HTML (which embeds the real `atlas-capture` webhook secret) are **not committed here** — both live only locally / on the relay server, never in this public repo.

## Setting up your own relay page

1. Any small VPS with a plain nginx (or similar) works — the only requirement is *not* being behind a proxy that injects a restrictive CSP header.
2. Serve a static HTML page (see `chatgpt-capture-bookmarklet.js` for the exact `postMessage` protocol it expects: listens for `{type:"atlas-payload", text, provider}`, then POSTs `{text, provider}` as JSON to your `atlas-capture` webhook with your `X-Atlas-Secret` header baked in).
3. Give the page an unguessable filename (random hex slug) rather than something obvious like `relay.html`, since anyone who finds the URL could trigger the webhook.
4. Point `RELAY_URL` in the bookmarklet source at it, regenerate the `javascript:` URI, reinstall the bookmark.

## Caveats

- Uses ChatGPT's private internal API (`/backend-api/...`), not an official public one — could break if OpenAI changes it. If it stops working, check the browser console for the actual error and compare against the current shape of the `/backend-api/conversation/<id>` response.
- The relay page's HTML has the real webhook secret embedded in plain sight (visible to anyone who finds its URL) — mitigated by an unguessable filename and by keeping provider API spending limits low as defense in depth, not by trying to hide the fact that a determined person could find and read it.
- Defaults to the Kie.ai adapter (`provider: "Kie"` in the script). Change to `"OpenRouter"` if you want the other adapter by default.
