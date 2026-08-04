import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class FocusOnNavigationService {
  constructor(router: Router) {
    router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
      )
      .subscribe(() =>
        setTimeout(() => document.querySelector<HTMLElement>('h1')?.focus()),
      );
  }
}
