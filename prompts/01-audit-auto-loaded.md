# 01 - Audit what loads automatically

**Use when**: sessions start with a large context before you type anything.

**Prompt**
```
List every file my CLAUDE.md imports with "@", directly or through other imports. For each one give its size in bytes and an estimate of tokens (bytes / 4). Sort by size. Do not change anything. Then tell me which three imports are the least likely to be needed in every session, and why.
```

**Expected effect (not measured)**: a ranked list you can act on. It does not reduce anything by itself; the reduction comes from the edits you then choose. Cross-check the numbers with `npm run check`.
