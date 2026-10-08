import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { BinauralEngine } from '../binaural-engine.service';

const BARS = 56;

@Component({
  imports: [],
  selector: 'app-visualizer',
  styleUrl: './visualizer.css',
  templateUrl: './visualizer.html',
})
export class Visualizer implements AfterViewInit, OnDestroy {
  private readonly engine = inject(BinauralEngine);
  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('bars');

  private raf = 0;
  private data = new Uint8Array(1024);
  private peaks = new Float32Array(BARS);
  private t = 0;
  private lastFrame = 0;
  /** Tamaño cacheado: ResizeObserver lo mantiene al día para que el draw
   *  nunca lea layout (clientWidth) — leerlo cada frame tras cambios de DOM
   *  (el reloj actualiza texto cada 500 ms) forzaba reflows. */
  private readonly size = { w: 0, h: 0 };
  private ro: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas && typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (!rect) return;
        this.size.w = Math.floor(rect.width);
        this.size.h = Math.floor(rect.height);
      });
      this.ro.observe(canvas);
    }
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      // 30 fps: con smoothing 0.82 el decaimiento disimula el salto.
      // Además el canvas vive oculto en móvil (display:none) y así no
      // quemamos frames ahí.
      if (t - this.lastFrame < 1000 / 30) return;
      this.lastFrame = t;
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.ro = null;
  }

  private draw(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    // Tamaño cacheado por el ResizeObserver: cero lecturas de layout aquí.
    const w = this.size.w;
    const h = this.size.h;
    if (w === 0 || h === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const live = this.engine.getSpectrum(this.data);
    this.t += 0.06;

    // Nº de barras según el ancho: en la mini-barra del player caben menos.
    const gap = 3;
    const bars = Math.max(12, Math.min(BARS, Math.floor(w / 5)));
    const bw = (w - gap * (bars - 1)) / bars;
    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, '#4d5dff');
    grad.addColorStop(0.6, '#00d4b8');
    grad.addColorStop(1, '#8cffe3');
    ctx.fillStyle = grad;

    for (let i = 0; i < bars; i++) {
      let v: number;
      if (live) {
        // Muestreo logarítmico: detalle en graves (aquí vive el drone).
        const bin = Math.min(
          1023,
          Math.floor(Math.pow(i / bars, 1.6) * 320) + 1,
        );
        v = this.data[bin] / 255;
      } else {
        // Respiración en reposo para que se vea vivo sin audio.
        v = 0.06 + 0.05 * (0.5 + 0.5 * Math.sin(this.t + i * 0.35));
      }
      const bh = Math.max(2, v * h);
      const x = i * (bw + gap);
      const y = h - bh;
      ctx.beginPath();
      ctx.roundRect(x, y, bw, bh, Math.max(0, Math.min(bw / 2, bh)));
      ctx.fill();

      // Pico que cae despacio.
      this.peaks[i] = Math.max(this.peaks[i] - 0.008, v);
      const py = h - Math.max(2, this.peaks[i] * h) - 2;
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(x, py, bw, 2);
      ctx.fillStyle = grad;
    }
  }
}
