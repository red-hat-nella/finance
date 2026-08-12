import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FocusOnNavigationService {
  private readonly destroyRef = inject(DestroyRef);

  constructor(router: Router) {
    router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        window.setTimeout(() => {
          const heading = document.querySelector<HTMLElement>('h1');
          heading?.setAttribute('tabindex', '-1');
          heading?.focus({ preventScroll: true });
        });
      });
  }
}
