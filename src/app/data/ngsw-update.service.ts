import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { AppUpdatePort } from '../domain/ports/app-update.port';

/**
 * DATA · Adaptador del puerto `AppUpdatePort` sobre el service worker
 * de Angular (`ngsw-worker.js`, generado solo en el build de producción).
 *
 * Escucha `versionUpdates` y marca `ready` cuando el service worker ya
 * descargó e instaló una versión nueva esperando activación. Además
 * COMPRUEBA ACTIVAMENTE si hay versiones: ngsw solo chequea cuando la
 * app llega a "estable" y, con `@defer` esperando viewport, eso puede
 * no ocurrir nunca (usuario atascado en una versión vieja). Por eso se
 * comprueba una vez al arrancar y al volver a la pestaña — el momento
 * típico en que un usuario recupera red tras el modo avión. Todo es
 * defensivo: sin service worker (dev, tests, prerender del SSG) el
 * adaptador queda inerte — `SwUpdate.isEnabled` es false y no hay
 * suscripción ni chequeos.
 *
 * `apply()` recarga vía `DOCUMENT` (stubbeable en tests). Nunca se
 * recarga sola: activar una versión nueva mata la página y cortaría una
 * sesión de escucha, así que esa decisión la toma la presentación.
 */
@Injectable()
export class NgswUpdate implements AppUpdatePort {
  private readonly sw = inject(SwUpdate);
  private readonly doc = inject(DOCUMENT);
  private readonly _ready = signal(false);
  readonly ready = this._ready.asReadonly();

  constructor() {
    if (!this.sw.isEnabled) return;
    this.sw.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => this._ready.set(true));

    void this.sw.checkForUpdate();
    this.doc.defaultView?.addEventListener('visibilitychange', () => {
      if (this.doc.visibilityState === 'visible') {
        void this.sw.checkForUpdate();
      }
    });
  }

  apply(): void {
    this.doc.defaultView?.location.reload();
  }
}
