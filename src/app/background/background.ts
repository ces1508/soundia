import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { BinauralEngine } from '../binaural-engine.service';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

/** Tinte del ambiente según la pista activa. */
const HUES: Record<string, number> = {
  focus: 232,
  meditation: 168,
  deep: 315,
};

/**
 * Presupuesto de rendimiento del ambiente (decorativo, nunca es la tarea
 * del usuario): 30 fps alcanzan de sobra para un drift lento, y el DPR se
 * topa a 1.5 — las partículas son círculos translúcidos y difusos, la
 * resolución extra de un DPR 3 no se percibe pero multiplica x4 el fill
 * rate de la GPU. `prefers-reduced-motion` congela la escena en un frame.
 */
const DPR_CAP = 1.5;
const FRAME_BUDGET_MS = 1000 / 30;

@Component({
  imports: [],
  selector: 'app-background',
  styleUrl: './background.css',
  templateUrl: './background.html',
})
export class Background implements AfterViewInit, OnDestroy {
  private readonly engine = inject(BinauralEngine);
  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('scene');

  private raf = 0;
  private particles: Particle[] = [];
  private hue = 232;
  private dpr = 1;
  private lastFrame = 0;
  private reducedMotion = false;
  private onResize = () => this.resize();

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    this.reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    this.resize();
    window.addEventListener('resize', this.onResize, { passive: true });
    if (this.reducedMotion) {
      this.tick(); // un solo frame estático, sin loop
      return;
    }
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      // Saltamos frames: el ambiente no necesita 60 Hz.
      if (t - this.lastFrame < FRAME_BUDGET_MS) return;
      this.lastFrame = t;
      this.tick();
    };
    this.raf = requestAnimationFrame(loop);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
    }
  }

  private resize(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    canvas.width = Math.floor(window.innerWidth * this.dpr);
    canvas.height = Math.floor(window.innerHeight * this.dpr);
    const count = Math.min(
      90,
      Math.floor((window.innerWidth * window.innerHeight) / 16000),
    );
    this.particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25 * this.dpr,
      vy: (Math.random() - 0.5) * 0.25 * this.dpr,
      r: (Math.random() * 1.6 + 0.6) * this.dpr,
    }));
    if (this.reducedMotion) this.tick();
  }

  private tick(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // El tinte persigue suavemente el color de la pista activa.
    const target = HUES[this.engine.activeTrackId() ?? ''] ?? 232;
    this.hue += (target - this.hue) * 0.03;

    const playing = this.engine.playback() === 'playing';
    const speed = playing ? 1.8 : 0.7;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pts = this.particles;

    for (const p of pts) {
      p.x += p.vx * speed;
      p.y += p.vy * speed;
      if (p.x < 0) p.x += canvas.width;
      if (p.x > canvas.width) p.x -= canvas.width;
      if (p.y < 0) p.y += canvas.height;
      if (p.y > canvas.height) p.y -= canvas.height;
    }

    // Enlaces entre partículas agrupados en 5 baldes de opacidad:
    // 5 strokes por frame en lugar de uno por par (en desktop hay miles
    // de pares y cada stroke con su string de color era lo caro).
    const link = 130 * this.dpr;
    const buckets: number[][] = [[], [], [], [], []];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < link) {
          const bin = Math.min(4, ((1 - d / link) * 5) | 0);
          buckets[bin].push(pts[i].x, pts[i].y, pts[j].x, pts[j].y);
        }
      }
    }
    ctx.lineWidth = this.dpr;
    for (let b = 0; b < buckets.length; b++) {
      const segs = buckets[b];
      if (segs.length === 0) continue;
      ctx.strokeStyle = `hsla(${this.hue | 0}, 90%, 70%, ${((b + 1) / 5) * 0.16})`;
      ctx.beginPath();
      for (let k = 0; k < segs.length; k += 4) {
        ctx.moveTo(segs[k], segs[k + 1]);
        ctx.lineTo(segs[k + 2], segs[k + 3]);
      }
      ctx.stroke();
    }

    ctx.fillStyle = `hsla(${this.hue | 0}, 95%, 75%, 0.55)`;
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
