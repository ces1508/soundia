import { Injectable, computed, signal } from '@angular/core';

/**
 * Dispositivo de salida de audio tal como lo expone el navegador.
 *
 * `label` puede llegar vacío: por privacidad, los navegadores ocultan los
 * nombres de los dispositivos si el usuario no concedió permiso de
 * micrófono. soundia NUNCA pide ese permiso (ver garantía abajo), así que
 * los nombres se descubren de dos formas: cacheando lo que devuelve
 * `selectAudioOutput()` (ese sí trae etiqueta con solo un click del
 * usuario) o mostrando el estado "desconocido" y ofreciendo la
 * comprobación guiada por oído.
 */
export interface OutputDevice {
  deviceId: string;
  label: string;
  /** true si es la salida por defecto del sistema (deviceId 'default'). */
  isDefault: boolean;
  /** Heurística de etiqueta: ¿parecen auriculares? */
  headphone: boolean;
}

export type HeadphoneState = 'yes' | 'no' | 'unknown';

/**
 * Detección y selección de salidas de audio.
 *
 * GARANTÍA DEL MICRÓFONO: este servicio (y todo soundia) no llama nunca a
 * `navigator.mediaDevices.getUserMedia`. Motivos: 1) no lo necesitamos,
 * todo el audio es sintetizado con Web Audio API; 2) pedir el micro hace
 * que muchos auriculares Bluetooth salten del perfil A2DP (estéreo) al
 * perfil manos-libres HFP (mono, calidad telefónica), lo que destruiría
 * el aislamiento L/R que sostiene el efecto binaural. Hay un test que
 * verifica que getUserMedia no se invoca en ningún flujo.
 */
@Injectable({ providedIn: 'root' })
export class AudioDevices {
  readonly outputs = signal<OutputDevice[]>([]);

  /** deviceId elegido por el usuario; null = usar la salida por defecto del sistema. */
  readonly selectedId = signal<string | null>(null);

  /** Dispositivos con nombre conocido (los únicos que se muestran como tarjetas). */
  readonly namedOutputs = computed(() =>
    this.outputs().filter((d) => d.label !== ''),
  );

  /**
   * Estado de auriculares según la heurística de etiquetas.
   * 'unknown' = el navegador oculta los nombres (sin permiso de micro,
   * que soundia no pide) y el usuario aún no elige dispositivo.
   */
  readonly headphoneState = computed<HeadphoneState>(() => {
    const named = this.namedOutputs();
    if (named.length === 0) return 'unknown';
    return named.some((d) => d.headphone) ? 'yes' : 'no';
  });

  /** Etiquetas aprendidas vía selectAudioOutput (sobreviven a refresh). */
  private readonly labelCache = new Map<string, string>();
  private inited = false;

  /** ¿Existe el selector nativo de salida? (Chromium; requiere gesto). */
  get supportsNativePicker(): boolean {
    const md =
      typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    return (
      !!md &&
      typeof (md as MediaDevices & { selectAudioOutput?: unknown })
        .selectAudioOutput === 'function'
    );
  }

  /** ¿Se puede enrutar el AudioContext a un dispositivo concreto? (spec Web Audio). */
  get supportsSinkSelection(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.AudioContext === 'function' &&
      'setSinkId' in window.AudioContext.prototype
    );
  }

  /**
   * Arranca la escucha y el primer inventario. Seguro en SSR/jsdom:
   * sin `navigator.mediaDevices` no hace nada.
   */
  init(): void {
    const md =
      typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!md || this.inited) return;
    this.inited = true;
    md.addEventListener?.('devicechange', () => void this.refresh());
    void this.refresh();
  }

  /** Re-inventa la lista de salidas mezclando las etiquetas ya aprendidas. */
  async refresh(): Promise<void> {
    const md =
      typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!md?.enumerateDevices) return;
    try {
      const infos = await md.enumerateDevices();
      const outs = infos
        // Windows duplica el micrófono de comunicaciones como salida; fuera.
        .filter(
          (d) => d.kind === 'audiooutput' && d.deviceId !== 'communications',
        )
        .map((d): OutputDevice => {
          const label = d.label || this.labelCache.get(d.deviceId) || '';
          return {
            deviceId: d.deviceId,
            label,
            isDefault: d.deviceId === 'default',
            headphone: isHeadphoneLabel(label),
          };
        });
      this.outputs.set(outs);
    } catch {
      /* permiso denegado o API ausente: la UI cae al estado 'unknown' */
    }
  }

  /** El usuario marca una tarjeta como activa. El App enruta el sink después. */
  pick(device: OutputDevice): void {
    this.selectedId.set(device.deviceId);
  }

  /**
   * Abre el selector nativo del navegador (requiere gesto del usuario).
   * Devuelve el MediaDeviceInfo CON etiqueta, incluso sin permiso de micro;
   * cacheamos el nombre y dejamos el dispositivo como salida activa.
   */
  async chooseNative(): Promise<void> {
    const md =
      typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    const sel = md as
      | (MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> })
      | undefined;
    if (!sel || typeof sel.selectAudioOutput !== 'function') return;
    try {
      const info = await sel.selectAudioOutput();
      if (!info?.deviceId) return; // el usuario canceló
      this.labelCache.set(info.deviceId, info.label ?? '');
      this.selectedId.set(info.deviceId);
      await this.refresh();
    } catch {
      /* cancelado o falla del navegador: seguimos con el estado previo */
    }
  }
}

/**
 * Heurística de etiquetas: marcadores habituales de auriculares en
 * macOS ("AirPods Pro", "External Headphones"), Windows ("Headphones
 * (Realtek...)") y Linux ("cascos", "auriculares"). Los altavoces
 * ("Speakers", "MacBook Pro Speakers") no coinciden.
 */
export function isHeadphoneLabel(label: string): boolean {
  return /airpod|headphone|headset|earbuds?|earphones?|buds|auricular|cascos?|aud[ií]fonos?|diadema/i.test(
    label,
  );
}
