import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { VersionAdminFacade } from './version-admin.facade';

@Component({
  selector: 'terms-version-admin-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page-header">
      <div>
        <h1 tabindex="-1">{{ versionId ? 'Detalle de versión' : 'Versiones de términos' }}</h1>
        <p>Los documentos publicados son inmutables y cada cambio requiere una versión nueva.</p>
      </div>
      @if (!versionId) { <a class="primary-link" routerLink="/versions/new">Crear versión</a> }
      @else { <a routerLink="/versions">Volver a versiones</a> }
    </div>

    @switch (facade.state().kind) {
      @case ('loading') {
        <section class="state surface" aria-busy="true"><p>Consultando versiones…</p></section>
      }
      @case ('empty') {
        <section class="state surface"><h2>No hay versiones</h2><p>Crea el primer borrador jurídicamente aprobado.</p></section>
      }
      @case ('list') {
        <section class="surface list" aria-label="Versiones registradas">
          <table>
            <thead><tr><th scope="col">Versión</th><th scope="col">Título</th><th scope="col">Estado</th><th scope="col">Vigencia</th><th scope="col"><span class="sr-only">Acción</span></th></tr></thead>
            <tbody>@for (item of facade.items(); track item.versionId) {
              <tr><td>{{ item.versionCode }}</td><td>{{ item.title }}</td><td><span class="status">{{ item.state }}</span></td><td>{{ formatDate(item.effectiveAt) }}</td><td><a [routerLink]="['/versions', item.versionId]">Ver detalle</a></td></tr>
            }</tbody>
          </table>
          <div class="cards">@for (item of facade.items(); track item.versionId) {
            <article class="version-card"><h2>{{ item.versionCode }}</h2><p>{{ item.title }}</p><dl><div><dt>Estado</dt><dd>{{ item.state }}</dd></div><div><dt>Vigencia</dt><dd>{{ formatDate(item.effectiveAt) }}</dd></div></dl><a [routerLink]="['/versions', item.versionId]">Ver detalle</a></article>
          }</div>
        </section>
      }
      @case ('detail') {
        <article class="surface detail">
          <div class="detail-heading"><div><p class="eyebrow">{{ facade.version()!.versionCode }}</p><h2>{{ facade.version()!.title }}</h2></div><span class="status">{{ facade.version()!.state }}</span></div>
          <dl><div><dt>Vigencia</dt><dd>{{ formatDate(facade.version()!.effectiveAt) }}</dd></div><div><dt>Huella</dt><dd class="digest">{{ facade.version()!.contentSha256 }}</dd></div></dl>
          <div class="document"><pre>{{ facade.version()!.content }}</pre></div>
          @if (canSchedule(facade.version()!.state)) {
            <label for="effective-at">Fecha de vigencia</label>
            <input id="effective-at" type="datetime-local" [(ngModel)]="effectiveAt">
            <div class="actions"><button type="button" class="secondary danger" (click)="confirmWithdraw = true">Retirar versión</button><button type="button" class="primary" [disabled]="!effectiveAt" (click)="confirmSchedule = true">Programar publicación</button></div>
          }
        </article>
      }
      @case ('saving') { <section class="state surface" aria-busy="true"><p>Guardando cambios…</p></section> }
      @case ('conflict') { <section class="state surface" role="alert"><h2>Conflicto de vigencia</h2><p>{{ facade.message() }}</p><button (click)="reload()">Volver a cargar</button></section> }
      @case ('error') { <section class="state surface" role="alert"><h2>No fue posible completar la operación</h2><p>{{ facade.message() }}</p><button (click)="reload()">Intentar nuevamente</button></section> }
    }

    @if (confirmSchedule) {
      <div class="backdrop"><section class="dialog surface" role="dialog" aria-modal="true" aria-labelledby="schedule-title"><h2 id="schedule-title" tabindex="-1">Confirmar publicación</h2><p>Una versión publicada es inmutable. Verifica contenido y vigencia antes de confirmar.</p><div class="actions"><button class="secondary" (click)="confirmSchedule = false">Cancelar</button><button class="primary" (click)="schedule()">Confirmar publicación</button></div></section></div>
    }
    @if (confirmWithdraw) {
      <div class="backdrop"><section class="dialog surface" role="dialog" aria-modal="true" aria-labelledby="withdraw-title"><h2 id="withdraw-title" tabindex="-1">Confirmar retiro</h2><p>La versión dejará de estar disponible para publicación futura.</p><div class="actions"><button class="secondary" (click)="confirmWithdraw = false">Cancelar</button><button class="danger" (click)="withdraw()">Confirmar retiro</button></div></section></div>
    }
  `,
  styles: [`
    :host { display: block; }
    .primary-link, button { min-height: 44px; }
    .primary-link { display: inline-flex; align-items: center; padding-inline: 20px; border-radius: var(--radius-control); background: var(--color-primary); color: var(--color-on-primary); text-decoration: none; font-weight: 500; }
    .state, .detail { padding: 32px; }
    .list { overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 16px; border-bottom: 1px solid var(--color-border); text-align: left; }
    th { color: var(--color-text-muted); font-size: 14px; }
    .status { display: inline-block; padding: 4px 8px; border-radius: var(--radius-control); background: var(--color-primary-soft); color: var(--color-primary); font-weight: 500; }
    .cards { display: none; }
    .detail-heading, .actions { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .eyebrow { margin: 0 0 4px; color: var(--color-text-muted); }
    dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    dt { color: var(--color-text-muted); }
    dd { margin: 4px 0 0; }
    .digest { overflow-wrap: anywhere; font-family: monospace; }
    .document { max-height: 360px; margin-block: 24px; padding: 16px; overflow: auto; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface-subtle); }
    pre { margin: 0; white-space: pre-wrap; font-family: inherit; line-height: 1.5; }
    label { display: block; margin-bottom: 8px; font-weight: 500; }
    input { min-height: 44px; padding: 8px 12px; border: 1px solid var(--color-border-strong); border-radius: var(--radius-control); }
    .actions { justify-content: flex-end; margin-top: 24px; }
    button { padding-inline: 20px; border-radius: var(--radius-control); cursor: pointer; font-weight: 500; }
    .primary { border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-on-primary); }
    .secondary { border: 1px solid var(--color-border-strong); background: var(--color-surface); color: var(--color-primary); }
    .danger { border: 1px solid var(--color-danger); background: var(--color-surface); color: var(--color-danger-text); }
    .backdrop { position: fixed; inset: 0; z-index: var(--z-overlay); display: grid; place-items: center; padding: 16px; background: rgb(23 33 31 / 0.55); }
    .dialog { width: min(520px, 100%); padding: 32px; }
    @media (max-width: 599px) {
      table { display: none; }
      .cards { display: grid; gap: 12px; padding: 12px; }
      .version-card { padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-surface); }
      .version-card h2 { overflow-wrap: anywhere; }
      .version-card dl, .detail dl { grid-template-columns: 1fr; }
      .state, .detail, .dialog { padding: 24px 16px; }
      .actions { flex-direction: column-reverse; }
      .actions button { width: 100%; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersionAdminPageComponent implements OnInit {
  readonly facade = inject(VersionAdminFacade);
  private readonly route = inject(ActivatedRoute);
  versionId: string | null = null;
  effectiveAt = '';
  confirmSchedule = false;
  confirmWithdraw = false;

  ngOnInit(): void {
    this.versionId = this.route.snapshot.paramMap.get('versionId');
    void this.reload();
  }

  async reload(): Promise<void> {
    if (this.versionId) await this.facade.load(this.versionId);
    else await this.facade.list();
    window.setTimeout(() => document.querySelector<HTMLElement>('main h1, main [role="alert"]')?.focus());
  }

  async schedule(): Promise<void> {
    this.confirmSchedule = false;
    if (!this.versionId || !this.effectiveAt) return;
    const date = new Date(this.effectiveAt);
    if (Number.isNaN(date.getTime())) return;
    await this.facade.schedule(this.versionId, date.toISOString());
  }

  async withdraw(): Promise<void> {
    this.confirmWithdraw = false;
    if (this.versionId) await this.facade.withdraw(this.versionId);
  }

  canSchedule(state: string): boolean { return state === 'DRAFT' || state === 'SCHEDULED'; }
  formatDate(value?: string | null): string { return value ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Sin programar'; }
}
