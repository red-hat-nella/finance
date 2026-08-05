import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { colombianDocument } from '../../shared/forms/document.validator';
import { atLeastOneContact } from '../../shared/forms/contact.validator';
import { positiveMoney } from '../../shared/forms/money.validator';
import { months } from '../../shared/forms/months.validator';
import { AlertComponent } from '../../shared/ui/alert.component';
import { ConsentSectionComponent } from './sections/consent-section.component';
import { ContactSectionComponent } from './sections/contact-section.component';
import { IdentitySectionComponent } from './sections/identity-section.component';
import { IncomeSectionComponent } from './sections/income-section.component';
import { MobileSectionComponent } from './sections/mobile-section.component';
import { UtilitiesSectionComponent } from './sections/utilities-section.component';
import { ReviewSectionComponent } from './sections/review-section.component';
import {
  ErrorSummaryComponent,
  FormErrorItem,
} from './error-summary.component';
import { ApplicationFacade } from './application.facade';
import {
  toApplicationDraft,
  toApplicationFormValue,
  toEvaluationInput,
} from './application.mapper';
import type {
  DocumentType,
  IncomeSource,
  MobileMode,
  ServiceType,
} from './application-form.model';

function otherIncomeSource(control: AbstractControl): ValidationErrors | null {
  const value = control.value as {
    sourceType?: string;
    sourceOtherDescription?: string;
  };
  return value.sourceType === 'other' && !value.sourceOtherDescription?.trim()
    ? { sourceOtherDescription: true }
    : null;
}
@Component({
  selector: 'app-application-form-page',
  standalone: true,
  providers: [ApplicationFacade],
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    IdentitySectionComponent,
    ContactSectionComponent,
    ConsentSectionComponent,
    IncomeSectionComponent,
    UtilitiesSectionComponent,
    MobileSectionComponent,
    ReviewSectionComponent,
    ErrorSummaryComponent,
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
      <app-error-summary [items]="errorItems()" (focusControl)="focusControl($event)" />
      @if (error() && !errorItems().length) {
        <app-alert type="error" title="No fue posible continuar"><p>{{ error() }}</p></app-alert>
      }
      @if (saved()) {
        <app-alert type="success" title="Borrador guardado"
          ><p>La solicitud quedó guardada y puede continuar editándola.</p></app-alert
        >
      }
      <form class="surface" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-identity-section [form]="form" />
        <app-contact-section [form]="form" />
        <app-income-section [form]="form" />
        <app-utilities-section
          [form]="form"
          [references]="form.controls.utilityReferences"
          (add)="addUtilityReference()"
        />
        <app-mobile-section [form]="form" />
        <app-consent-section [form]="form" />
        <app-review-section
          [saving]="facade.saving()"
          [evaluating]="facade.evaluating()"
          [busy]="facade.busy()"
          (save)="saveDraft()"
        />
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
    `,
  ],
})
export class ApplicationFormPageComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private destroyRef = inject(DestroyRef);
  readonly facade = inject(ApplicationFacade);
  private readonly identitySection = viewChild(IdentitySectionComponent);
  first = () => this.identitySection()?.firstElement();
  error = signal('');
  errorItems = signal<readonly FormErrorItem[]>([]);
  saved = signal(false);
  form = this.fb.nonNullable.group(
    {
      documentType: ['CC' as DocumentType, Validators.required],
      documentNumber: ['', [Validators.required, colombianDocument]],
      fullName: ['', Validators.required],
      phone: [''],
      email: ['', Validators.email],
      monthlyIncomeCop: [
        null as number | null,
        [Validators.required, positiveMoney],
      ],
      incomeUnavailable: [false],
      incomeUnavailableReason: [''],
      sourceType: ['employment' as IncomeSource, Validators.required],
      sourceOtherDescription: [''],
      stabilityMonths: [null as number | null, [Validators.required, months]],
      utilityReferences: this.fb.array([this.createUtilityReference()]),
      utilitiesUnavailable: [false],
      utilitiesUnavailableReason: [''],
      mobileMode: ['postpaid' as MobileMode, Validators.required],
      tenureMonths: [null as number | null, [Validators.required, months]],
      mobileObservedMonths: [
        12,
        [Validators.required, Validators.min(1), Validators.max(12)],
      ],
      regularMonths: [
        null as number | null,
        [Validators.required, Validators.min(0), Validators.max(12)],
      ],
      mobileUnavailable: [false],
      mobileUnavailableReason: [''],
      consent: [false, Validators.requiredTrue],
    },
    { validators: [atLeastOneContact, otherIncomeSource] },
  );

  constructor() {
    this.bindAvailability(
      'incomeUnavailable',
      'incomeUnavailableReason',
      ['monthlyIncomeCop', 'sourceType', 'sourceOtherDescription', 'stabilityMonths'],
    );
    this.bindAvailability(
      'utilitiesUnavailable',
      'utilitiesUnavailableReason',
      ['utilityReferences'],
    );
    this.bindAvailability(
      'mobileUnavailable',
      'mobileUnavailableReason',
      ['mobileMode', 'tenureMonths', 'mobileObservedMonths', 'regularMonths'],
    );
    void this.loadCorrection();
  }
  addUtilityReference(): void {
    if (this.form.controls.utilityReferences.length < 3)
      this.form.controls.utilityReferences.push(this.createUtilityReference());
  }

  private createUtilityReference() {
    return this.fb.nonNullable.group({
      serviceType: ['electricity' as ServiceType, Validators.required],
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
    });
  }
  async saveDraft() {
    const value = this.form.getRawValue();
    if (
      this.form.controls.documentNumber.invalid ||
      this.form.controls.fullName.invalid ||
      (!value.phone.trim() && !value.email.trim()) ||
      this.form.controls.email.invalid
    ) {
      this.form.controls.documentNumber.markAsTouched();
      this.form.controls.fullName.markAsTouched();
      this.form.controls.phone.markAsTouched();
      this.form.controls.email.markAsTouched();
      this.error.set(
        'Complete identificación y al menos un dato de contacto para guardar.',
      );
      this.errorItems.set(this.collectErrors(true));
      this.saved.set(false);
      this.first()?.nativeElement.focus();
      return;
    }
    this.error.set('');
    this.errorItems.set([]);
    this.saved.set(false);
    try {
      await this.facade.save(toApplicationDraft(value));
      this.saved.set(true);
    } catch (error: unknown) {
      this.error.set(this.errorDetail(error, 'No se guardaron los cambios. Revisa tu conexión e intenta de nuevo.'));
    }
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(
        'Complete los campos obligatorios y corrija los valores señalados.',
      );
      const errors = this.collectErrors(false);
      this.errorItems.set(errors);
      this.focusControl(errors[0]?.control ?? 'documentNumber');
      return;
    }
    this.error.set('');
    this.errorItems.set([]);
    this.saved.set(false);
    const input = toEvaluationInput(this.form.getRawValue());
    try {
      const result = (await this.facade.evaluate(input)) as {
        evaluationId: string;
      };
      await this.router.navigate(['/evaluations', result.evaluationId], {
        state: { result },
      });
    } catch (error: unknown) {
      const failure = this.evaluationFailure(error);
      if (failure) {
        await this.router.navigate(['/evaluations', failure.evaluationId], {
          state: { correlationId: failure.correlationId },
        });
        return;
      }
      this.error.set(this.errorDetail(
        error,
        'No fue posible evaluar la solicitud. Sus datos permanecen en pantalla.',
      ));
    }
  }

  private errorDetail(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const nested = error.error;
      if (
        nested &&
        typeof nested === 'object' &&
        'detail' in nested &&
        typeof nested.detail === 'string'
      )
        return nested.detail;
    }
    return fallback;
  }

  private evaluationFailure(
    error: unknown,
  ): { evaluationId: string; correlationId: string } | null {
    if (!error || typeof error !== 'object' || !('error' in error)) return null;
    const body = error.error;
    if (!body || typeof body !== 'object') return null;
    const evaluationId = 'evaluationId' in body ? body.evaluationId : null;
    const correlationId = 'correlationId' in body ? body.correlationId : '';
    return typeof evaluationId === 'string'
      ? {
          evaluationId,
          correlationId: typeof correlationId === 'string' ? correlationId : '',
        }
      : null;
  }

  focusControl(control: string): void {
    const target = this.host.nativeElement.querySelector<HTMLElement>(
      `#${CSS.escape(control)}`,
    );
    target?.focus();
  }

  private bindAvailability(
    toggleName: string,
    reasonName: string,
    dataControlNames: readonly string[],
  ): void {
    const toggle = this.form.get(toggleName)!;
    const reason = this.form.get(reasonName)!;
    const apply = (unavailable: boolean) => {
      if (unavailable) {
        reason.enable({ emitEvent: false });
        reason.setValidators([Validators.required, Validators.minLength(10), Validators.maxLength(240)]);
        for (const name of dataControlNames)
          this.form.get(name)?.disable({ emitEvent: false });
      } else {
        reason.clearValidators();
        reason.disable({ emitEvent: false });
        for (const name of dataControlNames)
          this.form.get(name)?.enable({ emitEvent: false });
      }
      reason.updateValueAndValidity({ emitEvent: false });
    };
    apply(Boolean(toggle.value));
    toggle.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => apply(Boolean(value)));
  }

  private collectErrors(draftOnly: boolean): readonly FormErrorItem[] {
    const labels: Readonly<Record<string, string>> = {
      documentNumber: 'Número de documento',
      fullName: 'Nombre completo',
      phone: 'Teléfono o correo electrónico',
      email: 'Correo electrónico',
      monthlyIncomeCop: 'Ingreso mensual',
      incomeUnavailableReason: 'Motivo de no disponibilidad de ingresos',
      stabilityMonths: 'Estabilidad de ingresos',
      utilityAmount: 'Promedio mensual de servicios',
      utilitiesUnavailableReason: 'Motivo de no disponibilidad de servicios',
      tenureMonths: 'Antigüedad móvil',
      regularMonths: 'Meses regulares de telefonía',
      mobileUnavailableReason: 'Motivo de no disponibilidad de telefonía',
      consent: 'Consentimiento',
    };
    const allowed = draftOnly
      ? new Set(['documentNumber', 'fullName', 'phone', 'email'])
      : null;
    const invalid = Object.entries(this.form.controls)
      .filter(([name, control]) => control.invalid && (!allowed || allowed.has(name)))
      .flatMap(([name, control]) => {
        if (name === 'utilityReferences' && 'controls' in control) {
          const firstInvalid = control.controls
            .flatMap((group: AbstractControl) =>
              group instanceof FormGroup
                ? Object.entries((group as FormGroup).controls)
                : [],
            )
            .find(([, child]) => child.invalid);
          return firstInvalid
            ? [{ control: firstInvalid[0], label: labels[firstInvalid[0]] ?? 'Referencia de servicios' }]
            : [];
        }
        return [{ control: name, label: labels[name] ?? name }];
      });
    if (this.form.hasError('contact'))
      invalid.splice(2, 0, { control: 'phone', label: labels['phone']! });
    return invalid.filter(
      (item, index, all) => all.findIndex((candidate) => candidate.control === item.control) === index,
    );
  }

  private async loadCorrection(): Promise<void> {
    const applicationId = this.route.snapshot.queryParamMap.get('applicationId');
    if (!applicationId) return;
    try {
      const loaded = await this.facade.load(applicationId);
      const value = toApplicationFormValue(loaded.resource);
      while (this.form.controls.utilityReferences.length > 0)
        this.form.controls.utilityReferences.removeAt(0);
      for (const reference of value.utilityReferences) {
        const group = this.createUtilityReference();
        group.patchValue(reference);
        this.form.controls.utilityReferences.push(group);
      }
      const { utilityReferences, ...formValue } = value;
      void utilityReferences;
      this.form.patchValue(formValue);
    } catch (error: unknown) {
      this.error.set(
        this.errorDetail(
          error,
          'No fue posible cargar los datos para corrección.',
        ),
      );
    }
  }
}
