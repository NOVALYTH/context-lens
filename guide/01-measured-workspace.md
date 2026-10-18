# 1. A measured workspace

## The problem

Every Claude Code session starts with a context that you did not type. `CLAUDE.md` is loaded, and so is every file it pulls in with an `@path` import. Skill names and descriptions are loaded too, so the catalog can find the right skill later. If that automatic part is large, each session begins heavy, every turn re-reads it, and you pay for it before you have asked anything.

Most advice on this is a feeling ("keep CLAUDE.md short"). This chapter replaces the feeling with three numbers you can compute in a second: how many tokens load automatically, how large each skill is, and whether your skill files are even valid.

Nothing here is a promise. The figures quoted are **cases** from the author's own workspace and from synthetic test data, each with its source and its limits. Your numbers will differ. The scripts are there so that you can get yours.

## The method

The method has four moves. Each one is a file or a rule in `template/`.

**1. Lazy loading.** `CLAUDE.md` imports only what is needed in every session (in the template: `progress.md`, about 70 tokens). Everything else is a *pointer*: one line that says when to read the file. The file is read when the condition is met, not at session start.

**2. State files with an archive.** `progress.md` holds what is happening now, what is blocked and the next step. When something is finished it moves to `progress-archive.md`, which nothing imports. The same pattern applies to errors: `errors.md` is an index with one line per error, and `errors-archive.md` holds the write-ups. The index is cheap to read in full; the archive is read by ID.

**3. A journal you search, not read.** If you keep a `DECISIONS.md`, it will outgrow any budget. Do not import it and do not read it whole. Chapter 2 and the `decisions.mjs` script cover how to find one decision by its words and open only its lines.

**4. A guard on skill files.** A skill is a folder with a `SKILL.md`, and the file starts with a YAML block. If the `description:` line is unquoted and contains a colon followed by a space (for example `Use when X: do Y`), the YAML is invalid and the skill silently disappears from the catalog. There is no error message; the skill just never triggers. We verified this on 2026-10-15 in the author's workspace. The fix is to wrap the description in double quotes or to avoid the colon. The check script reports this as an error so that it is caught before you wonder why a skill is not used.

## The check

```
node scripts/check-workspace.mjs [--root <dir>] [--budget 8000]
```

It is read-only and has no dependency. It does the following.

- Resolves the `@` imports of `CLAUDE.md`, including imports inside imported files (up to five levels, cycle-safe), and sums an estimated token count. The estimate is **bytes divided by four**. That is a convention, not a tokenizer: real counts differ by language, by code against prose and by model. Use the number to compare *your own files with each other and over time*, not as an absolute truth.
- Warns when the total exceeds the budget (default 8,000), and when an imported file looks like an archive or a journal.
- For every skill: checks the frontmatter exists, `name:` equals the folder name, `description:` is at least 20 characters, warns above 400 characters (the description is paid for in every session), reports the unquoted-colon error, and warns when the body exceeds 800 tokens.
- Warns when `progress.md` exceeds 1,200 tokens or `errors.md` exceeds 800.

The exit code is 1 when there is an error and 0 otherwise, so you can run it in a pre-commit hook or in CI.

On the shipped template the output is:

```
info    automatic imports: 1 file(s), ~294 tokens/session including CLAUDE.md (budget 8000)
info    skills: 1 checked
RESULT: 0 error(s), 0 warning(s)
```

That 294 is the size of an empty template. It says the *structure* is small; it says nothing about your content. The first useful run is on your own workspace.

## One case: a real workspace, before and after

The author runs a long-lived, multi-project workspace. Using the same check (bytes divided by four), the automatic imports measured, on 2026-10-15:

| Step | Tokens loaded per session |
|------|---------------------------|
| Before any trimming | 12,596 |
| After moving rarely-needed files from imports to pointers | 8,518 |
| After archiving finished state and shortening the rest | 6,551 |

That is a reduction of about 48 % on one workspace, measured with a convention. Read it as a **case, not a guarantee**: it started from a workspace that had grown by accretion, and the saving you can get depends entirely on what yours imports today. The raw files are private and are not in this repository, so this figure cannot be reproduced by you. What you can reproduce is the method: run the check, trim, run it again.

## What the savings did not prove

A smaller auto-loaded context is cheaper. It is not automatically *better*. Two risks are worth stating.

- **A pointer can be ignored.** If `CLAUDE.md` says "read `errors.md` when a command fails" and the model does not, you have lost information you had before. Try each pointer on a real task before relying on it.
- **Fewer tokens loaded is not fewer tokens used.** A session that reads an archive on demand can end up reading more than one that had a short summary loaded. The only honest comparison is two comparable sessions, measured with the tool in chapter 2.

## Finding a fact in the journal

For a journal of decisions, the repository ships a small full-text search (`scripts/decisions.mjs`, SQLite FTS5 through `node:sqlite`, no dependency) and a drift detector.

```
node scripts/decisions.mjs search "why did we choose X"
node scripts/decisions.mjs get --file DECISIONS.md --from 120 --to 140
node scripts/decisions.mjs verify
```

`search` ranks segments (one per `### D-NNN` decision, one per section for other files) and prints `file:first-last-line`, so the answer can be checked at its source. The index is rebuilt at every call in about a tenth of a second; it is derived data and cannot be stale. `verify` runs deterministic rules and reports the rule broken with its evidence: duplicate identifiers, references to decisions that do not exist, a decision that declares it amends another which is not marked amended, dated claims older than 14 days outside the journal, and (when configured) a note that calls a project active when the latest decision put it on hold.

### Measured, with their limits

The author built the search and the detector for a private workspace first. These results come from that original version:

- **Search.** On 15 questions answered with a small model (Haiku), reading through the search instead of reading the files cut tokens read by 78 % and tool calls by 59 %, with similar accuracy and one failure caused by documents that disagreed with each other. With a larger model (Sonnet) the token saving was 16 %. The raw results are private and not in this repository.
- **Detector.** On a frozen test corpus, 20 injected contradictions were detected out of 20, with no false positive, and 5 of 6 real hard contradictions were found. The tests were written by the same author as the detector, so they prove the rules are implemented, not that they generalise.

The version in this repository is a **generic rewrite** with fewer rules and its own tests (10 injections and 10 negative controls on a synthetic corpus, which it passes). The figures above must not be read as results of the rewrite. What was measured on the rewrite is in `docs/MEASUREMENTS.md`, including a lookup benchmark on a synthetic journal in which the search misses 3 of 15 questions because it matches words, not word forms (it finds "retries" but not "retry"). That limit is real: it is lexical search with no stemming and no meaning.

## Do it

1. Copy `scripts/` and the parts of `template/` that you need into a project.
2. Run `node scripts/check-workspace.mjs` and write down the number.
3. Move one large import to a pointer, run it again, and note the difference.
4. Repeat while the workspace still behaves well on your real tasks.

Stop when the numbers stop moving or when a task starts failing. The goal is a workspace you understand, not a minimum.
