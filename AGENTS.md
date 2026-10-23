# AI-OS & Second Brain — Universal Agent Guidelines (AGENTS.md)

This workspace is connected to **Second Brain (AI-OS)**.
All AI agents (Claude Code, Antigravity, Cursor, Windsurf, Aider, Codex, ChatGPT, Claude Web, Gemini Web, DeepSeek, Qwen, Kimi) operate on a shared memory substrate stored in `second-brain/` and version-controlled via GitHub (`https://github.com/takeprofit83/second-brain.git`).

---

## 1. Projects Structure
- `second-brain/Projects/Atlas/` — AI-OS core platform & tools
- `second-brain/Courses/` — Courses & educational conspects
- `second-brain/Projects/Dzen/` — Yandex Dzen pipeline & drafts
- `second-brain/Projects/Nastya/` — Personal planning
- `second-brain/Projects/Dacha/` — Smart country house & bots
- `second-brain/Projects/Other/` — Experimental sandbox

Each project is governed by:
- `project_state.md`: Single Source of Truth for current status and `next_steps`.
- `logs/`: Timestamped execution history.

---

## 2. Universal Protocol for All Agents (Zero Terminal for User)

> [!IMPORTANT]
> The user works 100% inside Windows Desktop Applications (Antigravity IDE & Claude Desktop). The user NEVER touches a terminal or CLI.
> All commands and synchronizations are executed exclusively by the AI agents in the background.

### Step 1: Resume Context at Session Start
Run in background:
```bash
python second-brain/tools/ai_os.py resume <project>
```
Review the returned state and next steps. Do NOT ask the user "what should I do next?". Proceed directly with implementation.

### Step 2: Implement & Test
Work directly inside the codebase. Run automated tests, verify functionality, and handle edge cases.

### Step 3: Record Work at Session End
Run in background:
```bash
python second-brain/tools/ai_os.py save <project> --agent <agent_name> --summary "<what was done>" --next "<next step>"
```
This updates `project_state.md`, creates a session log in `logs/`, and pushes the commit to GitHub so all other agents and Obsidian immediately stay in sync.
