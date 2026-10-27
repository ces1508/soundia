import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { DATA_PROVIDERS } from './data/di';

/**
 * soundia es una vista única: no hay rutas que navegar. Quitar
 * `provideRouter` saca @angular/router completo del bundle inicial
 * (Lighthouse lo marcaba como ~100 KiB de JS sin usar).
 *
 * `provideClientHydration` reutiliza el HTML pre-renderizado en build
 * (SSG): el contenido llega pintado en el primer byte y Angular no
 * vuelve a crear el árbol, solo se "adhiere" a lo que ya existe.
 *
 * DATA_PROVIDERS conecta los puertos del dominio con sus adaptadores
 * (Web Audio, MediaDevices): el único punto del cliente que conoce las
 * implementaciones concretas.
 *
 * Service worker (PWA/offline): `ngsw-worker.js` solo existe en build de
 * producción. `enabled: !isDevMode()` lo deja fuera de dev y tests
 * (jsdom no tiene `navigator.serviceWorker`); en el prerender del SSG el
 * registro es no-op (guard `ngServerMode` de @angular/service-worker).
 * El registro espera a que la app esté estable para no competir con la
 * hidratación.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideClientHydration(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    ...DATA_PROVIDERS,
  ],
};
