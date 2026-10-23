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
- `project_state.md`: Single Source of Truth for current status and `next_steps` (Tier 1 Memory).
- `logs/`: Timestamped execution history (Tier 3 Archive).

---

## 2. TOKEN ECONOMY & TIERED MEMORY RULE

> [!CAUTION]
> **STRICT BAN ON BULK LOG READING.**
> Agents must NEVER scan or read all historical session logs in `logs/` or `Courses/*-raw.md`.

We use the Obsidian 3-Tier Memory Model:
- **Tier 1 (Core Memory / MOC — Always Read):**
  - Properties: `type: memory`, `tier: 1`, `ai_read: true`, `tags: [memory, moc, core]`
  - Target: `Projects/<project>/project_state.md` (< 150 lines / ~1,200 tokens).
  - Contains distilled state, blockers, and next steps.
- **Tier 2 (Reference Knowledge — On Demand):**
  - Properties: `type: knowledge`, `tier: 2`, `ai_read: on_demand`
  - Target: `Knowledge/*.md`, `docs/DECISIONS.md`.
  - Read ONLY if linked via `[[wikilink]]` and required for the task.
- **Tier 3 (Logs Archive — Never Read in Bulk):**
  - Properties: `type: log`, `tier: 3`, `ai_read: false`, `tags: [log, archive]`
  - Target: `Projects/<project>/logs/*.md`.
  - Append-only archive. Never inject into prompt.

---

## 3. Universal Protocol for All Agents (Zero Terminal for User)

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
