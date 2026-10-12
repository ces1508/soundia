import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AUDIO_SYNTH, DATA_PROVIDERS } from '../data/di';
import { MIN_SESSION_SECONDS } from '../domain/model/session';
import { TRACKS, TRACKS_BY_ID, getTrackById } from '../domain/model/tracks';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App], providers: [DATA_PROVIDERS],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the playlist with one row per track', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.playlist .track').length).toBe(4);
    expect(compiled.querySelector('h1')?.textContent).toContain('Sintoniza');
  });

  it('should offer session durations with 30 min selected by default', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('.goals button');
    expect(buttons.length).toBe(6);
    expect(
      compiled.querySelector('.goals button.on')?.textContent,
    ).toContain('30 min');
  });
  it('should render background and start with player hidden', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-background')).toBeTruthy();
    expect(compiled.querySelector('.player')).toBeNull();
  });

  it('should start idle without touching Web Audio', () => {
    const engine = TestBed.inject(AUDIO_SYNTH);
    expect(engine.playback()).toBe('idle');
    expect(engine.activeTrackId()).toBeNull();
  });
});

describe('Tracks', () => {
  it('defines the 4 researched sessions', () => {
    expect(TRACKS.map((t) => t.beatHz)).toEqual([10, 9, 6, 40]);
  });

  it('expone un índice O(1) coherente con el catálogo', () => {
    expect(TRACKS_BY_ID.size).toBe(TRACKS.length);
    for (const t of TRACKS) {
      expect(TRACKS_BY_ID.get(t.id)).toBe(t);
      expect(getTrackById(t.id)).toBe(t);
    }
    expect(getTrackById('no-existe')).toBeUndefined();
  });

  it('cada pista alpha cubre un borde distinto de la banda 8-12 Hz', () => {
    const alphas = TRACKS.filter((t) => t.band.includes('Alpha'));
    expect(alphas.map((a) => a.beatHz)).toEqual([10, 9]); // alta alerta / baja calma
    for (const a of alphas) {
      expect(a.beatHz).toBeGreaterThanOrEqual(8);
      expect(a.beatHz).toBeLessThanOrEqual(12);
    }
  });

  it('keeps left/right tones symmetric around the carrier', () => {
    for (const t of TRACKS) {
      expect(t.rightHz - t.leftHz).toBeCloseTo(t.beatHz, 10);
      expect((t.leftHz + t.rightHz) / 2).toBeCloseTo(t.carrierHz, 10);
    }
  });

  it('suggests a 30 minute minimum session', () => {
    expect(MIN_SESSION_SECONDS).toBe(30 * 60);
  });
});
