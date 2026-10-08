import type { Signal } from '@angular/core';
import { PlaybackState, TestSide } from '../model/playback';
import { TrackConfig } from '../model/tracks';

/**
 * DOMAIN · Puerto de síntesis de audio.
 *
 * El contrato que la presentación consume para sesionar. La capa de
 * datos lo implementa con Web Audio API; el dominio solo conoce esta
 * forma. Nada aquí dice "OscillatorNode" ni "ChannelMerger".
 *
 * Los `Signal` entran como type-only import: dependencia de tipos en
 * compilación, cero runtime de framework en el dominio.
 */
export interface AudioSynthPort {
  /** Estado del flujo de sesión. */
  readonly playback: Signal<PlaybackState>;
  /** id de la pista activa, o null si no hay sesión. */
  readonly activeTrackId: Signal<string | null>;
  /** Volumen maestro 0-1. */
  readonly volume: Signal<number>;
  /** Pista activa (modelo de dominio), o undefined. */
  readonly activeTrack: TrackConfig | undefined;

  /** Inicia una pista. Debe invocarse desde un gesto del usuario. */
  start(trackId: string): void;
  /** Detiene con fade-out y libera recursos. */
  stop(): void;
  setVolume(value: number): void;

  /**
   * Enruta la salida al deviceId indicado (null/'' = sink del sistema).
   * La presentación orquesta: el sintetizador no sabe qué dispositivo
   * está elegido, solo obedece la ruta que le pasan.
   */
  applySink(deviceId?: string | null): Promise<void>;

  /**
   * Tono de comprobación por un solo oído (aislamiento duro).
   * `deviceId` enruta el contexto efímero del test.
   */
  playSideTest(side: TestSide, deviceId?: string | null): Promise<void>;

  /** Copia el espectro actual en `out`; false si no hay audio activo. */
  getSpectrum(out: Uint8Array<ArrayBuffer>): boolean;
  /** Número de bandas del espectro (fftSize / 2). */
  readonly spectrumSize: number;
}
