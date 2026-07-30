// Screen Wake Lock with re-acquisition — the app-level half of keep-awake.
// Guided Access (Display Auto-Lock: Never) is the OS-level backstop; a wake
// lock can be refused in Low Power Mode, so losing it must be shown loudly.
//
// iOS can reject the request on page load (Low Power Mode, or no user
// activation yet), so acquisition retries on every tap, on visibility
// return, and on a slow interval — a refusal is never terminal.
export function keepAwake(onChange) {
  if (!('wakeLock' in navigator)) {
    onChange(false, 'unsupported');
    return;
  }
  let held = false;
  let inflight = false;

  async function acquire() {
    if (held || inflight || document.visibilityState !== 'visible') return;
    inflight = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      held = true;
      lock.addEventListener('release', () => {
        held = false;
        onChange(false, 'released');
      });
      onChange(true);
    } catch (err) {
      held = false;
      onChange(false, err.name);
    } finally {
      inflight = false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') acquire();
  });
  document.addEventListener('pointerdown', () => acquire(), { passive: true });
  setInterval(acquire, 30_000);
  acquire();
}
