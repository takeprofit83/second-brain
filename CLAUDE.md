# AI-OS & Second Brain — Standing Instructions for Claude Code

This repository is the canonical Single Source of Truth (SSOT) for **Second Brain & AI-OS**, version-controlled via GitHub (`takeprofit83/second-brain`).

---

## 1. Supported Projects & Paths

The user works across 6 projects in Second Brain:
- **Atlas** (`atlas`): `Projects/Atlas/` — AI-OS platform, n8n automations, extension, tools.
- **Courses** (`courses`): `Courses/` — educational programs, study conspects, notes.
- **Dzen** (`dzen`): `Projects/Dzen/` — Yandex Dzen content automation & drafts.
- **Nastya** (`nastya`): `Projects/Nastya/` — personal projects & planning.
- **Dacha** (`dacha`): `Projects/Dacha/` — country house automation, VK/Telegram bots.
- **Other** (`other`): `Projects/Other/` — isolated experiments & new ideas.

Each project contains:
- `project_state.md`: The active contract with `status`, `updated_at`, `current_state`, `active_blockers`, and `next_steps`.
- `logs/`: Timestamped session logs (`YYYYMMDD-HHmmss-<agent>-<task>.md`).

---

## 2. Core Rule: Autonomous Execution (No "What should I do next?")

Per user directives:
1. **Never ask the user technical coordination questions** or "What should I do next?".
2. You act as the lead implementation engineer and systems architect.
3. Determine the required technical steps, implement them, run real tests, verify results, and record progress.

---

## 3. Session Start Protocol (Context Resume)

When starting a session or resuming work on a project:
1. Run the AI-OS CLI tool or check `project_state.md`:
   ```bash
   python tools/ai_os.py resume <project>
   ```
2. This automatically executes `git pull` from GitHub and displays the current state, latest log highlights, and the `next_steps` queue.
3. Pick up the next immediate step and begin execution immediately without waiting for confirmation.

---

## 4. Session Completion Protocol (Shared Memory Save)

When completing a task, reaching a milestone, or when context is running low:
1. **Do not leave work uncommitted.** Work must be immediately visible to other agents (Antigravity, ChatGPT, Claude Web, Gemini Web) and Obsidian.
2. Update the project state and save the session log using:
   ```bash
   python tools/ai_os.py save <project> --agent claude-code --summary "<what was implemented & verified>" --next "<next immediate objective>"
   ```
   *(This automatically creates the log file in `Projects/<project>/logs/`, updates `project_state.md`, and runs `git commit` & `git push origin main`)*
3. Alternatively, you may edit `project_state.md` directly, write the log file, and commit/push via `git commit -m "..." && git push origin main`.
