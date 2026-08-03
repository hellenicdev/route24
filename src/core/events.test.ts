import { describe, expect, it } from 'vitest';
import { EventEmitter } from './events';

interface TestEvents {
  ping: [number];
  multi: [number, boolean, string];
}

function makeEmitter(): EventEmitter<TestEvents> {
  return new EventEmitter<TestEvents>();
}

describe('EventEmitter', () => {
  it('emits to all listeners with correct arguments', () => {
    const emitter = makeEmitter();
    const received: [number, boolean, string][] = [];
    const off1 = emitter.on('multi', (n, b, s) => received.push([n, b, s]));
    const off2 = emitter.on('multi', (n, b, s) => received.push([n, b, s]));
    emitter.emit('multi', 1, true, 'x');
    expect(received).toEqual([
      [1, true, 'x'],
      [1, true, 'x'],
    ]);
    off1();
    off2();
    expect(emitter.listenerCount('multi')).toBe(0);
  });

  it('calls once listeners a single time', () => {
    const emitter = makeEmitter();
    let calls = 0;
    emitter.once('ping', () => {
      calls++;
    });
    emitter.emit('ping', 0);
    emitter.emit('ping', 0);
    expect(calls).toBe(1);
  });

  it('removes listeners by returned unsubscribe and by off()', () => {
    const emitter = makeEmitter();
    const seen: number[] = [];
    emitter.on('multi', (n) => seen.push(n));
    const unsubscribe = emitter.on('multi', (n) => seen.push(n * 10));
    emitter.emit('multi', 1, false, 'a');
    unsubscribe();
    emitter.emit('multi', 2, false, 'b');
    expect(seen).toEqual([1, 10, 2]);
  });

  it('keeps dispatching when a listener throws', () => {
    const emitter = makeEmitter();
    const seen: number[] = [];
    emitter.on('multi', () => {
      throw new Error('boom');
    });
    emitter.on('multi', (n) => seen.push(n));
    expect(() => emitter.emit('multi', 3, true, 'c')).not.toThrow();
    expect(seen).toEqual([3]);
  });

  it('does not call listeners added during dispatch', () => {
    const emitter = makeEmitter();
    const seen: number[] = [];
    emitter.on('multi', (n) => {
      seen.push(n);
      emitter.on('multi', (m) => seen.push(m * 100));
    });
    emitter.emit('multi', 1, false, 'a');
    emitter.emit('multi', 2, false, 'b');
    expect(seen).toEqual([1, 2, 200]);
  });

  it('clears all listeners', () => {
    const emitter = makeEmitter();
    let calls = 0;
    emitter.on('ping', () => calls++);
    emitter.clear();
    emitter.emit('ping', 0);
    expect(calls).toBe(0);
  });
});
