import { describe, expect, it, vi } from "vitest";
import {
  CircuitBreaker,
  CircuitOpenError,
} from "../../../src/infrastructure/scoring/circuit-breaker.js";

describe("CircuitBreaker", () => {
  it("opens after five failures inside ten seconds without hidden retries", async () => {
    let now = 1_000;
    const breaker = new CircuitBreaker(5, 10_000, () => now);
    const operation = vi.fn(() => Promise.reject(new Error("upstream")));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(breaker.execute(operation)).rejects.toThrow("upstream");
      now += 1_000;
    }

    expect(breaker.state).toBe("open");
    await expect(breaker.execute(operation)).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
    expect(operation).toHaveBeenCalledTimes(5);
  });

  it("allows one half-open probe and closes after success", async () => {
    let now = 1_000;
    const breaker = new CircuitBreaker(1, 10_000, () => now);
    await expect(
      breaker.execute(() => Promise.reject(new Error("upstream"))),
    ).rejects.toThrow("upstream");
    now = 11_000;

    let resolveProbe: ((value: string) => void) | undefined;
    const probe = breaker.execute(
      () =>
        new Promise<string>((resolve) => {
          resolveProbe = resolve;
        }),
    );
    await expect(
      breaker.execute(() => Promise.resolve("second")),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    resolveProbe?.("healthy");

    await expect(probe).resolves.toBe("healthy");
    expect(breaker.state).toBe("closed");
  });

  it("reopens when the half-open probe fails", async () => {
    let now = 1_000;
    const breaker = new CircuitBreaker(1, 10_000, () => now);
    await expect(
      breaker.execute(() => Promise.reject(new Error("first"))),
    ).rejects.toThrow("first");
    now = 11_000;
    await expect(
      breaker.execute(() => Promise.reject(new Error("probe"))),
    ).rejects.toThrow("probe");
    expect(breaker.state).toBe("open");
  });
});
