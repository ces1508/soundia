import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideRouter, Routes } from '@angular/router';
import {
  provideServerRendering,
  withRoutes,
  RenderMode,
} from '@angular/ssr';
import { App } from './presentation/app';
import { appConfig } from './app.config';

/**
 * Rutas SOLO del servidor: el extractor de rutas del SSG lee el router
 * para saber qué páginas prerenderizar. El bundle del CLIENTE no incluye
 * el router (appConfig no lo tiene) — la deuda de 86 kB no vuelve.
 */
const serverOnlyRoutes: Routes = [{ path: '', component: App }];

/**
 * Config del lado servidor: solo se usa durante el prerender en build
 * (SSG). El HTML resultante se sirve estático; no hay server en runtime.
 */
const serverConfig: ApplicationConfig = {
  providers: [
    provideRouter(serverOnlyRoutes),
    provideServerRendering(
      withRoutes([{ path: '', renderMode: RenderMode.Prerender }]),
    ),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
