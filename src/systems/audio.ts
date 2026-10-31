/** WebAudio synthesizer: all SFX and music are generated at runtime (no audio files). */
import { bus } from '../core/events';
import { SONGS, type Song } from '../data/music';
import { settings } from './settings';

const NOTE_IDX: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

function noteToMidi(n: string): number {
  const m = /^([A-G][#b]?)(\d)$/.exec(n);
  if (!m) return 60;
  return 12 * (Number(m[2]) + 1) + NOTE_IDX[m[1]];
}
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function chordNotes(ch: string): number[] {
  const m = /^([A-G][#b]?)(m|7|dim)?$/.exec(ch) ?? ['', 'C', ''];
  const root = 48 + NOTE_IDX[m[1]];
  const minor = m[2] === 'm' || m[2] === 'dim';
  return [root, root + (minor ? 3 : 4), root + (m[2] === 'dim' ? 6 : 7)];
}

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private song: Song | null = null;
  private songName = '';
  private songGain: GainNode | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private tokens: string[] = [];
  private lastBlip = 0;

  init(): void {
    // iOS: play through the silent switch, like a game app (Safari 17+)
    try { const s = (navigator as any).audioSession; if (s) s.type = 'playback'; } catch { /* not supported */ }
    // iOS only lets audio start from a "real" gesture (touchend / click, not touchstart), and the
    // context can come back "interrupted" after a call or app switch — so retry on every gesture.
    const unlock = () => {
      if (this.ctx?.state === 'closed') this.rebuild();
      this.ensure();
      if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume().catch(() => { /* needs a gesture */ });
    };
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, { passive: true, capture: true });
    bus.on('settings:changed', () => this.applyVolumes());
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend().catch(() => undefined);
      else void this.ctx.resume().catch(() => undefined);
    });
    window.addEventListener('pageshow', () => { if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined); });
  }

  /** The context was closed by the system: start over and restart the current song. */
  private rebuild(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.ctx = null;
    this.songGain = null;
  }

  private ensure(): boolean {
    if (this.ctx) return true;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    // gentle compression keeps synth peaks tame
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.musicBus.connect(comp);
    this.sfxBus.connect(comp);
    comp.connect(this.master);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    if (this.songName) {
      const n = this.songName;
      this.songName = '';
      this.playMusic(n);
    }
    return true;
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    const s = settings.current;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.musicVolume * 0.42, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfxVolume * 0.7, t, 0.02);
  }

  /* ---------------- primitives ---------------- */

  private tone(dest: AudioNode, freq: number, start: number, dur: number, type: OscillatorType, vol: number, opts: { slide?: number; attack?: number; release?: number; detune?: number } = {}): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), start + dur);
    if (opts.detune) o.detune.value = opts.detune;
    const a = opts.attack ?? 0.005, r = opts.release ?? 0.05;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + a);
    g.gain.setValueAtTime(vol, Math.max(start + a, start + dur - r));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(dest);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  private noiseHit(dest: AudioNode, start: number, dur: number, vol: number, filter: number, type: BiquadFilterType = 'highpass'): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filter;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(start, Math.random() * 0.5);
    src.stop(start + dur + 0.02);
  }

  /* ---------------- SFX ---------------- */

  sfx(name: string, pitch = 1): void {
    if (!this.ensure() || !this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    const out = this.sfxBus;
    const T = (f: number, s: number, d: number, type: OscillatorType = 'square', v = 0.25, o: any = {}) => this.tone(out, f * pitch, t + s, d, type, v, o);
    switch (name) {
      case 'click': T(880, 0, 0.05, 'square', 0.15); break;
      case 'hover': T(1320, 0, 0.03, 'triangle', 0.08); break;
      case 'confirm': T(660, 0, 0.06); T(990, 0.06, 0.09); break;
      case 'cancel': T(500, 0, 0.06); T(330, 0.06, 0.09); break;
      case 'menu': T(520, 0, 0.05, 'triangle', 0.25); T(780, 0.05, 0.05, 'triangle', 0.25); T(1040, 0.1, 0.08, 'triangle', 0.25); break;
      case 'step': this.noiseHit(out, t, 0.04, 0.08, 1800); break;
      case 'jump': T(300, 0, 0.16, 'square', 0.2, { slide: 820 }); break;
      case 'land': this.noiseHit(out, t, 0.07, 0.15, 400, 'lowpass'); break;
      case 'swing': this.noiseHit(out, t, 0.12, 0.2, 1200, 'bandpass'); break;
      case 'hammer': T(160, 0, 0.12, 'square', 0.3, { slide: 60 }); this.noiseHit(out, t, 0.1, 0.3, 600, 'lowpass'); break;
      case 'hit': T(220, 0, 0.1, 'sawtooth', 0.25, { slide: 80 }); this.noiseHit(out, t, 0.08, 0.25, 900); break;
      case 'crit': T(440, 0, 0.06); T(880, 0.05, 0.06); T(1320, 0.1, 0.12); this.noiseHit(out, t, 0.12, 0.3, 700); break;
      case 'stomp': T(500, 0, 0.1, 'square', 0.25, { slide: 160 }); break;
      case 'hurt': T(300, 0, 0.18, 'sawtooth', 0.25, { slide: 90 }); break;
      case 'guard': T(1200, 0, 0.05, 'square', 0.2); this.noiseHit(out, t, 0.06, 0.15, 3000); break;
      case 'perfect': T(1046, 0, 0.06, 'square', 0.22); T(1568, 0.05, 0.06, 'square', 0.22); T(2093, 0.1, 0.16, 'triangle', 0.25); break;
      case 'nice': T(784, 0, 0.06, 'square', 0.2); T(1175, 0.06, 0.1, 'square', 0.2); break;
      case 'miss': T(200, 0, 0.15, 'triangle', 0.2, { slide: 140 }); break;
      case 'chest': [523, 659, 784, 1046].forEach((f, i) => T(f, i * 0.07, 0.12, 'square', 0.2)); T(1318, 0.3, 0.3, 'triangle', 0.25); break;
      case 'item': [784, 988, 1175].forEach((f, i) => T(f, i * 0.06, 0.1, 'triangle', 0.25)); break;
      case 'coin': T(988, 0, 0.06, 'square', 0.18); T(1318, 0.06, 0.18, 'square', 0.18); break;
      case 'quest': [523, 659, 784, 659, 784, 1046].forEach((f, i) => T(f, i * 0.09, 0.14, 'square', 0.2)); break;
      case 'levelup': [392, 523, 659, 784, 1046, 1318].forEach((f, i) => T(f, i * 0.07, 0.16, 'square', 0.2)); T(1568, 0.45, 0.4, 'triangle', 0.25); break;
      case 'save': T(784, 0, 0.08, 'triangle', 0.25); T(1046, 0.08, 0.16, 'triangle', 0.25); break;
      case 'door': this.noiseHit(out, t, 0.3, 0.2, 300, 'lowpass'); T(110, 0, 0.3, 'triangle', 0.25); break;
      case 'switch': T(1500, 0, 0.03, 'square', 0.2); T(700, 0.04, 0.05, 'square', 0.2); break;
      case 'break': this.noiseHit(out, t, 0.3, 0.4, 500, 'lowpass'); T(120, 0, 0.2, 'square', 0.2, { slide: 40 }); break;
      case 'spring': T(200, 0, 0.3, 'triangle', 0.3, { slide: 1200 }); break;
      case 'heal': [659, 784, 988, 1318].forEach((f, i) => T(f, i * 0.08, 0.2, 'sine', 0.25)); break;
      case 'buff': T(400, 0, 0.3, 'triangle', 0.25, { slide: 1200 }); T(600, 0.1, 0.3, 'triangle', 0.15, { slide: 1500 }); break;
      case 'magic': [1046, 1318, 1568, 2093].forEach((f, i) => T(f, i * 0.05, 0.15, 'sine', 0.2)); this.noiseHit(out, t, 0.4, 0.08, 4000); break;
      case 'fire': this.noiseHit(out, t, 0.4, 0.3, 800, 'bandpass'); T(150, 0, 0.3, 'sawtooth', 0.15, { slide: 60 }); break;
      case 'beam': T(1800, 0, 0.4, 'sawtooth', 0.15, { slide: 300 }); break;
      case 'enemyDie': T(600, 0, 0.25, 'square', 0.2, { slide: 100 }); this.noiseHit(out, t + 0.1, 0.2, 0.2, 2000); break;
      case 'battleStart': [262, 330, 392, 523, 392, 523, 659].forEach((f, i) => T(f, i * 0.05, 0.08, 'square', 0.22)); this.noiseHit(out, t, 0.4, 0.2, 1000); break;
      case 'shard': [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => T(f, i * 0.1, 0.4, 'sine', 0.22)); break;
      case 'warning': T(880, 0, 0.12, 'square', 0.25); T(880, 0.2, 0.12, 'square', 0.25); break;
      case 'error': T(200, 0, 0.12, 'square', 0.25); T(160, 0.12, 0.2, 'square', 0.25); break;
      case 'flip': T(900, 0, 0.05, 'triangle', 0.1, { slide: 1500 }); break;
      case 'escape': [784, 659, 523, 392].forEach((f, i) => T(f, i * 0.05, 0.08, 'triangle', 0.2)); break;
      case 'defeat': [392, 370, 349, 330].forEach((f, i) => T(f, i * 0.25, 0.3, 'triangle', 0.25)); break;
      case 'photo': this.noiseHit(out, t, 0.08, 0.4, 3000); T(2000, 0.02, 0.05, 'square', 0.15); break;
      case 'join': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => T(f, i * 0.07, 0.1, 'square', 0.18)); break;
      case 'shake': this.noiseHit(out, t, 0.6, 0.35, 200, 'lowpass'); T(60, 0, 0.6, 'sawtooth', 0.2); break;
      case 'bite': T(260, 0, 0.08, 'square', 0.25, { slide: 520 }); T(180, 0.1, 0.14, 'square', 0.25, { slide: 90 }); break;
      case 'bubble': T(500, 0, 0.08, 'sine', 0.22, { slide: 1300 }); T(700, 0.07, 0.07, 'sine', 0.15, { slide: 1600 }); break;
      case 'alarm': T(1100, 0, 0.12, 'square', 0.22); T(800, 0.14, 0.12, 'square', 0.22); T(1100, 0.28, 0.12, 'square', 0.22); break;
      case 'whoosh': this.noiseHit(out, t, 0.35, 0.25, 900, 'bandpass'); break;
    }
  }

  /** Dialogue blip, pitched per speaker. Throttled. */
  blip(pitch: number): void {
    if (!this.ensure() || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastBlip < 0.045) return;
    this.lastBlip = now;
    this.tone(this.sfxBus, 420 * pitch * (0.95 + Math.random() * 0.1), now, 0.035, 'square', 0.07);
  }

  /* ---------------- Music sequencer ---------------- */

  playMusic(name: string): void {
    if (name === this.songName && this.timer) return;
    this.songName = name;
    const song = SONGS[name];
    if (!song) return;
    if (!this.ensure() || !this.ctx) return;
    this.stopMusic(0.6);
    this.song = song;
    this.tokens = song.melody.trim().split(/\s+/);
    while (this.tokens.length < song.chords.length * 8) this.tokens.push('.');
    this.songGain = this.ctx.createGain();
    this.songGain.gain.value = 0.0001;
    this.songGain.gain.exponentialRampToValueAtTime(song.gain ?? 1, this.ctx.currentTime + 0.8);
    this.songGain.connect(this.musicBus);
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic(fade = 0.5): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.songGain && this.ctx) {
      const g = this.songGain;
      g.gain.cancelScheduledValues(this.ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + fade);
      setTimeout(() => g.disconnect(), fade * 1000 + 200);
    }
    this.songGain = null;
  }

  get currentSong(): string {
    return this.songName;
  }

  private schedule(): void {
    if (!this.ctx || !this.song || !this.songGain) return;
    const song = this.song;
    const eighth = 60 / song.bpm / 2;
    const total = song.chords.length * 8;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      const s = this.step % total;
      if (song.loop === false && this.step >= total) {
        this.stopMusic(0.3);
        this.songName = '';
        return;
      }
      this.playStep(song, s, this.nextTime, eighth);
      this.nextTime += eighth;
      this.step++;
    }
  }

  private playStep(song: Song, s: number, t: number, eighth: number): void {
    const out = this.songGain!;
    const chord = chordNotes(song.chords[Math.floor(s / 8)]);
    const beat = s % 8;
    // melody
    const tok = this.tokens[s];
    if (tok && tok !== '-' && tok !== '.') {
      let len = 1;
      while (this.tokens[(s + len) % this.tokens.length] === '-' && len < 16) len++;
      const f = mtof(noteToMidi(tok));
      const v = song.lead === 'sawtooth' ? 0.09 : song.lead === 'square' ? 0.1 : 0.16;
      this.tone(out, f, t, len * eighth * 0.92, song.lead, v, { attack: 0.01, release: 0.06 });
      if (song.lead === 'square') this.tone(out, f, t, len * eighth * 0.9, 'triangle', 0.05, { detune: 7 });
    }
    // bass
    const root = chord[0] - 12;
    switch (song.bass) {
      case 'pulse': this.tone(out, mtof(root), t, eighth * 0.8, 'square', 0.08); break;
      case 'oom':
        if (beat % 2 === 0) this.tone(out, mtof(beat % 4 === 0 ? root : root + 7), t, eighth * 0.9, 'triangle', 0.22);
        break;
      case 'walk': if (beat % 2 === 0) this.tone(out, mtof(root + [0, 4, 7, 9][beat / 2]), t, eighth * 1.8, 'triangle', 0.22); break;
      case 'arp': this.tone(out, mtof(chord[beat % 3] - 12), t, eighth * 0.9, 'triangle', 0.16); break;
      case 'drone': if (beat === 0) this.tone(out, mtof(root), t, eighth * 8, 'triangle', 0.2, { attack: 0.3, release: 0.6 }); break;
    }
    if (song.arp && beat % 2 === 1) this.tone(out, mtof(chord[(beat >> 1) % 3] + 12), t, eighth * 0.5, 'triangle', 0.05);
    if (song.pad && beat === 0) for (const n of chord) this.tone(out, mtof(n), t, eighth * 8, 'sine', 0.035, { attack: 0.4, release: 0.8 });
    // drums
    switch (song.drums) {
      case 'light':
        if (beat === 0 || beat === 4) this.tone(out, 110, t, 0.12, 'sine', 0.3, { slide: 45 });
        if (beat % 2 === 1) this.noiseHit(out, t, 0.03, 0.04, 7000);
        break;
      case 'march':
        if (beat % 4 === 0) this.tone(out, 100, t, 0.14, 'sine', 0.3, { slide: 45 });
        if (beat === 2 || beat === 6 || beat === 7) this.noiseHit(out, t, 0.08, 0.1, 1800, 'bandpass');
        break;
      case 'rock':
        if (beat === 0 || beat === 3 || beat === 4) this.tone(out, 110, t, 0.12, 'sine', 0.35, { slide: 40 });
        if (beat === 2 || beat === 6) this.noiseHit(out, t, 0.12, 0.18, 1500);
        this.noiseHit(out, t, 0.025, 0.05, 8000);
        break;
      case 'swing':
      case 'shuffle':
        if (beat === 0 || beat === 4) this.tone(out, 110, t, 0.12, 'sine', 0.3, { slide: 45 });
        if (beat === 2 || beat === 6) this.noiseHit(out, t, 0.06, 0.08, 2500, 'bandpass');
        if (beat % 2 === 1) this.noiseHit(out, t + eighth * 0.2, 0.025, 0.05, 8000);
        break;
    }
  }
}

export const audio = new AudioEngine();
