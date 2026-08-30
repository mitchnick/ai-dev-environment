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

## Deep research

When I ask for "deep research" / a "research report" / to "deeply research" something:

1. **Always confirm before running.** Deep research can fan out across many agents and providers and become expensive. Restate the scoped question and ask me to confirm first. If the question is underspecified, ask 2–3 clarifying questions before confirming.
2. **Use cost-tuned routing, never an inherited-model fan-out.**
   - In Claude Code, run the tuned workflow:
     `Workflow({ scriptPath: "~/.claude/workflows/deep-research-lean.js", args: "<the scoped question>" })`
   - In Pi, use `subagent` orchestration with explicit cheaper models for search, fetch, and evidence gathering; reserve the strongest model for final synthesis and verification. Do not launch every child on the parent model.
3. **Keep the same architecture:** Scope → Search → Fetch → Verify → Synthesize.
4. To adjust Claude Code's cost/quality dial, edit the `MODEL_*` constants at the top of `deep-research-lean.js`.
