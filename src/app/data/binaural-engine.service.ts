import { Injectable, signal } from '@angular/core';
import { AudioSynthPort } from '../domain/ports/audio-synth.port';
import { PlaybackState, TestSide } from '../domain/model/playback';
import { TRACKS_BY_ID, TrackConfig, getTrackById } from '../domain/model/tracks';

/**
 * DATA · Adaptador del puerto `AudioSynthPort` sobre Web Audio API.
 *
 * Por pista construye:
 * 1. Par binaural: dos osciladores seno (uno por oído) unidos con
 *    ChannelMerger para aislamiento estéreo real. La diferencia
 *    entre ambos es el beat (10 / 6 / 40 Hz).
 * 2. Colchón armónico: acordes que ciclan en loop infinito con un
 *    planificador lookahead (sin cortes, dura hasta que pares).
 * 3. Respiración: LFO lento sobre el colchón + fade-in/out suaves.
 * 4. (Opcional por pista) shimmer de octava o ruido filtrado.
 *
 * Dependency rule: este adaptador conoce el PUERTO (contrato de dominio),
 * pero la presentación es quien orquesta — el sink activo llega por
 * parámetro; aquí no se sabe qué dispositivo eligió el usuario.
 */
@Injectable()
export class BinauralEngine implements AudioSynthPort {
  readonly playback = signal<PlaybackState>('idle');
  readonly activeTrackId = signal<string | null>(null);
  readonly volume = signal(0.7);

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private teardownSteps: (() => void)[] = [];
  private chordTimer: ReturnType<typeof setInterval> | null = null;
  private stopTimeout: ReturnType<typeof setTimeout> | null = null;
  private analyser: AnalyserNode | null = null;

  get activeTrack(): TrackConfig | undefined {
    const id = this.activeTrackId();
    return id ? TRACKS_BY_ID.get(id) : undefined;
  }

  /** Inicia una pista. Debe llamarse desde un gesto del usuario (click). */
  start(trackId: string): void {
    if (typeof window === 'undefined') return;
    const track = getTrackById(trackId);
    if (!track) return;
    if (this.playback() === 'playing' && this.activeTrackId() === trackId) return;

    this.teardownNow();

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    void ctx.resume();
    this.ctx = ctx;

    // --- Bus maestro con fade-in de 5 s ---
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(
      this.volume(),
      ctx.currentTime + 5,
    );
    // --- Analizador para el visualizador (master -> analyser -> salida) ---
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    this.master = master;
    this.analyser = analyser;

    this.buildBinauralPair(ctx, track, master);
    const padBus = this.buildPadBus(ctx, master);
    this.startChordLoop(ctx, track, padBus);
    if (track.noise) this.buildSoftNoise(ctx, master);

    this.activeTrackId.set(track.id);
    this.playback.set('playing');
  }

  /**
   * PAUSA REAL del grafo de audio: `AudioContext.suspend()` congela el
   * reloj del contexto sin destruir nodos — reanudar continúa exactamente
   * donde iba la sesión (fases, acordes, fades).
   */
  pause(): void {
    const ctx = this.ctx;
    if (!ctx || this.playback() !== 'playing') return;
    void ctx.suspend();
    this.playback.set('paused');
  }

  resume(): void {
    const ctx = this.ctx;
    if (!ctx || this.playback() !== 'paused') return;
    void ctx.resume();
    this.playback.set('playing');
  }

  /** Para con fade-out de 2 s y libera el contexto. */
  stop(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) {
      this.teardownNow();
      return;
    }
    // Desde pausa el contexto está suspendido (silencio garantizado):
    // el fade-out no tendría audible; teardown directo.
    if (this.playback() === 'paused') {
      this.teardownNow();
      return;
    }
    if (this.playback() !== 'playing') {
      this.teardownNow();
      return;
    }
    this.playback.set('stopping');
    if (this.chordTimer !== null) {
      clearInterval(this.chordTimer);
      this.chordTimer = null;
    }
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
    this.stopTimeout = setTimeout(() => this.teardownNow(), 2200);
  }

  setVolume(value: number): void {
    const v = Math.min(1, Math.max(0, value));
    this.volume.set(v);
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Enruta el AudioContext actual al deviceId indicado con
   * `AudioContext.setSinkId` (spec Web Audio; Chromium lo implementa).
   * Si el navegador no lo soporta o el dispositivo se desconectó, no
   * rompe nada: la salida sigue por el sink por defecto del sistema.
   * `null`/omitido = sink por defecto ('' = default en la spec).
   */
  async applySink(deviceId?: string | null): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    await this.applySinkTo(ctx, deviceId);
  }

  private async applySinkTo(
    ctx: AudioContext,
    deviceId?: string | null,
  ): Promise<void> {
    const sinkable = ctx as AudioContext & {
      setSinkId?: (sinkId: string) => Promise<void>;
    };
    if (typeof sinkable.setSinkId !== 'function') return;
    try {
      await sinkable.setSinkId(deviceId ?? '');
    } catch {
      /* dispositivo desconectado o sin permiso: sink por defecto */
    }
  }

  /**
   * Comprobación guiada: suena un seno puro de 440 Hz SOLO por el oído
   * indicado, con el mismo aislamiento del par binaural (ChannelMerger).
   * Crea un AudioContext efímero y lo cierra al terminar. Resuelve cuando
   * el tono ya terminó, para que la UI pregunte al usuario qué oyó.
   */
  async playSideTest(
    side: TestSide,
    deviceId?: string | null,
  ): Promise<void> {
    if (typeof window === 'undefined') return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    void ctx.resume();
    await this.applySinkTo(ctx, deviceId);

    const merger = ctx.createChannelMerger(2);
    merger.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 440;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + 0.05;
    const dur = 1.6;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.18, t0 + 0.08);
    g.gain.setValueAtTime(0.18, t0 + dur - 0.25);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(g);
    // Aislamiento duro: el tono vive en un único canal, igual que el par binaural.
    g.connect(merger, 0, side === 'left' ? 0 : 1);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    const cleanup = () => {
      try {
        osc.stop();
      } catch {
        /* ya detenido */
      }
      osc.disconnect();
      g.disconnect();
      merger.disconnect();
    };
    this.teardownSteps.push(cleanup);

    await new Promise<void>((resolve) =>
      setTimeout(resolve, (dur + 0.35) * 1000),
    );
    try {
      await ctx.close();
    } catch {
      /* ya cerrado */
    }
    // El test terminó: retira su cleanup de la lista de teardown de la sesión.
    this.teardownSteps = this.teardownSteps.filter((fn) => fn !== cleanup);
  }

  /**
   * Copia el espectro actual (0-255 por banda) en `out`.
   * Devuelve false si no hay audio activo. Lo usa el visualizador.
   */
  getSpectrum(out: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser || this.playback() !== 'playing') return false;
    this.analyser.getByteFrequencyData(out);
    return true;
  }

  /** Número de bandas del espectro (fftSize / 2). */
  get spectrumSize(): number {
    return 1024;
  }

  // ---------- construcción del grafo ----------

  private buildBinauralPair(
    ctx: AudioContext,
    track: TrackConfig,
    master: GainNode,
  ): void {
    const bus = ctx.createGain();
    // Entrada progresiva del beat: de 0 al nivel pleno en 30 s.
    bus.gain.setValueAtTime(0, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 30);
    bus.connect(master);

    const merger = ctx.createChannelMerger(2);
    merger.connect(bus);

    for (const [freq, channel] of [
      [track.leftHz, 0],
      [track.rightHz, 1],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      const g = ctx.createGain();
      g.gain.value = 0.5;
      osc.connect(g);
      g.connect(merger, 0, channel);
      osc.start();
      this.teardownSteps.push(() => {
        try {
          osc.stop();
        } catch {
          /* ya detenido */
        }
        osc.disconnect();
        g.disconnect();
      });
    }
    this.teardownSteps.push(() => {
      merger.disconnect();
      bus.disconnect();
    });
  }

  private buildPadBus(ctx: AudioContext, master: GainNode): GainNode {
    const bus = ctx.createGain();
    bus.gain.value = 0.9;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    bus.connect(filter);
    filter.connect(master);

    // "Respiración": LFO de 0.07 Hz modulando suavemente el colchón.
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.25;
    lfo.connect(lfoGain);
    lfoGain.connect(bus.gain);
    lfo.start();
    this.teardownSteps.push(() => {
      try {
        lfo.stop();
      } catch {
        /* ya detenido */
      }
      lfo.disconnect();
      lfoGain.disconnect();
      filter.disconnect();
      bus.disconnect();
    });
    return bus;
  }

  private startChordLoop(
    ctx: AudioContext,
    track: TrackConfig,
    padBus: GainNode,
  ): void {
    let step = 0;
    let nextTime = ctx.currentTime + 0.2;
    const tick = () => {
      if (!this.ctx) return;
      while (nextTime < ctx.currentTime + 15) {
        this.playChord(
          ctx,
          track,
          padBus,
          nextTime,
          track.progression[step % track.progression.length],
        );
        nextTime += track.chordSeconds;
        step++;
      }
    };
    tick();
    this.chordTimer = setInterval(tick, 5000);
  }

  private playChord(
    ctx: AudioContext,
    track: TrackConfig,
    padBus: GainNode,
    at: number,
    freqs: number[],
  ): void {
    const dur = track.chordSeconds + 4; // solapa con el siguiente acorde
    const attack = Math.min(6, track.chordSeconds / 3);
    for (const freq of freqs) {
      this.pluck(ctx, padBus, track.padType, freq, at, dur, attack, track.padLevel);
      if (track.shimmer) {
        this.pluck(ctx, padBus, 'sine', freq * 2, at, dur, attack, track.padLevel * 0.3);
      }
    }
  }

  private pluck(
    ctx: AudioContext,
    padBus: GainNode,
    type: OscillatorType,
    freq: number,
    at: number,
    dur: number,
    attack: number,
    level: number,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + attack);
    g.gain.setValueAtTime(level, at + dur - attack);
    g.gain.linearRampToValueAtTime(0, at + dur);
    osc.connect(g);
    g.connect(padBus);
    osc.start(at);
    osc.stop(at + dur + 0.1);
    const cleanup = () => {
      try {
        osc.disconnect();
      } catch {
        /* ya desconectado */
      }
      try {
        g.disconnect();
      } catch {
        /* ya desconectado */
      }
    };
    this.teardownSteps.push(cleanup);
    osc.onended = () => {
      cleanup();
      const i = this.teardownSteps.indexOf(cleanup);
      if (i >= 0) this.teardownSteps.splice(i, 1);
    };
  }

  private buildSoftNoise(ctx: AudioContext, master: GainNode): void {
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // Ruido rosa aproximado (filtro Paul Kellet de 1 polo).
      const white = Math.random() * 2 - 1;
      last = 0.98 * last + 0.02 * white;
      data[i] = last * 3;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
    this.teardownSteps.push(() => {
      try {
        src.stop();
      } catch {
        /* ya detenido */
      }
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    });
  }

  private teardownNow(): void {
    if (this.chordTimer !== null) {
      clearInterval(this.chordTimer);
      this.chordTimer = null;
    }
    if (this.stopTimeout !== null) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    const steps = this.teardownSteps;
    this.teardownSteps = [];
    for (const fn of steps) {
      try {
        fn();
      } catch {
        /* limpieza best-effort */
      }
    }
    if (this.master) {
      try {
        this.master.disconnect();
      } catch {
        /* ya desconectado */
      }
      this.master = null;
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        /* ya desconectado */
      }
      this.analyser = null;
    }
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) {
      void ctx.close().catch(() => undefined);
    }
    this.playback.set('idle');
    this.activeTrackId.set(null);
  }
}
