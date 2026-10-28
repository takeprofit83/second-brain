#!/usr/bin/env python3
"""
AI-OS Local Agent Bridge (ai_os.py)
-----------------------------------
Unified CLI tool for local AI agents (Claude Code, Antigravity, Cursor, etc.)
and the user to seamlessly interact with Second Brain.

Commands:
  python ai_os.py status
  python ai_os.py resume <project>
  python ai_os.py save <project> --agent <name> --summary <text> --next <text> [--blockers <text>]
  python ai_os.py sync
"""

import os
import sys
import argparse
import datetime
import json
import re
import subprocess
from pathlib import Path

# Force UTF-8 encoding on Windows standard streams
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Paths configuration
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent  # second-brain folder
PROJECTS_DIR = REPO_ROOT / "Projects"
COURSES_DIR = REPO_ROOT / "Courses"

PROJECT_MAP = {
    "atlas": PROJECTS_DIR / "Atlas",
    "courses": COURSES_DIR,
    "dzen": PROJECTS_DIR / "Dzen",
    "nastya": PROJECTS_DIR / "Nastya",
    "dacha": PROJECTS_DIR / "Dacha",
    "other": PROJECTS_DIR / "Other",
}


def run_git(args, cwd=REPO_ROOT):
    """Run a git command in the repository."""
    cmd = ["git"] + args
    try:
        res = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=False,
            encoding="utf-8"
        )
        return res.returncode == 0, res.stdout.strip(), res.stderr.strip()
    except Exception as e:
        return False, "", str(e)


def resolve_project_path(project_name: str) -> Path:
    norm = project_name.lower().strip()
    if norm in PROJECT_MAP:
        return PROJECT_MAP[norm]
    # Check case-insensitive match inside Projects/
    for p in PROJECTS_DIR.iterdir():
        if p.is_dir() and p.name.lower() == norm:
            return p
    return PROJECTS_DIR / project_name


def parse_state_file(state_file: Path) -> dict:
    if not state_file.exists():
        return {}
    content = state_file.read_text(encoding="utf-8")
    
    # Simple YAML frontmatter parser
    data = {"content": content, "raw": content}
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            fm_text = parts[1]
            data["body"] = parts[2].strip()
            for line in fm_text.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if ":" in line:
                    k, v = line.split(":", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    data[k] = v
    return data


def cmd_status(args):
    """Display status of all projects in Second Brain."""
    print("=" * 70)
    print(" AI-OS / Second Brain — Projects Overview")
    print("=" * 70)
    
    for name, path in PROJECT_MAP.items():
        state_file = path / "project_state.md"
        if not state_file.exists():
            print(f"[{name.upper()}] - No project_state.md found at {path.name}")
            continue
        
        info = parse_state_file(state_file)
        status = info.get("status", "unknown").upper()
        updated = info.get("updated_at", info.get("last_updated", "unknown"))
        next_step = info.get("next_step", info.get("next_steps", "None"))
        
        print(f"• {name.upper():<8} | Status: {status:<10} | Updated: {updated}")
        if next_step and next_step != "None":
            # truncate if too long
            ns_display = next_step.replace("\n", " ")
            if len(ns_display) > 85:
                ns_display = ns_display[:82] + "..."
            print(f"  Next: {ns_display}")
        print("-" * 70)


def cmd_resume(args):
    """Pull remote updates and display the execution context for a project."""
    project_key = args.project.lower().strip()
    proj_dir = resolve_project_path(project_key)
    state_file = proj_dir / "project_state.md"
    
    if not proj_dir.exists() or not state_file.exists():
        print(f"ERROR: Project state file not found for '{project_key}' at {state_file}")
        sys.exit(1)
        
    # Optional git pull
    if not args.no_pull:
        print("[AI-OS] Pulling latest changes from remote Git repository...", file=sys.stderr)
        ok, out, err = run_git(["pull", "--rebase", "origin", "main"])
        if not ok:
            print(f"[AI-OS WARNING] Git pull failed: {err}. Using local state.", file=sys.stderr)
        else:
            print("[AI-OS] Second Brain is up to date.", file=sys.stderr)

    info = parse_state_file(state_file)
    
    # Locate latest log file
    logs_dir = proj_dir / "logs" if (proj_dir / "logs").exists() else proj_dir
    log_files = sorted(
        [f for f in logs_dir.glob("*.md") if f.name != "project_state.md"],
        key=lambda x: x.name,
        reverse=True
    )
    latest_log_name = log_files[0].name if log_files else "None"
    latest_log_snippet = ""
    if log_files:
        try:
            log_text = log_files[0].read_text(encoding="utf-8")
            # Grab first 800 chars
            lines = log_text.splitlines()[:25]
            latest_log_snippet = "\n".join(lines)
        except Exception:
            pass

    # Render Autonomous Execution Context Block
    print("=" * 80)
    print(f" AI-OS CONTEXT HANDOFF: PROJECT '{project_key.upper()}'")
    print("=" * 80)
    print(f"Project Root: {proj_dir}")
    print(f"Last Updated: {info.get('updated_at', info.get('last_updated', 'unknown'))}")
    print(f"Status:       {info.get('status', 'active')}")
    print(f"Latest Log:   {latest_log_name}")
    print("-" * 80)
    print("CURRENT STATE & OBJECTIVE:")
    print(info.get("body", info.get("content", "")))
    print("-" * 80)
    if latest_log_snippet:
        print("PREVIOUS SESSION HIGHLIGHTS (from latest log):")
        print(latest_log_snippet)
        print("-" * 80)
    print("AUTONOMOUS EXECUTION DIRECTIVE:")
    print("1. Review the Next Steps in the state above.")
    print("2. DO NOT ask the user 'what should I do next?'. Proceed directly with the next logical action.")
    print("3. Execute code edits, scripts, or tests as required.")
    print(f"4. When finished, record your session using:")
    print(f'   python second-brain/tools/ai_os.py save {project_key} --agent "<your_name>" --summary "<what was done>" --next "<next step>"')
    print("-" * 80)
    print("TOKEN ECONOMY DIRECTIVE (TIERED MEMORY):")
    print("• You have received the distilled Tier 1 Memory (type: memory, tier: 1).")
    print("• DO NOT read through historical logs in logs/ (tier: 3, ai_read: false) to conserve tokens.")
    print("• Rely exclusively on this project state and any specific linked concepts.")
    print("=" * 80)


def cmd_save(args):
    """Save session log, update project state, and commit & push to Git."""
    project_key = args.project.lower().strip()
    proj_dir = resolve_project_path(project_key)
    state_file = proj_dir / "project_state.md"
    
    if not proj_dir.exists():
        print(f"ERROR: Project directory '{proj_dir}' does not exist.")
        sys.exit(1)
        
    logs_dir = proj_dir / "logs"
    if not logs_dir.exists():
        if proj_dir == COURSES_DIR:
            logs_dir = COURSES_DIR
        else:
            logs_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.datetime.now(datetime.timezone.utc)
    ts_file = now.strftime("%Y%m%d-%H%M%S")
    ts_iso = now.isoformat().replace("+00:00", "Z")
    agent = args.agent or "agent"
    
    # 1. Create Log File (Tier 3: Archive / Append-only)
    slug_agent = re.sub(r"[^a-zA-Z0-9_\-]", "", agent.lower().replace(" ", "-"))
    log_filename = f"{ts_file}-{slug_agent}.md"
    log_path = logs_dir / log_filename
    
    log_content = f"""---
type: log
tier: 3
ai_read: false
tags:
  - log
  - archive
timestamp: "{ts_iso}"
project: "{project_key}"
agent: "{agent}"
status: "completed"
---

# Session Log: {project_key.capitalize()} ({ts_file})

## Executive Summary
{args.summary}

## Next Immediate Steps
{args.next}

## Blockers / Open Questions
{args.blockers or 'None'}
"""
    log_path.write_text(log_content, encoding="utf-8")
    print(f"[AI-OS] Created session log: {log_path.relative_to(REPO_ROOT)}")

    # 2. Update project_state.md (Tier 1: Core Shared Memory / MOC)
    existing_content = state_file.read_text(encoding="utf-8") if state_file.exists() else ""
    
    # Update frontmatter or create new
    new_state = f"""---
type: memory
tier: 1
ai_read: true
tags:
  - memory
  - moc
  - core
project: "{project_key}"
status: "active"
updated_at: "{ts_iso}"
last_agent: "{agent}"
last_log: "{log_filename}"
next_steps: "{args.next.replace('"', "'")}"
active_blockers: "{ (args.blockers or 'None').replace('"', "'") }"
---

# Project State: {project_key.capitalize()}

## Current Objective & Status
- **Last Updated:** {ts_iso} by `{agent}`
- **Recent Progress:** {args.summary}
- **Active Blockers:** {args.blockers or 'None'}

## Next Steps (Autonomous Queue)
- {args.next}

## Reference Documents & Links
- Latest session log: `logs/{log_filename}`
"""
    state_file.write_text(new_state, encoding="utf-8")
    print(f"[AI-OS] Updated project state: {state_file.relative_to(REPO_ROOT)}")

    # 3. Git commit & push
    if not args.no_push:
        print("[AI-OS] Committing and pushing updates to GitHub...", file=sys.stderr)
        run_git(["add", str(log_path), str(state_file)])
        commit_msg = f"chore({project_key}): session log by {agent} [{ts_file}]"
        ok_commit, out_c, err_c = run_git(["commit", "-m", commit_msg])
        if ok_commit:
            ok_push, out_p, err_p = run_git(["push", "origin", "main"])
            if not ok_push:
                # Другой агент (Antigravity/Cursor/другая сессия Claude) мог запушить между нашим
                # pull'ом на старте и этим push — обычный race при нескольких одновременных
                # писателей в один git-репозиторий. Раньше здесь был только WARNING без повтора,
                # коммит оставался застрявшим неотправленным, и следующий resume() другого
                # агента его не видел — то самое "данные между моделями не синхронизируются".
                # Чиним: подтягиваем remote (-X ours разрешает конфликт в НАШУ пользу — этот save
                # заведомо новее по времени и должен победить, как и задумано в cmd_resume/status),
                # затем повторяем push один раз.
                print("[AI-OS] Push rejected — remote has new commits, merging (ours) and retrying...", file=sys.stderr)
                ok_pull, out_pull, err_pull = run_git(["pull", "--no-edit", "-X", "ours", "origin", "main"])
                if ok_pull:
                    ok_push, out_p, err_p = run_git(["push", "origin", "main"])
                if not ok_push:
                    print(f"[AI-OS WARNING] Git push still failed after merge retry: {err_p or err_pull}")
                else:
                    print(f"[AI-OS SUCCESS] Session synced to GitHub main after merge retry ({commit_msg})")
            else:
                print(f"[AI-OS SUCCESS] Session synced to GitHub main ({commit_msg})")
        else:
            print(f"[AI-OS WARNING] Git commit skipped or failed: {err_c}")


def cmd_sync(args):
    """Run bidirectional git sync (pull + push)."""
    print("[AI-OS] Syncing repository with origin/main...")
    ok_pull, out_pull, err_pull = run_git(["pull", "--rebase", "origin", "main"])
    if not ok_pull:
        print(f"[AI-OS] Pull error: {err_pull}")
    else:
        print(f"[AI-OS] Pull OK: {out_pull or 'Already up to date.'}")

    ok_push, out_push, err_push = run_git(["push", "origin", "main"])
    if not ok_push:
        print(f"[AI-OS] Push error: {err_push}")
    else:
        print(f"[AI-OS] Push OK: {out_push or 'Everything up-to-date.'}")


def main():
    parser = argparse.ArgumentParser(description="AI-OS Second Brain Agent Bridge")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # status
    p_status = subparsers.add_parser("status", help="Show all project statuses")
    p_status.set_defaults(func=cmd_status)

    # resume
    p_resume = subparsers.add_parser("resume", help="Resume work on a project")
    p_resume.add_argument("project", help="Project name (atlas, courses, dzen, nastya, dacha, other)")
    p_resume.add_argument("--no-pull", action="store_true", help="Skip remote git pull")
    p_resume.set_defaults(func=cmd_resume)

    # save
    p_save = subparsers.add_parser("save", help="Save session and update state")
    p_save.add_argument("project", help="Project name")
    p_save.add_argument("--agent", required=True, help="Agent identifier (e.g. claude-code, antigravity)")
    p_save.add_argument("--summary", required=True, help="Summary of work completed")
    p_save.add_argument("--next", required=True, help="Next immediate action")
    p_save.add_argument("--blockers", default="None", help="Active blockers or dependencies")
    p_save.add_argument("--no-push", action="store_true", help="Skip git commit and push")
    p_save.set_defaults(func=cmd_save)

    # sync
    p_sync = subparsers.add_parser("sync", help="Bidirectional git pull and push")
    p_sync.set_defaults(func=cmd_sync)

    parsed = parser.parse_args()
    parsed.func(parsed)


if __name__ == "__main__":
    main()
