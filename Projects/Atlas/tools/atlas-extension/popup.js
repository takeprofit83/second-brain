(function() {
  const N8N_RESUME_URL  = 'https://n8n.neiroclone.ru/webhook/atlas-context-resume';
  const N8N_CAPTURE_URL = 'https://n8n.neiroclone.ru/webhook/atlas-capture';
  const N8N_SAVE_URL    = 'https://n8n.neiroclone.ru/webhook/atlas-reverse-save';
  const WEBHOOK_SECRET  = '4a1cc5534eab63ca1ffebb4346c749551e994450e8b9d7fb';

  // Navigation
  const tabResumeBtn  = document.getElementById('tab-resume-btn');
  const tabCaptureBtn = document.getElementById('tab-capture-btn');
  const tabReportBtn  = document.getElementById('tab-report-btn');
  const secResume     = document.getElementById('sec-resume');
  const secCapture    = document.getElementById('sec-capture');
  const secReport     = document.getElementById('sec-report');

  const badgeEl        = document.getElementById('platform-badge');
  const resumeStatus   = document.getElementById('resume-status');
  const resumeActions  = document.getElementById('resume-actions');
  const resumeMeta     = document.getElementById('resume-meta');
  const btnCopyContext = document.getElementById('btn-copy-context');
  const btnInjectContext = document.getElementById('btn-inject-context');

  const captureStatus = document.getElementById('capture-status');
  const btnReadChat   = document.getElementById('btn-read-chat');
  const capturePicker = document.getElementById('capture-picker');

  // Report elements
  const reportSummary  = document.getElementById('report-summary');
  const reportNextStep = document.getElementById('report-next-step');
  const reportActions  = document.getElementById('report-actions');
  const reportDecisions = document.getElementById('report-decisions');
  const reportRawJson  = document.getElementById('report-raw-json');
  const btnSubmitReport = document.getElementById('btn-submit-report');
  const reportStatusBox = document.getElementById('report-status-box');

  let activeTab = null;
  let activePlatform = null;
  let loadedPrompt = '';
  let capturedPayload = null;
  let selectedReportProject = 'atlas';

  // 1. Управление вкладками
  function showTab(activeTabEl, activeSecEl) {
    [tabResumeBtn, tabCaptureBtn, tabReportBtn].forEach(t => t.classList.remove('active'));
    [secResume, secCapture, secReport].forEach(s => s.classList.remove('active'));
    activeTabEl.classList.add('active');
    activeSecEl.classList.add('active');
  }

  tabResumeBtn.addEventListener('click', () => showTab(tabResumeBtn, secResume));
  tabCaptureBtn.addEventListener('click', () => showTab(tabCaptureBtn, secCapture));
  tabReportBtn.addEventListener('click', () => showTab(tabReportBtn, secReport));

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
        throw new Error(data.message || 'Ошибка загрузки контекста');
      }

      loadedPrompt = data.prompt || '';
      resumeStatus.innerHTML = `✅ Контекст для <b>${data.projectTitle || label}</b> получен!`;

      resumeMeta.innerHTML = `
        <div class="meta-title">📄 ${data.filename || 'Лог сессии'}</div>
        <div class="meta-detail"><b>Дата:</b> ${data.updatedAt || 'не указана'}</div>
        <div class="meta-detail"><b>Размер:</b> ${data.contentLength ? data.contentLength + ' символов' : ''}</div>
      `;
      resumeActions.style.display = 'block';

      // Автокопирование
      navigator.clipboard.writeText(loadedPrompt).catch(() => {});
    })
    .catch(err => {
      resumeStatus.innerHTML = `❌ Не удалось получить контекст: ${err.message}`;
    });
  });

  btnCopyContext.addEventListener('click', () => {
    if (!loadedPrompt) return;
    navigator.clipboard.writeText(loadedPrompt).then(() => {
      btnCopyContext.textContent = '✅ Скопировано в буфер!';
      setTimeout(() => btnCopyContext.textContent = '📋 Скопировать в буфер', 1500);
    });
  });

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

  // 5. Логика ОБРАТНОЙ ЗАПИСИ ОТЧЁТА (REPORT & SAVE)
  document.getElementById('report-project-buttons').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-key]');
    if (!btn) return;
    document.querySelectorAll('#report-project-buttons .proj-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedReportProject = btn.getAttribute('data-key');
  });

  // Автопарсинг вставленного JSON
  reportRawJson.addEventListener('input', () => {
    const raw = reportRawJson.value.trim();
    if (!raw.startsWith('{') || !raw.endsWith('}')) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.project_id) {
        selectedReportProject = parsed.project_id.toLowerCase();
        document.querySelectorAll('#report-project-buttons .proj-btn').forEach(b => {
          b.classList.toggle('selected', b.getAttribute('data-key') === selectedReportProject);
        });
      }
      if (parsed.summary) reportSummary.value = parsed.summary;
      if (parsed.next_step) reportNextStep.value = parsed.next_step;
      if (Array.isArray(parsed.completed_actions)) reportActions.value = parsed.completed_actions.join('\n');
      if (Array.isArray(parsed.decisions_made)) {
        reportDecisions.value = parsed.decisions_made.map(d => typeof d === 'string' ? d : d.title).join('; ');
      }
      reportStatusBox.style.display = 'block';
      reportStatusBox.innerHTML = '✨ JSON успешно распознан и поля заполнены!';
    } catch(e) {}
  });

  btnSubmitReport.addEventListener('click', () => {
    const summary = reportSummary.value.trim();
    const nextStep = reportNextStep.value.trim();

    if (!summary) {
      alert('Пожалуйста, заполните резюме выполненной работы.');
      reportSummary.focus();
      return;
    }

    btnSubmitReport.disabled = true;
    btnSubmitReport.innerHTML = '<span class="spinner"></span> Отправка в Second Brain…';
    reportStatusBox.style.display = 'block';
    reportStatusBox.innerHTML = 'Передача отчёта в n8n…';

    const rawActions = reportActions.value.trim();
    const completedActions = rawActions ? rawActions.split('\n').map(s => s.replace(/^-\s*(\[x\])?\s*/i, '').trim()).filter(Boolean) : [];

    const rawDecisions = reportDecisions.value.trim();
    const decisionsMade = rawDecisions ? rawDecisions.split(';').map(s => ({ title: s.trim() })).filter(d => d.title) : [];

    const payload = {
      project_id: selectedReportProject,
      source_ai: activePlatform || 'companion-extension',
      summary: summary,
      completed_actions: completedActions,
      decisions_made: decisionsMade,
      next_step: nextStep || 'Продолжить выполнение по плану проекта.'
    };

    fetch(N8N_SAVE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Atlas-Secret': WEBHOOK_SECRET
      },
      body: JSON.stringify(payload)
    })
    .then(res => res.json().then(data => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      btnSubmitReport.disabled = false;
      btnSubmitReport.textContent = '🚀 Сохранить отчёт в Second Brain';

      if (!ok || !data.success) {
        throw new Error(data.error || 'Ошибка при сохранении отчёта');
      }

      reportStatusBox.style.display = 'block';
      reportStatusBox.innerHTML = `
        <div style="color:#3fb950; font-weight:600; margin-bottom:4px;">✅ Отчёт успешно сохранён!</div>
        <div style="font-size:11px; color:#8b949e; word-break:break-all;">
          <b>Файл:</b> ${data.log_path}<br>
          <b>SHA:</b> ${data.commit_sha ? data.commit_sha.substring(0, 7) : 'ok'}
        </div>
      `;
      setTimeout(() => {
        reportSummary.value = '';
        reportNextStep.value = '';
        reportActions.value = '';
        reportDecisions.value = '';
        reportRawJson.value = '';
      }, 1500);
    })
    .catch(err => {
      btnSubmitReport.disabled = false;
      btnSubmitReport.textContent = '🚀 Сохранить отчёт в Second Brain';
      reportStatusBox.style.display = 'block';
      reportStatusBox.innerHTML = `<span style="color:#f85149">❌ Ошибка: ${err.message}</span>`;
    });
  });
})();
