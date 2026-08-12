import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { VERSION_CODE_PATTERN } from '../versions/version.model.js';

export const acceptanceSearchSchema = z.object({
  actorPublicId: z.string().trim().min(1).max(128).optional(),
  versionCode: z.string().regex(VERSION_CODE_PATTERN).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  cursor: z.string().min(1).max(512).optional(),
  limit: z.number().int().min(1).max(100).default(25),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && Date.parse(value.from) > Date.parse(value.to)) {
    context.addIssue({ code: 'custom', path: ['to'], message: 'to must not precede from' });
  }
});

export type AcceptanceSearch = z.infer<typeof acceptanceSearchSchema>;
export interface AcceptanceCursor { readonly acceptedAt: string; readonly acceptanceId: string }

export function encodeCursor(cursor: AcceptanceCursor, key: string): string {
  const payload = Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  const signature = createHmac('sha256', key).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function decodeCursor(value: string, key: string): AcceptanceCursor {
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) throw new Error('invalid cursor structure');
  const expected = createHmac('sha256', key).update(payload).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { throw new Error('invalid cursor signature'); }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error('invalid cursor signature');
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch { throw new Error('invalid cursor payload'); }
  return z.object({ acceptedAt: z.iso.datetime(), acceptanceId: z.uuid() }).strict().parse(parsed);
}

export function actorFingerprint(actorPublicId: string, key: string): string {
  return createHmac('sha256', key).update(actorPublicId.normalize('NFC'), 'utf8').digest('hex');
}
