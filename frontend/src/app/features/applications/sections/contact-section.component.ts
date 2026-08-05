import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FORM_STEP_STYLES } from './form-step.styles';

@Component({
  selector: 'app-contact-section',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `<fieldset [formGroup]="form">
    <legend><span>2</span><strong>Contacto</strong></legend>
    <p>Registre al menos un medio de contacto válido.</p>
    <div class="form-grid">
      <mat-form-field appearance="outline">
        <mat-label>Teléfono</mat-label>
        <input id="phone" matInput formControlName="phone" autocomplete="tel" />
        <mat-hint>Ejemplo: +57 300 123 4567</mat-hint>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Correo electrónico</mat-label>
        <input id="email" matInput type="email" formControlName="email" autocomplete="email" />
        @if (form.controls['email'].invalid && form.controls['email'].touched) {
          <mat-error>Ingrese un correo electrónico válido.</mat-error>
        }
      </mat-form-field>
      @if (form.hasError('contact') && (form.controls['phone'].touched || form.controls['email'].touched)) {
        <p class="field-error span-2" role="alert">Ingrese un teléfono o correo electrónico válido.</p>
      }
    </div>
  </fieldset>`,
  styles: [
    FORM_STEP_STYLES,
    `.field-error{color:var(--color-danger);margin:-16px 0 4px;font-size:14px}`,
  ],
})
export class ContactSectionComponent {
  @Input({ required: true }) form!: FormGroup;
}
