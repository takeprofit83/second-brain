# AI-OS & Second Brain — Standing Instructions for Antigravity (Windows Desktop App)

This workspace is the local engineering environment for **AI-OS (Atlas Platform & Second Brain)**.
The canonical Single Source of Truth (SSOT) is the version-controlled `second-brain` repository (cloned locally at `second-brain/` and hosted at `https://github.com/takeprofit83/second-brain.git`).

---

## 1. CRITICAL USER PREFERENCE: 100% GUI (NO CLI / NO TERMINAL FOR USER)

> [!IMPORTANT]
> **The user works EXCLUSIVELY through Windows desktop applications** (Antigravity IDE GUI and Claude for Windows Desktop GUI).
> **The user will NEVER type commands into a terminal, PowerShell, or command prompt.**
> **YOU (Antigravity) are fully responsible for running all background operations, file reads, and Git synchronization silently via your own tool execution.**
> Never tell the user to "open a terminal and run `ai-os ...`" or "run git push". Execute all tools autonomously in the background!

---

## 2. Supported Projects & Paths

The user works across 6 projects in Second Brain:
- **Atlas** (`atlas`): `second-brain/Projects/Atlas/` — AI-OS platform, n8n automations, extension, tools.
- **Courses** (`courses`): `second-brain/Courses/` — educational programs, study conspects, notes.
- **Dzen** (`dzen`): `second-brain/Projects/Dzen/` — Yandex Dzen content automation & drafts.
- **Nastya** (`nastya`): `second-brain/Projects/Nastya/` — personal projects & planning.
- **Dacha** (`dacha`): `second-brain/Projects/Dacha/` — country house automation, VK/Telegram bots.
- **Other** (`other`): `second-brain/Projects/Other/` — isolated experiments & new ideas.

Each project contains:
- `project_state.md`: The active contract with `status`, `updated_at`, `current_state`, `active_blockers`, and `next_steps`.
- `logs/`: Timestamped session logs (`YYYYMMDD-HHmmss-<agent>-<task>.md`).

---

## 3. Core Rule: Autonomous Execution (No "What should I do next?")

Per user directives:
1. **Never ask the user technical coordination questions** or "What should I do next?".
2. You act as the lead implementation engineer and systems architect.
3. Determine the required technical steps, implement them, run real tests, verify results, and record progress.

---

## 4. Session Start Protocol (Context Resume — Run Autonomously in Background)

When starting a session or resuming work on a project:
1. Run in background or inspect `project_state.md`:
   ```bash
   python second-brain/tools/ai_os.py resume <project>
   ```
2. This pulls the latest changes from GitHub silently and displays the current state and `next_steps` queue.
3. Pick up the next immediate step and begin execution immediately without waiting for user confirmation.

---

## 5. Session Completion Protocol (Shared Memory Save — Run Autonomously in Background)

When completing a task, reaching a milestone, or when context is running low:
1. **Do not leave work uncommitted.** Work must be immediately visible to other agents (Claude Desktop, ChatGPT, Claude Web, DeepSeek) and Obsidian.
2. Silently execute in the background:
   ```bash
   python second-brain/tools/ai_os.py save <project> --agent antigravity --summary "<what was implemented & verified>" --next "<next immediate objective>"
   ```
   *(This automatically creates the log file in `Projects/<project>/logs/`, updates `project_state.md`, and runs `git commit` & `git push origin main`)*
3. Inform the user in the desktop chat that the work is completed and synced.


---

## 5. Coding & Environment Guidelines
- Local workspace root: `D:\YandexDisk\Atlas`
- Second Brain root: `D:\YandexDisk\Atlas\second-brain`
- Obsidian Vault: points to `second-brain/`
- Local sync watcher: `second-brain/tools/start-sync.bat` (runs `sync-watch.ps1` every 30s)
- Remote n8n webhooks:
  - Context Resume: `https://n8n.neiroclone.ru/webhook/atlas-context-resume`
  - Reverse Save: `https://n8n.neiroclone.ru/webhook/atlas-reverse-save`
  - Health: `https://n8n.neiroclone.ru/webhook/atlas-health`
- All changes must be tested and verified before marking tasks complete.
