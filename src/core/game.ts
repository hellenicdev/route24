import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import type { RendererKind } from '../render/engineFactory';
import type { SceneHandle } from '../render/sceneFactory';
import { RenderPipeline } from '../render/pipeline';
import { resolveQualityId } from '../data/qualityPresets';
import { QUALITY_PRESETS } from '../data/qualityPresets';
import { GameLoop } from '../core/loop';
import type { SettingsManager } from '../core/settings';
import type { LoadingScreen } from '../ui/loading';
import type { Hud } from '../ui/hud';

export interface GameDeps {
  engine: AbstractEngine;
  rendererKind: RendererKind;
  sceneHandle: SceneHandle;
  settings: SettingsManager;
  loading: LoadingScreen;
  hud: Hud;
  onQualityChange: () => void;
}

/**
 * Ties the engine, scene, render pipeline, settings and loop together.
 * Systems stay decoupled: physics, AI and networking will plug into the same
 * loop with their own modules without touching this class's shape.
 */
export class Game {
  private readonly pipeline: RenderPipeline;
  private readonly loop: GameLoop;

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
      simulate: (_delta) => {
        /* physics plugs in here in M1 */
      },
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

  private render(deltaSeconds: number): void {
    this.pipeline.update(deltaSeconds);
    this.deps.sceneHandle.scene.render();
    this.deps.hud.frame(performance.now());
  }

  dispose(): void {
    this.loop.dispose();
    this.pipeline.dispose();
    this.deps.sceneHandle.scene.dispose();
  }
}
