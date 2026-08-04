import { Component, ElementRef, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppHeaderComponent } from './app-header.component';
import { ResponsiveContainerComponent } from './responsive-container.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent, ResponsiveContainerComponent],
  template: `
    <a class="skip-link" href="#main-content" (click)="skipToContent($event)"
      >Saltar al contenido</a
    >
    <app-header />
    <main #mainContent id="main-content" tabindex="-1">
      <app-responsive-container><router-outlet /></app-responsive-container>
    </main>
    <footer>
      <app-responsive-container>
        <span>Herramienta de apoyo a la decisión humana</span>
        <span>Versión MVP 1.0.0</span>
      </app-responsive-container>
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
      footer app-responsive-container {
        min-height: 64px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      @media (max-width: 599px) {
        main {
          padding-block: 24px;
        }
        footer app-responsive-container {
          align-items: flex-start;
          flex-direction: column;
          justify-content: center;
          padding-block: 16px;
        }
      }
    `,
  ],
})
export class AppShellComponent {
  @ViewChild('mainContent', { read: ElementRef })
  private mainContent?: ElementRef<HTMLElement>;

  skipToContent(event: Event): void {
    event.preventDefault();
    this.mainContent?.nativeElement.focus({ preventScroll: true });
    this.mainContent?.nativeElement.scrollIntoView({ block: 'start' });
    history.replaceState(null, '', '#main-content');
  }
}
