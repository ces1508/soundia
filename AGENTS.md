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

## Dónde vive la app

- `src/app/tracks.ts` — las 3 pistas: beats binaurales 10/6/40 Hz + progresiones de acordes. Los tonos L/R se derivan como `carrier ∓ beat/2` (simetría cubierta por test).
- `src/app/binaural-engine.service.ts` — todo el audio, 100% Web Audio API, sin assets. Par binaural vía `ChannelMerger` (aislamiento real L/R), colchón armónico con scheduler lookahead en loop infinito, fade-in 5 s / beat progresivo 30 s / fade-out 2 s. Cadena de salida: master → `AnalyserNode` (fftSize 2048) → destination; el visualizador lee con `getSpectrum()` (parámetro tipado `Uint8Array<ArrayBuffer>` por TS estricto).
- `src/app/app.{ts,html,css}` — playlist + player fijo. La duración se controla con `goalMinutes` (10/15/30/45/60/∞; `null` = sin límite): el tick del reloj hace auto-stop con fade-out al llegar; la barra de progreso usa `goalSeconds() ?? MIN_SESSION_SECONDS`. CSS **mobile-first** (base móvil, solo `@media (min-width:641px)` que añade; breakpoint compartido con el player). En móvil: tarjetas de pista estilo lista (`.meta` usa `display:contents` para apilar el texto a ancho completo) y player pegado al borde inferior estilo Spotify con la barra de progreso como filo superior; en desktop la tarjeta vuelve a fila centrada y el player flota con visualizador + volumen + reloj. Estilos del player viven en `src/styles.css` (global) porque `app.css` debe quedar bajo el budget de 6 kB warning por componente.
- `src/app/background/` — canvas de partículas fullscreen (tras el contenido, z-index -1); el tinte persigue el track activo. `src/app/visualizer/` — canvas de barras con `roundRect`; nº de barras adaptativo al ancho (el player mide ~150 px: con 56 fijas el ancho sale negativo y revienta).
- `src/app/audio-devices.service.ts` + `src/app/device-check/` — detección de auriculares (heurística sobre etiquetas de `enumerateDevices`; sin permiso de micro las etiquetas llegan vacías → estado `unknown`), selector nativo `selectAudioOutput` (Chromium, requiere gesto; su etiqueta se cachea) y enrutado vía `AudioContext.setSinkId` (Chromium; el motor aplica el sink en `start()` y `applySink()` re-ruta en caliente). `DeviceCheck` renderiza tarjetas de dispositivo (sin `<select>`) y la comprobación guiada L/R con `BinauralEngine.playSideTest()` (merger, un solo canal). GARANTÍA: la app NUNCA llama a `getUserMedia` — pedir el micro salta los BT a perfil manos-libres mono y mata el binaural; hay test que lo verifica.

## Convenciones del repo

- `ng generate` para archivos nuevos. Prettier con `.prettierrc` del scaffold.
- No añadir `zone.js` ni patrones `BrowserModule` de Angular viejo; no usar Karma ni APIs de audio fuera de Web Audio API.
- Avisos de seguridad/epilepsia del `app.html` ("about"/"warn") deben conservarse si se toca esa vista.
