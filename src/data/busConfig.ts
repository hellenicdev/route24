export interface TorquePoint {
  rpm: number;
  torqueNm: number;
}

export interface BusConfig {
  id: string;
  label: string;
  /** Overall dimensions in metres. */
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  trackWidth: number;
  wheelRadius: number;
  kerbMassKg: number;
  passengerCapacity: number;
  dragCoeff: number;
  frontalAreaM2: number;
  rollingResistance: number;
  drivetrainEfficiency: number;
  maxSteerRad: number;
  /** Forward gear ratios, first gear highest. Reverse reuses gearRatios[0]. */
  gearRatios: number[];
  finalDrive: number;
  idleRpm: number;
  maxRpm: number;
  shiftUpRpm: number;
  shiftDownRpm: number;
  torqueCurve: TorquePoint[];
  /** Service brake force at the wheels, newtons. */
  brakeForceN: number;
  /** Coasting deceleration from engine braking, m/s^2. */
  engineBrakeDecel: number;
  reverseSpeedLimitMps: number;
}

/** 12 m city bus, diesel automatic. */
export const BUS_CONFIGS: Record<string, BusConfig> = {
  cityliner: {
    id: 'cityliner',
    label: 'Cityliner 12m',
    length: 12,
    width: 2.55,
    height: 3.05,
    wheelbase: 5.9,
    trackWidth: 2.1,
    wheelRadius: 0.5,
    kerbMassKg: 12000,
    passengerCapacity: 92,
    dragCoeff: 0.75,
    frontalAreaM2: 7.6,
    rollingResistance: 0.012,
    drivetrainEfficiency: 0.88,
    maxSteerRad: 0.55,
    gearRatios: [6.5, 4.3, 3.0, 2.2, 1.65, 1.28, 1.0],
    finalDrive: 4.9,
    idleRpm: 650,
    maxRpm: 2300,
    shiftUpRpm: 2050,
    shiftDownRpm: 1250,
    torqueCurve: [
      { rpm: 650, torqueNm: 900 },
      { rpm: 900, torqueNm: 1050 },
      { rpm: 1200, torqueNm: 1200 },
      { rpm: 1500, torqueNm: 1350 },
      { rpm: 1900, torqueNm: 1250 },
      { rpm: 2300, torqueNm: 1000 },
    ],
    brakeForceN: 90000,
    engineBrakeDecel: 0.6,
    reverseSpeedLimitMps: 2.8,
  },
};

export const DEFAULT_BUS_ID = 'cityliner';

export function getBusConfig(id: string): BusConfig {
  const config = BUS_CONFIGS[id];
  if (!config) throw new Error(`Unknown bus config "${id}"`);
  return config;
}
