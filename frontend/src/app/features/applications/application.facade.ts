import { Injectable, computed, signal } from '@angular/core';
import {
  ApplicationApiService,
  VersionedApplication,
} from './application-api.service';
import {
  ApplicationDraftInput,
  ApplicationInput,
} from './application-form.model';

@Injectable()
export class ApplicationFacade {
  private readonly currentState = signal<VersionedApplication | null>(null);
  private readonly savingState = signal(false);
  private readonly evaluatingState = signal(false);

  readonly current = this.currentState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly evaluating = this.evaluatingState.asReadonly();
  readonly busy = computed(() => this.savingState() || this.evaluatingState());

  constructor(private readonly api: ApplicationApiService) {}

  async load(applicationId: string): Promise<VersionedApplication> {
    const loaded = await this.api.get(applicationId);
    this.currentState.set(loaded);
    return loaded;
  }

  async save(input: ApplicationDraftInput): Promise<VersionedApplication> {
    if (this.savingState() || this.evaluatingState())
      throw new Error('Ya existe una operación en curso.');
    this.savingState.set(true);
    try {
      const current = this.currentState();
      const saved = current
        ? await this.api.update(
            current.resource.applicationId,
            input,
            current.etag,
          )
        : await this.api.create(input);
      this.currentState.set(saved);
      return saved;
    } finally {
      this.savingState.set(false);
    }
  }

  async evaluate(input: ApplicationInput): Promise<unknown> {
    if (this.evaluatingState() || this.savingState())
      throw new Error('Ya existe una operación en curso.');
    this.evaluatingState.set(true);
    try {
      const current = this.currentState();
      const saved = current
        ? await this.api.update(
            current.resource.applicationId,
            input,
            current.etag,
          )
        : await this.api.create(input);
      this.currentState.set(saved);
      return await this.api.evaluate(saved);
    } finally {
      this.evaluatingState.set(false);
    }
  }
}
