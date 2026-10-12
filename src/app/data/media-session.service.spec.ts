import { TestBed } from '@angular/core/testing';
import { MEDIA_CONTROLS, DATA_PROVIDERS } from './di';
import { MediaControlsHandlers } from '../domain/ports/media-controls.port';
import { TRACKS } from '../domain/model/tracks';

/**
 * Spec del adaptador Media Session. jsdom no implementa
 * navigator.mediaSession: se stubbea para verificar el cableado —
 * handlers registrados, metadata sincronizada y degradación silenciosa
 * sin soporte.
 */

type MsStub = {
  metadata: unknown;
  playbackState: string;
  actionHandlers: Record<string, (() => void) | null>;
  positionState: unknown;
  setActionHandler: (action: string, fn: (() => void) | null) => void;
  setPositionState: (s: unknown) => void;
};

function installMediaSession(stub: MsStub | undefined): void {
  Object.defineProperty(navigator, 'mediaSession', {
    value: stub,
    configurable: true,
    writable: true,
  });
  // jsdom no tiene MediaMetadata: el adaptador la necesita para sync().
  const g = globalThis as { MediaMetadata?: unknown };
  if (stub) {
    class FakeMediaMetadata {
      constructor(init: Record<string, unknown>) {
        Object.assign(this, init);
      }
    }
    Object.defineProperty(g, 'MediaMetadata', {
      value: FakeMediaMetadata,
      configurable: true,
      writable: true,
    });
  } else {
    delete (g as { MediaMetadata?: unknown }).MediaMetadata;
  }
}

function makeStub(): MsStub {
  return {
    metadata: null,
    playbackState: '',
    actionHandlers: {},
    positionState: null,
    setActionHandler(action, fn) {
      this.actionHandlers[action] = fn;
    },
    setPositionState(s) {
      this.positionState = s;
    },
  };
}

describe('MediaSessionAdapter (adaptador del puerto)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: DATA_PROVIDERS });
  });

  afterEach(() => {
    installMediaSession(undefined);
  });

  it('sin navigator.mediaSession es no-op y reporta no-soporte', () => {
    installMediaSession(undefined);
    const media = TestBed.inject(MEDIA_CONTROLS);
    expect(media.supported).toBe(false);
    expect(() =>
      media.init({ onResume() {}, onPause() {}, onStop() {}, onPrevious() {}, onNext() {} }),
    ).not.toThrow();
    expect(() =>
      media.sync({ track: TRACKS[0], isPlaying: true, durationSec: 30, positionSec: 5 }),
    ).not.toThrow();
  });

  it('registra los 5 handlers del sistema', () => {
    const stub = makeStub();
    installMediaSession(stub);
    const media = TestBed.inject(MEDIA_CONTROLS);
    const calls: string[] = [];
    const h: MediaControlsHandlers = {
      onResume: () => calls.push('resume'),
      onPause: () => calls.push('pause'),
      onStop: () => calls.push('stop'),
      onPrevious: () => calls.push('prev'),
      onNext: () => calls.push('next'),
    };
    media.init(h);
    expect(stub.actionHandlers['play']).toBeTypeOf('function');
    stub.actionHandlers['play']!();
    stub.actionHandlers['pause']!();
    stub.actionHandlers['stop']!();
    stub.actionHandlers['previoustrack']!();
    stub.actionHandlers['nexttrack']!();
    expect(calls).toEqual(['resume', 'pause', 'stop', 'prev', 'next']);
  });

  it('sync publica metadata, estado de reproducción y posición', () => {
    const stub = makeStub();
    installMediaSession(stub);
    const media = TestBed.inject(MEDIA_CONTROLS);
    media.init({ onResume() {}, onPause() {}, onStop() {}, onPrevious() {}, onNext() {} });
    media.sync({
      track: TRACKS[0],
      isPlaying: true,
      durationSec: 1800,
      positionSec: 240,
    });
    const meta = stub.metadata as { title: string; artist: string };
    expect(meta.title).toBe(TRACKS[0].name);
    expect(meta.artist).toContain('Alpha');
    expect(stub.playbackState).toBe('playing');
    expect(stub.positionState).toEqual({
      duration: 1800,
      position: 240,
      playbackRate: 1,
    });
  });

  it('sin duración (loop ∞) no publica posición pero sí metadata', () => {
    const stub = makeStub();
    installMediaSession(stub);
    const media = TestBed.inject(MEDIA_CONTROLS);
    media.init({ onResume() {}, onPause() {}, onStop() {}, onPrevious() {}, onNext() {} });
    media.sync({
      track: TRACKS[2],
      isPlaying: false,
      durationSec: null,
      positionSec: 12,
    });
    expect(stub.playbackState).toBe('paused');
    expect(stub.positionState).toBeNull();
    expect(stub.metadata).toBeTruthy();
  });
});
