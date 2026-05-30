---
description: Start the Vite dev server in the background and tell user the local URL. Use when you want to see the app running.
---

# /preview — start dev server

## Process

> ⚠️ **Don't assume port 5173.** Gabe also runs the `grit-training-affiliate`
> repo, which often occupies 5173. Vite auto-increments — always parse the
> actual port from the dev server's output, don't hardcode.

1. **Start the dev server** in the background:

```bash
npm run dev
```

Use `run_in_background: true` so it doesn't block the conversation.

2. **Wait for the URL line**. Monitor the background output until you see
   `Local:   http://localhost:<PORT>/`. Parse the actual port from that
   line — that's the signal Vite is ready.

3. **Tell the user** with the actual URL:

```
✅ Dev server up: http://localhost:<PORT>

Mobile DevTools tip: in Chrome desktop, open the URL, hit cmd-opt-i,
then cmd-shift-m for the responsive view → iPhone 14 Pro.
```

If `vite --host` is needed for LAN testing on a real phone, mention that
(the user has to opt in; `npm run dev` doesn't enable it by default).

## What NOT to do

- Don't restart if it's already running.
- Don't kill an existing dev server without confirming with the user first.
- Don't run in the foreground — it'll block.
