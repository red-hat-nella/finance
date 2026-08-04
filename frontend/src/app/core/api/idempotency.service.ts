import { Injectable } from '@angular/core';
@Injectable({ providedIn: 'root' }) export class IdempotencyService {
  private keys = new Map<string,string>();
  forAction(action: string): string { const current = this.keys.get(action) ?? crypto.randomUUID(); this.keys.set(action,current); return current; }
  complete(action: string): void { this.keys.delete(action); }
}
