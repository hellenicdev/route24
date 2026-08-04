export type WeatherId = 'clear' | 'rain' | 'snow';

export interface WeatherPreset {
  id: WeatherId;
  label: string;
  /** Sky dome haze/brightness/scattering (SkyMaterial params). */
  skyTurbidity: number;
  skyLuminance: number;
  mieCoefficient: number;
  /** Scene fog colour and density (EXP2). */
  fogColor: [number, number, number];
  fogDensity: number;
  sunIntensity: number;
  hemisphereIntensity: number;
  ambient: [number, number, number];
  /** Road material changes: lower roughness = wet gloss, lower albedo = darker. */
  roadAlbedo: [number, number, number];
  roadRoughness: number;
  roadMetallic: number;
  /** CPU particle system configuration; 0 disables the effect. */
  particles: number;
  particleSize: [number, number];
  particleSpeed: [number, number];
  particleLife: [number, number];
  particleColor: [number, number, number];
  particleAccent: [number, number, number];
  /** Horizontal wind drift applied to particles, m/s. */
  wind: number;
}

export const WEATHER_PRESETS: Record<WeatherId, WeatherPreset> = {
  clear: {
    id: 'clear',
    label: 'Clear',
    skyTurbidity: 6,
    skyLuminance: 0.55,
    mieCoefficient: 0.005,
    fogColor: [0.82, 0.85, 0.9],
    fogDensity: 0.0011,
    sunIntensity: 3.2,
    hemisphereIntensity: 0.42,
    ambient: [0.28, 0.3, 0.36],
    roadAlbedo: [1, 1, 1],
    roadRoughness: 0.92,
    roadMetallic: 0,
    particles: 0,
    particleSize: [0, 0],
    particleSpeed: [0, 0],
    particleLife: [0, 0],
    particleColor: [0, 0, 0],
    particleAccent: [0, 0, 0],
    wind: 0,
  },
  rain: {
    id: 'rain',
    label: 'Rain',
    skyTurbidity: 12,
    skyLuminance: 0.26,
    mieCoefficient: 0.03,
    fogColor: [0.45, 0.48, 0.53],
    fogDensity: 0.008,
    sunIntensity: 1.7,
    hemisphereIntensity: 0.55,
    ambient: [0.42, 0.44, 0.5],
    roadAlbedo: [0.72, 0.74, 0.78],
    roadRoughness: 0.22,
    roadMetallic: 0.12,
    particles: 2600,
    particleSize: [0.04, 0.09],
    particleSpeed: [16, 24],
    particleLife: [1.2, 1.8],
    particleColor: [0.55, 0.62, 0.72],
    particleAccent: [0.72, 0.78, 0.86],
    wind: 4,
  },
  snow: {
    id: 'snow',
    label: 'Snow',
    skyTurbidity: 8,
    skyLuminance: 0.4,
    mieCoefficient: 0.012,
    fogColor: [0.78, 0.82, 0.86],
    fogDensity: 0.0042,
    sunIntensity: 2.3,
    hemisphereIntensity: 0.6,
    ambient: [0.5, 0.52, 0.57],
    roadAlbedo: [0.82, 0.84, 0.88],
    roadRoughness: 0.55,
    roadMetallic: 0,
    particles: 1100,
    particleSize: [0.08, 0.16],
    particleSpeed: [1.4, 3],
    particleLife: [4, 7],
    particleColor: [0.95, 0.96, 0.98],
    particleAccent: [1, 1, 1],
    wind: 2.5,
  },
};

export const WEATHER_IDS: readonly WeatherId[] = ['clear', 'rain', 'snow'];

export function isWeatherId(value: unknown): value is WeatherId {
  return typeof value === 'string' && (WEATHER_IDS as readonly string[]).includes(value);
}

export function getWeatherPreset(id: WeatherId): WeatherPreset {
  return WEATHER_PRESETS[id];
}
