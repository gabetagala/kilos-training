---
description: Ship the current branch to main — merge, push, delete branch, switch back. Use when the feature is done and tested.
---

# /ship — merge branch → main + cleanup

End of the flat-flow workflow. Run from the feature branch when the work
is done and tested on a real phone (iPhone Safari / Android Chrome).

## Pre-flight

1. **Current branch**: `git branch --show-current` — must be a `feature/*`,
   `fix/*`, `chore/*`, `refactor/*`, or `docs/*`. If on `main`, **stop**.
2. **Working tree clean**: `git status --porcelain`. If dirty, suggest
   `/save-progress` first.
3. **Show what's about to land**: `git log main..HEAD --oneline`. Ask:
   "Ship these to main?" Wait for confirmation.

## Process

1. `git checkout main`
2. `git pull origin main` — incorporate anything that landed since branching.
   If the pull fails (conflicts, network), stop and report.
3. `git merge --no-ff <branch>` — merge with a merge commit so the feature
   reads as one logical unit in history.
4. **Conflicts**: if the merge has conflicts, stop. Show the conflicting
   files. Hand back to user; don't try to auto-resolve.
5. `git push origin main`. If push fails (auth, repo missing), report and
   stop — don't delete the branch yet.
6. `git branch -d <branch>` — delete the local branch (safe delete; refuses
   if branch isn't fully merged).
7. **Done message**:

```
✅ Shipped `<branch>` to main.
   Commits: <count>
   Now on: main (up to date with origin)
```

## What NOT to do

- Don't `--no-verify` or skip hooks.
- Don't force-push.
- Don't push the feature branch to origin — this repo's flow doesn't track
  remote feature branches.
- Don't squash by default. Preserve commit history. If Gabe wants
  `--squash`, he'll ask.
- Don't `git branch -D` (force delete). Stick to `-d` — if it refuses,
  something's wrong and we should investigate, not bulldoze.

## Tone

Confident, terse. Show what's about to happen, confirm once, do it.
