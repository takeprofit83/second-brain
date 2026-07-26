# Atlas
## Technical Documentation
Version: 0.2
Status: Development
Last updated: 2026-07-27

---

# 1. Project Overview

Atlas is an AI automation platform built on **n8n**.

The project aims to create a provider-independent architecture where AI models can be replaced without rebuilding workflows.

The first implementation target is **Kie.ai**.

---

# 2. Objectives

Primary objectives:

- create reusable AI adapters;
- separate business logic from AI providers;
- build workflows once and switch providers later;
- maintain project documentation automatically.

---

# 3. Architecture

```
                +--------------------+
                |     n8n Workflow   |
                +----------+---------+
                           |
                           |
                  Standard AI Interface
                           |
            +--------------+--------------+
            |                             |
     Atlas-Kie Adapter            Atlas-OpenRouter
            |                             |
         Kie.ai API                OpenRouter API

```

Future adapters:

- Atlas-OpenAI
- Atlas-Claude
- Atlas-Gemini Direct

---

# 4. Infrastructure

## Server

Virtual server, hosted by friend's VPS.
Physical location: Moscow. SSH alias: `nikita-vm`.

## Docker containers

Current stack:

- n8n
- PostgreSQL
- Redis
- MinIO
- Nginx Proxy Manager

---

# 5. AI Provider

Current provider: **Kie.ai**

Reason: OpenRouter blocks requests from Russian IP addresses (see §6).

---

# 6. OpenRouter Investigation

Observed error:

```
Forbidden
Access denied by security policy.
```

Investigation:

```
curl https://ipinfo.io
```

Returned:

```
Country: RU
Region: Moscow
```

Conclusion: traffic blocked because the server IP belongs to Russia. This is an IP-level block by OpenRouter, **not** a credential/authentication configuration problem — reconfiguring the n8n credential does not fix it.

Decision: pause OpenRouter integration. Possible future solution: route traffic through VPN.

Note: an OpenRouter API key was hardcoded in plaintext in an unrelated n8n workflow ("My workflow") and in a local file (`Openrouter Atlas API.txt`) during earlier experiments. Harmless while OpenRouter blocks this IP, but should still be rotated since it's been exposed in multiple plaintext locations.

---

# 7. Kie Adapter

Communication method: HTTP Request node (no native n8n node for Kie.ai).

Authentication: Bearer Token via n8n **Generic Credential Type → HTTP Bearer Auth** credential (`atlas kie.ai account1`) — never a raw `Authorization` header in the node itself.

Endpoint example:

```
https://api.kie.ai/gemini-2.5-flash/v1/chat/completions
```

Headers:

```
Authorization: Bearer <TOKEN>   (supplied via credential, not typed in the node)
Content-Type: application/json
```

---

# 8. Gemini Request

**Design intent** (this section as originally planned):

```json
{
  "messages":[
    { "role":"system", "content":"{{ $json.system_prompt }}" },
    { "role":"user", "content":"{{ $json.question }}" }
  ],
  "stream": false,
  "include_thoughts": true
}
```

**Actual current implementation** (verified live in the `Atlas - Kie Adapter` workflow, node `HTTP Request`):

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "{{ $json.user_input }}" }
      ]
    }
  ],
  "stream": false
}
```

⚠️ **Known gap:** `system_prompt` is set in `Edit Fields` and used later when logging/parsing the answer, but it is **not currently sent to the model** — there's no system-role message in the live HTTP body. `include_thoughts` and multi-message system+user structure from the design intent above were never implemented in the production node. Revisit if system-prompt steering is actually needed.

---

# 9. Streaming

Initially tested `stream=true` → SSE output (`data: ... data: [DONE]`), which requires parsing Server-Sent Events.

Decision: use `stream=false`. Produces clean JSON, much easier for automation.

---

# 10. Response Format

Returned structure: `choices[0].message.content`

Additional metadata: `model`, `usage`, `credits_consumed`.

---

# 11. Parsing Layer

Implemented using a JavaScript Code node (`Code in JavaScript`), mode: Run Once for All Items.

Output format:

```json
{
  "question": "",
  "system_prompt": "",
  "answer": "",
  "model": "",
  "tokens": 0,
  "cost": 0,
  "created_at": ""
}
```

Purpose: normalize provider responses into a shape independent of which adapter/provider produced them.

---

# 12. Markdown Generation

Pipeline (as actually wired today):

```
HTTP Request → Code in JavaScript → Convert to File → Read/Write Files from Disk
```

(A leftover debug node, `Code in JavaScript1`, previously sat between `Convert to File` and `Read/Write Files from Disk` and silently dropped the binary payload — found and removed 2026-07-26/27.)

---

# 13. File Storage — RESOLVED (2026-07-26/27)

Goal: automatically save every completed interaction as markdown.

**Original target directory `/opt/atlas/logs/` does not work** — it exists on the VPS host filesystem but is not mounted inside the n8n Docker container, and additionally isn't covered by the container's file-access allowlist.

Root cause (fully diagnosed): the n8n container sets `N8N_RESTRICT_FILE_ACCESS_TO=/home/node/files` — this restricts every n8n filesystem node (Read/Write Files from Disk, etc.) to that one directory, regardless of actual OS-level permissions elsewhere in the container. Writing anywhere else (`/opt/atlas/logs`, `/home/node/.n8n/logs`, etc.) fails with `ENOENT` / "not writable" even when a shell inside the container could write there directly.

**Correct writable path: `/home/node/files/`** — bind-mounted on the host as `/opt/data/n8n-files`, so it persists across container restarts.

Status: verified working end-to-end — a real Kie.ai response was successfully written to `/home/node/files/test.md`.

---

# 14. Docker Investigation

Container: `n8n`

```bash
docker exec -it n8n sh
pwd
ls -la /home/node/
```

Confirmed writable/mounted directories inside the container: `/home/node/.n8n` (host: `/opt/data/n8n`) and `/home/node/files` (host: `/opt/data/n8n-files`, the one allowed by `N8N_RESTRICT_FILE_ACCESS_TO`).

---

# 15. Documentation Strategy

Planned structure (not yet created on the server itself — currently living as local files instead, see §20):

```
/opt/atlas
  docs/
    Architecture.md
    Adapters.md
    API.md
    Workflows.md
    Decisions.md
    Bugs.md
  logs/
    YYYY-MM-DD.md
```

---

# 16. Design Principles

**Provider Independence** — business workflows must never depend on provider-specific APIs.

**Single Responsibility** — Workflow: business logic only. Adapter: provider communication only.

**Unified Output** — every adapter must return:

```json
{ "answer": "", "model": "", "tokens": 0, "cost": 0, "created_at": "" }
```

regardless of provider.

---

# 17. Current Progress

Completed:

- ✅ Docker server configured.
- ✅ n8n running.
- ✅ Kie authentication working (via credential, not raw header).
- ✅ Gemini endpoint working.
- ✅ Prompt processing working.
- ✅ Parser working.
- ✅ Markdown conversion working.
- ✅ **Save markdown to disk** — resolved 2026-07-26/27, writes to `/home/node/files/`.
- ✅ **Mount persistent logs directory** — `/home/node/files` ↔ `/opt/data/n8n-files` bind mount confirmed persistent.

Pending:

- ⬜ Build Atlas-Kie adapter (formalize the working workflow into a reusable adapter interface, e.g. a callable sub-workflow).
- ⬜ Create adapter abstraction (standard interface all adapters implement).
- ⬜ Implement additional providers (OpenRouter — blocked on VPN; Claude; OpenAI).
- ⬜ Wire `system_prompt` into the actual HTTP request body if system-role steering is wanted (see §8 gap).
- ⬜ Rotate exposed OpenRouter API key.

---

# 18. Development Preferences

Project owner preferences:

- concise communication;
- step-by-step instructions, one concrete action at a time (exact field/button names, not bundled steps);
- avoid unnecessary explanations during implementation;
- preserve architectural decisions;
- minimize token consumption;
- prioritize project completion over discussion.

---

# 19. Next Milestone — COMPLETE (2026-07-27)

Full pipeline is live: **n8n Form → Kie.ai (Gemini, conspecting system prompt) → JS parser → GitHub commit**, zero manual steps between pasting text and a committed file in `second-brain`.

Final wiring:

- Trigger: `On form submission` (n8n Form node), field `Переписка` (Textarea).
- `Edit Fields`: `user_input` = `{{ $json['Переписка'] }}`, `system_prompt` = static conspecting prompt (see §8).
- `HTTP Request` JSON body uses `{{ JSON.stringify($json.system_prompt) }}` / `{{ JSON.stringify($json.user_input) }}` (not raw `"{{ ... }}"` inside manual quotes) — required because real pasted conversation text contains quotes/newlines that break hand-written JSON string interpolation otherwise. Fixed 2026-07-27 after hitting `"JSON Body" field is not valid JSON`.
- Output branches from `Code in JavaScript`: (a) `Convert to File` → `Read/Write Files from Disk` (local copy, static filename `test.md` — not yet timestamped, low priority), (b) `Create a file` (GitHub node) → commits to `Projects/Atlas/logs/{yyyyLLdd-HHmmss}.md` in `second-brain`.
- Verified end-to-end with real pasted text producing a real structured conspect, e.g. `Projects/Atlas/logs/20260727-000057.md`.

Next: begin implementation of the first production-ready Atlas Adapter abstraction (formal interface other providers can plug into) — this workflow is currently a concrete instance, not yet a reusable adapter contract.

---

# 20. Atlas - Docs Sync (agent-agnostic doc persistence)

Problem: keeping this documentation in sync with the repo previously depended on whichever coding agent (Claude Code, etc.) happened to be in the session remembering to `git add/commit/push` — not a property of Atlas itself, and wouldn't carry over to a different agent/tool.

Solution: a dedicated n8n workflow, **`Atlas - Docs Sync`** (workflow id `B4Z9lptq8i4e9Kur`), exposing a webhook any agent (or script) can call to persist a doc update, independent of which agent is driving it.

Wiring: `Webhook` (POST `/webhook/atlas-docs-sync`, Header Auth) → `Edit a file` (GitHub node, owner `takeprofit83`, repo `second-brain`) → `Respond to Webhook`.

Request contract:
```json
POST /webhook/atlas-docs-sync
Headers: X-Atlas-Secret: <shared secret, stored in n8n credential "atlas docs sync secret">
Body: {
  "filePath": "Projects/Atlas/Atlas_Technical_Documentation.md",
  "content": "<full new file content>",
  "commitMessage": "docs: ..."
}
```

Note: the GitHub node's `edit` operation replaces the whole file content — callers must send the complete new file, not a diff. Only works for files that already exist in the repo (use the `Atlas - Kie Adapter` workflow's own `Create a file` node pattern for brand-new files, e.g. conversation logs).

Status: verified working end-to-end 2026-07-27 — this very section was written to the repo through this webhook, not through a manual `git push`.
