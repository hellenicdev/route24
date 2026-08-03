import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import type { RendererKind } from '../render/engineFactory';

export interface HudElements {
  root: HTMLElement;
  fps: HTMLElement;
  ms: HTMLElement;
  renderer: HTMLElement;
  quality: HTMLElement;
}

const RENDERER_LABELS: Record<RendererKind, string> = {
  webgpu: 'WebGPU',
  webgl2: 'WebGL 2',
};

/**
 * Minimal on-screen frame stats. DOM writes are throttled to ~2 Hz so the
 * stats loop can never become a rendering bottleneck by itself.
 */
export class Hud {
  private lastWrite = 0;

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
  frame(now: number): void {
    if (now - this.lastWrite < 500) return;
    this.lastWrite = now;
    const fps = Math.round(this.engine.getFps());
    const ms = this.engine.getDeltaTime().toFixed(1);
    this.elements.fps.textContent = `${fps} fps`;
    this.elements.ms.textContent = `${ms} ms`;
  }
}
