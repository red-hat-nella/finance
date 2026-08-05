import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ApplicationFacade } from './application.facade';
import { ApplicationApiService } from './application-api.service';
import { ApplicationFormPageComponent } from './application-form-page.component';
import { toApplicationDraft } from './application.mapper';
import type { ApplicationInput } from './application-form.model';

class StubApplicationFacade {
  readonly saving = signal(false);
  readonly evaluating = signal(false);
  readonly busy = signal(false);
  readonly save = jasmine.createSpy('save').and.resolveTo({});
  readonly evaluate = jasmine.createSpy('evaluate').and.resolveTo({
    evaluationId: '20000000-0000-4000-8000-000000000001',
  });
}

describe('ApplicationFormPageComponent', () => {
  let facade: StubApplicationFacade;

  beforeEach(async () => {
    facade = new StubApplicationFacade();
    await TestBed.configureTestingModule({
      imports: [ApplicationFormPageComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    })
      .overrideComponent(ApplicationFormPageComponent, {
        set: {
          providers: [{ provide: ApplicationFacade, useValue: facade }],
        },
      })
      .compileComponents();
  });

  it('saves an identity/contact-only draft without inventing scoring data', async () => {
    const fixture = TestBed.createComponent(ApplicationFormPageComponent);
    const component = fixture.componentInstance;
    component.form.patchValue({
      documentType: 'CC',
      documentNumber: '102341032',
      fullName: 'María Paula Rojas',
      phone: '+573001112233',
    });

    await component.saveDraft();
    fixture.detectChanges();

    expect(facade.save).toHaveBeenCalledWith(
      jasmine.objectContaining({
        applicant: jasmine.objectContaining({ documentNumber: '102341032' }),
      }),
    );
    const saved = facade.save.calls.mostRecent().args[0];
    expect(saved.alternativeData).toBeUndefined();
    expect(saved.consent).toBeUndefined();
    expect(fixture.nativeElement.textContent).toContain('Borrador guardado');
  });

  it('maps a valid form, exposes one primary action and evaluates once', async () => {
    const fixture = TestBed.createComponent(ApplicationFormPageComponent);
    const component = fixture.componentInstance;
    component.form.setValue({
      documentType: 'CC',
      documentNumber: '102341032',
      fullName: 'María Paula Rojas',
      phone: '+573001112233',
      email: '',
      monthlyIncomeCop: 4000000,
      incomeUnavailable: false,
      incomeUnavailableReason: '',
      sourceType: 'employment',
      sourceOtherDescription: '',
      stabilityMonths: 48,
      utilityReferences: [{
        serviceType: 'electricity',
        utilityAmount: 250000,
        utilityMonths: 12,
        onTimeCount: 12,
      }],
      utilitiesUnavailable: false,
      utilitiesUnavailableReason: '',
      mobileMode: 'postpaid',
      tenureMonths: 48,
      mobileObservedMonths: 12,
      regularMonths: 12,
      mobileUnavailable: false,
      mobileUnavailableReason: '',
      consent: true,
    });
    fixture.detectChanges();

    const primary = fixture.debugElement.queryAll(
      By.css('button[mat-flat-button]'),
    );
    expect(primary.length).toBe(1);
    expect(
      (primary[0].nativeElement as HTMLElement).querySelector('.button-slot'),
    ).toBeTruthy();

    await component.submit();
    expect(facade.evaluate).toHaveBeenCalledTimes(1);
    expect(facade.evaluate).toHaveBeenCalledWith(
      jasmine.objectContaining({
        alternativeData: jasmine.objectContaining({
          income: jasmine.objectContaining({ monthlyIncomeCop: '4000000.00' }),
        }),
      }),
    );
  });

  it('keeps action slots stable while evaluation is in progress', () => {
    const fixture = TestBed.createComponent(ApplicationFormPageComponent);
    fixture.detectChanges();
    const before = fixture.debugElement.queryAll(By.css('.button-slot')).length;

    facade.evaluating.set(true);
    facade.busy.set(true);
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('.button-slot')).length).toBe(
      before,
    );
    expect(fixture.nativeElement.textContent).toContain('Evaluando');
    expect(
      fixture.debugElement.query(By.css('button[mat-flat-button]')).nativeElement
        .disabled,
    ).toBeTrue();
  });

  it('keeps partial input and focuses the first invalid field after submit', async () => {
    const fixture = TestBed.createComponent(ApplicationFormPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({ fullName: 'Nombre visible' });

    await component.submit();
    fixture.detectChanges();

    expect(component.form.controls.fullName.value).toBe('Nombre visible');
    expect(facade.evaluate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(component.first()?.nativeElement ?? null);
    expect(fixture.nativeElement.textContent).toContain(
      'Complete los campos obligatorios',
    );
  });

  it('uses stable deterministic mapping for the same visible values', () => {
    const value = {
      documentType: 'CE',
      documentNumber: 'AB12345',
      fullName: 'Laura Méndez',
      phone: '',
      email: 'laura@example.test',
      monthlyIncomeCop: null,
      sourceType: 'employment',
      sourceOtherDescription: '',
      stabilityMonths: null,
      utilityReferences: [{
        serviceType: 'water',
        utilityAmount: null,
        utilityMonths: 12,
        onTimeCount: null,
      }],
      mobileMode: 'prepaid',
      tenureMonths: null,
      mobileObservedMonths: 12,
      regularMonths: null,
      consent: false,
    } as const;
    expect(toApplicationDraft(value)).toEqual(toApplicationDraft(value));
  });

  it('requires and maps the description for an other income source', () => {
    const fixture = TestBed.createComponent(ApplicationFormPageComponent);
    const component = fixture.componentInstance;
    component.form.patchValue({
      sourceType: 'other',
      sourceOtherDescription: '',
    });
    expect(component.form.hasError('sourceOtherDescription')).toBeTrue();

    component.form.patchValue({
      sourceOtherDescription: '  Actividades independientes ocasionales  ',
    });
    expect(component.form.hasError('sourceOtherDescription')).toBeFalse();
    const value = component.form.getRawValue();
    expect(
      toApplicationDraft({
        ...value,
        monthlyIncomeCop: 1200000,
        stabilityMonths: 3,
      }).alternativeData?.income,
    ).toEqual(
      jasmine.objectContaining({
        sourceType: 'other',
        sourceOtherDescription: 'Actividades independientes ocasionales',
      }),
    );
  });

  it('renders accessible identity, contact and consent fieldsets', () => {
    const fixture = TestBed.createComponent(ApplicationFormPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const legends = Array.from(element.querySelectorAll('fieldset legend')).map(
      (legend) => legend.textContent?.trim(),
    );
    expect(legends).toContain('1Identificación');
    expect(legends).toContain('2Contacto');
    expect(legends).toContain('6Consentimiento');
    expect(element.querySelector('dialog[aria-labelledby="consent-title"]')).toBeTruthy();
    expect(
      element.querySelector('input[formcontrolname="documentNumber"]'),
    ).toBeTruthy();
  });

  it('supports one to three utility references and maps every complete row', () => {
    const fixture = TestBed.createComponent(ApplicationFormPageComponent);
    const component = fixture.componentInstance;
    expect(component.form.controls.utilityReferences.length).toBe(1);
    component.addUtilityReference();
    component.addUtilityReference();
    component.addUtilityReference();
    expect(component.form.controls.utilityReferences.length).toBe(3);
    component.form.controls.utilityReferences.at(0).patchValue({
      utilityAmount: 250000,
      onTimeCount: 12,
    });
    component.form.controls.utilityReferences.at(1).patchValue({
      serviceType: 'water',
      utilityAmount: 180000,
      onTimeCount: 10,
    });
    const mapped = toApplicationDraft(component.form.getRawValue());
    expect(mapped.alternativeData?.utilities?.availability).toBe('provided');
    if (mapped.alternativeData?.utilities?.availability === 'provided')
      expect(mapped.alternativeData.utilities.references.length).toBe(2);

    fixture.detectChanges();
    const remove = fixture.nativeElement.querySelector(
      'button[aria-label="Eliminar referencia 1"]',
    ) as HTMLButtonElement;
    expect(remove).toBeTruthy();
    remove.click();
    expect(component.form.controls.utilityReferences.length).toBe(2);
  });
});

describe('ApplicationFacade version and idempotent flow', () => {
  it('sends the latest ETag to PATCH and then to evaluation', async () => {
    const input = toApplicationDraft({
      documentType: 'CC',
      documentNumber: '102341032',
      fullName: 'María Paula Rojas',
      phone: '+573001112233',
      email: '',
      monthlyIncomeCop: null,
      sourceType: 'employment',
      sourceOtherDescription: '',
      stabilityMonths: null,
      utilityReferences: [{
        serviceType: 'electricity',
        utilityAmount: null,
        utilityMonths: 12,
        onTimeCount: null,
      }],
      mobileMode: 'postpaid',
      tenureMonths: null,
      mobileObservedMonths: 12,
      regularMonths: null,
      consent: false,
    });
    const resource = {
      ...input,
      applicationId: '10000000-0000-4000-8000-000000000001',
      state: 'borrador' as const,
      revisionNumber: 1,
      lockVersion: 1,
      createdAt: '2026-08-04T12:00:00Z',
      updatedAt: '2026-08-04T12:00:00Z',
      draftExpiresAt: '2026-11-02T12:00:00Z',
    };
    const api = {
      create: jasmine.createSpy('create').and.resolveTo({
        resource,
        etag: '"1"',
      }),
      update: jasmine.createSpy('update').and.resolveTo({
        resource: { ...resource, lockVersion: 2 },
        etag: '"2"',
      }),
      evaluate: jasmine.createSpy('evaluate').and.resolveTo({}),
    };
    const facade = new ApplicationFacade(
      api as unknown as ApplicationApiService,
    );

    await facade.save(input);
    await facade.evaluate(input as ApplicationInput);

    expect(api.update).toHaveBeenCalledWith(resource.applicationId, input, '"1"');
    expect(api.evaluate).toHaveBeenCalledWith(
      jasmine.objectContaining({ etag: '"2"' }),
    );
  });

});
