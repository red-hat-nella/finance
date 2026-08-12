import { createHash } from 'node:crypto';
import { sanitizeMarkdown } from './content-sanitizer.js';

export function canonicalContent(source: string): string {
  return sanitizeMarkdown(source);
}

export function contentDigest(source: string): string {
  return createHash('sha256').update(canonicalContent(source), 'utf8').digest('hex');
}
