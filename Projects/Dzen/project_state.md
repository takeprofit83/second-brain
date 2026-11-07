---
type: memory
tier: 1
ai_read: true
project: dzen
status: active
last_agent: "Antigravity"
last_log: "20261107-091633-antigravity-7dce3f038d3d4fd4948d01a6f92b0774.md"
next_steps: "Maintain 3 publications per day cadence and monitor zero-duplicate background GC."
updated_at: "2026-11-07T09:16:33.314146Z"
active_blockers: "None"
---

# Дзен Автор — актуальный handoff 2026-11-06

Код `D:\YandexDisk\Content fabric\Dzen`. Читать `AGENTS.md`, верх `CURRENT_STATE.md`, `PROJECT_GUIDE.md` §0 и концептуальный документ `ARCHITECTURE_ZERO_TOUCH_AND_AUTONOMY.md`.

## Проверенный выкат: Этап 1 Zero-Touch Ops для Стелл, предохранитель и авто-диагностика — 2026-11-06

Код **15284cb**, BUILD_ID **s5TMWK4MAGFaJYer_2RQc**, deploy.sh exit 0.
1) **Устранение блокировки кликов в Дзене (`stella-planner.ts`):** Из селекторов подавления рекламы удалены корневые контейнеры верстки статей Дзена (`DzenLayoutMicroApp`, `SECOND_CHUNK`), отключение которых блокировало дочерние клики. Для кнопки реакции принудительно задан `pointerEvents = "auto"`, клик переведён на нативный вызов DOM `btn.click()` без паразитного двойного клика Playwright.
2) **Верификация состояния и авто-скриншоты (`stella-action-result.ts`):** Операция считается успешной только при реальном изменении счётчика статьи в Дзене или баланса читателя. При сбое автоматически сохраняется диагностический снимок страницы (`/tmp/stella-failure-*.png`).
3) **Предохранитель (Circuit Breaker) против зацикливания (`stellaBatchMustPause`):** При первом же неподтверждённом действии автопростановка мгновенно прерывается (`paused: true`), сохраняя очередь и не совершая холостых попыток по остальным статьям.
4) **Спокойные статусы в UI (`StellaBoard.tsx`):** Вместо гирлянды красных окон в интерфейсе выводится мягкая янтарная плашка `attentionToast`: *«Автопростановка приостановлена после первой ошибки. Очередь сохранена для диагностики»*.
5) **Проверки:** 449/449 unit-тестов pass, TypeScript `tsc --noEmit` exit 0, `/login` 200 OK, PM2 0 ошибок.

## Свежие проверенные выкаты (2026-11-06)

* **780ee66 (BUILD_ID 33efKDwGWeAPFIMkl4N0x):** Устранение сквозного показа у админа (`db.ts`, `proxy.ts`). На контентных разделах (`/library`, `/calendar`, `/`) админ изолирован к `activeTenantId` (`tenant_owner`), счётчик медиатеки считает только свои статьи (34 вместо 182). Сквозной доступ (`bypass: true`) сохранён строго для системных маршрутов (`/admin`, `/maintenance`, `/api/admin/*`, `/api/clients/*`). Режим «Войти под клиентом» работает штатно.
* **e845de9 (BUILD_ID DxFPlJsm1y-Ydn-1EQ-ZD):** Устранение сетевых сбоев Reader Bot (`safe_goto` с ретраями на `domcontentloaded` против сбросов рекламы ADFOX, дедупликация логов и алертов).
* **1f480e8 (BUILD_ID opr6LFWlf6d6rvcqmwN2t):** Управление уведомлениями в колокольчике («Очистить всё», крестики `X` скрытия, фильтр последних 24 часов).

## Архитектурный фокус: Zero-Touch Ops
Подробное техническое задание на построение автономного надзирателя (Watchdog / Reconciler), изоляцию очередей публикаций и единую шину инцидентов зафиксировано в файле `ARCHITECTURE_ZERO_TOUCH_AND_AUTONOMY.md`.

## Ограничения и режим

«Ламповые истории» cmtrv0vg40003ld9rxv3lpxid: строго защищен — не менять ToV/промпты/стиль, не делать тестовые генерации или сбросы. UI-функции сохранять (обратная совместимость 100%). Локальная .next запрещена; сборка/выкат только серверным deploy.sh на nikita-vm.
