import { Scene } from '@babylonjs/core/scene';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import type { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { BoxParticleEmitter } from '@babylonjs/core/Particles/EmitterTypes/boxParticleEmitter';
import type { SkyMaterial } from '@babylonjs/materials/sky/skyMaterial';
import type { WeatherId } from '../data/weatherConfig';
import { getWeatherPreset } from '../data/weatherConfig';

export interface WeatherDeps {
  scene: Scene;
  camera: Camera;
  sun: DirectionalLight;
  hemi: HemisphericLight;
  sky: SkyMaterial;
  ground: Mesh;
}

/**
 * Owns the atmosphere: sky tint, sun/hemisphere intensity, fog and weather
 * particle systems (rain streaks, snowfall), plus wet-road material changes.
 * apply() is idempotent and is called on settings changes, so presets and the
 * live UI share one code path.
 */
export class WeatherManager {
  private particles: ParticleSystem | null = null;
  private readonly emitter: Mesh;
  private current: WeatherId | null = null;

  constructor(private readonly deps: WeatherDeps) {
    this.emitter = MeshBuilder.CreateBox('weather-emitter', { size: 0.1 }, deps.scene);
    this.emitter.isVisible = false;
    this.emitter.isPickable = false;
    this.emitter.parent = deps.camera;
  }

  apply(id: WeatherId): void {
    if (id === this.current) return;
    this.current = id;
    const preset = getWeatherPreset(id);
    const { scene, sun, hemi, sky, ground } = this.deps;
    const material = ground.material as PBRMaterial;

    sky.turbidity = preset.skyTurbidity;
    sky.luminance = preset.skyLuminance;
    sky.mieCoefficient = preset.mieCoefficient;
    scene.clearColor = new Color4(preset.fogColor[0], preset.fogColor[1], preset.fogColor[2], 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = preset.fogDensity;
    scene.fogColor = Color3.FromArray(preset.fogColor);
    scene.ambientColor = Color3.FromArray(preset.ambient);

    sun.intensity = preset.sunIntensity;
    hemi.intensity = preset.hemisphereIntensity;
    hemi.groundColor = Color3.FromArray(preset.fogColor).scale(0.6);

    material.albedoColor = Color3.FromArray(preset.roadAlbedo);
    material.roughness = preset.roadRoughness;
    material.metallic = preset.roadMetallic;

    this.disposeParticles();
    if (preset.particles > 0) {
      this.particles = this.createParticles(preset);
      this.particles.start();
    }
  }

  private createParticles(preset: ReturnType<typeof getWeatherPreset>): ParticleSystem {
    const ps = new ParticleSystem('weather-particles', preset.particles, this.deps.scene);
    const emitter = new BoxParticleEmitter();
    emitter.minEmitBox = new Vector3(-45, 8, -45);
    emitter.maxEmitBox = new Vector3(45, 34, 45);
    ps.particleEmitterType = emitter;
    ps.emitter = this.emitter;

    const wind = preset.wind;
    ps.direction1 = new Vector3(wind * 0.2, -1, 0.15);
    ps.direction2 = new Vector3(wind * 0.6, -1, 0.45);
    ps.minEmitPower = preset.particleSpeed[0];
    ps.maxEmitPower = preset.particleSpeed[1];
    ps.minLifeTime = preset.particleLife[0];
    ps.maxLifeTime = preset.particleLife[1];
    ps.minSize = preset.particleSize[0];
    ps.maxSize = preset.particleSize[1];
    ps.color1 = Color4.FromArray([...preset.particleColor, 1]);
    ps.color2 = Color4.FromArray([...preset.particleAccent, 1]);
    ps.colorDead = Color4.FromArray([...preset.particleAccent, 0]);
    ps.emitRate = Math.round(preset.particles / 1.5);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    ps.gravity = new Vector3(wind * 0.4, -14, 0);
    ps.minAngularSpeed = 0;
    ps.maxAngularSpeed = 0;
    return ps;
  }

  private disposeParticles(): void {
    this.particles?.dispose();
    this.particles = null;
  }

  dispose(): void {
    this.disposeParticles();
    this.emitter.dispose();
  }
}
