import { z } from 'zod';

export const VERSION_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export const termsVersionSchema = z.object({
  versionId: z.uuid(),
  versionCode: z.string().regex(VERSION_CODE_PATTERN),
  title: z.string().trim().min(1).max(200),
  contentFormat: z.literal('markdown'),
  content: z.string().min(1).max(524_288),
  contentSha256: z.string().regex(SHA256_PATTERN),
  state: z.enum(['DRAFT', 'SCHEDULED', 'EFFECTIVE', 'SUPERSEDED', 'WITHDRAWN']),
  effectiveAt: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(),
});

export type TermsVersion = z.infer<typeof termsVersionSchema>;
