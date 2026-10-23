---
type: memory
tier: 1
ai_read: true
tags:
  - memory
  - moc
  - dashboard
---

# 🧠 Second Brain & AI-OS Dashboard

> [!abstract] **Центральный пульт управления персональной базой знаний и операционной системы ИИ**
> Добро пожаловать! Здесь сходятся все ваши проекты, заметки, архитектурные решения и сессии работы ИИ-агентов. Все данные хранятся в формате Markdown и версионируются в GitHub.

---

## 🚀 Проекты (Projects Hub)

| Проект | Статус | Карточка состояния (Tier 1 MOC) | Назначение |
|---|:---:|---|---|
| 🌌 **Atlas AI-OS** | `active` | [[Projects/Atlas/project_state\|Atlas Project State]] | Платформа оркестрации, адаптеры моделей и автоматизация |
| ✍️ **Яндекс Дзен** | `active` | [[Projects/Dzen/project_state\|Dzen Project State]] | Контент-фабрика, статьи, идеи и публикации |
| 🎓 **Образование & Курсы** | `active` | [[Courses/project_state\|Courses Project State]] | Конспекты курсов, разборы видео и книг |
| 🏡 **Проект Дача** | `active` | [[Projects/Dacha/project_state\|Dacha Project State]] | Умный дом, микросервисы и боты загородного дома |
| 🌸 **Проект Настя** | `active` | [[Projects/Nastya/project_state\|Nastya Project State]] | Персональное пространство и задачи Насти |
| 🔮 **Другие проекты** | `active` | [[Projects/Other/project_state\|Other Project State]] | Разовые исследования, гипотезы и песочница |

---

## 🏷 Модель памяти и экономия токенов (Obsidian Properties)

> [!tip] **Трёхуровневая архитектура (ADR-018) — экономия более 95% токенов:**
> - 🟢 **Tier 1 (Core Shared Memory):** `type: memory`, `tier: 1`, `ai_read: true`  
>   Файлы `project_state.md`. Агенты читают **только** их на старте (< 150 строк / ~1,200 токенов).  
> - 🟡 **Tier 2 (Reference Knowledge):** `type: knowledge`, `tier: 2`, `ai_read: on_demand`  
>   Заметки `Knowledge/*.md` и ADR. Читаются точечно только по явным `[[ссылкам]]`.  
> - 🔴 **Tier 3 (Logs Archive):** `type: log`, `tier: 3`, `ai_read: false`  
>   Папки `logs/`. **Строгий запрет на массовое чтение.** Архив только для записи и аудита.

---

## 📖 База знаний и Архитектура

> [!info] **Системные документы:**
> - [[Knowledge/index|📚 Каталог предметных знаний (Wiki Index)]]
> - [[docs/DECISIONS|🏛 Принятые архитектурные решения (ADR-001 ... ADR-018)]]
> - [[docs/AI_OS_OPERATIONS|⚙️ Руководство по эксплуатации AI-OS]]
> - [[docs/AI_OS_ARCHITECTURE|🏗 Архитектура системы]]
> - [[docs/AI_OS_SECURITY|🔒 Политика безопасности]]

---

## 🔄 Как устроен цикл совместной работы с ИИ (Handoff Loop)

> [!example] **Единая среда без переспрашивания («Zero Terminal for User»):**
> 1. **Вы (в Obsidian):** Смотрите актуальное состояние, ставите задачи, редактируете заметки.
> 2. **Браузерные чаты (ChatGPT, Claude Web, DeepSeek, Gemini):**
>    - Открываете расширение Atlas Companion -> нажимаете кнопку нужного проекта.
>    - ИИ получает срез `project_state.md` и директиву **не задавать вопросов**, а сразу выполнять шаг.
>    - В конце нажимаете кнопку *«⚡ Заполнить автоматически из чата»* -> отчёт отправляется в GitHub.
> 3. **Локальные оконные приложения (Antigravity IDE & Claude Desktop):**
>    - Работают прямо в папке проекта на ПК через графический интерфейс.
>    - Автоматически считывают `project_state.md` и сами пушат изменения в GitHub.
> 4. **Сквозная синхронизация:** Локальный фоновый синхронизатор (`tools/sync-watch.ps1`) подтягивает внешние изменения за 30 секунд.
