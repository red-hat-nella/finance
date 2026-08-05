import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthPort } from '../core/auth/auth.port';
import { ResponsiveContainerComponent } from './responsive-container.component';
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ResponsiveContainerComponent],
  template: ` <header>
    <app-responsive-container
      ><a
        class="brand"
        routerLink="/applications/new"
        aria-label="Scoring alternativo, inicio"
        ><span class="brand-mark" aria-hidden="true">S</span
        ><span
          ><strong>Scoring alternativo</strong
          ><small>Gestión de evaluaciones</small></span
        ></a
      >
      <nav aria-label="Navegación principal">
        @if (canCreate) {
          <a routerLink="/applications/new" routerLinkActive="active"
            >Nueva solicitud</a
          >
        }
        <a routerLink="/evaluations" routerLinkActive="active">Histórico</a>
      </nav>
      <div class="actor">
        <span class="initials" aria-hidden="true">{{ initials }}</span
        ><span>{{ session?.displayName }}</span>
      </div></app-responsive-container
    >
  </header>`,
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
      app-responsive-container {
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
        min-height: 44px;
      }
      .brand-mark {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 4px;
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
        min-height: 44px;
        color: var(--color-text-muted);
        text-decoration: none;
        padding: 0 16px;
        border-bottom: 3px solid transparent;
        font-weight: 500;
      }
      nav a.active {
        color: var(--color-primary);
        border-color: var(--color-primary);
      }
      .actor {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
      }
      .initials {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--color-primary-soft);
        color: var(--color-primary);
        font-weight: 700;
      }
      @media (max-width: 720px) {
        .brand {
          min-width: 0;
        }
        .brand small,
        .actor span:last-child {
          display: none;
        }
        app-responsive-container {
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
        .actor {
          margin-left: auto;
        }
      }
    `,
  ],
})
export class AppHeaderComponent {
  constructor(private readonly auth: AuthPort) {}
  get session() {
    return this.auth.session();
  }
  get canCreate() {
    return this.auth.hasAnyRole(['credit_analyst']);
  }
  get initials() {
    return (
      this.session?.displayName
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'U'
    );
  }
}
