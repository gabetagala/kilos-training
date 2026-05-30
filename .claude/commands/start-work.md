---
description: Start a new piece of work on its own branch off main. Use this when opening a second terminal to work on a parallel feature/fix.
---

# /start-work — start a new branch off main

Flat flow: `main` is trunk, work happens on short-lived `feature/*`,
`fix/*`, `chore/*` branches that merge back to `main`. No `release` layer.

Purpose: safe parallel work across terminals — each terminal stays on its
own branch so changes don't collide.

## Argument

- `/start-work` (no args) — ask interactively.
- `/start-work <type> <short-description>` — use args directly.

## Allowed branch types

| Type | When to use |
|---|---|
| `feature` | New functionality |
| `fix` | Bug fix |
| `chore` | Tooling, deps, configs, cleanup |
| `refactor` | Code restructure, no behavior change |
| `docs` | Markdown / documentation only |

Reject anything else and ask the user to pick from this list.

## Process

### Step 1 — Pre-flight

1. `git rev-parse --show-toplevel` — confirm we're in the repo root.
2. `git status --porcelain` — if there are uncommitted changes, **stop**.
   List the changed files and ask whether to commit them on the current
   branch first, stash them, or discard. Don't proceed until clean.
3. `git branch --show-current` — if already on a `feature/*` / `fix/*` /
   `chore/*` branch with unpushed commits, warn. They may have meant to
   finish that work first.

### Step 2 — Get type + description

If args weren't passed, ask:

1. "What type? (feature / fix / chore / refactor / docs)"
2. "Short description? 2–4 words, what the work is *about*."

Validate the description:
- Lowercase only.
- Letters, numbers, dashes only (auto-convert spaces → dashes).
- Reject if longer than 40 characters — ask for shorter.
- Reject vague descriptions: `stuff`, `things`, `updates`, `work`, `changes`.

Show the resulting branch name (`<type>/<description>`) and confirm before
creating it.

### Step 3 — Sync main

```bash
git checkout main
git pull origin main
```

If the pull fails (conflicts, network, auth), stop and report what happened.
If the origin remote isn't reachable (e.g. repo not on GitHub yet), skip the
pull and continue — local main is the source of truth.

### Step 4 — Create the branch

```bash
git checkout -b <type>/<description>
```

Confirm by running `git branch --show-current` and verifying the name
matches.

### Step 5 — Done message

Tell the user, concisely:

```
✅ Ready on `<branch-name>`. Branched off latest main.

Next:
  • Make your changes
  • Commit when you have a working chunk
  • When done: push, then either merge to main or open a PR
```

## What NOT to do

- **Do NOT push the new branch yet.** Empty branches can't be pushed; the
  first push happens after the first commit.
- **Do NOT branch from anything other than `main`.** This repo has no
  `release` branch.
- **Do NOT auto-resolve uncommitted changes.** Never `git stash` or
  `git checkout .` without explicit consent.
- **Do NOT run `git pull` on a dirty working tree.** It can cause merge
  conflicts or aborted pulls.

## Edge cases

- **Branch name already exists locally or on origin:** tell the user,
  suggest a more specific suffix.
- **User passed args for a branch they're already on:** don't recreate.
  Ask if they meant to keep working on it.
- **User on `main` with uncommitted changes:** stop. Help them get to a
  clean state first.

## Tone

Short, friendly. Gabe ships fast — explain a git command in one phrase
only if it's running visibly. No lectures. Use ✅ / ⚠️ / ❌ markers for
status only, no other emoji.
