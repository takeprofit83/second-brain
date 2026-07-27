/**
 * Atlas Qwen Capture Bookmarklet
 *
 * Run this while viewing a Qwen conversation (chat.qwen.ai/c/<id>).
 * Reads the conversation via Qwen's own internal API (the same one the
 * page itself uses: GET /api/v2/chats/<id>, cookie-session auth, no
 * bearer token needed), so it isn't affected by DOM virtualization /
 * lazy rendering.
 *
 * Same relay-page architecture as the ChatGPT version (see
 * chatgpt-capture-bookmarklet.js / its README for why): chat.qwen.ai may
 * also restrict cross-origin fetch() via CSP, so this opens the relay
 * page via window.open + postMessage instead of fetching the webhook
 * directly.
 */
(async function () {
  const RELAY_URL = "REPLACE_WITH_YOUR_RELAY_PAGE_URL"; // same relay page used for the ChatGPT bookmarklet
  const PROVIDER = "Kie"; // or "OpenRouter"

  function extractConversationId() {
    const match = location.pathname.match(/\/c\/([a-f0-9-]+)/i);
    if (!match) throw new Error("Не на странице диалога Qwen (нет /c/<id> в адресе).");
    return match[1];
  }

  async function getConversation(id) {
    const res = await fetch(`https://chat.qwen.ai/api/v2/chats/${id}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Ошибка загрузки диалога: HTTP ${res.status}`);
    return res.json();
  }

  function extractText(msg) {
    if (typeof msg.content === "string" && msg.content.trim()) return msg.content.trim();
    if (Array.isArray(msg.content_list)) {
      const answer = msg.content_list
        .filter((p) => p && p.phase === "answer" && typeof p.content === "string")
        .map((p) => p.content)
        .join("\n")
        .trim();
      if (answer) return answer;
    }
    return "";
  }

  function buildTranscript(data) {
    const chat = data.chat || {};
    const history = chat.history || {};
    const messages = history.messages || {};
    let nodeId =
      history.currentId ||
      (Array.isArray(history.currentResponseIds) && history.currentResponseIds[0]);

    const chain = [];
    while (nodeId) {
      const node = messages[nodeId];
      if (!node) break;
      chain.unshift(node);
      nodeId = node.parentId;
    }

    const roleLabel = { user: "Пользователь", assistant: "Ассистент", system: "Система" };
    const lines = [];
    for (const msg of chain) {
      const role = msg.role;
      if (role !== "user" && role !== "assistant") continue; // skip system/tool noise
      const text = extractText(msg);
      if (!text) continue;
      lines.push(`${roleLabel[role] || role}: ${text}`);
    }
    return lines.join("\n\n");
  }

  try {
    const id = extractConversationId();
    const data = await getConversation(id);
    const text = buildTranscript(data);

    if (!text) {
      alert("Atlas: не нашёл текст диалога — возможно, структура API изменилась.");
      return;
    }

    const relay = window.open(RELAY_URL, "atlas_relay", "width=420,height=200");
    if (!relay) {
      alert("Atlas: браузер заблокировал всплывающее окно — разреши попапы для chat.qwen.ai и попробуй снова.");
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
