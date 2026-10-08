import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { BinauralEngine } from './binaural-engine.service';
import { MIN_SESSION_SECONDS, TRACKS } from './tracks';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
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
    expect(compiled.querySelectorAll('.playlist .track').length).toBe(3);
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
    const engine = TestBed.inject(BinauralEngine);
    expect(engine.playback()).toBe('idle');
    expect(engine.activeTrackId()).toBeNull();
  });
});

describe('Tracks', () => {
  it('defines the 3 researched sessions', () => {
    expect(TRACKS.map((t) => t.beatHz)).toEqual([10, 6, 40]);
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
