/**
 * Atlas DeepSeek Capture Bookmarklet
 *
 * Run this while viewing a DeepSeek conversation (chat.deepseek.com/a/chat/s/<id>).
 * Reads the conversation via DeepSeek's own internal API:
 * GET /api/v0/chat/history_messages?chat_session_id=<id>, authenticated with
 * a bearer token read straight out of localStorage("userToken") — DeepSeek
 * requires this Authorization header even though the browser is already
 * logged in via cookies (confirmed: a plain navigation to the endpoint
 * without it returns {"code":40003,"msg":"INVALID_TOKEN"}).
 *
 * Also: the endpoint supports an app-level delta cache via `cache_version`/
 * `cache_reset_at` query params that the DeepSeek web app sends once it has
 * already cached the conversation locally — with those params present it
 * returns an empty `chat_messages` array. This bookmarklet deliberately
 * omits them to always get the full message list.
 *
 * Same relay-page architecture as the ChatGPT/Qwen versions — see
 * chatgpt-capture-bookmarklet.js for why.
 */
(async function () {
  const RELAY_URL = "REPLACE_WITH_YOUR_RELAY_PAGE_URL"; // same relay page used for the other bookmarklets
  const PROVIDER = "Kie"; // or "OpenRouter"

  function extractConversationId() {
    const match = location.pathname.match(/\/a\/chat\/s\/([a-f0-9-]+)/i);
    if (!match) throw new Error("Не на странице диалога DeepSeek (нет /a/chat/s/<id> в адресе).");
    return match[1];
  }

  function getToken() {
    const raw = localStorage.getItem("userToken");
    if (!raw) throw new Error("Не нашёл userToken в localStorage (не залогинен?).");
    const parsed = JSON.parse(raw);
    if (!parsed.value) throw new Error("В userToken нет value.");
    return parsed.value;
  }

  async function getConversation(id, token) {
    const res = await fetch(`https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=${id}`, {
      credentials: "include",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Ошибка загрузки диалога: HTTP ${res.status}`);
    return res.json();
  }

  function buildTranscript(response) {
    const bizData = response && response.data && response.data.biz_data;
    if (!bizData) throw new Error("Неожиданная структура ответа.");
    const messages = bizData.chat_messages || [];
    const byId = new Map(messages.map((m) => [m.message_id, m]));

    let nodeId = bizData.chat_session && bizData.chat_session.current_message_id;
    const chain = [];
    while (nodeId) {
      const node = byId.get(nodeId);
      if (!node) break;
      chain.unshift(node);
      nodeId = node.parent_id;
    }

    const roleLabel = { USER: "Пользователь", ASSISTANT: "Ассистент" };
    const lines = [];
    for (const msg of chain) {
      const role = msg.role;
      if (role !== "USER" && role !== "ASSISTANT") continue;
      const text = typeof msg.content === "string" ? msg.content.trim() : "";
      if (!text) continue;
      lines.push(`${roleLabel[role] || role}: ${text}`);
    }
    return lines.join("\n\n");
  }

  try {
    const id = extractConversationId();
    const token = getToken();
    const conversation = await getConversation(id, token);
    const text = buildTranscript(conversation);

    if (!text) {
      alert("Atlas: не нашёл текст диалога — возможно, структура API изменилась.");
      return;
    }

    const relay = window.open(RELAY_URL, "atlas_relay", "width=420,height=200");
    if (!relay) {
      alert("Atlas: браузер заблокировал всплывающее окно — разреши попапы для chat.deepseek.com и попробуй снова.");
      return;
    }

    function onMessage(event) {
      if (event.source !== relay) return;
      if (event.data && event.data.type === "atlas-ready") {
        relay.postMessage({ type: "atlas-payload", text, provider: PROVIDER }, "*");
        window.removeEventListener("message", onMessage);
      }
    }
    window.addEventListener("message", onMessage);
  } catch (err) {
    alert("Atlas: ошибка — " + err.message);
  }
})();
