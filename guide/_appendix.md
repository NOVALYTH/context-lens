# Appendix: sources of every figure, and known limits

Every number used in this guide is listed here with where it came from. The full version, with commands, is `docs/MEASUREMENTS.md` in the repository. None of these figures is a promise about your results.

## Cases from the author's own workspace (private files, not reproducible by you)

| Figure | Source | Limits |
|--------|--------|--------|
| Auto-loaded imports 12,596 then 8,518 then 6,551 estimated tokens per session (about 48 % lower), 2026-10-15 | The workspace check (bytes / 4) before and after two rounds of trimming | One workspace; an estimate, not a tokenizer; says nothing about task quality |
| Search instead of reading: 78 % fewer tokens read, 59 % fewer tool calls on 15 questions (small model); 16 % fewer tokens (larger model); similar accuracy, one failure from documents that disagreed | The author's benchmark of an earlier, workspace-specific version | Private raw results; 15 questions; not a result of the generic code in the repository |
| Drift detector: 20 of 20 injections found, 0 false positives, 5 of 6 real hard contradictions | The earlier version, on a frozen corpus | Tests written by the detector's author; the rewrite has fewer rules |
| One session: about 59 % of context growth written by the model; cumulative reading 91.7 million versus about 29 million in a simulation with compaction at 200,000 | An earlier version of the transcript reader | One session; the split is estimated; the simulation ignores what compaction loses |

## Measured on the code in the repository

| Figure | Command | Limits |
|--------|---------|--------|
| Template loads about 294 estimated tokens per session, 0 errors, 0 warnings | `node scripts/check-workspace.mjs --root template` | An empty template |
| Search on a generated journal of 58 decisions: right decision first for 12 of 15 questions, top 3 for 12 of 15; about 200 tokens returned per question against about 6,300 for reading the file whole | `node examples/bench-lookup.mjs` | Synthetic data; questions written by the author of the sample; the 3 misses are word-form mismatches (the search has no stemming) |
| Detector: 10 of 10 injected inconsistencies found, 0 of 10 negative controls flagged | `node --test tests/detector.test.mjs` | Synthetic and author-written: a regression test, not an accuracy measure |

## Known limits of the tools

- **Token counts** in the workspace check are bytes divided by four, a convention. Real tokenizers differ by language and by code against prose.
- **Transcript reader**: context sizes are the API's usage fields; the split between visible text, hidden reasoning and tool results is an estimate at about 3.3 characters per token. It reads the main conversation only, not sub-agent runs stored separately. It depends on the transcript format, which can change.
- **Search** is lexical (SQLite FTS5 with BM25): no stemming, no synonyms, no meaning. It uses `node:sqlite`, which Node still marks experimental, so pin your Node version and run the tests after upgrading.
- **Drift detector** knows explicit rules only: duplicate identifiers, references to nonexistent decisions, supersession not marked on the target, dated claims older than 14 days outside the journal, and (if configured) a note that calls a project active after a decision put it on hold. A free-form contradiction is not detected, and the detector does not say which document is right.
- **Platform**: tested on Node 22.17 under Windows 11 only.

## What this guide does not claim

No saving for your workspace. No revenue. No claim that fewer tokens loaded means better results. No claim about price or about how a plan's usage limits are computed. No claim that the pointers in your `CLAUDE.md` will be followed: test them.
