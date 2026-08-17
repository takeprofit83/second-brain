# Atlas Wiki Layer — готовые n8n-воркфлоу

Три файла, каждый — самостоятельный воркфлоу в стандартном формате экспорта n8n, готов к `Import from File` (n8n UI → Workflows → ⋮ → Import from File). Полный архитектурный контекст: `Atlas_Technical_Documentation.md` §35, `docs/DECISIONS.md` ADR-012/013.

- `atlas-wiki-ingest.json` — вебхук, разбирает новый конспект по странице `Knowledge/<slug>.md` + обновляет `index.md`/`log.md`.
- `atlas-wiki-query.json` — вебхук, отвечает на вопрос по контексту `Knowledge/index.md`. Закрывает §17 (Context-loader).
- `atlas-wiki-lint.json` — по крону (04:00 ежедневно), сверяет `index.md` со списком файлов в `Knowledge/`. Без единого LLM-вызова — чистое сравнение строк.

## Шаги после импорта каждого файла

1. **Credentials.** У каждой ноды с `"id": "REPLACE_ME"` в блоке `credentials` — открыть ноду и выбрать реальный credential:
   - GitHub-ноды (`HTTP Request` к `api.github.com` и все `GitHub`-ноды) → тот же credential, что уже используют `Create a file`/`Edit a file` в `Atlas - Kie Adapter` и `Atlas - Docs Sync`.
   - `Webhook` в Ingest/Query → новый Header Auth credential (Settings → Credentials → New → Header Auth), имя произвольное, значение — новый секрет (не переиспользуйте `atlas docs sync secret`/`atlas capture secret`, заведите отдельные, как и остальные вебхуки в проекте).
2. **Активировать** каждый воркфлоу (Active-переключатель) — так же, как `Atlas-Polza Adapter Core` в своё время не заработал с первого раза именно из-за этого (§32).
3. **Execute Workflow ноды** ("Call Wiki Ingest LLM", "Call Wiki Query LLM") — открыть и проверить, что маппинг полей (`user_input`/`system_prompt`/`model`) подтянулся. В этом проекте уже дважды ловили баг, когда n8n не обновляет схему сама (§32, "Execute Workflow node's input-schema auto-sync can get stuck") — если поля не видны, обновить через `⋮ → Refresh Input List` или, если и это не поможет, тем же способом через API, что и раньше.

## Что не проверено (нужна проверка на первом реальном запуске)

- **`authentication: predefinedCredentialType, nodeCredentialType: githubApi` в ноде `HTTP Request`** — используется во всех «Get/List»-нодах. §33 в своё время пометил это как untested для одного конкретного случая; здесь применено систематически. Если нода откажется принимать `githubApi` credential, замените на `Generic Credential Type → Header Auth` с заголовком `Authorization: Bearer <GitHub PAT>` (тот же обходной путь, что уже использован для Kie-адаптера, §7).
- **`response.response.fullResponse: true` + `neverError: true`** — расчёт на то, что в ответе будет `{statusCode, headers, body}` и 404 не уронит выполнение. Формат стабильный в n8n уже давно, но не проверялся вживую в этом проекте — если разойдётся, поправить пути `$json.body.content` / `$json.statusCode` в соответствующих `Code`-нодах.
- **Первый запуск Ingest на реальный конспект** покажет, устраивает ли качество ответа модели (структура JSON, адекватность `page_path`/`slug`) — при необходимости подправить `system_prompt` внутри ноды `Call Wiki Ingest LLM`, как делали с промптами конспектирования (§34, три итерации доводки).

## Ручной тест без реального конспекта

`Atlas - Wiki Ingest`:
```bash
curl -X POST https://n8n.neiroclone.ru/webhook/atlas-wiki-ingest \
  -H "Content-Type: application/json" \
  -H "X-Atlas-Secret: <новый секрет>" \
  -d '{"content":"Тестовый конспект про настройку n8n на Docker.","source_path":"manual-test"}'
```

`Atlas - Wiki Query`:
```bash
curl -X POST https://n8n.neiroclone.ru/webhook/atlas-wiki-query \
  -H "Content-Type: application/json" \
  -H "X-Atlas-Secret: <новый секрет>" \
  -d '{"question":"Что такое Atlas?"}'
```

`Atlas - Wiki Lint` — сработает по расписанию, либо запустить вручную кнопкой "Test workflow" в n8n UI.
