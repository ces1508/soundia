import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

/**
 * Punto de entrada para el prerendering (SSG): el builder ejecuta esta
 * función en Node durante `ng build`. El contexto llega como argumento
 * (el extractor crea la plataforma de servidor y la pasa aquí); por eso
 * se exporta una FUNCIÓN y no la llamada inmediata de bootstrapApplication.
 */
export default (context: BootstrapContext) =>
  bootstrapApplication(App, config, context);
