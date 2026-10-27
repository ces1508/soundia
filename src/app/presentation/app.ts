import {
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import {
  AUDIO_DEVICES,
  AUDIO_SYNTH,
  APP_UPDATE,
  MEDIA_CONTROLS,
} from '../data/di';
import {
  SESSION_GOAL_OPTIONS,
  SessionGoalMinutes,
  resolveGoalSeconds,
  resolveProgressReference,
} from '../domain/model/session';
import { TRACKS } from '../domain/model/tracks';
import { Background } from './background/background';
import { Visualizer } from './visualizer/visualizer';
import { DeviceCheck } from './device-check/device-check';

/** Acento de color por pista (orb de portada, brillos, ecualizador). */
const ACCENTS: Record<string, string> = {
  focus: '#7c8cff',
  calm: '#ffc857',
  meditation: '#4fe0c3',
  deep: '#ff6ad5',
};

/**
 * PRESENTACIÓN · Playlist + player.
 *
 * No conoce Web Audio ni MediaDevices: habla con los PUERTOS del dominio
 * (`AUDIO_SYNTH`, `AUDIO_DEVICES`, `MEDIA_CONTROLS`, `APP_UPDATE`) y
 * orquesta:
 * - al iniciar sesión o elegir dispositivo → enruta el sink elegido;
 * - al cambiar el estado de reproducción → congela/reanuda el reloj de
 *   sesión y sincroniza metadata/posición con los controles del SO;
 * - al haber una versión nueva instalada por el service worker → ofrece
 *   el banner de actualización (la recarga solo por clic del usuario).
 */
@Component({
  selector: 'app-root',
  imports: [Background, Visualizer, DeviceCheck],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnDestroy {
  /** Puerto de síntesis (implementado por el adaptador de Web Audio). */
  protected readonly engine = inject(AUDIO_SYNTH);
  /** Puerto de dispositivos (implementado por el adaptador de MediaDevices). */
  protected readonly devices = inject(AUDIO_DEVICES);
  /** Puerto de controles del sistema (Media Session API). */
  protected readonly media = inject(MEDIA_CONTROLS);
  /** Puerto de actualización de la app (service worker). */
  protected readonly update = inject(APP_UPDATE);
  protected readonly tracks = TRACKS;

  /** Duración objetivo en minutos; null = sin límite (hasta que pares). */
  protected readonly goalMinutes = signal<SessionGoalMinutes | null>(30);
  protected readonly goalOptions = SESSION_GOAL_OPTIONS;
  protected readonly goalSeconds = computed(() =>
    resolveGoalSeconds(this.goalMinutes()),
  );
  protected readonly goalLabel = computed(() => {
    const g = this.goalMinutes();
    return g === null ? '∞' : `${String(g).padStart(2, '0')}:00`;
  });

  protected readonly elapsed = signal(0);
  protected readonly progress = computed(() => {
    const ref = resolveProgressReference(this.goalSeconds());
    return Math.min(this.elapsed() / ref, 1);
  });
  protected readonly elapsedLabel = computed(() => formatClock(this.elapsed()));
  protected readonly sessionDone = computed(() => {
    const ref = resolveProgressReference(this.goalSeconds());
    return this.elapsed() >= ref;
  });

  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private clockFrozen = false;

  constructor() {
    // Controles del sistema: pausa/reanudar/parar y salto de pista desde
    // teclas multimedia, auriculares Bluetooth y el panel del OS.
    this.media.init({
      onResume: () => this.engine.resume(),
      onPause: () => this.engine.pause(),
      onStop: () => {
        this.engine.stop();
        this.freezeClock();
      },
      onPrevious: () => this.skip(-1),
      onNext: () => this.skip(1),
    });

    // Reacción al estado de reproducción: el reloj se congela en pausa y
    // los controles del sistema siempre ven la verdad de la sesión.
    effect(() => {
      const state = this.engine.playback();
      const track = this.engine.activeTrack;

      if (state === 'paused' && !this.clockFrozen) this.freezeClock();
      if (state === 'playing' && this.clockFrozen) this.thawClock();

      if (track && state !== 'idle') {
        this.media.sync({
          track,
          isPlaying: state === 'playing',
          durationSec: this.goalSeconds(),
          positionSec: untracked(() => this.elapsed()),
        });
      }
    });
  }

  protected accent(trackId: string): string {
    return ACCENTS[trackId] ?? '#7c8cff';
  }

  protected isActive(trackId: string): boolean {
    return (
      this.engine.playback() !== 'idle' &&
      this.engine.activeTrackId() === trackId
    );
  }

  protected isPlaying(): boolean {
    return this.engine.playback() === 'playing';
  }

  /**
   * Botón principal de la pista: arranca, o alterna pausa/reanudar si ya
   * es la pista activa. El STOP completo vive en el botón ⏹ del player.
   */
  protected toggle(trackId: string): void {
    if (!this.isActive(trackId)) {
      this.startTrack(trackId);
      return;
    }
    if (this.isPlaying()) {
      this.engine.pause();
      this.freezeClock();
    } else {
      this.engine.resume();
      this.thawClock();
    }
  }

  /** ⏹ del player: detener de verdad (fade-out + teardown). */
  protected stopSession(): void {
    this.engine.stop();
    this.freezeClock();
  }

  /** Salta a la pista siguiente/anterior respetando el orden de la playlist. */
  protected skip(direction: 1 | -1): void {
    const ids = TRACKS.map((t) => t.id);
    const current = this.engine.activeTrackId() ?? ids[0];
    const idx = ids.indexOf(current);
    const next = ids[(idx + direction + ids.length) % ids.length];
    this.startTrack(next);
  }

  protected onVolume(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.engine.setVolume(Number(input.value) / 100);
  }

  protected setGoal(value: SessionGoalMinutes | null): void {
    this.goalMinutes.set(value);
  }

  ngOnDestroy(): void {
    this.stopClock();
    this.engine.stop();
  }

  private startTrack(trackId: string): void {
    this.engine.start(trackId);
    // Orquestación presentación: la sesión nace en el sink elegido.
    void this.engine.applySink(this.devices.selectedId());
    this.startClock();
  }

  private startClock(): void {
    this.stopClock();
    this.startedAt = Date.now();
    this.elapsed.set(0);
    this.clockFrozen = false;
    this.runClock();
  }

  /** Reanuda el reloj conservando el tiempo ya escuchado. */
  private thawClock(): void {
    this.stopClock();
    this.startedAt = Date.now() - this.elapsed() * 1000;
    this.runClock();
  }

  /** Congela sin perder el acumulado (pausa = no cuenta tiempo de sesión). */
  private freezeClock(): void {
    this.stopClock();
    this.clockFrozen = true;
  }

  private runClock(): void {
    if (typeof window === 'undefined') return;
    this.timer = setInterval(() => {
      const s = Math.floor((Date.now() - this.startedAt) / 1000);
      this.elapsed.set(s);
      // Auto-stop con fade-out al cumplir la duración elegida.
      const goal = this.goalSeconds();
      if (goal !== null && s >= goal) {
        this.engine.stop();
        this.freezeClock();
      }
    }, 500);
  }

  private stopClock(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`;
}
