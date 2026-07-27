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
  const WEBHOOK_URL = "https://n8n.neiroclone.ru/webhook/atlas-capture";
  const WEBHOOK_SECRET = "REPLACE_WITH_YOUR_ATLAS_CAPTURE_SECRET"; // get this from the "atlas capture secret" credential / your KeePassXC vault — never commit the real value
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

    const resp = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Atlas-Secret": WEBHOOK_SECRET,
      },
      body: JSON.stringify({ text, provider: PROVIDER }),
    });

    if (resp.ok) {
      alert(`Atlas: диалог отправлен на конспектирование (${text.length} симв.).`);
    } else {
      alert(`Atlas: webhook ответил ошибкой HTTP ${resp.status}.`);
    }
  } catch (err) {
    alert("Atlas: ошибка — " + err.message);
  }
})();
