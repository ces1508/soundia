import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import {
  AUDIO_DEVICES,
  AUDIO_SYNTH,
} from '../data/di';
import {
  MIN_SESSION_SECONDS,
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
  meditation: '#4fe0c3',
  deep: '#ff6ad5',
};

/**
 * PRESENTACIÓN · Playlist + player.
 *
 * No conoce Web Audio ni MediaDevices: habla con los PUERTOS del dominio
 * (`AUDIO_SYNTH`, `AUDIO_DEVICES`) y aquí vive la única orquestación
 * entre adaptadores — tras iniciar sesión o elegir dispositivo, enruta
 * el sink que el usuario haya seleccionado.
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

  protected accent(trackId: string): string {
    return ACCENTS[trackId] ?? '#7c8cff';
  }

  protected toggle(trackId: string): void {
    const playingThis =
      this.engine.playback() === 'playing' &&
      this.engine.activeTrackId() === trackId;
    if (playingThis) {
      this.engine.stop();
      this.stopClock();
    } else {
      this.engine.start(trackId);
      // Orquestación presentación: la sesión nace en el sink elegido.
      void this.engine.applySink(this.devices.selectedId());
      this.startClock();
    }
  }

  protected isActive(trackId: string): boolean {
    return (
      this.engine.playback() !== 'idle' &&
      this.engine.activeTrackId() === trackId
    );
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

  private startClock(): void {
    this.stopClock();
    this.startedAt = Date.now();
    this.elapsed.set(0);
    if (typeof window === 'undefined') return;
    this.timer = setInterval(() => {
      const s = Math.floor((Date.now() - this.startedAt) / 1000);
      this.elapsed.set(s);
      // Auto-stop con fade-out al cumplir la duración elegida.
      const goal = this.goalSeconds();
      if (goal !== null && s >= goal) {
        this.engine.stop();
        this.stopClock();
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
