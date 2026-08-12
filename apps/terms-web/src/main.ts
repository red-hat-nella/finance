import { bootstrapApplication } from '@angular/platform-browser';
import { createAppConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { loadRuntimeConfig } from './app/core/config/runtime-config';

loadRuntimeConfig()
  .then((runtimeConfig) => bootstrapApplication(AppComponent, createAppConfig(runtimeConfig)))
  .catch(() => {
    document.body.innerHTML = '<main class="startup-error" tabindex="-1"><h1>No se pudo iniciar términos y condiciones</h1><p>Revise la configuración e intente nuevamente.</p></main>';
    document.querySelector<HTMLElement>('.startup-error')?.focus();
  });
