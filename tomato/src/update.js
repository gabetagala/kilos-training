// The update line at the bottom of every Tomato Cam page: which build this
// is, and one tap to load the newest.
//
// These pages have no service worker (vite.config.js strips it), so updating
// is just a fresh load. The check fetches this same page uncached and
// compares the build stamp Kilos bakes into every page's HTML
// (<meta name="kilos-build">). When a newer one is up, the line turns tomato.
// It never reloads by itself: a cam that refreshes at 3am drops the stream.
const mine = document.querySelector('meta[name="kilos-build"]')?.content || '';

/** Local time, always. The build ran in UTC; the phone reading it is not. */
function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'locally';
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return `today ${time}`;
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}

export function wireUpdate(btn) {
  if (!btn) return;
  let ready = false;
  const paint = () => {
    btn.classList.toggle('ready', ready);
    btn.textContent = ready ? 'New version ready. Tap to update' : `Up to date, built ${when(mine)}. Tap to refresh`;
  };
  paint();

  btn.onclick = () => {
    btn.disabled = true;
    btn.textContent = 'Updating';
    // The query string gets past every cache between here and Vercel.
    location.replace(`${location.pathname}?u=${Date.now()}`);
  };

  const check = async () => {
    if (ready || !mine) return;
    try {
      const res = await fetch(`${location.pathname}?check=${Date.now()}`, { cache: 'no-store' });
      const theirs = (await res.text()).match(/name="kilos-build" content="([^"]+)"/)?.[1];
      if (theirs && Date.parse(theirs) > Date.parse(mine)) {
        ready = true;
        paint();
      }
    } catch {
      /* offline: the label just stays as it is */
    }
  };
  setTimeout(check, 3000);
  setInterval(check, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}
