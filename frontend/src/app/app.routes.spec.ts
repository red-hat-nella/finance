import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { routes } from './app.routes';
import { FocusOnNavigationService } from './layout/focus-on-navigation.service';

describe('application routes', () => {
  it('keeps application and evaluation deep links lazy and role protected', () => {
    const applications = routes.find((route) => route.path === 'applications');
    const evaluations = routes.find((route) => route.path === 'evaluations');

    expect(applications?.loadChildren).toBeDefined();
    expect(applications?.canActivate?.length).toBe(2);
    expect(evaluations?.loadChildren).toBeDefined();
    expect(evaluations?.canActivate?.length).toBe(2);
  });

  it('focuses the page heading after navigation', async () => {
    const events = new Subject<NavigationEnd>();
    const focus = jasmine.createSpy('focus');
    const heading = document.createElement('h1');
    heading.tabIndex = -1;
    heading.focus = focus;
    document.body.appendChild(heading);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Router,
          useValue: { events: events.asObservable() },
        },
      ],
    });

    TestBed.inject(FocusOnNavigationService);
    events.next(new NavigationEnd(1, '/evaluations/id', '/evaluations/id'));
    await new Promise((resolve) => setTimeout(resolve));

    expect(focus).toHaveBeenCalled();
    heading.remove();
  });
});
