# 05 - A skill that does not show up

**Use when**: a skill exists on disk but never triggers or is missing from the catalog.

**Prompt**
```
Open the SKILL.md frontmatter of <SKILL>. Check three things: the name equals the folder name, the description is not empty, and the description is valid YAML. In particular, an unquoted description that contains a colon followed by a space is invalid YAML. If you find one, wrap the description in double quotes without changing its words, and tell me what you changed.
```

**Expected effect (not measured)**: fixes the colon case, which we observed make a skill invisible. Other causes exist; `npm run check` reports this one deterministically.
