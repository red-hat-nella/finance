import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TermsAccessClient,
  TermsAccessClientError,
} from "../../src/clients/terms-access.client.js";

const command = {
  authorization: "Bearer original-user-jwt",
  requestId: "50000000-0000-4000-8000-000000000032",
};

const config = {
  baseUrl: "http://terms-api:8080",
  timeoutMs: 500 as const,
  token: "s".repeat(48),
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const accepted = {
  allowed: true,
  currentVersionId: "10000000-0000-4000-8000-000000000001",
  currentVersionCode: "TERMS-1.0.0",
  acceptedVersionId: "10000000-0000-4000-8000-000000000001",
  checkedAt: "2026-08-12T14:00:00Z",
  reason: "ACCEPTED",
};

const required = {
  allowed: false,
  currentVersionId: "10000000-0000-4000-8000-000000000001",
  currentVersionCode: "TERMS-1.0.0",
  acceptedVersionId: null,
  checkedAt: "2026-08-12T14:00:00Z",
  reason: "ACCEPTANCE_REQUIRED",
  acceptanceUrl: "/terms/",
};

const noEffectiveVersion = {
  allowed: false,
  currentVersionId: null,
  currentVersionCode: null,
  acceptedVersionId: null,
  checkedAt: "2026-08-12T14:00:00Z",
  reason: "NO_EFFECTIVE_VERSION",
};

afterEach(() => vi.unstubAllGlobals());

describe("TermsAccessClient", () => {
  it.each([
    ["accepted", accepted],
    ["acceptance required", required],
    ["no effective version", noEffectiveVersion],
  ])("validates the %s decision", async (_label, body) => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      () => Promise.resolve(response(body)),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(new TermsAccessClient(config).decide(command)).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error("fetch was not called");
    const [url, init] = call;
    expect(url).toBe("http://terms-api:8080/internal/v1/access-decisions");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: command.authorization,
        "X-Service-Token": config.token,
        "X-Request-Id": command.requestId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ resourceClass: "credit_business" }),
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["malformed JSON", new Response("not-json", { status: 200 })],
    ["unknown property", response({ ...accepted, legalContent: "must not pass" })],
    ["allowed without matching versions", response({ ...accepted, acceptedVersionId: null })],
    ["acceptance required without safe URL", response({ ...required, acceptanceUrl: "https://evil.example" })],
  ])("fails closed for %s", async (_label, upstream) => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(upstream)));
    await expect(new TermsAccessClient(config).decide(command)).rejects.toMatchObject({
      code: "TERMS_ACCESS_RESPONSE_INVALID",
    });
  });

  it("enforces the 500 ms timeout contract", async () => {
    const fetchMock = vi.fn(() =>
      Promise.reject(new DOMException("timed out", "TimeoutError")),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(new TermsAccessClient(config).decide(command)).rejects.toMatchObject({
      code: "TERMS_ACCESS_TIMEOUT",
    });
    expect(config.timeoutMs).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("opens without retries and recovers through one half-open probe", async () => {
    let now = 1_000;
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError("connection refused"))
      .mockImplementation(() => Promise.resolve(response(accepted)));
    vi.stubGlobal("fetch", fetchMock);
    const client = new TermsAccessClient(config, {
      failureThreshold: 1,
      resetMs: 10_000,
      now: () => now,
    });

    await expect(client.decide(command)).rejects.toBeInstanceOf(TermsAccessClientError);
    await expect(client.decide(command)).rejects.toMatchObject({
      code: "TERMS_ACCESS_CIRCUIT_OPEN",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now = 11_000;
    await expect(client.decide(command)).resolves.toMatchObject({ allowed: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(client.decide(command)).resolves.toMatchObject({ allowed: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["upstream failure", () => Promise.resolve(new Response(null, { status: 503 }))],
    ["network failure", () => Promise.reject(new TypeError("unavailable"))],
  ])("maps %s without returning partial data", async (_label, upstream) => {
    vi.stubGlobal("fetch", vi.fn(upstream));
    await expect(new TermsAccessClient(config).decide(command)).rejects.toMatchObject({
      code: "TERMS_ACCESS_UNAVAILABLE",
    });
  });
});
