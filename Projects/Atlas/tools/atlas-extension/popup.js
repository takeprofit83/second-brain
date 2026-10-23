(function() {
  const N8N_RESUME_URL  = 'https://n8n.neiroclone.ru/webhook/atlas-context-resume';
  const N8N_CAPTURE_URL = 'https://n8n.neiroclone.ru/webhook/atlas-capture';
  const WEBHOOK_SECRET  = '4a1cc5534eab63ca1ffebb4346c749551e994450e8b9d7fb';

  const tabResumeBtn  = document.getElementById('tab-resume-btn');
  const tabCaptureBtn = document.getElementById('tab-capture-btn');
  const secResume     = document.getElementById('sec-resume');
  const secCapture    = document.getElementById('sec-capture');

  const badgeEl        = document.getElementById('platform-badge');
  const resumeStatus   = document.getElementById('resume-status');
  const resumeActions  = document.getElementById('resume-actions');
  const resumeMeta     = document.getElementById('resume-meta');
  const btnCopyContext = document.getElementById('btn-copy-context');
  const btnInjectContext = document.getElementById('btn-inject-context');

  const captureStatus = document.getElementById('capture-status');
  const btnReadChat   = document.getElementById('btn-read-chat');
  const capturePicker = document.getElementById('capture-picker');

  let activeTab = null;
  let activePlatform = null;
  let loadedPrompt = '';
  let capturedPayload = null;

  // 1. Управление вкладками
  tabResumeBtn.addEventListener('click', () => {
    tabResumeBtn.classList.add('active');
    tabCaptureBtn.classList.remove('active');
    secResume.classList.add('active');
    secCapture.classList.remove('active');
  });

  tabCaptureBtn.addEventListener('click', () => {
    tabCaptureBtn.classList.add('active');
    tabResumeBtn.classList.remove('active');
    secCapture.classList.add('active');
    secResume.classList.remove('active');
  });

  // 2. Определение активной вкладки и сайта
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    activeTab = tabs[0];
    const url = (activeTab.url || '').toLowerCase();

    if (url.includes('chatgpt.com')) activePlatform = 'chatgpt';
    else if (url.includes('claude.ai')) activePlatform = 'claude';
    else if (url.includes('deepseek.com')) activePlatform = 'deepseek';
    else if (url.includes('gemini.google.com')) activePlatform = 'gemini';
    else if (url.includes('qwen.ai')) activePlatform = 'qwen';
    else if (url.includes('kimi.moonshot.cn') || url.includes('kimi.ai')) activePlatform = 'kimi';

    if (activePlatform) {
      const names = {
        chatgpt: 'ChatGPT',
        claude: 'Claude',
        deepseek: 'DeepSeek',
        gemini: 'Gemini',
        qwen: 'Qwen',
        kimi: 'Kimi'
      };
      const name = names[activePlatform] || activePlatform;
      badgeEl.textContent = name;
      badgeEl.style.background = '#238636';

      captureStatus.innerHTML = `Обнаружен чат <b>${name}</b>.<br>Нажмите кнопку ниже, чтобы прочитать диалог:`;
      btnReadChat.style.display = 'flex';
      btnReadChat.textContent = `🔍 Прочитать диалог ${name}`;
    } else {
      badgeEl.textContent = 'Обычная вкладка';
      badgeEl.style.background = '#6e7681';
      captureStatus.textContent = 'Откройте вкладку ChatGPT, Claude, DeepSeek, Gemini, Qwen или Kimi для захвата диалога.';
      btnReadChat.style.display = 'none';
    }
  });

  // 3. Логика ПОДХВАТА контекста (RESUME)
  document.getElementById('resume-buttons').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-key]');
    if (!btn) return;
    const projectKey = btn.getAttribute('data-key');
    const label = btn.textContent.trim();

    resumeStatus.innerHTML = `<span class="spinner"></span> Запрашиваю последний контекст для <b>${label}</b>…`;
    resumeActions.style.display = 'none';

    fetch(N8N_RESUME_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Atlas-Secret': WEBHOOK_SECRET
      },
      body: JSON.stringify({ project: projectKey })
    })
    .then(res => res.json().then(data => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (!ok || data.status === 'error') {
        throw new Error(data.message || 'Ошибка сервера');
      }
      loadedPrompt = data.prompt;
      resumeStatus.innerHTML = `✅ Контекст актуален и готов к передаче.`;
      resumeMeta.innerHTML = `
        <div class="meta-title">${data.projectTitle || label}</div>
        <div class="meta-detail"><b>Файл:</b> ${data.filename || '—'}</div>
        <div class="meta-detail"><b>Обновлено:</b> ${data.updatedAt || 'недавно'}</div>
        <div class="meta-detail"><b>Объём:</b> ~${Math.round((data.contentLength || 0) / 1000)} тыс. знаков</div>
      `;
      resumeActions.style.display = 'block';

      // Автоматическое копирование при загрузке
      navigator.clipboard.writeText(loadedPrompt).then(() => {
        btnCopyContext.textContent = '✅ СКОПИРОВАНО В БУФЕР!';
        btnCopyContext.style.background = '#1f6feb';
      }).catch(() => {});
    })
    .catch(err => {
      resumeStatus.innerHTML = `❌ Ошибка: ${err.message}`;
    });
  });

  // Кнопка «Скопировать в буфер»
  btnCopyContext.addEventListener('click', () => {
    if (!loadedPrompt) return;
    navigator.clipboard.writeText(loadedPrompt).then(() => {
      btnCopyContext.textContent = '✅ СКОПИРОВАНО! (Ctrl+V)';
      btnCopyContext.style.background = '#1f6feb';
    });
  });

  // Кнопка «Вставить прямо в чат»
  btnInjectContext.addEventListener('click', () => {
    if (!loadedPrompt || !activeTab) return;
    btnInjectContext.innerHTML = '<span class="spinner"></span> Вставляю…';

    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (text) => {
        const input = document.querySelector('#prompt-textarea')
          || document.querySelector('.ProseMirror')
          || document.querySelector('rich-textarea [contenteditable="true"]')
          || document.querySelector('div.ql-editor')
          || document.querySelector('textarea#chat-input')
          || document.querySelector('div[contenteditable="true"]')
          || document.querySelector('textarea');

        if (!input) return false;
        input.focus();

        let inserted = false;
        try { inserted = document.execCommand('insertText', false, text); } catch(e) {}
        if (!inserted) {
          if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            input.innerText = text;
            input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
          }
        }
        return true;
      },
      args: [loadedPrompt]
    }, (results) => {
      const res = results && results[0] && results[0].result;
      if (res) {
        btnInjectContext.textContent = '✅ Вставлено в чат!';
        btnInjectContext.style.background = '#238636';
        setTimeout(() => window.close(), 1200);
      } else {
        btnInjectContext.textContent = '⚠️ Не удалось найти поле ввода. Вставьте Ctrl+V';
      }
    });
  });

  // 4. Логика ЗАХВАТА диалога (CAPTURE)
  btnReadChat.addEventListener('click', () => {
    if (!activeTab) return;
    btnReadChat.innerHTML = '<span class="spinner"></span> Читаю переписку…';

    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['extractor.js']
    }, (results) => {
      const payload = results && results[0] && results[0].result;
      if (payload && payload.success && payload.text) {
        capturedPayload = payload;
        captureStatus.innerHTML = `✅ Прочитано: <b>${payload.charCount}</b> символов переписки.`;
        btnReadChat.style.display = 'none';
        capturePicker.style.display = 'block';
      } else {
        btnReadChat.textContent = '🔍 Попробовать снова';
        captureStatus.innerHTML = '❌ Не удалось собрать текст. Убедитесь, что сообщения загрузились на странице.';
      }
    });
  });

  // Клик по проекту для сохранения захваченного диалога
  document.getElementById('capture-buttons').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-key]');
    if (!btn || !capturedPayload) return;
    const projectKey = btn.getAttribute('data-key');
    const label = btn.textContent.trim();

    capturePicker.style.display = 'none';
    captureStatus.innerHTML = `<span class="spinner"></span> Сохраняю конспект в <b>${label}</b>…`;

    fetch(N8N_CAPTURE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Atlas-Secret': WEBHOOK_SECRET
      },
      body: JSON.stringify({
        text: capturedPayload.text,
        provider: 'Kie',
        project: projectKey,
        source: capturedPayload.platform || 'unknown',
        chatId: capturedPayload.chatId || null
      })
    })
    .then(res => {
      if (res.ok) {
        captureStatus.innerHTML = `✅ Конспект успешно сохранён в проект <b>${label}</b>!<br>Диалог упакован в репозиторий.`;
        setTimeout(() => window.close(), 2000);
      } else {
        captureStatus.innerHTML = `❌ Ошибка n8n: HTTP ${res.status}`;
      }
    })
    .catch(err => {
      captureStatus.innerHTML = `❌ Ошибка сети: ${err.message}`;
    });
  });
})();
