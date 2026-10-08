import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';

/**
 * soundia es una vista única: no hay rutas que navegar. Quitar
 * `provideRouter` saca @angular/router completo del bundle inicial
 * (Lighthouse lo marcaba como ~100 KiB de JS sin usar).
 *
 * `provideClientHydration` reutiliza el HTML pre-renderizado en build
 * (SSG): el contenido llega pintado en el primer byte y Angular no
 * vuelve a crear el árbol, solo se "adhiere" a lo que ya existe.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideClientHydration(),
  ],
};
