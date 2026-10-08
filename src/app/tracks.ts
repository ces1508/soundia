/**
 * Definición de las 3 "canciones" binaurales de soundia.
 *
 * Cada pista = un beat binaural puro (carrier ± beat/2, un tono por oído)
 * + un colchón armónico generativo que cicla acordes en loop infinito.
 * No hay archivos de audio: todo se sintetiza con Web Audio API,
 * así la sesión dura lo que quieras (mínimo sugerido: 30 min) sin cortes.
 *
 * Frecuencias elegidas desde la investigación (ver README de la app):
 * - Foco:        Alpha 10 Hz (foco calmado, memoria de trabajo)
 * - Meditación:  Theta  6 Hz (meditación profunda, theta frontal)
 * - Profundo:    Gamma 40 Hz (estados de alta conciencia; sin "frecuencia DMT" probada)
 */
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
  padType: OscillatorType;
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

function define(
  t: Omit<TrackConfig, 'leftHz' | 'rightHz'>,
): TrackConfig {
  return {
    ...t,
    leftHz: t.carrierHz - t.beatHz / 2,
    rightHz: t.carrierHz + t.beatHz / 2,
  };
}

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
