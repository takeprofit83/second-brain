/**
 * Atlas Gemini Capture Bookmarklet
 *
 * Run this while viewing a Gemini conversation (gemini.google.com/app/<id>).
 * Gemini uses Google's internal `batchexecute` RPC protocol (the same
 * framework used by many Google frontends), not a plain REST API — there is
 * no human-readable request URL. The conversation-loading RPC is `hNvQHb`,
 * called with a POST body of the form `f.req=<encoded RPC array>&at=<token>`.
 *
 * Three values are required and are NOT static — they're generated per
 * session and embedded directly in the page's own HTML/JS bundle, so this
 * bookmarklet extracts them from `document.documentElement.innerHTML` via
 * regex rather than hardcoding them:
 *   - SNlM0e ("at"): anti-CSRF token
 *   - cfb2h ("bl"): frontend build label
 *   - FdrFJe ("f.sid"): session id
 *
 * Response format: a `)]}'` anti-JSON-hijacking prefix, followed by
 * repeated (byte-length, JSON-array-line) pairs. The first line starting
 * with `[["wrb.fr"` holds the actual payload as a JSON-encoded *string* in
 * its 3rd element, which needs a second JSON.parse.
 *
 * Same relay-page architecture as the other bookmarklets — see
 * chatgpt-capture-bookmarklet.js for why.
 */
(async function () {
  const RELAY_URL = "REPLACE_WITH_YOUR_RELAY_PAGE_URL"; // same relay page used for the other bookmarklets
  const PROVIDER = "Kie"; // or "OpenRouter"

  function extractConversationId() {
    const match = location.pathname.match(/\/app\/([a-f0-9]+)/i);
    if (!match) throw new Error("Не на странице диалога Gemini (нет /app/<id> в адресе).");
    return match[1];
  }

  function extractPageToken(key) {
    const html = document.documentElement.innerHTML;
    const match = html.match(new RegExp('"' + key + '":"([^"]*)"'));
    if (!match) throw new Error(`Не нашёл ${key} на странице — возможно, Google поменял структуру.`);
    return match[1];
  }

  async function getConversation(rawId) {
    const at = extractPageToken("SNlM0e");
    const bl = extractPageToken("cfb2h");
    const sid = extractPageToken("FdrFJe");
    const convId = "c_" + rawId;

    const innerArgs = JSON.stringify([convId, 10, null, 1, [0], [4], null, 1]);
    const fReq = JSON.stringify([[["hNvQHb", innerArgs, null, "generic"]]]);
    const reqid = Math.floor(Math.random() * 900000) + 100000;

    const url =
      `https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=hNvQHb` +
      `&source-path=%2Fapp%2F${rawId}&bl=${encodeURIComponent(bl)}` +
      `&f.sid=${encodeURIComponent(sid)}&hl=ru&_reqid=${reqid}&rt=c`;
    const body = `f.req=${encodeURIComponent(fReq)}&at=${encodeURIComponent(at)}`;

    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
    });
    if (!res.ok) throw new Error(`Ошибка загрузки диалога: HTTP ${res.status}`);
    const raw = await res.text();

    for (const line of raw.split("\n")) {
      if (line.startsWith('[["wrb.fr"')) {
        const outer = JSON.parse(line);
        const entry = outer[0];
        if (entry && entry[2]) return JSON.parse(entry[2]);
      }
    }
    throw new Error("Не нашёл payload в ответе — возможно, Google поменял формат.");
  }

  // Google's batchexecute nesting depth for turns varies (a single-turn
  // conversation showed `parsed[0]` as the turn pair itself, not a list of
  // pairs), so instead of assuming an exact depth we recursively scan the
  // whole payload for arrays shaped like a turn: `[ [convId, respId], ...]`
  // where the first element is a 2-string id pair.
  function findTurnDataNodes(node, out, seen) {
    if (!Array.isArray(node)) return;
    if (
      node.length >= 4 &&
      Array.isArray(node[0]) &&
      node[0].length === 2 &&
      typeof node[0][0] === "string" &&
      typeof node[0][1] === "string"
    ) {
      const key = node[0][0] + "|" + node[0][1];
      if (!seen.has(key)) {
        seen.add(key);
        out.push(node);
      }
    }
    for (const child of node) findTurnDataNodes(child, out, seen);
  }

  function buildTranscript(parsed) {
    const turnDataNodes = [];
    findTurnDataNodes(parsed, turnDataNodes, new Set());

    const lines = [];
    for (const turnData of turnDataNodes) {
      const userPart = turnData[2];
      const userText = userPart && userPart[0] && userPart[0][0];
      if (userText) lines.push(`Пользователь: ${userText}`);

      const assistantPart = turnData[3];
      const candidate = assistantPart && assistantPart[0];
      const assistantText = candidate && candidate[0] && candidate[0][1] && candidate[0][1][0];
      if (assistantText) lines.push(`Ассистент: ${assistantText}`);
    }
    return lines.join("\n\n");
  }

  try {
    const rawId = extractConversationId();
    const parsed = await getConversation(rawId);
    const text = buildTranscript(parsed);

    if (!text) {
      alert("Atlas: не нашёл текст диалога — возможно, структура API изменилась.");
      return;
    }

    const relay = window.open(RELAY_URL + "?t=" + Date.now(), "atlas_relay", "width=420,height=200");
    if (!relay) {
      alert("Atlas: браузер заблокировал всплывающее окно — разреши попапы для gemini.google.com и попробуй снова.");
      return;
    }

    function onMessage(event) {
      if (event.source !== relay) return;
      if (event.data && event.data.type === "atlas-ready") {
        relay.postMessage({ type: "atlas-payload", text, provider: PROVIDER, source: "gemini", chatId: rawId }, "*");
        window.removeEventListener("message", onMessage);
      }
    }
    window.addEventListener("message", onMessage);
  } catch (err) {
    alert("Atlas: ошибка — " + err.message);
  }
})();
