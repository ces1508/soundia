import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import {
  SwUpdate,
  VersionEvent,
  VersionReadyEvent,
} from '@angular/service-worker';
import { Subject } from 'rxjs';
import { APP_UPDATE, DATA_PROVIDERS } from './di';

/**
 * Spec del adaptador de actualizaciones (service worker). jsdom no tiene
 * `navigator.serviceWorker` y `SwUpdate` no es providedIn root: se fakea
 * como value-provider (igual que hará App en su spec). `DOCUMENT` se
 * stubbea para espiar el reload sin navegar de verdad.
 */
describe('NgswUpdate (adaptador del puerto AppUpdatePort)', () => {
  function setup(isEnabled: boolean) {
    const events = new Subject<VersionEvent>();
    const reload = vi.fn();
    const checkForUpdate = vi.fn(async () => false);
    const listeners: Record<string, () => void> = {};
    TestBed.configureTestingModule({
      providers: [
        ...DATA_PROVIDERS,
        {
          provide: SwUpdate,
          useValue: { isEnabled, versionUpdates: events, checkForUpdate },
        },
        {
          provide: DOCUMENT,
          useValue: {
            visibilityState: 'visible',
            defaultView: {
              location: { reload },
              addEventListener: (type: string, fn: () => void) => {
                listeners[type] = fn;
              },
            },
          },
        },
      ],
    });
    return {
      adapter: TestBed.inject(APP_UPDATE),
      events,
      reload,
      checkForUpdate,
      listeners,
    };
  }

  const readyEvent = (): VersionEvent =>
    ({ type: 'VERSION_READY' } as unknown as VersionReadyEvent);

  it('sin service worker queda inerte aunque lleguen eventos', () => {
    const { adapter, events, reload, checkForUpdate } = setup(false);
    expect(adapter.ready()).toBe(false);
    events.next(readyEvent());
    expect(adapter.ready()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('comprueba actualizaciones al arrancar y al volver a la pestaña', () => {
    const { checkForUpdate, listeners } = setup(true);
    expect(checkForUpdate).toHaveBeenCalledTimes(1);
    expect(listeners['visibilitychange']).toBeTypeOf('function');
    listeners['visibilitychange']();
    expect(checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('solo VERSION_READY activa ready()', () => {
    const { adapter, events } = setup(true);
    expect(adapter.ready()).toBe(false);
    events.next({ type: 'VERSION_DETECTED' } as VersionEvent);
    expect(adapter.ready()).toBe(false);
    events.next(readyEvent());
    expect(adapter.ready()).toBe(true);
  });

  it('apply() recarga la página para arrancar la versión nueva', () => {
    const { adapter, reload } = setup(true);
    adapter.apply();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
