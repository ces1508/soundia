/**
 * DOMAIN · Reglas de sesión.
 *
 * Duraciones y estados del objetivo de sesión: reglas de negocio puras
 * que la presentación consume y los tests validan sin Angular de por medio.
 */

export type SessionGoalMinutes = 10 | 15 | 30 | 45 | 60;

/** Duraciones ofrecidas en la UI; `null` = sin límite (hasta que pare). */
export const SESSION_GOAL_OPTIONS: (SessionGoalMinutes | null)[] = [
  10, 15, 30, 45, 60, null,
];

/** Sesión mínima sugerida por la práctica de entrenamiento binaural. */
export const MIN_SESSION_SECONDS = 30 * 60;

/**
 * REGLA: el objetivo en segundos; `null` significa "sin auto-stop" y la
 * barra de progreso usa entonces la sesión mínima como referencia.
 */
export function resolveGoalSeconds(
  goalMinutes: SessionGoalMinutes | null,
): number | null {
  return goalMinutes === null ? null : goalMinutes * 60;
}

/** REGLA: referencia de progreso = objetivo real o, si es infinito, el mínimo. */
export function resolveProgressReference(
  goalSeconds: number | null,
): number {
  return goalSeconds ?? MIN_SESSION_SECONDS;
}
