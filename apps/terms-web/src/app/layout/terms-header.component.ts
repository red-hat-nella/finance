import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthPort } from '../core/auth/auth.port';
import { ResponsiveContainerComponent } from './responsive-container.component';

@Component({
  selector: 'terms-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ResponsiveContainerComponent],
  template: `
    <header>
      <terms-responsive-container>
        <a class="brand" routerLink="/" aria-label="Scoring alternativo, términos y condiciones">
          <span class="brand-mark" aria-hidden="true">S</span>
          <span>
            <strong>Scoring alternativo</strong>
            <small>Términos y condiciones</small>
          </span>
        </a>

        @if (showAdministration) {
          <nav aria-label="Administración de términos">
            @if (canManageVersions) {
              <a routerLink="/versions" routerLinkActive="active">Versiones</a>
            }
            @if (canReviewAcceptances) {
              <a routerLink="/acceptances" routerLinkActive="active">Aceptaciones</a>
            }
          </nav>
        }

        <button type="button" class="exit" (click)="exit.emit()">Salir</button>
      </terms-responsive-container>
    </header>
  `,
  styles: [
    `
      header {
        min-height: 64px;
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
        position: sticky;
        top: 0;
        z-index: var(--z-header);
      }
      terms-responsive-container {
        min-height: 64px;
        display: flex;
        align-items: center;
        gap: 32px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--color-text);
        text-decoration: none;
        min-width: 250px;
      }
      .brand-mark {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-control);
        background: var(--color-primary);
        color: var(--color-on-primary);
        font-weight: 700;
      }
      .brand span:last-child {
        display: flex;
        flex-direction: column;
      }
      .brand small {
        color: var(--color-text-muted);
        font-size: 12px;
        line-height: 16px;
      }
      nav {
        display: flex;
        align-self: stretch;
        gap: 8px;
      }
      nav a {
        display: flex;
        align-items: center;
        padding-inline: 16px;
        border-bottom: 3px solid transparent;
        color: var(--color-text-muted);
        text-decoration: none;
        font-weight: 500;
      }
      nav a.active {
        color: var(--color-primary);
        border-color: var(--color-primary);
      }
      .exit {
        min-width: 72px;
        margin-left: auto;
        padding-inline: 16px;
        border: 1px solid var(--color-border-strong);
        border-radius: var(--radius-control);
        background: var(--color-surface);
        color: var(--color-primary);
        cursor: pointer;
      }
      .exit:hover {
        background: var(--color-primary-soft);
      }
      @media (max-width: 720px) {
        .brand { min-width: 0; }
        .brand small { display: none; }
        terms-responsive-container {
          gap: 8px;
          flex-wrap: wrap;
          padding-block: 8px;
        }
        nav {
          order: 3;
          width: 100%;
          height: 44px;
        }
        nav a {
          flex: 1;
          justify-content: center;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsHeaderComponent {
  readonly exit = output<void>();

  constructor(private readonly auth: AuthPort) {}

  get canManageVersions(): boolean {
    return this.auth.hasAnyRole(['terms_admin']);
  }

  get canReviewAcceptances(): boolean {
    return this.auth.hasAnyRole(['supervisor', 'auditor']);
  }

  get showAdministration(): boolean {
    return this.canManageVersions || this.canReviewAcceptances;
  }
}
