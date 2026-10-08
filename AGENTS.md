# AGENTS.md

## Stack (verificado)

- **Angular 22.1** (standalone, sin `NgModule`s), npm 11, TypeScript ~6.0. Workspace en la raíz (`angular.json` → proyecto `soundia`). Vista única: sin `@angular/router` en el **cliente** (bajó el bundle −86 kB). El build de producción (213 kB raw / 68 kB gzip) requiere servirse con compresión: sin ella el transfer se triplica y Lighthouse lo penaliza. Resource hints (`preconnect`/`prefetch`/`modulepreload`) no aplican hoy: cero orígenes externos y cero chunks diferidos; revisarlos si se añade backend, fuentes web o lazy routes.
- **SSG + hidratación incremental**: `angular.json` tiene `prerender: true` + `outputMode: "static"` y el cliente `provideClientHydration()`. El router existe SOLO en `app.config.server.ts` (`provideRouter` + `provideServerRendering(withRoutes([...Prerender]))`) porque el extractor de rutas del builder lo exige; el bundle cliente no lo contiene. `main.server.ts` debe exportar una FUNCIÓN `(context) => bootstrapApplication(App, config, context)` — exportar la llamada inmediata rompe el prerender con NG0401 ("No platform exists"). Deps alineadas al patch exacto: `@angular/ssr@22.1.9` + `@angular/platform-server@22.1.5` + `@angular/router@22.1.5` (los peers de Angular en patches son exactos; `~` cruza a 22.2 y rompe la resolución). `DeviceCheck` vive en `@defer (hydrate on viewport; prefetch on idle)` → chunk diferido de ~11 kB que se descarga en idle y se hidrata al entrar en viewport; el contenido es visible pre-hidratación porque el SSG prerenderiza el bloque. Las secciones template-only (hero, about) no se pueden deferir sin extraerlas a componente — no hacerlo sin evidencia de beneficio.
- **Tests en Vitest, no Karma**: `npm test` usa el builder `@angular/build:unit-test` en Node + jsdom. No hay Chrome ni `--browsers`. Los tests no deben tocar `AudioContext` al importar/instanciar (el engine lo crea solo en `start()`, con guarda `typeof window`).
- Budgets de producción (`angular.json`): initial máx 1 MB error / 500 kB warning; estilos por componente máx 8 kB error / 6 kB warning (subido de 4 kB: `app.css` roza el límite). `npm run build` usa config production por defecto.

## Comandos

```bash
npm start          # ng serve → http://localhost:4200
npm test           # una pasada de Vitest
npm run build      # build producción a dist/soundia
```

## Dónde vive la app (Clean Architecture)

- **Regla de dependencia**: `domain/` no importa nada de `data/` ni `presentation/`; `presentation/` habla con puertos (tokens), nunca con adaptadores concretos. Auditoría: `grep -rn "@angular" src/app/domain/` solo debe mostrar `import type { Signal }` (dependencia de tipos, cero runtime).
- `src/app/domain/model/` — negocio puro: `tracks.ts` (TRACKS + `deriveStereoPair`: carrier ∓ beat/2 + tipo `Waveform` propio, no `OscillatorType`), `session.ts` (MIN_SESSION_SECONDS, SESSION_GOAL_OPTIONS, `resolveGoalSeconds`, `resolveProgressReference`), `device.ts` (OutputDevice, HeadphoneState, regla `isHeadphoneLabel`), `playback.ts` (PlaybackState, TestSide).
- `src/app/domain/ports/` — contratos: `audio-synth.port.ts` y `audio-devices.port.ts`. Exponen `Signal` de solo lectura; mutar es del adaptador.
- `src/app/data/` — adaptadores: `binaural-engine.service.ts` (BinauralEngine implements AudioSynthPort; Web Audio API, ChannelMerger L/R, scheduler lookahead), `audio-devices.service.ts` (AudioDevices implements AudioDevicesPort; enumerateDevices/selectAudioOutput/setSinkId), `di.ts` (tokens AUDIO_SYNTH/AUDIO_DEVICES + DATA_PROVIDERS = único punto que conoce implementaciones). Los adaptadores NO tienen `providedIn: root`: los provee DATA_PROVIDERS (los specs deben inyectarlos también).
- `src/app/presentation/` — `app.{ts,html,css}` (playlist+player; orquesta: tras `engine.start()` llama `engine.applySink(devices.selectedId())`), `device-check/` (tarjetas + test guiado; `pick()` → `devices.pick` + `engine.applySink(device.deviceId)`), `background/`, `visualizer/` (canvas; inyectan AUDIO_SYNTH).
- GARANTÍA sin cambios: la app NUNCA llama a `getUserMedia` (test en `data/audio-devices.service.spec.ts` lo verifica a través de los puertos).
- Player/estilos mobile-first: `src/styles.css` (global) + `presentation/app.css` mobile-first (base móvil, `@media (min-width:641px)` añade). En móvil player pegado abajo estilo Spotify con progreso como filo superior; tarjetas con `.meta { display:contents }`.
- SSG + hidratación: prerender + `provideClientHydration()` + router solo en `app.config.server.ts`; `main.server.ts` exporta FUNCIÓN `(context) => bootstrapApplication(...)`. `DeviceCheck` en `@defer (on viewport; hydrate on interaction; prefetch on idle)` con `@placeholder` (chunk `device-check` ~11 kB; jsdom loguea ruido de IntersectionObserver por el trigger viewport: no es fallo).

## Convenciones del repo

- `ng generate` para archivos nuevos. Prettier con `.prettierrc` del scaffold.
- No añadir `zone.js` ni patrones `BrowserModule` de Angular viejo; no usar Karma ni APIs de audio fuera de Web Audio API.
- Avisos de seguridad/epilepsia del `app.html` ("about"/"warn") deben conservarse si se toca esa vista.
