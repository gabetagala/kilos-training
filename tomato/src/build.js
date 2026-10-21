// ─── The build footer, shared by every app in the set ─────────────────────
// One line at the bottom of each app: is this the current version, when was
// it built, and tap to go get the new one. Same words, same place, same
// gesture in all five — the point of a set is that you only learn it once.
//
// It is deliberately a single control rather than a status line plus an
// Update button. There is only ever one thing you want to do with this
// information, so making it two elements only invites you to read one and
// miss the other.

// Kilos stamps an ISO time (vite.config.js); the phone formats it locally.
export const BUILT_AT = Date.parse(import.meta.env.KILOS_BUILD) || 0
export const COMMIT = import.meta.env.KILOS_COMMIT || 'local'

/** Local time, always. The build machine is in UTC and the phone is not. */
function builtWhen() {
  if (!BUILT_AT) return 'dev build'
  const d = new Date(BUILT_AT)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `today ${time}`
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`
}

// checking → we have asked the service worker and not heard back
// current  → nothing newer was found
// ready    → a newer build is sitting there waiting for a reload
// offline  → we could not ask
const WORDS = {
  checking: 'checking for an update',
  current: 'up to date',
  ready: 'NEW VERSION — tap to get it',
  offline: 'offline — can’t check',
}

export function footerLabel(state = 'checking') {
  return state === 'ready' ? WORDS.ready : `${WORDS[state] || WORDS.checking} · built ${builtWhen()}`
}

/** The markup. Apps that re-render can just include this in their template. */
export function footerHTML(note = '') {
  return `<button class="fambuild" data-update type="button">${footerLabel('checking')}</button>${
    note ? `<span class="fambuild-note">${note}</span>` : ''
  }`
}

// The last thing we learned. Apps that re-render replace the footer node with
// a fresh 'checking' label, so the state has to live here and be replayable —
// otherwise Plate tells you it is checking, forever, and can never announce a
// new version because the next render wipes the word.
let state = 'checking'

function paint(next) {
  // 'ready' is terminal: once a newer build exists, nothing that arrives later
  // is allowed to downgrade that back to 'up to date'.
  if (state === 'ready' && next !== 'ready') return
  state = next
  paintFooter()
}

/** Re-apply the current state. Call after any render that rewrites the DOM. */
export function paintFooter() {
  for (const el of document.querySelectorAll('[data-update]')) {
    el.textContent = footerLabel(state)
    el.classList.toggle('ready', state === 'ready')
  }
}

let wired = false

/**
 * Ask the service worker whether anything newer exists, and make the footer
 * do something when tapped. Idempotent — apps that re-render call it freely.
 */
export function wireFooter() {
  if (wired) return
  wired = true

  // A tap is always a hard refresh, whatever we think the state is. Someone
  // pressing this has already decided the app is stale, and being told "you
  // are up to date" when you can see that you are not is the worst outcome.
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest?.('[data-update]')
    if (!btn) return
    btn.disabled = true
    btn.textContent = 'getting the new version…'
    try {
      // Prove the network BEFORE touching the caches. Wiping them while
      // offline leaves nothing to fall back on and bricks the app until
      // signal returns — a lesson this repo already learned once, in Plate.
      const probe = await fetch(`${location.pathname}?u=${Date.now()}`, { cache: 'reload' })
      if (!probe.ok) throw new Error(String(probe.status))

      if (window.caches) await Promise.all((await caches.keys()).map((k) => caches.delete(k)))
      const regs = (await navigator.serviceWorker?.getRegistrations?.()) || []
      for (const r of regs) {
        try {
          await r.unregister()
        } catch {
          /* already gone */
        }
      }
      // The query string defeats any cache between here and the server.
      location.replace(`${location.pathname}?u=${Date.now()}`)
    } catch {
      btn.disabled = false
      paint('offline')
      setTimeout(() => paint('current'), 2600)
    }
  })

  if (!('serviceWorker' in navigator)) return paint('current')

  // vite-plugin-pwa runs registerType 'autoUpdate' (skipWaiting + clientsClaim),
  // so a new worker never parks in `waiting` — it activates straight through.
  // Watching reg.waiting alone therefore reports "up to date" at the exact
  // moment a new build lands. controllerchange is the signal that actually
  // fires under this config: a new worker has taken over, so the assets this
  // page is running are the old ones.
  navigator.serviceWorker.addEventListener('controllerchange', () => paint('ready'))

  navigator.serviceWorker.getRegistration().then(
    (reg) => {
      if (!reg) return paint('current')
      if (reg.waiting) return paint('ready')
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing
        sw?.addEventListener('statechange', () => {
          // Only "installed while something already controls the page" is an
          // update; the first install is just this app arriving.
          if (sw.state === 'installed' && navigator.serviceWorker.controller) paint('ready')
        })
      })
      reg.update().then(
        () => paint('current'),
        () => paint('offline'),
      )
    },
    // getRegistration itself can reject — private browsing, storage errors.
    // Without this the footer keeps whatever label it was born with.
    () => paint('offline'),
  )

  // The set is used on phones that sit open for hours — a monitor all night,
  // a food log through a whole meal. Re-check occasionally so the footer is
  // not answering a question from this morning.
  setInterval(async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      await reg?.update()
    } catch {
      /* offline; the next tick tries again */
    }
  }, 900_000)
}
