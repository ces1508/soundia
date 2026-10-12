import { InjectionToken, Provider } from '@angular/core';
import { AudioSynthPort } from '../domain/ports/audio-synth.port';
import { AudioDevicesPort } from '../domain/ports/audio-devices.port';
import { MediaControlsPort } from '../domain/ports/media-controls.port';
import { BinauralEngine } from './binaural-engine.service';
import { AudioDevices } from './audio-devices.service';
import { MediaSessionAdapter } from './media-session.service';

/**
 * DATA · Cableado de dependencias (composición root parcial).
 *
 * La presentación depende de los PUERTOS (tokens tipados con los
 * contratos del dominio); aquí se decide qué adaptador concreto los
 * satisface. Cambiar Web Audio por otra implementación = escribir otro
 * adaptador y tocar SOLO este archivo.
 */
export const AUDIO_SYNTH = new InjectionToken<AudioSynthPort>(
  'AudioSynthPort',
);

export const AUDIO_DEVICES = new InjectionToken<AudioDevicesPort>(
  'AudioDevicesPort',
);

export const MEDIA_CONTROLS = new InjectionToken<MediaControlsPort>(
  'MediaControlsPort',
);

export const DATA_PROVIDERS: Provider[] = [
  { provide: AUDIO_SYNTH, useClass: BinauralEngine },
  { provide: AUDIO_DEVICES, useClass: AudioDevices },
  { provide: MEDIA_CONTROLS, useClass: MediaSessionAdapter },
];
