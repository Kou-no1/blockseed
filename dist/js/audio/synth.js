export class Synth {
  constructor() { this.context = null; this.nodes = new Set(); this.timers = new Set(); this.muted = localStorage.getItem('bs.sound') === '0'; this.tempo = 100; }

  setMuted(value) {
    this.muted = Boolean(value);
    localStorage.setItem('bs.sound', this.muted ? '0' : '1');
    if (this.muted) this.stop();
  }

  setTempo(value) { this.tempo = Math.max(30, Math.min(300, Number(value) || 100)); }

  later(run, milliseconds) {
    const timer = setTimeout(() => { this.timers.delete(timer); run(); }, milliseconds);
    this.timers.add(timer);
  }

  ensure() {
    if (this.muted) return null;
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      this.context = new Context();
    }
    if (this.context.state === 'suspended') this.context.resume();
    return this.context;
  }

  tone(midi, seconds, wave) {
    const context = this.ensure(); if (!context) return;
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = wave || 'sine';
    oscillator.frequency.value = 440 * Math.pow(2, (Number(midi) - 69) / 12);
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.18, context.currentTime + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + Math.max(.05, Number(seconds) || .2));
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + Math.max(.06, Number(seconds) || .2) + .03);
    this.nodes.add(oscillator); oscillator.onended = () => this.nodes.delete(oscillator);
  }

  effect(name) {
    const beat = 100 / this.tempo;
    if (name === 'boo') this.tone(38, .45, 'sawtooth');
    else if (name === 'success') { this.tone(60, .2); this.later(() => this.tone(64, .2), 100 * beat); this.later(() => this.tone(67, .35), 200 * beat); }
    else if (name === 'clap') { this.tone(72, .05, 'square'); this.later(() => this.tone(76, .05, 'square'), 80 * beat); }
    else this.tone(84, .12, 'square');
  }

  click() { this.tone(80, .035, 'sine'); }
  stop() { this.nodes.forEach(function (node) { try { node.stop(); } catch (error) { /* already stopped */ } }); this.nodes.clear(); this.timers.forEach(function (timer) { clearTimeout(timer); }); this.timers.clear(); }
}
