# Atlas ChatGPT Capture Bookmarklet

One-click capture of the current ChatGPT conversation straight into the Atlas conspect pipeline — no copy-paste, no ChatGPT export, no fighting DOM virtualization.

## How it works

Reads the conversation via ChatGPT's own internal API (`/api/auth/session` for the access token, `/backend-api/conversation/<id>` for the full message tree) using your existing logged-in browser session — the same way the ChatGPT web page itself loads your conversation. No API key, no subscription needed. Then POSTs the extracted text to the `Atlas - Kie Adapter` workflow's `atlas-capture` webhook, which runs it through the same conspect → GitHub-commit pipeline as the form.

## Install (once)

1. Show your browser's bookmarks bar (Ctrl+Shift+B in Chrome/Edge).
2. Right-click the bookmarks bar → **Add page** (or **New bookmark**).
3. **Name**: `Atlas Capture`
4. **URL**: paste the full contents of `chatgpt-capture-bookmarklet.uri.txt` (starts with `javascript:`).
5. Save.

## Use

1. Open a conversation on chatgpt.com (URL must look like `chatgpt.com/c/<id>`).
2. Click the **Atlas Capture** bookmark.
3. A popup confirms success/failure. On success, the conspect appears in `Projects/Atlas/logs/` within a few seconds.

## Source

- `chatgpt-capture-bookmarklet.js` — readable source, edit this if the ChatGPT API structure ever changes.
- `chatgpt-capture-bookmarklet.uri.txt` — the ready-to-paste `javascript:` bookmark URL, generated from the `.js` file (comments stripped, minified to one line, URI-encoded).

## Caveats

- Uses ChatGPT's private internal API (`/backend-api/...`), not an official public one — could break if OpenAI changes it. If it stops working, check the browser console for the actual error and compare against the current shape of the `/backend-api/conversation/<id>` response.
- The webhook secret is embedded in the bookmarklet in plain sight (visible if you inspect the bookmark URL) — acceptable since only you have this bookmark, but don't share the URL itself.
- Defaults to the Kie.ai adapter (`provider: "Kie"` in the script). Change to `"OpenRouter"` in the source and regenerate if you want the other adapter by default.
