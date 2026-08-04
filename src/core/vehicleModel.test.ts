import { describe, expect, it } from 'vitest';
import { getBusConfig } from '../data/busConfig';
import { createVehicleState, stepVehicle, type VehicleInput } from './vehicleModel';

const CONFIG = getBusConfig('cityliner');

function run(
  state = createVehicleState(),
  input: VehicleInput = fullThrottle(),
  seconds = 1,
): void {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) stepVehicle(state, input, dt, CONFIG);
}

function fullThrottle(): VehicleInput {
  return { throttle: 1, brake: 0, steer: 0, reverse: false };
}

describe('vehicleModel', () => {
  it('accelerates from standstill', () => {
    const state = createVehicleState();
    run(state, fullThrottle(), 5);
    expect(state.speed).toBeGreaterThan(2);
    expect(state.positionZ).toBeGreaterThan(0);
    expect(state.positionX).toBe(0);
  });

  it('reaches a stable top speed near the engine limit', () => {
    const state = createVehicleState();
    run(state, fullThrottle(), 300);
    expect(state.speed).toBeGreaterThan(20);
    expect(state.speed).toBeLessThan(28);
    const before = state.speed;
    run(state, fullThrottle(), 10);
    expect(Math.abs(state.speed - before)).toBeLessThan(0.5);
  });

  it('brakes to a stop', () => {
    const state = createVehicleState();
    run(state, fullThrottle(), 20);
    expect(state.speed).toBeGreaterThan(15);
    run(state, { throttle: 0, brake: 1, steer: 0, reverse: false }, 15);
    expect(state.speed).toBeGreaterThan(-0.01);
    expect(state.speed).toBeLessThan(0.5);
  });

  it('drives in reverse when requested and stays within the reverse limit', () => {
    const state = createVehicleState();
    run(state, { throttle: 0, brake: 0, steer: 0, reverse: true }, 0.2);
    run(state, { throttle: 1, brake: 0, steer: 0, reverse: true }, 10);
    expect(state.speed).toBeLessThan(-1);
    expect(state.speed).toBeGreaterThanOrEqual(-CONFIG.reverseSpeedLimitMps - 0.1);
    expect(state.gearIndex).toBe(-1);
  });

  it('does not turn while standing still', () => {
    const state = createVehicleState();
    run(state, { throttle: 0, brake: 0, steer: 1, reverse: false }, 3);
    expect(Math.abs(state.heading)).toBeLessThan(1e-9);
    expect(state.positionX).toBe(0);
    expect(state.positionZ).toBe(0);
  });

  it('turns in the steering direction at speed', () => {
    const state = createVehicleState();
    run(state, fullThrottle(), 8);
    expect(state.speed).toBeGreaterThan(10);
    const headingBefore = state.heading;
    run(state, { throttle: 1, brake: 0, steer: -1, reverse: false }, 2);
    expect(state.heading - headingBefore).toBeLessThan(-0.05);
    run(state, { throttle: 1, brake: 0, steer: 1, reverse: false }, 4);
    expect(state.heading - headingBefore).toBeGreaterThan(0.05);
  });

  it('shifts up through the gears and back down', () => {
    const state = createVehicleState();
    run(state, fullThrottle(), 30);
    expect(state.gearIndex).toBeGreaterThan(1);
    expect(state.engineRpm).toBeLessThanOrEqual(CONFIG.maxRpm);
    expect(state.engineRpm).toBeGreaterThanOrEqual(CONFIG.idleRpm);
    run(state, { throttle: 0, brake: 1, steer: 0, reverse: false }, 30);
    expect(state.gearIndex).toBe(1);
    expect(state.speed).toBeLessThan(1);
    expect(state.engineRpm).toBeLessThanOrEqual(CONFIG.maxRpm);
  });

  it('keeps a straight line when coasting without steering', () => {
    const state = createVehicleState();
    run(state, fullThrottle(), 10);
    const heading = state.heading;
    run(state, { throttle: 0, brake: 0, steer: 0, reverse: false }, 5);
    expect(Math.abs(state.heading - heading)).toBeLessThan(1e-9);
  });

  it('produces finite values for long uncontrolled inputs', () => {
    const state = createVehicleState();
    const weird: VehicleInput = { throttle: 1, brake: 0.3, steer: 1, reverse: true };
    const dt = 1 / 60;
    for (let i = 0; i < 60 * 60; i++) stepVehicle(state, weird, dt, CONFIG);
    expect(Number.isFinite(state.positionX)).toBe(true);
    expect(Number.isFinite(state.positionZ)).toBe(true);
    expect(Number.isFinite(state.speed)).toBe(true);
    expect(Number.isFinite(state.engineRpm)).toBe(true);
  });
});
