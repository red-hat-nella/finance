import type pg from "pg";
import type { ApplicationDraftInput } from "../../domain/applications/application.js";
import type { ActorContext } from "../../domain/authorization/policies.js";
import type {
  ApplicationRepository,
  StoredApplication,
} from "./application.repository.js";

export class CreateRevisionService {
  constructor(private readonly repository: ApplicationRepository) {}

  async execute(
    db: Pick<pg.PoolClient, "query">,
    actor: ActorContext,
    current: StoredApplication,
    input: ApplicationDraftInput,
  ): Promise<StoredApplication> {
    const expiresAt = new Date(Date.now() + 90 * 86_400_000);
    const revision = await this.repository.createRevision(
      db,
      actor,
      current,
      input,
      expiresAt,
    );
    if (!revision)
      throw new Error("Application changed while creating a correction revision.");
    return revision;
  }
}
