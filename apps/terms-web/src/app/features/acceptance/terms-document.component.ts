import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TermsVersion } from '../../core/api/terms-api.service';

type DocumentBlock =
  | { readonly kind: 'heading'; readonly level: 2 | 3; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'unordered'; readonly items: readonly string[] }
  | { readonly kind: 'ordered'; readonly items: readonly string[] };

export function parseSafeMarkdown(markdown: string): readonly DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]?.trim() ?? '';
    if (!line) { index += 1; continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length <= 2 ? 2 : 3, text: heading[2] });
      index += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index]?.trim() ?? '')) {
        items.push((lines[index]?.trim() ?? '').replace(/^[-*]\s+/, ''));
        index += 1;
      }
      blocks.push({ kind: 'unordered', items });
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index]?.trim() ?? '')) {
        items.push((lines[index]?.trim() ?? '').replace(/^\d+[.)]\s+/, ''));
        index += 1;
      }
      blocks.push({ kind: 'ordered', items });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && (lines[index]?.trim() ?? '') && !/^(#{1,6}|[-*]\s+|\d+[.)]\s+)/.test(lines[index]?.trim() ?? '')) {
      paragraph.push(lines[index]?.trim() ?? '');
      index += 1;
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
  }
  return Object.freeze(blocks);
}

@Component({
  selector: 'terms-document',
  standalone: true,
  template: `
    <article class="surface" aria-labelledby="terms-title">
      <header>
        <p class="eyebrow">{{ eyebrow() }}</p>
        <h1 id="terms-title" tabindex="-1">{{ version().title }}</h1>
        <dl>
          <div><dt>Versión</dt><dd>{{ version().versionCode }}</dd></div>
          <div><dt>Vigente desde</dt><dd><time [attr.datetime]="version().effectiveAt">{{ effectiveDate() }}</time></dd></div>
        </dl>
      </header>
      <div class="legal-copy">
        @for (block of blocks(); track $index) {
          @switch (block.kind) {
            @case ('heading') {
              @if (block.level === 2) { <h2>{{ block.text }}</h2> } @else { <h3>{{ block.text }}</h3> }
            }
            @case ('paragraph') { <p>{{ block.text }}</p> }
            @case ('unordered') { <ul>@for (item of block.items; track $index) { <li>{{ item }}</li> }</ul> }
            @case ('ordered') { <ol>@for (item of block.items; track $index) { <li>{{ item }}</li> }</ol> }
          }
        }
      </div>
    </article>
  `,
  styles: [`
    article { max-width: 800px; margin-inline: auto; overflow-wrap: anywhere; }
    article > header { padding: 32px 32px 24px; border-bottom: 1px solid var(--color-border); }
    .eyebrow { margin: 0 0 8px; color: var(--color-primary); font-weight: 500; }
    dl { display: flex; flex-wrap: wrap; gap: 12px 24px; margin: 16px 0 0; }
    dl div { display: flex; gap: 8px; }
    dt { color: var(--color-text-muted); }
    dd { margin: 0; font-weight: 500; }
    .legal-copy { max-width: 75ch; padding: 24px 32px 40px; }
    .legal-copy h2, .legal-copy h3 { margin-top: 32px; }
    .legal-copy p, .legal-copy li { line-height: 1.5; }
    .legal-copy li + li { margin-top: 8px; }
    @media (max-width: 599px) {
      article > header, .legal-copy { padding-inline: 16px; }
      dl { display: grid; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsDocumentComponent {
  readonly version = input.required<TermsVersion>();
  readonly eyebrow = input('Documento vigente');
  readonly blocks = computed(() => parseSafeMarkdown(this.version().content));
  readonly effectiveDate = computed(() => {
    const value = this.version().effectiveAt;
    return value ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(new Date(value)) : 'No informada';
  });
}
