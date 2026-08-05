import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
@Component({
  selector: 'app-copy-id',
  standalone: true,
  imports: [MatButtonModule, MatTooltipModule],
  template: `<span class="id"
    ><code>{{ value }}</code
    ><button
      mat-icon-button
      matTooltip="Copiar identificador"
      aria-label="Copiar identificador"
      (click)="copy()"
    >
      ⧉
    </button></span
  >`,
  styles: [
    `
      :host {
        display: inline-flex;
        min-width: 0;
        max-width: 100%;
        vertical-align: middle;
      }
      .id {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-width: 0;
        max-width: 100%;
      }
      code {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .id button {
        width: 44px;
        height: 44px;
        flex: 0 0 44px;
      }
    `,
  ],
})
export class CopyIdComponent {
  @Input() value = '';
  copy() {
    void navigator.clipboard.writeText(this.value);
  }
}
