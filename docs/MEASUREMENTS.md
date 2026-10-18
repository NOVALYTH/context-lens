# Measurements: every figure, its source, its limits

Rule for this repository: a number appears in the README, the guide or a prompt only if it is on this page with a source. Anything not on this page is not claimed. None of these figures is a promise about your results.

"Reproducible here" says whether you can get the number (or its equivalent) by running something in this repository.

## A. Cases from the author's own workspace (not reproducible by you)

These were measured earlier in the author's private workspace. The underlying files are not published. Treat each as one case.

| # | Figure | How it was obtained | Limits | Reproducible here |
|---|--------|---------------------|--------|-------------------|
| A1 | Auto-loaded imports: 12,596 then 8,518 then 6,551 estimated tokens per session (about 48 % lower overall), measured 2026-10-15 | `check-workspace` convention (bytes / 4) before and after two rounds of trimming | One workspace that had grown by accretion; the estimate is a convention, not a tokenizer; says nothing about task quality | Method yes, figure no |
| A2 | Search instead of reading files: 78 % fewer tokens read and 59 % fewer tool calls on 15 questions with a small model (Haiku); 16 % fewer tokens with a larger model (Sonnet); similar accuracy; one failure caused by documents that disagreed | The author's benchmark of an earlier, workspace-specific version of the search | Raw results are private; 15 questions; two models; the search in this repository is a generic rewrite, so these figures are **not** results of the code you have here | No |
| A3 | Drift detector: 20 of 20 injected contradictions detected, 0 false positives, 5 of 6 real hard contradictions found | The earlier, workspace-specific detector on a frozen test corpus | Tests written by the same author as the detector: they show the rules are implemented, not that they generalise; the rewrite here has fewer rules | No |
| A4 | In one session, about 59 % of context growth was written by the model; cumulative reading about 91.7 million tokens, about 29 million in a simulation with compaction at 200,000 | An earlier version of `scripts/measure-context.mjs` on one long session | One session; the split is an estimate (about 3.3 characters per token); the simulation ignores what compaction loses | Method yes (run it on your own sessions) |

## B. Measured on the code in this repository

| # | Figure | Command | Limits |
|---|--------|---------|--------|
| B1 | The shipped template loads about 294 estimated tokens per session (CLAUDE.md plus one import), 0 errors, 0 warnings | `node scripts/check-workspace.mjs --root template` | It is an empty template; shows the structure is small, not that your content is |
| B2 | Test suite: all tests pass on Node 22.17 on Windows 11 (count in `docs/EVIDENCE.md`) | `npm test` | Tests were written by the author of the code; they were not run on Linux or macOS here |
| B3 | The detector finds each of 10 injected inconsistencies of 5 kinds and raises nothing on 10 negative controls, on a synthetic corpus | `node --test tests/detector.test.mjs` | Synthetic and author-written; 10 and 10 is a regression test, not a measure of accuracy on real notes |
| B4 | The transcript reader, run on the session in which this repository was built (a case): first-turn context about 80,000 tokens, which is the tool and skill catalog of the author's setup rather than a project file; at the time of measurement 46 turns, 58 % of growth written by the model, one segment | `node scripts/measure-context.mjs` | One session, partial (measured while still running); the 80,000 reflects the author's many installed plugins and says nothing about yours |

## C. Synthetic benchmark (labelled)

| # | Figure | Command | Limits |
|---|--------|---------|--------|
| C1 | On a generated journal of 58 decisions (about 6,300 tokens if read whole), the search put the right decision first for 12 of 15 questions and in the top 3 for 12 of 15; the top-3 results averaged about 200 tokens per question, 3 % of reading the file whole | `node examples/bench-lookup.mjs` (regenerate the sample with `node examples/make-sample.mjs`) | The journal and the questions were written by the same author, so the hit rate is optimistic. It measures how much text is returned, not how well a model answers. **The 3 misses** ("How are images resized?", "What is the retry strategy?", "What is the backup retention?") are word-form mismatches (resized/resizing, retry/retries, retention/backups): the search is lexical, with no stemming. The questions were not tuned afterwards |

## D. Demand signals (why the first screen is about measuring context)

Method: public APIs, 30 days (2026-09-16 to 2026-10-16), Hacker News (Algolia) and issues of the `anthropics/claude-code` repository on GitHub. Reddit could not be queried and is not measured. The "question or complaint" filter is a heuristic (a question mark, or words such as limit, reduce, too much): noisy, so the counts are orders of magnitude.

| Signal | Count in 30 days | Reading |
|--------|------------------|---------|
| Issues about token usage and context | 225 | broad, explicit, recent demand |
| Issues about usage limits and quota | 38 | |
| Issues about the context window and compaction | 150 | several with 15 to 37 reactions |
| Distinct HN authors on "usage limit" threads / "token usage" threads | 21 / 7 | |
| Distinct HN authors on decision journals and memory between sessions | 3 | weak and contested: one clear dissent argues that agents need documentation, not memory |
| GitHub repositories on token-usage optimisation | 68, the highest with 15 stars | competition exists but is not followed much |

Limits: a complaint is not an intention to buy; HN and GitHub over-represent advanced developers; Reddit not measured.

## What is not claimed
No saving for your workspace. No revenue. No claim that fewer tokens loaded means better results. No claim about price or about how any plan's usage limits are computed: neither was measured.
