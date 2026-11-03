> Historical context superseded by verified pool aggregate release.

---
type: memory
tier: 1
ai_read: true
project: dzen
status: active
last_agent: codex-architect
last_log: "20261031-reader-47afd98-context-before.md"
next_steps: "Убрать устаревающий агрегат pool-cache; не менять external browser reserve в том же пакете."
---

# Дзен Автор — актуальный handoff 2026-10-31

Репозиторий D:\YandexDisk\Content fabric\Dzen; читать AGENTS.md и верх CURRENT_STATE.md, проверять git status/diff перед записью.

## Проверенный малый выкат reader snapshot — 2026-10-31

Код **47afd98**, BUILD_ID **MpBYfaJ_DRwIeC7vaTMtx**, deploy.sh exit0. Reader ledger value/revision сравниваются с захваченными ДО browser I/O. Уже изменённый ledger не перезаписывается старым snapshot; конфликт возвращает текущее число, не старое прочитанное. Debit читателя/revision/cache invalidation атомарны; rollback revision failure не оставляет частичный баланс. При null/error чтения также перечитывается актуальный ledger. Browser read входит в существующую process-local очередь по profile.path.

Проверки:336/336 tests pass, TypeScript exit0, lint новых helper/test pass.12 nativePG+Prisma checks в отдельном временном Docker-контейнере прошли (4новых reader cases,8старых inventory/exact). Контейнер удалён, реальные Dzen/browser/payment и боевые БД в тестах не использовались. После: /login200, protected routes307, все9 PM2 online, новых строк error-log0;14 source hashes совпали с ПРИВЯЗАННЫМ коммитом47afd98, включая неизменённый календарь. Схема не менялась.

Граница: не закрыта пауза между внешним эффектом и ещё не выполненным локальным debit, источник может отдавать устаревшие физические данные; distributed operation reserve и exactly-once внешней простановки не реализованы. Общий агрегатный cache может публиковаться устаревшим in-flight пересчётом. Следующий узкий шаг — убрать этот устаревающий агрегат, сохранив чтение reader ledger из DB без лишних browser-вызовов. Полные R04/R05 не объявлять закрытыми.


## Уже выкачено

9a879e7 — atomic credit;851b3ef — checkout hold/recovery/resume;51b2b98 — safe setExact;00a2f24 — отдельно одобренные стили кнопок календаря;47afd98 сохраняет их все. Не повторять архивные задачи.

## Ограничения и режим

«Ламповые истории» cmtrv0vg40003ld9rxv3lpxid неприкосновенны: промпты/ToV/стиль/тестовые генерации не трогать. UI-функции сохранять. Локальная .next запрещена; выкат только серверным deploy.sh, чужие сервисы не останавливать, секреты не выводить.

Экономно: один узкий пакет, без новых исполнителей без команды пользователя; малые проверенные выкаты разрешены. Главный чат01a18f25-6d4e-7791-88eb-235c03df5008. Atlas локальный resume исправлен, автоматическая remote доставка/serialized-save отдельно не завершены. Старые processed оплаты не переигрывать; неизвестные durable резервы сохранять до подтверждённого статуса/review.
