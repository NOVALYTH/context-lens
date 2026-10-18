# context-lens: measure where your Claude Code context goes

A short guide with scripts. It helps you do two things: shrink what your Claude Code workspace loads automatically, and find a fact in a decision journal without reading it whole. Version 0.1, October 2026. Free.

## What this is, and what it is not

It is a method and four small tools: a budget check for the workspace, a transcript reader that shows where a session's context came from, a full-text search for a decision journal, and a drift detector for notes that disagree. They are read-only, have no dependency beyond Node 22.5 or later, and send nothing anywhere.

It is not a promise. Every number in this guide is either a **case** (one workspace, one session, one small test) or a measurement on **synthetic data**, and each comes with its source and its limits in the appendix. Nothing here says you will save a given amount. It tells you how to measure whether you did.

It is not a general introduction to AI, and it does not cover prompting beyond the eight prompts in chapter 3.

## Contents

1. A measured workspace: what loads automatically, and how to shrink it.
2. Token economy and using Claude Code with intent: where a session's context comes from.
3. Free prompts: eight prompts, each with its expected effect and whether it was measured.
4. Skills: two installable skills and the YAML guard.

Appendix: sources of every figure, and known limits.

## How to read it

Read chapter 1 and run the check on your own workspace first; the number you get is worth more than any number in this guide. Chapter 2 is for when your sessions feel expensive and you want to know why. Chapters 3 and 4 are reference material.

The repository holds the scripts, a ready-to-copy workspace template, the prompts as separate files and the skills as installable folders. Run `npm test` to see the whole test suite pass on your machine before you trust anything.
