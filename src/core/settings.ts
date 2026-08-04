import { EventEmitter } from './events';
import { WEATHER_IDS, type WeatherId } from '../data/weatherConfig';

/** Quality tiers exposed to the user. 'auto' resolves to a concrete preset. */
export type QualityId = 'auto' | 'low' | 'medium' | 'high' | 'ultra';

export type RendererPreference = 'auto' | 'webgpu' | 'webgl2';

export interface Settings {
  renderer: RendererPreference;
  quality: QualityId;
  /** User resolution scale multiplier, 0.5..2. Combined with the preset scale. */
  resolutionScale: number;
  vsync: boolean;
  showFrameStats: boolean;
  weather: WeatherId;
}

export interface SettingsEvents {
  changed: [Settings];
}

export const SETTINGS_STORAGE_KEY = 'route24.settings.v1';

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  renderer: 'auto',
  quality: 'auto',
  resolutionScale: 1,
  vsync: true,
  showFrameStats: true,
  weather: 'clear',
};

export const QUALITY_IDS: readonly QualityId[] = ['auto', 'low', 'medium', 'high', 'ultra'];
export const RENDERER_IDS: readonly RendererPreference[] = ['auto', 'webgpu', 'webgl2'];

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function clampResolutionScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.resolutionScale;
  return Math.min(2, Math.max(0.5, value));
}

export function isQualityId(value: unknown): value is QualityId {
  return typeof value === 'string' && (QUALITY_IDS as readonly string[]).includes(value);
}

export function isRendererPreference(value: unknown): value is RendererPreference {
  return typeof value === 'string' && (RENDERER_IDS as readonly string[]).includes(value);
}

export function sanitizeSettings(raw: unknown): Settings {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    renderer: isRendererPreference(source.renderer) ? source.renderer : DEFAULT_SETTINGS.renderer,
    quality: isQualityId(source.quality) ? source.quality : DEFAULT_SETTINGS.quality,
    resolutionScale: clampResolutionScale(
      typeof source.resolutionScale === 'number'
        ? source.resolutionScale
        : DEFAULT_SETTINGS.resolutionScale,
    ),
    vsync: typeof source.vsync === 'boolean' ? source.vsync : DEFAULT_SETTINGS.vsync,
    showFrameStats:
      typeof source.showFrameStats === 'boolean'
        ? source.showFrameStats
        : DEFAULT_SETTINGS.showFrameStats,
    weather:
      typeof source.weather === 'string' && WEATHER_IDS.includes(source.weather as WeatherId)
        ? (source.weather as WeatherId)
        : DEFAULT_SETTINGS.weather,
  };
}

function createDefaultStorage(): SettingsStorage {
  try {
    return {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    };
  } catch {
    // localStorage unavailable (private mode, sandboxed iframe, …)
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value),
    };
  }
}

/**
 * Loads, validates, persists and publishes settings.
 * Pure logic is fully injectable so it can be unit-tested without a DOM.
 */
export class SettingsManager {
  readonly events = new EventEmitter<SettingsEvents>();
  private readonly storage: SettingsStorage;
  private current: Settings;

  constructor(storage: SettingsStorage = createDefaultStorage(), initial?: Settings) {
    this.storage = storage;
    this.current = initial ?? this.read();
  }

  private read(): Settings {
    try {
      const raw = this.storage.getItem(SETTINGS_STORAGE_KEY);
      return raw === null ? { ...DEFAULT_SETTINGS } : sanitizeSettings(JSON.parse(raw) as unknown);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  get settings(): Settings {
    return this.current;
  }

  update(patch: Partial<Settings>): void {
    this.current = sanitizeSettings({ ...this.current, ...patch });
    this.persist();
    this.events.emit('changed', this.current);
  }

  reset(): void {
    this.current = { ...DEFAULT_SETTINGS };
    this.persist();
    this.events.emit('changed', this.current);
  }

  private persist(): void {
    try {
      this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.current));
    } catch {
      // Persisting is best-effort; in-memory settings still apply for this session.
    }
  }
}
