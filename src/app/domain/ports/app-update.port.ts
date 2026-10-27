import type { Signal } from '@angular/core';

/**
 * DOMAIN · Puerto de actualización de la aplicación (PWA).
 *
 * Contrato para enterarse de que el service worker descargó e instaló
 * una versión nueva lista para activarse, y para activarla. El dominio
 * solo define qué se sabe (¿hay versión nueva?) y qué se puede hacer
 * (activarla) — nunca cómo.
 *
 * Igual que en los demás puertos, `Signal` entra como type-only import:
 * dependencia de tipos en compilación, cero runtime de framework aquí.
 *
 * Decisión de diseño: activar NO es automático. Recargar la página
 * cortaría una sesión de escucha en curso, así que la activación es
 * siempre una decisión explícita de la presentación (y del usuario).
 */
export interface AppUpdatePort {
  /** true cuando hay una versión nueva instalada esperando activación. */
  readonly ready: Signal<boolean>;
  /** Activa la versión nueva (recarga la página para arrancarla). */
  apply(): void;
}
