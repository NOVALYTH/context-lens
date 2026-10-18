# 2. Token economy and using Claude Code with intent

## The problem

People report that Claude Code sessions consume more than they expected: usage limits arrive sooner than planned, the context fills up and gets compacted at inconvenient moments. The complaints are common and recent (see "Why this exists" in the README for how we looked), but a complaint is not a diagnosis. Before changing habits you want to know *where the tokens of your own sessions actually came from*.

This chapter explains the one mechanism that matters, then shows how to measure it on a real session with `scripts/measure-context.mjs`, then lists habits whose effect you can check with that same tool.

## The mechanism: the context is re-read on every turn

A Claude Code session is a sequence of turns. On each turn the model is given the whole conversation so far (your messages, its replies, every tool result) and produces the next step. The conversation only grows, so **the amount read per turn grows with it**, and the total read over the session grows faster than the context itself.

A small example makes the shape clear. If the context starts at 20,000 tokens and grows by 1,000 per turn for 100 turns, it ends at 120,000, but the total read across the session is the sum of 100 numbers between 20,000 and 120,000: about 7 million. Doubling the number of turns does not double that total; it more than doubles it. What you control is how fast the context grows and where it is reset.

Two caveats. Providers cache repeated prefixes, so a large part of what is re-read is served from a cache; the transcript records it separately (`cache_read_input_tokens`). We count it in the *context size* because it is part of what the model reads; we do not claim anything about price or about how your plan's limits are computed, because we did not measure those.

## The measurement

```
node scripts/measure-context.mjs                 # latest session of the project in this folder
node scripts/measure-context.mjs file.jsonl      # a specific transcript
node scripts/measure-context.mjs --window 200000 # compaction threshold used by the simulation
node scripts/measure-context.mjs --json
```

The script reads the transcript that Claude Code stores under your home folder (`~/.claude/projects/<project>/<session>.jsonl`). It is **read-only**, makes no network call, sends nothing anywhere, and has no dependency. It reports, for each *segment* of the session (a segment ends where the context drops by more than half, which is a compaction or a clear):

- the number of turns and the context size at the start, at the end and on average;
- the **cumulative reading**: the sum of the context sizes of all turns;
- how much of the context growth was **written by the model**, split into visible text and tool calls against reasoning that is not displayed;
- how much came from **inputs**: tool results and your messages, with the five largest tools;
- a **simulation**: with the same growth but a compaction at the window you give, what would the cumulative reading have been.

How exact is it? Context sizes come from the usage fields the API returned, so they are the real numbers. The split between visible text, hidden reasoning and tool results is an **estimate** at about 3.3 characters per token, and the simulation assumes that a compaction brings the context back to the smaller of 112,000 tokens and half the window. It tells you the order of magnitude of what compaction would have changed, not an exact figure, and it ignores what is lost when information is compacted away.

### One case from a long session

On one working session of the author, the script reported:

- about **59 %** of the context growth was written by the model itself (text, tool calls and reasoning), and the rest came from tool results and messages;
- a cumulative reading of about **91.7 million** tokens, against about **29 million** in the simulation with a compaction at 200,000.

This is one session. It is *not* a typical value and it is not a promise that compacting early will save two thirds for you; it shows that, in at least one real case, the model's own output was the larger source of growth, which is the opposite of the common assumption that "big files" are always to blame. Run it on your own sessions before drawing any conclusion. `docs/MEASUREMENTS.md` also lists a short session measured while this repository was built.

## What the measurement points to

The tool turns a general worry into three questions:

1. **Is my starting context large?** First segment, first-turn context. If yes, chapter 1 applies: trim what loads automatically.
2. **Are tool results the biggest input?** Look at the top tools. A tool that dominates (file reads, command output, search) suggests asking for bounded reads.
3. **Is the model's own output the biggest source?** Then long reasoning and long answers are what grows your context, and the lever is how much you ask it to write, and when you reset.

## Habits to try, and how to check each

Each habit is a hypothesis. The check is two comparable sessions measured with the same command.

- **Bounded reads.** Ask for a search before a read, for line ranges instead of whole files, and for filtered output. Check: the top-tools line of the next comparable session.
- **Hand-off before compaction.** When a session has done its job, write the state to `progress.md` (prompt 07) and start fresh, instead of letting the context grow to the compaction point and relying on an automatic summary. Check: the segment count and the cumulative reading.
- **Small always-loaded files.** Chapter 1. Check: `check-workspace`.
- **Short descriptions on skills.** A skill's description is loaded every session; its body only when invoked. Check: the 400-character warning.
- **Ask for what you need.** Long explanations you will not read still enter the context and are re-read on every later turn. Say when you want a short answer. Check: the "written by the model" share.

None of these is guaranteed to help in your case. A session that was dominated by something else will not change. A habit that hides information the model needed will cost you more than it saves; the clearest signal is a task that starts failing.

## The objection: "memory is a waste of context"

A fair objection to everything above: if state files load into the context, aren't they exactly the waste you are trying to remove? Some people argue that agents need documentation, not memory.

The answer is that it depends on size and on when the content is loaded, and that this is measurable instead of arguable. A state file that loads in every session and that you rarely use is a cost; the same facts behind a pointer, or behind a search, are not. In the author's workspace the always-loaded part went from 12,596 to 6,551 tokens, and finding a fact through search read far fewer tokens than reading the files in a small-model test (chapter 1, with its limits). Measure your own: if `check-workspace` shows a small number and `measure-context` shows that your sessions are dominated by tool results or model output, the memory files are not your problem, and you should leave them alone.

## Do it

1. Run `node scripts/measure-context.mjs` on your last long session. Write down the segment table.
2. Pick the biggest contributor. Change one thing.
3. Run it on the next comparable session and compare. One comparison is an anecdote; three are the beginning of evidence.
