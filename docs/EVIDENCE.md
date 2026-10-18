# Delivery evidence (generated 2026-10-16 on Node 22.17, Windows 11)

Re-run each command to reproduce. The internal-names search uses a pattern list kept outside the repository (listing the names here would defeat the search); its result is a count only.

## 1. Tree
```
.gitignore
README.md
distribution/README.md
distribution/awesome-claude-code.md
distribution/directories.md
distribution/email-capture.md
distribution/launch-checklist.md
distribution/show-hn.md
distribution/topics.md
docs/EVIDENCE.md
docs/MEASUREMENTS.md
examples/bench-lookup.mjs
examples/decisions-sample/DECISIONS.md
examples/make-sample.mjs
guide/01-measured-workspace.md
guide/02-token-economy.md
guide/03-free-prompts.md
guide/04-skills.md
guide/_appendix.md
guide/_front.md
guide/build-pdf.mjs
guide/context-lens-guide.html
guide/context-lens-guide.pdf
package.json
progress.md
prompts/01-audit-auto-loaded.md
prompts/02-lazy-claude-md.md
prompts/03-progress-and-archive.md
prompts/04-errors-index.md
prompts/05-fix-invisible-skill.md
prompts/06-find-a-decision.md
prompts/07-handoff-before-compaction.md
prompts/08-bounded-reads.md
prompts/README.md
scripts/check-workspace.mjs
scripts/check-workspace.ps1
scripts/decisions.mjs
scripts/decisions.ps1
scripts/measure-context.mjs
scripts/search/detector.mjs
scripts/search/lib.mjs
skills/context-budget/SKILL.md
skills/decision-lookup/SKILL.md
template/.claude/context/errors-archive.md
template/.claude/context/errors.md
template/.claude/context/progress-archive.md
template/.claude/context/progress.md
template/.claude/skills/example-skill/SKILL.md
template/CLAUDE.md
template/DECISIONS.md
tests/check-workspace.test.mjs
tests/detector.test.mjs
tests/measure-context.test.mjs
tests/search.test.mjs
```

## 2. Tests (`npm test`)
```
ok  1 - the shipped template passes with no error and no warning
ok  2 - an unquoted description with ": " is an error (skill would vanish)
ok  3 - a quoted description with ": " is accepted
ok  4 - name different from folder, missing frontmatter, short description
ok  5 - imports are summed recursively; missing import is an error; budget warning
ok  6 - import cycles do not loop and archives imported are flagged
ok  7 - the installable skills of this repository have valid frontmatter
ok  8 - the clean corpus has no finding
ok  9 - injections: each produces at least one new finding of the targeted rule
ok  10 - negative controls: none produces a new finding
ok  11 - known limit: a free-form semantic contradiction is not detected
ok  12 - claim-against-decision is inactive without configured projects
ok  13 - splits at compaction and attributes growth
ok  14 - simulation compacts when the window is exceeded
ok  15 - project folder name replaces every non-alphanumeric character
ok  16 - one segment per decision, with exact line provenance
ok  17 - every segment reproduces exactly the lines it cites, and long sections are split
ok  18 - build is deterministic and regenerable after deleting the index
ok  19 - search ranks by BM25 and returns provenance; an explicit file list limits the corpus
ok  20 - queries cannot inject FTS5 operators and stopwords are dropped
ok  21 - no external dependency: only node: built-ins and relative imports
# tests 21
# pass 21
# fail 0
# skipped 0
```

## 3. Budget check on the template (`npm run check:template`)
```
info    automatic imports: 1 file(s), ~294 tokens/session including CLAUDE.md (budget 8000)
info    skills: 1 checked
RESULT: 0 error(s), 0 warning(s)
```

## 4. Lookup benchmark (`node examples/bench-lookup.mjs`)
```
journal: 58 decisions, ~6318 tokens if read whole
questions: 15; right decision first: 12/15; among top 3: 12/15
mean tokens returned by top-3 search: ~200 per question (3 % of a full read)
```

## 5. Figures of the guide and their sources
See `docs/MEASUREMENTS.md` (sections A to D) and the appendix of the guide. Sections: A = cases from the private workspace (not reproducible), B = measured on this code, C = synthetic benchmark, D = demand signals.

## 6. Internal names, secrets, personal paths
Search over every file including ignored ones (`rg --no-ignore --hidden`, excluding `.git`) for the internal-name pattern list (project, session and account names, personal paths, user names, payment-provider names): **0 occurrences**.
Secret-pattern search (key prefixes, `password`, `secret`, `token =`): only ordinary words in the synthetic sample journal (a decision titled "Password storage", one titled "Secret handling") and in documentation text; no credential.

## 7. PDF
guide/context-lens-guide.pdf: 14 pages (limit asked: 10 to 15). Rebuild: `node guide/build-pdf.mjs` (needs an installed Chromium-based browser).

## 8. Not done, on purpose
No commit, no push, no remote, no account, no deployment, no license file, no e-mail form. `distribution/` and `progress.md` are in `.gitignore`.
