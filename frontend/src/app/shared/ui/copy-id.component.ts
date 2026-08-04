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
      .id {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        max-width: 100%;
      }
      code {
        overflow-wrap: anywhere;
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
