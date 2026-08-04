import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthPort } from './core/auth/auth.port';
import { DevAuthAdapter } from './core/auth/dev-auth.adapter';

describe('AppComponent', () => {
  beforeEach(async () =>
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthPort, useClass: DevAuthAdapter },
      ],
    }).compileComponents(),
  );
  it('renders the accessible application shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.skip-link')?.textContent).toContain(
      'Saltar al contenido',
    );
    expect(element.textContent).toContain('Scoring alternativo');
    expect(element.querySelector('main#main-content')).toBeTruthy();
  });
});
