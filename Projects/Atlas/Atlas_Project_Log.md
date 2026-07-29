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

**Update, same day:** course routing turned out to have a second, deeper bug — the map-reduce chunking path (`Chunk Input`/`Combine Chunks`/`Call Adapter (Final)`) silently drops any field not explicitly threaded through it, so `project` was surviving `Edit Fields` but still getting lost before `Create a file`. Fixed the same way `provider` was already rescued in `Combine Chunks`. Relay page deployed (had to redo it via a base64 round-trip — plain-text piping through PowerShell into `ssh` corrupts Cyrillic). **Verified end-to-end with a real course capture**, `Courses/20260728-033852.md`. Full detail in `Atlas_Technical_Documentation.md` §31.

---

# 2026-07-28 — Second Brain PROJECT_PRINCIPLES.md + DECISIONS.md added

Relayed from a ChatGPT session: a written-down engineering philosophy for the whole Second Brain + Atlas project (source-of-truth priority: repo > docs > workflow > code > chat history; any AI is a team engineer who studies before proposing; adapter/workflow architecture rules). Saved as `docs/PROJECT_PRINCIPLES.md`. ChatGPT also proposed a fuller docs split (`ARCHITECTURE.md`, `ADAPTER_CONTRACT.md`, `WORKFLOW_INDEX.md`, `DECISIONS.md`, `ROADMAP.md`) — applying the principles doc's own "no duplication" rule, only `docs/DECISIONS.md` was created (a genuine gap: an ADR-lite index of *why*, since `Atlas_Project_Log.md` is chronological prose, not searchable by decision). The other three would duplicate `Atlas_Technical_Documentation.md`; deferred until that doc actually becomes unwieldy to navigate by its §-numbered sections.

---

# 2026-07-28 — Model-parameterized OpenRouter adapter + Atlas-Polza Adapter Core

Started as "add a Claude adapter"; the user caught a real design smell first — `Atlas-Kie`/`Atlas-OpenRouter Adapter Core` are named after the aggregator but hardcode a specific model inside, so a third workflow just for Claude would've duplicated logic rather than adding real capability. Fixed the actual gap instead: `Atlas-OpenRouter Adapter Core` now takes `model` as a parameter (confirmed Claude Sonnet 5 is reachable there as `anthropic/claude-sonnet-5`, no separate Anthropic account needed). Nothing upstream sets `model` yet in production — that's deliberately deferred until a proper "Модель" form field is built, same three-node relay pattern as `project`.

Also built and shipped `Atlas-Polza Adapter Core` (duplicated from the now-parameterized OpenRouter adapter — same OpenAI-compatible shape, just a different base URL and a Bearer credential), wired into the router's provider ternary and the form dropdown. Verified end-to-end after two real hiccups (workflow wasn't activated yet; then zero balance on the Polza account) — a genuine conspect landed in `Projects/Atlas/logs/20260728-200438.md`. Full detail, including the Execute-Workflow schema-sync bug that forced another API-based node edit, in `Atlas_Technical_Documentation.md` §32.

---

# 2026-07-29 — Model field wired end-to-end, verified with 3 real providers

Finished what §32 above deferred: added a `Модель` text field to the capture form and threaded `model` through `Edit Fields` → `Chunk Input` → `Combine Chunks` (same fix pattern as `project` — the chunking boundary silently drops any field not explicitly carried through it). Deliberately scoped to the manual form only, not the automatic bookmarklet/relay path — everyday capture shouldn't require knowing exact model IDs, that's an experimentation feature.

Hit a new, nastier flavor of the recurring Cyrillic-encoding problem: applying the fix via the n8n API, a whole-object `ConvertTo-Json` call in Windows PowerShell 5.1 hung indefinitely (not an error — just never returned) specifically once the long Russian system-prompt text embedded in `Chunk Input`'s code was included. Diagnosed by serializing each node individually in a loop until the exact culprit node was found, then worked around by hand-writing a simple, regex-free JSON string escaper for just that one field instead of relying on `ConvertTo-Json`. Full writeup with the escaper code in `Atlas_Technical_Documentation.md` §32.

Verified end-to-end with three real calls: OpenRouter + Claude Sonnet 5, OpenRouter + Claude Opus 5, and Polza + YandexGPT-5-lite (confirmed via the adapter's own response echo that Polza genuinely routed to Yandex, not a silent fallback — the generic output content was just an artifact of an intentionally trivial test prompt, not a bug).

---

# 2026-07-29 — Atlas - Model Relay: the original session goal, closed

Circled back to the question that kicked off the whole model-adapter/Claude/Polza thread: how to let two AI models exchange responses automatically, without the user relaying text between chat windows by hand. Built a new standalone workflow, `Atlas - Model Relay`, that alternates between a "GPT" and a "Claude" adapter call 3 rounds (6 calls), each reply becoming the next model's prompt, then commits the full transcript to a new `Debates/` folder. Reused the existing adapter architecture entirely — no new provider integration needed, just orchestration on top of what already existed.

Also added a `Провайдер` switch (OpenRouter/Polza) to this new form, after the first real test failed on an OpenRouter balance error — the user pointed out they top up Polza, not OpenRouter, so the aggregator choice needed to be switchable here too, same as the main capture form.

Built via the n8n API (`POST /workflows`, creating all 9 nodes programmatically) rather than by hand — hit two new variants of today's recurring encoding/serialization gotchas (a literal em-dash breaking a `.ps1` file the same way Cyrillic does; `ConvertTo-Json` silently collapsing a single-element nested array, which n8n's schema validator then rejected). Both documented with fixes in `Atlas_Technical_Documentation.md` §33.

**Verified end-to-end** with a real topic ("Что важнее для стартапа — скорость или качество?"): a substantive 6-turn exchange, Claude repeatedly pushing back on GPT's more conventional framing with sharper specifics (nonlinear technical debt, DORA metrics, Bezos's one-way/two-way-doors heuristic). Committed to `Debates/20260729-032647.md`. This is the point the session's original question gets a real, working answer.

---

# User Preferences During Development

- Short answers.
- No unnecessary explanations while building.
- Step-by-step guidance.
- Preserve architectural decisions.
- Minimize token usage.
- Focus on completing Atlas efficiently.
