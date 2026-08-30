# Claude Code compatibility for Pi

Global Pi extension that reuses a repository's Claude Code setup.

## Features

- Loads `.claude/skills/**/SKILL.md` and maps `/name` to `/skill:name`.
- Loads always-on `.claude/rules/` and `.claude/instructions/` files.
- Auto-loads path-specific rules on matching reads and blocks edits until matching rules are loaded.
- Enforces `permissions.deny` path and Bash rules from Claude settings.
- Runs project `PreToolUse`, `PostToolUse`, `SessionStart`, and `SessionEnd` command hooks.
- Replaces Claude's generic permission-review prompt with deterministic secret, exfiltration, encoded-payload, external-write, and destructive-command checks.
- Provides `question` and Claude-compatible `AskUserQuestion` tools, including canonical `questions: [...]`, single-question shorthand, and multi-select answers.
- Provides Claude-compatible `WebFetch` and `WebSearch` tools using Jina Reader plus Serper/Exa.
- Reads `.mcp.json` and registers MCP tools under Claude-compatible `mcp__server__tool` names.
- Keeps MCP schemas lazy behind `mcp_search_tools` to preserve prompt caching.
- Provides a Claude-compatible `Agent` tool that recursively discovers `.claude/agents/` only after trust, accepts Claude `subagent_type`/`prompt` aliases, and runs independent calls in parallel.
- Provides `/plan`, including trusted-project automatic Jumpstart-style `context-loader` dispatch instructions.
- Keeps delegated agents in plan mode and blocks mutating MCP tools during planning.
- Exposes plan mode through `/plan` only; it does not add a keyboard shortcut.

## Trust

Project Claude configuration can execute arbitrary hooks and MCP commands. Trusted roots live in:

`~/.pi/agent/claude-compat-trust.json`

Unknown projects prompt once in interactive mode. Non-interactive sessions skip untrusted project configuration. Untrusted `Agent` scope `both` is user-only, while explicit `project` scope is rejected; `/claude-agents` also lists user agents only.

## Commands

- `/claude-compat` — show loaded skills, rules, and hooks.
- `/claude-agents` — list discovered Claude Code and Pi agent files handled by the compatibility `Agent` tool.
- `/plan` — enter or leave read-only plan mode.
- `/plan-todos` — show plan execution progress.
- `/mcp` — show connected MCP servers, registered tools, and failures.
- `/mcp-auth <server>` — complete browser OAuth for an HTTP MCP server.
- `/reload` — reload this extension and project resources.

## Files

- `trust.ts` — shared trusted-root boundary used before project Claude config, MCP, and agent discovery.
- `claude.ts` — skills, slash aliases, rules, permissions, hooks, and questions.
- `web.ts` — public web fetch and search compatibility tools.
- `mcp.ts` — MCP transports, lazy tool registration, and tool execution.
- `subagent/` — isolated Pi subprocess agents with Claude agent discovery.
- `plan-mode/` — read-only planning and tracked execution.

## Smoke test

```bash
cd ~/.pi/agent/extensions/claude-compat
npm run smoke -- /path/to/project
```

This checks required command registration and that extension loading emits no extension errors while issuing selected compatibility commands in RPC mode. It does not assert resource, agent, tool, plan-mode, or live MCP behavior.

## Known differences

- Arbitrary Claude prompt hooks (`type: "prompt"`) are not executed. The common security-review prompt is covered deterministically.
- Claude agent model aliases map to OpenAI Codex: `haiku` → Luna, `sonnet` → Terra, and `opus` → Sol.
- `Glob` maps to Pi's `find` tool.
- MCP servers that require a fresh OAuth flow still need authentication outside this extension.
- Plan-mode Bash permits only simple read-only commands. The context-loader QMD helper is a narrowly checked exception only when its `instructions` collection is already ready, so it cannot trigger setup.
