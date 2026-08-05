import { Component, ElementRef, Input, viewChild } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FORM_STEP_STYLES } from './form-step.styles';

@Component({
  selector: 'app-identity-section',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `<fieldset [formGroup]="form">
    <legend><span>1</span><strong>Identificación</strong></legend>
    <p>Datos básicos para identificar al solicitante.</p>
    <div class="form-grid">
      <mat-form-field appearance="outline">
        <mat-label>Tipo de documento</mat-label>
        <mat-select id="documentType" formControlName="documentType">
          <mat-option value="CC">Cédula de ciudadanía</mat-option>
          <mat-option value="CE">Cédula de extranjería</mat-option>
          <mat-option value="PPT">Permiso temporal</mat-option>
          <mat-option value="PASSPORT">Pasaporte</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Número de documento</mat-label>
        <input id="documentNumber" #firstField matInput formControlName="documentNumber" autocomplete="off" />
        @if (form.controls['documentNumber'].invalid && form.controls['documentNumber'].touched) {
          <mat-error>Use entre 5 y 20 letras o números.</mat-error>
        }
      </mat-form-field>
      <mat-form-field class="span-2" appearance="outline">
        <mat-label>Nombre completo</mat-label>
        <input id="fullName" matInput formControlName="fullName" autocomplete="name" />
        @if (form.controls['fullName'].invalid && form.controls['fullName'].touched) {
          <mat-error>Ingrese el nombre completo.</mat-error>
        }
      </mat-form-field>
    </div>
  </fieldset>`,
  styles: [FORM_STEP_STYLES],
})
export class IdentitySectionComponent {
  @Input({ required: true }) form!: FormGroup;
  private readonly firstField = viewChild<ElementRef<HTMLInputElement>>('firstField');
  firstElement(): ElementRef<HTMLInputElement> | undefined {
    return this.firstField();
  }
}
