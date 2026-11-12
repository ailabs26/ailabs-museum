const DWELL_MS = 15_000;

/** Owns one guided-tour dwell timer while public routes mount and unmount. */
export class GuidedDwellClock {
  private key: string | null = null;
  private remainingMs = DWELL_MS;
  private deadline: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  constructor(private readonly now = () => performance.now()) {}

  reset(key: string | null) {
    this.clearTimer();
    this.key = key;
    this.remainingMs = DWELL_MS;
    this.deadline = null;
    this.generation++;
  }

  remaining(key: string) {
    if (this.key !== key) return null;
    return this.deadline === null ? this.remainingMs : Math.max(0, this.deadline - this.now());
  }

  start(key: string, onElapsed: () => void) {
    if (this.key !== key) this.reset(key);
    if (this.timer !== null) return;

    const generation = ++this.generation;
    this.deadline = this.now() + this.remainingMs;
    this.timer = setTimeout(() => {
      if (this.key !== key || this.generation !== generation) return;
      this.timer = null;
      this.deadline = null;
      this.remainingMs = DWELL_MS;
      onElapsed();
    }, this.remainingMs);
  }

  pause() {
    if (this.deadline !== null) this.remainingMs = Math.max(0, this.deadline - this.now());
    this.clearTimer();
    this.deadline = null;
    this.generation++;
  }

  dispose() {
    this.reset(null);
  }

  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
