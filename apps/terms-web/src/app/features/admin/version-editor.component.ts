import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TermsDocumentComponent } from '../acceptance/terms-document.component';
import { VersionAdminFacade } from './version-admin.facade';

@Component({
  selector: 'terms-version-editor',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TermsDocumentComponent],
  template: `
    <div class="page-header">
      <div><h1 tabindex="-1">Crear versión</h1><p>Guarda un borrador antes de programar su publicación.</p></div>
      <a routerLink="/versions">Volver a versiones</a>
    </div>
    <form class="surface" novalidate>
      @if (validationError()) { <p class="message error" role="alert">Revisa los campos indicados antes de guardar.</p> }
      <label for="version-code">Identificador de versión</label>
      <input id="version-code" [formControl]="form.controls.versionCode" autocomplete="off" aria-describedby="version-code-help">
      <small id="version-code-help">Mayúsculas, números, punto, guion o guion bajo; máximo 64 caracteres.</small>
      @if (showFieldError('versionCode')) { <p class="field-error">Usa un identificador válido, por ejemplo TERMS-2026-02.</p> }

      <label for="version-title">Título</label>
      <input id="version-title" [formControl]="form.controls.title" autocomplete="off">
      @if (showFieldError('title')) { <p class="field-error">El título es obligatorio y admite hasta 200 caracteres.</p> }

      <label for="version-content">Contenido Markdown</label>
      <textarea id="version-content" [formControl]="form.controls.content" rows="14" aria-describedby="content-help"></textarea>
      <small id="content-help">El contenido se muestra como texto seguro; HTML no se ejecuta.</small>
      @if (showFieldError('content')) { <p class="field-error">El contenido es obligatorio y admite hasta 524288 caracteres.</p> }

      <div class="actions">
        <button type="button" class="secondary" (click)="showPreview.set(!showPreview())">{{ showPreview() ? 'Ocultar vista previa' : 'Vista previa' }}</button>
        <button type="button" class="primary" [disabled]="facade.state().kind === 'saving'" (click)="save()">Guardar borrador</button>
      </div>
    </form>

    @if (showPreview() && previewVersion()) {
      <section class="preview" aria-label="Vista previa no publicada">
        <terms-document [version]="previewVersion()!" eyebrow="Vista previa no publicada" />
      </section>
    }
  `,
  styles: [`
    :host { display: block; max-width: 900px; margin-inline: auto; }
    form { display: grid; gap: 8px; padding: 32px; }
    label { margin-top: 12px; font-weight: 500; }
    input, textarea { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--color-border-strong); border-radius: var(--radius-control); color: var(--color-text); background: var(--color-surface); }
    textarea { resize: vertical; }
    small { color: var(--color-text-muted); }
    .field-error, .message.error { margin: 0; color: var(--color-danger-text); }
    .actions { margin-top: 24px; }
    button, a { min-height: 44px; }
    button { padding-inline: 20px; border-radius: var(--radius-control); cursor: pointer; font-weight: 500; }
    .primary { border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-on-primary); }
    .secondary { border: 1px solid var(--color-border-strong); background: var(--color-surface); color: var(--color-primary); }
    button:disabled { cursor: not-allowed; background: var(--color-disabled-bg); color: var(--color-disabled-text); }
    .preview { margin-top: 32px; }
    @media (max-width: 599px) { form { padding: 24px 16px; } .actions button { width: 100%; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersionEditorComponent {
  readonly facade = inject(VersionAdminFacade);
  private readonly router = inject(Router);
  readonly validationError = signal(false);
  readonly showPreview = signal(false);
  readonly form = new FormGroup({
    versionCode: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[A-Z0-9][A-Z0-9._-]{0,63}$/)] }),
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    content: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(524288)] }),
  });
  previewVersion() {
    const raw = this.form.getRawValue();
    if (!raw.title.trim() || !raw.content.trim()) return null;
    return {
      versionId: '00000000-0000-4000-8000-000000000000', versionCode: raw.versionCode || 'BORRADOR',
      title: raw.title, contentSha256: '0'.repeat(64), state: 'DRAFT' as const,
      effectiveAt: null, publishedAt: null, contentFormat: 'markdown' as const, content: raw.content,
    };
  }

  showFieldError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.validationError());
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    this.validationError.set(this.form.invalid);
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const version = await this.facade.createDraft({
      versionCode: raw.versionCode, title: raw.title.trim(), contentFormat: 'markdown', content: raw.content,
    });
    if (version) await this.router.navigate(['/versions', version.versionId]);
  }
}
