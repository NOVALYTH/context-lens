# context-lens

**See where your Claude Code context goes, then keep what loads automatically small.**

**The problem.** Claude Code re-reads the whole conversation on every turn, so a heavy start and fast growth both cost you, and neither is visible while you work. People report sessions that fill up and compact sooner than expected; a complaint is not a diagnosis.

**Measured, as cases (not guarantees).** On the author's own sessions: the auto-loaded imports of a workspace went from 12,596 to 6,551 estimated tokens, and in one session about 59 % of the context growth was written by the model, not read from files. One workspace, one session each; yours will differ. Every figure has its source and limits in [docs/MEASUREMENTS.md](docs/MEASUREMENTS.md).

**Run it** (Node 22.5 or later, nothing to install, read-only, nothing leaves your machine):

```
node scripts/measure-context.mjs
```

It reads the latest Claude Code transcript of the project in the current folder and prints, per segment of the session: context size, how much was written by the model, which tools' results filled the rest, and what a compaction at 200,000 tokens would have changed.

```
Segment 1: 46 turns, context 80 k -> 209 k (mean 160 k), cumulative reading 7.3 M
  written by the model: 75 k (58 % of growth), of which ~42 k visible, ~33 k hidden reasoning
  inputs (tool results, messages): ~54 k (42 %): Bash 21 k, Read 3 k, WebFetch 2 k, ...
  with compaction at 200 k: reading ~7.0 M (1 compactions), i.e. 95 % of actual
```

(Real output, from the session in which this repository was built, taken mid-session. It is one case.)

## What is in the box

| Path | What it is |
|------|------------|
| `scripts/measure-context.mjs` | where a session's context came from; compaction simulation |
| `scripts/check-workspace.mjs` (+ `.ps1`) | what `CLAUDE.md` loads automatically vs a token budget; skill sizes and YAML validity |
| `scripts/decisions.mjs` (+ `.ps1`) | full-text search of a `DECISIONS.md` journal with line provenance; drift detector |
| `template/` | a workspace skeleton: lazy-loading `CLAUDE.md`, short `progress.md` + archive, `errors.md` index + archive, a skill with a YAML guard |
| `skills/` | two installable skills: `context-budget`, `decision-lookup` |
| `prompts/` | eight free prompts, each with its expected effect and whether it was measured |
| `guide/` | four chapters in Markdown and an assembled PDF of 14 pages (`guide/context-lens-guide.pdf`) |
| `examples/` | a synthetic decision journal and the lookup benchmark |
| `docs/MEASUREMENTS.md` | every figure with source and limits |

## Quick start

```
git clone <this repository> && cd context-lens
npm test                                    # the whole suite, no install needed
npm run check:template                      # budget check on the shipped template
node scripts/check-workspace.mjs --root <your project>     # your own auto-loaded size
node scripts/measure-context.mjs <transcript.jsonl>        # a specific session
node scripts/decisions.mjs search "why did we choose X" --root <your project>
```

Windows PowerShell entry points exist (`scripts/check-workspace.ps1`, `scripts/decisions.ps1`). If script execution is disabled, run them with `powershell -ExecutionPolicy Bypass -File ...` or use the `node` commands above.

## Why this exists

We looked at public signals over 30 days (to 2026-10-16): on the `anthropics/claude-code` issue tracker, 225 issues about token usage and context, 38 about usage limits, 150 about the context window and compaction, several with 15 to 37 reactions. Hacker News had 21 distinct authors on "usage limit" threads. Demand for *session memory* was weaker (3 authors) and contested. So this kit starts from measuring consumption; the decision-journal search is secondary. Method and limits (Reddit not measured, noisy filter) are in [docs/MEASUREMENTS.md](docs/MEASUREMENTS.md), section D.

## FAQ

**Does it send my data anywhere?** No. The scripts use only Node built-ins, make no network call, and the transcript reader and the checks only read files. You can verify: there is no `fetch`, no `http` import (a test asserts the search code imports only `node:` modules and relative files).

**Why do I need Node 22.5?** The search uses `node:sqlite` (FTS5), added in 22.5 and still flagged experimental by Node. That is why there is no dependency to install, and also why you should pin the Node version and re-run `npm test` after upgrading.

**How exact are the token numbers?** Two kinds. In the transcript reader, context sizes are the API's own usage fields, so they are real; the split into visible text, hidden reasoning and tool results is an estimate at about 3.3 characters per token. In the workspace check, tokens are bytes divided by four, a convention that is good for comparing your own files with each other and over time, and wrong by some margin in absolute terms.

**"Memory is just a waste of context." Is it?** It depends on how large the always-loaded files are and when they load, and that is measurable. A big state file loaded every session that you rarely use is a cost; the same facts behind a pointer or a search are not. In the author's workspace, trimming took the always-loaded part from 12,596 to 6,551 estimated tokens (case A1), and in a small-model test reading through search used 78 % fewer tokens than reading files (case A2, private data, earlier version, not reproducible here). On a synthetic journal in this repository, the top-3 search results averaged about 3 % of reading the file whole (case C1, with 3 misses of 15). If `check-workspace` shows a small number and `measure-context` shows your sessions are dominated by tool results or model output, memory files are not your problem: leave them alone.

**Does a smaller context make results better?** Not shown. Fewer tokens loaded is cheaper to start, not automatically better, and a pointer the model fails to follow loses information. Test each change on a real task.

**Why does the search miss "retry" when the text says "retries"?** It is lexical (SQLite FTS5, BM25): no stemming, no synonyms, no meaning. Three of the 15 synthetic questions missed for exactly this reason, and we did not tune the questions afterwards. Search with the word forms your notes use.

**What does the drift detector catch?** Explicit rules: duplicate decision ids, references to decisions that do not exist, a decision that says it amends another which is not marked amended, dated claims older than 14 days outside the journal, and, if you configure project aliases in `.context-lens.json`, a note that calls a project active after a decision put it on hold. It does not detect a free-form contradiction and does not say which document is right. Its tests were written by the same author as the detector.

**Does it work on macOS or Linux?** The code is plain Node with no OS-specific call except the transcript folder lookup (`~/.claude/projects`, or `CLAUDE_CONFIG_DIR`). It was tested only on Node 22.17 under Windows 11. Reports from other systems are welcome.

**Will the transcript format change?** It can. The reader depends on the fields Claude Code writes in its session files (assistant messages with usage, tool results). If a future format breaks it, it will print nothing useful rather than harm anything: it is read-only. It reads the main conversation and skips sub-agent runs stored as side chains.

**Why does the skill YAML guard exist?** An unquoted `description:` containing a colon followed by a space is invalid YAML, and the skill silently disappears from the catalog (verified 2026-10-15). The check reports it as an error.

**What is `.context-lens.json`?** Optional configuration read by `scripts/decisions.mjs` from the project root: `{ "journal": "DECISIONS.md", "staleDays": 14, "projects": [ { "key": "billing", "aliases": ["billing service"] } ] }`.

**Is any saving guaranteed?** No. Every number here is a case with limits. Measure yours.

## Limits, in one place

Estimates, not tokenizer counts. Single cases, not distributions. Synthetic benchmark written by its author. Lexical search only. Explicit-rule drift detection only. Tested on one OS and one Node version. A tool that reads transcripts depends on a format it does not control.

## License

MIT, see [LICENSE](LICENSE).
