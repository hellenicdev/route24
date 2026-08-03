import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';

export interface LoopOptions {
  /** Fixed simulation rate in Hz (physics will run here in M1). */
  simulationRate: number;
  /** Clamp a single frame delta to this many seconds to avoid spiral-of-death. */
  maxDeltaSeconds: number;
}

export interface LoopCallbacks {
  /** Runs once per rendered frame with the frame delta in seconds. */
  render(deltaSeconds: number): void;
  /** Runs at the fixed simulation rate, `simulationRate` times per second. */
  simulate?(deltaSeconds: number): void;
}

/**
 * Fixed-timestep game loop built on top of Babylon's render loop.
 * Simulation is decoupled from rendering: the render callback gets the real
 * frame delta, the simulation callback runs at a constant rate with an
 * accumulator so physics behaves identically across refresh rates.
 */
export class GameLoop {
  private readonly simulationStep: number;
  private accumulator = 0;
  private running = false;
  private disposed = false;
  private readonly renderFunction = (): void => {
    this.tick();
  };

  constructor(
    private readonly engine: AbstractEngine,
    private readonly callbacks: LoopCallbacks,
    private readonly options: LoopOptions = { simulationRate: 60, maxDeltaSeconds: 0.25 },
  ) {
    this.simulationStep = 1 / options.simulationRate;
  }

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.engine.runRenderLoop(this.renderFunction);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.engine.stopRenderLoop(this.renderFunction);
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
  }

  private tick(): void {
    const delta = Math.min(this.engine.getDeltaTime() / 1000, this.options.maxDeltaSeconds);
    this.callbacks.render(delta);

    if (this.callbacks.simulate) {
      this.accumulator += delta;
      while (this.accumulator >= this.simulationStep) {
        this.callbacks.simulate(this.simulationStep);
        this.accumulator -= this.simulationStep;
      }
    }
  }
}
