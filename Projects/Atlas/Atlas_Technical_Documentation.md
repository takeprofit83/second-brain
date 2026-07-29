# Atlas
## Technical Documentation
Version: 0.3
Status: Development
Last updated: 2026-07-28

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
- ✅ **One-click capture bookmarklets for all four target chat platforms** — ChatGPT (§24), Qwen (§27), DeepSeek (§28), Gemini (§29). All four verified end-to-end on real conversations, all POST into the same `atlas-capture` webhook via the shared relay page.
- ✅ **Secret-leak incident handled** — an auto-captured conspect committed real infra passwords in plaintext (§30). File removed from the repo, both passwords rotated on `nikita-vm`, and the conspecting `system_prompt` (main + both chunking map-prompts) now instructs the model to redact secret-shaped values as `[REDACTED]` instead of reproducing them verbatim.

Pending:

- ⬜ **Context-loader ("read" side)** — the capture bookmarklets only write conspects to the repo; nothing yet reads them back into a *new* chat with a different model. Today the bridge is manual (open the repo, copy the latest conspect, paste it as the first message). Next logical step: a tool that, on opening a new chat, fetches the latest relevant conspect(s) from GitHub and injects them automatically — this is what actually closes the "any model can pick up where another left off" loop.
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

---

# 24. ChatGPT Capture Bookmarklet — DONE (2026-07-27)

Goal: this is the piece that actually delivers on "agents themselves take a snapshot of the chat" — one click on a ChatGPT conversation, no manual copy-paste, no fighting the form.

## Ingestion webhook

Added a plain **Webhook** node (POST, path `atlas-capture`, Header Auth via credential `atlas capture secret`) to `Atlas - Kie Adapter`, wired in parallel to `On form submission` → both feed `Edit Fields`, which now reads from whichever source actually fired:
```
user_input: {{ $json['Переписка'] || $json.body?.text }}
provider:   {{ $json['Провайдер'] || $json.body?.provider }}
```
This makes the pipeline usable both by a human filling the form and by any script POSTing raw JSON `{text, provider}`.

## The CSP wall (two of them)

Building a bookmarklet that reads a ChatGPT conversation and POSTs it straight to the webhook hit two separate content-security-policy walls, neither fixable client-side:

1. **chatgpt.com's own CSP** blocks `fetch()`/`XHR` to any domain not on its `connect-src` allowlist (confirmed via browser console: `Refused to connect... violates the Content Security Policy`, listing domains like `realtime.chatgpt.com`, `googleapis.com`, etc. — nothing we control). CORS configuration on the receiving server is irrelevant here; this is enforced by the browser based on the *page's* policy.
2. **The main VPS's own reverse proxy** (Nginx Proxy Manager) adds `Content-Security-Policy: sandbox ...` (without `allow-same-origin`) to every response coming through it, including n8n's `Respond to Webhook` output. A page served this way runs in a sandboxed, opaque-origin context — even a `fetch()` to its own literal domain then counts as cross-origin and can fail. Tried first: MinIO on the same VPS as a static host for a relay page — same proxy, same problem, plus port 9000 turned out to be closed at the cloud-provider firewall level (not fixable via SSH, outside this VM's own OS control).

## Solution: relay page on a separate server

`window.open()` to a different origin is **not** restricted by connect-src CSP (only `fetch`/`XHR`/`WebSocket` are) — so:

```
Bookmarklet (runs on chatgpt.com)
  1. fetch /api/auth/session  (same-origin, allowed) → accessToken
  2. fetch /backend-api/conversation/<id>  (same-origin, allowed) → full message tree
  3. build plain-text transcript by walking `mapping` from `current_node` back to root
  4. window.open(relay page URL)
  5. wait for {type:"atlas-ready"} postMessage from the relay window
  6. relay.postMessage({type:"atlas-payload", text, provider})

Relay page (hosted on a SEPARATE small VPS, plain nginx, no proxy in front)
  1. on load, if window.opener exists, postMessage {type:"atlas-ready"} to it
  2. on receiving {type:"atlas-payload", ...}, fetch() the atlas-capture
     webhook directly (same-origin-ish, no CSP restriction at all since
     this server adds no CSP header whatsoever) with the embedded secret
  3. show status, auto-close after ~2s
```

New infrastructure: a free-tier VPS from reg.ru ("Tangerine Zirconium", Ubuntu 26.04, 1 vCPU / 1GB RAM / 10GB SSD, 6-month free trial then paid) — deliberately **separate** from the main Atlas VPS specifically to escape its reverse proxy's CSP header and closed firewall ports. Plain `nginx` installed, no reverse proxy, no CSP headers added. SSH access via key auth (`~/.ssh/tangerine_vps`, alias `tangerine-vps` in SSH config), password rotated away from the initial root password after key install.

Relay page filename uses a random hex slug (not a guessable name like `relay.html`) as a lightweight obscurity measure, since the page necessarily embeds the real `atlas-capture` webhook secret in plain sight (client-side JS can't hide a secret from whoever loads the page). Real mitigation is out-of-band: keep provider (Kie.ai/OpenRouter) spending limits low, and rotate the webhook secret if abuse is ever suspected — not security through the filename.

Source lives in `Projects/Atlas/tools/`:
- `chatgpt-capture-bookmarklet.js` — readable source, `RELAY_URL` is a placeholder (real value never committed).
- `chatgpt-capture-bookmarklet.README.md` — install/setup instructions, including how to stand up your own relay page.
- The actual working `javascript:` bookmarklet URI and the relay page's real HTML (with the real secret) are **not committed** — they exist only as local files and on the relay server itself.

Verified end-to-end: clicked the bookmark on a real ChatGPT conversation ("Урок 26 Разбор процесса"), got a real structured conspect committed to `Projects/Atlas/logs/20260727-032743.md` — genuinely one click, zero copy-paste, zero DOM-virtualization fighting.

To add a third provider: build its adapter sub-workflow (same contract), add its name to the form dropdown, and extend the ternary to a proper switch/lookup once there are more than two options.

---

# 25. Conspect Purpose Correction — DONE (2026-07-27)

The original `system_prompt` produced a short, human-readable "meeting minutes" style digest (Темы / Решения / Ошибки / Открытые вопросы). User feedback: that's not the point — **the actual goal is a context-handoff document another AI model can use to resume work with zero access to the original conversation**, not a summary for a human to skim.

New `system_prompt` (in `Edit Fields`, `Atlas - Kie Adapter`):
```
Ты сохраняешь контекст переписки для передачи другой AI-модели, которая продолжит работу с нуля, без доступа к этой истории переписки. Не делай короткую выжимку для человека.

Сохрани:
1. Текущее состояние проекта/архитектуры со всеми техническими деталями (конфигурации, ID, пути, версии, конкретные значения).
2. Все принятые решения и их обоснование (почему выбрано именно так).
3. Что уже сделано и проверено (работает end-to-end).
4. Что осталось сделать — конкретный план следующих шагов.
5. Нерешённые вопросы и известные ограничения.

Пиши подробно. Цель — не компактность, а полнота, достаточная для бесшовного продолжения работы другой моделью без потери контекста.
```
Verified: a test conversation about a config-loader module produced a detailed handoff doc with exact file paths, module names, done/todo breakdown, and open questions — the right genre of document.

---

# 26. Chunking / Map-Reduce for Long Conversations — DONE (2026-07-27)

Problem found via real usage: capturing an actual long ChatGPT conversation (634 mapping nodes, 623-message chain, **448,253 characters**) produced a conspect covering only the *beginning* of the conversation — Kie.ai silently truncates oversized input rather than erroring, so a single-call approach caps out around some input size well below what a long-running chat can reach. Confirmed the pipeline itself wasn't corrupting data (a distinctive control-test payload round-tripped correctly) — the truncation happens at/before the provider API.

**Solution: uniform 2-pass map-reduce**, no conditional branching (simpler to build and reason about than an if/else per input size):

```
Edit Fields
  → Chunk Input (Code node)
      - if user_input.length <= 60000: pass through as a single item,
        system_prompt replaced with a per-chunk "extract everything" prompt,
        original context-handoff prompt saved as `original_system_prompt`
      - else: split user_input on "\n\n" message boundaries into ~60k-char
        chunks (never cutting a message in half), emit one item per chunk,
        each with its own "this is part N/M, extract facts" system_prompt
  → Call 'Atlas-Kie Adapter Core' (Execute Workflow, Mode: Run Once for Each Item)
      - runs once per chunk (or once total if not chunked), each call
        returns {answer, model, tokens, cost, created_at, ...}
  → Combine Chunks (Code node, Run Once for All Items)
      - joins all items' `.answer` fields with "--- Часть N/M ---" headers
      - pulls `original_system_prompt` and `provider` from $('Chunk Input')
        by NODE NAME, not from the adapter's output — the adapter's own
        Code node doesn't pass through caller-supplied extra fields like
        `provider`/`original_system_prompt`, only its own fixed output shape.
        Reading them from the adapter's result instead of the chunker
        produces `undefined`, which breaks the next HTTP call's JSON body
        (see gotcha below) — this bit us once, fixed by referencing
        $('Chunk Input').first().json directly.
  → Call Adapter (Final) (Execute Workflow, same node type/config, second
      instance) — single item now (Combine Chunks always emits exactly one),
      runs the ORIGINAL context-handoff system_prompt over the combined
      partial extracts, producing the final polished document
  → Convert to File / Create a file (unchanged)
```

Gotcha (recurrence of an earlier bug class): `JSON.stringify(undefined)` returns the JS value `undefined` (not a string), which breaks hand-written JSON body templates when embedded raw — same root cause as the double-`=` and null-mock-data issues earlier today. Any time a new field is threaded through multiple nodes, check it's actually defined at the point it reaches an HTTP Request's JSON body.

Verified end-to-end with a synthetic ~173,000-character, 400-exchange test conversation (3 chunks): the final conspect correctly referenced content from **the end** of the conversation (item 399) and correctly reconstructed the pattern spanning the whole thing — not just the beginning, unlike the pre-chunking behavior.

Known trade-off: every capture now costs at least 2 LLM calls (map + reduce) even for short inputs, instead of 1 — deliberate simplification to avoid conditional branching in the graph. Also: this duplicates the "how to call each provider" concern across two Execute Workflow node instances calling the same adapter — acceptable since it's still going through the shared adapter sub-workflow, not re-implementing provider-specific HTTP logic.

---

# 27. Qwen Capture Bookmarklet — DONE (2026-07-28)

Second capture target after ChatGPT (§24). Reuses the exact same relay-page infrastructure (§24) — only the in-page extraction logic differs.

**API**: `GET https://chat.qwen.ai/api/v2/chats/<id>` (`<id>` from the `/c/<id>` URL path), cookie-session auth only — no `Authorization` header needed, confirmed by testing (direct browser navigation without any custom header worked).

**Response shape**: `{success, request_id, data: {id, title, chat: {history: {messages: {<uuid>: {...}}, currentId, currentResponseIds}, models, messages: [...]}}}`. Messages are keyed by UUID in a tree (`parentId`/`childrenIds`), walked from `history.currentId` back to root — same pattern as ChatGPT's `mapping`/`current_node`.

Assistant message text lives inside `content_list[]`, in the entry with `"phase": "answer"` — other `content_list` entries are internal noise (`thinking_summary`, tool calls like `web_extractor`) and are skipped. User messages have their text directly in the top-level `content` string.

**Bug found and fixed during build**: `getConversation()` originally returned the raw `fetch().json()` result directly, but `buildTranscript()` expected `chat` at the object root — the actual API wraps everything one level deeper (`response.data.chat`, not `response.chat`). Symptom: silent empty transcript (`chat.history` always `{}`, no thrown error) rather than a crash — a class of bug worth remembering: an unwrap mismatch fails *quietly* when the code defensively falls back to `{}` at every level. Fixed by having `getConversation()` return `json.data` instead of `json`.

Source: `Projects/Atlas/tools/qwen-capture-bookmarklet.js` + matching README. Verified end-to-end on a real conversation.

---

# 28. DeepSeek Capture Bookmarklet — DONE (2026-07-28)

**API**: `GET https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=<id>` (`<id>` from `/a/chat/s/<id>` URL path).

Two things distinguish this one from Qwen/ChatGPT:

1. **Bearer token required despite cookie session already being valid** — DeepSeek's frontend sends `Authorization: Bearer <token>` on top of cookies; a plain unauthenticated request returns `{"code":40003,"msg":"INVALID_TOKEN"}`. There's no session-issuing endpoint to call (unlike ChatGPT's `/api/auth/session`) — the token just sits in `localStorage.getItem("userToken")` as `{value, __version}` JSON, read directly since the bookmarklet runs in-page.
2. **App-level delta cache** — DeepSeek's own frontend normally calls this endpoint with `cache_version`/`cache_reset_at` query params, and when the server thinks the client's local cache is already current, it returns an **empty** `chat_messages` array (`"cache_control": "MERGE"`) instead of erroring. The bookmarklet deliberately omits both params to always force a full, non-cached response.

**Response shape**: `data.data.biz_data.chat_messages` — notably a **flat array** already (`message_id`, `parent_id`, `role`: `USER`/`ASSISTANT`, `content`: plain string), unlike ChatGPT/Qwen's nested tree. Still walked as a `parent_id` chain from `chat_session.current_message_id` for consistency/robustness against branch edits, even though a flat array could in principle just be used in order.

Source: `Projects/Atlas/tools/deepseek-capture-bookmarklet.js` + README. Verified end-to-end on a real conversation, first try, no bugs found during build.

---

# 29. Gemini Capture Bookmarklet — DONE (2026-07-28)

By far the most involved of the four — Gemini has no plain REST API, it runs on Google's internal `batchexecute` RPC framework (same family as Docs/old Bard).

**Request**: `POST https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=hNvQHb&source-path=%2Fapp%2F<rawId>&bl=<bl>&f.sid=<sid>&hl=ru&_reqid=<random>&rt=c`, body `f.req=<encoded RPC array>&at=<token>` where the RPC array is `[[["hNvQHb", "[\"c_<rawId>\",10,null,1,[0],[4],null,1]", null, "generic"]]]`. `hNvQHb` = the RPC id for "load conversation" (found by searching Network response bodies for known conversation text, since request names are opaque). The trailing `[10,null,1,[0],[4],null,1]` args were copied verbatim from one real observed request and are not otherwise understood — not yet verified against a very long, multi-page conversation.

**Three session values required**, none static — extracted live via regex from `document.documentElement.innerHTML` rather than hardcoded, since they're baked into the page's own JS bundle per-session:
- `SNlM0e` → `at` (anti-CSRF token)
- `cfb2h` → `bl` (frontend build label — changes with every Gemini deploy)
- `FdrFJe` → `f.sid` (session id)

**Response format**: Google's standard `)]}'` anti-JSON-hijacking prefix, then repeated `(byte-length-line, JSON-array-line)` pairs. The bookmarklet finds the line starting with `[["wrb.fr"` and `JSON.parse`s its 3rd element *again* (it's a JSON-encoded string nested inside the already-parsed array, not inline JSON).

**Turn extraction — deliberately structure-agnostic**: initial hand-analysis of the nested array (`parsed[0]` assumed to be a *list* of `[turnData, timestamp]` pairs) was wrong for a single-exchange test conversation — `parsed[0]` turned out to be one pair directly, one list-wrapping level shallower than assumed, causing the first working version to silently extract garbage (`turnData` ending up bound to the id-pair array or the timestamp instead of the real turn object — no exception, just empty results). Rather than re-deriving the exact fixed depth (which may itself differ for multi-turn conversations, untested), the final version **recursively scans the entire parsed payload** for any array shaped like a turn — `node.length >= 4 && Array.isArray(node[0]) && node[0].length === 2` with both elements strings (matching the `[convId, respId]` id-pair signature) — and extracts from every match found this way, deduped by that id pair. More robust to exact-depth drift than a fixed-path read.

Per matched turn node: user text at `turnData[2][0][0]`, assistant text at `turnData[3][0][0][1][0]` (only the first response candidate — Gemini can offer multiple drafts, only one is captured).

Source: `Projects/Atlas/tools/gemini-capture-bookmarklet.js` + README. Verified end-to-end on a real conversation. Flagged as the most fragile of the four: `bl` self-adjusts each run since it's re-extracted live, but a genuine `batchexecute` protocol change (new rpcid, different envelope) would break it outright with no graceful degradation.

---

# 30. Secret Leak Incident — RESOLVED (2026-07-28)

An auto-captured conspect (`Projects/Atlas/logs/20260727-043445.md`, a genuine capture from an earlier real conversation about setting up `nikita-vm`) got committed to the **public** `second-brain` repo containing the real PostgreSQL and MinIO root passwords in plaintext — the conspecting `system_prompt` (§25) instructs the model to preserve "конфигурации... конкретные значения", and it dutifully included the passwords verbatim as part of "current state of the infrastructure".

Verified the leak was live (not just theoretical): the PostgreSQL password in the committed file matched the container's actual active `POSTGRES_PASSWORD` at the time.

**Response**:
1. File removed from the repo (`git rm` + push). History still contains it — accepted as moot once the credentials are rotated.
2. **`system_prompt` patched** on `nikita-vm`, directly via Postgres (`workflow_entity.nodes` for `Atlas - Kie Adapter`, `ls5hJoxIFtUycpKH`) — all **three** instances of the prompt (the main context-handoff prompt in `Edit Fields`, and both per-chunk "extract everything" prompts hardcoded in the `Chunk Input` Code node, see §26) got one appended line: *"Секреты (пароли, API-ключи, токены доступа и другие учётные данные) не воспроизводи дословно — заменяй значение на [REDACTED], сохраняя только упоминание факта и назначения."* Applied via a Python script piped through `psql` (dollar-quoted JSON payload, to avoid manual SQL-escaping a large nested JSON blob) rather than hand-editing in the n8n UI.
3. **Both leaked passwords rotated** on `nikita-vm`:
   - PostgreSQL (`n8n` role): changed live via `ALTER USER ... WITH PASSWORD`, then `/opt/apps/postgres/.env` and `/opt/apps/n8n/.env` (`DB_POSTGRESDB_PASSWORD`) updated to match, `n8n` container restarted to pick up the new value. (Note: `POSTGRES_PASSWORD` in the postgres container's own `.env` only takes effect on first init of an empty data volume — the live `ALTER USER` was the actual fix; updating `.env` was for consistency/documentation only.)
   - MinIO (`admin` root user): `MINIO_ROOT_PASSWORD` updated in `/opt/apps/minio/.env`, container restarted — MinIO re-reads root credentials from env on every startup, no live `ALTER`-equivalent needed.
   - Confirmed no n8n credential referenced MinIO (checked `credentials_entity` table) — only the Atlas-specific credentials (Kie.ai, GitHub, OpenRouter, docs-sync, capture) exist, so nothing else needed updating.
   - New passwords communicated to the project owner for their own KeePassXC vault; not stored anywhere in this repo or in n8n beyond the credentials/env vars listed above.

---

# 31. Course/Project Routing for Captures — DONE (2026-07-28)

Problem: the capture pipeline had no concept of *which* target directory a conspect belongs to — every capture (bookmarklet or manual form) landed in `Projects/Atlas/logs/` regardless of subject matter. One real example already committed there: `Projects/Atlas/logs/20260727-032743.md`, captured from a ChatGPT conversation titled "Урок 26 Разбор процесса" — actually course material for the user's n8n-automation/content-factory course, not Atlas-project history. The user separately created `Courses/` (empty, `.gitkeep` only) in `second-brain` for exactly this kind of content and wants captures routed there automatically instead of hand-sorted after the fact.

## Design

Added a `project` field ("atlas" | "courses") that flows through the whole pipeline and decides the GitHub commit path:

1. **`On form submission`** (manual-paste path) — added a `Проект` dropdown field with options `Atlas` / `Курс`.
2. **`Edit Fields`** — added assignment `project`, expression:
   ```
   {{ ($json["Проект"] === "Курс" || $json.body?.project === "courses") ? "courses" : "atlas" }}
   ```
   reads from either the form dropdown or a `project` key in the webhook JSON body, defaults to `"atlas"` if neither is present (keeps old bookmarklets/relay pages that don't send `project` yet working exactly as before).
3. **`Create a file`** (GitHub node) — `filePath` expression changed from the old hardcoded `"Projects/Atlas/logs/" + ...` to:
   ```
   {{ ($json.project === "courses" ? "Courses/" : "Projects/Atlas/logs/") + $now.format('yyyyLLdd-HHmmss') + ".md" }}
   ```
4. **Relay page** (`atlas-relay-d42332f0300f625f.html` on `tangerine-vps`, source in `atlas-relay-page-REAL-SECRET.html`) — no longer auto-sends the instant it receives `{type:"atlas-payload", ...}` from the bookmarklet. Instead it shows two buttons ("Atlas" / "Курс") and includes the user's choice as `project: "atlas" | "courses"` in the POST body to `atlas-capture`.

`Courses/` itself still has no established subfolder/naming convention beyond mirroring the flat `{yyyyLLdd-HHmmss}.md` pattern used in `Projects/Atlas/logs/` — revisit once real course conspects start landing there.

## How the n8n nodes actually got edited

The three node edits above were applied via n8n's **public REST API** (`PUT /api/v1/workflows/{id}`), not by hand in the UI, after a manual attempt on `On form submission` hit a UI mismatch (its actual field/button labels didn't match what was predicted, so editing it required the JSON directly instead of guessing UI labels blind). Notes for next time this pattern is needed:

- **n8n API key**: created ad hoc in n8n UI (Settings → n8n API), used once, deleted immediately after by the user — not stored anywhere.
- **Claude Code's own safety classifier blocked direct PUT/write calls** originating from the coding agent itself — both the n8n API `PUT` and a plain `ssh ... "cat > file"` to `tangerine-vps` got denied outright (not a permission prompt, a hard block), even though the equivalent read-only `GET`/`ssh ... "cat file"` calls worked fine. Net effect: the agent can *read* production state freely but the user has to personally run any command that *writes* to production n8n or the relay server, copy-pasted from a prepared script/one-liner.
- **n8n public API's `PUT /workflows/{id}` `settings` schema is stricter than what `GET` returns**: the live workflow's `settings` included `binaryMode` and `availableInMCP` (newer internal fields), and round-tripping them verbatim into the `PUT` body failed with `400 request/body/settings must NOT have additional properties`. Fix: strip `settings` down to only `{ "executionOrder": "v1" }` before sending.
- **Windows PowerShell 5.1 reads `.ps1` files without a BOM using the system codepage**, so literal Cyrillic characters written into a script file (e.g. by an external tool) get mis-decoded and break the parser with confusing "unexpected token" errors mid-string. Workaround: encode Cyrillic literals as base64 in the script and decode with `[System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(...))` at runtime instead of writing them literally.
- Default Windows execution policy blocks running any local `.ps1` at all (`PSSecurityException: выполнение сценариев отключено`) — resolved per-invocation with `powershell -ExecutionPolicy Bypass -File ...`, no system-wide policy change needed.

## A second field-loss bug, found only after real testing

Even after the three node edits above went live, two real course captures (via the ChatGPT bookmarklet, "Курс" button) still landed in `Projects/Atlas/logs/` instead of `Courses/`. Root cause: the map-reduce chunking path (§26) drops any field not explicitly threaded through it.

- **`Chunk Input`** (Code node) destructured only `{ user_input, system_prompt, provider }` from its input and returned only those same fields (plus `original_system_prompt`) — silently dropping `project` (and it would drop any other new field the same way).
- **`Combine Chunks`** (Code node) already had a workaround for this exact problem for `provider` — it reaches back to `$('Chunk Input').first().json.provider` to "rescue" the value after the per-chunk extraction calls (`Call 'Atlas-Kie Adapter Core'`) return only their own extraction output. It just hadn't been updated to do the same for `project`.
- **`Call Adapter (Final)`** (Execute Workflow node calling the final Kie/OpenRouter adapter) *also* strips everything down to whatever the sub-workflow returns (`question, system_prompt, answer, model, tokens, cost, created_at` — confirmed by reading the sub-workflow's own final Code node). So `Create a file`, which sits downstream of this node, can never read `$json.project` directly — it has to reach back to an earlier node's output instead, exactly like `Combine Chunks` already does for `provider`.

**Fix:** added `project` to `Chunk Input`'s destructuring and both its return branches, added `project: chunkInputFirst.project` to `Combine Chunks`'s output, and changed `Create a file`'s `filePath` expression from `$json.project` to `$('Combine Chunks').first().json.project`. All three were plain-text edits (Code node JS, or a single expression field) done directly in the n8n UI without issue — the earlier UI friction was specific to the Form Trigger's structured field list, not to text/code fields.

One more gotcha hit while editing the `filePath` expression: pasting a full string starting with `=` into a field where the `fx`/expression toggle already implies a leading `=` produces a literal double `==`, which n8n does not evaluate as an expression at all. When handing someone n8n expression code to paste into an `fx`-enabled field, give the content *without* a leading `=` — the editor supplies it.

## Cleanup

3 course captures made while debugging (duplicates of the same test chat) had already landed in `Projects/Atlas/logs/` before the fix; moved to `Courses/` via `git mv` once the real cause was confirmed.

## Status as of 2026-07-28

- ✅ n8n workflow nodes (`Edit Fields`, `On form submission`, `Create a file`, `Chunk Input`, `Combine Chunks`) all updated and live.
- ✅ Relay page deployed to `tangerine-vps` — the earlier plain-text `Get-Content | ssh ... "cat > file"` deploy corrupted the Cyrillic button labels (PowerShell re-encodes piped text through its own console codepage when handing it to an external process, regardless of the source file's actual encoding); fixed by doing a base64 round-trip instead (`[Convert]::ToBase64String($bytes) | ssh ... "base64 -d > file"`).
- ✅ **Verified end-to-end with a real course capture**: `Courses/20260728-033852.md`, captured via the ChatGPT bookmarklet with the "Курс" button, landed correctly.

Takeaway for future conspects: the redaction instruction is now baked into the standing `system_prompt`, so this should self-prevent going forward, but it's a reminder that an LLM instructed to "preserve exact configuration values" will do exactly that — including values that shouldn't be preserved in a public repo.

---

# 32. Model-Parameterized OpenRouter Adapter + Polza Adapter — DONE (2026-07-28)

## Problem

Two related asks: (1) make Claude reachable as a conspect provider (originally scoped as a new "Atlas-Claude Adapter Core"), and (2) add Polza.ai as a second RU-payable aggregator alongside OpenRouter, per the user's stated leaning after comparing several aggregators (see project memory `project_vsellm_course_server`). Partway through, the user pointed out a naming/design smell: `Atlas-Kie Adapter Core` and `Atlas-OpenRouter Adapter Core` are named after the *aggregator*, but each has a specific *model* (`gemini-2.5-flash`, `openai/gpt-4o-mini`) hardcoded inside — so adding Claude by creating a third near-identical workflow (just swapping the model string) would violate the project's own no-duplication principle (`docs/PROJECT_PRINCIPLES.md`).

## Decision: parameterize `model`, don't duplicate workflows per model

Per ADR-001 (`docs/DECISIONS.md`), an Adapter Core corresponds to a *provider/aggregator*, not a specific model — the model is just a call parameter. Since OpenRouter (and Polza, same API shape) can serve any model behind a single account, one parameterized adapter can serve GPT, Claude, or anything else the aggregator carries, with zero duplication.

**Changes to `Atlas-OpenRouter Adapter Core`:**
- `When Executed by Another Workflow`: added a third declared input, `model` (type `any`).
- `HTTP Request`: `"model": "openai/gpt-4o-mini"` → `"model": {{ JSON.stringify($json.model || 'openai/gpt-4o-mini') }}` — same default as before if the caller doesn't specify one.

**Changes to `Call Adapter (Final)`** (in `Atlas - Kie Adapter`): added `model: {{ $json.model }}` to its `workflowInputs` mapping, alongside the existing `user_input`/`system_prompt`.

Confirmed via OpenRouter's own model catalog that Claude Sonnet 5 is reachable there as `anthropic/claude-sonnet-5` ([openrouter.ai/anthropic/claude-sonnet-5](https://openrouter.ai/anthropic/claude-sonnet-5)) — so no separate Anthropic API key/billing was needed at all; the existing `atlas openrouter account` credential covers it.

**Update — done (2026-07-29):** `model` is now fully wired end-to-end, same three-node relay pattern as `project` in §31:
- `On form submission` — added a plain text field `Модель` (not a dropdown — valid model IDs vary per aggregator and change too often to maintain a fixed list).
- `Edit Fields` — added assignment `model`: `{{ $json["Модель"] || $json.body?.model || "" }}`.
- `Chunk Input` / `Combine Chunks` — `model` added to destructuring/returns exactly like `project` was, for the same reason (the chunking boundary drops untracked fields).

**Design decision on scope:** the automatic capture path (bookmarklets → relay page → `atlas-capture` webhook) deliberately does **not** get a model picker — it always sends nothing for `model`, so it silently uses each adapter's hardcoded default. The `Модель` field only exists on the manual form, for deliberate one-off testing/experimentation, not everyday capture. Exact model IDs aren't meant to be memorized — look them up in the aggregator's own model catalog each time (e.g. `openrouter.ai/models`).

**Verified end-to-end with three real test calls:**
- OpenRouter + `anthropic/claude-sonnet-5` → `Projects/Atlas/logs/20260729-024731.md`
- OpenRouter + `anthropic/claude-opus-5` → `Projects/Atlas/logs/20260729-024731.md` (same file, different test run)
- Polza + `yandex/yandexgpt-5-lite` → `Projects/Atlas/logs/20260729-025617.md` — confirmed via the adapter's own response echo (`data.model` field) that Polza genuinely routed to YandexGPT, not a silent fallback. (This particular test's *content* came out generic/templated because the test input — "кто ты? ответь максимально кратко" — was too trivial for the two-stage map-reduce prompt to extract anything meaningful from; not a routing bug.)

## A third encoding bug: `ConvertTo-Json` hangs on certain Cyrillic text

While applying the `Chunk Input`/`Combine Chunks` edits above via the API (same reason as §31 — the Form Trigger's structured field editor doesn't reliably support manual field additions in this n8n version), the standard approach broke in a new way: the whole-object `$payload | ConvertTo-Json -Depth N` call **hung indefinitely** (multiple minutes, never completing, no error) specifically once the `Chunk Input` node's `jsCode` — containing long Russian paragraphs with `«»` guillemets and em-dashes (—) — was included in the object being serialized. Confirmed via a per-node diagnostic loop that serialization succeeded fine for 7 other nodes and hung exactly on this one.

Root cause not fully isolated (Windows PowerShell 5.1's `ConvertTo-Json` uses internal regex-based string escaping, which is known to have catastrophic-backtracking-style performance cliffs on certain character patterns), but the fix doesn't require knowing the exact trigger: **bypass `ConvertTo-Json` entirely for the offending strings**, using a manual, non-regex JSON string escaper instead:

```powershell
function Escape-JsonStringManual([string]$s) {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('"')
    foreach ($ch in $s.ToCharArray()) {
        switch ($ch) {
            '"'  { [void]$sb.Append('\"'); continue }
            '\'  { [void]$sb.Append('\\'); continue }
            "`n" { [void]$sb.Append('\n'); continue }
            "`r" { continue }
            "`t" { [void]$sb.Append('\t'); continue }
            default {
                if ([int][char]$ch -lt 0x20) { [void]$sb.Append(('\u{0:X4}' -f [int][char]$ch)) }
                else { [void]$sb.Append($ch) }
            }
        }
    }
    [void]$sb.Append('"')
    return $sb.ToString()
}
```
JSON natively allows raw UTF-8 characters inside strings — only `"`, `\`, and control characters actually need escaping, so this simple character-by-character pass is both correct and immune to the regex performance cliff. Used this for just the two problematic node bodies, kept `ConvertTo-Json -Depth 15 -Compress` for the other (unproblematic) nodes, and assembled the final PUT body via plain string concatenation instead of one big object-level `ConvertTo-Json` call.

**General takeaway for future n8n-via-API edits:** if a whole-object `ConvertTo-Json` call in Windows PowerShell 5.1 seems to hang (not error, just never return) on a payload containing longer non-ASCII text, don't keep waiting or retrying with different `-Depth` values — isolate which node/string is responsible (serialize each node individually in a loop) and hand-escape just that string instead.

## Gotcha: Execute Workflow node's input-schema auto-sync can get stuck

Adding the `model` input above required the `Call Adapter (Final)` node (an Execute Workflow node) to pick up the new field from the sub-workflow's schema. This failed repeatedly through the UI:

- The node's "Workflow" field holds a **dynamic expression** (`{{ $json.provider === "OpenRouter" ? ... : ... }}`), not a fixed ID. n8n's schema-fetch (the small refresh icon, or "Refresh Input List" in the `⋮` menu) cannot resolve an expression at design time, so it silently fails to pick up new fields — "Add All Inputs" stays permanently disabled.
- Workaround attempted: temporarily replace the expression with a literal fixed workflow ID, refresh, then restore the expression. This *still* didn't work reliably in this n8n version — "Add All Inputs" stayed disabled even against a resolvable fixed ID, and the cached `schema` array in the DB never gained the new field despite multiple refreshes.
- **Actual fix:** gave up on the UI schema-sync entirely and patched `workflowId` + `workflowInputs.value` + `workflowInputs.schema` directly via the n8n public API (same `PUT /api/v1/workflows/{id}` pattern as §31), with the user creating/deleting a throwaway API key as before. The script also restored the dynamic `workflowId` expression as part of the same write, since that had been left hardcoded mid-troubleshooting.
- Same `=`-prefix gotcha as above bit again here: pasting a plain workflow ID into the "Workflow" field's `fx`-enabled box produced `=FCHKR5wwDT1ZYdKu` (double `=` in effect) — an invalid ID, which was itself part of why the fixed-ID workaround didn't initially help either. Toggling `fx` off before typing a plain ID avoids this.

## `Atlas-Polza Adapter Core` (new)

Researched Polza.ai's API directly (not assumed): OpenAI-compatible, base URL `https://api.polza.ai/api/v1`, endpoint `/chat/completions`, `Authorization: Bearer <key>`, models addressed as `provider/model` (e.g. `openai/gpt-4o`) — same shape as OpenRouter. Source: [polza.ai/blog/api-neyrosetei](https://polza.ai/blog/api-neyrosetei), [polza.mintlify.app/api-reference/introduction](https://polza.mintlify.app/api-reference/introduction).

Built by duplicating the now-model-parameterized `Atlas-OpenRouter Adapter Core` (workflow id `gu85dO6jBAoB1S9r`) rather than building from scratch, since the request/response shape and the `model` parameterization are identical — only two fields differ:
- `HTTP Request` URL → `https://api.polza.ai/api/v1/chat/completions`
- `HTTP Request` Authentication → switched from `predefinedCredentialType: openRouterApi` to `genericCredentialType` / `httpBearerAuth`, credential `atlas polza account` (id `zflQUbZxZSdo4Rk6`).

Wired into the router: `Call Adapter (Final)`'s `Workflow` expression extended from a 2-way to a 3-way ternary:
```
{{ $json.provider === "OpenRouter" ? "FCHKR5wwDT1ZYdKu" : $json.provider === "Polza" ? "gu85dO6jBAoB1S9r" : "7xFzsr8lAy5q51CH" }}
```
and `On form submission`'s `Провайдер` dropdown got a third option, `Polza`.

**Verified end-to-end**, with two real hiccups along the way that are useful to remember:
1. First test failed with `"Workflow is not active and cannot be executed."` — newly duplicated n8n workflows are **inactive by default**; the sub-workflow has to be manually activated before an `Execute Workflow` node can call it, even though it's never triggered directly itself.
2. Second test failed with `402` / `INSUFFICIENT_BALANCE` (`"Недостаточно средств... баланс: 0.00 ₽"`) — Polza account had zero balance. This actually confirmed the integration was otherwise correct (request reached Polza, auth succeeded, model was accepted — it only failed on payment). After topping up, a real conspect was committed successfully (`Projects/Atlas/logs/20260728-200438.md`).

## n8n execution data is not readable as plain nested JSON

Debugging the failures above required reading raw execution data from `execution_data` in Postgres (`SELECT data FROM execution_data WHERE "executionId"=...`). n8n stores this as a **flat array with integer-string references** (e.g. `{"message":"25"}` means "look up index 25 in the same top-level array" — not literal value `"25"`), not the object shape you'd expect from a REST API response. Grepping for a key like `"message"` only returns the reference number, not the actual error text; the reference has to be manually resolved by reading the whole array. There is no shortcut found for this yet — reading the file directly and manually cross-referencing indices was the only way that worked this session.

---

# 33. Atlas - Model Relay — DONE (2026-07-29)

## Goal

This is what the earlier Claude/model-parameterization work (§32) was actually building toward: the user's original question was how to make two AI models exchange responses with each other automatically, without personally relaying text between chat windows. Scoped down early on to something realistic — this session's Claude Code agent (with live tool access) can't itself be looped into an API call, but a plain chat-completion model can, so the target became "an automated GPT ↔ Claude debate," not "clone this agent."

## Design

New standalone workflow, **`Atlas - Model Relay`** (id `IAY5X80s26Zz06RV`), independent of the main `Atlas - Kie Adapter` orchestrator (no chunking, no course/project routing — this produces a different kind of artifact). Reuses the existing adapter architecture rather than calling any provider API directly:

- **Trigger**: a small form (`On form submission`) with two fields — `Тема` (the debate topic/opening prompt, textarea) and `Провайдер` (dropdown: `OpenRouter` / `Polza` — which aggregator account to route both sides through).
- **6 sequential `Execute Workflow` nodes** (`Call GPT 1/2/3`, `Call Claude 1/2/3`), hardcoded to a fixed 3 rounds (not a loop construct — see below for why) — each calls the *same* adapter workflow (`Atlas-OpenRouter Adapter Core` or `Atlas-Polza Adapter Core`, chosen via the `Провайдер` field) with a fixed `model` (`openai/gpt-4o-mini` for the "GPT" nodes, `anthropic/claude-sonnet-5` for the "Claude" nodes) and `user_input` wired to read the *previous* node's `.answer` output — so each reply becomes the next model's prompt. `Call GPT 1` reads the original `Тема` field instead, since there's no prior reply yet.
- **`Combine Transcript`** (Code node): assembles all 6 replies plus the original topic into one markdown document with `## GPT` / `## Claude` headers per turn.
- **`Save to GitHub`**: commits the transcript to a new `Debates/` folder (`{yyyyLLdd-HHmmss}.md`), sibling to `Projects/Atlas/logs/` and `Courses/` — a genuinely new content type (an automated dialogue, not a captured human conversation), so it gets its own top-level folder rather than being shoehorned into either existing one.

**Why a fixed 6-node chain instead of a real loop:** n8n's loop constructs (`Split in Batches`/`Loop Over Items`) require carrying accumulated state across iterations, which is fiddly to wire correctly and — after today's repeated fights with `Execute Workflow`'s schema-sync UI — judged not worth the added risk for a fixed, small round count. Fixed at 3 rounds (6 calls) per the user's own choice; if a configurable round count is wanted later, revisit as a real loop then, not preemptively.

**Why the `Провайдер` field on this form, separately from the model choice:** initially built hardcoded to OpenRouter only. The user (who tops up Polza, not OpenRouter, and had a `402` balance failure on the first real test) pointed out the aggregator itself should be switchable too, same as the main capture form. Fixed by adding the field and changing all 6 nodes' `workflowId` from a fixed value to `{{ $('On form submission').item.json["Провайдер"] === "Polza" ? "gu85dO6jBAoB1S9r" : "FCHKR5wwDT1ZYdKu" }}`.

## How it was built

Created via the n8n public API (`POST /api/v1/workflows`) rather than assembled by hand in the UI — building 9 new nodes with correct cross-references one field at a time in the UI would have been far slower and riskier than generating the whole structure programmatically, especially after today's UI friction on simpler tasks. Followed the same proven-safe pattern from §32 (serialize each node individually via `ConvertTo-Json`, never the whole nested object at once) to avoid the `ConvertTo-Json` hang bug.

Two new mistakes made and fixed along the way, worth remembering for next time:
- **A literal em-dash (`—`) in a plain string parameter** (`"Atlas — Model Relay"`) broke the `.ps1` script the same way literal Cyrillic does — not a Cyrillic-specific problem, it's *any* non-ASCII character in a BOM-less `.ps1` file under Windows PowerShell 5.1. Fixed by using a plain hyphen instead. General rule going forward: keep `.ps1` script files **pure ASCII**, no exceptions, and pass any non-ASCII content in as base64 or read from an external UTF-8 file instead.
- **PowerShell's `ConvertTo-Json` collapsed single-element nested arrays** — an n8n `connections` entry needs the shape `"main": [[{...}]]` (an array of arrays), but constructing it as `@(@([PSCustomObject]@{...}))` and piping through `ConvertTo-Json` produced `"main": [{...}]` instead (the inner single-element array got silently unwrapped into a bare object), which n8n's schema validator rejected outright (`Expected array, received object`). This is the well-known PowerShell array-unwrapping gotcha, here hitting inside `ConvertTo-Json` output rather than a simple variable assignment. Fixed by building the `connections` object as a literal JSON string via plain concatenation instead of relying on `ConvertTo-Json` for it at all.

## Verified end-to-end

Real test: topic "Что важнее для стартапа — скорость или качество?", Провайдер=Polza. All 6 calls succeeded (~75 seconds total), producing a substantive back-and-forth — GPT gave conventional MVP/balance framing, Claude repeatedly pushed back with sharper specifics (Airbnb's photography-only quality investment, technical debt as *nonlinear* rather than linear "interest," DORA metrics as a leading indicator of architectural decay, Bezos's one-way/two-way-doors framing for irreversibility). Committed to `Debates/20260729-032647.md`. This closes the loop on the session's original goal: two models now genuinely converse without the user manually relaying text between them.
