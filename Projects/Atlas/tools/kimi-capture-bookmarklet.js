/**
 * Atlas Kimi (Moonshot AI) Capture Bookmarklet
 *
 * Назначение:
 * Захват диалога в 1 клик со страницы Kimi (kimi.moonshot.cn или kimi.ai).
 * Поддерживает гибридный режим:
 * 1. Сначала пробует внутренний API Kimi (/api/chat/<id>/segment/scroll) через токен из localStorage/куки.
 * 2. Если API недоступен — мгновенно переключается на парсинг DOM (гарантированный сбор сообщений).
 *
 * Передаёт данные в Relay-страницу Atlas (?t=timestamp), которая отправляет конспект в n8n.
 */
(async function () {
  const RELAY_URL = "http://195.19.12.38/atlas-relay-d42332f0300f625f.html";
  const PROVIDER = "Kie";

  function extractConversationId() {
    const match = location.pathname.match(/\/(?:chat|c)\/([a-zA-Z0-9_-]+)/i);
    return match ? match[1] : "chat_" + Date.now();
  }

  function getKimiToken() {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const val = localStorage.getItem(k);
      if (!val) continue;
      if (/token|auth/i.test(k) || (val.includes("eyJh") && val.includes("."))) {
        try {
          const parsed = JSON.parse(val);
          if (parsed && parsed.access_token) return parsed.access_token;
          if (parsed && parsed.token) return parsed.token;
          if (parsed && parsed.value) return parsed.value;
        } catch (e) {}
        if (typeof val === "string" && val.length > 20 && !val.startsWith("{")) return val;
      }
    }
    return null;
  }

  async function getConversationFromApi(id, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;

    try {
      const res = await fetch(`/api/chat/${id}/segment/scroll`, {
        method: "POST",
        credentials: "include",
        headers: headers,
        body: JSON.stringify({ size: 1000 })
      });
      if (res.ok) {
        const json = await res.json();
        return json;
      }
    } catch (e) {}

    try {
      const res2 = await fetch(`/api/chat/${id}`, {
        credentials: "include",
        headers: headers
      });
      if (res2.ok) return await res2.json();
    } catch (e) {}

    return null;
  }

  function parseApiItems(data) {
    if (!data) return null;
    const items = data.items || data.segments || (data.data && (data.data.items || data.data.messages)) || [];
    if (!Array.isArray(items) || items.length === 0) return null;

    const roleLabel = { user: "Пользователь", assistant: "Ассистент", system: "Система" };
    const lines = [];

    for (const item of items) {
      const role = (item.role || "").toLowerCase();
      if (role !== "user" && role !== "assistant") continue;

      let text = "";
      if (typeof item.content === "string") {
        text = item.content.trim();
      } else if (Array.isArray(item.content)) {
        text = item.content.map(c => typeof c === "string" ? c : (c.text || "")).join("\n").trim();
      } else if (typeof item.text === "string") {
        text = item.text.trim();
      }

      if (text) {
        lines.push(`${roleLabel[role] || role}: ${text}`);
      }
    }

    return lines.length > 0 ? lines.join("\n\n") : null;
  }

  function extractFromDOM() {
    const lines = [];
    // Селекторы Kimi для сообщений пользователя и ассистента
    const userNodes = document.querySelectorAll('[class*="user"], [class*="User"], [data-role="user"]');
    const assistantNodes = document.querySelectorAll('.markdown, [class*="assistant"], [class*="Assistant"], [data-role="assistant"]');

    // Если найдены стандартные контейнеры
    const allSegments = document.querySelectorAll('[class*="segment"], [class*="chat-message"], [class*="chatItem"]');
    if (allSegments.length > 0) {
      for (const seg of allSegments) {
        const cls = (seg.className || "") + " " + (seg.getAttribute("data-role") || "");
        const isUser = /user|question/i.test(cls);
        const isAssistant = /assistant|answer|markdown/i.test(cls);
        const txt = seg.innerText.trim();
        if (!txt) continue;
        if (isUser) lines.push("Пользователь: " + txt);
        else if (isAssistant) lines.push("Ассистент: " + txt);
      }
    }

    // Запасной общий сбор
    if (lines.length === 0) {
      const main = document.querySelector('main') || document.body;
      const texts = Array.from(main.querySelectorAll('div, p'))
        .map(el => el.innerText.trim())
        .filter(t => t.length > 20);
      const unique = Array.from(new Set(texts));
      if (unique.length > 0) {
        return unique.join("\n\n");
      }
    }

    return lines.join("\n\n");
  }

  try {
    const id = extractConversationId();
    const token = getKimiToken();
    let text = null;

    // 1. Пробуем API
    const apiData = await getConversationFromApi(id, token);
    if (apiData) {
      text = parseApiItems(apiData);
    }

    // 2. Если API не дал результат — берём из DOM
    if (!text) {
      text = extractFromDOM();
    }

    if (!text || text.trim().length === 0) {
      alert("Atlas: Не удалось извлечь текст диалога Kimi. Убедитесь, что диалог открыт и загружен на странице.");
      return;
    }

    const relay = window.open(RELAY_URL + "?t=" + Date.now(), "atlas_relay", "width=440,height=240");
    if (!relay) {
      alert("Atlas: Браузер заблокировал всплывающее окно — разрешите попапы для сайта Kimi и нажмите букмарклет снова.");
      return;
    }

    function onMessage(event) {
      if (event.source !== relay) return;
      if (event.data && event.data.type === "atlas-ready") {
        relay.postMessage({
          type: "atlas-payload",
          text: text,
          provider: PROVIDER,
          source: "kimi",
          chatId: id
        }, "*");
        window.removeEventListener("message", onMessage);
      }
    }
    window.addEventListener("message", onMessage);
  } catch (err) {
    alert("Atlas: Ошибка при захвате Kimi — " + err.message);
  }
})();
