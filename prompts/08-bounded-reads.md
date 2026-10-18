# 08 - Ask for bounded reads and filtered output

**Use when**: tool results (file reads, logs, command output) dominate your context. `npm run lens` shows which tools contribute most.

**Prompt**
```
From now on in this session: search with grep before reading a file, read only the line ranges you need, and pipe long command output through head, tail or a filter. If you must read a large file in full, tell me its size first and ask.
```

**Expected effect (not measured)**: smaller tool results per turn. Compare `npm run lens` on a similar session with and without this instruction; one comparison is an anecdote, not proof.
