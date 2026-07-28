# Atlas Project Log (Reconstructed)
Version: 0.2
Status: In Progress
Last updated: 2026-07-28

---

# Project Goal

Create Atlas — an AI automation platform based on n8n with interchangeable AI adapters.

Main principles:

- Adapter-based architecture.
- One adapter = one provider (Kie, OpenRouter, OpenAI, etc.).
- AI providers should be replaceable without rebuilding workflows.
- Every workflow should work through the selected adapter.

---

# Infrastructure

Server:

- VPS hosted by a friend.
- Physical location: Moscow.
- n8n runs inside Docker.

Docker containers:

- n8n
- postgres
- redis
- minio
- nginx proxy manager

---

# Architecture Decisions

## Accepted

Adapter architecture.

Instead of directly calling providers from workflows:

Workflow
↓
Adapter
↓
AI Provider

Examples:

- Atlas-Kie
- Atlas-OpenRouter
- Atlas-OpenAI
- Atlas-Claude

Every adapter exposes the same interface.

---

# OpenRouter Investigation

Problem:

OpenRouter returned

```
Forbidden
Access denied by security policy
```

Investigation:

Server IP: `95.131.147.97`
Location: Russia (Moscow)

Reason:

OpenRouter blocks requests from Russian IP addresses.

Decision:

OpenRouter postponed. Friend will later try routing traffic through VPN.

Current provider: Kie.ai

---

# Kie.ai Integration

Decision: use HTTP Request node, no native nodes.

Authentication: Bearer Token credential.

Base URL: `https://api.kie.ai`

---

# Gemini Integration

Working endpoint:

```
https://api.kie.ai/gemini-2.5-flash/v1/chat/completions
```

Authentication:
```
Authorization: Bearer TOKEN
```
Content-Type: `application/json`

---

# First Working Request

Successfully received answer.

Prompt: "Explain Docker simply."
Model: gemini-2.5-flash
Response received correctly.

---

# Streaming

Initially tested `stream=true` → SSE output (`data: ... data: [DONE]`).

Decision: disable streaming, use `stream=false`. Much easier for automation.

---

# HTTP Request

Body: `messages`, `stream=false`, `include_thoughts=true` (docs example — trimmed to plain text/no-tools/no-schema for the actual production node).

Result: standard OpenAI-compatible response.

---

# Response Parsing

Model returns `choices[0].message.content`. Needs a Code node.

---

# Code Node

Language: JavaScript
Mode: Run Once for All Items
Purpose: transform API response into clean JSON.

Output:
```json
{
  "question": "...",
  "system_prompt": "...",
  "answer": "...",
  "model": "...",
  "tokens": "...",
  "cost": "...",
  "created_at": "..."
}
```
Successfully working.

---

# Convert to Text File

Purpose: create markdown file.
Text Input Field: `answer`
Output binary field: `data`
Produces binary successfully.

---

# Read/Write Files — RESOLVED (2026-07-26/27)

Original problem: `ENOENT` saving to `/opt/atlas/logs` inside Docker — directory existed on host but wasn't mounted inside the container.

Root cause (fully diagnosed): container env var `N8N_RESTRICT_FILE_ACCESS_TO=/home/node/files` restricts all n8n filesystem nodes to that one directory, regardless of actual OS permissions elsewhere in the container.

Fix: write to `/home/node/files/...` (bind-mounted host-side as `/opt/data/n8n-files`, persists across container restarts).

Separate bug found and fixed in the same chain: a leftover debug Code node (`Code in JavaScript1`, `fs.writeFileSync('/tmp/test_code.txt', ...)`) sat between `Convert to File` and `Read/Write Files from Disk` and returned only `json` (no `binary`), silently dropping the file payload. Fixed by disconnecting it and wiring `Convert to File` directly to `Read/Write Files from Disk`.

**End-to-end pipeline now runs successfully**: Edit Fields → HTTP Request (Kie.ai) → Code in JavaScript → Convert to File → Read/Write Files from Disk → file written to `/home/node/files/test.md`.

---

# Docker Investigation

Container: `n8n`
Inspect with: `docker exec -it n8n sh`

---

# Logging

Goal: every conversation should automatically generate markdown with Question / System Prompt / Answer / Metadata (model, tokens, cost, timestamp).

---

# Documentation Structure

Planned (not yet created on the server):
```
/opt/atlas
  docs/
    Architecture.md
    Adapters.md
    Decisions.md
    Bugs.md
    Workflows.md
  logs/
    (conversation logs)
```

---

# Lessons Learned

- OpenRouter blocks Russian IPs (403 Forbidden — not a credential/config bug).
- Kie API is OpenAI-compatible in shape.
- Streaming complicates parsing; `stream=false` preferred.
- Code node successfully normalizes responses.
- Binary conversion works.
- n8n's `N8N_RESTRICT_FILE_ACCESS_TO` env var, not raw file permissions, was the real blocker for file writes.

---

# Next Steps

1. ~~Determine writable folder inside n8n container.~~ ✅ Done — `/home/node/files`.
2. ~~Finish markdown saving.~~ ✅ Done — pipeline verified end-to-end.
3. Formalize the "Atlas-Kie" adapter (current `Atlas - Kie Adapter` workflow works; consider extracting a reusable sub-workflow interface).
4. Abstract a common adapter interface so workflows don't care which provider is behind it.
5. Implement OpenRouter adapter — blocked until VPN routing is set up on the VPS.
6. Implement Claude adapter.
7. Implement OpenAI adapter.

Also outstanding: rotate the OpenRouter API key currently hardcoded in plaintext in the "My workflow" n8n workflow and in `Openrouter Atlas API.txt` (harmless while OpenRouter itself blocks the VPS's IP, but should still be rotated since it's been exposed in multiple plaintext locations).

**Note (2026-07-27/28):** most of the above "Next Steps" and "Lessons Learned" are now stale — the VPS owner resolved the OpenRouter IP block, the OpenRouter adapter shipped, dynamic provider routing shipped, and the exposed key was rotated. This section is kept as-written for historical record of the original plan; see `Atlas_Technical_Documentation.md` §5, §20–§30 for current state, which is where ongoing technical detail has been tracked since the log below stopped being updated day-to-day.

---

# 2026-07-28 — Full capture coverage + a security incident

Extended the one-click capture bookmarklet (built for ChatGPT the day before) to the other three platforms the user actually switches between when hitting rate limits: **Qwen, DeepSeek, Gemini**. All three now work end-to-end, verified on real conversations, all reusing the same relay-page infrastructure. See `Atlas_Technical_Documentation.md` §27–§29 for the API details of each (Qwen's response-unwrapping bug, DeepSeek's bearer-token + cache-bypass quirks, Gemini's `batchexecute` reverse-engineering).

Mid-session, a real auto-captured conspect turned out to contain live PostgreSQL/MinIO passwords in plaintext, committed to the public repo — the conspecting prompt had faithfully preserved "exact configuration values" as instructed, including ones that shouldn't be public. Removed the file, rotated both passwords on `nikita-vm`, and patched all three system-prompt instances (main + both map-reduce chunk prompts) to redact secret-shaped values going forward. Full writeup in Technical Documentation §30.

Net result: the "write" side of the original vision (agents capture chat snapshots and save them to the knowledge base, regardless of which model was talked to) is now complete for all four platforms the user actually uses. The "read" side — automatically loading the latest conspect into a *new* chat with a different model — is still manual and is the natural next piece of work.

---

# 2026-07-28 — Memory-gap incident: Kie Adapter rework wasn't recorded

A prior session reworked `Atlas - Kie Adapter` collaboratively with the user — the workflow grew new nodes (`On form submission`, `Webhook`, `Chunk Input`, `Combine Chunks`, `Call Adapter (Final)`) beyond the 2026-07-26 snapshot described above. That rework was never written back to memory or this log, so a later Claude Code session (this one) started from the stale 2026-07-26 state and had to re-diagnose via a live DB query (`SELECT ... FROM workflow_entity WHERE id='ls5hJoxIFtUycpKH'`) to discover the two previously-flagged issues no longer applied:

- The leaked OpenRouter key in `My workflow` (`JxejbvdlHffbu5J1`) — user had cleared the workflow entirely (0 nodes), confirmed via DB.
- The dead debug node `Code in JavaScript1` in `Atlas - Kie Adapter` — no longer present in the node list, confirmed via DB.

This is exactly the failure mode Atlas exists to prevent: work done with one agent/session silently invisible to the next. Lesson for future sessions: when a workflow is reworked in collaboration with the user (not just discovered via DB query), the resulting node list and purpose should be written to memory/this log in the same session, not left for a future session to reconstruct from Postgres.

---

# 2026-07-28 — Course/project routing added to capture pipeline

The user pointed out a real conspect ("Урок 26 Разбор процесса", course material for their n8n-automation/content-factory course) had been captured into `Projects/Atlas/logs/` alongside actual Atlas-project history, even though `Courses/` already existed for exactly this kind of content. Fixed by adding a `project` field ("atlas"/"courses") that flows: relay-page picker button (or form dropdown) → `Edit Fields` → `Create a file`'s GitHub path, defaulting to `"atlas"` if absent so old captures keep working. Full technical detail in `Atlas_Technical_Documentation.md` §31, including three gotchas hit along the way (n8n API's `settings` write-schema is stricter than its read output, Windows PowerShell 5.1 mis-parses literal Cyrillic in `.ps1` files without a BOM, and Claude Code's own safety classifier blocks the agent from directly PUTting to n8n's API or writing files over SSH to the relay server — those steps had to be handed to the user as copy-paste commands).

Status: the three n8n node edits are live and confirmed (`PUT` → `200`). The relay page's local source has the new Atlas/Курс picker UI but **has not been deployed yet** to `tangerine-vps` — still pending a one-line `ssh ... "cat > ..."` from the user. No real course conspect has gone through the new picker yet to confirm end-to-end.

---

# User Preferences During Development

- Short answers.
- No unnecessary explanations while building.
- Step-by-step guidance.
- Preserve architectural decisions.
- Minimize token usage.
- Focus on completing Atlas efficiently.
