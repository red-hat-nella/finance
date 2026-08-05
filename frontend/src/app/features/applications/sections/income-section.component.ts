import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { UnavailabilityControlsComponent } from '../unavailability-controls.component';
import { FORM_STEP_STYLES } from './form-step.styles';

@Component({
  selector: 'app-income-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    UnavailabilityControlsComponent,
  ],
  template: `
    <fieldset [formGroup]="form">
      <legend><span>3</span><strong>Ingresos estimados</strong></legend>
      <p>Datos declarados sobre nivel y estabilidad de ingresos.</p>
      <app-unavailability-controls
        [form]="form"
        toggleControlName="incomeUnavailable"
        reasonControlName="incomeUnavailableReason"
        dimensionLabel="información de ingresos"
      />
      <div class="form-grid" [class.unavailable]="form.controls['incomeUnavailable'].value">
        <mat-form-field appearance="outline">
          <mat-label>Ingreso mensual (COP)</mat-label>
          <input id="monthlyIncomeCop" matInput type="number" formControlName="monthlyIncomeCop" />
          <span matTextPrefix>$&nbsp;</span>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Fuente principal</mat-label>
          <mat-select id="sourceType" formControlName="sourceType">
            <mat-option value="employment">Empleo</mat-option>
            <mat-option value="self_employed">Independiente</mat-option>
            <mat-option value="pension">Pensión</mat-option>
            <mat-option value="other">Otra</mat-option>
          </mat-select>
        </mat-form-field>
        @if (form.controls['sourceType'].value === 'other') {
          <mat-form-field appearance="outline">
            <mat-label>Descripción de la fuente</mat-label>
            <input id="sourceOtherDescription" matInput formControlName="sourceOtherDescription" />
            @if (form.hasError('sourceOtherDescription') && form.controls['sourceOtherDescription'].touched) {
              <mat-error>Describa la fuente principal de ingresos.</mat-error>
            }
          </mat-form-field>
        }
        <mat-form-field appearance="outline">
          <mat-label>Estabilidad (meses)</mat-label>
          <input id="stabilityMonths" matInput type="number" formControlName="stabilityMonths" />
        </mat-form-field>
      </div>
    </fieldset>
  `,
  styles: [FORM_STEP_STYLES],
})
export class IncomeSectionComponent {
  @Input({ required: true }) form!: FormGroup;
}
