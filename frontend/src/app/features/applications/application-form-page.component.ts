import {
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { colombianDocument } from '../../shared/forms/document.validator';
import { positiveMoney } from '../../shared/forms/money.validator';
import { months } from '../../shared/forms/months.validator';
import { AlertComponent } from '../../shared/ui/alert.component';
import { ApplicationApiService } from './application-api.service';
import type { ApplicationInput } from './application-form.model';
@Component({
  selector: 'app-application-form-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    AlertComponent,
  ],
  template: `
    <div class="form-page">
      <div class="page-header">
        <div>
          <h1 tabindex="-1">Nueva evaluación</h1>
          <p>
            Registre los datos declarados por el solicitante. Los campos con *
            son obligatorios.
          </p>
        </div>
        <span class="step">Solicitud nueva</span>
      </div>
      @if (error()) {
        <app-alert type="error" title="Revise la información"
          ><p>{{ error() }}</p></app-alert
        >
      }
      <form class="surface" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <section>
          <div class="section-heading">
            <span>1</span>
            <div>
              <h2>Identificación y contacto</h2>
              <p>Información básica para identificar al solicitante.</p>
            </div>
          </div>
          <div class="form-grid">
            <mat-form-field appearance="outline"
              ><mat-label>Tipo de documento</mat-label
              ><mat-select formControlName="documentType"
                ><mat-option value="CC">Cédula de ciudadanía</mat-option
                ><mat-option value="CE">Cédula de extranjería</mat-option
                ><mat-option value="PPT"
                  >Permiso temporal</mat-option
                ></mat-select
              ></mat-form-field
            >
            <mat-form-field appearance="outline"
              ><mat-label>Número de documento</mat-label
              ><input
                #firstField
                matInput
                formControlName="documentNumber"
                autocomplete="off"
              />
              @if (
                form.controls.documentNumber.invalid &&
                form.controls.documentNumber.touched
              ) {
                <mat-error>Use entre 5 y 20 letras o números.</mat-error>
              }
            </mat-form-field>
            <mat-form-field class="span-2" appearance="outline"
              ><mat-label>Nombre completo</mat-label
              ><input matInput formControlName="fullName" autocomplete="name"
            /></mat-form-field>
            <mat-form-field appearance="outline"
              ><mat-label>Teléfono</mat-label
              ><input
                matInput
                formControlName="phone"
                autocomplete="tel"
              /><mat-hint>Ejemplo: +57 300 123 4567</mat-hint></mat-form-field
            >
            <mat-form-field appearance="outline"
              ><mat-label>Correo electrónico</mat-label
              ><input
                matInput
                type="email"
                formControlName="email"
                autocomplete="email"
            /></mat-form-field>
          </div>
        </section>
        <section>
          <div class="section-heading">
            <span>2</span>
            <div>
              <h2>Ingresos estimados</h2>
              <p>Datos declarados sobre nivel y estabilidad de ingresos.</p>
            </div>
          </div>
          <div class="form-grid">
            <mat-form-field appearance="outline"
              ><mat-label>Ingreso mensual (COP)</mat-label
              ><input
                matInput
                type="number"
                formControlName="monthlyIncomeCop"
              /><span matTextPrefix>$&nbsp;</span></mat-form-field
            ><mat-form-field appearance="outline"
              ><mat-label>Fuente principal</mat-label
              ><mat-select formControlName="sourceType"
                ><mat-option value="employment">Empleo</mat-option
                ><mat-option value="self_employed">Independiente</mat-option
                ><mat-option value="pension">Pensión</mat-option
                ><mat-option value="other">Otra</mat-option></mat-select
              ></mat-form-field
            ><mat-form-field appearance="outline"
              ><mat-label>Estabilidad (meses)</mat-label
              ><input matInput type="number" formControlName="stabilityMonths"
            /></mat-form-field>
          </div>
        </section>
        <section>
          <div class="section-heading">
            <span>3</span>
            <div>
              <h2>Servicios públicos</h2>
              <p>Comportamiento observado en una referencia de servicio.</p>
            </div>
          </div>
          <div class="form-grid">
            <mat-form-field appearance="outline"
              ><mat-label>Tipo de servicio</mat-label
              ><mat-select formControlName="serviceType"
                ><mat-option value="electricity">Energía</mat-option
                ><mat-option value="water">Agua</mat-option
                ><mat-option value="gas">Gas</mat-option
                ><mat-option value="internet">Internet</mat-option></mat-select
              ></mat-form-field
            ><mat-form-field appearance="outline"
              ><mat-label>Promedio mensual (COP)</mat-label
              ><input
                matInput
                type="number"
                formControlName="utilityAmount" /></mat-form-field
            ><mat-form-field appearance="outline"
              ><mat-label>Meses observados</mat-label
              ><input
                matInput
                type="number"
                formControlName="utilityMonths" /></mat-form-field
            ><mat-form-field appearance="outline"
              ><mat-label>Pagos puntuales</mat-label
              ><input matInput type="number" formControlName="onTimeCount"
            /></mat-form-field>
          </div>
        </section>
        <section>
          <div class="section-heading">
            <span>4</span>
            <div>
              <h2>Telefonía móvil</h2>
              <p>Antigüedad y regularidad declaradas.</p>
            </div>
          </div>
          <div class="form-grid">
            <mat-form-field appearance="outline"
              ><mat-label>Modalidad</mat-label
              ><mat-select formControlName="mobileMode"
                ><mat-option value="postpaid">Pospago</mat-option
                ><mat-option value="prepaid">Prepago</mat-option></mat-select
              ></mat-form-field
            ><mat-form-field appearance="outline"
              ><mat-label>Antigüedad (meses)</mat-label
              ><input
                matInput
                type="number"
                formControlName="tenureMonths" /></mat-form-field
            ><mat-form-field appearance="outline"
              ><mat-label>Meses observados</mat-label
              ><input
                matInput
                type="number"
                formControlName="mobileObservedMonths" /></mat-form-field
            ><mat-form-field appearance="outline"
              ><mat-label>Meses regulares</mat-label
              ><input matInput type="number" formControlName="regularMonths"
            /></mat-form-field>
          </div>
        </section>
        <section class="consent">
          <mat-checkbox formControlName="consent"
            >Confirmo que el solicitante otorgó consentimiento para esta
            evaluación.</mat-checkbox
          >
          <p>
            El resultado es una recomendación operativa y no una aprobación
            crediticia definitiva.
          </p>
        </section>
        <div class="form-actions">
          <button mat-stroked-button type="button">Guardar borrador</button
          ><button
            mat-flat-button
            color="primary"
            type="submit"
            [disabled]="loading()"
          >
            <span class="button-slot">
              @if (loading()) {
                <mat-spinner diameter="20" />
              }
              {{ loading() ? 'Evaluando…' : 'Calcular score' }}</span
            >
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .form-page {
        max-width: 800px;
        margin: auto;
      }
      .step {
        padding: 6px 10px;
        background: var(--color-primary-soft);
        color: var(--color-primary);
        border-radius: 4px;
        font-weight: 500;
        font-size: 14px;
      }
      form {
        overflow: hidden;
      }
      section {
        padding: 28px 32px;
        border-bottom: 1px solid var(--color-border);
      }
      .section-heading {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
      }
      .section-heading > span {
        display: grid;
        place-items: center;
        flex: 0 0 28px;
        height: 28px;
        background: var(--color-primary);
        color: #fff;
        border-radius: 4px;
        font-weight: 700;
      }
      .section-heading p {
        margin: 2px 0 0;
        color: var(--color-text-muted);
      }
      mat-form-field {
        width: 100%;
      }
      .consent {
        background: var(--color-surface-subtle);
      }
      .consent p {
        margin: 8px 0 0 34px;
        color: var(--color-text-muted);
        font-size: 14px;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 20px 32px;
      }
      .button-slot {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-width: 112px;
      }
      @media (max-width: 599px) {
        section {
          padding: 24px 16px;
        }
        .form-actions {
          padding: 16px;
          flex-direction: column-reverse;
        }
        .form-actions button {
          width: 100%;
        }
      }
    `,
  ],
})
export class ApplicationFormPageComponent {
  private fb = inject(FormBuilder);
  private api = inject(ApplicationApiService);
  private router = inject(Router);
  first = viewChild<ElementRef<HTMLInputElement>>('firstField');
  loading = signal(false);
  error = signal('');
  form = this.fb.nonNullable.group({
    documentType: ['CC', Validators.required],
    documentNumber: ['', [Validators.required, colombianDocument]],
    fullName: ['', Validators.required],
    phone: [''],
    email: ['', Validators.email],
    monthlyIncomeCop: [
      null as number | null,
      [Validators.required, positiveMoney],
    ],
    sourceType: ['employment', Validators.required],
    stabilityMonths: [null as number | null, [Validators.required, months]],
    serviceType: ['electricity', Validators.required],
    utilityAmount: [
      null as number | null,
      [Validators.required, positiveMoney],
    ],
    utilityMonths: [
      12,
      [Validators.required, Validators.min(1), Validators.max(12)],
    ],
    onTimeCount: [
      null as number | null,
      [Validators.required, Validators.min(0), Validators.max(12)],
    ],
    mobileMode: ['postpaid', Validators.required],
    tenureMonths: [null as number | null, [Validators.required, months]],
    mobileObservedMonths: [
      12,
      [Validators.required, Validators.min(1), Validators.max(12)],
    ],
    regularMonths: [
      null as number | null,
      [Validators.required, Validators.min(0), Validators.max(12)],
    ],
    consent: [false, Validators.requiredTrue],
  });
  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(
        'Complete los campos obligatorios y corrija los valores señalados.',
      );
      this.first()?.nativeElement.focus();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const v = this.form.getRawValue(),
      today = new Date(),
      start = new Date(today.getFullYear() - 1, today.getMonth(), 1);
    const input: ApplicationInput = {
      applicant: {
        documentType: v.documentType,
        documentNumber: v.documentNumber,
        fullName: v.fullName,
        contact: { phone: v.phone || undefined, email: v.email || undefined },
      },
      consent: {
        decision: 'accepted',
        noticeVersion: 'CONSENT-MVP-1.0.0',
        purposeCode: 'ALTERNATIVE_CREDIT_RISK_EVALUATION',
      },
      alternativeData: {
        income: {
          availability: 'provided',
          monthlyIncomeCop: Number(v.monthlyIncomeCop).toFixed(2),
          sourceType: v.sourceType,
          stabilityMonths: Number(v.stabilityMonths),
        },
        utilities: {
          availability: 'provided',
          references: [
            {
              serviceType: v.serviceType,
              periodStart: start.toISOString().slice(0, 10),
              periodEnd: today.toISOString().slice(0, 10),
              observedMonths: v.utilityMonths,
              totalObligations: v.utilityMonths,
              onTimeCount: Number(v.onTimeCount),
              lateCount: v.utilityMonths - Number(v.onTimeCount),
              missedCount: 0,
              averageMonthlyAmountCop: Number(v.utilityAmount).toFixed(2),
            },
          ],
        },
        mobile: {
          availability: 'provided',
          mode: v.mobileMode,
          tenureMonths: Number(v.tenureMonths),
          observedMonths: v.mobileObservedMonths,
          regularMonths: Number(v.regularMonths),
        },
      },
    };
    try {
      const result = await this.api.createAndEvaluate(input);
      await this.router.navigate(['/evaluations', result.evaluationId], {
        state: { result },
      });
    } catch (e: any) {
      this.error.set(
        e?.error?.detail ||
          'No fue posible evaluar la solicitud. Sus datos permanecen en pantalla.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
