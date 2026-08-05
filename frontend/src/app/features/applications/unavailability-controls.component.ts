import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-unavailability-controls',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="availability" [formGroup]="form">
      <mat-checkbox [formControlName]="toggleControlName">
        No se dispone de {{ dimensionLabel }}
      </mat-checkbox>
      @if (form.get(toggleControlName)?.value) {
        <mat-form-field appearance="outline">
          <mat-label>Motivo de no disponibilidad</mat-label>
          <textarea
            matInput
            rows="2"
            [id]="reasonControlName"
            [formControlName]="reasonControlName"
            maxlength="240"
          ></textarea>
          <mat-hint>Explique el motivo en al menos 10 caracteres.</mat-hint>
          @if (form.get(reasonControlName)?.touched && form.get(reasonControlName)?.invalid) {
            <mat-error>Ingrese un motivo claro de al menos 10 caracteres.</mat-error>
          }
        </mat-form-field>
      }
    </div>
  `,
  styles: [
    `
      .availability {
        display: grid;
        gap: 12px;
        margin-bottom: 20px;
      }
      mat-form-field {
        width: 100%;
      }
    `,
  ],
})
export class UnavailabilityControlsComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) toggleControlName!: string;
  @Input({ required: true }) reasonControlName!: string;
  @Input({ required: true }) dimensionLabel!: string;
}
