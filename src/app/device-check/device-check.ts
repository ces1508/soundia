import { Component, computed, inject, signal } from '@angular/core';
import { AudioDevices, OutputDevice } from '../audio-devices.service';
import { BinauralEngine } from '../binaural-engine.service';

/**
 * Estados de la comprobación guiada por oído:
 * idle → left (suena izq) → leftQ (pregunta) → right (suena der) →
 * rightQ (pregunta) → ok | fail. Si el usuario falla en la izquierda
 * pasamos directo a 'fail' (el aislamiento ya está roto).
 */
type CheckStep = 'idle' | 'left' | 'leftQ' | 'right' | 'rightQ' | 'ok' | 'fail';

@Component({
  selector: 'app-device-check',
  styleUrl: './device-check.css',
  templateUrl: './device-check.html',
})
export class DeviceCheck {
  protected readonly devices = inject(AudioDevices);
  protected readonly engine = inject(BinauralEngine);

  protected readonly step = signal<CheckStep>('idle');
  /** true mientras suena un tono de test (bloquea botones). */
  protected readonly checking = signal(false);

  /** Con sesión en marcha el test se oiría sucio: pedimos detener primero. */
  protected readonly sessionBusy = computed(
    () => this.engine.playback() !== 'idle',
  );

  constructor() {
    // Arranca inventario + escucha de devicechange (no-op en SSR/jsdom).
    this.devices.init();
  }

  protected pick(device: OutputDevice): void {
    this.devices.pick(device);
    // Si hay sesión sonando, re-rútala al dispositivo elegido al vuelo.
    void this.engine.applySink();
  }

  protected chooseNative(): void {
    void this.devices.chooseNative();
  }

  protected refresh(): void {
    void this.devices.refresh();
  }

  protected async startCheck(): Promise<void> {
    if (this.checking() || this.sessionBusy()) return;
    this.checking.set(true);
    this.step.set('left');
    await this.engine.playSideTest('left');
    // Si el usuario reseteó mientras sonaba, no pisamos su estado.
    if (this.step() === 'left') this.step.set('leftQ');
    this.checking.set(false);
  }

  protected async answerLeft(heard: 'only' | 'both' | 'none'): Promise<void> {
    if (heard !== 'only') {
      this.step.set('fail');
      return;
    }
    this.checking.set(true);
    this.step.set('right');
    await this.engine.playSideTest('right');
    if (this.step() === 'right') this.step.set('rightQ');
    this.checking.set(false);
  }

  protected answerRight(heard: 'only' | 'both' | 'none'): void {
    this.step.set(heard === 'only' ? 'ok' : 'fail');
  }

  protected resetCheck(): void {
    this.step.set('idle');
  }
}
