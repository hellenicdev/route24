import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Nullable } from '@babylonjs/core/types';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import type { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import { SSRRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssrRenderingPipeline';
import { TAARenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/taaRenderingPipeline';
import { MotionBlurPostProcess } from '@babylonjs/core/PostProcesses/motionBlurPostProcess';
import { ChromaticAberrationPostProcess } from '@babylonjs/core/PostProcesses/chromaticAberrationPostProcess';
import { VolumetricLightScatteringPostProcess } from '@babylonjs/core/PostProcesses/volumetricLightScatteringPostProcess';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { LensFlareSystem } from '@babylonjs/core/LensFlares/lensFlareSystem';
import { LensFlare } from '@babylonjs/core/LensFlares/lensFlare';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { QualityPreset } from '../data/qualityPresets';

export interface RenderPipelineDeps {
  scene: Scene;
  engine: AbstractEngine;
  camera: Camera;
  sun: DirectionalLight;
  /** Small bright mesh at the sun position, required by volumetric god rays. */
  sunMesh: Mesh;
}

/**
 * Owns every visual system that depends on the quality preset: cascade
 * shadows, tone mapping, adaptive exposure, fog and the post-effect stack
 * (FXAA/MSAA/TAA, bloom, SSAO, SSR, depth of field, glow, volumetric light).
 *
 * applyQuality() tears down and rebuilds the stack so the preset table and the
 * live settings panel share one code path. Each effect is guarded so that an
 * unsupported feature degrades with a warning instead of killing the scene.
 */
export class RenderPipeline {
  private defaultPipeline: Nullable<DefaultRenderingPipeline> = null;
  private ssao: Nullable<SSAO2RenderingPipeline> = null;
  private ssr: Nullable<SSRRenderingPipeline> = null;
  private taa: Nullable<TAARenderingPipeline> = null;
  private motionBlur: Nullable<MotionBlurPostProcess> = null;
  private chromaticAberration: Nullable<ChromaticAberrationPostProcess> = null;
  private volumetric: Nullable<VolumetricLightScatteringPostProcess> = null;
  private glow: Nullable<GlowLayer> = null;
  private lensFlare: Nullable<LensFlareSystem> = null;
  private csm: Nullable<CascadedShadowGenerator> = null;

  /** Smoothed exposure value applied to the image processing configuration. */
  private exposure = 1;

  constructor(private readonly deps: RenderPipelineDeps) {
    this.configureImageProcessing();
  }

  private get scene(): Scene {
    return this.deps.scene;
  }

  private get engine(): AbstractEngine {
    return this.deps.engine;
  }

  private configureImageProcessing(): void {
    const ipc = this.scene.imageProcessingConfiguration;
    ipc.toneMappingEnabled = true;
    ipc.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ipc.exposure = this.exposure;
    ipc.contrast = 1.05;
  }

  applyQuality(preset: QualityPreset, userResolutionScale = 1): void {
    this.teardown();
    this.applyShadows(preset);
    this.applyPostEffects(preset);
    this.applyGlow(preset);
    this.applyVolumetric(preset);
    this.applyColorGrading(preset);
    this.applyLensFlare(preset);
    this.applyFog(preset);
    this.applyResolutionScale(preset.resolutionScale * userResolutionScale);
  }

  private applyShadows(preset: QualityPreset): void {
    const { sun, scene, camera } = this.deps;
    if (!preset.shadowsEnabled) return;
    try {
      const csm = new CascadedShadowGenerator(preset.shadowMapSize, sun, true, camera);
      csm.numCascades = Math.max(
        1,
        Math.min(preset.cascadeCount, CascadedShadowGenerator.MAX_CASCADES_COUNT),
      );
      csm.lambda = 0.82;
      csm.stabilizeCascades = true;
      csm.cascadeBlendPercentage = 0.18;
      csm.setMinMaxDistance(0, 160);
      // CSM only supports FILTER_NONE / FILTER_PCF / FILTER_PCSS; poisson
      // would fall back to no filtering at all.
      csm.usePercentageCloserFiltering = preset.shadowPcf;

      // Meshes opt into casting shadows by setting metadata.castsShadow.
      for (const mesh of scene.meshes) {
        const castsShadow = (mesh.metadata as { castsShadow?: boolean } | undefined)?.castsShadow;
        if (castsShadow === true) csm.addShadowCaster(mesh);
      }
      this.csm = csm;
    } catch (error) {
      console.warn('[pipeline] cascade shadows unavailable:', error);
    }
  }

  private applyPostEffects(preset: QualityPreset): void {
    const { scene, camera } = this.deps;
    const manager = scene.postProcessRenderPipelineManager;

    const defaultPipeline = new DefaultRenderingPipeline('default', false, scene, [camera]);
    defaultPipeline.fxaaEnabled = preset.fxaaEnabled;
    defaultPipeline.bloomEnabled = preset.bloomEnabled;
    defaultPipeline.bloomWeight = preset.bloomWeight;
    defaultPipeline.bloomThreshold = preset.bloomThreshold;
    defaultPipeline.bloomScale = preset.bloomWeight >= 0.5 ? 0.75 : 0.5;
    defaultPipeline.sharpenEnabled = false;
    defaultPipeline.grainEnabled = false;
    defaultPipeline.depthOfFieldEnabled = preset.depthOfFieldEnabled;
    if (preset.depthOfFieldEnabled) {
      // DoF focus distance uses scene units * 1000 (millimeter convention);
      // the follow camera orbits ~22 m behind the bus.
      defaultPipeline.depthOfField.focusDistance = 22000;
      defaultPipeline.depthOfField.fStop = 2.2;
    }
    defaultPipeline.grainEnabled = preset.grainEnabled;
    defaultPipeline.grain.intensity = preset.grainIntensity;
    defaultPipeline.sharpenEnabled = preset.sharpenEnabled;
    defaultPipeline.sharpen.colorAmount = preset.sharpenAmount;
    const ipc = this.scene.imageProcessingConfiguration;
    ipc.vignetteEnabled = preset.vignetteEnabled;
    ipc.vignetteWeight = preset.vignetteWeight;
    manager.addPipeline(defaultPipeline);
    this.defaultPipeline = defaultPipeline;

    if (preset.msaaSamples > 1) {
      try {
        defaultPipeline.samples = preset.msaaSamples;
      } catch (error) {
        console.warn('[pipeline] MSAA unavailable, using 1x:', error);
      }
    }

    if (preset.ssaoEnabled) {
      try {
        const ssao = new SSAO2RenderingPipeline('ssao', scene, 0.6, [camera], true);
        ssao.totalStrength = preset.ssaoTotalStrength;
        ssao.radius = preset.ssaoRadius;
        ssao.samples = preset.id === 'ultra' ? 16 : 8;
        ssao.expensiveBlur = preset.id === 'ultra';
        manager.addPipeline(ssao);
        this.ssao = ssao;
      } catch (error) {
        console.warn('[pipeline] SSAO unavailable:', error);
      }
    }

    if (preset.tsaaEnabled) {
      try {
        const taa = new TAARenderingPipeline('taa', scene, [camera]);
        manager.addPipeline(taa);
        this.taa = taa;
      } catch (error) {
        console.warn('[pipeline] TAA unavailable:', error);
      }
    }

    if (preset.motionBlurEnabled) {
      try {
        const motionBlur = new MotionBlurPostProcess('motionBlur', this.scene, 1, camera);
        motionBlur.motionBlurSamples = preset.id === 'ultra' ? 16 : 8;
        motionBlur.motionStrength = preset.motionBlurStrength;
        this.motionBlur = motionBlur;
      } catch (error) {
        console.warn('[pipeline] motion blur unavailable:', error);
      }
    }

    if (preset.chromaticAberrationEnabled) {
      try {
        const chromatic = new ChromaticAberrationPostProcess(
          'chromaticAberration',
          this.engine.getRenderWidth(),
          this.engine.getRenderHeight(),
          1,
          camera,
        );
        chromatic.aberrationAmount = preset.chromaticAberrationAmount;
        chromatic.radialIntensity = 1;
        this.chromaticAberration = chromatic;
      } catch (error) {
        console.warn('[pipeline] chromatic aberration unavailable:', error);
      }
    }

    if (preset.ssrEnabled) {
      try {
        const ssr = new SSRRenderingPipeline('ssr', scene, [camera], true);
        manager.addPipeline(ssr);
        this.ssr = ssr;
      } catch (error) {
        console.warn('[pipeline] SSR unavailable:', error);
      }
    }
  }

  private applyGlow(preset: QualityPreset): void {
    if (!preset.glowEnabled) return;
    try {
      const glow = new GlowLayer('glow', this.scene, {
        mainTextureSamples: 2,
        blurKernelSize: 64,
      });
      glow.intensity = preset.glowIntensity;
      this.glow = glow;
    } catch (error) {
      console.warn('[pipeline] glow layer unavailable:', error);
    }
  }

  private applyVolumetric(preset: QualityPreset): void {
    if (!preset.volumetricEnabled) return;
    try {
      const { camera, sunMesh, engine, scene } = this.deps;
      const volumetric = new VolumetricLightScatteringPostProcess(
        'volumetric',
        0.8,
        camera,
        sunMesh,
        32,
        Texture.BILINEAR_SAMPLINGMODE,
        engine,
        false,
        scene,
      );
      volumetric.exposure = 0.35;
      volumetric.decay = 0.9;
      volumetric.density = 0.15;
      volumetric.weight = 0.3;
      this.volumetric = volumetric;
    } catch (error) {
      console.warn('[pipeline] volumetric light scattering unavailable:', error);
    }
  }

  /** Film-grade color curves (warm highlights, lifted shadows). */
  private applyColorGrading(preset: QualityPreset): void {
    const ipc = this.scene.imageProcessingConfiguration;
    ipc.colorCurvesEnabled = preset.colorGradingEnabled;
    if (!preset.colorGradingEnabled) return;
    const curves = ipc.colorCurves;
    if (!curves) return;
    curves.globalSaturation = 8;
    curves.globalExposure = 2;
    curves.shadowsExposure = 5;
    curves.highlightsExposure = -5;
  }

  /** Anamorphic-style lens flares from the sun mesh. */
  private applyLensFlare(preset: QualityPreset): void {
    if (!preset.lensFlareEnabled) return;
    try {
      const { scene, sunMesh } = this.deps;
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      let textureUrl = '';
      if (ctx) {
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.35, 'rgba(255,255,255,0.85)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        textureUrl = canvas.toDataURL('image/png');
      }

      const flare = new LensFlareSystem('lensFlare', sunMesh, scene);
      LensFlare.AddFlare(0.35, 0, new Color3(1, 0.95, 0.85), textureUrl, flare);
      LensFlare.AddFlare(0.1, 0.55, new Color3(0.95, 0.7, 0.5), textureUrl, flare);
      LensFlare.AddFlare(0.07, -0.7, new Color3(0.65, 0.8, 1), textureUrl, flare);
      this.lensFlare = flare;
    } catch (error) {
      console.warn('[pipeline] lens flare unavailable:', error);
    }
  }

  private applyFog(preset: QualityPreset): void {
    const scene = this.scene;
    if (!preset.fogEnabled) {
      scene.fogMode = Scene.FOGMODE_NONE;
      return;
    }
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = preset.fogDensity;
    scene.fogColor = new Color3(0.82, 0.85, 0.9);
  }

  private applyResolutionScale(effectiveScale: number): void {
    const clamped = Scalar.Clamp(effectiveScale, 0.5, 2);
    this.engine.setHardwareScalingLevel(1 / clamped);
  }

  /** Adaptive exposure: eases toward a target derived from sun elevation. */
  update(deltaSeconds: number): void {
    const elevation = this.deps.sun.direction.y;
    // High sun → brighter scene → lower exposure; low sun → darker → higher.
    const target = Scalar.Clamp(1.5 - elevation * 0.85, 0.55, 1.6);
    this.exposure = Scalar.Lerp(this.exposure, target, 1 - Math.exp(-deltaSeconds * 1.6));
    this.scene.imageProcessingConfiguration.exposure = this.exposure;
  }

  teardown(): void {
    const manager = this.scene.postProcessRenderPipelineManager;
    for (const pipeline of [...manager.supportedPipelines]) {
      manager.removePipeline(pipeline.name);
    }
    this.defaultPipeline?.dispose();
    this.ssao?.dispose();
    this.ssr?.dispose();
    this.taa?.dispose();
    this.motionBlur?.dispose();
    this.chromaticAberration?.dispose();
    this.volumetric?.dispose(this.deps.camera);
    this.glow?.dispose();
    this.lensFlare?.dispose();
    this.csm?.dispose();
    const ipc = this.scene.imageProcessingConfiguration;
    ipc.vignetteEnabled = false;
    ipc.colorCurvesEnabled = false;
    this.defaultPipeline = null;
    this.ssao = null;
    this.ssr = null;
    this.taa = null;
    this.motionBlur = null;
    this.chromaticAberration = null;
    this.volumetric = null;
    this.glow = null;
    this.lensFlare = null;
    this.csm = null;
  }

  dispose(): void {
    this.teardown();
  }
}
