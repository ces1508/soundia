import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { BinauralEngine } from './binaural-engine.service';
import { MIN_SESSION_SECONDS, TRACKS } from './tracks';
import { Background } from './background/background';
import { Visualizer } from './visualizer/visualizer';
import { DeviceCheck } from './device-check/device-check';

/** Acento de color por pista (orb de portada, brillos, ecualizador). */
const ACCENTS: Record<string, string> = {
  focus: '#7c8cff',
  meditation: '#4fe0c3',
  deep: '#ff6ad5',
};

@Component({
  selector: 'app-root',
  imports: [Background, Visualizer, DeviceCheck],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnDestroy {
  protected readonly engine = inject(BinauralEngine);
  protected readonly tracks = TRACKS;

  /** Duración objetivo en minutos; null = sin límite (hasta que pares). */
  protected readonly goalMinutes = signal<number | null>(30);
  protected readonly goalOptions: (number | null)[] = [10, 15, 30, 45, 60, null];
  protected readonly goalSeconds = computed(() => {
    const g = this.goalMinutes();
    return g === null ? null : g * 60;
  });
  protected readonly goalLabel = computed(() => {
    const g = this.goalMinutes();
    return g === null ? '∞' : `${String(g).padStart(2, '0')}:00`;
  });

  protected readonly elapsed = signal(0);
  protected readonly progress = computed(() => {
    const ref = this.goalSeconds() ?? MIN_SESSION_SECONDS;
    return Math.min(this.elapsed() / ref, 1);
  });
  protected readonly elapsedLabel = computed(() => formatClock(this.elapsed()));
  protected readonly sessionDone = computed(() => {
    const ref = this.goalSeconds() ?? MIN_SESSION_SECONDS;
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

  protected setGoal(value: number | null): void {
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
