import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

const DEFAULT_DESTINATION = '/applications/new';
const ALLOWED_PATH = /^\/(?:applications(?:\/new)?|evaluations(?:\/[A-Za-z0-9-]+)?)\/?$/;

export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_DESTINATION;
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.origin !== window.location.origin || !ALLOWED_PATH.test(parsed.pathname)) {
      return DEFAULT_DESTINATION;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_DESTINATION;
  }
}

@Injectable({ providedIn: 'root' })
export class ReturnUrlService {
  constructor(private readonly route: ActivatedRoute) {}

  destination(): string {
    return safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  continue(): void {
    window.location.assign(this.destination());
  }
}
