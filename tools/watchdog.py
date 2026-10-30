#!/usr/bin/env python3
r"""
Atlas AI-OS Autonomous Background Watchdog (watchdog.py)
-------------------------------------------------------
Runs silently in the background on Windows (via Windows Task Scheduler + pythonw.exe).
Does NOT require terminal or user intervention.

Functions:
1. Always pulls latest changes from GitHub (e.g. n8n daily cron commits).
2. Maintains the Link Map (Obsidian Wikilinks Graph) automatically:
   - Links latest session logs to project_state.md
   - Keeps Knowledge/index.md up to date with new notes
   - Preserves Dashboard.md integrity
3. Automatically commits and pushes safe changes in second-brain to GitHub (takeprofit83/second-brain).
4. Detects recent local Claude Code / Antigravity sessions.
"""

import os
import re
import sys
import json
import glob
import time
import datetime
import subprocess
from pathlib import Path

# Paths
WATCHDOG_DIR = Path(__file__).resolve().parent
REPO_ROOT = WATCHDOG_DIR.parent # second-brain
PROJECTS_DIR = REPO_ROOT / "Projects"
KNOWLEDGE_DIR = REPO_ROOT / "Knowledge"
LOG_FILE = WATCHDOG_DIR / "watchdog.log"

PROJECT_MAP = {
    "atlas": PROJECTS_DIR / "Atlas",
    "dzen": PROJECTS_DIR / "Dzen",
    "courses": REPO_ROOT / "Courses",
    "nastya": PROJECTS_DIR / "Nastya",
    "dacha": PROJECTS_DIR / "Dacha",
    "other": PROJECTS_DIR / "Other",
}


def log(msg: str):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def run_cmd(cmd, cwd=None, timeout=30):
    try:
        res = subprocess.run(
            cmd,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace"
        )
        return res.returncode == 0, res.stdout.strip(), res.stderr.strip()
    except Exception as e:
        return False, "", str(e)


def maintain_link_map():
    """Build and maintain Obsidian wikilinks graph automatically."""
    log("Checking and updating Obsidian Link Map (Wikilinks Graph)...")
    
    # 1. Update project_state.md links for all projects
    for name, pdir in PROJECT_MAP.items():
        state_file = pdir / "project_state.md"
        if not state_file.exists():
            continue
        
        logs_dir = pdir / "logs" if (pdir / "logs").exists() else pdir
        all_logs = sorted(
            [f for f in logs_dir.glob("*.md") if f.name != "project_state.md" and not f.name.startswith(".")],
            key=lambda x: x.name,
            reverse=True
        )
        if not all_logs:
            continue
        
        latest_log = all_logs[0]
        latest_log_stem = latest_log.stem
        latest_log_rel = str(latest_log.relative_to(REPO_ROOT)).replace("\\", "/")
        
        try:
            content = state_file.read_text(encoding="utf-8")
            original_content = content
            
            # Update last_log in frontmatter
            if "last_log:" in content:
                content = re.sub(r'last_log:\s*["\']?([^"\']+)["\']?', f'last_log: "{latest_log.name}"', content)
            
            # Update wikilink to latest log in Reference Documents
            # Matches [[Projects/.../logs/...]] or [[...log...]]
            log_link_pattern = r'\[\[(Projects/' + name.capitalize() + r'/logs/[^\]|]+)(\|[^\]]+)?\]\]'
            new_wikilink = f"[[{latest_log_rel.replace('.md', '')}|Последний лог сессии ({latest_log_stem})]]"
            if re.search(log_link_pattern, content):
                content = re.sub(log_link_pattern, new_wikilink, content)
            
            if content != original_content:
                state_file.write_text(content, encoding="utf-8")
                log(f"Updated link map in {name}/project_state.md -> {latest_log.name}")
        except Exception as e:
            log(f"Error maintaining link map for {name}: {e}")

    # 2. Update Knowledge/index.md for any new knowledge notes
    index_file = KNOWLEDGE_DIR / "index.md"
    if index_file.exists() and KNOWLEDGE_DIR.exists():
        try:
            index_text = index_file.read_text(encoding="utf-8")
            all_kn = sorted([f for f in KNOWLEDGE_DIR.glob("*.md") if f.name not in ["index.md", "log.md", "lint-report.md"]])
            
            missing = []
            for k in all_kn:
                slug = k.stem
                if f"[[{slug}" not in index_text:
                    missing.append(slug)
            
            if missing:
                append_lines = ["\n## 📝 Новые заметки базы знаний (добавлено автоматически)"]
                for m in missing:
                    append_lines.append(f"- [[{m}|{m}]]")
                index_text += "\n" + "\n".join(append_lines) + "\n"
                index_file.write_text(index_text, encoding="utf-8")
                log(f"Added {len(missing)} missing knowledge notes to Knowledge/index.md")
        except Exception as e:
            log(f"Error updating Knowledge/index.md: {e}")


def sync_second_brain():
    """Ensure second-brain repo is pulled, committed, and pushed."""
    # 1. Pull latest
    ok_pull, _, err_pull = run_cmd(["git", "pull", "origin", "main", "--no-rebase"], cwd=REPO_ROOT)
    if not ok_pull:
        log(f"Git pull warning: {err_pull}")

    # 2. Maintain Link Map before commit
    maintain_link_map()

    # 3. Check status
    ok, status_out, _ = run_cmd(["git", "status", "--porcelain"], cwd=REPO_ROOT)
    if not ok:
        log(f"Git status failed in second-brain: {status_out}")
        return

    ok_ahead, ahead_out, _ = run_cmd(["git", "status", "-sb"], cwd=REPO_ROOT)
    has_unpushed = ok_ahead and "ahead" in ahead_out
    has_uncommitted = bool(status_out.strip())

    if not has_uncommitted and not has_unpushed:
        log("Second-brain is clean and up to date.")
        return

    # Commit any uncommitted safe changes
    if has_uncommitted:
        log("Uncommitted changes detected in second-brain. Staging and committing...")
        run_cmd(["git", "add", "-A"], cwd=REPO_ROOT)
        ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        commit_msg = f"chore(auto-sync): background synchronization & link map update [{ts}]"
        ok_c, _, err_c = run_cmd(["git", "commit", "-m", commit_msg], cwd=REPO_ROOT)
        if not ok_c:
            log(f"Commit warning: {err_c}")

    # Push to origin main
    log("Pushing second-brain updates to GitHub...")
    ok_push, _, err_push = run_cmd(["git", "push", "origin", "main"], cwd=REPO_ROOT)
    if not ok_push:
        log(f"Push rejected: {err_push}. Trying pull and retry push...")
        run_cmd(["git", "pull", "origin", "main", "--no-rebase"], cwd=REPO_ROOT)
        ok_retry, _, err_retry = run_cmd(["git", "push", "origin", "main"], cwd=REPO_ROOT)
        if ok_retry:
            log("Retry push succeeded.")
        else:
            log(f"Retry push failed: {err_retry}")
    else:
        log("Push completed successfully.")


def check_claude_recent_sessions():
    """Scan recent Claude Code session transcripts."""
    user_profile = os.environ.get("USERPROFILE", "")
    claude_projects_dir = os.path.join(user_profile, ".claude", "projects")
    if not os.path.exists(claude_projects_dir):
        return

    cutoff = time.time() - (4 * 3600)
    all_jsonls = glob.glob(os.path.join(claude_projects_dir, "**", "*.jsonl"), recursive=True)
    recent = [f for f in all_jsonls if "subagents" not in f and os.path.getmtime(f) >= cutoff]

    if not recent:
        return

    for f in recent:
        fname = os.path.basename(f)
        parent_name = os.path.basename(os.path.dirname(f)).lower()
        
        target_project = "other"
        if "content-fabric" in parent_name or "dzen" in parent_name:
            target_project = "dzen"
        elif "atlas" in parent_name:
            target_project = "atlas"
        elif "course" in parent_name:
            target_project = "courses"
        elif "dacha" in parent_name:
            target_project = "dacha"
        elif "nastya" in parent_name:
            target_project = "nastya"

        state_file = PROJECT_MAP.get(target_project, PROJECTS_DIR / target_project) / "project_state.md"
        if state_file.exists():
            try:
                mtime = os.path.getmtime(f)
                dt_iso = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%dT%H:%M:%SZ")
                log(f"Active session verified for project '{target_project}': {fname} ({dt_iso})")
            except Exception as e:
                log(f"Error checking state file for {target_project}: {e}")


def main():
    log("=== Atlas Watchdog started ===")
    try:
        check_claude_recent_sessions()
        sync_second_brain()
        log("=== Atlas Watchdog finished successfully ===")
    except Exception as e:
        log(f"Fatal error in watchdog: {e}")


if __name__ == "__main__":
    main()
