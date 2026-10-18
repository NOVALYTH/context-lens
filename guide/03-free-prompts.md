# 3. Free prompts

Eight prompts for the patterns in chapters 1 and 2. Each one says what it is for and what effect to expect. Where the effect has **not** been measured, it says so: none of these promises a saving. Measure yours with `check-workspace` (auto-loaded size) and `measure-context` (where a session's context came from).

How to use them: paste the prompt into Claude Code in your project, replacing the <PLACEHOLDERS>. Read the diff before accepting. Run the check after.

## Prompt 1: Audit what loads automatically

**Use when**: sessions start with a large context before you type anything.

**Prompt**
```
List every file my CLAUDE.md imports with "@", directly or through other imports. For each one give its size in bytes and an estimate of tokens (bytes / 4). Sort by size. Do not change anything. Then tell me which three imports are the least likely to be needed in every session, and why.
```

**Expected effect (not measured)**: a ranked list you can act on. It does not reduce anything by itself; the reduction comes from the edits you then choose. Cross-check the numbers with `npm run check`.

## Prompt 2: Turn imports into read-on-demand pointers

**Use when**: you decided that a file is not needed in every session.

**Prompt**
```
In CLAUDE.md, replace the "@" import of <FILE> with a one-line instruction that says when to read it and how (for example "read only when a command fails"). Keep the file itself unchanged. Show me the diff of CLAUDE.md only.
```

**Expected effect (not measured)**: the file stops loading at session start and is read only when the condition is met. Risk: the model may not read it when it should; test with a real task before trusting it.

## Prompt 3: Keep progress.md short, archive the rest

**Use when**: the end of a work session, or progress.md keeps growing.

**Prompt**
```
Rewrite .claude/context/progress.md so it holds only: what is being worked on now, what is blocked, and the next concrete step (under 25 lines). Append everything finished to .claude/context/progress-archive.md under today's date. Do not delete any information; show me both diffs.
```

**Expected effect (not measured)**: a smaller always-loaded file. Information is kept in the archive, which is not imported.

## Prompt 4: Errors as an index plus an archive

**Use when**: errors.md has become a long diary.

**Prompt**
```
Convert errors.md into a table with one row per error: ID, symptom, fix in one line. Move the full write-up of each error to errors-archive.md under the same ID. Keep every fact; if two entries describe the same error, merge them and say so.
```

**Expected effect (not measured)**: errors.md becomes cheap to read in full; details are fetched by ID when needed.

## Prompt 5: A skill that does not show up

**Use when**: a skill exists on disk but never triggers or is missing from the catalog.

**Prompt**
```
Open the SKILL.md frontmatter of <SKILL>. Check three things: the name equals the folder name, the description is not empty, and the description is valid YAML. In particular, an unquoted description that contains a colon followed by a space is invalid YAML. If you find one, wrap the description in double quotes without changing its words, and tell me what you changed.
```

**Expected effect (not measured)**: fixes the colon case, which we observed make a skill invisible. Other causes exist; `npm run check` reports this one deterministically.

## Prompt 6: Answer from the journal without reading it

**Use when**: you ask "what did we decide about X" and DECISIONS.md is long.

**Prompt**
```
Do not open DECISIONS.md in full. Run: node scripts/decisions.mjs search "<my question>". Open only the cited lines with the "get" command. Answer with the decision id and line numbers, and say if two decisions disagree.
```

**Expected effect (not measured on your files)**: far fewer lines read than a full read. See docs/MEASUREMENTS.md for the one synthetic case we did measure and its limits.

## Prompt 7: Write the hand-off before the context is compacted

**Use when**: a long session approaches the point where you will compact or restart.

**Prompt**
```
Before we compact, write progress.md so that a fresh session can continue with no other context: the goal, what is done (with file names), what is not done, decisions taken and why, and the exact next command. Keep it under 40 lines. Do not include secrets.
```

**Expected effect (not measured)**: after compaction the next session starts from a file you control rather than from an automatic summary alone.

## Prompt 8: Ask for bounded reads and filtered output

**Use when**: tool results (file reads, logs, command output) dominate your context. `npm run lens` shows which tools contribute most.

**Prompt**
```
From now on in this session: search with grep before reading a file, read only the line ranges you need, and pipe long command output through head, tail or a filter. If you must read a large file in full, tell me its size first and ask.
```

**Expected effect (not measured)**: smaller tool results per turn. Compare `npm run lens` on a similar session with and without this instruction; one comparison is an anecdote, not proof.

## A note on pointers

Several prompts move content from "always loaded" to "read when needed". That trade works only if the model actually reads the file when it should. After applying prompt 02, give the model a real task that needs the moved file and watch whether it opens it. If it does not, make the pointer more specific (name the trigger) or put the file back.
