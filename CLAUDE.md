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

## 3. Autonomous Execution Protocol (No "What should I do next?")

1. **Never ask the user technical coordination questions** or "What should I do next?".
2. You act as the lead implementation engineer and systems architect.
3. Determine the required technical steps, implement them, run real tests, verify results, and record progress.

---

## 4. Session Start Protocol (Context Resume — Run by Claude in Background)

When a session starts or the user mentions a project in the desktop chat:
1. In the background, run:
   ```bash
   python second-brain/tools/ai_os.py resume <project>
   ```
   *(Or read `second-brain/Projects/<project>/project_state.md` and run `git -C second-brain pull --rebase origin main`)*
2. Pick up the `next_steps` queue immediately and start implementation in the codebase.
3. Present the user with completed work, not a list of questions.

---

## 5. Session Completion Protocol (Shared Memory Save — Run by Claude in Background)

When completing a task, reaching a milestone, or when conversation context is high:
1. **Never leave work uncommitted.**
2. Silently execute in the background:
   ```bash
   python second-brain/tools/ai_os.py save <project> --agent claude-desktop --summary "<what was implemented & verified>" --next "<next immediate objective>"
   ```
   *(This updates `project_state.md`, creates the session log in `logs/`, and executes `git commit` & `git push origin main`)*
3. Inform the user in the desktop chat that the work is finished and saved to Second Brain.


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
