import { describe, expect, it } from 'vitest';
import { WEATHER_IDS, WEATHER_PRESETS, getWeatherPreset, isWeatherId } from './weatherConfig';

describe('weatherConfig schema', () => {
  it('defines every id with a matching preset', () => {
    for (const id of WEATHER_IDS) {
      expect(WEATHER_PRESETS[id].id).toBe(id);
      expect(typeof WEATHER_PRESETS[id].label).toBe('string');
    }
  });

  it('keeps colours, intensities and densities in valid ranges', () => {
    for (const preset of Object.values(WEATHER_PRESETS)) {
      for (const channel of preset.fogColor) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
      expect(preset.skyTurbidity).toBeGreaterThan(0);
      expect(preset.skyTurbidity).toBeLessThanOrEqual(20);
      expect(preset.skyLuminance).toBeGreaterThan(0);
      expect(preset.skyLuminance).toBeLessThanOrEqual(1);
      expect(preset.mieCoefficient).toBeGreaterThanOrEqual(0);
      expect(preset.mieCoefficient).toBeLessThanOrEqual(0.1);
      expect(preset.sunIntensity).toBeGreaterThan(0);
      expect(preset.hemisphereIntensity).toBeGreaterThan(0);
      expect(preset.fogDensity).toBeGreaterThan(0);
      expect(preset.roadRoughness).toBeGreaterThanOrEqual(0);
      expect(preset.roadRoughness).toBeLessThanOrEqual(1);
      expect(preset.roadMetallic).toBeGreaterThanOrEqual(0);
      expect(preset.roadMetallic).toBeLessThanOrEqual(1);
    }
  });

  it('keeps particle ranges ordered when enabled', () => {
    for (const preset of Object.values(WEATHER_PRESETS)) {
      if (preset.particles === 0) continue;
      expect(preset.particles).toBeGreaterThan(0);
      expect(preset.particleSize[1]).toBeGreaterThanOrEqual(preset.particleSize[0]);
      expect(preset.particleSpeed[1]).toBeGreaterThanOrEqual(preset.particleSpeed[0]);
      expect(preset.particleLife[1]).toBeGreaterThanOrEqual(preset.particleLife[0]);
    }
  });

  it('has exactly one calm preset with no particles', () => {
    const calm = Object.values(WEATHER_PRESETS).filter((preset) => preset.particles === 0);
    expect(calm).toHaveLength(1);
    expect(calm[0]?.id).toBe('clear');
  });
});

describe('isWeatherId / getWeatherPreset', () => {
  it('recognises valid ids and rejects garbage', () => {
    expect(isWeatherId('rain')).toBe(true);
    expect(isWeatherId('hurricane')).toBe(false);
    expect(isWeatherId(7)).toBe(false);
  });

  it('resolves every valid id to its preset', () => {
    for (const id of WEATHER_IDS) {
      expect(getWeatherPreset(id).id).toBe(id);
    }
  });
});
