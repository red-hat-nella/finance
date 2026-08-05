import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { UnavailabilityControlsComponent } from '../unavailability-controls.component';
import { FORM_STEP_STYLES } from './form-step.styles';

@Component({
  selector: 'app-utilities-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    UnavailabilityControlsComponent,
  ],
  template: `
    <fieldset>
      <legend><span>4</span><strong>Servicios públicos</strong></legend>
      <p>Agregue entre una y tres referencias declaradas.</p>
      <app-unavailability-controls
        [form]="form"
        toggleControlName="utilitiesUnavailable"
        reasonControlName="utilitiesUnavailableReason"
        dimensionLabel="referencias de servicios públicos"
      />
      <div
        [formGroup]="form"
        [class.unavailable]="form.controls['utilitiesUnavailable'].value"
      >
        <div formArrayName="utilityReferences">
          @for (reference of references.controls; track $index; let index = $index) {
            <section [formGroupName]="index">
              <div class="reference-heading">
                <h3>Referencia {{ index + 1 }}</h3>
                @if (references.length > 1) {
                  <button
                    mat-icon-button
                    type="button"
                    (click)="remove(index)"
                    [attr.aria-label]="'Eliminar referencia ' + (index + 1)"
                  >
                    <mat-icon aria-hidden="true">delete</mat-icon>
                  </button>
                }
              </div>
              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Tipo de servicio</mat-label>
                  <mat-select
                    [id]="'serviceType-' + index"
                    formControlName="serviceType"
                  >
                    <mat-option value="electricity">Energía</mat-option>
                    <mat-option value="water">Agua</mat-option>
                    <mat-option value="gas">Gas</mat-option>
                    <mat-option value="internet">Internet</mat-option>
                    <mat-option value="other">Otro</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Promedio mensual (COP)</mat-label>
                  <input
                    [id]="index === 0 ? 'utilityAmount' : 'utilityAmount-' + index"
                    matInput
                    type="number"
                    formControlName="utilityAmount"
                  />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Meses observados</mat-label>
                  <input
                    [id]="'utilityMonths-' + index"
                    matInput
                    type="number"
                    formControlName="utilityMonths"
                  />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Pagos puntuales</mat-label>
                  <input
                    [id]="'onTimeCount-' + index"
                    matInput
                    type="number"
                    formControlName="onTimeCount"
                  />
                </mat-form-field>
              </div>
            </section>
          }
        </div>
      </div>
      @if (
        references.length < 3 && !form.controls['utilitiesUnavailable'].value
      ) {
        <button mat-stroked-button type="button" (click)="add.emit()">
          Agregar referencia
        </button>
      }
    </fieldset>
  `,
  styles: [
    FORM_STEP_STYLES,
    `
      section {
        padding: var(--space-4) 0;
        border-top: 1px solid var(--color-border);
      }
      .reference-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 48px;
      }
      .reference-heading h3 {
        font-size: 18px;
      }
    `,
  ],
})
export class UtilitiesSectionComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) references!: FormArray;
  @Output() add = new EventEmitter<void>();

  remove(index: number): void {
    this.references.removeAt(index);
  }
}
