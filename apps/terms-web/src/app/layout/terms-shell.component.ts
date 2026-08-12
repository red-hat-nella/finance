import { ChangeDetectionStrategy, Component, ElementRef, inject, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthPort } from '../core/auth/auth.port';
import { FocusOnNavigationService } from './focus-on-navigation.service';
import { ResponsiveContainerComponent } from './responsive-container.component';
import { TermsHeaderComponent } from './terms-header.component';

@Component({
  selector: 'terms-shell',
  standalone: true,
  imports: [RouterOutlet, ResponsiveContainerComponent, TermsHeaderComponent],
  template: `
    <a class="skip-link" href="#main-content" (click)="skipToContent($event)">Saltar al contenido</a>
    <terms-header (exit)="signOut()" />
    <main #mainContent id="main-content" tabindex="-1">
      <terms-responsive-container><router-outlet /></terms-responsive-container>
    </main>
    <footer>
      <terms-responsive-container>
        <span>Scoring alternativo</span>
        <span>Términos y condiciones</span>
      </terms-responsive-container>
    </footer>
  `,
  styles: [
    `
      :host {
        display: grid;
        grid-template-rows: auto 1fr auto;
        min-height: 100dvh;
      }
      main {
        padding-block: 40px;
        scroll-margin-top: 96px;
      }
      footer {
        border-top: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text-muted);
        font-size: 14px;
      }
      footer terms-responsive-container {
        min-height: 64px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      @media (max-width: 599px) {
        main { padding-block: 24px; }
        footer terms-responsive-container {
          align-items: flex-start;
          flex-direction: column;
          justify-content: center;
          padding-block: 16px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsShellComponent {
  private readonly auth = inject(AuthPort);
  private readonly focusOnNavigation = inject(FocusOnNavigationService);

  @ViewChild('mainContent', { read: ElementRef })
  private mainContent?: ElementRef<HTMLElement>;

  skipToContent(event: Event): void {
    event.preventDefault();
    this.mainContent?.nativeElement.focus({ preventScroll: true });
    this.mainContent?.nativeElement.scrollIntoView({ block: 'start' });
    history.replaceState(null, '', '#main-content');
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
