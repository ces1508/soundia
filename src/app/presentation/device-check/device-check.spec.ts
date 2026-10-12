import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioDevicesPort } from '../../domain/ports/audio-devices.port';
import { AUDIO_DEVICES, DATA_PROVIDERS } from '../../data/di';
import { OutputDevice } from '../../domain/model/device';
import { Signal, WritableSignal } from '@angular/core';

/** El puerto es de solo lectura; para sembrar estado de test elevamos a writable. */
function seedOutputs(devices: { readonly outputs: Signal<OutputDevice[]> }, list: OutputDevice[]): void {
  (devices.outputs as WritableSignal<OutputDevice[]>).set(list);
}
import { DeviceCheck } from './device-check';

function device(
  id: string,
  label: string,
  headphone: boolean,
): OutputDevice {
  return { deviceId: id, label, isDefault: id === 'default', headphone };
}

describe('DeviceCheck', () => {
  let fixture: ComponentFixture<DeviceCheck>;
  let devices: AudioDevicesPort;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeviceCheck], providers: [DATA_PROVIDERS],
    }).compileComponents();
    devices = TestBed.inject(AUDIO_DEVICES);
    fixture = TestBed.createComponent(DeviceCheck);
  });

  it('muestra estado "desconocido" cuando el navegador oculta los nombres', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.dc-state.dim')).toBeTruthy();
  });

  it('advierte que el estado solo es posible con auriculares si no los detecta', () => {
    seedOutputs(devices, [device('spk', 'MacBook Pro Speakers', false)]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.dc-state.warn')?.textContent).toContain(
      'solo es posible con auriculares',
    );
    // Un único dispositivo con nombre no justifica selector de tarjetas.
    expect(el.querySelectorAll('.dc-card').length).toBe(0);
  });

  it('confirma cuando detecta auriculares por etiqueta', () => {
    seedOutputs(devices, [device('bt', 'AirPods Pro', true)]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.dc-state.ok')).toBeTruthy();
  });

  it('lista tarjetas (sin <select>) con estado activo y elige al tocarlas', () => {
    seedOutputs(devices, [
      device('bt', 'AirPods Pro', true),
      device('spk', 'MacBook Pro Speakers', false),
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cards = el.querySelectorAll<HTMLButtonElement>('.dc-card');
    expect(cards.length).toBe(2);
    expect(cards[0].classList).not.toContain('on');

    cards[0].click();
    fixture.detectChanges();

    expect(devices.selectedId()).toBe('bt');
    const active = el.querySelector('.dc-card.on');
    expect(active?.textContent).toContain('AirPods Pro');
    expect(active?.getAttribute('aria-pressed')).toBe('true');
    // Icono según heurística: 🎧 auriculares, 🔊 altavoces.
    expect(cards[0].querySelector('.dc-icon')?.textContent).toContain('🎧');
    expect(cards[1].querySelector('.dc-icon')?.textContent).toContain('🔊');
  });

  it('flujo guiado completo: izquierda → pregunta → derecha → pregunta → ok', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLButtonElement>('.dc-choose')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    // En jsdom el tono no suena (no hay AudioContext): pasamos directo a la pregunta.
    expect(el.querySelectorAll('.dc-answers .dc-mini').length).toBe(3);
    expect(el.textContent).toContain('oído izquierdo');

    el.querySelectorAll<HTMLButtonElement>('.dc-answers .dc-mini')[0].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('oído derecho');

    el.querySelectorAll<HTMLButtonElement>('.dc-answers .dc-mini')[0].click();
    fixture.detectChanges();
    expect(el.querySelector('.dc-state.ok')).toBeTruthy();
  });

  it('si la izquierda no llega aislada, muestra diagnóstico de códec/mono', async () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLButtonElement>('.dc-choose')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    el.querySelectorAll<HTMLButtonElement>('.dc-answers .dc-mini')[1].click();
    fixture.detectChanges();

    const warn = el.querySelector('.dc-state.warn');
    expect(warn).toBeTruthy();
    expect(warn?.textContent).toContain('manos-libres');
    expect(warn?.textContent).toContain('modo mono');
  });
});
