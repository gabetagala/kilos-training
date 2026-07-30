# Tomato Cam — Baby Monitor Scope

> **Renamed 2026-07-30 (v0.5):** the product is now **Tomato Cam**, served at
> `/tomato` (old `/bantay` URLs 301-redirect). "Bantay" below is historical;
> internal storage keys keep the `bantay-` prefix so pairing survives.
>
> **Original working title:** *Bantay* (Tagalog: to watch over / stand guard).
>
> **One-line spec:** *"Never wonder if the silence is normal."* The product is not
> the video stream — it's the guarantee that if the stream dies, you are woken up.

A personal-use baby monitor built from the two phones already in the house:

| Role | Device | Does |
|---|---|---|
| **Cam** (baby unit) | iPhone 13, plugged in, on a shelf | Captures + streams video/audio. Screen always on, nearly black. |
| **View** (parent unit) | iPhone 17 Pro, plugged in, bedside | Plays the stream. Watchdog + loud alarm. Screen always on, dimmed UI. |

Both phones on the same home Wi-Fi. Video/audio flows **peer-to-peer over the LAN
via WebRTC** — it never touches a server. Supabase Realtime is used **only** to
exchange the connection handshake. Personal tool: one household, no accounts UI,
no public launch.

### Rule zero: there is no background streaming. Period.

iOS suspends camera capture and WebRTC **the instant the tab closes, Safari
backgrounds, or the screen locks** — on either phone, with no workaround
available to web apps (verified current through iOS 26). This is the rock every
prior browser-based baby monitor died on (Gonimo, KGBaby). So:

- The **cam phone is a dedicated appliance for the night**: tab open, screen on,
  Guided Access locked. It has no other job until morning.
- The **view tab can close and return** — the cam keeps its side alive and the
  viewer reconnects in seconds — but while the view tab is closed there is **no
  audio and no alarm**, and the UI says so bluntly instead of pretending.
- If background monitoring while you use the parent phone ever becomes a hard
  requirement, that is native-app territory (the one privilege commercial apps
  buy with a native build). Out of scope here.

This scope is grounded in a 5-track research pass (July 2026) over iOS/WebKit
bug trackers, Apple dev forums, Supabase docs, and prior art, followed by an
adversarial review against the actual Kilos repo. Facts marked **[verified]**
were confirmed against current primary sources. Most of the budget goes to
keep-alive + watchdog + recovery — WebRTC connection setup is the easy 20%.

---

## 1. Decisions (TL;DR)

| # | Decision | Why (short) |
|---|---|---|
| D1 | **Lives inside the Kilos repo** as a multi-page sub-app at `/bantay/` on the Kilos domain | Inherits working Vite build, Vercel HTTPS deploy, configured Supabase. Personal tool — brand separation doesn't matter. |
| D2 | **Runs in a Safari tab, NOT an installed/standalone PWA** | iOS standalone mode doesn't persist camera permission (re-prompts every launch) and shipped capture regressions in 18.0, 18.1, 26.0, 26.0.1 that Safari-tab mode escaped. [verified] |
| D3 | **H.264, 640×480 @ 15 fps, ~400 kbps cap** | H.264 is hardware-encoded on iPhone (VP8/VP9 are software — Apple measured ~1h extra battery from H.264). Low res = less heat, less memory pressure, fewer jetsam reloads. A crib doesn't need 1080p. [verified] |
| D4 | **Host-only ICE (empty `iceServers`) by default** | Same-subnet LAN needs no STUN. Bonus: even if a stranger hijacks the signaling handshake, ICE can't complete from outside the LAN — the video is physically unreachable off-network. STUN behind a config flag for weird subnet setups. |
| D5 | **Supabase Realtime broadcast for signaling; private channel pinned to the owner's `auth.uid()`** | ~30–70 messages per handshake vs 2M/month free quota. Kilos doesn't use Realtime, so no interference. `to authenticated` alone is NOT enough — Kilos has open sign-ups. [verified] |
| D6 | **The alarm lives on the receiver and keys off `getStats()` deltas + heartbeat — never off close events or ICE state** | WebKit documentedly fails to fire close events on silent network loss (bug 247943), and ICE takes ~30s to report `failed`. Frozen-frame-with-no-alarm is the #1 documented parent horror story. [verified] |
| D7 | **Page death is treated as normal, not exceptional — on BOTH phones** | No credible report exists of a getUserMedia page surviving 8–12h on iOS; WebKit memory-reloads even foreground pages. Zero-tap recovery on the cam; auto-rejoin + one-tap re-arm on the view. [verified] |
| D8 | **Talk-back audio m-line is pre-negotiated on day one** (view mic track, `sendonly`, `enabled=false`) | Enabling talk-back becomes a renegotiation-free `enabled=true` flip. Never exercise Safari's rollback/renegotiation paths at 3am. Also pre-warms the viewer's mic permission → real-IP ICE candidates. |
| D9 | **No battery telemetry — it's impossible** | `navigator.getBattery` never shipped in WebKit. Converted into: hard "cam stays plugged in" rule + the watchdog is the battery proxy (dead phone → dead stream → alarm). [verified] |
| D10 | **Audio is the primary channel at night; video is supplementary** | iPhone has no IR illuminator — a dark nursery is near-black. Always-visible noise meter + history is the proof-of-life UI. Recommend a dim warm nightlight. |
| D11 | **Bantay pages are fully self-contained (inline JS/CSS), no framework, no TS, no state lib** | Same vanilla rules as Kilos, plus: a stale service-worker-cached page must still be a *complete working* page, immune to deploy version-skew (see §2). The cam page must be memory-flat and boring. |
| D12 | **Alarm latency spec (canonical):** first audible signal ≤5s after stream death; full loud must-dismiss alarm ≤15s | One number set, used identically in features, drills, and milestone exit criteria. |

> **Decision update (2026-07-30, v0.5):** Gabe permanently cut **talk-back
> and ALL cam-phone audio** — nothing may ever make a sound in the nursery.
> D8 (pre-negotiated talk-back m-line) and the §4.2 cam-side last-resort
> beeper no longer apply; M3's talk-back/white-noise items are dead. Viewer
> death is covered by §7 hardening + §4.3.5 auto-rejoin only.

---

## 2. What "inside Kilos" means concretely

New top-level folder, new Vite entry points, zero imports from Kilos app code
(only `src/config.js` for the Supabase URL/key):

```
kilos-training/
├── bantay/
│   ├── SCOPE.md              ← this file
│   ├── index.html            → kilos.app/bantay/          role picker (Cam / View)
│   ├── cam.html              → kilos.app/bantay/cam.html   baby unit
│   ├── view.html             → kilos.app/bantay/view.html  parent unit
│   └── src/                  (built inline into each page — see D11)
│       ├── signal.js         Supabase Realtime channel: offer/answer/ICE/beacon
│       ├── peer.js           RTCPeerConnection setup, codec pinning, recovery ladder
│       ├── watchdog.js       getStats poller + heartbeat monitor + alarm escalation
│       ├── alarm.js          dual-path alarm: looping <audio> + AudioContext (§4.2)
│       ├── meter.js          noise meter (cam-side analyser → beacon; view renders)
│       ├── wake.js           wake lock acquire/re-acquire; release-while-visible = alarm
│       └── checklist.js      the Setup Ritual UI (§7)
```

**The integration, complete (red-team-corrected — it is NOT just vite.config):**

1. `vite.config.js` — multi-page inputs:
   ```js
   build: { rollupOptions: { input: {
     main: 'index.html',
     'bantay': 'bantay/index.html',
     'bantay-cam': 'bantay/cam.html',
     'bantay-view': 'bantay/view.html',
   } } }
   ```
2. `vite.config.js` — keep the Kilos service worker's SPA fallback off these
   pages (same pattern as coach pages):
   `navigateFallbackDenylist: [/^\/coach-/, /^\/bantay/]`
3. `vercel.json` — **required or `/bantay/` opens Kilos**: the existing
   catch-all `"/((?!coach-cilyn).*)" → /index.html` rewrites directory URLs to
   the Kilos SPA (exact-file URLs survive; `/bantay/` does not). Mirror the
   coach-cilyn pattern:
   ```json
   { "source": "/bantay",  "destination": "/bantay/index.html" },
   { "source": "/bantay/", "destination": "/bantay/index.html" },
   { "source": "/((?!coach-cilyn|bantay).*)", "destination": "/index.html" }
   ```
4. `src/supabase.js` — one-line Kilos change: `signOut()` must become
   `supabase.auth.signOut({ scope: 'local' })`. The current default (`global`)
   revokes **every** refresh token for the user — signing out of Kilos on any
   device would, within ≤1h, kill Bantay's private-channel auth on *both*
   phones mid-night. (`local` also matches Kilos' own multi-device model
   better.)
5. **Deploy discipline:** no production deploys while a night session is
   running. Mechanism: `registerType: 'autoUpdate'` + `clientsClaim` means a
   deploy can race a 3am cam-page reload — the old SW serves stale precached
   HTML while the new SW purges the old hashed chunks it references → a blank,
   script-dead page. D11 (fully inline pages) makes a stale page still *work*;
   the cam page additionally listens for `controllerchange` and self-reloads
   while idle so version skew resolves itself. The no-deploy rule is the
   belt-and-braces on top.

**Same-origin consequences (all verified against the repo):**

- Kilos has **no `getUserMedia` call anywhere** → granting the origin camera+mic
  "Allow" only ever serves Bantay.
- Kilos has **no Realtime usage** in `src/supabase.js` → flipping Realtime's
  "Allow public access" off for private channels can't break Kilos (re-grep at
  M1 time before flipping).
- localStorage is shared → all Bantay keys are prefixed `bantay-*` (Kilos owns
  `kilos-*`).
- A phone already signed into Kilos **shares its Supabase auth session** with
  the Bantay pages (same origin, same `sb-*-auth-token` key) → private channels
  work with zero extra sign-in UI. The pre-flight verifies `getSession()` is
  present and the uid is the owner's on both phones (§7).
- No standalone-PWA meta tags in the bantay HTML files → a home-screen bookmark
  opens in Safari, which is exactly the run mode we want (D2).
- Coupling accepted: a broken Kilos deploy takes Bantay down with it. Personal
  tool; acceptable — see rule 5 above.

---

## 3. Hard platform constraints (the physics — all [verified])

These are not design choices. Everything in §4 exists because of this list.

1. **No background operation, ever** (rule zero above). Capture tracks mute on
   lock/background with no programmatic unmute. Applies to both phones.
2. **Receiver audio also dies on lock.** No background-audio trick exists for
   web apps (unchanged through Safari 26.x). Locking the parent phone = no
   monitor and no alarm. Cannot be engineered around — only made loud and
   visible.
3. **iOS Safari memory-reloads pages that use "significant memory"** — routinely,
   *including foreground pages* — and long capture sessions die with
   *"MediaStreamTrack ended due to a capture failure."* An 8–12h run **will**
   eventually hit one, on either page. Two rapid crashes can also trigger
   Safari's *"A problem repeatedly occurred"* interstitial, which stops
   auto-reloading entirely until a human taps (residual risk in R2).
4. **An incoming call blacks the video and mutes audio with NO DOM event.** The
   cam page literally cannot know it happened. Detection must live on the
   receiver.
5. **Airplane mode + Wi-Fi does NOT block FaceTime or Wi-Fi Calling** — they
   ring over Wi-Fi. (The trap in the popular trick. Checklist handles it.)
6. **Autoplay:** the view page (not a capturing page) needs a real tap to start
   unmuted playback, and a fresh `play()` after a reload can throw
   `NotAllowedError`. The cam page IS capturing → autoplay-exempt, which is why
   it can emit sound without a gesture (used in §4.2's last-resort beeper).
7. **iOS silent mode can mute Web Audio output** (ambient session category)
   while media-element playback ignores it — and the iPhone 17 Pro's Action
   Button toggles silent mode in one accidental press. The alarm must not
   depend on a single audio path (§4.2), and the drill must confirm you *heard*
   it, not that it played.
8. **Wake Lock** (iOS 16.4+) auto-releases on `visibilitychange`, can be refused
   in Low Power Mode, and Low Power Mode forces 30s auto-lock *despite* wake
   locks. Guided Access with **Display Auto-Lock = Never** is the OS-level
   backstop on the cam; on the view phone, Auto-Lock: Never for the night is
   the equivalent.
9. **No web API for**: screen brightness (manual + near-black UI only — helps
   genuinely on OLED), battery level (D9), background running. Torch *does*
   work via `applyConstraints({advanced:[{torch:true}]})` on iOS 17.5+ —
   feature-detect, treat as bonus.
10. **HTTPS required** for getUserMedia/WebRTC — satisfied by the Vercel domain.
11. **iOS point releases repeatedly regress web media** (18.0, 18.1, 26.0,
    26.0.1 each broke something). Auto-updates OFF on the cam phone;
    smoke-test after every manual update.

---

## 4. Architecture

### 4.1 Connection lifecycle

```
CAM (iPhone 13)                                VIEW (iPhone 17 Pro)
────────────────                               ──────────────────
getUserMedia FIRST (real-IP candidates,        one deliberate "Start monitoring" tap:
sidesteps mDNS/local-network prompt class)       - starts unmuted playback
        │                                        - unlocks BOTH alarm paths (§4.2)
        ▼                                        - (pre-warms mic permission for talk-back)
RTCPeerConnection (host-only ICE)                        │
        │                                                │
        └────── Supabase Realtime private channel ───────┘
                 topic: bantay:<crypto.randomUUID()>
                 events: offer / answer / ice / beacon
        │
        ▼
   P2P media on the LAN (H.264 640×480@15, audio with
   noiseSuppression:false, echoCancellation:false, autoGainControl:true
   so faint baby sounds aren't gated away)
        +
   1 Hz data channel, BOTH directions:
     cam → view: {ts, audioLevel, wakeLockHeld, visible}
     view → cam: {ts, armed}
```

- Signaling is needed only at setup, ICE restart, and recovery — an overnight
  Supabase/internet outage does **not** kill an established LAN stream (§8
  tests this explicitly: pull the WAN cable mid-stream).
- `setCodecPreferences` pins H.264 before `createOffer`. `maxBitrate` /
  `degradationPreference` are applied **best-effort only** — their iOS support
  is unverified, so the real control is the getUserMedia constraints.
- Fixed negotiation roles: cam = polite. Perfect negotiation (implicit
  rollback, safe on Safari 15.4+) is used for the initial handshake and ICE
  restarts only; talk-back never renegotiates (D8).
- Every mid-session state change (talk-back on/off, mute) is signaled over the
  data channel, never inferred — Safari fires no transceiver mute/unmute events.
- **Noise meter source of truth is the cam side**: the cam runs a Web Audio
  AnalyserNode on its *local* stream (known-good path) and ships `audioLevel`
  in the beacon; the view renders from the beacon. A view-side analyser on the
  *remote* stream is a historically flaky WebKit path — it may be added as an
  extra net only if M0 proves it returns real (non-zero) data on these phones.

### 4.2 The watchdog + alarm (this IS the product)

**Canonical latency (D12): first audible signal ≤5s; full loud alarm ≤15s.**

View-side, three independent nets, escalation starts on the first to trip:

| Net | Mechanism | Catches |
|---|---|---|
| Frames | `getStats()` every 2s: `framesDecoded` delta, `bytesReceived` delta, `totalAudioEnergy` delta (each field defensively optional — WebKit has shipped incomplete stats) | Frozen video, silent audio, network death — *including* the "connected but frozen" state ICE never reports |
| Heartbeat | 1 Hz cam→view beacon on the data channel; escalate on 3 missed | Cam page wedged, capture died, tab reloaded |
| Dead-man | Cam also broadcasts a beacon over Supabase every 15s; compared against the P2P heartbeat | Distinguishes "cam phone died" from "LAN path broke" → different copy: *"stream lost, retrying"* vs *"internet down, can't re-establish"* vs *"signaling auth failed"* (see §2.4) |

**The watchdog must not die with the page's timers**: its tick is clocked off
the gesture-unlocked AudioContext (self-rescheduling), and each tick compares
against the wall clock — drift beyond a few seconds is itself an alarm
condition. Plain `setInterval` is not trusted as the only clock.

**The alarm is dual-path, because iOS silent mode mutes Web Audio in the
ambient session category while the healthy stream masks the problem** (the
unmuted `<video>` holds a playback session — so a naive drill passes at 10pm
and the alarm dies silently at 3am):

- Path 1: looping `<audio>` element (data-URI tone), pre-unlocked by the Start
  tap, volume-ramped.
- Path 2: AudioContext oscillator through the same unlocked context.
- `navigator.audioSession.type = 'playback'` set where available
  (feature-detected).
- Checklist: silent mode OFF on the view phone (mind the Action Button),
  media volume up. Drill copy: **"confirm you HEARD it"** with the phone in
  its overnight state — not that it played.

**Escalation:** silent auto-reconnect immediately → audible chirp at ≤5s →
loud repeating must-be-dismissed alarm at ≤15s. On reconnect, tracks are
swapped into the *same* `<video>` element (never a new element) so autoplay
policy is never re-triggered without a gesture. This copies the market
leader's stance (Cloud Baby Monitor beeps continuously on connection loss) —
the one behavior every parent complaint in the research validates.

**If the VIEW vanishes, the CAM becomes the alarm of last resort**: the cam
page is capturing → autoplay-exempt → it can emit sound with no gesture. On 3+
missed view→cam beacons with no rejoin, the cam plays a rising alert tone — a
beeping nursery wakes the house; a silently dead monitor doesn't. (Disabled
during deliberate viewer handoffs/role swaps.)

**Wake-lock release while still visible** (LPM kicked in, OS refused renewal)
= immediate loud alarm on whichever phone it happens on — there are seconds of
audio runway before a lock actually lands; use them.

**Never trusted as alarm inputs:** `onclose`/`onerror` (WebKit bug 247943 —
don't fire on silent network loss), `iceConnectionState` (up to 30s to
`failed`), Supabase socket state (~25–35s detection), Presence (tens of
seconds of lag — pre-connect UI only).

### 4.3 Recovery ladder

Cam side:
1. Track `mute`/`ended` → immediately re-run `getUserMedia` while the per-site
   grant is warm; swap via `replaceTrack` (no renegotiation).
2. `iceConnectionState: disconnected` → 3s grace → `restartIce()` (Safari 14.1+).
3. Signaling down → supabase-js reconnects itself (1/2/5/10s backoff, forever,
   auto channel rejoin); on `SUBSCRIBED` + peer presence, cam issues a fresh
   offer. Auth/`CHANNEL_ERROR` failures get their own alarm copy (§2.4).
4. Page reloaded (memory kill) → on load: silently re-acquire gUM (per-site
   Allow = no prompt), rejoin channel, re-offer. **Zero taps.** The cam page is
   a crash-only program: load → capture → connect, idempotent every time.
   Residual: Safari's repeated-crash interstitial (§3.3) — the view alarm and
   the M2 double-kill drill cover it.

View side:
5. Page reloaded → if `bantay-armed` flag is set in localStorage: auto-rejoin
   **muted** (gesture-free picture back in seconds), flash the screen at full
   brightness, and demand one tap to re-arm sound + alarm; the coverage gap is
   logged and shown. A view-page death is *not* silent: the cam-side
   last-resort beeper (§4.2) covers the window.
6. Full ladder failed ≥15s → loud alarm continues until dismissed; recovery
   never requires touching the cam phone.

### 4.4 Memory discipline (BOTH pages)

Single static pages. No MediaRecorder, no accumulating arrays, no Sentry, no
analytics. Event log is a capped ring buffer in `bantay-log`. The view page
renders the noise history to a fixed-size canvas, not a growing DOM. Every byte
not allocated is jetsam-reload probability removed — and the view page carries
the alarm, so it matters there just as much.

---

## 5. Features by tier

**Must-have (M1–M2 — the trust minimum):**
1. Pairing via QR/link carrying the 128-bit channel code (`bantay-pair` stored
   per phone; re-pairing is rare).
2. The watchdog + dual-path escalating alarm (§4.2) — D12 latencies.
3. Zero-tap cam recovery + view auto-rejoin/re-arm (§4.3) — recovery never
   touches the cam phone.
4. Wake lock on both phones with re-acquire; release-while-visible alarms
   (§4.2). Cam status beacon rendered on view (page visible / wake lock held /
   stream flowing / uptime).
5. Always-visible noise meter + last-30-min history, sourced from the cam-side
   beacon (§4.1) — proof-of-life and the primary night-time signal (D10).
6. Noise-threshold alert with adjustable sensitivity (the VOX-equivalent).
7. The Setup Ritual (§7) as an in-app pre-flight — including the signed-in
   check on both phones — and the **alarm drill** ("confirm you HEARD it").
8. Night UI: near-black cam screen; view shows big clock + noise meter + video,
   OLED-black, dimmable by CSS overlay.
9. Cam-side last-resort beeper when the viewer vanishes (§4.2).

**Nice-to-have (M3 — only after a week of clean overnight soaks):**
- Talk-back push-to-talk (the pre-negotiated `enabled=true` flip). Known
  tradeoff: cam mic runs `echoCancellation:false`, so the parent's voice out of
  the cam speaker re-enters the mic — while talk-back is keyed, the cam ducks
  its noise meter and the view suppresses the noise-threshold alert.
- White-noise/lullaby playback on the cam phone (capturing page →
  autoplay-exempt; same echo/ducking caveat).
- Screen-as-dim-red-nightlight mode on the cam; torch toggle where supported
  (iOS 17.5+, feature-detected).
- Noise-event snapshot strip ("what was that at 3:12?").
- Second viewer (lolo/lola) — one cam, N views; host-only ICE still fine on the
  LAN; cam-side beeper logic must then track *all* armed viewers.

**Out of scope (locked — every one adds failure surface to the only feature
that matters):**
- Remote/off-LAN viewing (drags in TURN + cloud + privacy story), cloud
  recording, sleep analytics, cry-detection AI, breathing/motion detection,
  accounts/multi-family, Android/desktop *camera* role, background operation
  (rule zero), monetization of any kind. LAN-only privacy — "the video
  physically cannot leave the house" — is the identity; a 2026 App Store
  entrant charges $29.99/yr for exactly this pitch.

---

## 6. Milestones

**M0 — Spike (one evening).** Hardcoded channel name, public channel, two ugly
pages, no watchdog: prove cam→view H.264 video+audio on the actual two phones
over the actual home router. Test: 5 GHz vs 2.4 GHz bands; router client
isolation (the one LAN pathology host-only ICE can't beat); WAN-pull mid-stream
(stream must survive); **cam-side analyser audioLevel arrives in the beacon and
shows real room audio** (this is the meter's source of truth — verify it before
building UI on it); optionally probe the view-side remote-stream analyser for
non-zero data. *Exit: sustained 30-min stream, <1s latency, survives WAN pull,
meter shows real audio.*

**M1 — It streams properly (a weekend).** Real pages + pairing, private channel
+ RLS pinned to owner UUID (flip Realtime public access off; re-grep Kilos
first), Kilos `signOut` scope fix, vercel.json rewrites, codec/constraint
pipeline, recovery ladder both sides, wake locks, night UI. *Exit: 2h stream;
kill Wi-Fi → zero-tap cam recovery; force-reload cam page → back in <15s;
force-reload view page → muted picture back gesture-free + re-arm flow works.*

**M2 — You can trust it overnight (the real milestone).** Watchdog + dual-path
alarm + cam beeper + drill + checklist + noise meter/threshold. Then the drill
+ soak protocol (§8). *Exit: 3 consecutive clean overnight soaks — every stream
death alarmed within D12 latencies, zero silent failures, cam ≥80% battery and
warm-not-hot at 7am.*

**M3 — Comforts.** Talk-back, white noise, nightlight, snapshots, second
viewer. Each behind its own soak.

---

## 7. The Setup Ritual (one-time + nightly pre-flight)

In-app checklist with per-item explainers; the app verifies what JS can see
(wake lock held, page visible, permissions granted, session signed-in + uid =
owner — on both phones).

**Cam phone (iPhone 13) — one-time:**
- [ ] Per-site **Camera & Microphone → Allow** (aA menu → Website Settings) —
      this is what makes zero-tap recovery possible.
- [ ] **FaceTime OFF**, **Wi-Fi Calling OFF** (the airplane-mode trap, §3.5).
- [ ] Focus/DND allowing no one; notifications quiet.
- [ ] **Auto-Lock: Never**; **Low Power Mode: OFF**; Auto-Brightness OFF.
- [ ] Optimized Battery Charging OFF (or accept the 80% hold — fine thermally).
- [ ] iOS **auto-updates OFF**; Guided Access enabled: Display Auto-Lock =
      Never, touch ON, no time limit.
- [ ] Signed into the owner account (shared with Kilos; verify in pre-flight).

**Cam phone — every night:**
- [ ] Airplane mode ON, then Wi-Fi back ON.
- [ ] Plugged in — **slow 5W wired charger, not MagSafe**; case off; hard
      surface; away from bedding (overheat-while-charging is a real, recalled
      hazard class in this product category).
- [ ] Brightness to minimum; open `/tomato/cam.html`; start Guided Access
      (triple-click).

**View phone (iPhone 17 Pro) — every night (red-team addition: the device
carrying the alarm gets hardened too):**
- [ ] On charger; **silent mode OFF** (check the Action Button didn't toggle
      it); media volume up.
- [ ] **Auto-Lock: Never** for the night; Low Power Mode OFF.
- [ ] Focus set to allow repeat callers only (a call/notification tapped at
      2am backgrounds Safari = monitoring gap; the auto-rejoin flow covers
      return, but don't invite it).
- [ ] Open `/bantay/view.html` → "Start monitoring" tap → **run the alarm
      drill and confirm you HEARD it** in the phone's overnight state.
- [ ] Screen stays on — it's the monitor. Locking it ends monitoring; the UI
      says so plainly.
- [ ] No Kilos deploys tonight (§2.5).

---

## 8. Test plan (before trusting it with the baby)

Failure drills — each must end in auto-recovery or an audible alarm within D12
latencies (≤5s first sound, ≤15s loud):
1. Lock the cam phone mid-stream.
2. Kill Wi-Fi at the router; also reboot the router (DHCP lease churn).
3. Force-quit / force-reload the cam Safari tab → zero-tap recovery.
4. **Double-kill**: two rapid cam-page kills → observe whether Safari's
   repeated-crash interstitial appears; confirm the view alarm covers it.
5. Force-reload the VIEW page mid-session → muted auto-rejoin + re-arm; cam
   beeper fires if re-arm doesn't happen.
6. FaceTime-call the cam phone *with the checklist applied* (should not ring;
   if it does, watchdog catches the black frame).
7. Pull the WAN cable mid-stream → stream continues; alarm copy distinguishes
   "internet down" only when recovery is later needed.
8. Sign out of Kilos on a third device mid-session (after the `scope:'local'`
   fix this must be a non-event).
9. Cover the lens + silence the room → dark ≠ frozen (getStats vs cam-meter
   calibration case).
10. Alarm drills: with silent switch ON (must still be audible via the
    playback-session path — if not, the checklist item is load-bearing and the
    drill proves it); from the nursery with the bedroom door closed.

Soak protocol: 3+ consecutive nights, wall clock visible in frame, uptime
counter on the view phone; morning review of the `bantay-log` ring buffer.

---

## 9. Risk register (top 12, post-mitigation stance)

| # | Risk | Sev | Mitigation → residual stance |
|---|---|---|---|
| R1 | Frozen frame / silent stream death overnight | HIGH | Triple-net watchdog (§4.2); fails toward alarming. **The product exists to close this risk.** |
| R2 | Cam page memory-reload / capture-failure at 3am | HIGH | Crash-only design, zero-tap recovery, memory-flat page. Residual: repeated-crash interstitial (§3.3) → view alarm covers; double-kill drill verifies. Accepted as *normal operation*. |
| R3 | **View page dies / backgrounds → no monitor AND no alarm** | HIGH | View hardening checklist (§7), memory discipline (§4.4), muted auto-rejoin + re-arm (§4.3.5), wake-lock-release alarm, and the cam-side last-resort beeper (§4.2). Residual: a locked view phone with a dead cam page is uncovered — the checklist exists to make that combination rare. |
| R4 | **Alarm muted by iOS silent mode / ambient session at the exact moment it's needed** | HIGH | Dual-path alarm + `audioSession.type='playback'` + checklist + "confirm you HEARD it" drill in overnight state (§4.2). |
| R5 | FaceTime/Wi-Fi call blacks the cam invisibly | HIGH | Checklist (FaceTime/Wi-Fi Calling OFF) + receiver-side detection. |
| R6 | Alarm blocked by autoplay after reconnect | HIGH | Single gesture unlocks both alarm paths; same-element track swap; drill proves it nightly. |
| R7 | Deploy version-skew leaves a reloaded page script-dead | MED | Self-contained inline pages (D11) + `controllerchange` idle self-reload + no-deploy-during-session rule (§2.5). |
| R8 | Thermal: encode+charge+screen 10h | MED | 480p15 + ~400kbps, 5W wired, case off, min brightness, black OLED UI; soak verifies. iOS "charging on hold" is a safety feature — watchdog catches a drained phone. |
| R9 | iOS update regresses web media | MED | Auto-update off on cam; post-update smoke test; Safari-tab mode already dodges the standalone-only regression class. |
| R10 | Safari re-prompts for camera despite Allow (known 2025 bug) | MED | Can't fully fix; single simple page minimizes triggers; view alarm is the backstop. |
| R11 | Router pathologies: client isolation, mesh mDNS filtering, band steering | MED | Same non-guest SSID; cam's gUM-first real-IP candidates; STUN config flag; M0 tests the actual router. Client isolation = showstopper → fix router, not app. |
| R12 | Stranger with anon key joins the signaling channel; or owner auth dies mid-night | LOW | Private channel + RLS pinned to owner `auth.uid()` (not just `authenticated` — Kilos has open sign-ups); topic is a hash of the pairing code and payloads are AES-GCM sealed with a code-derived key (shipped v0.3; code simplified to 6 digits in v0.4 for numpad speed — acceptable because M1's RLS gates joining and host-only ICE keeps media LAN-only); Kilos `signOut scope:'local'` fix + signed-in pre-flight + distinct auth-failure alarm copy (§2.4). |

---

## 10. Honest limits (what the ₱2,500 VTech does better)

No IR night vision (we counter with audio-first + nightlight). No VOX low-power
standby — both screens stay on all night. Dies with the router (FHSS radio
doesn't). No out-of-range beep on a dedicated radio. No background operation —
rule zero. **What we win:** ₱0, no subscription (category norm is $6.99/*week*),
total privacy (video cannot leave the LAN), a louder and smarter failure alarm
than anything in the category, and two OLED screens we already own.

## 11. Open questions (none block M0)

1. Name: keep *Bantay*? (Folder + two config regexes, nothing else.)
2. Reuse Kilos' Supabase project (recommended: it's active daily, so no
   free-tier pausing). Flip Realtime "Allow public access" off at M1, after
   re-grepping Kilos for Realtime usage at that time.
3. View phone: also ship the *cam* role usable on it (swap roles if one phone
   is low)? Trivial since both pages ship anyway — default yes.
4. M3 second-viewer: worth it before other nice-to-haves? Decide after soaks.
