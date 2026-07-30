// Screen Wake Lock with re-acquisition — the app-level half of keep-awake.
// Guided Access (Display Auto-Lock: Never) is the OS-level backstop; a wake
// lock can be refused in Low Power Mode, so losing it must be shown loudly.
export function keepAwake(onChange) {
  if (!('wakeLock' in navigator)) {
    onChange(false, 'unsupported');
    return;
  }
  async function acquire() {
    try {
      const lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => onChange(false, 'released'));
      onChange(true);
    } catch (err) {
      onChange(false, err.name);
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') acquire();
  });
  acquire();
}
