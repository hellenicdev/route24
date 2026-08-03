import { describe, expect, it } from 'vitest';
import {
  QUALITY_PRESETS,
  PRESET_ORDER,
  autoDetectQuality,
  resolveQualityId,
} from '../data/qualityPresets';

describe('quality presets', () => {
  it('defines every tier exactly once', () => {
    const ids = Object.values(QUALITY_PRESETS).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(['high', 'low', 'medium', 'ultra'].sort());
  });

  it('scales monotonically from low to ultra', () => {
    const order = [...PRESET_ORDER].reverse(); // low → ultra
    const numeric = (
      p: (typeof QUALITY_PRESETS)['ultra'],
      key: 'resolutionScale' | 'shadowMapSize' | 'cascadeCount' | 'msaaSamples',
    ) => p[key];
    for (const key of [
      'resolutionScale',
      'shadowMapSize',
      'cascadeCount',
      'msaaSamples',
    ] as const) {
      for (let i = 1; i < order.length; i++) {
        const prevId = order[i - 1];
        const nextId = order[i];
        if (!prevId || !nextId) continue;
        const prev = QUALITY_PRESETS[prevId];
        const next = QUALITY_PRESETS[nextId];
        expect(numeric(next, key), `${key}: ${prevId} -> ${nextId}`).toBeGreaterThanOrEqual(
          numeric(prev, key),
        );
      }
    }
  });

  it('never disables a flag once a lower tier enables it', () => {
    const order = [...PRESET_ORDER].reverse();
    const flagKeys = [
      'shadowsEnabled',
      'ssaoEnabled',
      'bloomEnabled',
      'tsaaEnabled',
      'ssrEnabled',
      'volumetricEnabled',
      'glowEnabled',
    ] as const;
    for (const key of flagKeys) {
      for (let i = 1; i < order.length; i++) {
        const prevId = order[i - 1];
        const nextId = order[i];
        if (!prevId || !nextId) continue;
        const prev = QUALITY_PRESETS[prevId];
        const next = QUALITY_PRESETS[nextId];
        expect(prev[key] && !next[key], `${key} must stay on: ${prevId} -> ${nextId}`).toBe(false);
      }
    }
  });

  it('keeps shadow settings consistent', () => {
    for (const preset of Object.values(QUALITY_PRESETS)) {
      if (!preset.shadowsEnabled) {
        expect(preset.shadowMapSize).toBe(0);
        expect(preset.cascadeCount).toBe(0);
      } else {
        expect(preset.shadowMapSize).toBeGreaterThan(0);
        expect(preset.cascadeCount).toBeGreaterThan(0);
      }
      expect(preset.shadowMapSize).toBeLessThanOrEqual(4096);
      expect(preset.cascadeCount).toBeLessThanOrEqual(4);
    }
  });

  it('clamps resolution scales to the [0.5, 2] domain', () => {
    for (const preset of Object.values(QUALITY_PRESETS)) {
      expect(preset.resolutionScale).toBeGreaterThanOrEqual(0.5);
      expect(preset.resolutionScale).toBeLessThanOrEqual(2);
    }
  });

  it('never enables FXAA and TAA at the same time', () => {
    for (const preset of Object.values(QUALITY_PRESETS)) {
      expect(preset.fxaaEnabled && preset.tsaaEnabled).toBe(false);
    }
  });
});

describe('autoDetectQuality / resolveQualityId', () => {
  it('returns a concrete tier (never auto)', () => {
    const ids = ['ultra', 'high', 'medium', 'low'] as const;
    expect(ids).toContain(autoDetectQuality());
  });

  it('resolves auto to a concrete tier', () => {
    expect(['ultra', 'high', 'medium', 'low']).toContain(resolveQualityId('auto'));
  });

  it('passes concrete tiers through unchanged', () => {
    expect(resolveQualityId('high')).toBe('high');
    expect(resolveQualityId('low')).toBe('low');
  });
});
