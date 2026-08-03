/**
 * Keyboard + pointer input tracking.
 *
 * Kept intentionally thin for M0 (driving controls, gamepad and rebindable
 * actions arrive with the vehicle milestone). It only records raw device state
 * so camera and physics layers can read it without owning event listeners.
 */
export class InputManager {
  private readonly pressed = new Set<string>();
  private readonly pressedPulse = new Set<string>();
  private readonly releasedPulse = new Set<string>();

  private _pointerX = 0;
  private _pointerY = 0;
  private _pointerDeltaX = 0;
  private _pointerDeltaY = 0;
  private _wheelDelta = 0;
  private _pointerLeftDown = false;

  private readonly handleKeyDown = (event: Event): void => {
    const code = (event as KeyboardEvent).code;
    if (code && !this.pressed.has(code)) this.pressedPulse.add(code);
    if (code) this.pressed.add(code);
  };

  private readonly handleKeyUp = (event: Event): void => {
    const code = (event as KeyboardEvent).code;
    if (code) this.pressed.delete(code);
    if (code) this.releasedPulse.add(code);
  };

  private readonly handleBlur = (): void => {
    this.pressed.clear();
    this.pressedPulse.clear();
    this.releasedPulse.clear();
  };

  private readonly handlePointerMove = (event: Event): void => {
    const pointer = event as PointerEvent;
    this._pointerX = pointer.clientX;
    this._pointerY = pointer.clientY;
    if (this._pointerLeftDown) {
      this._pointerDeltaX += pointer.movementX;
      this._pointerDeltaY += pointer.movementY;
    }
  };

  private readonly handlePointerDown = (event: Event): void => {
    if ((event as PointerEvent).button === 0) this._pointerLeftDown = true;
  };

  private readonly handlePointerUp = (event: Event): void => {
    if ((event as PointerEvent).button === 0) this._pointerLeftDown = false;
  };

  private readonly handleWheel = (event: Event): void => {
    this._wheelDelta += (event as WheelEvent).deltaY;
  };

  attach(target: EventTarget = window): void {
    target.addEventListener('keydown', this.handleKeyDown);
    target.addEventListener('keyup', this.handleKeyUp);
    target.addEventListener('blur', this.handleBlur);
  }

  detach(target: EventTarget = window): void {
    target.removeEventListener('keydown', this.handleKeyDown);
    target.removeEventListener('keyup', this.handleKeyUp);
    target.removeEventListener('blur', this.handleBlur);
  }

  attachPointer(target: EventTarget): void {
    target.addEventListener('pointermove', this.handlePointerMove);
    target.addEventListener('pointerdown', this.handlePointerDown);
    target.addEventListener('pointerup', this.handlePointerUp);
    target.addEventListener('wheel', this.handleWheel, { passive: true });
  }

  detachPointer(target: EventTarget): void {
    target.removeEventListener('pointermove', this.handlePointerMove);
    target.removeEventListener('pointerdown', this.handlePointerDown);
    target.removeEventListener('pointerup', this.handlePointerUp);
    target.removeEventListener('wheel', this.handleWheel);
  }

  /** Reset per-frame pulse and delta state. Call once per rendered frame. */
  frame(): void {
    this.pressedPulse.clear();
    this.releasedPulse.clear();
    this._pointerDeltaX = 0;
    this._pointerDeltaY = 0;
    this._wheelDelta = 0;
  }

  isDown(code: string): boolean {
    return this.pressed.has(code);
  }

  /** True only on the frame the key was pressed. */
  wasPressed(code: string): boolean {
    return this.pressedPulse.has(code);
  }

  /** True only on the frame the key was released. */
  wasReleased(code: string): boolean {
    return this.releasedPulse.has(code);
  }

  /** Clears a press pulse so a later check in the same frame doesn't re-trigger. */
  consumePress(code: string): void {
    this.pressedPulse.delete(code);
  }

  get pointerX(): number {
    return this._pointerX;
  }

  get pointerY(): number {
    return this._pointerY;
  }

  get pointerDeltaX(): number {
    return this._pointerDeltaX;
  }

  get pointerDeltaY(): number {
    return this._pointerDeltaY;
  }

  get wheelDelta(): number {
    return this._wheelDelta;
  }

  get pointerLeftDown(): boolean {
    return this._pointerLeftDown;
  }
}
