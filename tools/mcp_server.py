#!/usr/bin/env python3
"""
AI-OS Second Brain — Model Context Protocol (MCP) Server
---------------------------------------------------------
Stdio JSON-RPC MCP server connecting Claude Desktop, Claude Code, and other MCP clients
directly to the AI-OS Second Brain knowledge substrate (D:\\YandexDisk\\Atlas\\second-brain).

Protocol: Model Context Protocol (MCP) 2024-11-05
"""

import sys
import os
import json
import subprocess
import traceback
from pathlib import Path

# Force UTF-8 on Windows
if sys.platform == "win32":
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
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


def get_subprocess_kwargs():
    kwargs = {}
    if sys.platform == "win32":
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = subprocess.SW_HIDE
        kwargs["startupinfo"] = startupinfo
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    return kwargs


def log_err(msg: str):
    print(f"[AI-OS MCP] {msg}", file=sys.stderr, flush=True)


def parse_state_file(state_file: Path) -> dict:
    if not state_file.exists():
        return {}
    content = state_file.read_text(encoding="utf-8")
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
                    data[k.strip()] = v.strip().strip('"').strip("'")
    return data


def tool_resume_context(project: str = "atlas") -> str:
    """Retrieve Tier 1 context and latest progress for a project."""
    norm = (project or "atlas").lower().strip()
    proj_dir = PROJECT_MAP.get(norm, PROJECTS_DIR / norm)
    state_file = proj_dir / "project_state.md"

    if not state_file.exists():
        return f"Error: project_state.md not found for project '{norm}' at {state_file}"

    # Try git pull silently
    try:
        subprocess.run(
            ["git", "pull", "--rebase", "origin", "main"],
            cwd=REPO_ROOT,
            capture_output=True,
            timeout=10,
            text=True,
            encoding="utf-8",
            **get_subprocess_kwargs()
        )
    except Exception as e:
        log_err(f"git pull warning: {e}")

    info = parse_state_file(state_file)
    
    # Latest log
    logs_dir = proj_dir / "logs" if (proj_dir / "logs").exists() else proj_dir
    log_files = sorted(
        [f for f in logs_dir.glob("*.md") if f.name != "project_state.md"],
        key=lambda x: x.name,
        reverse=True
    )
    latest_log_snippet = ""
    latest_log_name = log_files[0].name if log_files else "None"
    if log_files:
        try:
            lines = log_files[0].read_text(encoding="utf-8").splitlines()[:25]
            latest_log_snippet = "\n".join(lines)
        except Exception:
            pass

    out = []
    out.append(f"# AI-OS CONTEXT HANDOFF: PROJECT '{norm.upper()}'")
    out.append(f"**Root:** `{proj_dir}`")
    out.append(f"**Last Updated:** `{info.get('updated_at', info.get('last_updated', 'unknown'))}`")
    out.append(f"**Status:** `{info.get('status', 'active')}`")
    out.append(f"**Latest Log:** `{latest_log_name}`\n")
    out.append("## CURRENT STATE & ACTIVE OBJECTIVE (Single Source of Truth):")
    out.append(info.get("body", info.get("content", "")))
    if latest_log_snippet:
        out.append("\n## RECENT SESSION HIGHLIGHTS (from latest log):")
        out.append(latest_log_snippet)
    out.append("\n---\n**AUTONOMOUS PROTOCOL:**")
    out.append("- You are now in sync with Antigravity / previous agents.")
    out.append("- Review the Next Steps above and proceed with implementation.")
    out.append("- When finishing work, call tool `ai_os_save_session` to record progress and push to Git.")
    return "\n".join(out)


def tool_save_session(project: str, summary: str, next_step: str, agent: str = "claude") -> str:
    """Save session progress to Second Brain, update project_state.md, and push to Git."""
    norm = (project or "atlas").lower().strip()
    py_script = SCRIPT_DIR / "ai_os.py"
    
    cmd = [
        sys.executable,
        str(py_script),
        "save",
        norm,
        "--agent", agent,
        "--summary", summary,
        "--next", next_step
    ]
    
    try:
        res = subprocess.run(
            cmd,
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=30,
            **get_subprocess_kwargs()
        )
        if res.returncode == 0:
            return f"Session successfully saved and pushed to Git:\n{res.stdout}"
        else:
            return f"Save encountered an issue (code {res.returncode}):\nStdout: {res.stdout}\nStderr: {res.stderr}"
    except Exception as e:
        return f"Error executing ai_os save: {e}"


def tool_get_status() -> str:
    """Get status overview of all projects in Second Brain."""
    lines = ["# AI-OS / Second Brain — Projects Overview"]
    for name, path in PROJECT_MAP.items():
        state_file = path / "project_state.md"
        if not state_file.exists():
            lines.append(f"- **{name.upper()}**: No project_state.md")
            continue
        info = parse_state_file(state_file)
        status = info.get("status", "unknown").upper()
        updated = info.get("updated_at", info.get("last_updated", "unknown"))
        next_step = info.get("next_step", info.get("next_steps", "None"))
        lines.append(f"- **{name.upper()}** [{status}] (Updated: {updated})")
        if next_step and next_step != "None":
            ns = next_step.replace("\n", " ")[:100]
            lines.append(f"  *Next:* {ns}")
    return "\n".join(lines)


def tool_read_file(relative_path: str) -> str:
    """Read a file from Second Brain vault safely."""
    clean_rel = relative_path.replace("\\", "/").lstrip("/")
    target = (REPO_ROOT / clean_rel).resolve()
    if not str(target).startswith(str(REPO_ROOT)):
        return "Access denied: Path must be inside Second Brain."
    if not target.exists() or not target.is_file():
        return f"File not found: {clean_rel}"
    try:
        return target.read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading file: {e}"


TOOLS = [
    {
        "name": "ai_os_resume_context",
        "description": "CRITICAL: Call this tool at the start of any conversation or task to load the active project state, recent progress from other agents (e.g. Antigravity), and next steps from Second Brain.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project": {
                    "type": "string",
                    "description": "Project key: 'atlas' (default), 'dzen', 'courses', 'nastya', 'dacha', or 'other'.",
                    "default": "atlas"
                }
            }
        }
    },
    {
        "name": "ai_os_save_session",
        "description": "Save current work progress to Second Brain. Updates project_state.md, creates a session log in logs/, and commits/pushes to GitHub so Antigravity, Obsidian, and other agents are immediately in sync.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project": {
                    "type": "string",
                    "description": "Project key (e.g. 'atlas', 'dzen', 'courses', 'nastya', 'dacha').",
                    "default": "atlas"
                },
                "summary": {
                    "type": "string",
                    "description": "Concise summary of what was implemented, investigated, or verified."
                },
                "next_step": {
                    "type": "string",
                    "description": "The immediate next objective for the next agent or session."
                },
                "agent": {
                    "type": "string",
                    "description": "Agent identifier (e.g. 'claude-desktop', 'claude-code').",
                    "default": "claude"
                }
            },
            "required": ["project", "summary", "next_step"]
        }
    },
    {
        "name": "ai_os_status",
        "description": "List all projects in AI-OS Second Brain with their current status, last update timestamp, and next steps.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "ai_os_read_file",
        "description": "Read a file or knowledge note inside Second Brain (e.g. 'Dashboard.md', 'docs/DECISIONS.md', 'Knowledge/...').",
        "inputSchema": {
            "type": "object",
            "properties": {
                "relative_path": {
                    "type": "string",
                    "description": "Path relative to second-brain root, e.g. 'Dashboard.md' or 'docs/DECISIONS.md'."
                }
            },
            "required": ["relative_path"]
        }
    }
]


def send_response(response: dict):
    payload = json.dumps(response, ensure_ascii=False)
    sys.stdout.write(payload + "\n")
    sys.stdout.flush()


def main():
    log_err("AI-OS Second Brain MCP Server started.")
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            line = line.strip()
            if not line:
                continue

            req = json.loads(line)
            req_id = req.get("id")
            method = req.get("method")
            params = req.get("params", {})

            if method == "initialize":
                send_response({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {
                            "tools": {}
                        },
                        "serverInfo": {
                            "name": "ai-os-second-brain",
                            "version": "1.0.0"
                        }
                    }
                })
            elif method == "notifications/initialized":
                # Notification, no response needed
                pass
            elif method == "ping":
                send_response({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {}
                })
            elif method == "tools/list":
                send_response({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "tools": TOOLS
                    }
                })
            elif method == "tools/call":
                tname = params.get("name")
                targs = params.get("arguments", {})
                
                res_text = ""
                if tname == "ai_os_resume_context":
                    res_text = tool_resume_context(project=targs.get("project", "atlas"))
                elif tname == "ai_os_save_session":
                    res_text = tool_save_session(
                        project=targs.get("project", "atlas"),
                        summary=targs.get("summary", ""),
                        next_step=targs.get("next_step", ""),
                        agent=targs.get("agent", "claude")
                    )
                elif tname == "ai_os_status":
                    res_text = tool_get_status()
                elif tname == "ai_os_read_file":
                    res_text = tool_read_file(targs.get("relative_path", ""))
                else:
                    res_text = f"Unknown tool: {tname}"

                send_response({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": res_text
                            }
                        ]
                    }
                })
            else:
                if req_id is not None:
                    send_response({
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "error": {
                            "code": -32601,
                            "message": f"Method '{method}' not found"
                        }
                    })
        except Exception as e:
            log_err(f"Error handling request: {e}\n{traceback.format_exc()}")
            if 'req_id' in locals() and req_id is not None:
                send_response({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {
                        "code": -32603,
                        "message": str(e)
                    }
                })


if __name__ == "__main__":
    main()
