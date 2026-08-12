import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'terms-responsive-container',
  standalone: true,
  template: '<ng-content />',
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        max-width: 1200px;
        margin-inline: auto;
        padding-inline: 32px;
      }
      @media (max-width: 959px) {
        :host {
          padding-inline: 24px;
        }
      }
      @media (max-width: 599px) {
        :host {
          padding-inline: 16px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResponsiveContainerComponent {}
