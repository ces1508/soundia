import type { Signal } from '@angular/core';
import {
  HeadphoneState,
  OutputDevice,
} from '../model/device';

/**
 * DOMAIN · Puerto de descubrimiento y selección de salidas.
 *
 * Contrato que abstrae `navigator.mediaDevices` (capa de datos).
 * La regla de oro del producto vive en el dominio y se mantiene aquí:
 * NUNCA se solicita `getUserMedia` — pedir el micrófono fuerza el perfil
 * manos-libres mono en Bluetooth y destruye el efecto binaural.
 */
export interface AudioDevicesPort {
  /** Inventario actual de salidas conocidas. */
  readonly outputs: Signal<OutputDevice[]>;
  /** deviceId elegido por el usuario; null = salida por defecto del sistema. */
  readonly selectedId: Signal<string | null>;
  /** Dispositivos con nombre visible (los únicos que se muestran en UI). */
  readonly namedOutputs: Signal<OutputDevice[]>;
  /** Clasificación: ¿hay auriculares? 'unknown' si el navegador oculta nombres. */
  readonly headphoneState: Signal<HeadphoneState>;

  /** Arranca inventario + escucha de `devicechange`. No-op fuera del browser. */
  init(): void;
  /** Re-inventa la lista de salidas. */
  refresh(): Promise<void>;
  /** Marca un dispositivo como activo (la presentación enruta el sink). */
  pick(device: OutputDevice): void;
  /** Selector nativo del navegador (Chromium); cachea la etiqueta aprendida. */
  chooseNative(): Promise<void>;

  /** ¿Existe `selectAudioOutput`? (requiere gesto; solo Chromium). */
  readonly supportsNativePicker: boolean;
  /** ¿Se puede enrutar el contexto con `setSinkId`? (spec Web Audio). */
  readonly supportsSinkSelection: boolean;
}
