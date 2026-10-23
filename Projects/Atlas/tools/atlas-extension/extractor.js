(async function() {
  const host = location.hostname.toLowerCase();
  let platform = 'unknown';
  let chatId = 'chat_' + Date.now();
  let text = '';

  // 1. ChatGPT
  if (host.includes('chatgpt.com')) {
    platform = 'chatgpt';
    const m = location.pathname.match(/\/c\/([a-f0-9-]+)/i);
    if (m) chatId = m[1];

    try {
      const sessRes = await fetch('/api/auth/session', { credentials: 'include' });
      if (sessRes.ok) {
        const sess = await sessRes.json();
        if (sess && sess.accessToken && m) {
          const convRes = await fetch('/backend-api/conversation/' + m[1], {
            credentials: 'include',
            headers: { 'Authorization': 'Bearer ' + sess.accessToken }
          });
          if (convRes.ok) {
            const conv = await convRes.json();
            const mapping = conv.mapping || {};
            let curr = conv.current_node;
            const chain = [];
            while (curr) {
              const node = mapping[curr];
              if (!node) break;
              chain.unshift(node);
              curr = node.parent;
            }
            const lines = [];
            for (const node of chain) {
              const msg = node.message;
              if (!msg || !msg.content) continue;
              const role = msg.author && msg.author.role;
              if (role !== 'user' && role !== 'assistant') continue;
              const parts = msg.content.parts || [];
              const t = parts.map(p => typeof p === 'string' ? p : (p.text || '')).join('\n').trim();
              if (t) lines.push((role === 'user' ? 'Пользователь: ' : 'Ассистент: ') + t);
            }
            if (lines.length > 0) text = lines.join('\n\n');
          }
        }
      }
    } catch(e) {}

    // Fallback DOM for ChatGPT
    if (!text) {
      const articles = document.querySelectorAll('article');
      const lines = [];
      for (const art of articles) {
        const isUser = art.querySelector('[data-message-author-role="user"]') || art.innerText.includes('You said:') || art.innerText.includes('Вы сказали:');
        const contentEl = art.querySelector('.markdown') || art.querySelector('div.whitespace-pre-wrap') || art;
        const t = contentEl ? contentEl.innerText.trim() : '';
        if (t) lines.push((isUser ? 'Пользователь: ' : 'Ассистент: ') + t);
      }
      if (lines.length > 0) text = lines.join('\n\n');
    }
  }

  // 2. DeepSeek
  else if (host.includes('deepseek.com')) {
    platform = 'deepseek';
    const m = location.pathname.match(/\/a\/chat\/s\/([a-f0-9-]+)/i);
    if (m) chatId = m[1];

    try {
      const rawTok = localStorage.getItem('userToken');
      if (rawTok && m) {
        const parsed = JSON.parse(rawTok);
        if (parsed.value) {
          const res = await fetch(`https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=${m[1]}`, {
            credentials: 'include',
            headers: { authorization: `Bearer ${parsed.value}` }
          });
          if (res.ok) {
            const data = await res.json();
            const msgs = (data && data.data && data.data.biz_data && data.data.biz_data.chat_messages) || [];
            const lines = msgs
              .filter(m => m.role === 'USER' || m.role === 'ASSISTANT')
              .map(m => (m.role === 'USER' ? 'Пользователь: ' : 'Ассистент: ') + (m.content || '').trim())
              .filter(l => l.length > 15);
            if (lines.length > 0) text = lines.join('\n\n');
          }
        }
      }
    } catch(e) {}

    if (!text) {
      const nodes = document.querySelectorAll('.ds-markdown, [class*="chat-message"]');
      const lines = [];
      for (const n of nodes) {
        const isUser = n.closest('[class*="user"]') !== null;
        const t = n.innerText.trim();
        if (t) lines.push((isUser ? 'Пользователь: ' : 'Ассистент: ') + t);
      }
      if (lines.length > 0) text = lines.join('\n\n');
    }
  }

  // 3. Claude
  else if (host.includes('claude.ai')) {
    platform = 'claude';
    const m = location.pathname.match(/\/chat\/([a-f0-9-]+)/i);
    if (m) chatId = m[1];

    const turns = document.querySelectorAll('[data-testid="user-message"], [data-testid="assistant-message"], .font-user-message, .font-claude-message, [class*="Message_content"]');
    const lines = [];
    if (turns.length > 0) {
      for (const t of turns) {
        const cls = t.className + ' ' + (t.getAttribute('data-testid') || '');
        const isUser = /user/i.test(cls);
        const txt = t.innerText.trim();
        if (txt) lines.push((isUser ? 'Пользователь: ' : 'Ассистент: ') + txt);
      }
    } else {
      const messages = document.querySelectorAll('div[data-is-streaming], div.prose, [class*="standard-markdown"]');
      for (const msg of messages) {
        const isUser = msg.closest('[class*="user"]') !== null;
        const txt = msg.innerText.trim();
        if (txt) lines.push((isUser ? 'Пользователь: ' : 'Ассистент: ') + txt);
      }
    }
    if (lines.length > 0) text = lines.join('\n\n');
  }

  // 4. Gemini
  else if (host.includes('gemini.google.com')) {
    platform = 'gemini';
    const m = location.pathname.match(/\/app\/([a-f0-9]+)/i);
    if (m) chatId = m[1];

    const turns = document.querySelectorAll('user-query-container, model-response, message-content, [class*="query-container"]');
    const lines = [];
    for (const t of turns) {
      const isUser = t.tagName.toLowerCase().includes('user') || /query/i.test(t.className);
      const txt = t.innerText.trim();
      if (txt) lines.push((isUser ? 'Пользователь: ' : 'Ассистент: ') + txt);
    }
    if (lines.length > 0) text = lines.join('\n\n');
  }

  // 5. Qwen
  else if (host.includes('qwen.ai')) {
    platform = 'qwen';
    const m = location.pathname.match(/\/c\/([a-f0-9-]+)/i);
    if (m) chatId = m[1];

    try {
      if (m) {
        const res = await fetch(`https://chat.qwen.ai/api/v2/chats/${m[1]}`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          const msgs = (json && json.data && json.data.chat && json.data.chat.messages) || [];
          const lines = [];
          for (const msg of msgs) {
            const role = (msg.role || '').toLowerCase();
            let content = typeof msg.content === 'string' ? msg.content : '';
            if (!content && Array.isArray(msg.content_list)) {
              content = msg.content_list.filter(p => p && p.phase === 'answer').map(p => p.content).join('\n');
            }
            if (content.trim()) {
              lines.push((role === 'user' ? 'Пользователь: ' : 'Ассистент: ') + content.trim());
            }
          }
          if (lines.length > 0) text = lines.join('\n\n');
        }
      }
    } catch(e) {}

    if (!text) {
      const nodes = document.querySelectorAll('[class*="message-item"], [class*="chat-message"]');
      const lines = [];
      for (const n of nodes) {
        const isUser = /user/i.test(n.className);
        const txt = n.innerText.trim();
        if (txt) lines.push((isUser ? 'Пользователь: ' : 'Ассистент: ') + txt);
      }
      if (lines.length > 0) text = lines.join('\n\n');
    }
  }

  // 6. Kimi (Moonshot AI)
  else if (host.includes('kimi.moonshot.cn') || host.includes('kimi.ai')) {
    platform = 'kimi';
    const m = location.pathname.match(/\/(?:chat|c)\/([a-zA-Z0-9_-]+)/i);
    if (m) chatId = m[1];

    try {
      let token = null;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const val = localStorage.getItem(k);
        if (val && (/token|auth/i.test(k) || (val.includes('eyJh') && val.includes('.')))) {
          try {
            const p = JSON.parse(val);
            token = p.access_token || p.token || p.value;
          } catch(e) { token = val; }
          if (token) break;
        }
      }
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      if (m) {
        const res = await fetch(`/api/chat/${m[1]}/segment/scroll`, {
          method: 'POST',
          credentials: 'include',
          headers: headers,
          body: JSON.stringify({ size: 1000 })
        });
        if (res.ok) {
          const data = await res.json();
          const items = data.items || data.segments || (data.data && data.data.items) || [];
          const lines = [];
          for (const item of items) {
            const role = (item.role || '').toLowerCase();
            const txt = typeof item.content === 'string' ? item.content : (item.text || '');
            if (txt && (role === 'user' || role === 'assistant')) {
              lines.push((role === 'user' ? 'Пользователь: ' : 'Ассистент: ') + txt.trim());
            }
          }
          if (lines.length > 0) text = lines.join('\n\n');
        }
      }
    } catch(e) {}

    if (!text) {
      const segs = document.querySelectorAll('[class*="segment"], [class*="chat-message"], [class*="chatItem"]');
      const lines = [];
      for (const s of segs) {
        const isUser = /user|question/i.test(s.className);
        const txt = s.innerText.trim();
        if (txt) lines.push((isUser ? 'Пользователь: ' : 'Ассистент: ') + txt);
      }
      if (lines.length > 0) text = lines.join('\n\n');
    }
  }

  // Universal Fallback if no text yet
  if (!text) {
    const main = document.querySelector('main') || document.body;
    const blocks = Array.from(main.querySelectorAll('p, div.markdown, div.prose, pre'))
      .map(b => b.innerText.trim())
      .filter(t => t.length > 15);
    const unique = Array.from(new Set(blocks));
    if (unique.length > 0) text = unique.join('\n\n');
  }

  return {
    success: text.length > 0,
    platform: platform,
    chatId: chatId,
    text: text,
    charCount: text.length
  };
})();
