---
description: Checkpoint your current work — stage modified files and commit with a smart message. Use mid-feature when you have a working chunk.
---

# /save-progress — mid-work commit

Quick checkpoint commit on the current branch. Not the final commit — that
happens in `/ship`. Don't push.

## Process

### Step 1 — Verify branch

Run `git branch --show-current`. Must be a `feature/*`, `fix/*`, `chore/*`,
`refactor/*`, or `docs/*` branch.

If on `main`: **stop**. Tell the user to run `/start-work` first.

### Step 2 — Show what changed

Run `git status` and `git diff --stat` in parallel. Show output to the user.

### Step 3 — Stage

Stage modified + untracked files explicitly by name. Prefer:

```bash
git add src/ public/ index.html vite.config.js package.json CLAUDE.md .claude/
```

…or a more targeted list based on what actually changed. **Never** `git add -A`
or `git add .` (could sweep up `.env*` or other sensitive files).

Skip:
- `.env*` (any environment file)
- `node_modules/`
- Build artifacts (`dist/`, `.vite/`)
- Anything obviously credential-shaped

### Step 4 — Draft commit message

Based on the diff:

- Format: `<type>: <short summary>` — match the branch's type prefix.
- Focus on the **why** when non-obvious; otherwise describe the **what**.
- Match the repo's style (see `git log --oneline -5`).
- Include the co-author trailer:

```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

### Step 5 — Confirm + commit

Show the message. Ask "commit?" Wait for confirmation. Then commit using a
HEREDOC for clean formatting:

```bash
git commit -m "$(cat <<'EOF'
<type>: <summary>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Step 6 — Done

Run `git log --oneline -3` and confirm the new commit landed. Don't push.

## What NOT to do

- Don't push. `/ship` does that when the work is done.
- Don't `git add -A` or `git add .`.
- Don't skip hooks (`--no-verify`).
- Don't amend a previous commit — always create a new one.

## Tone

Terse. Show the staged files briefly so Gabe can sanity-check. No lecture.
