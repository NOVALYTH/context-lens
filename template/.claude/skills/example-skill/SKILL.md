---
name: example-skill
description: "Use when the user asks to rename a module: finds every import of the old name and updates it."
---

# Example skill

Replace this body with the steps of your skill. Keep it short: the body is loaded only when the skill is invoked, but it still costs tokens then.

## YAML guard
The block between the `---` lines above is YAML. An unquoted description that contains a colon followed by a space (for example `Use when X: do Y`) is invalid YAML, and the skill silently disappears from the catalog. Wrap the description in double quotes, as above, or avoid the colon. `npm run check` reports this as an error.
