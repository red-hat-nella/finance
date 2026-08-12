import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AcceptanceAuditFacade } from './acceptance-audit.facade';

@Component({ selector: 'terms-acceptance-audit-page', standalone: true, imports: [ReactiveFormsModule], template: `
  <div class="page-header"><div><h1 tabindex="-1">Aceptaciones</h1><p>Consulta evidencia enmascarada de tu ámbito en modo de solo lectura.</p></div></div>
  <form class="surface filters">
    <label>Actor público<input [formControl]="filters.controls.actorPublicId" maxlength="128"></label>
    <label>Versión<input [formControl]="filters.controls.versionCode" maxlength="64"></label>
    <label>Desde<input type="date" [formControl]="filters.controls.from"></label>
    <label>Hasta<input type="date" [formControl]="filters.controls.to"></label>
    <button class="primary" type="button" (click)="search()">Buscar aceptaciones</button>
  </form>
  @switch (facade.state().kind) {
    @case ('loading') { <section class="state surface" aria-busy="true"><p>Consultando aceptaciones…</p></section> }
    @case ('empty') { <section class="state surface"><h2>No encontramos aceptaciones</h2><p>Ajusta los filtros e intenta nuevamente.</p></section> }
    @case ('results') { <section class="surface results"><table><thead><tr><th>Actor</th><th>Versión</th><th>Fecha</th><th>Identificador</th></tr></thead><tbody>@for(item of facade.items();track item.acceptanceId){<tr><td>{{item.actorDisplay ?? 'Anonimizado'}}</td><td>{{item.versionCode}}</td><td>{{format(item.acceptedAt)}}</td><td class="id">{{item.acceptanceId}}</td></tr>}</tbody></table><div class="cards">@for(item of facade.items();track item.acceptanceId){<article class="acceptance-card"><h2>{{item.versionCode}}</h2><dl><div><dt>Actor</dt><dd>{{item.actorDisplay ?? 'Anonimizado'}}</dd></div><div><dt>Fecha</dt><dd>{{format(item.acceptedAt)}}</dd></div><div><dt>ID</dt><dd class="id">{{item.acceptanceId}}</dd></div></dl></article>}</div></section> }
    @case ('invalid') { <section class="state surface" role="alert"><p>{{facade.message()}}</p></section> }
    @case ('denied') { <section class="state surface" role="alert"><h2>Acceso denegado</h2><p>{{facade.message()}}</p></section> }
    @case ('unavailable') { <section class="state surface" role="alert"><h2>Consulta no disponible</h2><p>{{facade.message()}}</p><button (click)="search()">Intentar nuevamente</button></section> }
  }
`, styles: [`
  .filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;padding:24px;margin-bottom:24px}.filters label{display:grid;gap:8px;font-weight:500}.filters input{min-width:0;min-height:44px;padding:8px;border:1px solid var(--color-border-strong);border-radius:var(--radius-control)}button{min-height:44px;padding-inline:20px;border-radius:var(--radius-control);cursor:pointer}.primary{grid-column:4;border:1px solid var(--color-primary);background:var(--color-primary);color:var(--color-on-primary)}.state{padding:32px}.results{overflow:hidden}table{width:100%;border-collapse:collapse}th,td{padding:16px;border-bottom:1px solid var(--color-border);text-align:left}.id{overflow-wrap:anywhere;font-family:monospace}.cards{display:none}@media(max-width:959px){.filters{grid-template-columns:repeat(2,minmax(0,1fr))}.primary{grid-column:2}}@media(max-width:599px){.filters{grid-template-columns:1fr;padding:16px}.primary{grid-column:auto}table{display:none}.cards{display:grid;gap:12px;padding:12px}.acceptance-card{padding:16px;border:1px solid var(--color-border);border-radius:var(--radius-surface)}dl{display:grid;gap:12px}dt{color:var(--color-text-muted)}dd{margin:2px 0 0}}
`], changeDetection: ChangeDetectionStrategy.OnPush })
export class AcceptanceAuditPageComponent {
  readonly facade=inject(AcceptanceAuditFacade);
  readonly filters=new FormGroup({actorPublicId:new FormControl('',{nonNullable:true}),versionCode:new FormControl('',{nonNullable:true}),from:new FormControl('',{nonNullable:true}),to:new FormControl('',{nonNullable:true})});
  async search():Promise<void>{const value=this.filters.getRawValue();await this.facade.search({actorPublicId:value.actorPublicId||undefined,versionCode:value.versionCode||undefined,from:value.from?new Date(`${value.from}T00:00:00Z`).toISOString():undefined,to:value.to?new Date(`${value.to}T23:59:59Z`).toISOString():undefined,limit:25});window.setTimeout(()=>document.querySelector<HTMLElement>('main [role="alert"], main h2')?.focus());}
  format(value:string):string{return new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
}
