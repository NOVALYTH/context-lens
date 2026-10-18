# 4. Skills

Two skills ship as installable files in the repository, under `skills/`. They are not reproduced in the PDF: the files are the product, and a copy in a PDF would drift from them.

| Skill | Folder | What it does |
|-------|--------|--------------|
| `context-budget` | `skills/context-budget/` | Walks through reducing what `CLAUDE.md` loads automatically, using the check script and reporting before and after numbers. |
| `decision-lookup` | `skills/decision-lookup/` | Answers "what did we decide about X" by searching the journal and opening only the cited lines, with the source. |

## Install

A skill is a folder containing a `SKILL.md`. Copy the folder into one of the two places Claude Code looks for skills:

- in a project: `<project>/.claude/skills/<skill-name>/SKILL.md` (shared with the team through the repository);
- for your user account: `~/.claude/skills/<skill-name>/SKILL.md` (available in every project).

For example, from a clone of this repository:

```
cp -r skills/context-budget  <project>/.claude/skills/
cp -r skills/decision-lookup <project>/.claude/skills/
```

On Windows PowerShell, `Copy-Item -Recurse skills\context-budget <project>\.claude\skills\`. Both skills call scripts from this repository (`scripts/check-workspace.mjs`, `scripts/decisions.mjs`), so copy `scripts/` into the project as well, or adjust the paths in the skill text.

## How a skill is loaded, and what it costs

Only the **name and description** of a skill are loaded at the start of a session, so the catalog can match a request to a skill. The **body** is read when the skill is invoked. This has two practical consequences, both of which the check script encodes:

- a long description costs tokens in every session, so it warns above 400 characters;
- a long body costs tokens only when used, so the threshold is looser: it warns above 800 tokens.

## The YAML guard

The block between the two `---` lines at the top of `SKILL.md` is YAML. In YAML, an unquoted text that contains a colon followed by a space is read as a key and a value, not as text. A description such as

```
description: Use when the user asks to rename: finds every import
```

is therefore invalid, and the skill silently disappears from the catalog; there is no warning at session start. We observed this on 2026-10-15. Two safe forms:

```
description: "Use when the user asks to rename: finds every import"
description: Use when the user asks to rename a module and update its imports
```

`node scripts/check-workspace.mjs` reports the first, unquoted form as an error. The test suite includes a test that both shipped skills pass the same check.

## Write your own

Copy `template/.claude/skills/example-skill/`, rename the folder, set `name:` to the folder name, write a description of one sentence that says *when* to use it, then run the check. Keep the body to the steps; if it needs reference material, put that in a separate file and link to it so that it loads only when needed.

A caution that applies to every skill, including these two: a skill is instructions that the model follows. Read any skill you install, including ones from this repository, before you enable it.
