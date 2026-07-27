# Atlas Qwen Capture Bookmarklet

One-click capture of the current Qwen (chat.qwen.ai) conversation into the Atlas conspect pipeline. Same idea as the [ChatGPT bookmarklet](chatgpt-capture-bookmarklet.js), adapted to Qwen's API and message-tree shape.

## How it works

1. Reads the conversation via Qwen's own internal API — `GET https://chat.qwen.ai/api/v2/chats/<id>` — using your existing logged-in browser session. Unlike ChatGPT, Qwen's endpoint needs no separate access-token fetch: it's plain cookie-session auth (`credentials: "include"`), no `Authorization` header involved.
2. Walks the returned message tree (`data.chat.history.messages`, keyed by message id, linked via `parentId`/`childrenIds`, walked back from `history.currentId`) — structurally the same tree-walk as the ChatGPT version, just different field names. Assistant replies store their real text inside `content_list[]` under the entry with `phase: "answer"` (the top-level `content` field is often empty, with `content_list` holding intermediate phases like `thinking_summary` and tool calls too — those are skipped).
3. Opens the same relay page used by the ChatGPT bookmarklet and hands it the extracted text via `postMessage`, exactly like the ChatGPT flow — reused as-is, no Qwen-specific relay needed.

### Why the same relay-page trick?

Not yet confirmed whether chat.qwen.ai's CSP blocks direct cross-origin `fetch()` the way chatgpt.com's does — but the relay page pattern costs nothing extra and sidesteps the question entirely, so it's reused defensively. If it later turns out chat.qwen.ai has no such restriction, this could be simplified to a direct `fetch()` to the webhook, but there's no benefit to doing that today.

## Install (once)

Same as the [ChatGPT bookmarklet](chatgpt-capture-bookmarklet.README.md#install-once): add a bookmark named e.g. `Atlas Capture (Qwen)`, paste your generated `javascript:` URI as its URL (must be added as a bookmark, not typed/pasted into the address bar).

## Use

1. Open a conversation on chat.qwen.ai (URL must look like `chat.qwen.ai/c/<id>`).
2. Click the bookmark.
3. Same popup flow as ChatGPT: "Отправляю в Atlas…" → "Готово!", auto-closes. Conspect lands in `Projects/Atlas/logs/` shortly after.

## Source

- `qwen-capture-bookmarklet.js` — readable source, `RELAY_URL` is a placeholder. Fill in your real relay page URL (the same one used for the ChatGPT bookmarklet) before minifying/using.
- The minified `javascript:` URI is **not committed here**, same policy as the ChatGPT bookmarklet — kept local-only.

## Caveats

- Uses Qwen's private internal API (`/api/v2/chats/<id>`), not a documented public one — could break if Qwen changes it.
- Assumes chat URLs follow the `/c/<id>` pattern (same as ChatGPT's). Adjust `extractConversationId()` if Qwen changes its routing.
- Defaults to the Kie.ai adapter (`provider: "Kie"`). Change to `"OpenRouter"` if desired.
