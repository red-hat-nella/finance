import { bootstrapApplication } from '@angular/platform-browser';
import { createAppConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { loadRuntimeConfig } from './app/core/config/runtime-config';

loadRuntimeConfig()
  .then((config) => bootstrapApplication(AppComponent, createAppConfig(config)))
  .catch(() => {
    document.body.innerHTML = '<main class="startup-error"><h1>No se pudo iniciar la aplicación</h1><p>Revise la configuración e intente nuevamente.</p></main>';
  });
