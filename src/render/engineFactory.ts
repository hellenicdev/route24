import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import type { RendererPreference } from '../core/settings';

// Babylon v9 registers engine prototype methods (dynamic/render-target textures,
// cube/raw textures, etc.) via opt-in "Register" side effects. Without these
// calls, tree-shaken builds crash at runtime (e.g. createDynamicTexture missing).
import { RegisterFullEngineExtensions } from '@babylonjs/core/Engines/engineRegistration.pure';
import { RegisterFullWebGPUEngineExtensions } from '@babylonjs/core/Engines/WebGPU/webgpuEngineRegistration.pure';

RegisterFullEngineExtensions();
RegisterFullWebGPUEngineExtensions();

export type RendererKind = 'webgpu' | 'webgl2';

export interface EngineHandle {
  engine: AbstractEngine;
  kind: RendererKind;
}

const WEBGPU_OPTIONS = {
  antialias: true,
  stencil: true,
  powerPreference: 'high-performance',
} as const;

const WEBGL_OPTIONS = {
  antialias: true,
  stencil: true,
  powerPreference: 'high-performance',
  failIfMajorPerformanceCaveat: false,
  loseContextOnDispose: true,
} as const;

async function createWebGPUEngine(canvas: HTMLCanvasElement): Promise<EngineHandle> {
  const supported = await WebGPUEngine.IsSupportedAsync;
  if (!supported) {
    throw new Error('WebGPU is not supported by this browser/device.');
  }
  const engine = await WebGPUEngine.CreateAsync(canvas, { ...WEBGPU_OPTIONS });
  return { engine, kind: 'webgpu' };
}

function createWebGL2Engine(canvas: HTMLCanvasElement): EngineHandle {
  const engine = new Engine(canvas, true, { ...WEBGL_OPTIONS });
  if (engine.getRenderWidth() === 0) {
    engine.dispose();
    throw new Error('WebGL2 context creation failed.');
  }
  return { engine, kind: 'webgl2' };
}

/**
 * Creates the best available engine for the preference, with graceful
 * fallback: WebGPU → WebGL2. Throws only when no renderer can be created.
 */
export async function createEngine(
  canvas: HTMLCanvasElement,
  preference: RendererPreference,
): Promise<EngineHandle> {
  const candidates: readonly (() => Promise<EngineHandle>)[] =
    preference === 'auto'
      ? [() => createWebGPUEngine(canvas), () => Promise.resolve(createWebGL2Engine(canvas))]
      : preference === 'webgpu'
        ? [() => createWebGPUEngine(canvas)]
        : [() => Promise.resolve(createWebGL2Engine(canvas))];

  let lastError: unknown;
  for (const create of candidates) {
    try {
      return await create();
    } catch (error) {
      lastError = error;
      console.warn('[engine] renderer creation failed, trying next:', error);
    }
  }
  throw new Error(`No usable renderer found (preference "${preference}"): ${String(lastError)}`);
}
