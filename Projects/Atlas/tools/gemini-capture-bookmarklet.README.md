# Atlas Gemini Capture Bookmarklet

One-click capture of the current Gemini (gemini.google.com) conversation into the Atlas conspect pipeline. Same idea as the [ChatGPT](chatgpt-capture-bookmarklet.js), [Qwen](qwen-capture-bookmarklet.js) and [DeepSeek](deepseek-capture-bookmarklet.js) bookmarklets, adapted to Gemini's API — by far the most involved of the four.

## How it works

Gemini doesn't have a plain REST API like the others — it uses Google's internal `batchexecute` RPC protocol (the same framework behind many Google frontends: Docs, the old Bard, etc). There's no human-readable request URL; everything goes through one endpoint with an RPC id picking the actual operation.

1. **Conversation id**: taken from the page URL (`gemini.google.com/app/<id>`), prefixed with `c_` for the RPC call.
2. **Session tokens**: the RPC call needs three values that are generated per session and embedded directly in the page's own HTML/JS bundle — there's no way to get them from a stable "session" endpoint like ChatGPT's. The bookmarklet regex-extracts them straight out of `document.documentElement.innerHTML`:
   - `SNlM0e` → the `at` parameter (anti-CSRF token)
   - `cfb2h` → the `bl` parameter (frontend build label, changes with every Gemini deploy)
   - `FdrFJe` → the `f.sid` parameter (session id)
3. **The request**: `POST https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=hNvQHb&...` with body `f.req=<RPC array>&at=<token>`, where the RPC array encodes `["hNvQHb", "[\"c_<id>\",10,null,1,[0],[4],null,1]", null, "generic"]`. `hNvQHb` is the RPC id for "load conversation"; the inner array's other values were copied verbatim from a real captured request and are not otherwise understood.
4. **The response**: prefixed with Google's `)]}'` anti-JSON-hijacking header, followed by repeated `(byte-length, JSON-array-line)` pairs. The bookmarklet finds the line starting with `[["wrb.fr"`, and JSON.parses its 3rd element *again* (it's a JSON-encoded string, not inline JSON) to get the real payload.
5. **Extracting turns**: the nesting depth of turn data inside that payload isn't fixed (a single-exchange conversation showed the turn one level shallower than a naive fixed-depth read would expect), so rather than hardcoding array indices all the way down, the bookmarklet recursively scans the whole payload for arrays shaped like a turn — `[[convId, respId], ...]`, i.e. anything whose first element is a 2-string id pair — and extracts user/assistant text from each match found this way. This is more robust to Google shifting the exact structure than a fixed-path read would be.
6. Opens the same relay page used by the other bookmarklets and hands it the extracted text via `postMessage`.

## Install (once)

Same as the [ChatGPT bookmarklet](chatgpt-capture-bookmarklet.README.md#install-once): add a bookmark named e.g. `Atlas Capture (Gemini)`, paste your generated `javascript:` URI as its URL.

## Use

1. Open a conversation on gemini.google.com (URL must look like `gemini.google.com/app/<id>`).
2. Click the bookmark.
3. Same popup flow as the others: "Отправляю в Atlas…" → "Готово!", auto-closes. Conspect lands in `Projects/Atlas/logs/` shortly after.

## Source

- `gemini-capture-bookmarklet.js` — readable source, `RELAY_URL` is a placeholder. Fill in your real relay page URL (same one used for the other bookmarklets) before minifying/using.
- The minified `javascript:` URI is **not committed here**, same policy as the other bookmarklets — kept local-only.

## Caveats (this one is the most fragile of the four)

- Uses Google's private, heavily obfuscated `batchexecute` protocol — not a documented API. Google changes the `bl` build-label parameter on essentially every deploy; the bookmarklet re-extracts it live from the page each time, so that part self-adjusts, but a genuine protocol change (new RPC id, different response envelope) would break it outright.
- The `[convId,10,null,1,[0],[4],null,1]` request arguments were captured from one real request and are not understood beyond "they work" — if Gemini changes what these mean (e.g. `10` turning out to be a page-size limit), very long conversations could come back truncated. Not yet verified against a multi-page conversation.
- The recursive turn-finder assumes assistant replies always have their real text at `candidate[0][1][0]` inside the matched turn node. If Gemini returns multiple response candidates/drafts, only the first is captured.
- Defaults to the Kie.ai adapter (`provider: "Kie"`). Change to `"OpenRouter"` if desired.
