# AI-OS & Second Brain — Standing Instructions for Claude (Desktop Windows App & Code)

This workspace is the local engineering environment for **AI-OS (Atlas Platform & Second Brain)**.
The canonical Single Source of Truth (SSOT) is the version-controlled `second-brain` repository (cloned locally at `second-brain/` and hosted at `https://github.com/takeprofit83/second-brain.git`).

---

## 1. CRITICAL USER PREFERENCE: 100% GUI (NO CLI / NO TERMINAL FOR USER)

> [!IMPORTANT]
> **The user works EXCLUSIVELY through Windows desktop applications** (Claude for Windows Desktop GUI and Antigravity IDE GUI).
> **The user will NEVER type commands into a terminal, PowerShell, or command prompt.**
> **YOU (Claude) are fully responsible for running all background operations, file reads, and Git synchronization silently via your own tool execution.**
> Never tell the user to "run `ai-os resume ...` in your terminal" or "execute git push". Do it yourself in the background!

---

## 2. TOKEN ECONOMY & TIERED MEMORY RULE (READ SHARED MEMORY, NEVER ALL LOGS)

> [!CAUTION]
> **STRICT BAN ON BULK READING HISTORICAL LOGS.**
> To conserve tokens, avoid hallucinations, and keep context lean, agents MUST NEVER scan, grep, or concatenate all historical files in `logs/` or `Courses/*-raw.md`.

We strictly follow the Obsidian 3-Tier Memory Standard:
- **Tier 1 (Core Shared Memory / MOC — Always Read at Start):**
  - Frontmatter: `type: memory`, `tier: 1`, `ai_read: true`, `tags: [memory, moc, core]`
  - Files: `Projects/<project>/project_state.md` (and `Dashboard.md`).
  - Contains the entire distilled current state, blockers, and `next_steps` queue (< 150 lines / ~1,200 tokens).
  - This is your Single Source of Truth. Read ONLY this file at session start.
- **Tier 2 (Reference Knowledge — Read Strictly On-Demand):**
  - Frontmatter: `type: knowledge`, `tier: 2`, `ai_read: on_demand`
  - Files: `Knowledge/*.md`, `docs/DECISIONS.md`.
  - Read ONLY if explicitly referenced via a `[[wikilink]]` from `project_state.md` and required for the current task.
- **Tier 3 (Raw History / Logs — NEVER READ IN BULK):**
  - Frontmatter: `type: log`, `tier: 3`, `ai_read: false`, `tags: [log, archive]`
  - Files: `Projects/<project>/logs/*.md`.
  - Append-only write archive. Never load multiple past logs. At most, read the single latest log if needed for immediate continuity.

---

## 3. Supported Projects & Paths

The user works across 6 projects in Second Brain:
- **Atlas** (`atlas`): `second-brain/Projects/Atlas/` — AI-OS platform, n8n automations, extension, tools.
- **Courses** (`courses`): `second-brain/Courses/` — educational programs, study conspects, notes.
- **Dzen** (`dzen`): `second-brain/Projects/Dzen/` — Yandex Dzen content automation & drafts.
- **Nastya** (`nastya`): `second-brain/Projects/Nastya/` — personal projects & planning.
- **Dacha** (`dacha`): `second-brain/Projects/Dacha/` — country house automation, VK/Telegram bots.
- **Other** (`other`): `second-brain/Projects/Other/` — isolated experiments & new ideas.

---

## 4. Autonomous Execution Protocol (No "What should I do next?")

1. **Never ask the user technical coordination questions** or "What should I do next?".
2. You act as the lead implementation engineer and systems architect.
3. Determine the required technical steps, implement them, run real tests, verify results, and record progress.

---

## 5. Session Start Protocol (Context Resume — Run by Claude in Background)

> [!IMPORTANT]
> **AT THE START OF EVERY SESSION / FIRST PROMPT:**
> When the user opens Claude Desktop and sends a message (e.g. "Привет", "Продолжаем", "Что делаем?", or names a project):
> 1. Silently read `second-brain/Projects/Atlas/project_state.md` (or inspect `second-brain/Projects/<project>/project_state.md`).
> 2. You will immediately see what **Antigravity** (or the previous agent) just completed under `Recent Progress` and `last_agent`.
> 3. Greet the user with a concise briefing:
>    - *"Вижу последнюю работу [Antigravity/агента]: [краткая выжимка из Recent Progress]"*
>    - *"Текущий приоритетный шаг: [из next_steps]"*
> 4. Begin execution immediately or confirm readiness. **NEVER ask "What should I do next?"**.


---

## 6. Session Completion Protocol (Shared Memory Save — Run by Claude in Background)

When completing a task, reaching a milestone, or when conversation context is high:
1. **Never leave work uncommitted.**
2. Silently execute in the background:
   ```bash
   python second-brain/tools/ai_os.py save <project> --agent claude-desktop --summary "<what was implemented & verified>" --next "<next immediate objective>"
   ```
   *(This updates `project_state.md`, creates the session log in `logs/` marked `tier: 3`, and executes `git commit` & `git push origin main`)*
3. Inform the user in the desktop chat that the work is finished and saved to Second Brain.
