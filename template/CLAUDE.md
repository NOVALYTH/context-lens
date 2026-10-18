# Project rules

Loaded in every session. Keep this file and its imports under ~8,000 tokens (`npm run check:template`).

## Always loaded (imports)
@.claude/context/progress.md

## Read on demand (do NOT import these)
- Past errors and their fixes: `.claude/context/errors.md` is an index; open it only when a command fails or before repeating a risky operation. Details: `.claude/context/errors-archive.md`.
- Older progress: `.claude/context/progress-archive.md`.
- Decisions: never read `DECISIONS.md` whole. Search it: `node scripts/decisions.mjs search "<question>"`, then open only the cited lines.
- Skills load their body only when invoked; keep descriptions short.

## Working rules
- Verify a fact at its source file before stating it; a search result is a pointer, not proof.
- At the end of a session, rewrite `progress.md` (keep it short) and move what is finished to `progress-archive.md`.
