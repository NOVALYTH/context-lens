# 02 - Turn imports into read-on-demand pointers

**Use when**: you decided that a file is not needed in every session.

**Prompt**
```
In CLAUDE.md, replace the "@" import of <FILE> with a one-line instruction that says when to read it and how (for example "read only when a command fails"). Keep the file itself unchanged. Show me the diff of CLAUDE.md only.
```

**Expected effect (not measured)**: the file stops loading at session start and is read only when the condition is met. Risk: the model may not read it when it should; test with a real task before trusting it.
