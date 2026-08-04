import { describe, expect, it } from 'vitest';
import { BUS_CONFIGS, DEFAULT_BUS_ID, getBusConfig } from './busConfig';

describe('bus configs', () => {
  it('provides a default config', () => {
    expect(getBusConfig(DEFAULT_BUS_ID)).toBeDefined();
  });

  it('rejects unknown ids', () => {
    expect(() => getBusConfig('nope')).toThrow(/Unknown bus config/);
  });

  it('has sane physical dimensions for every config', () => {
    for (const config of Object.values(BUS_CONFIGS)) {
      expect(config.length, config.id).toBeGreaterThan(8);
      expect(config.width, config.id).toBeGreaterThan(2);
      expect(config.height, config.id).toBeGreaterThan(2.5);
      expect(config.height, config.id).toBeLessThan(4.5);
      expect(config.wheelbase, config.id).toBeGreaterThan(3);
      expect(config.wheelRadius, config.id).toBeGreaterThan(0.3);
      expect(config.wheelRadius, config.id).toBeLessThan(0.7);
      expect(config.kerbMassKg, config.id).toBeGreaterThan(5000);
      expect(config.passengerCapacity, config.id).toBeGreaterThan(30);
    }
  });

  it('orders forward gear ratios strictly descending', () => {
    for (const config of Object.values(BUS_CONFIGS)) {
      expect(config.gearRatios.length, config.id).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < config.gearRatios.length; i++) {
        const prev = config.gearRatios[i - 1];
        const next = config.gearRatios[i];
        if (prev === undefined || next === undefined) continue;
        expect(next, `${config.id} gear ${i}`).toBeLessThan(prev);
        expect(next, `${config.id} gear ${i}`).toBeGreaterThan(0);
      }
    }
  });

  it('has a physically plausible torque curve for every config', () => {
    for (const config of Object.values(BUS_CONFIGS)) {
      expect(config.torqueCurve.length, config.id).toBeGreaterThanOrEqual(2);
      expect(config.torqueCurve[0]?.rpm, config.id).toBeLessThanOrEqual(config.idleRpm);
      const last = config.torqueCurve[config.torqueCurve.length - 1];
      expect(last?.rpm, config.id).toBeGreaterThanOrEqual(config.maxRpm);
      for (let i = 1; i < config.torqueCurve.length; i++) {
        const prev = config.torqueCurve[i - 1];
        const next = config.torqueCurve[i];
        if (!prev || !next) continue;
        expect(next.rpm, config.id).toBeGreaterThan(prev.rpm);
        expect(next.torqueNm, config.id).toBeGreaterThan(0);
      }
      expect(config.torqueCurve[0]?.torqueNm, config.id).toBeGreaterThan(500);
    }
  });

  it('keeps shift points inside the rpm band', () => {
    for (const config of Object.values(BUS_CONFIGS)) {
      expect(config.shiftUpRpm, config.id).toBeGreaterThan(config.shiftDownRpm);
      expect(config.shiftUpRpm, config.id).toBeLessThan(config.maxRpm);
      expect(config.shiftDownRpm, config.id).toBeGreaterThan(config.idleRpm);
      expect(config.finalDrive, config.id).toBeGreaterThan(2);
    }
  });
});
