---
name: jev
description: Quickly call Jev for bounded semantic decisions over supplied evidence — classify into labels, route to a candidate, answer yes/no, or score against a rubric. Use as a small tool call during other work, or when the user asks to use Jev. Not for generating text or general code review.
---

# Jev decisions

Call `~/.local/bin/jev` through the harness's shell tool. It is globally installed,
uses TypeSafe directly, and needs no project setup or subagent. Choose the question
and provide the evidence; Jev does not fetch files, URLs, or conversation history.

```bash
jev choice 'Which team should handle this?' billing support other --text 'I was charged twice.'
jev yesno 'Is the customer explicitly asking for a refund?' --text 'Please return my payment.'
jev score 'How urgent is this request?' 'Routine' 'Time-sensitive' 'Service blocked' < ticket.txt
jev choice 'Where does this note belong?' --criteria candidates.json --input json < evidence.json
jev batch questions.json --input json < evidence.json
```

`--criteria` is a JSON object mapping labels to descriptions. `batch` takes a named
question map, e.g.:

```json
{
  "refund": {"type": "noul", "instructions": "Does the customer request a refund?"},
  "team": {"type": "choice", "instructions": "Which team should handle this?", "criteria": {"billing": "Payments and refunds", "support": "Technical issues", "other": "Neither fits"}}
}
```

Batch independent questions over the same evidence in one request. Use quoted
heredocs or input files for arbitrary text; never interpolate it into shell code.
For candidate routing, include candidate descriptions and enough evidence to
distinguish them. Include an `other`/`unknown` option when none may fit.

JSON stdout preserves TypeSafe `answers`, `model`, `usage`, and adds `elapsed_ms`.
Single questions are under `answers.decision`: choice returns `choice`,
`probabilities`, `confidence`; yesno returns `noul` (P(yes)); score returns a
fractional zero-based `score`, `probabilities`, `confidence`, and `legend`.
Exit 0 means a valid answer, including no or uncertainty. Exit 1 means failure;
inspect stderr and use your own reasoning if needed. There are no automatic
retries; the default network timeout is 10 seconds.

Use probability/confidence as evidence, not proof. Inspect close alternatives
and incomplete context yourself; no universal threshold implies accuracy.
Keep counting, arithmetic, and date comparisons in code. Jev does not generate
explanations or verify factual truth outside its input. Its answer is advisory;
it does not authorize actions or replace general code review.

Credentials resolve from `TYPESAFE_API_KEY`, then `~/.config/jev/env`.
Never print the key or pass it as an argument. If missing, tell the user to set it
locally in that file with mode 600. API reference: https://docs.typesafe.ai/api.md.
