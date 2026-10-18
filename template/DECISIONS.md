# Decisions

Format searched by `scripts/decisions.mjs`: one `### D-NNN - Title` heading per decision, then `**Date**:` and `**Status**:` lines.

### D-001 - Example: use a monorepo

**Date**: 2026-01-05
**Status**: Decision made

We keep all packages in one repository so that a change to a shared library and its callers lands in one commit.
