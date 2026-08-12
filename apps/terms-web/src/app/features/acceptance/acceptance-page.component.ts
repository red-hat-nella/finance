import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';

import { AuthPort } from '../../core/auth/auth.port';
import { ReturnUrlService } from '../../core/navigation/return-url.service';
import { AcceptanceFacade } from './acceptance.facade';
import { TermsActionBarComponent } from './terms-action-bar.component';
import { TermsDocumentComponent } from './terms-document.component';

@Component({
  selector: 'terms-acceptance-page',
  standalone: true,
  imports: [TermsActionBarComponent, TermsDocumentComponent],
  template: `
    @switch (facade.state().kind) {
      @case ('loading') {
        <section class="state surface loading" aria-busy="true" aria-label="Verificando términos">
          <span class="skeleton title"></span><span class="skeleton line"></span><span class="skeleton line short"></span>
          <p class="sr-only" aria-live="polite">Verificando términos vigentes</p>
        </section>
        <terms-action-bar [disabled]="true" (exit)="exit()" />
      }
      @case ('document') {
        <terms-document [version]="facade.version()!" />
        <terms-action-bar (accept)="accept()" (exit)="exit()" />
      }
      @case ('accepting') {
        <terms-document [version]="facade.version()!" />
        <p class="sr-only" aria-live="polite">Guardando aceptación</p>
        <terms-action-bar [accepting]="true" (exit)="exit()" />
      }
      @case ('success') {
        <section class="state surface" role="status" tabindex="-1">
          <h1>Términos aceptados</h1>
          <p>Tu aceptación quedó confirmada. Continuaremos de forma segura.</p>
        </section>
        <terms-action-bar [disabled]="true" (exit)="exit()" />
      }
      @case ('changed') {
        <section class="state surface" role="alert" tabindex="-1">
          <h1>Los términos cambiaron</h1>
          <p>Revisa la nueva versión vigente antes de continuar.</p>
          <button type="button" class="primary" (click)="reload()">Revisar nueva versión</button>
        </section>
        <terms-action-bar [disabled]="true" (exit)="exit()" />
      }
      @case ('expired') {
        <section class="state surface" role="alert" tabindex="-1">
          <h1>Tu sesión expiró</h1>
          <p>Inicia sesión nuevamente para revisar y aceptar los términos.</p>
          <button type="button" class="primary" (click)="signIn()">Iniciar sesión</button>
        </section>
        <terms-action-bar [disabled]="true" (exit)="exit()" />
      }
      @case ('unavailable') {
        <section class="state surface" role="alert" tabindex="-1">
          <h1>No podemos verificar los términos en este momento</h1>
          <p>El acceso permanece bloqueado. Tu aceptación no fue registrada.</p>
          @if (facade.retryable()) {
            <button type="button" class="primary" (click)="reload()">Intentar nuevamente</button>
          }
        </section>
        <terms-action-bar [disabled]="true" (exit)="exit()" />
      }
    }
  `,
  styles: [`
    :host { display: block; padding-bottom: 96px; }
    .state { max-width: 800px; min-height: 240px; margin-inline: auto; padding: 32px; }
    .state p { max-width: 65ch; }
    .state button { min-height: 44px; padding: 0 20px; border-radius: var(--radius-control); cursor: pointer; font-weight: 500; }
    .primary { border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-on-primary); }
    .loading { display: grid; align-content: start; gap: 16px; }
    .skeleton { display: block; min-height: 24px; border-radius: var(--radius-control); background: var(--color-surface-subtle); }
    .skeleton.title { width: min(420px, 80%); min-height: 40px; }
    .skeleton.line { width: 100%; }
    .skeleton.short { width: 65%; }
    @media (max-width: 599px) { :host { padding-bottom: 152px; } .state { padding: 24px 16px; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcceptancePageComponent implements OnInit {
  readonly facade = inject(AcceptanceFacade);
  private readonly auth = inject(AuthPort);
  private readonly returnUrl = inject(ReturnUrlService);

  async ngOnInit(): Promise<void> {
    await this.facade.load();
    if (this.facade.state().kind === 'success') this.returnUrl.continue();
    else this.focusPrimaryMessage();
  }

  async accept(): Promise<void> {
    await this.facade.accept();
    if (this.facade.state().kind === 'success') {
      window.setTimeout(() => this.returnUrl.continue(), 350);
    } else this.focusPrimaryMessage();
  }

  async reload(): Promise<void> {
    await this.facade.load();
    this.focusPrimaryMessage();
  }

  signIn(): void {
    this.auth.signIn('/terms/');
  }

  async exit(): Promise<void> {
    await this.auth.signOut();
  }

  private focusPrimaryMessage(): void {
    window.setTimeout(() => document.querySelector<HTMLElement>('main h1, main [role="alert"]')?.focus());
  }
}
