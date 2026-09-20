# Jev primitive

Dependency-free Python 3 client for TypeSafe's decision API, shared by agent
harnesses. Install the executable globally:

```bash
mkdir -p ~/.local/bin
ln -s "$PWD/claude-code/custom/jev/jev.py" ~/.local/bin/jev
```

Run from this repository root; preserve any existing destination. Make the script
executable. Set `TYPESAFE_API_KEY` in the environment or `~/.config/jev/env` (mode
600). No keys belong in this repository. The local `jev` skill lives canonically
in `~/.claude/skills/jev`, linked from `~/.agents/skills/jev` for Codex. The bundled `SKILL.md` supplies this skill on new machines; follow
[the setup guide](../../../SETUP.md#jev-classifier-primitive-claude-code-and-codex)
for command, skill, credential, and verification steps.

```bash
jev choice 'Which team handles this?' billing support other --text 'Refund please'
jev yesno 'Is a refund requested?' --text 'Refund please'
jev score 'How urgent?' 'Routine' 'Urgent' 'Blocked' < ticket.txt
jev batch questions.json --input json < evidence.json
```

`jev --help` lists options. Batch files use the native named question-map schema:
[TypeSafe API reference](https://docs.typesafe.ai/api.md). Choice description maps
can be supplied with `--criteria path.json` instead of positional labels.

Output is the validated provider response plus elapsed milliseconds. Exit 0
includes negative and uncertain answers; exit 1 signals failure. No automatic
retry or confidence cutoff. Ten-second network timeout by default. Input is
literal text unless `--input json` is supplied. No project files are loaded
implicitly, and calls do not depend on Knox or direnv.

Run offline checks with `python3 -m unittest discover -s claude-code/custom/jev`.
