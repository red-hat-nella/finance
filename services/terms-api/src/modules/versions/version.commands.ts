import { z } from 'zod';
import { VERSION_CODE_PATTERN } from './version.model.js';

export const createVersionCommandSchema = z.object({
  versionCode: z.string().regex(VERSION_CODE_PATTERN),
  title: z.string().trim().min(1).max(200),
  contentFormat: z.literal('markdown'),
  content: z.string().min(1).max(524_288),
}).strict();

export const scheduleVersionCommandSchema = z.object({
  effectiveAt: z.iso.datetime(),
}).strict();

export const versionIdSchema = z.uuid();
export type CreateVersionCommand = z.infer<typeof createVersionCommandSchema>;
export type ScheduleVersionCommand = z.infer<typeof scheduleVersionCommandSchema>;
