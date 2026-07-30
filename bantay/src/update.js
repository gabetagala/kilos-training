// Version display + one-tap update. Named releases so "am I on the new
// one?" is answerable at a glance; the commit sha pins it exactly.
export const BANTAY_VERSION = 'v0.3 — Lullaby';

export function initUpdate(btn, verEl) {
  verEl.textContent = `${BANTAY_VERSION} (${import.meta.env.KILOS_COMMIT})`;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    let done = false;
    const reload = () => {
      if (!done) {
        done = true;
        location.reload();
      }
    };
    try {
      // Nudge the service worker; autoUpdate + clientsClaim activates the
      // new one immediately, controllerchange tells us it took over.
      navigator.serviceWorker?.addEventListener('controllerchange', reload);
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
    } catch {
      /* offline or no SW — the fallback reload still refreshes */
    }
    setTimeout(reload, 4000);
  });
}
