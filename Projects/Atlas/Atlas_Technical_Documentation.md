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

Default provider: **Kie.ai** (`Atlas-Kie Adapter Core`), kept as default since it's been the stable one since day one.

As of 2026-07-27, **OpenRouter is also a fully working, validated alternative** (`Atlas-OpenRouter Adapter Core`, see §22) — the VPS owner set up routing that lifted the earlier geo-block (§6). Switching providers is a one-field change in the main pipeline's `Execute Workflow` node, no other changes needed.

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

Decision (original): pause OpenRouter integration. Possible future solution: route traffic through VPN.

**Update (2026-07-27): resolved.** The VPS owner set up routing; `/api/v1/chat/completions` now returns real completions instead of `403`, even though `curl https://ipinfo.io` from the same server still reports the same Russian IP — whatever changed is at the network/routing layer, not a new IP. OpenRouter is now fully usable; see §22 for the working adapter.

Note: the original OpenRouter API key had been hardcoded in plaintext in an unrelated n8n workflow ("My workflow") and in a local file (`Openrouter Atlas API.txt`) during earlier experiments. Since OpenRouter is now actually usable (making a leaked key an active risk, not just a theoretical one), **this key was rotated 2026-07-27** — the new key lives only in the n8n credential `atlas openrouter account` and in a KeePassXC vault (`atlas-secrets.kdbx`), not in any plaintext file. The old "My workflow" test workflow still contains the *old, now-revoked* key and can be cleaned up/deleted whenever convenient.

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

**Actual current implementation** (verified live in the `Atlas - Kie Adapter` workflow, node `HTTP Request`, as of 2026-07-27):

```json
{
  "messages": [
    {
      "role": "system",
      "content": [
        { "type": "text", "text": {{ JSON.stringify($json.system_prompt) }} }
      ]
    },
    {
      "role": "user",
      "content": [
        { "type": "text", "text": {{ JSON.stringify($json.user_input) }} }
      ]
    }
  ],
  "stream": false
}
```

Note the `JSON.stringify(...)` (no surrounding quotes in the template) rather than `"{{ ... }}"` — required so real pasted conversation text with quotes/newlines doesn't break the JSON (see §19).

✅ **Resolved (2026-07-27):** `system_prompt` is now actually sent as a real system-role message (see the "Actual current implementation" body above, which already includes it) — this note was stale, kept for history. `include_thoughts` and the flat `content: "string"` shape from the original design-intent draft were never implemented; the production node uses the `content: [{type: "text", text: ...}]` array shape for both roles instead, wrapped in `JSON.stringify(...)` per the fix in §19.

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

- ✅ **Form Trigger + real conspect + GitHub auto-commit** — full pipeline complete (§19).
- ✅ **Atlas - Docs Sync webhook** — agent-agnostic doc persistence (§20).
- ✅ `system_prompt` wired into the actual HTTP request body (§8).

- ✅ **Adapter abstraction** — `Atlas-Kie Adapter Core` extracted as a reusable sub-workflow, called via `Execute Workflow` (§21). Verified end-to-end, e.g. `Projects/Atlas/logs/20260727-004050.md`.
- ✅ **OpenRouter unblocked and adapter built** — `Atlas-OpenRouter Adapter Core` implements the same contract, verified end-to-end (§22). Proves the adapter abstraction actually works for swapping providers, not just in theory.
- ✅ Old exposed OpenRouter key rotated; new key stored only in n8n credential + KeePassXC vault, not in plaintext files.

- ✅ **Dynamic provider routing** — form has a `Провайдер` dropdown (Kie/OpenRouter), routed to the right sub-workflow per-run via an expression on the `Execute Workflow` node (§23). No more manually editing the node to switch providers.

Pending:

- ⬜ Implement additional providers as new sub-workflows using the same contract (Claude; OpenAI) — just add them to the dropdown + ternary/switch expression once built.

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

---

# 21. Adapter Abstraction — DONE (2026-07-27)

Problem: `Atlas - Kie Adapter` was a single monolithic workflow (form → HTTP call → parse → save/commit). Adding OpenRouter/Claude/OpenAI would have meant copy-pasting the whole thing each time.

Solution: split provider-specific logic into its own reusable sub-workflow, called via n8n's `Execute Workflow` node.

**Contract** (input → output, provider-agnostic):
```
in:  { user_input: string, system_prompt: string }
out: { question, system_prompt, answer, model, tokens, cost, created_at }
```

**`Atlas-Kie Adapter Core`** (workflow id `7xFzsr8lAy5q51CH`) implements this contract for Kie.ai:
```
When Executed by Another Workflow (Workflow Input Schema: user_input, system_prompt)
  → HTTP Request (Kie.ai, same config as before)
  → Code in JavaScript (normalizes response; reads original input via
     $('When Executed by Another Workflow').first().json, since the HTTP
     response node overwrites $json)
```

**`Atlas - Kie Adapter`** (main pipeline, workflow id `ls5hJoxIFtUycpKH`) now only orchestrates:
```
On form submission → Edit Fields → Call 'Atlas-Kie Adapter Core' (Execute Workflow node)
  → Convert to File → Read/Write Files from Disk
  → Create a file (GitHub)
```

Gotchas hit while wiring this up (for next time / next adapter):
- The `Execute Workflow` (caller) node has no field-mapping UI at all until the **target sub-workflow's trigger** has a defined `Workflow Input Schema` — until then it just shows "The sub-workflow isn't set up to accept any inputs."
- Input Data Mode on `When Executed by Another Workflow` must be switched to "Define using fields below" and each field added explicitly (`user_input`, `system_prompt`, type String) — there was no simpler "accept everything" toggle in this n8n version.
- After defining the sub-workflow's schema, the caller node needs to be reopened for the new fields to appear for mapping (stale cache).
- Both the main workflow and the sub-workflow need to be **Active** independently for the production form URL to work — editing/restructuring a workflow can silently flip it back to inactive.

**To add a new provider adapter** (Claude/OpenAI): create a new sub-workflow implementing the same input/output contract, then either swap which workflow the `Execute Workflow` node points to, or (future work) make the target dynamic based on a `provider` field.

---

# 22. Atlas-OpenRouter Adapter Core — DONE (2026-07-27)

Second adapter, built to validate that §21's abstraction actually works for swapping providers (it does — no changes needed to the form, `Edit Fields`, `Convert to File`, or the GitHub commit node).

**`Atlas-OpenRouter Adapter Core`** (workflow id `FCHKR5wwDT1ZYdKu`), same contract as Kie:
```
When Executed by Another Workflow (Workflow Input Schema: user_input, system_prompt)
  → HTTP Request (OpenRouter, predefined credential type)
  → Code in JavaScript (same normalization as the Kie adapter)
```

HTTP Request config, differences from the Kie adapter worth noting:
- **URL**: `https://openrouter.ai/api/v1/chat/completions` (model is NOT in the URL path, unlike Kie).
- **Authentication**: `Predefined Credential Type` → **OpenRouter** (n8n has native `openRouterApi` credential support), credential `atlas openrouter account` — cleaner than Kie's manual Generic Credential Type → Bearer Auth, since n8n handles the header itself.
- **Body**: `model` must be an explicit field (used `openai/gpt-4o-mini` for testing), and `content` is a **plain string** (`{{ JSON.stringify(...) }}`), not the `[{type:"text", text:...}]` array shape Kie's API required:
```json
={
  "model": "openai/gpt-4o-mini",
  "messages": [
    { "role": "system", "content": {{ JSON.stringify($json.system_prompt) }} },
    { "role": "user", "content": {{ JSON.stringify($json.user_input) }} }
  ],
  "stream": false
}
```

Testing gotcha: running the trigger node standalone with **no mock data configured** outputs `{user_input: null, system_prompt: null}`, which isn't obviously wrong (`JSON.stringify(null)` → the string `"null"`, still syntactically valid JSON) — the actual "JSON Body field is not valid JSON" error that showed up was diagnosed by checking the trigger node's own `Execute step` output first, but ultimately the simplest reliable test was: temporarily point the main pipeline's `Execute Workflow` node at this adapter and submit the real form, exactly like testing any other adapter — not worth fighting with isolated mock-data execution.

Verified end-to-end with a real form submission → real `gpt-4o-mini` response → committed to GitHub (`Projects/Atlas/logs/20260727-015206.md`). Main pipeline switched back to `Atlas-Kie Adapter Core` as the default afterward (§5).

Cleanup note: an old, unrelated credential `OpenRouter Main` (type `openAiApi`) predates this work (from an earlier session with ChatGPT, before the IP block was understood) and duplicated the same key — removed in favor of the single `atlas openrouter account` credential to avoid the same secret living in two places.

---

# 23. Dynamic Provider Routing — DONE (2026-07-27)

Problem: switching providers required manually opening the `Execute Workflow` node and changing its target — fine for testing, not for real use where the choice should be made per-submission.

Solution:
- **`On form submission`**: added a second form field, **`Провайдер`** (Dropdown, options: `Kie`, `OpenRouter`).
- **`Edit Fields`**: added `provider` = `{{ $json['Провайдер'] }}` (pass-through).
- **`Call 'Atlas-Kie Adapter Core'`** (the `Execute Workflow` node — name is now slightly stale, still routes to either adapter): the **Workflow** resource locator was switched from `From list` to `By ID`, with an expression instead of a static ID:
```
{{ $json.provider === 'OpenRouter' ? 'FCHKR5wwDT1ZYdKu' : '7xFzsr8lAy5q51CH' }}
```
Defaults to Kie (`7xFzsr8lAy5q51CH`) unless the form explicitly selects OpenRouter.

Verified: submitted the form once with each provider selection; both executions completed with status `success` and produced valid conspects committed to GitHub (`Projects/Atlas/logs/20260727-020201.md`, `20260727-020235.md`). Note: n8n stores execution data in a compact internal format, not plain JSON, so confirming the exact model used per historical execution via direct DB query isn't practical — routing correctness rests on the simple ternary expression being structurally correct plus each branch having been independently validated earlier (§21, §22), not on inspecting raw execution logs.

To add a third provider: build its adapter sub-workflow (same contract), add its name to the form dropdown, and extend the ternary to a proper switch/lookup once there are more than two options.
