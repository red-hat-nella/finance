import { Component, ElementRef, Input, viewChild } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FORM_STEP_STYLES } from './form-step.styles';

@Component({
  selector: 'app-consent-section',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatCheckboxModule],
  template: `<fieldset [formGroup]="form">
    <legend><span>6</span><strong>Consentimiento</strong></legend>
    <mat-checkbox id="consent" formControlName="consent">Confirmo que el solicitante otorgó consentimiento para esta evaluación.</mat-checkbox>
    <p>El resultado es una recomendación operativa y no una aprobación crediticia definitiva.</p>
    <button mat-button type="button" (click)="openNotice()">Ver aviso de consentimiento</button>
  </fieldset>
  <dialog #notice aria-labelledby="consent-title">
    <h2 id="consent-title">Aviso de consentimiento</h2>
    <p>Los datos declarados se usarán exclusivamente para apoyar la evaluación de riesgo crediticio alternativo.</p>
    <p>El solicitante puede negar o revocar su consentimiento antes de una nueva evaluación.</p>
    <button mat-stroked-button type="button" (click)="closeNotice()">Cerrar</button>
  </dialog>`,
  styles: [
    FORM_STEP_STYLES,
    `
      :host {
        background: var(--color-surface-subtle);
      }
      fieldset > p {
        margin: var(--space-2) 0 0 40px;
        font-size: 14px;
      }
      fieldset > button {
        margin: var(--space-2) 0 0 32px;
      }
      dialog {
        max-width: min(520px, calc(100vw - 32px));
        border: 1px solid var(--color-border);
        border-radius: var(--radius-surface);
        padding: var(--space-6);
        color: var(--color-text);
      }
      dialog::backdrop {
        background: rgb(23 33 31 / 0.55);
      }
      dialog button {
        display: block;
        margin-left: auto;
      }
    `,
  ],
})
export class ConsentSectionComponent {
  @Input({ required: true }) form!: FormGroup;
  private readonly notice = viewChild<ElementRef<HTMLDialogElement>>('notice');
  openNotice(): void { this.notice()?.nativeElement.showModal(); }
  closeNotice(): void { this.notice()?.nativeElement.close(); }
}
