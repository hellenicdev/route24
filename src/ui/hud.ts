import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import type { RendererKind } from '../render/engineFactory';

export interface HudElements {
  root: HTMLElement;
  fps: HTMLElement;
  ms: HTMLElement;
  speed: HTMLElement;
  speedValue: HTMLElement;
  speedNeedle: HTMLElement;
  renderer: HTMLElement;
  quality: HTMLElement;
}

const RENDERER_LABELS: Record<RendererKind, string> = {
  webgpu: 'WebGPU',
  webgl2: 'WebGL 2',
};

const SPEEDOMETER_MAX_KPH = 120;
const NEEDLE_MIN_DEG = -120;
const NEEDLE_MAX_DEG = 120;

/**
 * On-screen frame stats plus a mobile-sim style speedometer. The needle is
 * updated every frame via CSS transform (cheap); text writes are throttled so
 * the HUD can never become a rendering bottleneck by itself.
 */
export class Hud {
  private lastWrite = 0;
  private lastSpeedWrite = 0;

  constructor(
    private readonly elements: HudElements,
    private readonly engine: AbstractEngine,
  ) {
    elements.root.classList.remove('hidden');
  }

  setRenderer(kind: RendererKind): void {
    this.elements.renderer.textContent = RENDERER_LABELS[kind];
  }

  setQuality(label: string): void {
    this.elements.quality.textContent = label;
  }

  /** Call once per rendered frame; DOM writes are throttled internally. */
  frame(now: number, speedKph: number): void {
    const clamped = Math.max(0, Math.min(speedKph, SPEEDOMETER_MAX_KPH));
    const deg =
      NEEDLE_MIN_DEG + (clamped / SPEEDOMETER_MAX_KPH) * (NEEDLE_MAX_DEG - NEEDLE_MIN_DEG);
    this.elements.speedNeedle.style.transform = `rotate(${deg.toFixed(1)}deg)`;

    if (now - this.lastSpeedWrite < 100) return;
    this.lastSpeedWrite = now;
    this.elements.speedValue.textContent = String(Math.round(clamped));

    if (now - this.lastWrite < 500) return;
    this.lastWrite = now;
    const fps = Math.round(this.engine.getFps());
    const ms = this.engine.getDeltaTime().toFixed(1);
    this.elements.fps.textContent = `${fps} fps`;
    this.elements.ms.textContent = `${ms} ms`;
  }
}
