# 07 - Write the hand-off before the context is compacted

**Use when**: a long session approaches the point where you will compact or restart.

**Prompt**
```
Before we compact, write progress.md so that a fresh session can continue with no other context: the goal, what is done (with file names), what is not done, decisions taken and why, and the exact next command. Keep it under 40 lines. Do not include secrets.
```

**Expected effect (not measured)**: after compaction the next session starts from a file you control rather than from an automatic summary alone.
