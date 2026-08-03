/**
 * Minimal typed event emitter used across the game systems.
 * Keeps rendering, physics, UI and networking decoupled.
 */
export type EventListener<Args extends unknown[]> = (...args: Args) => void;

export class EventEmitter<Events extends Record<keyof Events, unknown[]>> {
  private readonly listeners = new Map<keyof Events, Set<EventListener<unknown[]>>>();

  on<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as unknown as EventListener<unknown[]>);
    return () => this.off(event, listener);
  }

  once<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): () => void {
    const wrapped = (...args: unknown[]) => {
      this.off(event, wrapped);
      (listener as unknown as EventListener<unknown[]>)(...args);
    };
    this.on(event, wrapped);
    return () => this.off(event, wrapped);
  }

  off<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener as unknown as EventListener<unknown[]>);
    if (set.size === 0) this.listeners.delete(event);
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // Copy so listeners added/removed during dispatch don't affect this pass.
    for (const listener of [...set]) {
      try {
        listener(...(args as unknown[]));
      } catch (error) {
        console.error(`[events] listener for "${String(event)}" threw:`, error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  listenerCount(event: keyof Events): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
