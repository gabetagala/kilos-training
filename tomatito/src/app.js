// ─── Tomatito — the front door to everything made for Tomás ────────────────
// A launcher, not an app. Its one clever bit: every app in the set is on the
// same origin, so this can read their storage directly and show what is
// actually happening today instead of a static list of links.

const app = document.getElementById('app')

const esc = (s = '') =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const read = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}

/** Whatever Tomato Plate knows about him — name, age, and today's food. */
function fromPlate() {
  const d = read('tomato-plate-v1')
  if (!d?.profile?.birthdate) return null
  const b = new Date(`${d.profile.birthdate}T00:00:00`)
  const now = new Date()
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth())
  if (now.getDate() < b.getDate()) months -= 1
  const day = Math.max(1, Math.floor((now - new Date(`${d.profile.startDate}T00:00:00`)) / 86400000) + 1)
  const today = new Date()
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const loggedToday = Object.keys(d.log?.[key] || {}).length
  return {
    name: d.profile.name || '',
    months: Math.max(0, months),
    day,
    tried: Object.keys(d.foods || {}).length,
    loggedToday,
  }
}

const LOGO = `<svg width="86" height="86" viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="50" r="46" fill="#C0442A"/><circle cx="50" cy="50" r="35" fill="#D4553A"/>
  <circle cx="50" cy="50" r="27" fill="#C0442A"/>
  <path d="M50 26c2 0 3 4 3 7 3-2 6-4 8-2s0 6-2 8c3 0 7 1 7 3s-4 3-7 3c2 2 4 5 2 7s-5 0-8-2c0 3-1 7-3 7s-3-4-3-7c-3 2-6 4-8 2s0-5 2-7c-3 0-7-1-7-3s4-3 7-3c-2-2-4-6-2-8s5 0 8 2c0-3 1-7 3-7z" fill="#2E6B44"/>
  <circle cx="50" cy="43" r="4" fill="#4E9060"/></svg>`

const PLATE_ART = `<svg width="38" height="38" viewBox="0 0 60 60" aria-hidden="true">
  <ellipse cx="30" cy="34" rx="21" ry="15" fill="#E09355"/><ellipse cx="30" cy="31" rx="21" ry="15" fill="#D4763C"/>
  <ellipse cx="30" cy="30" rx="13" ry="8" fill="#E09355"/>
  <path d="M45 12c4 0 6 3 6 6s-2 5-5 5l1 18" stroke="#8A7A62" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`

const CAM_ART = `<svg width="38" height="38" viewBox="0 0 60 60" aria-hidden="true">
  <rect x="8" y="16" width="34" height="28" rx="8" fill="#C0442A"/>
  <path d="M44 26l9-6v20l-9-6z" fill="#9A3520"/>
  <circle cx="25" cy="30" r="7" fill="#FAE5DF"/><circle cx="25" cy="30" r="3.4" fill="#C0442A"/></svg>`

function render() {
  const p = fromPlate()
  const who = p?.name ? esc(p.name) : 'Tomás'
  return `
    <header class="hero">
      <div class="mark">${LOGO}</div>
      <div class="wordmark">Tomatito</div>
      <p>Everything made for <span class="who">${who}</span>${p ? ` — ${p.months} months old` : ''}.</p>
    </header>

    <div>
      <div class="eyebrow" style="margin-bottom:12px">His apps</div>
      <div class="apps">
        <a class="app" href="/tomato-plate/">
          <span class="art plate">${PLATE_ART}</span>
          <span>
            <b>Tomato Plate</b>
            <span class="sub">What he eats, how to cut it, and how it went.</span>
            ${p ? `<span class="live">${p.loggedToday ? `${p.loggedToday} logged today` : `Day ${p.day} · ${p.tried} foods tried`}</span>` : ''}
          </span>
          <span class="chev">›</span>
        </a>
        <a class="app" href="/tomato/">
          <span class="art cam">${CAM_ART}</span>
          <span>
            <b>Tomato Cam</b>
            <span class="sub">Two phones, one nursery. Stays on your Wi-Fi.</span>
          </span>
          <span class="chev">›</span>
        </a>
      </div>
    </div>

    <div>
      <div class="eyebrow" style="margin-bottom:12px">Not built yet</div>
      <div class="soon">
        <div class="row"><b>Sleep</b><span>naps, nights, and the wake window</span></div>
        <div class="row"><b>Medicine</b><span>doses and when the next one is safe</span></div>
        <div class="row"><b>Firsts</b><span>what he did, when, with a photo</span></div>
      </div>
    </div>

    <p class="foot">Everything lives on this phone. Nothing is uploaded.</p>`
}

app.innerHTML = render()
