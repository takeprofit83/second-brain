# AI-OS Current State Audit (Фактическое состояние системы)

**Дата аудита:** 2026-10-23  
**Версия документа:** 1.0  
**Статус:** Выполнен в рамках Фазы A (AI-OS Master Implementation)  
**Объекты аудита:** Second Brain, Atlas v0.3, Браузерное расширение, n8n, Relay Page, Инфраструктура.

---

## 1. Введение и цели аудита

Цель аудита — зафиксировать доказательное фактическое состояние всех компонентов персональной операционной системы искусственного интеллекта (AI-OS) на стыке Second Brain, платформы автоматизации Atlas и внешних ИИ-платформ.

---

## 2. Second Brain (Центральная база знаний)

- **Физическое расположение:** `D:\YandexDisk\Atlas\second-brain`
- **Git репозиторий:** `origin` -> `https://github.com/takeprofit83/second-brain.git` (ветка `main`).
- **Структура директорий:**
  - `Courses/` — материалы курсов и образовательные конспекты.
  - `Debates/` — логи дебатов между моделями (`Atlas - Model Relay`).
  - `docs/` — архитектурная и проектная документация (`ARCHITECTURE.md`, `DECISIONS.md`, `PROJECT_PRINCIPLES.md`, спецификации).
  - `Infrastructure/` — документация инфраструктуры сервера (VPS, Docker, порты).
  - `Knowledge/` — страницы предметных знаний (`<slug>.md`), `index.md`, `log.md`.
  - `Projects/` — рабочие проекты пользователя:
    - `Atlas/` — документация, логи сессий (`logs/`), инструменты (`tools/`).
    - `Dacha/` — логи и материалы проекта "Дача" (`logs/`).
    - `Dzen/` — материалы канала Дзен (`logs/.gitkeep`).
    - `Nastya/` — логи и материалы проекта Настя (`logs/`).
    - `Other/` — прочие разнородные проекты (`logs/.gitkeep`).
  - `Resources/` — общие ресурсы.
  - `Templates/` — шаблоны конспектов, документов и промптов.
- **Форматы данных:** Markdown (`.md`) в кодировке UTF-8, конфигурационные схемы (`.json`).
- **Синхронизация:** Локальная папка подключена к Яндекс Диску; основной код и база знаний версионируются в GitHub (`takeprofit83/second-brain`).
- **Механизм версионирования:**
  - Git-коммиты в ветку `main`.
  - Временные метки в именах файлов (`YYYYMMDD-HHmmss.md`).
- **Файлы состояния проектов:**
  - `Projects/Atlas/Atlas_Project_Log.md` — хронологический лог изменений.
  - `Projects/Atlas/Atlas_Technical_Documentation.md` — полный технический справочник.
  - `Projects/Atlas/logs/` — исторические снимки сессий и handoff-конспекты.

---

## 3. Atlas v0.3 (Инженерная и автоматизационная платформа)

- **Архитектурный шаблон:** Модульный оркестратор поверх n8n и адаптеров LLM.
- **Существующие компоненты в кодовой базе и n8n:**
  - **Adapter Core:**
    - `Atlas-OpenRouter Adapter Core` (ID `FCHKR5wwDT1ZYdKu`) — HTTP-вызовы в OpenRouter API, нормализация ответа в единый JSON `{ answer, model, tokens, error }`.
    - `Atlas-Polza Adapter Core` (ID `gu85dO6jBAoB1S9r`) — HTTP-вызовы в Polza.ai API (OpenAI-совместимый), нормализация ответа.
    - `Atlas-Kie Adapter Core` (ID `7xFzsr8lAy5q51CH`) — HTTP-вызовы в Kie.ai (`gpt-5-2`), нормализация ответа.
  - **Capture & Chunking Pipeline:**
    - `Atlas - Kie Adapter` (ID `ls5hJoxIFtUycpKH`):
      - Принимает вебхук `atlas-capture` (POST) с `X-Atlas-Secret`.
      - Выполняет чанкинг (`Chunk Input`), объединение (`Combine Chunks`).
      - Генерирует сжатый конспект и сохраняет исходный сырой лог (`Save Raw`) и конспект (`Create a file`) в GitHub.
  - **Context-Resume Pipeline:**
    - `Atlas - Context Resume` (ID `TyMCUfCLua060sdc`):
      - Вебхук `https://n8n.neiroclone.ru/webhook/atlas-context-resume` (POST) с `X-Atlas-Secret`.
      - Динамически определяет путь проекта по `project_id`.
      - Запрашивает GitHub Contents API (`/repos/takeprofit83/second-brain/contents/<repoPath>`), находит самый свежий файл сессии/конспекта.
      - Декодирует Base64 и собирает стандартизированный промпт контекста (10 полей: Проект, Дата/время, Источник, Цель, Выполненные действия, Решения, Файлы, Ограничения, Открытые вопросы, Следующий шаг).
      - Возвращает `{ success: true, project, prompt, file_date, latest_file }`.
  - **Docs Sync:**
    - `Atlas - Docs Sync` (ID `B4Z9lptq8i4e9Kur`):
      - Вебхук `atlas-docs-sync` (POST) с `X-Atlas-Secret`.
      - Выполняет коммит/обновление файлов в репозитории `takeprofit83/second-brain` через GitHub Node.
  - **Wiki-Layer:**
    - Готовые описанные воркфлоу в `Projects/Atlas/tools/wiki-layer/`:
      - `atlas-wiki-ingest.json` (индексация новых конспектов в `Knowledge/`).
      - `atlas-wiki-query.json` (RAG/вопрос-ответ по `Knowledge/index.md`).
      - `atlas-wiki-lint.json` (периодическая сверка индекса).

---

## 4. Браузерное расширение (Atlas AI-OS Companion Extension)

- **Расположение:** `D:\YandexDisk\Atlas\atlas-extension\` и зеркало в `second-brain/Projects/Atlas/tools/atlas-extension/`.
- **Манифест:** Manifest V3 (`manifest.json`).
- **Разрешения:** `activeTab`, `scripting`, `storage`.
- **Поддерживаемые ИИ-платформы (детекция хоста и DOM-селекторы):**
  - **ChatGPT** (`chatgpt.com`, `chat.openai.com`) — селектор ввода `#prompt-textarea`, `div[contenteditable="true"]`.
  - **Claude** (`claude.ai`) — селектор ввода `div[contenteditable="true"].ProseMirror`.
  - **DeepSeek** (`chat.deepseek.com`) — селектор ввода `textarea[placeholder*="DeepSeek"]`, `textarea`.
  - **Gemini** (`gemini.google.com`) — селектор ввода `rich-textarea div[contenteditable="true"]`, `div.ql-editor`.
  - **Qwen** (`chat.qwenlm.ai`, `chat.qwen.ai`) — селектор ввода `textarea`, `div[contenteditable="true"]`.
  - **Kimi** (`kimi.moonshot.cn`) — селектор ввода `div[contenteditable="true"]`, `textarea`.
- **Поддерживаемые проекты:**
  - `atlas` — Платформа Atlas
  - `courses` — Обучение и курсы
  - `dzen` — Канал Дзен
  - `nastya` — Проект Настя
  - `dacha` — Проект Дача
  - `other` — Другие проекты
- **Функционал:**
  - Вкладка **Resume (Контекст)**: выбор проекта, запрос к `atlas-context-resume` через Relay / n8n, предпросмотр промпта, копирование в буфер + прямая вставка в поле ввода чата (`⚡ Вставить прямо в чат`).
  - Вкладка **Capture (Захват)**: извлечение истории текущего диалога со страницы ИИ, отправка в n8n `atlas-capture` для суммаризации и записи в `second-brain`.
  - Настройки: сохранение URL релея/n8n и токена `X-Atlas-Secret` в локальном хранилище браузера (`chrome.storage.local`).

---

## 5. Relay Page (Прокси-страница обхода CSP)

- **Сервер:** `tangerine-vps` (195.19.12.38).
- **Путь на сервере:** `/var/www/html/atlas-relay-d42332f0300f625f.html`.
- **URL:** `http://195.19.12.38/atlas-relay-d42332f0300f625f.html`.
- **Резервная копия:** `/var/www/html/atlas-relay-d42332f0300f625f.html.bak`.
- **Назначение:** Обход строгих политик Content Security Policy (CSP) веб-чатов (ChatGPT, Claude, Kimi и др.), блокирующих прямые вызовы `fetch()` из контентных скриптов / букмарклетов на сторонние домены.
- **Поддерживаемые режимы:**
  - `mode: 'capture'` — проксирование текста диалога в `https://n8n.neiroclone.ru/webhook/atlas-capture`.
  - `mode: 'resume'` — запрос контекста проекта из `https://n8n.neiroclone.ru/webhook/atlas-context-resume` и передача ответа через `window.opener.postMessage`.

---

## 6. Инфраструктура

- **Боевой сервер автоматизации (`nikita-vm`):**
  - IP в приватной сети: `10.40.40.10` (SSH alias: `nikita-vm`).
  - Nginx Proxy Manager (`npm`): Терминация SSL, домен `n8n.neiroclone.ru` с валидным сертификатом Let's Encrypt.
  - Docker контейнер `n8n` (`5d1e39ade798`), порт 5678.
  - База данных: PostgreSQL 17 Alpine (`postgres`), порт 5432, база `n8n`.
  - Очереди: Redis 8 Alpine (`redis`), порт 6379.
  - Объектное хранилище: MinIO (`minio`), порты 9000/9001.
- **Релей-сервер (`tangerine-vps`):**
  - Публичный IP: `195.19.12.38` (SSH alias: `tangerine-vps`, SSH key `~/.ssh/tangerine_vps`).
  - Веб-сервер: Nginx на Ubuntu 24.04 LTS.
- **Безопасность и секреты:**
  - `X-Atlas-Secret` используется как общий предохранитель для вебхуков n8n.
  - Персональные токены доступа GitHub (PAT) хранятся в зашифрованных учетных записях n8n (`credentials_entity`).
  - Локальный зашифрованный контейнер KeePass: `D:\YandexDisk\Atlas\atlas-secrets.kdbx`.
