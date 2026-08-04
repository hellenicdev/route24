import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { RendererKind } from '../render/engineFactory';
import type { SceneHandle } from '../render/sceneFactory';
import { RenderPipeline } from '../render/pipeline';
import { resolveQualityId } from '../data/qualityPresets';
import { QUALITY_PRESETS } from '../data/qualityPresets';
import { GameLoop } from '../core/loop';
import type { SettingsManager } from '../core/settings';
import type { LoadingScreen } from '../ui/loading';
import type { Hud } from '../ui/hud';
import type { DrivableBus } from '../entities/drivableBus';
import type { InputManager } from '../core/input';

export interface GameDeps {
  engine: AbstractEngine;
  rendererKind: RendererKind;
  sceneHandle: SceneHandle;
  settings: SettingsManager;
  loading: LoadingScreen;
  hud: Hud;
  input: InputManager;
  bus: DrivableBus;
  onQualityChange: () => void;
}

/**
 * Ties the engine, scene, render pipeline, settings, vehicle and loop together.
 * Systems stay decoupled: physics, AI and networking plug into the same loop
 * without touching this class's shape.
 */
export class Game {
  private readonly pipeline: RenderPipeline;
  private readonly loop: GameLoop;
  private readonly followTarget = new Vector3();

  constructor(private readonly deps: GameDeps) {
    this.pipeline = new RenderPipeline({
      scene: deps.sceneHandle.scene,
      engine: deps.engine,
      camera: deps.sceneHandle.camera,
      sun: deps.sceneHandle.sun,
      sunMesh: deps.sceneHandle.sunMesh,
    });

    this.loop = new GameLoop(deps.engine, {
      render: (delta) => this.render(delta),
      simulate: (delta) => this.simulate(delta),
    });
  }

  get qualityLabel(): string {
    const preset = QUALITY_PRESETS[resolveQualityId(this.deps.settings.settings.quality)];
    return preset.label;
  }

  applySettings(): void {
    const preset = QUALITY_PRESETS[resolveQualityId(this.deps.settings.settings.quality)];
    this.pipeline.applyQuality(preset, this.deps.settings.settings.resolutionScale);
    this.deps.hud.setQuality(this.qualityLabel);
  }

  start(): void {
    this.applySettings();
    this.loop.start();
    this.deps.loading.hide();
  }

  private simulate(dt: number): void {
    const input = this.deps.input;
    const steer =
      (input.isDown('KeyA') || input.isDown('ArrowLeft') ? -1 : 0) +
      (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0);
    this.deps.bus.simulate(dt, {
      throttle: input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0,
      brake: input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0,
      steer: Math.max(-1, Math.min(1, steer)),
      reverse: input.isDown('KeyR'),
    });
  }

  private render(deltaSeconds: number): void {
    this.pipeline.update(deltaSeconds);
    this.followTarget.copyFrom(this.deps.bus.position).y += 2;
    this.deps.sceneHandle.camera.setTarget(this.followTarget);
    this.deps.sceneHandle.scene.render();
    this.deps.hud.frame(performance.now(), this.deps.bus.speedKph);
  }

  dispose(): void {
    this.loop.dispose();
    this.pipeline.dispose();
    this.deps.sceneHandle.scene.dispose();
  }
}
