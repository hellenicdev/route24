/**
 * Loading screen controller. Pure DOM manipulation; the visual comes from
 * index.html + styles.css.
 */
export class LoadingScreen {
  constructor(
    private readonly root: HTMLElement,
    private readonly barFill: HTMLElement,
    private readonly statusEl: HTMLElement,
  ) {}

  setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  setProgress(fraction: number): void {
    const clamped = Math.min(1, Math.max(0, fraction));
    this.barFill.style.width = `${Math.round(clamped * 100)}%`;
  }

  /** Fades the screen out and hides it after the CSS transition. */
  hide(): void {
    this.root.classList.add('loading-done');
    window.setTimeout(() => this.root.classList.add('hidden'), 600);
  }
}
