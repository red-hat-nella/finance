import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type {
  DocumentType,
  HistorySearchInput,
  HistoryState,
} from './history.models';

function validDateRange(control: AbstractControl): ValidationErrors | null {
  const from = String(control.get('dateFrom')?.value ?? '');
  const to = String(control.get('dateTo')?.value ?? '');
  return from && to && from > to ? { dateRange: true } : null;
}

function validStates(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  const allowed = new Set(['evaluada', 'revision_manual', 'error']);
  return Array.isArray(value) &&
    value.every((state) => allowed.has(String(state)))
    ? null
    : { states: true };
}

function trimmedPattern(pattern: RegExp) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    return !value || pattern.test(value) ? null : { pattern: true };
  };
}

@Component({
  selector: 'app-history-filters',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <form class="filters surface" [formGroup]="form" (ngSubmit)="apply()">
      <mat-form-field appearance="outline">
        <mat-label>ID de evaluación</mat-label>
        <input matInput formControlName="evaluationId" autocomplete="off" />
        @if (form.controls.evaluationId.invalid) {
          <mat-error>Ingresa un identificador UUID válido</mat-error>
        }
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Tipo de documento</mat-label>
        <mat-select formControlName="documentType">
          <mat-option value="CC">Cédula</mat-option>
          <mat-option value="CE">Cédula de extranjería</mat-option>
          <mat-option value="PPT">PPT</mat-option>
          <mat-option value="PASSPORT">Pasaporte</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Documento exacto</mat-label>
        <input matInput formControlName="documentNumber" autocomplete="off" />
        @if (form.controls.documentNumber.invalid) {
          <mat-error>Ingresa un documento alfanumérico válido</mat-error>
        }
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Desde</mat-label>
        <input matInput type="date" formControlName="dateFrom" [max]="today" />
      </mat-form-field>
      <div class="date-to-field">
        <mat-form-field appearance="outline">
          <mat-label>Hasta</mat-label>
          <input
            matInput
            type="date"
            formControlName="dateTo"
            [max]="today"
            [attr.aria-describedby]="
              form.hasError('dateRange') ? 'date-range-error' : null
            "
            [attr.aria-invalid]="form.hasError('dateRange')"
          />
        </mat-form-field>
        @if (form.hasError('dateRange')) {
          <p class="date-range-error" id="date-range-error" role="alert">
            La fecha inicial no puede ser posterior a la final
          </p>
        }
      </div>
      <mat-form-field appearance="outline">
        <mat-label>Estado</mat-label>
        <mat-select formControlName="states" multiple>
          <mat-option value="evaluada">Evaluada</mat-option>
          <mat-option value="revision_manual">Revisión manual</mat-option>
          <mat-option value="error">Error</mat-option>
        </mat-select>
        @if (form.controls.states.invalid) {
          <mat-error>Selecciona un estado válido</mat-error>
        }
      </mat-form-field>
      <div class="filter-actions">
        <button mat-button type="button" (click)="clear()">Limpiar</button>
        <button mat-flat-button color="primary" type="submit">
          Aplicar filtros
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .filters {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-4);
        align-items: start;
        padding: var(--space-6);
        margin-bottom: var(--space-6);
      }
      .filter-actions {
        grid-column: 1 / -1;
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        min-height: 44px;
      }
      .date-to-field,
      .date-to-field mat-form-field {
        min-width: 0;
        width: 100%;
      }
      .date-range-error {
        margin: calc(var(--space-4) * -1) var(--space-4) 0;
        color: var(--color-danger);
        font-size: 0.75rem;
        line-height: 1.4;
      }
      @media (max-width: 959px) {
        .filters {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 599px) {
        .filters {
          grid-template-columns: minmax(0, 1fr);
          padding: var(--space-4);
        }
        .filter-actions button {
          flex: 1 1 0;
          min-width: 0;
        }
      }
    `,
  ],
})
export class HistoryFiltersComponent {
  @Output() filtersApplied = new EventEmitter<HistorySearchInput>();
  @Output() filtersCleared = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  readonly form = this.fb.nonNullable.group(
    {
      evaluationId: [
        '',
        trimmedPattern(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      ],
      documentType: 'CC' as DocumentType,
      documentNumber: ['', trimmedPattern(/^[A-Za-z0-9]{3,20}$/)],
      dateFrom: '',
      dateTo: '',
      states: [[] as HistoryState[], validStates],
    },
    { validators: [validDateRange] },
  );

  @Input() set initialFilters(filters: HistorySearchInput) {
    this.form.reset(
      {
        evaluationId: filters.evaluationId ?? '',
        documentType: filters.applicantIdentifier?.documentType ?? 'CC',
        documentNumber: filters.applicantIdentifier?.documentNumber ?? '',
        dateFrom: filters.dateFrom ?? '',
        dateTo: filters.dateTo ?? '',
        states: [...(filters.states ?? [])],
      },
      { emitEvent: false },
    );
  }

  apply(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      queueMicrotask(() =>
        this.element.nativeElement
          .querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    const value = this.form.getRawValue();
    const evaluationId = value.evaluationId.trim();
    const documentNumber = value.documentNumber.trim().toUpperCase();
    this.filtersApplied.emit({
      page: 1,
      ...(evaluationId ? { evaluationId } : {}),
      ...(documentNumber
        ? {
            applicantIdentifier: {
              documentType: value.documentType,
              documentNumber,
            },
          }
        : {}),
      ...(value.dateFrom ? { dateFrom: value.dateFrom } : {}),
      ...(value.dateTo ? { dateTo: value.dateTo } : {}),
      ...(value.states.length ? { states: value.states } : {}),
    });
  }

  clear(): void {
    this.form.reset({
      evaluationId: '',
      documentType: 'CC',
      documentNumber: '',
      dateFrom: '',
      dateTo: '',
      states: [],
    });
    this.filtersCleared.emit();
  }
}
