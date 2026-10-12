import { Injectable } from '@angular/core';
import {
  MediaControlsHandlers,
  MediaControlsPort,
  MediaSessionSnapshot,
} from '../domain/ports/media-controls.port';

/**
 * DATA · Adaptador del puerto `MediaControlsPort` sobre la
 * Media Session API (`navigator.mediaSession`).
 *
 * Da a soundia presencia en: teclas multimedia del teclado, botones de
 * auriculares Bluetooth, panel de medios del OS y pantalla de bloqueo.
 *
 * Web Audio no alimenta estos controles por sí solo (no hay
 * HTMLMediaElement): este adaptador declara metadata + handlers y el
 * sistema llama hacia aquí. Todo es defensivo: sin soporte o sin gesto,
 * cada operación es no-op.
 */
@Injectable()
export class MediaSessionAdapter implements MediaControlsPort {
  private handlers: MediaControlsHandlers | null = null;

  readonly supported: boolean =
    typeof navigator !== 'undefined' &&
    'mediaSession' in navigator &&
    !!navigator.mediaSession;

  init(handlers: MediaControlsHandlers): void {
    if (!this.supported) return;
    this.handlers = handlers;
    const ms = navigator.mediaSession;
    const bind = (action: MediaSessionAction, run: () => void) => {
      try {
        ms.setActionHandler(action, () => run());
      } catch {
        /* acción no soportada por el navegador: se ignora */
      }
    };
    bind('play', () => this.handlers?.onResume());
    bind('pause', () => this.handlers?.onPause());
    bind('stop', () => this.handlers?.onStop());
    bind('previoustrack', () => this.handlers?.onPrevious());
    bind('nexttrack', () => this.handlers?.onNext());
  }

  sync(snapshot: MediaSessionSnapshot): void {
    if (!this.supported) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({
        title: snapshot.track.name,
        artist: `soundia · ${snapshot.track.band}`,
        album: 'soundia — canciones binaurales infinitas',
        artwork: [
          {
            // Resuelve contra el base href actual (funciona en /soundia/ de Pages).
            src: new URL('favicon.ico', document.baseURI).href,
            sizes: 'any',
            type: 'image/x-icon',
          },
        ],
      });
      ms.playbackState = snapshot.isPlaying ? 'playing' : 'paused';
      const duration = snapshot.durationSec;
      if (duration && duration > 0) {
        ms.setPositionState({
          duration,
          position: Math.min(snapshot.positionSec, duration),
          playbackRate: 1,
        });
      }
    } catch {
      /* metadata/posición falló (p. ej. position > duration): no-op */
    }
  }
}
