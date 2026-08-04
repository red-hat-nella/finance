import { Component, Input } from '@angular/core';
@Component({
  selector: 'app-factor-list',
  standalone: true,
  template: `<section class="factors">
    <h2>Factores que explican el resultado</h2>
    <p class="intro">Aportes calculados a partir de los datos declarados.</p>
    <ol>
      @for (factor of factors; track factor.dimension) {
        <li>
          <span [class]="'direction ' + factor.direction" aria-hidden="true">{{
            factor.direction === 'favorable'
              ? '↑'
              : factor.direction === 'unfavorable'
                ? '↓'
                : '–'
          }}</span>
          <div>
            <div class="factor-heading">
              <h3>{{ label(factor.dimension) }}</h3>
              <strong>{{ factor.contributionPoints }} puntos</strong>
            </div>
            <p>{{ factor.explanation }}</p>
            <span class="index"
              >Índice de dimensión: {{ factor.dimensionIndex }} / 100</span
            >
          </div>
        </li>
      }
    </ol>
  </section>`,
  styles: [
    `
      .factors {
        padding: 32px;
      }
      .intro {
        color: var(--color-text-muted);
        margin: 4px 0 20px;
      }
      ol {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      li {
        display: grid;
        grid-template-columns: 40px minmax(0, 1fr);
        gap: 16px;
        padding: 20px 0;
        border-top: 1px solid var(--color-border);
      }
      .direction {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 4px;
        background: var(--color-surface-subtle);
        font-weight: 700;
      }
      .favorable {
        color: var(--color-success);
        background: var(--color-success-bg);
      }
      .unfavorable {
        color: var(--color-danger);
        background: var(--color-danger-bg);
      }
      .factor-heading {
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }
      .factor-heading strong {
        white-space: nowrap;
      }
      .factor-heading h3 {
        font-size: 18px;
      }
      .factor-heading + p {
        margin: 4px 0;
        color: var(--color-text-muted);
      }
      .index {
        font-size: 14px;
      }
      @media (max-width: 599px) {
        .factors {
          padding: 24px 16px;
        }
        .factor-heading {
          display: block;
        }
        .factor-heading strong {
          display: block;
          margin-top: 4px;
        }
      }
    `,
  ],
})
export class FactorListComponent {
  @Input() factors: any[] = [];
  label(d: string) {
    return d === 'utility'
      ? 'Servicios públicos'
      : d === 'mobile'
        ? 'Telefonía móvil'
        : 'Ingresos y estabilidad';
  }
}
