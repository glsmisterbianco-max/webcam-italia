# Webcam Italia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA per cellulare: cartina dell'Italia con le webcam pubbliche (Windy + OpenStreetMap), lista sotto la mappa con meteo/onde/% pioggia, dettaglio con immagine/timelapse, ricerca, posizione e preferiti.

**Architecture:** Sito statico senza backend (Windy consente CORS dal browser, verificato con preflight il 2026-10-22). La chiave Windy la inserisce l'utente nell'app e resta nel localStorage del telefono (mai nel repo). Le webcam OSM sono estratte da uno script Node in un file JSON statico servito con l'app. La logica sta in moduli ES puri (testati con `node --test`, fetch e storage iniettati); i moduli UI li collegano a Leaflet e al DOM.

**Tech Stack:** HTML/CSS/JS vanilla (moduli ES, nessun bundler), Leaflet 1.9.4 + Leaflet.markercluster 1.5.3 da unpkg, Node 24 (`node --test`) per test e script, Open-Meteo (forecast, marine, geocoding), Windy Webcams API v3, Overpass API. Hosting: GitHub Pages (HTTPS, necessario per GPS e service worker).

**Spec:** `docs/2026-10-22-webcam-italia-design.md`

## Global Constraints

- UI interamente in italiano.
- Costo zero, nessun abbonamento; Windy solo piano Free.
- Solo webcam pubblicate intenzionalmente: fonti ammesse solo Windy e OSM. Nessuno scraping, nessuna scansione di IP/porte, nessuna fonte stile Insecam.
- Le URL immagine Windy scadono (10–15 min): non vanno mai salvate in localStorage né in cache del service worker.
- Attribuzioni visibili: "Webcam: Windy.com" con link, "© OpenStreetMap contributors", "Meteo: Open-Meteo.com (CC BY 4.0)".
- Layout B: metà alta mappa, metà bassa lista; barra di ricerca con ⭐ in alto, pulsante 📍.
- Nessun account, nessun backend.
- Overpass/Nominatim: User-Agent `WebcamItalia/1.0 (uso personale)`; lo script OSM non gira mai dal telefono.

## Review Focus

1. **Chiave Windy mancante o non valida (401/403):** l'app funziona lo stesso con le sole webcam OSM e mostra il banner "Chiave Windy mancante o non valida — tocca per inserirla". → test in Task 3 e Task 8.
2. **GPS negato o non disponibile:** la mappa resta sull'Italia intera con il messaggio "Posizione non disponibile". → test in Task 8 (`locate` con geolocation finta che fallisce).
3. **App lasciata aperta oltre 10 minuti:** l'immagine scaduta (errore di caricamento) viene richiesta di nuovo una sola volta tramite `fetchWindyById`, senza loop. → test in Task 3.
4. **Webcam nell'entroterra:** Marine API restituisce null → onde e temperatura del mare nascosti, mai "null" o "NaN" a schermo. → test in Task 4 e Task 7.
5. **Open-Meteo irraggiungibile:** le righe mostrano "—" al posto dei valori e la lista si vede comunque. → test in Task 4 e Task 7.

---

## File Structure

```
WebcamItalia/
  package.json                 type:module, scripts test/build:osm/serve
  .gitignore                   node_modules/, .superpowers/
  public/
    index.html                 shell: barra ricerca, mappa, lista, dettaglio, banner
    style.css
    manifest.webmanifest
    sw.js                      cache app shell (no API, no immagini Windy)
    icons/icon-192.png, icon-512.png
    data/osm-webcams.json      generato da scripts/build-osm.mjs
    js/
      geo.js                   distanze, bbox, dedupe, ordinamento
      windy.js                 client Windy + normalizzazione
      osm.js                   carica e filtra il JSON OSM
      weather.js               Open-Meteo forecast+marine, cache 10 min
      geocode.js               ricerca località (Open-Meteo geocoding)
      favorites.js             preferiti su storage
      settings.js              chiave Windy su storage
      format.js                testi riga/dettaglio ("24°", "12 km/h NO", "—")
      map.js                   Leaflet + cluster (UI)
      list.js                  render lista (UI)
      detail.js                pannello dettaglio (UI)
      app.js                   orchestrazione (UI)
  scripts/build-osm.mjs        Overpass → controllo link → public/data/osm-webcams.json
  test/*.test.mjs
```

**Modello comune `Cam`** (prodotto da windy.js e osm.js, usato ovunque):

```js
{ id: 'windy:1234' | 'osm:node/567', source: 'windy' | 'osm',
  name: string, place: string, lat: number, lon: number,
  thumb: string|null, preview: string|null,   // solo Windy, scadono
  player: string|null,                         // URL timelapse Windy (iframe)
  page: string|null }                          // pagina proprietario / windy.com
```

---

### Task 1: Scaffold progetto + geo.js

**Files:**
- Create: `package.json`, `.gitignore`, `public/js/geo.js`, `test/geo.test.mjs`

**Interfaces:**
- Produces:
  - `distanceKm(a: {lat,lon}, b: {lat,lon}) -> number` (haversine)
  - `inBounds(p: {lat,lon}, b: {north,south,east,west}) -> boolean`
  - `dedupe(cams: Cam[], radiusM = 150) -> Cam[]`: se una cam OSM è entro `radiusM` da una cam Windy, tiene solo la Windy; per il resto mantiene l'ordine
  - `sortByDistance(cams: Cam[], from: {lat,lon}) -> Cam[]` (nuovo array)

- [ ] **Step 1:** `git init` in `WebcamItalia/`, crea `.gitignore` (`node_modules/`, `.superpowers/`) e `package.json` con `"type":"module"` e gli script `"test": "node --test test/"`, `"build:osm": "node scripts/build-osm.mjs"`, `"serve": "npx --yes serve public -l 5173"`.
- [ ] **Step 2: Scrivi il test che fallisce** `test/geo.test.mjs`:

```js
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { distanceKm, inBounds, dedupe, sortByDistance } from '../public/js/geo.js';
const catania = { lat: 37.5079, lon: 15.0830 }, palermo = { lat: 38.1157, lon: 13.3615 };
test('distanceKm Catania-Palermo ~166 km', () => {
  const d = distanceKm(catania, palermo); assert.ok(d > 160 && d < 172);
});
test('inBounds', () => {
  const b = { north: 38, south: 37, east: 16, west: 14 };
  assert.equal(inBounds(catania, b), true); assert.equal(inBounds(palermo, b), false);
});
test('dedupe drops OSM near Windy, keeps far OSM', () => {
  const w = { id: 'windy:1', source: 'windy', ...catania };
  const near = { id: 'osm:node/1', source: 'osm', lat: 37.5085, lon: 15.0830 }; // ~70 m
  const far = { id: 'osm:node/2', source: 'osm', ...palermo };
  assert.deepEqual(dedupe([near, w, far]).map(c => c.id), ['windy:1', 'osm:node/2']);
});
test('sortByDistance', () => {
  const cams = [{ id: 'p', ...palermo }, { id: 'c', ...catania }];
  assert.deepEqual(sortByDistance(cams, catania).map(c => c.id), ['c', 'p']);
});
```
Nota: `dedupe` restituisce l'ordine originale meno gli scartati → `['windy:1','osm:node/2']`.

- [ ] **Step 3:** `npm test` → FAIL (modulo mancante).
- [ ] **Step 4:** Implementa `public/js/geo.js` (solo funzioni pure, nessun import).
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6:** Commit `feat: scaffold progetto e utilità geografiche`.

---

### Task 2: settings.js + favorites.js

**Files:**
- Create: `public/js/settings.js`, `public/js/favorites.js`, `test/storage.test.mjs`

**Interfaces:**
- Consumes: modello `Cam`.
- Produces:
  - `createSettings(storage) -> { getWindyKey(): string|null, setWindyKey(k: string): void }`. Chiave storage `wi.windyKey`; `setWindyKey('')` o solo spazi rimuove la chiave.
  - `createFavorites(storage) -> { list(): Cam[], has(id): boolean, add(cam): void, remove(id): void, toggle(cam): boolean }`. Chiave `wi.favorites`. `add` salva la cam **con `thumb`, `preview` e `player` impostati a null**. `toggle` restituisce il nuovo stato. JSON corrotto nello storage → `list()` restituisce `[]`.
  - `storage` è un oggetto `{ getItem, setItem, removeItem }`; in app si passa `localStorage`, nei test un Map adapter. Ogni accesso è in try/catch.

- [ ] **Step 1: Test che falliscono** (`test/storage.test.mjs`): aggiungere una cam con `preview:'https://x'` e verificare che `list()[0].preview === null`; `toggle` restituisce true e poi false; dopo `setItem('wi.favorites','{rotto')` `list()` restituisce `[]`; `setWindyKey('  ')` seguito da `getWindyKey()` restituisce `null`; uno storage che lancia eccezioni su ogni metodo non fa crashare nessuna funzione.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa i due moduli.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: preferiti e impostazioni su storage locale`.

---

### Task 3: windy.js

**Files:**
- Create: `public/js/windy.js`, `test/windy.test.mjs`, `test/fixtures/windy-list.json`

**Interfaces:**
- Consumes: `Cam`.
- Produces:
  - `class WindyAuthError extends Error` (per 401/403)
  - `normalizeWindy(w) -> Cam|null`. Mappa i campi così: `id:'windy:'+w.webcamId`, `name:w.title`, `place:[location.city, location.region].filter(Boolean).join(', ')`, `lat/lon: location.latitude/longitude`, `thumb: images.current.thumbnail`, `preview: images.current.preview`, `player: player.day ?? player.lifetime ?? null`, `page: urls.detail ?? null`. Se non ci sono le coordinate restituisce null.
  - `fetchWindyInBounds(bounds, { key, fetch, max = 200 }) -> Promise<{ cams: Cam[], total: number }>`. Chiama `GET https://api.windy.com/webcams/api/v3/webcams?bbox={north},{east},{south},{west}&limit=50&offset={n}&include=images,location,player,urls` con l'header `x-windy-api-key`. Pagina a blocchi di 50 fino a `max` o fino a `total`. Senza chiave restituisce `{cams:[],total:0}` senza chiamare la rete. 401/403 → `WindyAuthError`; altri errori → `Error`.
  - `fetchWindyById(id: number, { key, fetch }) -> Promise<Cam|null>`: `GET .../webcams/{id}?include=images,location,player,urls`

- [ ] **Step 1:** Crea `test/fixtures/windy-list.json` con `{ "total": 2, "webcams": [ ... ] }`. La prima webcam ha tutti i campi (`webcamId`, `title`, `location{city,region,latitude,longitude}`, `images.current{thumbnail,preview}`, `player{day,lifetime}`, `urls{detail}`); la seconda non ha `location.latitude`.
- [ ] **Step 2: Test che falliscono:**
  - `normalizeWindy` sulla prima webcam produce il `Cam` atteso (deepEqual) e sulla seconda restituisce `null`.
  - Con un fetch finto che registra le URL, `fetchWindyInBounds({north:38,south:37,east:16,west:14},{key:'K',fetch})` chiama una URL che contiene `bbox=38,16,37,14`, `limit=50`, `offset=0`, con l'header `x-windy-api-key: K`, e restituisce 1 cam con total 2.
  - Con `total: 120` e 50 risultati per pagina servono 3 chiamate (offset 0, 50, 100); con `max:100` le chiamate sono 2.
  - Senza chiave non c'è nessuna chiamata fetch.
  - Una risposta 401 lancia `WindyAuthError` (Review Focus 1).
  - `fetchWindyById(1234,…)` chiama `/webcams/1234?include=...` (Review Focus 3, il re-fetch della URL scaduta).
- [ ] **Step 3:** `npm test` → FAIL.
- [ ] **Step 4:** Implementa `windy.js`.
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6: Verifica sul vero (serve la chiave dell'utente).** Esegui `curl -s -H "x-windy-api-key: $KEY" "https://api.windy.com/webcams/api/v3/webcams?bbox=38,16,37,14&limit=1&include=images,location,player,urls"`. Il formato del parametro `bbox` e i nomi dei campi non sono documentati pubblicamente (sono stati scritti a memoria). Se differiscono, correggi **solo** `normalizeWindy` o la costruzione della URL e aggiorna la fixture con la risposta reale (anonimizzata), poi `npm test` → PASS. Se la chiave non è ancora disponibile, segna lo step come bloccato e prosegui.
- [ ] **Step 7:** Commit `feat: client Windy Webcams`.

---

### Task 4: weather.js + format.js

**Files:**
- Create: `public/js/weather.js`, `public/js/format.js`, `test/weather.test.mjs`, `test/format.test.mjs`

**Interfaces:**
- Produces:
  - `type Conditions = { temp: number|null, wind: number|null, windDir: number|null, rainPct: number|null, rainNext: {time:string,pct:number}[], wave: number|null, waveDir: number|null, seaTemp: number|null }`
  - `fetchConditions(points: {lat,lon}[], { fetch, now = Date.now }) -> Promise<Map<string, Conditions|null>>`. La chiave della mappa è `` `${lat.toFixed(2)},${lon.toFixed(2)}` `` (esportata come `pointKey(p)`). Fa una sola chiamata forecast e una sola marine per tutti i punti non in cache (Open-Meteo accetta coordinate separate da virgola e restituisce un array se i punti sono più di uno, un oggetto se è uno solo):
    - forecast: `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=temperature_2m,wind_speed_10m,wind_direction_10m&hourly=precipitation_probability&forecast_hours=6&timezone=Europe%2FRome`
    - marine: `https://marine-api.open-meteo.com/v1/marine?latitude=..&longitude=..&current=wave_height,wave_direction,sea_surface_temperature`
    - `rainPct` = massimo di `precipitation_probability` nelle prime 3 ore; `rainNext` = le 6 ore.
    - Cache in memoria di 10 minuti per `pointKey`.
    - Se il forecast fallisce, i punti valgono `null`. Se fallisce solo il marine, i campi mare valgono `null` e il resto resta valido (Review Focus 4 e 5).
  - `format.js`:
    - `fmtTemp(n) -> '24°'|'—'`
    - `fmtWind(kmh, deg) -> '12 km/h NO'|'—'` (8 settori: N, NE, E, SE, S, SO, O, NO)
    - `fmtWave(m) -> '0,6 m'|null` (null → la UI nasconde il campo)
    - `fmtRain(pct) -> '30%'|'—'`
    - `rowSummary(c: Conditions|null) -> string`, cioè le parti non nulle unite da ' · ' (es. `'24° · 12 km/h NO · onde 0,6 m · pioggia 30%'`). Con `c === null` restituisce `'—'`.

- [ ] **Step 1: Test che falliscono:**
  - `fmtWind(12, 315) === '12 km/h NO'`, `fmtWind(null, 10) === '—'`.
  - `fmtWave(0.6) === '0,6 m'`, `fmtWave(null) === null`, `fmtTemp(NaN) === '—'`.
  - `rowSummary` senza onde non contiene "onde", "null" né "NaN". `rowSummary(null) === '—'`.
  - Con un fetch finto (forecast con 2 punti → array, marine con `wave_height: null` per il secondo punto) il primo punto ha `wave: 0.6` e il secondo `wave: null` mentre `temp` è valorizzato.
  - Con le ore `[10, 40, 20, 90, 0, 0]` risulta `rainPct === 40`.
  - Con un fetch che lancia eccezione tutti i valori sono `null` e la funzione non lancia.
  - Una seconda chiamata entro 10 minuti con gli stessi punti non fa fetch.
  - Con un solo punto (risposta oggetto e non array) il risultato è corretto.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: condizioni meteo-marine da Open-Meteo`.

---

### Task 5: Script OSM + osm.js

**Files:**
- Create: `scripts/build-osm.mjs`, `public/js/osm.js`, `public/data/osm-webcams.json`, `test/osm.test.mjs`

**Interfaces:**
- Produces:
  - `scripts/build-osm.mjs` esporta `parseOverpass(json) -> Cam[]`. Per i `node` usa `lat/lon`, per `way/relation` usa `center`; prende l'URL dai tag `contact:webcam` → `webcam` → `camera:url` → `website`, e scarta l'elemento se non è http(s). Il nome è `name` oppure `'Webcam'`, `place` è `addr:city` oppure `''`, `id` è `'osm:'+type+'/'+id`, e `thumb`, `preview` e `player` sono tutti `null`. Esporta anche `checkLinks(cams, { fetch, concurrency = 8, timeoutMs = 8000 }) -> Promise<Cam[]>`, che tiene le cam la cui pagina risponde con status < 400: prima prova HEAD e, se fallisce o restituisce 405, prova GET. Eseguito come script (`npm run build:osm`) interroga Overpass e scrive il JSON ordinato per id. Endpoint: `https://overpass-api.de/api/interpreter`, con fallback su `https://overpass.kumi.systems/api/interpreter` e 3 tentativi con backoff 5/10/20 s. Query:
    `[out:json][timeout:180];area["ISO3166-1"="IT"][admin_level=2]->.a;(nwr["contact:webcam"](area.a);nwr["webcam"](area.a);nwr["camera:url"](area.a););out center tags;`
  - `public/js/osm.js`:
    - `loadOsm({ fetch, url = 'data/osm-webcams.json' }) -> Promise<Cam[]>`: carica una sola volta e tiene il risultato in memoria; in caso di errore restituisce `[]`.
    - `osmInBounds(cams, bounds) -> Cam[]` (usa `inBounds` da geo.js).

- [ ] **Step 1: Test che falliscono** (`test/osm.test.mjs`):
  - `parseOverpass` su una fixture inline con 4 elementi: un node con `contact:webcam`, una way con `center` e `webcam`, un node con URL `ftp://`, un node senza URL. Restituisce 2 cam con gli id `osm:node/…` e `osm:way/…`.
  - `checkLinks` con un fetch finto (una pagina 200, una 404, una che va in timeout, una con HEAD 405 e GET 200) tiene 2 cam.
  - `osmInBounds` filtra correttamente.
  - Se `loadOsm` riceve un errore restituisce `[]`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `npm run build:osm`. Atteso: viene creato `public/data/osm-webcams.json`, che è un array non vuoto, e lo script stampa quante cam sono state trovate e quante tenute. Se Overpass resta irraggiungibile, crea il file con `[]`, segnalalo nel report e prosegui.
- [ ] **Step 6:** Commit `feat: webcam OpenStreetMap estratte in JSON statico`.

---

### Task 6: geocode.js

**Files:**
- Create: `public/js/geocode.js`, `test/geocode.test.mjs`

**Interfaces:**
- Produces: `searchPlaces(q: string, { fetch }) -> Promise<{name:string, detail:string, lat:number, lon:number}[]>`.
  - Chiama `https://geocoding-api.open-meteo.com/v1/search?name={q}&count=6&language=it&countryCode=IT`.
  - `detail` è formato da `admin2` e `admin1` uniti con ', '.
  - Se la query, tolti gli spazi, è più corta di 2 caratteri restituisce `[]` senza fare fetch.
  - Se `results` manca o c'è un errore restituisce `[]`.

- [ ] **Step 1: Test che falliscono:**
  - La URL contiene `countryCode=IT` e il nome codificato (`San%20Vito`).
  - Il mapping dei campi è corretto.
  - `'a'` non chiama fetch.
  - Una risposta senza `results` produce `[]`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: ricerca località`.

---

### Task 7: Interfaccia — shell, mappa, lista, dettaglio

**Files:**
- Create: `public/index.html`, `public/style.css`, `public/js/map.js`, `public/js/list.js`, `public/js/detail.js`, `test/list.test.mjs`

**Interfaces:**
- Consumes: `Cam`, `Conditions`, i formattatori di `format.js`, `favorites.has`.
- Produces:
  - `map.js`: `createMap(el, { onMoveEnd(bounds, center), onSelect(cam) }) -> { setCams(cams: Cam[]), flyTo(lat, lon, zoom = 12), fitItaly(), getBounds(), highlight(id) }`.
    - Usa Leaflet 1.9.4 con tile OSM e l'attribuzione richiesta.
    - I marker sono raggruppati in cluster con markercluster 1.5.3.
    - I marker Windy sono pieni di colore blu; i marker OSM sono a contorno verde.
    - `fitItaly()` usa i limiti `[[35.4, 6.6], [47.1, 18.6]]`.
    - `onMoveEnd` ha un debounce di 400 ms.
  - `list.js`: `renderRowHtml(cam, cond, isFav) -> string`, funzione pura testata in Node. La riga contiene:
    - una miniatura `<img>` solo se `cam.thumb`, altrimenti un segnaposto con l'icona di una telecamera;
    - il nome;
    - `rowSummary(cond)`;
    - ★ se è un preferito.

    Esporta anche `renderList(el, rows, { onSelect, header })`, dove `header` è un testo tipo `"Vicino a te · 18 webcam"` oppure `"Mostrate 200 di 640 — avvicina la mappa per vederle tutte"`. Il testo va sempre escapato (`escapeHtml` esportata da `list.js`).
  - `detail.js`: `openDetail(el, cam, cond, { isFav, onToggleFav, onImageError, onClose })`. Contiene:
    - per le cam Windy, l'immagine `preview`, che al primo errore chiama `onImageError(cam)` una sola volta (Review Focus 3);
    - un pulsante "Timelapse" che apre `player` in un `<iframe>` (`loading=lazy`);
    - un pulsante "Guarda dal vivo" che apre `cam.page` in una nuova scheda; per le cam OSM è l'azione principale e c'è al posto dell'immagine;
    - temperatura, vento e % di pioggia, con le prossime 6 ore in una mini-tabella;
    - onde e temperatura del mare solo se non nulle;
    - la stella dei preferiti;
    - l'attribuzione "Webcam: Windy.com" per le cam Windy.
  - `index.html`:
    - la barra in alto contiene `<input id="search" placeholder="Cerca località…">`, `#btn-fav` (⭐) e `#btn-locate` (📍);
    - sotto la barra `#banner` (nascosto), poi `#map` (50vh) e `#list` (resto, scroll);
    - `#detail` è un pannello a tutto schermo che scorre dal basso;
    - `#results` è il menu a tendina dei risultati della ricerca;
    - in basso ci sono le attribuzioni;
    - viewport `width=device-width, initial-scale=1, viewport-fit=cover`, `<html lang="it">`;
    - i target da toccare sono almeno 44px e il contrasto deve essere leggibile al sole.

- [ ] **Step 1: Test che falliscono** (`test/list.test.mjs`):
  - `renderRowHtml` con una cam OSM non contiene `<img`.
  - Una cam Windy contiene `src="https://thumb"`.
  - Con `cond = null` contiene `—`.
  - Un nome `<script>` viene escapato.
  - Con `isFav` contiene `★`.
  - Non contiene mai `null`, `undefined` o `NaN` (Review Focus 4 e 5).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa `list.js`, poi `map.js`, `detail.js`, `index.html` e `style.css`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: interfaccia mappa, lista e dettaglio`.

---

### Task 8: app.js — orchestrazione, ricerca, posizione, preferiti, chiave

**Files:**
- Create: `public/js/app.js`, `test/app.test.mjs`

**Interfaces:**
- Consumes: tutto quanto sopra.
- Produces:
  - `loadView(bounds, center, deps) -> Promise<{ cams: Cam[], total: number, windyError: 'auth'|'net'|null }>`, funzione pura testabile.
    - `deps = { key, fetch, osmCams, maxWindy: 200 }`.
    - Prende le cam Windy nel riquadro e le cam OSM nello stesso riquadro, le unisce, applica `dedupe` e le ordina con `sortByDistance(center)`.
    - Con `WindyAuthError` restituisce le sole cam OSM e `windyError: 'auth'`; con altri errori Windy restituisce le cam OSM e `'net'`.
  - `locate(geolocation) -> Promise<{lat,lon}|null>`: con un timeout di 10 s, oppure con un errore o un permesso negato, restituisce `null`.
  - Il flusso di `init()` nel browser è questo:
    1. legge la chiave;
    2. carica le cam OSM;
    3. prova `locate`: se riesce chiama `flyTo(pos, 11)` con l'intestazione "Vicino a te", se fallisce chiama `fitItaly()` e mostra il banner "Posizione non disponibile";
    4. a ogni `onMoveEnd` chiama `loadView` e poi `fetchConditions` sulle prime 30 cam della lista, mentre le righe si mostrano subito e i valori meteo arrivano dopo;
    5. con `windyError === 'auth'` o senza chiave mostra il banner "Chiave Windy mancante o non valida — tocca per inserirla", che apre un `prompt` semplice dentro la pagina (non `window.prompt`) e salva con `setWindyKey`.
  - La ricerca ha un debounce di 300 ms e usa `searchPlaces`; quando si sceglie un risultato chiama `flyTo(lat, lon, 12)`.
  - ⭐ mostra nella lista `favorites.list()` con l'intestazione "Preferiti". Quando si apre un preferito Windy, `fetchWindyById` aggiorna `preview` e `player`.
  - `onImageError` chiama `fetchWindyById` una sola volta e aggiorna l'immagine. Al secondo errore mostra "Immagine non disponibile".

- [ ] **Step 1: Test che falliscono** (`test/app.test.mjs`):
  - `loadView` con un Windy finto (1 cam a ~70 m da una cam OSM, più un'altra cam OSM lontana) restituisce 2 cam, la prima la più vicina al centro.
  - Un Windy finto che risponde 401 restituisce `windyError: 'auth'` e le sole cam OSM (Review Focus 1).
  - Senza chiave non c'è nessuna chiamata Windy e `windyError` resta `null`; il banner dipende dalla chiave mancante, non dall'errore.
  - `locate` con una geolocation finta che chiama l'error callback restituisce `null` (Review Focus 2).
  - `locate` con una geolocation finta che non risponde mai restituisce `null` dopo il timeout (con timer finti di `node:test` `mock.timers`).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa `app.js` ed esporta `loadView` e `locate`; `init()` parte solo se esiste `document`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Verifica manuale.** Avvia `npm run serve` e apri http://localhost:5173 con l'emulazione mobile di Chrome. Controlla che:
  - si vedano la mappa e le cam OSM;
  - senza chiave compaia il banner e, inserita la chiave, compaiano i marker Windy;
  - toccando una riga si apra il dettaglio con meteo, onde (sulla costa) e pioggia;
  - ⭐ funzioni;
  - la ricerca "Mondello" sposti la mappa;
  - con GPS negato compaia il messaggio e la mappa resti sull'Italia.

  Fai uno screenshot.
- [ ] **Step 6:** Commit `feat: orchestrazione app`.

---

### Task 9: PWA (manifest, service worker, icone) + pubblicazione

**Files:**
- Create: `public/manifest.webmanifest`, `public/sw.js`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `README.md`
- Modify: `public/index.html` (link manifest, registrazione SW, `theme-color`)

**Interfaces:**
- Produces:
  - Manifest: `name` "Webcam Italia", `short_name` "Webcam", `start_url` "./", `display` "standalone", `lang` "it", `theme_color` "#1d6fe0", `background_color` "#ffffff".
  - `sw.js`:
    - pre-cache dello shell (`./`, `index.html`, `style.css`, `js/*.js`, `manifest`, icone, `data/osm-webcams.json`) con nome di cache versionato `wi-v1`;
    - strategia network-first per lo shell, con fallback sulla cache;
    - **nessuna cache** per `api.windy.com`, le immagini Windy, `*.open-meteo.com` e i tile, che vanno direttamente in rete;
    - all'`activate` cancella le cache vecchie.
  - `README.md` in italiano spiega:
    - come ottenere la chiave gratuita Windy su https://api.windy.com/keys;
    - come aggiornare le webcam OSM (`npm run build:osm`);
    - come installare l'app sul telefono ("Aggiungi a schermata Home").

- [ ] **Step 1:** Genera le icone: un puntino di mappa bianco su sfondo `#1d6fe0`. Va bene uno script Node con un PNG scritto a mano oppure un SVG convertito: la scelta è libera, ma in ogni caso senza dipendenze nel runtime dell'app.
- [ ] **Step 2:** Implementa manifest, `sw.js` e registrazione.
- [ ] **Step 3: Verifica.** In Chrome DevTools → Application controlla che il manifest sia valido, che il service worker sia attivo e che non ci siano errori in console. Poi, offline con l'app ricaricata, devono comparire lo shell e i preferiti nella lista ⭐ (Global Constraints: nessuna immagine Windy nella cache del SW, da controllare in Cache Storage).
- [ ] **Step 4:** `npm test` → tutto PASS.
- [ ] **Step 5:** Commit `feat: PWA installabile`.
- [ ] **Step 6: Pubblicazione.** È un'azione esterna, quindi va chiesta conferma all'utente prima di farla. Se l'utente conferma e `gh auth status` è ok: crea il repo `webcam-italia` e pubblica `public/` su GitHub Pages (branch `gh-pages` tramite `git subtree push --prefix public origin gh-pages`, oppure Pages da GitHub Actions). Poi apri l'URL HTTPS dal telefono e verifica GPS e installazione. Se `gh` non è autenticato, chiedi all'utente di eseguire `! gh auth login`.
