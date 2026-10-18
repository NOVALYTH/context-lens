# 06 - Answer from the journal without reading it

**Use when**: you ask "what did we decide about X" and DECISIONS.md is long.

**Prompt**
```
Do not open DECISIONS.md in full. Run: node scripts/decisions.mjs search "<my question>". Open only the cited lines with the "get" command. Answer with the decision id and line numbers, and say if two decisions disagree.
```

**Expected effect (not measured on your files)**: far fewer lines read than a full read. See docs/MEASUREMENTS.md for the one synthetic case we did measure and its limits.
