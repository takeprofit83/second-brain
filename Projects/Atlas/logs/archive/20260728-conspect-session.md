# Context handoff: Atlas capture bookmarklets (Qwen/DeepSeek/Gemini) + secret-leak incident

Source: Claude Code session in `C:\Users\takep\YandexDisk\Atlas` (continuation of an earlier compacted session that built the ChatGPT capture bookmarklet). Written directly by Claude Code, not run through the atlas-capture/Kie.ai pipeline — this is a first-class conspect, not raw text to be summarized.

## What this project is

**Atlas** = the user's personal AI-automation layer on self-hosted n8n (`nikita-vm`), whose actual purpose (verbatim from the user, established in an earlier session): agents themselves take snapshots of chats, conspect them, and save the result into a shared knowledge base (`second-brain` GitHub repo, public), so context survives across the user hitting usage limits and switching between ChatGPT/Qwen/DeepSeek/Gemini/Claude. The saved artifact must be a **context-handoff document another AI model can use to resume with zero access to the original conversation** — not a human-readable summary. See `Atlas_Technical_Documentation.md` and `Atlas_Project_Log.md` in this repo for full technical history (sections 1-30 as of this writing).

## What happened this session

1. **Extended the one-click capture bookmarklet (built for ChatGPT previously) to Qwen, DeepSeek, and Gemini.** All four now work end-to-end, verified on real conversations. Each reuses the same relay-page trick (a bookmarklet reads the conversation via the site's own internal API using the logged-in session, then `window.open()`s a small unproxied-nginx relay page on a separate VPS — `195.19.12.38`, alias `tangerine-vps` — to escape both the source site's CSP and the main VPS's proxy-injected CSP, and the relay page POSTs to the n8n `atlas-capture` webhook). Full API-level details for each are in `Atlas_Technical_Documentation.md` §27 (Qwen), §28 (DeepSeek), §29 (Gemini) — worth reading directly rather than re-deriving, especially Gemini's `batchexecute` reverse-engineering, which is genuinely non-obvious.

2. **A real auto-captured conspect leaked live infrastructure passwords** (PostgreSQL + MinIO root passwords, verbatim, since the conspecting prompt instructs "preserve exact configuration values" and dutifully did). Found, removed the file from the public repo, rotated both passwords on `nikita-vm`, and patched the `system_prompt` (main + both map-reduce chunk prompts in the `Atlas - Kie Adapter` workflow) to redact secret-shaped values as `[REDACTED]` going forward. Full writeup: §30.

3. **Found (not fixed) a bug in `Atlas - Docs Sync`** (the webhook meant to persist doc changes to GitHub, workflow id `B4Z9lptq8i4e9Kur`): its GitHub node throws `TypeError at Buffer.from (Github.node.ts:2539)` and the execution shows `status='error'` in `execution_entity`, but the webhook still responds `200`/success to the caller — a silent-failure trap. Repro: call `POST https://n8n.neiroclone.ru/webhook/atlas-docs-sync` with a valid `X-Atlas-Secret` and a normal `{filePath, content, commitMessage}` body; check `docker logs n8n` around that timestamp on `nikita-vm`, or query `execution_entity WHERE "workflowId"='B4Z9lptq8i4e9Kur'` via `docker exec postgres psql -U n8n -d n8n`. Worked around this session by pushing doc changes directly via git instead.

4. **CLAUDE.md updated** with a new standing rule: Claude Code sessions in this workspace should also be conspected the same way, saved directly to `Projects/Atlas/logs/` (no need to route through the capture webhook, since the agent already has the full conversation and can write the finished conspect itself) — this file is the first example of that rule in action.

## What's NOT done yet (the actual next priority)

The pipeline built so far only handles the **write** side: capturing a conversation and saving a conspect. Nothing yet handles the **read** side — loading a saved conspect back into a *new* chat with a different model. Today that bridge is fully manual: open the repo, find the latest relevant conspect, paste it as the first message.

**Recommended next step (Claude's architectural call, not yet built):** a simple bookmarklet/page that fetches the latest conspect from GitHub and copies it to the clipboard in one click — deliberately *not* auto-injecting text into each site's composer (that would mean redoing the same per-platform DOM-fragility work the capture side just went through, for a much smaller payoff). This is what actually closes the loop the user originally asked for ("любой ИИ начинает разговор уже подготовленным").

**Separately outstanding:**
- Fix the `Atlas - Docs Sync` webhook bug (item 3 above) — not urgent since direct git push works as a fallback, but the silent-failure behavior (200 response despite an error) is a trap for whoever hits it next without checking.
- Additional provider adapters (Claude, OpenAI) as new sub-workflows using the existing `{user_input, system_prompt} → {answer, model, tokens, cost, created_at}` contract — mentioned as future work, not currently requested.
- Consider whether provider routing (currently a binary ternary in the `Execute Workflow` node expression) needs to become a proper switch/lookup once a third provider is added to the dropdown.

## Where things live (for a fresh agent with no other context)

- n8n: `nikita-vm` (SSH alias), main pipeline workflow `Atlas - Kie Adapter` (id `ls5hJoxIFtUycpKH`), plus adapter sub-workflows `Atlas-Kie Adapter Core` (`7xFzsr8lAy5q51CH`), `Atlas-OpenRouter Adapter Core` (`FCHKR5wwDT1ZYdKu`), and `Atlas - Docs Sync` (`B4Z9lptq8i4e9Kur`, currently buggy).
- Repo: `github.com/takeprofit83/second-brain` (public), cloned locally at `C:\Users\takep\YandexDisk\Atlas\second-brain\`. Docs at `Projects/Atlas/Atlas_Technical_Documentation.md` (current-state reference, now v0.3) and `Atlas_Project_Log.md` (chronological). Bookmarklet sources + READMEs at `Projects/Atlas/tools/` (redacted, real secret-bearing `javascript:` URIs live only locally, never committed).
- Relay page + capture webhook secret: real values live only in local files under `C:\Users\takep\YandexDisk\Atlas\` (never committed) and on the relay server itself.
- Standing instructions for any agent working in this workspace: `C:\Users\takep\YandexDisk\Atlas\CLAUDE.md`.
