import { TrackConfig } from '../model/tracks';

/**
 * DOMAIN · Puerto de controles multimedia del sistema.
 *
 * Contrato para exponer la sesión a los controles del SO: teclas
 * multimedia, botones de auriculares Bluetooth y el panel de medios
 * (Media Session API en la capa de datos). El dominio solo define qué
 * se muestra y qué acciones existen — nunca cómo.
 *
 * Nota honesta de alcance: el volumen NO es parte de este contrato —
 * las teclas de volumen del sistema escalan la salida de audio a nivel
 * de dispositivo (ya afecta a Web Audio); la Media Session API no
 * expone acciones de volumen.
 */

/** Instantánea del estado de sesión para los controles del sistema. */
export interface MediaSessionSnapshot {
  track: TrackConfig;
  isPlaying: boolean;
  /** Duración de referencia para la barra del SO; null = sin límite. */
  durationSec: number | null;
  positionSec: number;
}

/** Acciones que el sistema puede pedirle a la app. */
export interface MediaControlsHandlers {
  onResume(): void;
  onPause(): void;
  onStop(): void;
  onPrevious(): void;
  onNext(): void;
}

export interface MediaControlsPort {
  /** true si el navegador expone `navigator.mediaSession`. */
  readonly supported: boolean;
  /** Registra los handlers del sistema. Ignorado si no hay soporte. */
  init(handlers: MediaControlsHandlers): void;
  /** Sincroniza metadata (título/artista) y posición con el SO. */
  sync(snapshot: MediaSessionSnapshot): void;
}
