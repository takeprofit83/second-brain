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
      const articles = document.querySelectorAll('article, [data-message-author-role], div[data-message-id]');
      const lines = [];
      const seen = new Set();
      for (const art of articles) {
        if (art.parentElement && art.parentElement.closest('article, [data-message-author-role]')) continue;
        const roleAttr = art.getAttribute('data-message-author-role');
        const isUser = roleAttr === 'user' || art.querySelector('[data-message-author-role="user"]') || art.innerText.includes('You said:') || art.innerText.includes('Вы сказали:');
        const contentEl = art.querySelector('.markdown') || art.querySelector('div.whitespace-pre-wrap') || art;
        const t = contentEl ? contentEl.innerText.trim() : '';
        if (t && !seen.has(t)) {
          seen.add(t);
          lines.push((isUser ? 'Пользователь: ' : 'Ассистент: ') + t);
        }
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
      const nodes = document.querySelectorAll('.ds-markdown, [class*="chat-message"], div[class*="chat-content"], div[class*="userMessage"], div[class*="assistantMessage"]');
      const lines = [];
      const seen = new Set();
      for (const n of nodes) {
        const isUser = n.closest('[class*="user"]') !== null || /user/i.test(n.className);
        const t = n.innerText.trim();
        if (t && !seen.has(t)) {
          seen.add(t);
          lines.push((isUser ? 'Пользователь: ' : 'Ассистент: ') + t);
        }
      }
      if (lines.length > 0) text = lines.join('\n\n');
    }
  }

  // 3. Claude
  else if (host.includes('claude.ai')) {
    platform = 'claude';
    const m = location.pathname.match(/\/chat\/([a-f0-9-]+)/i);
    if (m) chatId = m[1];

    const turns = document.querySelectorAll('[data-testid="user-message"], [data-testid="assistant-message"], .font-user-message, .font-claude-message, [class*="Message_content"], div.font-tiempos, div[data-is-streaming]');
    const lines = [];
    const seen = new Set();
    if (turns.length > 0) {
      for (const t of turns) {
        const cls = t.className + ' ' + (t.getAttribute('data-testid') || '');
        const isUser = /user/i.test(cls);
        const txt = t.innerText.trim();
        if (txt && !seen.has(txt)) {
          seen.add(txt);
          lines.push((isUser ? 'Пользователь: ' : 'Ассистент: ') + txt);
        }
      }
    } else {
      const messages = document.querySelectorAll('div[data-is-streaming], div.prose, [class*="standard-markdown"]');
      for (const msg of messages) {
        const isUser = msg.closest('[class*="user"]') !== null;
        const txt = msg.innerText.trim();
        if (txt && !seen.has(txt)) {
          seen.add(txt);
          lines.push((isUser ? 'Пользователь: ' : 'Ассистент: ') + txt);
        }
      }
    }
    if (lines.length > 0) text = lines.join('\n\n');
  }

  // 4. Gemini
  else if (host.includes('gemini.google.com')) {
    platform = 'gemini';
    const m = location.pathname.match(/\/app\/([a-f0-9]+)/i);
    if (m) chatId = m[1];

    const turns = document.querySelectorAll('user-query-container, model-response, message-content, [class*="query-container"], [class*="response-container"], user-query');
    const lines = [];
    const seen = new Set();
    for (const t of turns) {
      const isUser = t.tagName.toLowerCase().includes('user') || /query/i.test(t.className);
      const txt = t.innerText.trim();
      if (txt && !seen.has(txt)) {
        seen.add(txt);
        lines.push((isUser ? 'Пользователь: ' : 'Ассистент: ') + txt);
      }
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
      const nodes = document.querySelectorAll('[class*="message-item"], [class*="chat-message"], [class*="qwen-markdown"]');
      const lines = [];
      const seen = new Set();
      for (const n of nodes) {
        const isUser = /user/i.test(n.className);
        const txt = n.innerText.trim();
        if (txt && !seen.has(txt)) {
          seen.add(txt);
          lines.push((isUser ? 'Пользователь: ' : 'Ассистент: ') + txt);
        }
      }
      if (lines.length > 0) text = lines.join('\n\n');
    }
  }

  // 6. Kimi (Moonshot AI / kimi.ai / kimi.moonshot.cn)
  else if (/kimi|moonshot/i.test(host)) {
    platform = 'kimi';
    const m = location.pathname.match(/\/(?:chat|c)\/([a-zA-Z0-9_-]+)/i);
    if (m) chatId = m[1];

    const lines = [];
    const seenTexts = new Set();

    // Strategy 1: Find message bubbles/turns directly
    const candidateNodes = document.querySelectorAll(
      '[data-testid*="message"], [data-role="user"], [data-role="assistant"], ' +
      '[class*="segment"], [class*="chatItem"], [class*="chat-item"], [class*="message-item"], ' +
      '[class*="userMessage"], [class*="assistantMessage"], [class*="user-message"], [class*="assistant-message"], ' +
      'div[class*="item_user"], div[class*="item_assistant"], div[class*="bubble"]'
    );

    if (candidateNodes.length > 0) {
      for (const node of candidateNodes) {
        // Skip wrapper containers that contain multiple other candidate nodes
        if (node.querySelectorAll('[class*="segment"], [class*="chatItem"], [class*="chat-item"], [class*="message-item"]').length > 1) {
          continue;
        }

        const cls = (node.className || '') + ' ' + (node.getAttribute('data-role') || '') + ' ' + (node.getAttribute('data-testid') || '');
        const isUser = /user|human|question|self|sender/i.test(cls);
        const isAssistant = /assistant|answer|bot|kimi/i.test(cls) || node.querySelector('.markdown, [class*="markdown"]') !== null;

        let contentEl = node.querySelector('.markdown, [class*="markdown"], [class*="content"], [class*="text"], div.whitespace-pre-wrap') || node;
        let t = contentEl ? contentEl.innerText.trim() : '';

        if (t && t.length > 1 && !seenTexts.has(t)) {
          seenTexts.add(t);
          if (isUser) {
            lines.push('Пользователь: ' + t);
          } else if (isAssistant) {
            lines.push('Ассистент: ' + t);
          } else {
            const hasMarkdown = node.querySelector('.markdown, pre, code, ul, ol') !== null;
            lines.push((hasMarkdown ? 'Ассистент: ' : 'Пользователь: ') + t);
          }
        }
      }
    }

    // Strategy 2: If Strategy 1 yielded nothing, find all markdown blocks (assistant answers) and text bubbles
    if (lines.length === 0) {
      const allBubbles = document.querySelectorAll('.markdown, [class*="markdown"], div[class*="user"], div[class*="bubble"], div[class*="message"]');
      for (const b of allBubbles) {
        if (b.children.length > 10) continue; // skip giant parent containers
        const t = b.innerText.trim();
        if (t && t.length > 5 && !seenTexts.has(t)) {
          seenTexts.add(t);
          const isUser = /user/i.test(b.className);
          lines.push((isUser ? 'Пользователь: ' : 'Ассистент: ') + t);
        }
      }
    }

    // Strategy 3: Ultimate DOM scan of any text blocks on Kimi
    if (lines.length === 0) {
      const chatRoot = document.querySelector('[class*="chat"], [class*="dialog"], [class*="scroll"], main') || document.body;
      const divs = Array.from(chatRoot.querySelectorAll('p, pre, div.whitespace-pre-wrap, div[class*="content"]'))
        .map(el => el.innerText.trim())
        .filter(t => t.length > 10);
      const unique = Array.from(new Set(divs));
      for (const u of unique) {
        if (!seenTexts.has(u)) {
          seenTexts.add(u);
          lines.push(u);
        }
      }
    }

    if (lines.length > 0) text = lines.join('\n\n');
  }

  // Universal Fallback if no text yet
  if (!text) {
    const chatRoot = document.querySelector('main, [role="main"], #chat-container, [class*="chat-container"], [class*="chatList"], [class*="messageList"]') || document.body;
    const blocks = Array.from(chatRoot.querySelectorAll('div, p, pre'))
      .map(b => b.innerText.trim())
      .filter(t => t.length > 15 && !t.includes('window.') && !t.includes('function('));
    
    const cleanBlocks = [];
    for (const b of blocks) {
      if (!cleanBlocks.some(existing => existing.includes(b))) {
        cleanBlocks.push(b);
      }
    }
    if (cleanBlocks.length > 0) {
      text = cleanBlocks.join('\n\n');
    }
  }

  // Post-processing: clean up ChatGPT / GenUI interactive widget artifacts
  function cleanGenUIMarkup(raw) {
    if (!raw) return '';
    let s = raw;
    s = s.replace(/\{@body[\s\S]*?\}/g, '');
    s = s.replace(/<radio-group\s*<radio/gi, '<radio');
    s = s.replace(/<radio\b[^>]*>([\s\S]*?)<\/radio>/gi, '\n- [ ] $1');
    s = s.replace(/<button\b[\s\S]*?(?:onClick=\{[\s\S]*?\}\s*)?>([\s\S]*?)<\/button>/gi, '\n\n🔘 **[ Кнопка: $1 ]**');
    s = s.replace(/<\/?(radio-group|checkbox-group|dil|widget|card|box|stack)[^>]*>/gi, '');
    s = s.replace(/\n{3,}/g, '\n\n').trim();
    return s;
  }

  const cleanedText = cleanGenUIMarkup(text);

  return {
    success: cleanedText.length > 0,
    platform: platform,
    chatId: chatId,
    text: cleanedText,
    charCount: cleanedText.length,
    debug: 'platform=' + platform + ', host=' + host + ', len=' + cleanedText.length
  };
})();
