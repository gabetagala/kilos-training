// Automated runs stay silent (2026-10-10, his ask: "can it be quiet when
// testing"). Playwright sets navigator.webdriver, and its browsers play real
// sound through the Mac's speakers. Everything still "plays" — clips, tones
// and speech fire their events, so audio-timing tests keep working — just at
// zero volume. A real phone never has navigator.webdriver, so this is inert.
if (typeof navigator !== 'undefined' && navigator.webdriver) {
  // Web Audio: anything routed to the speakers goes through a silent gain
  if (typeof AudioNode !== 'undefined') {
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (
        typeof AudioDestinationNode !== 'undefined' &&
        dest instanceof AudioDestinationNode
      ) {
        const ctx = this.context;
        if (!ctx.__kilosMute) {
          ctx.__kilosMute = ctx.createGain();
          ctx.__kilosMute.gain.value = 0;
          connect.call(ctx.__kilosMute, dest);
        }
        return connect.call(this, ctx.__kilosMute, ...rest);
      }
      return connect.call(this, dest, ...rest);
    };
  }
  // <audio> clips
  if (typeof HTMLMediaElement !== 'undefined') {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      this.muted = true;
      return play.apply(this, args);
    };
  }
  // speech
  if (typeof speechSynthesis !== 'undefined') {
    const speak = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = (u) => {
      u.volume = 0;
      speak(u);
    };
  }
}
