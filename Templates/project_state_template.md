---
project_id: "{{project_id}}"
title: "{{title}}"
target_goal: "{{target_goal}}"
status: "{{status}}"
updated_at: "{{updated_at}}"
state_version: "{{state_version}}"
next_step: "{{next_step}}"
confirmed_facts: []
decisions: []
open_questions: []
assumptions: []
constraints: []
current_tasks: []
completed_actions: []
pending_actions: []
document_links: []
artifacts: []
---

# Состояние проекта: {{title}} (`{{project_id}}`)

**Версия состояния:** `{{state_version}}`  
**Дата актуализации:** `{{updated_at}}`  
**Статус:** `{{status}}`  

---

## 1. Главная цель (Target Goal)
{{target_goal}}

## 2. Актуальный Handoff (Краткий контекст для следующего ИИ)
{{handoff_summary}}

## 3. Следующий конкретный шаг (Next Step)
{{next_step}}

## 4. Подтверждённые факты (Confirmed Facts)
- (список фактов с источником и датой)

## 5. Принятые решения (Decisions)
- (список решений / ADR)

## 6. Действующие ограничения и запреты (Constraints)
- (список ограничений)

## 7. Текущие задачи и статус (Tasks)
- [ ] (активные задачи)
- [x] (выполненные задачи)

## 8. Открытые вопросы (Open Questions)
- (нерешённые вопросы)

## 9. Ключевые документы и артефакты
- [Документация](file)
