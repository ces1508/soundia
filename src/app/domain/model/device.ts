/**
 * DOMAIN · Dispositivos de salida como los entiende el negocio.
 *
 * soundia no sabe qué es un `MediaDeviceInfo` (eso es capa de datos):
 * conoce "salidas de audio" con nombre, si son auriculares y cuál está
 * activa. La regla de clasificación vive aquí, pura y testeable.
 */

export interface OutputDevice {
  deviceId: string;
  /** '' si el navegador no expone el nombre (privacidad, sin permisos). */
  label: string;
  /** true si es la salida por defecto del sistema. */
  isDefault: boolean;
  /** Clasificación heurística: ¿parecen auriculares? */
  headphone: boolean;
}

export type HeadphoneState = 'yes' | 'no' | 'unknown';

/**
 * REGLA DE NEGOCIO: clasificar una etiqueta de dispositivo. Marcadores
 * habituales en macOS ("AirPods Pro", "External Headphones"), Windows
 * ("Headphones (Realtek...)") y Linux ("cascos", "auriculares").
 * Los altavoces ("Speakers", "MacBook Pro Speakers") no coinciden.
 */
export function isHeadphoneLabel(label: string): boolean {
  return /airpod|headphone|headset|earbuds?|earphones?|buds|auricular|cascos?|aud[ií]fonos?|diadema/i.test(
    label,
  );
}
