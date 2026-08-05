import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ApplicationFacade } from './application.facade';
import { ApplicationFormPageComponent } from './application-form-page.component';
import { toApplicationDraft } from './application.mapper';

class StubFacade {
  readonly saving = signal(false);
  readonly evaluating = signal(false);
  readonly busy = signal(false);
  readonly save = jasmine.createSpy('save').and.resolveTo({});
  readonly evaluate = jasmine.createSpy('evaluate').and.resolveTo({ evaluationId: crypto.randomUUID() });
  readonly load = jasmine.createSpy('load');
}

describe('US2 application validation and unavailable data', () => {
  let facade: StubFacade;

  beforeEach(async () => {
    facade = new StubFacade();
    await TestBed.configureTestingModule({
      imports: [ApplicationFormPageComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    })
      .overrideComponent(ApplicationFormPageComponent, {
        set: { providers: [{ provide: ApplicationFacade, useValue: facade }] },
      })
      .compileComponents();
  });

  it('requires a visible reason and preserves values when availability changes', () => {
    const fixture = TestBed.createComponent(ApplicationFormPageComponent);
    const component = fixture.componentInstance;
    component.form.patchValue({ monthlyIncomeCop: 2300000, stabilityMonths: 18 });
    component.form.controls.incomeUnavailable.setValue(true);
    fixture.detectChanges();

    expect(component.form.controls.monthlyIncomeCop.disabled).toBeTrue();
    expect(component.form.controls.incomeUnavailableReason.invalid).toBeTrue();
    component.form.controls.incomeUnavailableReason.setValue('El solicitante no dispone del soporte.');
    expect(component.form.controls.incomeUnavailableReason.valid).toBeTrue();
    expect(toApplicationDraft(component.form.getRawValue()).alternativeData?.income).toEqual({
      availability: 'unavailable',
      reason: 'El solicitante no dispone del soporte.',
    });

    component.form.controls.incomeUnavailable.setValue(false);
    expect(component.form.controls.monthlyIncomeCop.value).toBe(2300000);
    expect(component.form.controls.stabilityMonths.value).toBe(18);
  });

  it('shows anchored errors and focuses the selected invalid field after submit', async () => {
    const fixture = TestBed.createComponent(ApplicationFormPageComponent);
    fixture.detectChanges();
    await fixture.componentInstance.submit();
    fixture.detectChanges();

    const summary = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    const documentLink = summary.querySelector('a[href="#documentNumber"]') as HTMLAnchorElement;
    expect(summary.textContent).toContain('Complete los campos obligatorios');
    expect(documentLink).toBeTruthy();
    documentLink.click();
    expect(document.activeElement?.id).toBe('documentNumber');
    expect(facade.evaluate).not.toHaveBeenCalled();
  });
});
