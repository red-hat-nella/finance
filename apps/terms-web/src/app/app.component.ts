import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TermsShellComponent } from './layout/terms-shell.component';

@Component({
  selector: 'terms-root',
  standalone: true,
  imports: [TermsShellComponent],
  template: '<terms-shell />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
