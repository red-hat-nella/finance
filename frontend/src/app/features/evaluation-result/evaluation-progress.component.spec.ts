import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { EvaluationProgressComponent } from './evaluation-progress.component';

describe('EvaluationProgressComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvaluationProgressComponent, NoopAnimationsModule],
    }).compileComponents();
  });

  it('exposes a stable busy region without a false score', () => {
    const fixture = TestBed.createComponent(EvaluationProgressComponent);
    fixture.componentInstance.loading = true;
    fixture.detectChanges();
    const region = fixture.nativeElement.querySelector(
      '.evaluation-progress',
    ) as HTMLElement;

    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-busy')).toBe('true');
    expect(region.textContent).toContain('Consultando resultado');
    expect(region.textContent).not.toMatch(/\d+\s*\/\s*850/);
  });

  it('keeps the retry action observable in the error state', () => {
    const fixture = TestBed.createComponent(EvaluationProgressComponent);
    fixture.componentInstance.error = 'El motor no respondió.';
    spyOn(fixture.componentInstance.retry, 'emit');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    button.click();
    expect(fixture.componentInstance.retry.emit).toHaveBeenCalled();
  });
});
