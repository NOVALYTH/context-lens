---
name: decision-lookup
description: "Use when the user asks what was decided, why something was chosen, or whether notes contradict each other, and a DECISIONS.md journal exists."
---

# Decision lookup

Never read `DECISIONS.md` whole once it is long.

1. Search: `node scripts/decisions.mjs search "<question>"`. The output gives `file:first-last-line` and a decision id.
2. Open only the cited lines: `node scripts/decisions.mjs get --file DECISIONS.md --from <first> --to <last>`.
3. State the answer with its source (id and line). A search hit is a pointer, not proof: confirm at the source lines before asserting.
4. If the user asks whether documents disagree, run `node scripts/decisions.mjs verify` and report each finding with its rule and evidence. The detector only knows explicit rules (duplicate ids, missing references, unmarked supersession, stale dates, optional status claims); say so when it finds nothing.
