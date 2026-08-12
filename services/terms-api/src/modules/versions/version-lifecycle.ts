import { ProblemError } from '../../http/problem.js';
import type { TermsVersion } from './version.model.js';

export function assertSchedulable(version: TermsVersion, effectiveAt: Date, now: Date): void {
  if (version.state !== 'DRAFT') throw transition('Solo un borrador puede programarse.');
  if (effectiveAt.getTime() <= now.getTime()) throw transition('La vigencia debe ser futura.');
}

export function assertWithdrawable(version: TermsVersion, now: Date): void {
  if (!['DRAFT', 'SCHEDULED'].includes(version.state)) {
    throw transition('Una versión publicada o histórica no puede retirarse.');
  }
  if (version.effectiveAt && new Date(version.effectiveAt).getTime() <= now.getTime()) {
    throw transition('Una versión cuya vigencia comenzó no puede retirarse.');
  }
}

function transition(detail: string): ProblemError {
  return new ProblemError({ status: 409, title: 'Transición incompatible', detail, code: 'VERSION_TRANSITION_CONFLICT' });
}
