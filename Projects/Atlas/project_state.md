---
project_id: "atlas"
title: "Atlas AI-OS"
target_goal: "Создание персональной операционной системы ИИ на базе Second Brain и n8n для непрерывного сквозного выполнения задач разными ИИ без потери контекста."
status: "active"
updated_at: "2026-10-23T08:00:00Z"
state_version: "1.0.0"
next_step: "Реализовать воркфлоу обратной записи Atlas - Reverse Save в n8n и внедрить вкладку Report & Save в расширение."
confirmed_facts:
  - fact: "n8n развёрнут на nikita-vm (10.40.40.10) за Nginx Proxy Manager с доменом n8n.neiroclone.ru"
    source: "Infrastructure Audit"
    date: "2026-10-23"
  - fact: "Релей-страница размещена на tangerine-vps (195.19.12.38) в /var/www/html/atlas-relay-d42332f0300f625f.html"
    source: "VPS Check"
    date: "2026-10-23"
  - fact: "Воркфлоу Atlas - Context Resume работает в проде по адресу https://n8n.neiroclone.ru/webhook/atlas-context-resume"
    source: "Live Test"
    date: "2026-10-23"
decisions:
  - id: "ADR-014"
    title: "Внедрение пайплайна Context Resume и браузерного расширения Companion Extension"
    date: "2026-10-23"
    status: "accepted"
open_questions:
  - "Требуется ли перенос статического релея с tangerine-vps на nikita-vm в будущем?"
assumptions:
  - "Все поддерживаемые ИИ (ChatGPT, Claude, Gemini, DeepSeek, Qwen, Kimi) сохранят совместимые DOM-селекторы поля ввода."
constraints:
  - "Не раскрывать сырые секреты и токены в коде и репозитории (использовать [REDACTED] и credentials)."
  - "Не совершать деструктивных действий над существующими рабочими воркфлоу n8n."
current_tasks:
  - "Реализация воркфлоу обратной записи Atlas - Reverse Save (Фаза C/F)"
  - "Интеграция кнопки отправки отчёта в браузерное расширение (Фаза G)"
  - "Активация Wiki Layer в n8n (Фаза D)"
  - "Сквозное тестирование на всех 6 проектах (Фаза M)"
completed_actions:
  - "Проведён полный аудит БД n8n, Second Brain и релей-сервера"
  - "Разработано расширение Atlas Companion Extension Manifest V3"
  - "Создан контракт состояния проектов и шаблоны отчётов"
pending_actions:
  - "Настройка автоматических снапшотов Second Brain в Git"
document_links:
  - "Projects/Atlas/Atlas_Technical_Documentation.md"
  - "Projects/Atlas/Atlas_Project_Log.md"
  - "docs/ARCHITECTURE.md"
  - "docs/DECISIONS.md"
artifacts:
  - "atlas-extension/"
  - "atlas-context-resume.json"
---

# Состояние проекта: Atlas AI-OS (`atlas`)

**Версия состояния:** `1.0.0`  
**Дата актуализации:** `2026-10-23T08:00:00Z`  
**Статус:** `active`  

---

## 1. Главная цель
Создание персональной операционной системы ИИ на базе Second Brain и n8n для непрерывного сквозного выполнения задач разными ИИ без потери контекста.

## 2. Актуальный Handoff
Реализован и подтверждён контекстный резолвер Фазы 1: браузерное расширение и релей передают снимок проекта в ChatGPT, Claude, DeepSeek, Gemini, Qwen, Kimi с возможностью мгновенной вставки в DOM чата. Переходим к реализации обратного цикла (Reverse Save): воркфлоу n8n для приёма структурированного отчёта ИИ и обновления состояния в Second Brain.

## 3. Следующий шаг
Реализовать воркфлоу обратной записи `Atlas - Reverse Save` в n8n и внедрить вкладку Report & Save в расширение.
