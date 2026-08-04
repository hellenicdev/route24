import type { QualityId } from '../core/settings';

export interface QualityPreset {
  /** Concrete preset id (never 'auto'). */
  id: Exclude<QualityId, 'auto'>;
  label: string;
  /** Per-preset resolution scale multiplier (supersampling when > 1). */
  resolutionScale: number;
  // Shadows
  shadowsEnabled: boolean;
  shadowMapSize: number;
  cascadeCount: number;
  shadowPcf: boolean;
  // Post-process / AO
  ssaoEnabled: boolean;
  ssaoRadius: number;
  ssaoTotalStrength: number;
  bloomEnabled: boolean;
  bloomWeight: number;
  bloomThreshold: number;
  fxaaEnabled: boolean;
  tsaaEnabled: boolean;
  msaaSamples: number;
  depthOfFieldEnabled: boolean;
  ssrEnabled: boolean;
  volumetricEnabled: boolean;
  glowEnabled: boolean;
  glowIntensity: number;
  // Post-process polish
  vignetteEnabled: boolean;
  vignetteWeight: number;
  grainEnabled: boolean;
  grainIntensity: number;
  sharpenEnabled: boolean;
  sharpenAmount: number;
  motionBlurEnabled: boolean;
  motionBlurStrength: number;
  chromaticAberrationEnabled: boolean;
  chromaticAberrationAmount: number;
  colorGradingEnabled: boolean;
  lensFlareEnabled: boolean;
  // Environment
  fogEnabled: boolean;
  fogDensity: number;
  reflectionProbe: boolean;
}

export const QUALITY_PRESETS: Record<Exclude<QualityId, 'auto'>, QualityPreset> = {
  low: {
    id: 'low',
    label: 'Low',
    resolutionScale: 0.75,
    shadowsEnabled: false,
    shadowMapSize: 0,
    cascadeCount: 0,
    shadowPcf: false,
    ssaoEnabled: false,
    ssaoRadius: 1,
    ssaoTotalStrength: 0.8,
    bloomEnabled: false,
    bloomWeight: 0.5,
    bloomThreshold: 0.7,
    fxaaEnabled: true,
    tsaaEnabled: false,
    msaaSamples: 1,
    depthOfFieldEnabled: false,
    ssrEnabled: false,
    volumetricEnabled: false,
    glowEnabled: false,
    glowIntensity: 0.5,
    vignetteEnabled: false,
    vignetteWeight: 1.2,
    grainEnabled: false,
    grainIntensity: 0.1,
    sharpenEnabled: false,
    sharpenAmount: 0.3,
    motionBlurEnabled: false,
    motionBlurStrength: 0.6,
    chromaticAberrationEnabled: false,
    chromaticAberrationAmount: 0.25,
    colorGradingEnabled: false,
    lensFlareEnabled: false,
    fogEnabled: true,
    fogDensity: 0.0035,
    reflectionProbe: false,
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    resolutionScale: 1,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    cascadeCount: 2,
    shadowPcf: true,
    ssaoEnabled: true,
    ssaoRadius: 0.8,
    ssaoTotalStrength: 0.7,
    bloomEnabled: true,
    bloomWeight: 0.35,
    bloomThreshold: 0.75,
    fxaaEnabled: true,
    tsaaEnabled: false,
    msaaSamples: 1,
    depthOfFieldEnabled: false,
    ssrEnabled: false,
    volumetricEnabled: false,
    glowEnabled: false,
    glowIntensity: 0.5,
    vignetteEnabled: true,
    vignetteWeight: 1.2,
    grainEnabled: false,
    grainIntensity: 0.12,
    sharpenEnabled: false,
    sharpenAmount: 0.35,
    motionBlurEnabled: false,
    motionBlurStrength: 0.6,
    chromaticAberrationEnabled: false,
    chromaticAberrationAmount: 0.25,
    colorGradingEnabled: false,
    lensFlareEnabled: false,
    fogEnabled: true,
    fogDensity: 0.0028,
    reflectionProbe: true,
  },
  high: {
    id: 'high',
    label: 'High',
    resolutionScale: 1,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    cascadeCount: 3,
    shadowPcf: true,
    ssaoEnabled: true,
    ssaoRadius: 0.55,
    ssaoTotalStrength: 0.85,
    bloomEnabled: true,
    bloomWeight: 0.5,
    bloomThreshold: 0.65,
    fxaaEnabled: true,
    tsaaEnabled: false,
    msaaSamples: 4,
    depthOfFieldEnabled: false,
    ssrEnabled: false,
    volumetricEnabled: true,
    glowEnabled: true,
    glowIntensity: 0.35,
    vignetteEnabled: true,
    vignetteWeight: 1.6,
    grainEnabled: true,
    grainIntensity: 0.14,
    sharpenEnabled: true,
    sharpenAmount: 0.4,
    motionBlurEnabled: true,
    motionBlurStrength: 0.55,
    chromaticAberrationEnabled: false,
    chromaticAberrationAmount: 0.25,
    colorGradingEnabled: true,
    lensFlareEnabled: true,
    fogEnabled: true,
    fogDensity: 0.0025,
    reflectionProbe: true,
  },
  ultra: {
    id: 'ultra',
    label: 'Ultra',
    resolutionScale: 1.15,
    shadowsEnabled: true,
    shadowMapSize: 4096,
    cascadeCount: 4,
    shadowPcf: true,
    ssaoEnabled: true,
    ssaoRadius: 0.45,
    ssaoTotalStrength: 0.9,
    bloomEnabled: true,
    bloomWeight: 0.6,
    bloomThreshold: 0.6,
    fxaaEnabled: false,
    tsaaEnabled: true,
    msaaSamples: 4,
    depthOfFieldEnabled: false,
    ssrEnabled: true,
    volumetricEnabled: true,
    glowEnabled: true,
    glowIntensity: 0.6,
    vignetteEnabled: true,
    vignetteWeight: 2,
    grainEnabled: true,
    grainIntensity: 0.2,
    sharpenEnabled: true,
    sharpenAmount: 0.5,
    motionBlurEnabled: true,
    motionBlurStrength: 0.75,
    chromaticAberrationEnabled: true,
    chromaticAberrationAmount: 0.25,
    colorGradingEnabled: true,
    lensFlareEnabled: true,
    fogEnabled: true,
    fogDensity: 0.002,
    reflectionProbe: true,
  },
};

export const PRESET_ORDER: readonly Exclude<QualityId, 'auto'>[] = [
  'ultra',
  'high',
  'medium',
  'low',
];

/**
 * Estimates a sensible preset from the device. Scoring is deliberately simple
 * and conservative — quality never claims a tier above what is sustainable.
 * Returns a concrete quality id so it can be resolved once and cached.
 */
export function autoDetectQuality(): Exclude<QualityId, 'auto'> {
  let score = 0;

  const memory = (navigator as { deviceMemory?: number }).deviceMemory;
  if (typeof memory === 'number' && Number.isFinite(memory)) {
    if (memory >= 8) score += 2;
    else if (memory >= 4) score += 1;
  } else {
    score += 1; // unknown memory → assume "decent"
  }

  if (typeof navigator.hardwareConcurrency === 'number') {
    if (navigator.hardwareConcurrency >= 8) score += 2;
    else if (navigator.hardwareConcurrency >= 4) score += 1;
  }

  // Weak GPUs rarely expose WebGPU; its absence caps us at Medium.
  const webgpu =
    typeof navigator.gpu !== 'undefined' && typeof navigator.gpu.requestAdapter === 'function';

  if (webgpu && score >= 4) return 'ultra';
  if (webgpu && score >= 3) return 'high';
  if (score >= 3) return 'medium';
  if (score >= 2) return 'medium';
  return 'low';
}

export function resolveQualityId(quality: QualityId): Exclude<QualityId, 'auto'> {
  return quality === 'auto' ? autoDetectQuality() : quality;
}
