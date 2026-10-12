/**
 * DOMAIN · Estado de reproducción y tipos del flujo de audio.
 *
 * Tipos del lenguaje de negocio: la presentación y los adaptadores
 * hablan en estos términos, nunca en los de la plataforma.
 */

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'stopping';

/** Oído destino del tono de comprobación guiada. */
export type TestSide = 'left' | 'right';
