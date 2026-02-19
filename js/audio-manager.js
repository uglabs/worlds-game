/**
 * AudioManager — all audio logic for worlds-game.
 * Uses Web Audio API exclusively — no external files needed.
 * Separate mute controls for music and SFX.
 */
export class AudioManager {
  #ctx = null;
  #musicNodes = [];
  #musicTimer = null;
  #nextVoiceAt = 0;
  #musicMuted = false;
  #sfxMuted = false;

  // ── Context ───────────────────────────────────────────────────

  async resume() {
    if (!this.#ctx) {
      this.#ctx = new AudioContext();
    }
    if (this.#ctx.state === 'suspended') {
      await this.#ctx.resume();
    }
    return this.#ctx;
  }

  // ── Music ─────────────────────────────────────────────────────

  startMusic() {
    if (this.#musicTimer || this.#musicMuted) return;
    this.#playMusicLoop();
  }

  stopMusic() {
    clearTimeout(this.#musicTimer);
    this.#musicTimer = null;
    for (const node of this.#musicNodes) {
      try { node.stop(); } catch (_) {}
    }
    this.#musicNodes = [];
  }

  toggleMusic() {
    this.#musicMuted = !this.#musicMuted;
    if (this.#musicMuted) {
      this.stopMusic();
    } else {
      this.resume().then(() => this.startMusic());
    }
    return this.#musicMuted;
  }

  toggleSfx() {
    this.#sfxMuted = !this.#sfxMuted;
    return this.#sfxMuted;
  }

  get musicMuted() { return this.#musicMuted; }
  get sfxMuted() { return this.#sfxMuted; }

  // Action-adventure driving music loop
  #playMusicLoop() {
    if (!this.#ctx || this.#musicMuted) return;
    const ctx = this.#ctx;
    const bpm = 140;
    const e = 60 / bpm / 2;   // eighth note duration (~0.214s)
    const t0 = ctx.currentTime + 0.02;

    // ── Bass line (square wave, punchy) ──────────────────────
    // 16 eighth notes: C2, C2, F2, F2, G2, G2, E2, E2 (repeat with variation)
    const bassFreqs = [65.4, 65.4, 87.3, 87.3, 98.0, 98.0, 82.4, 65.4,
                       65.4, 65.4, 87.3, 73.4, 98.0, 87.3, 73.4, 65.4];
    bassFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const s = t0 + i * e;
      gain.gain.setValueAtTime(0.14, s);
      gain.gain.exponentialRampToValueAtTime(0.001, s + e * 0.75);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(s); osc.stop(s + e * 0.8);
      this.#musicNodes.push(osc);
    });

    // ── Kick drum (sine pitch-drop) on beats 1 & 3 ───────────
    [0, 8].forEach(i => {
      const kick = ctx.createOscillator();
      const kGain = ctx.createGain();
      kick.type = 'sine';
      const s = t0 + i * e;
      kick.frequency.setValueAtTime(130, s);
      kick.frequency.exponentialRampToValueAtTime(42, s + 0.09);
      kGain.gain.setValueAtTime(0.4, s);
      kGain.gain.exponentialRampToValueAtTime(0.001, s + 0.16);
      kick.connect(kGain); kGain.connect(ctx.destination);
      kick.start(s); kick.stop(s + 0.18);
      this.#musicNodes.push(kick);
    });

    // ── Snare (sawtooth crack) on beats 2 & 4 ────────────────
    [4, 12].forEach(i => {
      const snare = ctx.createOscillator();
      const sGain = ctx.createGain();
      snare.type = 'sawtooth';
      const s = t0 + i * e;
      snare.frequency.setValueAtTime(220, s);
      snare.frequency.exponentialRampToValueAtTime(80, s + 0.06);
      sGain.gain.setValueAtTime(0.18, s);
      sGain.gain.exponentialRampToValueAtTime(0.001, s + 0.09);
      snare.connect(sGain); sGain.connect(ctx.destination);
      snare.start(s); snare.stop(s + 0.1);
      this.#musicNodes.push(snare);
    });

    // ── Hi-hat (high triangle click) on every 8th ────────────
    for (let i = 0; i < 16; i++) {
      const hat = ctx.createOscillator();
      const hGain = ctx.createGain();
      hat.type = 'triangle';
      hat.frequency.value = 8000;
      const s = t0 + i * e;
      hGain.gain.setValueAtTime(0.03, s);
      hGain.gain.exponentialRampToValueAtTime(0.001, s + 0.03);
      hat.connect(hGain); hGain.connect(ctx.destination);
      hat.start(s); hat.stop(s + 0.04);
      this.#musicNodes.push(hat);
    }

    // ── Melody (triangle, E pentatonic minor riff) ────────────
    // E4=330, G4=392, A4=440, B4=494, E5=659, D5=587
    const melPlan = [
      [330, 0], [392, 2], [440, 4], [392, 6],
      [494, 8], [440, 10],[330, 12],[494, 14],
    ];
    melPlan.forEach(([freq, i]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const s = t0 + i * e;
      gain.gain.setValueAtTime(0, s);
      gain.gain.linearRampToValueAtTime(0.065, s + 0.015);
      gain.gain.linearRampToValueAtTime(0, s + e * 1.6);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(s); osc.stop(s + e * 1.8);
      this.#musicNodes.push(osc);
    });

    // Loop every 16 eighth notes
    const loopMs = 16 * e * 1000;
    this.#musicTimer = setTimeout(() => {
      this.#musicNodes = [];
      this.#musicTimer = null;
      this.#playMusicLoop();
    }, loopMs);
  }

  // ── SFX ──────────────────────────────────────────────────────

  /** Short rising boing for jumping */
  playJump() {
    if (!this.#ctx || this.#sfxMuted) return;
    const ctx = this.#ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.12);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** Punchy double-bark for Buddy */
  playBark() {
    if (!this.#ctx || this.#sfxMuted) return;
    const ctx = this.#ctx;
    const t = ctx.currentTime;
    [0, 0.14].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(320 - i * 40, t + offset);
      osc.frequency.exponentialRampToValueAtTime(180, t + offset + 0.1);
      gain.gain.setValueAtTime(0.22, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.11);
    });
  }

  /** Coin-ping for a correct answer */
  playCorrect() {
    if (!this.#ctx || this.#sfxMuted) return;
    const ctx = this.#ctx;
    const t = ctx.currentTime;
    [880, 1318].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.22, t + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.2);
    });
  }

  /** Harsh buzzer for a wrong answer */
  playWrong() {
    if (!this.#ctx || this.#sfxMuted) return;
    const ctx = this.#ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.35);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.36);
  }

  /** Whoosh + chord when entering a challenge zone */
  playZoneEnter() {
    if (!this.#ctx || this.#sfxMuted) return;
    const ctx = this.#ctx;
    const t = ctx.currentTime;
    const noise = ctx.createOscillator();
    const nGain = ctx.createGain();
    noise.type = 'sine';
    noise.frequency.setValueAtTime(200, t);
    noise.frequency.exponentialRampToValueAtTime(800, t + 0.15);
    nGain.gain.setValueAtTime(0.1, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    noise.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.2);
    [440, 554, 659].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + 0.1);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.2);
      gain.gain.linearRampToValueAtTime(0, t + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + 0.1);
      osc.stop(t + 0.75);
    });
  }

  /** Epic rising fanfare for portal unlock */
  playPortalUnlock() {
    if (!this.#ctx || this.#sfxMuted) return;
    const ctx = this.#ctx;
    const t = ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = t + i * 0.07;
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.04);
      gain.gain.linearRampToValueAtTime(0, start + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.0);
    });
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.value = 80;
    subGain.gain.setValueAtTime(0.3, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(t);
    sub.stop(t + 0.45);
  }

  /** Big punchy fanfare for challenge complete */
  playSuccess() {
    if (!this.#ctx || this.#sfxMuted) return;
    const ctx = this.#ctx;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
      const perc = ctx.createOscillator();
      const pGain = ctx.createGain();
      perc.type = 'square';
      perc.frequency.value = freq * 0.5;
      pGain.gain.setValueAtTime(0.25, t + i * 0.08);
      pGain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.04);
      perc.connect(pGain);
      pGain.connect(ctx.destination);
      perc.start(t + i * 0.08);
      perc.stop(t + i * 0.08 + 0.05);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.22, t + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.42);
    });
  }

  /** Dramatic descending fail sound */
  playFail() {
    if (!this.#ctx || this.#sfxMuted) return;
    const ctx = this.#ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.6);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.62);
    const thud = ctx.createOscillator();
    const tGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(120, t);
    thud.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    tGain.gain.setValueAtTime(0.3, t);
    tGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    thud.connect(tGain);
    tGain.connect(ctx.destination);
    thud.start(t);
    thud.stop(t + 0.38);
  }

  // ── Voice ─────────────────────────────────────────────────────

  #decodeChain = Promise.resolve();

  clearVoiceQueue() {
    this.#nextVoiceAt = 0;
    this.#decodeChain = Promise.resolve();
  }

  queueVoiceChunk(base64) {
    this.#decodeChain = this.#decodeChain.then(() => this.#decodeAndSchedule(base64));
  }

  async #decodeAndSchedule(base64) {
    if (!this.#ctx) return;
    const ctx = this.#ctx;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;
    let audioBuffer;
    try {
      audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    } catch (_err) {
      try {
        const pcm = new Int16Array(arrayBuffer);
        audioBuffer = ctx.createBuffer(1, pcm.length, 16000);
        const f32 = audioBuffer.getChannelData(0);
        for (let i = 0; i < pcm.length; i++) {
          f32[i] = pcm[i] / 32768;
        }
      } catch (e) {
        console.warn('[AudioManager] Failed to decode voice chunk:', e);
        return;
      }
    }
    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.05, this.#nextVoiceAt);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(startAt);
    this.#nextVoiceAt = startAt + audioBuffer.duration;
  }
}
