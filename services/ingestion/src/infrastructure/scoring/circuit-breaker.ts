export type CircuitState = "closed" | "open" | "half_open";

export class CircuitOpenError extends Error {
  readonly code = "SCORING_CIRCUIT_OPEN";

  constructor() {
    super("El circuito del motor de scoring está abierto.");
    this.name = "CircuitOpenError";
  }
}

export class CircuitBreaker {
  private failures: number[] = [];
  private openedAt: number | null = null;
  private halfOpenRequestActive = false;

  constructor(
    private readonly threshold = 5,
    private readonly windowMs = 10_000,
    private readonly now: () => number = Date.now,
  ) {}

  get state(): CircuitState {
    if (this.openedAt === null) return "closed";
    return this.now() - this.openedAt >= this.windowMs ? "half_open" : "open";
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const state = this.state;
    if (
      state === "open" ||
      (state === "half_open" && this.halfOpenRequestActive)
    )
      throw new CircuitOpenError();
    if (state === "half_open") this.halfOpenRequestActive = true;

    try {
      const result = await operation();
      this.failures = [];
      this.openedAt = null;
      return result;
    } catch (error) {
      this.recordFailure(state === "half_open");
      throw error;
    } finally {
      if (state === "half_open") this.halfOpenRequestActive = false;
    }
  }

  private recordFailure(halfOpenFailure: boolean): void {
    const now = this.now();
    this.failures = this.failures.filter(
      (failure) => now - failure < this.windowMs,
    );
    this.failures.push(now);
    if (halfOpenFailure || this.failures.length >= this.threshold)
      this.openedAt = now;
  }
}
