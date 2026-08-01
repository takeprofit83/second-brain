/**
 * Atlas ChatGPT Capture Bookmarklet
 *
 * Run this while viewing a ChatGPT conversation (chatgpt.com/c/<id>).
 * It reads the conversation via ChatGPT's own internal API (the same one
 * the page itself uses), so it isn't affected by DOM virtualization / lazy
 * rendering — it gets the full conversation regardless of scroll position.
 *
 * Install: minify this (or use as-is) and wrap in `javascript:(function(){...})();`,
 * then save as a browser bookmark. See build.js / README below for the
 * ready-made bookmarklet URI.
 */
(async function () {
  // Relay page hosted on a separate small server (outside the main VPS's
  // reverse proxy, which adds a restrictive CSP `sandbox` header to webhook
  // responses that would block this page's own fetch() otherwise). The
  // relay page itself holds the real webhook secret server-side; this
  // bookmarklet never needs to know it.
  const RELAY_URL = "REPLACE_WITH_YOUR_RELAY_PAGE_URL"; // e.g. http://<relay-server-ip>/atlas-relay-<random>.html
  const PROVIDER = "Kie"; // or "OpenRouter"

  function extractConversationId() {
    const match = location.pathname.match(/\/c\/([a-f0-9-]+)/i);
    if (!match) throw new Error("Не на странице диалога ChatGPT (нет /c/<id> в адресе).");
    return match[1];
  }

  async function getAccessToken() {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    if (!res.ok) throw new Error("Не удалось получить сессию (не залогинен?).");
    const data = await res.json();
    if (!data.accessToken) throw new Error("В сессии нет accessToken.");
    return data.accessToken;
  }

  async function getConversation(id, token) {
    const res = await fetch(`/backend-api/conversation/${id}`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Ошибка загрузки диалога: HTTP ${res.status}`);
    return res.json();
  }

  function extractText(contentPart) {
    if (typeof contentPart === "string") return contentPart;
    if (contentPart && typeof contentPart.text === "string") return contentPart.text;
    return "";
  }

  function buildTranscript(conversation) {
    const mapping = conversation.mapping;
    let nodeId = conversation.current_node;
    const chain = [];
    while (nodeId) {
      const node = mapping[nodeId];
      if (!node) break;
      chain.unshift(node);
      nodeId = node.parent;
    }

    const roleLabel = { user: "Пользователь", assistant: "Ассистент", system: "Система" };
    const lines = [];
    for (const node of chain) {
      const msg = node.message;
      if (!msg || !msg.content) continue;
      const role = msg.author && msg.author.role;
      if (role !== "user" && role !== "assistant") continue; // skip system/tool noise
      const parts = msg.content.parts || [];
      const text = parts.map(extractText).join("\n").trim();
      if (!text) continue;
      lines.push(`${roleLabel[role] || role}: ${text}`);
    }
    return lines.join("\n\n");
  }

  try {
    const id = extractConversationId();
    const token = await getAccessToken();
    const conversation = await getConversation(id, token);
    const text = buildTranscript(conversation);

    if (!text) {
      alert("Atlas: не нашёл текст диалога — возможно, структура API изменилась.");
      return;
    }

    const relay = window.open(RELAY_URL + "?t=" + Date.now(), "atlas_relay", "width=420,height=200");
    if (!relay) {
      alert("Atlas: браузер заблокировал всплывающее окно — разреши попапы для chatgpt.com и попробуй снова.");
      return;
    }

    function onMessage(event) {
      if (event.source !== relay) return;
      if (event.data && event.data.type === "atlas-ready") {
        relay.postMessage({ type: "atlas-payload", text, provider: PROVIDER, source: "chatgpt", chatId: id }, "*");
        window.removeEventListener("message", onMessage);
      }
    }
    window.addEventListener("message", onMessage);
  } catch (err) {
    alert("Atlas: ошибка — " + err.message);
  }
})();
