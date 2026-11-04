# Personal global instructions

This file is the canonical global instruction source for both Claude Code and Pi. Pi loads it through `~/.pi/agent/AGENTS.md`.

## Cross-harness skill authoring

Write shared skills and instructions using interfaces supported by both harnesses:

- For structured questions, use Claude Code's canonical `AskUserQuestion` shape with a `questions` array. Pi's Claude compatibility extension accepts the same shape, including `multiSelect`.
- For Claude-style agents, use `Agent` with `subagent_type`, `prompt`, and optional `description`. Pi's Claude compatibility extension accepts those fields as aliases. Do not rewrite shared skills to Pi-only `agent` / `task` syntax.
- Prefer prose such as "ask the user" when the exact interaction does not need a structured selector. Let the active harness choose its native question tool.
- Keep harness-specific behavior in clearly labeled branches instead of assuming Claude Code-only tools exist in Pi or Pi-only tools exist in Claude Code.

Canonical structured-question example:

```text
AskUserQuestion({
  questions: [
    {
      question: "Which option should I use?",
      header: "Approach",
      options: [
        { label: "Option A", description: "Use the first approach." },
        { label: "Option B", description: "Use the second approach." }
      ],
      multiSelect: false
    }
  ]
})
```

Canonical shared-agent example:

```text
Agent(
  description: "Inspect the implementation",
  subagent_type: "reviewer",
  prompt: "Review the implementation and report evidence-backed findings."
)
```

## Local skills in Codex

Always include the current project's `.claude/skills/**/SKILL.md` files when
discovering skills for Codex, including applicable directories between the
working directory and repository root. Read names and descriptions first;
read a matching skill in full before using it. A skill missing from Codex's
advertised list is not evidence that it is unavailable locally.
Also check `~/.claude/skills/**/SKILL.md` for globally installed skills missing
from the advertised list. Prefer an already discovered skill with the same
exact name; do not substitute a similarly named skill.

The Codex instruction bridge exposes these directories through relative
`.agents/skills` symlinks at session start and on prompts. When `.agents/skills`
is an existing directory, it adds a `claude-local` link inside it. Keep
`.claude/skills` canonical; do not copy skills or overwrite existing paths.
If native discovery has not refreshed, use the original skill files directly.
In the custom Codex CLI, invoke skills from the `/` menu: type `/skill-name`,
then use Tab to complete or Enter to submit. Selection inserts a native
`$skill-name` mention bound to the skill's exact file; arguments are preserved.
This applies to all enabled skills in the native catalog, including project,
global, and plugin skills. Built-in commands keep their names; a conflicting
skill appears as `/skill:name` (with another `skill:` prefix if needed).
Stock Codex still uses `$skill-name` or `/skills`; instructions alone cannot
add slash-menu entries. The custom CLI patch must be installed separately.
A literal `\skill-name` at the start of a message remains an instruction-level
fallback: resolve the exact name, read its SKILL.md in full, and follow it with
any arguments. Report a missing skill instead of guessing. Quoted examples
and questions about the syntax are not invocations.
Map harness-specific tools to Codex's native equivalents while preserving the
workflow's requirements. Report a required capability that has no equivalent.

## Jev classifier primitive

Use `~/.local/bin/jev` for small bounded semantic decisions over supplied evidence:
classifying into labels, selecting a candidate, yes/no checks, or rubric scoring.
It is available globally without project setup. For example:
`jev choice 'Which team?' billing support other --text 'I was charged twice.'`
JSON output includes the answer and probabilities; failures exit 1. Batch related
independent questions into one request. Read `~/.claude/skills/jev/SKILL.md` for
batch/structured input. Use this as a quick shell tool call during other work;
no subagent is needed. Keep exact calculations in code, and inspect uncertain
answers yourself. Jev is not a general code reviewer or a source of new facts.

## Web search

The built-in `WebSearch` tool is denied. Web search goes through Keenable's API via the `keenable` CLI:

```bash
keenable search "the query"                  # realtime, 10 results
keenable search "the query" --mode pro --max 15   # deeper, slower, costs more
keenable fetch <url> --prompt "what to pull out"  # server-side extraction of one page
```

Add `--json` to either for the raw response. The key lives at `~/.config/keenable/env` (mode 600) and resolves as `KEENABLE_API_KEY` → that file → direnv. It works in every project, with no direnv and no specific project checkout. Never pass it on the command line.

Use `keenable fetch` when you need real page text and `WebFetch` was blocked or returned a summary. `/research` is unaffected: its runner calls Keenable and five other providers directly.

Source: `~/.local/bin/keenable`.

Never hand me a phone, WhatsApp or bank number taken from a search snippet, a social caption or a third-party directory. Scammers seed real business names next to fake numbers, and search engines index them like anything else. Verify the number on the business's own site or a verified business listing, and check for an official anti-fraud page. If it can't be verified, say so rather than offering a plausible number.

## Deep research

When I ask for "deep research" / a "research report" / to "deeply research" something:

1. **Always confirm before running.** Deep research can fan out across many agents and providers and become expensive. Restate the scoped question and ask me to confirm first. If the question is underspecified, ask 2–3 clarifying questions before confirming.
2. **Use cost-tuned routing, never an inherited-model fan-out.**
   - In Claude Code, run the tuned workflow:
     `Workflow({ scriptPath: "~/.claude/workflows/deep-research-lean.js", args: "<the scoped question>" })`
   - In Pi, use `subagent` orchestration with explicit cheaper models for search, fetch, and evidence gathering; reserve the strongest model for final synthesis and verification. Do not launch every child on the parent model.
3. **Keep the same architecture:** Scope → Search → Fetch → Verify → Synthesize.
4. To adjust Claude Code's cost/quality dial, edit the `MODEL_*` constants at the top of `deep-research-lean.js`.

## Tech preferences

Defaults for new projects. A project's own `CLAUDE.md` may override.

- **Rails backend** with **Postgres**
- **Tailwind** for styling
- **React** only when a full SPA is warranted; otherwise **Hotwire Turbo + Stimulus**
- **No TypeScript** — vanilla JS
- **Prettier**: `{"semi": false, "useTabs": true, "singleQuote": true}`
