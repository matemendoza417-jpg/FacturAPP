(function(){
  let ctx = null;
  let _enabled = true;
  try { _enabled = localStorage.getItem('facturapp_sound') !== 'off'; } catch(e){}

  function getCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function playTone(freq, duration, type, gainVal, rampDown) {
    const c = getCtx();
    if (!c || !_enabled) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(gainVal || 0.15, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (rampDown || duration || 0.15));
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime);
    o.stop(c.currentTime + (duration || 0.15));
  }

  function playNoise(duration, gainVal, highpass) {
    const c = getCtx();
    if (!c || !_enabled) return;
    const bufferSize = c.sampleRate * (duration || 0.1);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(gainVal || 0.06, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (duration || 0.1));
    let node = source;
    if (highpass) {
      const filter = c.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(highpass, c.currentTime);
      node.connect(filter);
      filter.connect(gain);
    } else {
      node.connect(gain);
    }
    gain.connect(c.destination);
    source.start(c.currentTime);
    source.stop(c.currentTime + (duration || 0.1));
  }

  window.Sound = {
    toggle() {
      _enabled = !_enabled;
      localStorage.setItem('facturapp_sound', _enabled ? 'on' : 'off');
      return _enabled;
    },
    isEnabled() { return _enabled; },

    tap() {
      playTone(880, 0.06, 'sine', 0.10);
    },

    click() {
      playTone(660, 0.05, 'sine', 0.08);
      setTimeout(() => playTone(1000, 0.04, 'sine', 0.05), 30);
    },

    select() {
      playTone(523, 0.08, 'sine', 0.12);
      setTimeout(() => playTone(780, 0.06, 'sine', 0.10), 60);
    },

    success() {
      playTone(523, 0.12, 'sine', 0.12);
      setTimeout(() => playTone(659, 0.10, 'sine', 0.12), 100);
      setTimeout(() => playTone(784, 0.20, 'sine', 0.10), 200);
    },

    generate() {
      playTone(392, 0.15, 'sine', 0.10);
      setTimeout(() => playTone(523, 0.12, 'sine', 0.10), 120);
      setTimeout(() => playTone(659, 0.10, 'sine', 0.12), 220);
      setTimeout(() => playTone(784, 0.30, 'sine', 0.15, 0.35), 320);
    },

    navigate() {
      playNoise(0.18, 0.04, 2000);
      playTone(440, 0.10, 'sine', 0.04);
    },

    back() {
      playNoise(0.14, 0.03, 1500);
      playTone(350, 0.10, 'sine', 0.04);
    },

    step() {
      playTone(660, 0.05, 'sine', 0.06);
      setTimeout(() => playTone(880, 0.04, 'sine', 0.05), 40);
    },

    stepBack() {
      playTone(550, 0.05, 'sine', 0.06);
    },

    delete() {
      playTone(300, 0.08, 'sawtooth', 0.04);
      setTimeout(() => playTone(200, 0.10, 'sawtooth', 0.03), 60);
    },

    error() {
      playTone(200, 0.10, 'sawtooth', 0.05);
      setTimeout(() => playTone(170, 0.12, 'sawtooth', 0.04), 80);
    },

    pop() {
      playTone(1200, 0.04, 'sine', 0.06);
      setTimeout(() => playTone(900, 0.05, 'sine', 0.04), 20);
    },

    toggle() {
      playTone(1200, 0.03, 'sine', 0.05);
      setTimeout(() => playTone(1400, 0.03, 'sine', 0.04), 20);
    },

    notification() {
      playTone(880, 0.06, 'sine', 0.06);
      setTimeout(() => playTone(1100, 0.05, 'sine', 0.05), 60);
    },

    welcome() {
      playTone(392, 0.15, 'sine', 0.10);
      setTimeout(() => playTone(523, 0.12, 'sine', 0.10), 130);
      setTimeout(() => playTone(659, 0.10, 'sine', 0.10), 240);
      setTimeout(() => playTone(784, 0.12, 'sine', 0.12), 340);
      setTimeout(() => playTone(1047, 0.35, 'sine', 0.10, 0.40), 440);
    },

    save() {
      playTone(523, 0.10, 'sine', 0.10);
      setTimeout(() => playTone(659, 0.08, 'sine', 0.10), 80);
      setTimeout(() => playTone(784, 0.25, 'sine', 0.12, 0.30), 160);
    },

    send() {
      playTone(440, 0.08, 'sine', 0.08);
      setTimeout(() => playTone(660, 0.06, 'sine', 0.08), 60);
      setTimeout(() => playTone(880, 0.06, 'sine', 0.10), 120);
      setTimeout(() => playNoise(0.20, 0.05, 3000), 180);
    },
  };
})();
