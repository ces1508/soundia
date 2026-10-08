import { TestBed } from '@angular/core/testing';
import { AudioDevices, isHeadphoneLabel } from './audio-devices.service';
import { BinauralEngine } from './binaural-engine.service';

/**
 * Stub mínimo de navigator.mediaDevices. jsdom no lo implementa y el
 * servicio debe degradarse sin romper; aquí lo sustituimos para probar
 * los flujos reales. JAMÁS usamos getUserMedia en la app: el spy va
 * presente precisamente para demostrar que no se llama.
 */
type MdStub = {
  enumerateDevices: () => Promise<MediaDeviceInfo[]>;
  selectAudioOutput?: () => Promise<MediaDeviceInfo>;
  getUserMedia: ReturnType<typeof vi.fn>;
  addEventListener?: (type: string, fn: () => void) => void;
};

function installMediaDevices(stub: MdStub | undefined): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: stub,
    configurable: true,
    writable: true,
  });
}

function deviceInfo(
  partial: Partial<MediaDeviceInfo> & { kind: MediaDeviceKind },
): MediaDeviceInfo {
  return {
    deviceId: '',
    label: '',
    toJSON: () => ({}),
    ...partial,
  } as MediaDeviceInfo;
}

describe('isHeadphoneLabel (heurística)', () => {
  it('reconoce auriculares habituales', () => {
    expect(isHeadphoneLabel('AirPods Pro de Christian')).toBe(true);
    expect(isHeadphoneLabel('External Headphones')).toBe(true);
    expect(isHeadphoneLabel('Headphones (Realtek(R) Audio)')).toBe(true);
    expect(isHeadphoneLabel('Auriculares (Intel SST)')).toBe(true);
    expect(isHeadphoneLabel('Galaxy Buds2 Pro')).toBe(true);
  });

  it('no marca altavoces como auriculares', () => {
    expect(isHeadphoneLabel('MacBook Pro Speakers')).toBe(false);
    expect(isHeadphoneLabel('Speakers (2- USB Audio CODEC)')).toBe(false);
    expect(isHeadphoneLabel('')).toBe(false);
  });
});

describe('AudioDevices', () => {
  afterEach(() => {
    installMediaDevices(undefined);
  });

  it('degrada sin navigator.mediaDevices (SSR/jsdom)', async () => {
    installMediaDevices(undefined);
    const svc = TestBed.inject(AudioDevices);
    expect(() => svc.init()).not.toThrow();
    await expect(svc.refresh()).resolves.toBeUndefined();
    expect(svc.outputs()).toEqual([]);
    expect(svc.headphoneState()).toBe('unknown');
  });

  it('inventa salidas, filtra "communications" y clasifica auriculares', async () => {
    installMediaDevices({
      enumerateDevices: async () => [
        deviceInfo({
          kind: 'audiooutput',
          deviceId: 'default',
          label: 'Default - AirPods Pro',
        }),
        deviceInfo({
          kind: 'audiooutput',
          deviceId: 'airpods',
          label: 'AirPods Pro',
        }),
        deviceInfo({
          kind: 'audiooutput',
          // Este es el deviceId literal que Chrome usa en Windows para
          // el dispositivo de comunicaciones (duplicado del micro).
          deviceId: 'communications',
          label: 'Headset (comms)',
        }),
        deviceInfo({
          kind: 'audiooutput',
          deviceId: 'spk',
          label: 'MacBook Pro Speakers',
        }),
        deviceInfo({ kind: 'audioinput', deviceId: 'mic', label: 'Micro' }),
      ],
      getUserMedia: vi.fn(),
    });
    const svc = TestBed.inject(AudioDevices);
    await svc.refresh();
    const ids = svc.outputs().map((d) => d.deviceId);
    expect(ids).not.toContain('communications');
    expect(ids).not.toContain('mic');
    expect(svc.namedOutputs().length).toBe(3);
    expect(svc.headphoneState()).toBe('yes');
    const spk = svc.outputs().find((d) => d.deviceId === 'spk');
    expect(spk?.headphone).toBe(false);
    expect(spk?.isDefault).toBe(false);
    expect(svc.outputs().find((d) => d.deviceId === 'default')?.isDefault).toBe(
      true,
    );
  });

  it('estado "no" si solo hay altavoces con nombre', async () => {
    installMediaDevices({
      enumerateDevices: async () => [
        deviceInfo({
          kind: 'audiooutput',
          deviceId: 'spk',
          label: 'MacBook Pro Speakers',
        }),
      ],
      getUserMedia: vi.fn(),
    });
    const svc = TestBed.inject(AudioDevices);
    await svc.refresh();
    expect(svc.headphoneState()).toBe('no');
  });

  it('pick marca la tarjeta activa', async () => {
    installMediaDevices({
      enumerateDevices: async () => [
        deviceInfo({ kind: 'audiooutput', deviceId: 'a', label: 'AirPods' }),
        deviceInfo({ kind: 'audiooutput', deviceId: 'b', label: 'Speakers' }),
      ],
      getUserMedia: vi.fn(),
    });
    const svc = TestBed.inject(AudioDevices);
    await svc.refresh();
    expect(svc.selectedId()).toBeNull();
    svc.pick(svc.outputs()[1]);
    expect(svc.selectedId()).toBe('b');
  });

  it('chooseNative cachea la etiqueta y selecciona el dispositivo', async () => {
    installMediaDevices({
      enumerateDevices: async () => [
        // Sin permiso de micro las etiquetas llegan vacías...
        deviceInfo({ kind: 'audiooutput', deviceId: 'default', label: '' }),
        deviceInfo({ kind: 'audiooutput', deviceId: 'bt', label: '' }),
      ],
      selectAudioOutput: async () =>
        deviceInfo({
          kind: 'audiooutput',
          deviceId: 'bt',
          label: 'AirPods Pro de Christian',
        }),
      getUserMedia: vi.fn(),
    });
    const svc = TestBed.inject(AudioDevices);
    await svc.refresh();
    expect(svc.headphoneState()).toBe('unknown'); // nombres ocultos
    await svc.chooseNative();
    expect(svc.selectedId()).toBe('bt');
    const bt = svc.outputs().find((d) => d.deviceId === 'bt');
    expect(bt?.label).toBe('AirPods Pro de Christian');
    expect(bt?.headphone).toBe(true);
    expect(svc.headphoneState()).toBe('yes');
  });
});

describe('Garantía del micrófono', () => {
  it('ningún flujo llama a getUserMedia', async () => {
    const gum = vi.fn();
    installMediaDevices({
      enumerateDevices: async () => [
        deviceInfo({ kind: 'audiooutput', deviceId: 'bt', label: 'AirPods' }),
      ],
      selectAudioOutput: async () =>
        deviceInfo({ kind: 'audiooutput', deviceId: 'bt', label: 'AirPods' }),
      getUserMedia: gum,
      addEventListener: () => undefined,
    });

    const devices = TestBed.inject(AudioDevices);
    const engine = TestBed.inject(BinauralEngine);

    devices.init(); // devicechange listener
    await devices.refresh();
    await devices.chooseNative();
    devices.pick(devices.outputs()[0]);
    engine.start('focus'); // en jsdom corta antes de crear AudioContext
    await engine.playSideTest('left'); // idem
    await engine.playSideTest('right');
    await engine.applySink();

    expect(gum).not.toHaveBeenCalled();
    expect(engine.playback()).toBe('idle');
  });
});
