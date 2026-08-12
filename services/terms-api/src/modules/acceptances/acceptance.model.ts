import { z } from 'zod';
import { SHA256_PATTERN } from '../versions/version.model.js';

export const acceptanceInputSchema = z.object({
  versionId: z.uuid(),
  contentSha256: z.string().regex(SHA256_PATTERN),
}).strict();

export const idempotencyKeySchema = z.uuid();

export interface Acceptance {
  readonly acceptanceId: string;
  readonly versionId: string;
  readonly versionCode: string;
  readonly acceptedAt: string;
  readonly contentSha256: string;
}

export type AcceptanceInput = z.infer<typeof acceptanceInputSchema>;
