> Historical context, superseded by verified reservation release.

---
type: memory
tier: 1
ai_read: true
project: dzen
status: active
last_agent: codex-architect
last_log: "20261031-atomic-deploy-9a879e7-context-before.md"
next_steps: "Довести recovery/reconciliation и PG-проверку резервирования, затем отдельный малый выкат."
---

# Дзен Автор — актуальный handoff, 2026-10-31

## Источник фактов

Репозиторий `D:\YandexDisk\Content fabric\Dzen`. Сначала читать AGENTS.md и верхний раздел CURRENT_STATE.md; PROJECT_GUIDE.md §0 — датированная история. Сверять git status/diff перед записью.

## Проверенный выкат 2026-10-31: атомарное начисление стелл

На nikita-vm штатным deploy.sh выкачен код **9a879e7**, BUILD_ID **yKJ2XBeANTASeLxe5aOnW**. Архив передан бинарным git archive HEAD → ssh через Python pipe, локальной сборки не было. Схема/миграции не менялись.

Перед выкатом: npm test284/284 pass, TypeScript exit0, точечный ESLint pass. После: /login200; /analytics,/maintenance,/calendar,/stellas307 (штатный редирект авторизации); dzen-studio online; остальные9 PM2-процессов online; новых строк в error-log приложения0. SHA256 stella-payment helper, двух платёжных маршрутов и stella-pool совпали с коммитом. Это проверка кода/здоровья, не реальная тестовая оплата или доказательство всех live-сценариев. Старые спорные processed-маркеры не переигрывались.

Резерв checkout НЕ выкачен и НЕ находится в текущем исходном дереве. Его patch и полные копии: C:\Users\takep\Documents\Codex\2026-10-31\new-chat\outputs\reservation-next-package. git apply --check incremental patch после выделения atomic-пакета прошёл. Следующий шаг — отдельно довести reconciliation зависших резервов и PostgreSQL concurrency-проверку, затем следующий малый выкат.

Предыдущие записи «локально/не выкачено» ниже являются историей до этого релиза. Финансовые ограничения R05/R08, proxy provisioning и оставшиеся writers стелл сохраняются.


## Уже сделано

Предыдущий выкат f3e487c: защита платежей/tenant, известных исторических контрактов, GET балансов, agency pending+hook, CAS helpers, анкета и общий test runner. Новый9a879e7: атомарные marker/credit/hold/cache во всех3 путях начисления стелл. Не повторять эти задачи по архивам.

## Ограничения

«Ламповые истории» cmtrv0vg40003ld9rxv3lpxid: не менять ToV/промпты/стиль и не делать тестовые генерации. Локальная .next запрещена, выкат только deploy.sh; не останавливать чужие сервисы. Секреты не выводить. Старые оплаты не переигрывать без разбора.

## Работа и лимиты

Главный чат архитектора 01a18f25-6d4e-7791-88eb-235c03df5008. Экономный режим: один узкий пакет, без новых исполнителей без команды пользователя, без повторных широких аудитов. Следующий резерв-пакет находится в outputs, не в рабочем коде. Старые handoff на combined atomic+reserve отменены новым разделением.

Atlas локальный CLI/MCP resume исправлен; автоматическая доставка в GitHub и межагентный serialized save ещё не готовы. Эту карточку локально обновили без sync/push Atlas.
