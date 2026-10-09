/** Thrown into a behavior when something more important interrupts it. */
export class Cancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'Cancelled';
  }
}

/** Cancellation handle shared by everything one behavior is waiting on. */
export class Token {
  cancelled = false;
  private handlers = new Set<() => void>();

  onCancel(handler: () => void): () => void {
    if (this.cancelled) {
      handler();
      return () => {};
    }
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    const handlers = [...this.handlers];
    this.handlers.clear();
    handlers.forEach((h) => h());
  }

  check(): void {
    if (this.cancelled) throw new Cancelled();
  }
}
