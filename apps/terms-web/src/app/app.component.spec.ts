import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { AuthPort, Session } from './core/auth/auth.port';

class TestAuth extends AuthPort {
  session(): Session | null { return null; }
  accessToken(): string | null { return null; }
  isAuthenticated(): boolean { return true; }
  signIn(): void {}
  async signOut(): Promise<void> { return Promise.resolve(); }
}

describe('AppComponent', () => {
  it('renders the independent terms shell', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter(routes), { provide: AuthPort, useClass: TestAuth }],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('terms-shell')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('terms-header')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.skip-link')?.textContent).toContain('Saltar al contenido');
  });
});
