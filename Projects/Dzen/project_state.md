---
type: memory
tier: 1
ai_read: true
tags:
  - memory
  - moc
  - core
project: "dzen"
status: "active"
updated_at: "2026-10-28T03:49:26.773639Z"
last_agent: "claude"
last_log: "20261028-034926-claude.md"
next_steps: "Если потребуется деплой — ТОЛЬКО через git push + git archive HEAD | ssh nikita-vm /opt/dzen-studio/deploy.sh HEAD@$(git rev-parse --short HEAD). Никогда не собирать .next локально на ПК и переносить вручную (гонка хэшей Prisma-клиента)."
active_blockers: "None"
---

# Project State: Dzen

## Current Objective & Status
- **Last Updated:** 2026-10-28T03:49:26.773639Z by `claude`
- **Recent Progress:** Архитектурное ревью dzen-studio нашло пробел: Dzen не переназначал просроченные публикации, пропавшие из его списков (ни в published, ни в pending) — только слал алерт. По указанию владельца (без "снять с публикации": если статьи нет в обоих списках, она просто откатилась в draft — ставим новую дату тем же путём, что при первой постановке в очередь) реализовано reassignOverdueDraft() в publication-scheduler.ts, плюс dismissKnownOverlays() в getDzenPublicationState (закрывает промо/рекламные оверлеи перед чтением списков Дзена, чтобы не путать "протухло" с перекрытым списком). tsc+build чисто, закоммичено (4bc1ea9, затем доки в 82588b0). ЖИВОЙ ИНЦИДЕНТ: первая попытка деплоя (ручная локальная Windows-сборка .next + scp) уронила прод 500-кой на ~1 мин — Prisma-клиент с хэшированным именем пакета (provider=prisma-client, Prisma 7.9.1) не совпал с node_modules сервера. Откатился на .next.prev мгновенно. Задеплоено ПРАВИЛЬНО через deploy/nikita-vm-deploy.sh (сборка прямо на nikita-vm, HEAD@4bc1ea9, BUILD_ID wyx3jjd-6EDrjYTzpXF_K) — все маршруты 307/200, лог ошибок чист с рестарта.
- **Active Blockers:** None

## Next Steps (Autonomous Queue)
- Если потребуется деплой — ТОЛЬКО через git push + git archive HEAD | ssh nikita-vm /opt/dzen-studio/deploy.sh HEAD@$(git rev-parse --short HEAD). Никогда не собирать .next локально на ПК и переносить вручную (гонка хэшей Prisma-клиента).

## Reference Documents & Links
- Latest session log: `logs/20261028-034926-claude.md`
