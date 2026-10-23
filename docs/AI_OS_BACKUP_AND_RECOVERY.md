# AI-OS Backup & Disaster Recovery Guide (Резервное копирование и план восстановления)

**Версия:** 1.0  
**Дата:** 2026-10-23  
**Статус:** Утверждённый эксплуатационный регламент  

---

## 1. Стратегия резервного копирования

Архитектура AI-OS использует многоуровневую модель репликации и хранения:

1. **База знаний (Second Brain):**
   - **Уровень 1 (Облачный Git):** Удалённый репозиторий GitHub (`takeprofit83/second-brain`). Полная история коммитов, веток и тегов.
   - **Уровень 2 (Локальная реплика):** Локальная папка `D:\YandexDisk\Atlas\second-brain`, синхронизируемая с Яндекс Диском.
   - **RPO (Recovery Point Objective):** 0 минут (каждое сохранение отчёта создаёт коммит в GitHub).
   - **RTO (Recovery Time Objective):** < 2 минут (`git clone` на любую машину).

2. **Конфигурация n8n и база данных:**
   - База PostgreSQL `n8n` на `nikita-vm`.
   - Экспортированные JSON-файлы всех активных воркфлоу хранятся в `second-brain/Projects/Atlas/tools/` и версионируются в Git.

3. **Релей-сервер (`tangerine-vps`):**
   - Файл `/var/www/html/atlas-relay-d42332f0300f625f.html` зеркалируется в `second-brain/Projects/Atlas/tools/atlas-relay-page.html`.
   - Резервная копия на сервере: `/var/www/html/atlas-relay-d42332f0300f625f.html.bak`.

---

## 2. Сценарии восстановления при сбоях (Disaster Recovery Procedures)

### Сценарий 1: Случайное удаление или порча файлов в Second Brain
1. Перейдите в каталог репозитория: `cd D:\YandexDisk\Atlas\second-brain`.
2. Проверьте последние коммиты: `git log -n 5 --oneline`.
3. Если требуется откатить один файл:
   ```bash
   git checkout HEAD~1 -- path/to/file.md
   git commit -m "fix: restore file from previous commit"
   git push origin main
   ```
4. Если требуется откатить рабочую копию к состоянию GitHub:
   ```bash
   git fetch origin
   git reset --hard origin/main
   ```

### Сценарий 2: Сбой или перезагрузка контейнера n8n
Если вебхуки перестали отвечать:
1. Подключитесь к серверу: `ssh nikita-vm`.
2. Проверьте состояние контейнера: `docker ps -a | grep n8n`.
3. Перезапустите контейнер: `docker restart n8n`.
4. Проверьте логи старта: `docker logs n8n --tail 25`.
5. Все вебхуки автоматически перерегистрируются из таблицы `webhook_entity` при старте.

### Сценарий 3: Полная потеря сервера `nikita-vm` (развёртывание с нуля)
1. На новом сервере установите Docker и Docker Compose.
2. Запустите PostgreSQL 17 и n8n с указанием переменных окружения.
3. Клонируйте репозиторий: `git clone https://github.com/takeprofit83/second-brain.git`.
4. Импортируйте воркфлоу из папки `second-brain/Projects/Atlas/tools/`:
   - `atlas-context-resume.json`
   - `atlas-reverse-save.json`
   - `atlas-wiki-query.json`
   - `atlas-wiki-ingest.json`
5. Настройте credentials (GitHub Token и Header Secret).
6. Активируйте воркфлоу.

### Сценарий 4: Сбой релей-сервера (`tangerine-vps`)
1. Подключитесь: `ssh tangerine-vps`.
2. Восстановите страницу из бэкапа:
   ```bash
   cp /var/www/html/atlas-relay-d42332f0300f625f.html.bak /var/www/html/atlas-relay-d42332f0300f625f.html
   ```
3. Либо разверните актуальную версию из локального репозитория:
   ```powershell
   $bytes = [IO.File]::ReadAllBytes("D:\YandexDisk\Atlas\atlas-relay-page.html")
   [Convert]::ToBase64String($bytes) | ssh tangerine-vps "base64 -d > /var/www/html/atlas-relay-d42332f0300f625f.html"
   ```
