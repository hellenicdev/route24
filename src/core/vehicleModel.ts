import type { BusConfig, TorquePoint } from '../data/busConfig';

export interface VehicleInput {
  /** 0..1 accelerator pedal. */
  throttle: number;
  /** 0..1 service brake pedal. */
  brake: number;
  /** -1 (full left) .. 1 (full right). */
  steer: number;
  /** Request reverse gear while at (near) standstill. */
  reverse: boolean;
}

export interface VehicleState {
  positionX: number;
  positionZ: number;
  /** Radians, 0 = facing +Z, positive = counter-clockwise. */
  heading: number;
  /** Signed m/s; negative while reversing. */
  speed: number;
  /** -1 = reverse, 1..N = forward gears. */
  gearIndex: number;
  engineRpm: number;
}

const GRAVITY = 9.81;
const AIR_DENSITY = 1.225;
const TWO_PI = Math.PI * 2;
const REST_SPEED = 0.5;

export function createVehicleState(positionX = 0, positionZ = 0, heading = 0): VehicleState {
  return { positionX, positionZ, heading, speed: 0, gearIndex: 1, engineRpm: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function torqueAt(rpm: number, curve: TorquePoint[]): number {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (!first || !last) return 0;
  if (rpm <= first.rpm) return first.torqueNm;
  if (rpm >= last.rpm) {
    const dropRpm = last.rpm * 1.15;
    return Math.max(0, last.torqueNm * (1 - (rpm - last.rpm) / (dropRpm - last.rpm)));
  }
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    if (!a || !b) continue;
    if (rpm <= b.rpm) {
      const t = (rpm - a.rpm) / (b.rpm - a.rpm);
      return a.torqueNm + (b.torqueNm - a.torqueNm) * t;
    }
  }
  return last.torqueNm;
}

/**
 * Advances the longitudinal + lateral bicycle model by one fixed step.
 * Mutates `state` in place. Forces in newtons, distances in metres.
 */
export function stepVehicle(
  state: VehicleState,
  input: VehicleInput,
  dt: number,
  config: BusConfig,
): void {
  const throttle = clamp(input.throttle, 0, 1);
  const brake = clamp(input.brake, 0, 1);
  const steer = clamp(input.steer, -1, 1);

  const atRest = Math.abs(state.speed) < REST_SPEED;
  if (state.gearIndex === -1) {
    if (!input.reverse && atRest) state.gearIndex = 1;
  } else if (input.reverse && atRest) {
    state.gearIndex = -1;
  }

  const reversing = state.gearIndex === -1;
  const gearRatio = reversing
    ? (config.gearRatios[0] ?? 1)
    : (config.gearRatios[state.gearIndex - 1] ?? config.gearRatios[0] ?? 1);

  // Engine speed follows wheel speed through the drivetrain.
  const rawRpm = (state.speed / config.wheelRadius) * gearRatio * config.finalDrive * (60 / TWO_PI);
  const rpm = reversing ? config.idleRpm : clamp(rawRpm, config.idleRpm, config.maxRpm);
  state.engineRpm = rpm;

  let engineForce = 0;
  // Rev limiter: cut torque above max rpm so the bus cannot exceed its gearing.
  if (throttle > 0 && !(rawRpm > config.maxRpm)) {
    const rawTorque = torqueAt(rpm, config.torqueCurve);
    engineForce =
      (rawTorque * gearRatio * config.finalDrive * config.drivetrainEfficiency) /
      config.wheelRadius;
    if (reversing) engineForce = -engineForce;
    if (reversing && state.speed <= -config.reverseSpeedLimitMps) engineForce = 0;
  }

  let brakeForce = 0;
  if (brake > 0 && Math.abs(state.speed) > 0.05) {
    brakeForce = -Math.sign(state.speed) * brake * config.brakeForceN;
  }

  const drag =
    -Math.sign(state.speed) *
    0.5 *
    AIR_DENSITY *
    config.dragCoeff *
    config.frontalAreaM2 *
    state.speed *
    state.speed;
  const rolling = -Math.sign(state.speed) * config.rollingResistance * config.kerbMassKg * GRAVITY;

  let engineBrake = 0;
  if (throttle === 0 && !reversing && state.speed > 0.5) {
    engineBrake = -config.engineBrakeDecel * config.kerbMassKg;
  }

  const acceleration =
    (engineForce + brakeForce + drag + rolling + engineBrake) / config.kerbMassKg;
  state.speed += acceleration * dt;

  // Steering: bicycle model with a low-speed lockout and speed-based understeer.
  const speedFactor = Math.min(1, Math.abs(state.speed) / 1.2);
  const understeer = 1 - Math.min(0.55, Math.abs(state.speed) * 0.012);
  const yawRate =
    (state.speed / config.wheelbase) *
    Math.tan(steer * config.maxSteerRad) *
    speedFactor *
    understeer;
  state.heading += yawRate * dt;
  state.positionX += Math.sin(state.heading) * state.speed * dt;
  state.positionZ += Math.cos(state.heading) * state.speed * dt;

  // Automatic gearbox.
  if (!reversing) {
    if (rpm > config.shiftUpRpm && state.gearIndex < config.gearRatios.length) state.gearIndex += 1;
    if (rpm < config.shiftDownRpm && state.gearIndex > 1) state.gearIndex -= 1;
  }
}
