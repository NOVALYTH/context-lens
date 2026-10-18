---
name: context-budget
description: "Use when the user asks why sessions start heavy, wants to reduce what CLAUDE.md loads automatically, or asks for a context or token budget check of the workspace."
---

# Context budget

Goal: shrink what the workspace loads in every session, without deleting information.

1. Run `node scripts/check-workspace.mjs` (or `npm run check`). It lists the `@` imports of `CLAUDE.md`, sums an estimated token count (1 token ~ 4 bytes), and flags skills with invalid YAML.
2. For each import over ~1,500 tokens, ask whether it is needed in EVERY session. If not, remove the `@` line and replace it with a one-line pointer saying when to read the file.
3. Move finished or historical content to an archive file that is never imported (`progress-archive.md`, `errors-archive.md`).
4. Re-run the check and report the before and after numbers as one case, not as a guarantee.

Do not claim a saving that the check did not print. The estimate is a convention, not a tokenizer count.
