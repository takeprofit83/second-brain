# AI-OS & Second Brain — Universal Agent Guidelines (AGENTS.md)

This repository is the canonical Single Source of Truth for **Second Brain (AI-OS)**.
All AI agents (Claude Code, Antigravity, Cursor, Windsurf, Aider, Codex, ChatGPT, Claude Web, Gemini Web, DeepSeek, Qwen, Kimi) operate on this shared memory substrate.

---

## 1. Projects Structure
- `Projects/Atlas/` — AI-OS core platform & tools
- `Courses/` — Courses & educational conspects
- `Projects/Dzen/` — Yandex Dzen pipeline & drafts
- `Projects/Nastya/` — Personal planning
- `Projects/Dacha/` — Smart country house & bots
- `Projects/Other/` — Experimental sandbox

Each project is governed by:
- `project_state.md`: Single Source of Truth for current status and `next_steps`.
- `logs/`: Timestamped execution history.

---

## 2. Universal Protocol for All Agents

### Step 1: Resume Context at Session Start
Run:
```bash
python tools/ai_os.py resume <project>
```
Review the returned state and next steps. Do NOT ask the user "what should I do next?". Proceed directly with implementation.

### Step 2: Implement & Test
Work directly inside the codebase. Run automated tests, verify functionality, and handle edge cases.

### Step 3: Record Work at Session End
Run:
```bash
python tools/ai_os.py save <project> --agent <agent_name> --summary "<what was done>" --next "<next step>"
```
This updates `project_state.md`, creates a session log in `logs/`, and pushes the commit to GitHub so all other agents and Obsidian immediately stay in sync.
