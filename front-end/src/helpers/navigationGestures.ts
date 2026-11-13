/** One gate for scene picking, including pointers owned by DOM overlays. */
export class NavigationGestures {
  private pointers = new Map<number, { x: number; y: number }>();
  canSelect = true;

  start(id: number, x: number, y: number): void {
    if (!this.pointers.size) this.canSelect = true;
    this.pointers.set(id, { x, y });
    if (this.pointers.size > 1) this.canSelect = false;
  }
  move(id: number, x: number, y: number): void {
    const start = this.pointers.get(id);
    if (start && Math.hypot(x - start.x, y - start.y) > 5) this.canSelect = false;
  }
  end(id: number): void { this.pointers.delete(id); }
  cancel(): void { this.pointers.clear(); this.canSelect = false; }
}
