// Escalation state machine (SCOPE §4.2, D12): trouble ≥5s → chirp;
// ≥15s → siren until dismissed or recovery. Dismiss = 2-minute snooze,
// then re-siren if still down. Escalates only while monitoring is on and
// after the first successful connection of the session.
//
// Verify-fleet hardening:
// - unhealthySince is backdated to the last-known-good signal, so the
//   D12 clock runs from the actual death, not from detection.
// - A recovery must hold for 8 consecutive healthy ticks before the
//   escalation clock resets — a flapping cam/router accumulates instead
//   of endlessly resetting below the siren threshold.
// - Tick drift > 4s (throttled tab, PiP background) is itself reported.
const CHIRP_AT = 5000;
const SIREN_AT = 15000;
const SNOOZE_MS = 120000;
const STABLE_TICKS = 8;

export function startWatchdog({ isHealthy, everConnected, lastGoodAt, sound, onRender, onGap }) {
  let unhealthySince = 0;
  let chirped = false;
  let snoozeUntil = 0;
  let healthyStreak = 0;
  let lastTick = Date.now();
  let state = 'ok'; // ok | recovering | degraded | alarming | snoozed

  function setState(next) {
    if (state === 'alarming' && next !== 'alarming') sound.siren(false);
    state = next;
  }

  function reset() {
    unhealthySince = 0;
    chirped = false;
    snoozeUntil = 0;
    healthyStreak = 0;
    setState('ok');
  }

  function tick() {
    const now = Date.now();
    const gap = now - lastTick;
    lastTick = now;
    if (gap > 4000) onGap?.(gap);

    if (!everConnected()) {
      reset();
    } else if (isHealthy()) {
      healthyStreak++;
      if (!unhealthySince || healthyStreak >= STABLE_TICKS) reset();
      else setState('recovering'); // siren stops, but the clock survives a flap
    } else {
      healthyStreak = 0;
      if (!unhealthySince) {
        // Backdate to when the stream actually died (bounded to 30s ago).
        unhealthySince = Math.max(lastGoodAt() || now, now - 30000);
      }
      const dur = now - unhealthySince;
      if (now < snoozeUntil) {
        setState('snoozed');
      } else if (dur >= SIREN_AT) {
        setState('alarming');
        sound.siren(true);
      } else {
        if (dur >= CHIRP_AT && !chirped) {
          chirped = true;
          sound.chirp();
        }
        setState('degraded');
      }
    }
    onRender(state, unhealthySince, snoozeUntil);
  }

  setInterval(tick, 1000);
  return {
    state: () => state,
    dismiss() {
      snoozeUntil = Date.now() + SNOOZE_MS;
      setState('snoozed');
      onRender(state, unhealthySince, snoozeUntil);
    },
  };
}
