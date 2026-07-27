# Atlas DeepSeek Capture Bookmarklet

One-click capture of the current DeepSeek (chat.deepseek.com) conversation into the Atlas conspect pipeline. Same idea as the [ChatGPT](chatgpt-capture-bookmarklet.js) and [Qwen](qwen-capture-bookmarklet.js) bookmarklets, adapted to DeepSeek's API.

## How it works

1. Reads the conversation via DeepSeek's own internal API — `GET https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=<id>`.
2. Unlike Qwen (cookie-only) but like ChatGPT (bearer token), DeepSeek requires an `Authorization: Bearer <token>` header even though the browser session is already cookie-authenticated — confirmed by testing: a plain navigation to the endpoint without that header returns `{"code":40003,"msg":"INVALID_TOKEN"}`. Unlike ChatGPT, there's no token-issuing endpoint to call — the token is simply sitting in `localStorage.getItem("userToken")` (a JSON blob `{value, __version}`), which the bookmarklet reads directly since it runs in the page's own context.
3. The endpoint also has an app-level delta-cache mechanism: DeepSeek's own frontend normally calls it with `cache_version`/`cache_reset_at` query params, and when the server thinks the client's local cache is current, it returns an **empty** `chat_messages` array (`cache_control: "MERGE"`). The bookmarklet deliberately omits those params to always get the full message list.
4. Response shape is simpler than ChatGPT/Qwen: `data.data.biz_data.chat_messages` is already a **flat array** (`message_id`, `parent_id`, `role`: `USER`/`ASSISTANT`, `content`: plain string — no nested content parts to unwrap). The bookmarklet still walks it as a `parent_id` chain from `chat_session.current_message_id`, same as the ChatGPT/Qwen tree-walk, for robustness against branch edits.
5. Opens the same relay page used by the other bookmarklets and hands it the extracted text via `postMessage`.

## Install (once)

Same as the [ChatGPT bookmarklet](chatgpt-capture-bookmarklet.README.md#install-once): add a bookmark named e.g. `Atlas Capture (DeepSeek)`, paste your generated `javascript:` URI as its URL.

## Use

1. Open a conversation on chat.deepseek.com (URL must look like `chat.deepseek.com/a/chat/s/<id>`).
2. Click the bookmark.
3. Same popup flow as the others: "Отправляю в Atlas…" → "Готово!", auto-closes. Conspect lands in `Projects/Atlas/logs/` shortly after.

## Source

- `deepseek-capture-bookmarklet.js` — readable source, `RELAY_URL` is a placeholder. Fill in your real relay page URL (same one used for the other bookmarklets) before minifying/using.
- The minified `javascript:` URI is **not committed here**, same policy as the other bookmarklets — kept local-only.

## Caveats

- Uses DeepSeek's private internal API (`/api/v0/chat/history_messages`), not a documented public one — could break if DeepSeek changes it.
- Depends on the `userToken` localStorage key continuing to hold `{value: "<bearer token>"}`. If DeepSeek renames it or moves to a different auth scheme, `getToken()` needs updating.
- Assumes chat URLs follow the `/a/chat/s/<id>` pattern. Adjust `extractConversationId()` if DeepSeek changes its routing.
- Defaults to the Kie.ai adapter (`provider: "Kie"`). Change to `"OpenRouter"` if desired.
