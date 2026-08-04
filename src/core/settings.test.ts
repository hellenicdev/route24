import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SettingsManager,
  sanitizeSettings,
  clampResolutionScale,
  type SettingsStorage,
} from './settings';

function createMemoryStorage(): SettingsStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('sanitizeSettings', () => {
  it('falls back to defaults for garbage input', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects unknown enum values', () => {
    const result = sanitizeSettings({ quality: 'mega', renderer: 'd3d12', weather: 'monsoon' });
    expect(result.quality).toBe(DEFAULT_SETTINGS.quality);
    expect(result.renderer).toBe(DEFAULT_SETTINGS.renderer);
    expect(result.weather).toBe(DEFAULT_SETTINGS.weather);
  });

  it('accepts valid values and clamps the resolution scale', () => {
    const result = sanitizeSettings({
      renderer: 'webgpu',
      quality: 'ultra',
      resolutionScale: 7,
      vsync: false,
      showFrameStats: false,
      weather: 'rain',
    });
    expect(result.renderer).toBe('webgpu');
    expect(result.quality).toBe('ultra');
    expect(result.resolutionScale).toBe(2);
    expect(result.weather).toBe('rain');
  });
});

describe('clampResolutionScale', () => {
  it('clamps to the [0.5, 2] range', () => {
    expect(clampResolutionScale(0.1)).toBe(0.5);
    expect(clampResolutionScale(9)).toBe(2);
    expect(clampResolutionScale(1.25)).toBe(1.25);
  });

  it('falls back on non-finite input', () => {
    expect(clampResolutionScale(Number.NaN)).toBe(DEFAULT_SETTINGS.resolutionScale);
    expect(clampResolutionScale(Number.POSITIVE_INFINITY)).toBe(DEFAULT_SETTINGS.resolutionScale);
  });
});

describe('SettingsManager', () => {
  it('loads defaults when storage is empty', () => {
    const storage = createMemoryStorage();
    const manager = new SettingsManager(storage);
    expect(manager.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips settings through storage', () => {
    const storage = createMemoryStorage();
    const manager = new SettingsManager(storage);
    manager.update({ quality: 'high', resolutionScale: 1.5 });

    const reloaded = new SettingsManager(storage);
    expect(reloaded.settings.quality).toBe('high');
    expect(reloaded.settings.resolutionScale).toBe(1.5);
    expect(storage.data.get(SETTINGS_STORAGE_KEY)).toBe(JSON.stringify(manager.settings));
  });

  it('ignores corrupted storage content', () => {
    const storage = createMemoryStorage();
    storage.setItem(SETTINGS_STORAGE_KEY, '{not json!!');
    const manager = new SettingsManager(storage);
    expect(manager.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('emits changed events on update and reset', () => {
    const storage = createMemoryStorage();
    const manager = new SettingsManager(storage);
    const events: string[] = [];
    manager.events.on('changed', (s) => events.push(s.quality));
    manager.update({ quality: 'low' });
    manager.reset();
    expect(events).toEqual(['low', DEFAULT_SETTINGS.quality]);
  });
});
