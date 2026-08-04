import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../../src/config/schema.js";
import type { AuditWriter } from "../../../src/modules/audit/audit-writer.js";
import type { HistoryRepository } from "../../../src/modules/history/history.repository.js";
import {
  HistoryValidationError,
  SearchHistoryService,
} from "../../../src/modules/history/search-history.service.js";

const config = {
  pii: { hmacKey: Buffer.alloc(32, 7) },
} as AppConfig;
const actor = {
  actorId: "analyst-opaque",
  orgId: "org-opaque",
  roles: ["credit_analyst"],
};

function dependencies() {
  const search = vi.fn<HistoryRepository["search"]>(() =>
    Promise.resolve({
      items: [],
      totalItems: 0,
    }),
  );
  const write = vi.fn<AuditWriter["write"]>(() => Promise.resolve());
  const repository = { search } as unknown as HistoryRepository;
  const audit = { write } as AuditWriter;
  return {
    search,
    write,
    service: new SearchHistoryService(repository, audit, config),
  };
}

describe("SearchHistoryService", () => {
  it("derives analyst ownership and blind-indexes exact document filters", async () => {
    const { service, search, write } = dependencies();

    const result = await service.execute(
      {
        page: 2,
        applicantIdentifier: { documentType: "CE", documentNumber: " ab123 " },
        states: ["evaluada", "error"],
      },
      actor,
      "50000000-0000-4000-8000-000000000001",
    );

    expect(result).toEqual({
      items: [],
      page: 2,
      pageSize: 25,
      totalItems: 0,
      totalPages: 0,
    });
    expect(search).toHaveBeenCalledWith(
      { orgId: "org-opaque", ownerActorId: "analyst-opaque" },
      expect.objectContaining({ page: 2, states: ["evaluada", "error"] }),
    );
    expect(Buffer.isBuffer(search.mock.calls[0]?.[1].documentBlindIndex)).toBe(
      true,
    );
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "HISTORY_SEARCHED",
        metadata: {
          filterTypes: "applicantIdentifier,states",
          resultCount: 0,
        },
      }),
    );
  });

  it("allows supervisor organization scope without an owner predicate", async () => {
    const { service, search } = dependencies();
    await service.execute(
      { page: 1 },
      { ...actor, roles: ["credit_supervisor"] },
      crypto.randomUUID(),
    );
    expect(search.mock.calls[0]?.[0]).toEqual({ orgId: "org-opaque" });
  });

  it.each([
    [{ page: 1, dateFrom: "2026-08-03", dateTo: "2026-08-01" }, "VAL-016"],
    [{ page: 1, states: ["desconocido"] }, "VAL-017"],
    [
      {
        page: 1,
        applicantIdentifier: { documentType: "CC", documentNumber: "AB-123" },
      },
      "VAL-001",
    ],
  ])("rejects invalid filters before querying", async (filters, code) => {
    const { service, search } = dependencies();
    try {
      await service.execute(filters, actor, crypto.randomUUID());
      throw new Error("Expected history validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HistoryValidationError);
      if (error instanceof HistoryValidationError)
        expect(error.errors.map((item) => item.code)).toContain(code);
    }
    expect(search).not.toHaveBeenCalled();
  });

  it("returns an empty page for non-terminal state filters", async () => {
    const { service, search } = dependencies();
    const result = await service.execute(
      { page: 1, states: ["borrador", "evaluando"] },
      actor,
      crypto.randomUUID(),
    );
    expect(result.items).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
});
