# Free prompts

Eight prompts for the workspace patterns in `template/`. Each one states its expected effect and says plainly when that effect is **not measured**. None promises a saving; measure yours with `npm run check` (auto-loaded size) and `npm run lens` (where a session's context came from).

| # | Prompt | Goal |
|---|--------|------|
| 01 | [Audit what loads automatically](01-audit-auto-loaded.md) | rank imports by size |
| 02 | [Imports to on-demand pointers](02-lazy-claude-md.md) | stop loading what is rarely needed |
| 03 | [progress.md + archive](03-progress-and-archive.md) | short always-loaded state |
| 04 | [Errors index + archive](04-errors-index.md) | cheap error memory |
| 05 | [Invisible skill](05-fix-invisible-skill.md) | YAML colon guard |
| 06 | [Find a decision](06-find-a-decision.md) | read cited lines only |
| 07 | [Hand-off before compaction](07-handoff-before-compaction.md) | restart from a file |
| 08 | [Bounded reads](08-bounded-reads.md) | smaller tool results |
