/**
 * DOMAIN · Modelo de pistas binaurales.
 *
 * Capa de negocio pura: nada de Angular ni Web Audio aquí. La única
 * "frecuencia" permitida es la matemática. Incluso el tipo de onda se
 * declara como `Waveform` propio en vez de `OscillatorType` (que es un
 * tipo de lib.dom): el dominio define su lenguaje, la capa de datos lo
 * traduce al de la plataforma.
 */

/** Formas de onda que el negocio permite para el colchón armónico. */
export type Waveform = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface TrackConfig {
  id: string;
  name: string;
  band: string;
  beatHz: number;
  carrierHz: number;
  leftHz: number;
  rightHz: number;
  blurb: string;
  use: string;
  sessionNote: string;
  /** Tipo de oscilador del colchón armónico. */
  padType: Waveform;
  /** Nivel relativo del colchón (0-1). El beat binaural siempre va al frente. */
  padLevel: number;
  /** Duración de cada acorde del loop, en segundos. */
  chordSeconds: number;
  /** Si true, suma una octava brillante muy baja (solo pista profunda). */
  shimmer: boolean;
  /** Si true, suma ruido rosa filtrado muy bajo (solo meditación). */
  noise: boolean;
  /** Progresión de acordes en loop. Cada acorde = lista de frecuencias (Hz). */
  progression: number[][];
}

/**
 * REGLA DE NEGOCIO central del efecto binaural: cada oído recibe el
 * carrier desplazado ∓ beat/2, de modo que la diferencia interaural
 * es exactamente el beat deseado (p. ej. 195/205 Hz → 10 Hz percibidos).
 */
export function deriveStereoPair(
  carrierHz: number,
  beatHz: number,
): { leftHz: number; rightHz: number } {
  return {
    leftHz: carrierHz - beatHz / 2,
    rightHz: carrierHz + beatHz / 2,
  };
}

interface TrackSeed extends Omit<TrackConfig, 'leftHz' | 'rightHz'> {}

function define(t: TrackSeed): TrackConfig {
  return { ...t, ...deriveStereoPair(t.carrierHz, t.beatHz) };
}

/** Sesión mínima sugerida por la literatura (min). */
export const MIN_SESSION_SECONDS = 30 * 60;

export const TRACKS: TrackConfig[] = [
  define({
    id: 'focus',
    name: 'Enfoque Alpha',
    band: 'Alpha · 10 Hz',
    beatHz: 10,
    carrierHz: 200,
    blurb:
      'Pulso binaural de 10 Hz sobre una base cálida de 200 Hz. Alpha medio: alerta relajada para concentrarte sin tensión.',
    use: 'Estudiar, programar, leer, escribir. Trabajo profundo.',
    sessionNote: 'Sesión sugerida: 30–45 min. Combina bien con Pomodoro (25/5).',
    padType: 'triangle',
    padLevel: 0.05,
    chordSeconds: 20,
    shimmer: false,
    noise: false,
    // La menor – Fa – Do – Sol (progresión calmada y estable)
    progression: [
      [110.0, 164.81, 220.0, 261.63],
      [87.31, 130.81, 174.61, 220.0],
      [130.81, 196.0, 261.63, 329.63],
      [98.0, 146.83, 196.0, 246.94],
    ],
  }),
  define({
    id: 'calm',
    name: 'Calma Alpha',
    band: 'Alpha · 9 Hz',
    beatHz: 9,
    carrierHz: 190,
    blurb:
      'Pulso binaural de 9 Hz (alpha bajo) sobre base de 190 Hz. El borde relajado de la banda alpha (8–12 Hz): calma con atención interna, el territorio entre alerta y meditación.',
    use: 'Respiración, bajar revoluciones, soltar tensión, transición hacia el sueño.',
    sessionNote: 'Sesión sugerida: 20–30 min. Ojos cerrados amplifica el efecto.',
    padType: 'sine',
    padLevel: 0.06,
    chordSeconds: 25,
    shimmer: false,
    noise: true,
    // Pentatónica de La menor — abierta y flotante
    progression: [
      [110.0, 130.81, 164.81, 220.0],
      [87.31, 110.0, 164.81],
      [98.0, 146.83, 196.0],
      [123.47, 164.81, 246.94],
    ],
  }),
  define({
    id: 'meditation',
    name: 'Meditación Theta',
    band: 'Theta · 6 Hz',
    beatHz: 6,
    carrierHz: 180,
    blurb:
      'Pulso binaural de 6 Hz sobre una base grave de 180 Hz. Banda theta: el estado de la meditación profunda y el borde del sueño.',
    use: 'Meditación sentada, respiración, body scan, visualización.',
    sessionNote:
      'Sesión sugerida: 15–30 min. Sentado y erguido; si te da sueño, cambia a Alpha.',
    padType: 'sine',
    padLevel: 0.07,
    chordSeconds: 30,
    shimmer: false,
    noise: true,
    // Re menor – Sib – Fa – Do, lento y grave
    progression: [
      [146.83, 220.0, 293.66],
      [116.54, 174.61, 233.08],
      [87.31, 174.61, 220.0, 261.63],
      [130.81, 196.0, 261.63],
    ],
  }),
  define({
    id: 'deep',
    name: 'Inmersión Gamma',
    band: 'Gamma · 40 Hz',
    beatHz: 40,
    carrierHz: 200,
    blurb:
      'Pulso binaural de 40 Hz (180/220 Hz por oído). Gamma: la banda de la conciencia plena e insight. No existe una "frecuencia DMT" probada; esto explora el estado de alta coherencia que la literatura asocia a meditación avanzada.',
    use: 'Exploración profunda, ojos cerrados, acostado. Solo si ya meditas con comodidad.',
    sessionNote:
      'Sesión sugerida: empieza con 10–15 min. Estimulante: si molesta, para. No usar con epilepsia.',
    padType: 'sine',
    padLevel: 0.04,
    chordSeconds: 24,
    shimmer: true,
    noise: false,
    // Mi menor – Do – Sol – Re, con brillo superior
    progression: [
      [82.41, 164.81, 196.0, 246.94],
      [65.41, 130.81, 196.0, 261.63],
      [98.0, 146.83, 196.0, 293.66],
      [73.42, 146.83, 220.0, 293.66],
    ],
  }),
];

/**
 * Índice por id: lookup O(1) para el motor y el player. El array TRACKS
 * conserva el orden de la playlist; el Map es la fachada de consulta.
 */
export const TRACKS_BY_ID: ReadonlyMap<string, TrackConfig> = new Map(
  TRACKS.map((t) => [t.id, t]),
);

export function getTrackById(id: string): TrackConfig | undefined {
  return TRACKS_BY_ID.get(id);
}
