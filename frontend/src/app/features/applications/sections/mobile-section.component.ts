import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { UnavailabilityControlsComponent } from '../unavailability-controls.component';
import { FORM_STEP_STYLES } from './form-step.styles';

@Component({
  selector: 'app-mobile-section',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, UnavailabilityControlsComponent],
  template: `
    <fieldset [formGroup]="form">
      <legend><span>5</span><strong>Telefonía móvil</strong></legend>
      <p>Antigüedad y regularidad declaradas.</p>
      <app-unavailability-controls
        [form]="form"
        toggleControlName="mobileUnavailable"
        reasonControlName="mobileUnavailableReason"
        dimensionLabel="información de telefonía móvil"
      />
      <div class="form-grid" [class.unavailable]="form.controls['mobileUnavailable'].value">
        <mat-form-field appearance="outline">
          <mat-label>Modalidad</mat-label>
          <mat-select id="mobileMode" formControlName="mobileMode">
            <mat-option value="postpaid">Pospago</mat-option>
            <mat-option value="prepaid">Prepago</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Antigüedad (meses)</mat-label>
          <input id="tenureMonths" matInput type="number" formControlName="tenureMonths" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Meses observados</mat-label>
          <input id="mobileObservedMonths" matInput type="number" formControlName="mobileObservedMonths" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Meses regulares</mat-label>
          <input id="regularMonths" matInput type="number" formControlName="regularMonths" />
        </mat-form-field>
      </div>
    </fieldset>
  `,
  styles: [FORM_STEP_STYLES],
})
export class MobileSectionComponent {
  @Input({ required: true }) form!: FormGroup;
}
