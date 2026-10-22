# Webcam Italia — Documento di progetto

Data: 2026-10-22

## L'idea in una frase (parole dell'utente)

"Una cartina dell'Italia con tutte le telecamere visibili, io ci clicco e vedo."
Tutto il resto è al servizio di questo. La complessità tecnica non deve mai trasparire nell'uso.

## Intento e perché

Prima di spostarsi (andare al mare, in una città, in una zona) l'utente vuole vedere **com'è davvero la situazione lì adesso**: com'è il mare, che tempo fa. Apre un'app sul cellulare, trova il posto, guarda una webcam pubblica e accanto le condizioni meteo-marine. Così decide se partire e dove andare.

L'app è per uso personale dell'utente.

## Obiettivi

- Mappa dell'Italia con tutte le webcam pubbliche disponibili come puntini.
- Per ogni webcam: immagine aggiornata (o player live se la fonte lo offre) + dati del punto: temperatura aria, vento (velocità e direzione), onde (altezza, solo per webcam costiere), temperatura del mare (solo costiere), **probabilità di pioggia**.
- Tre modi per trovare un posto: **posizione GPS** ("vicino a me"), **ricerca per nome di località**, **preferiti**.
- Usabile comodamente dal cellulare.

## Non-obiettivi

- Non è un'app da pubblicare sugli store né da distribuire ad altri.
- Niente account, login, sincronizzazione tra dispositivi.
- Niente registrazione/archivio delle immagini, niente notifiche.
- Niente previsioni meteo dettagliate a più giorni (basta la situazione attuale e le prossime ore per la pioggia).

## Anti-obiettivi (fallimento anche se "funziona")

- **Includere telecamere private esposte per errore** (stile Insecam, scansioni di IP/porte, Shodan, password di default). Deciso esplicitamente: si usano solo webcam che il proprietario pubblica intenzionalmente (enti, comuni, autostrade, lidi, hotel, appassionati di meteo). Nessuna fonte di questo tipo va aggiunta, nemmeno come opzione.
- Un'app lenta o scomoda sul telefono: se aprirla e vedere il mare vicino richiede più di pochi tocchi, ha fallito il suo scopo.

## Vincoli

- **Costo zero, nessun abbonamento** (deciso dall'utente). Il piano Professional di Windy (9.990 €/anno) è escluso.
- Solo fonti che è lecito usare: niente scraping di siti che non pubblicano i dati (es. webcam Autostrade, che non hanno API né open data).
- Gira sul telefono dell'utente (Android/iOS non specificato → deve funzionare su entrambi tramite browser).

## Decisioni prese con l'utente

### Layout: "B — Mappa + lista"
Schermata principale divisa in due:
- **Metà superiore: mappa** dell'Italia con un puntino per webcam. In alto barra di ricerca località con icona ⭐ (preferiti); pulsante 📍 per centrare sulla propria posizione.
- **Metà inferiore: lista** delle webcam nell'area visibile della mappa (ordinate per vicinanza al centro/alla posizione). Ogni riga: miniatura, nome del posto, temperatura, vento, onde (se costiera), **% pioggia**. La lista si aggiorna quando si sposta/zooma la mappa.
- Toccando una riga o un puntino si apre il **dettaglio**: immagine grande o player live, nome, ora dell'ultimo aggiornamento, temperatura aria e mare, vento con direzione, altezza onde, probabilità di pioggia nelle prossime ore, pulsante per aggiungere/togliere dai preferiti.

Riferimento visivo: `.superpowers/brainstorm/*/content/layout.html` (opzione B).

## Scelte del progettista (non discusse in dettaglio con l'utente, confermate in blocco)

- **Piattaforma:** PWA (web app installabile dalla schermata home), coerente con gli altri progetti dell'utente. Lingua UI: italiano.
- **Fonti webcam (due, entrambe gratuite):**
  1. **Windy Webcams API v3, piano Free** (chiave API che l'utente creerà). Limiti verificati il 2026-10-22: immagini a dimensione ridotta; URL delle immagini che scadono dopo 10–15 minuti (quindi richiederli al momento, mai salvarli); offset massimo 1.000 per elenco (quindi interrogare per area visibile/bounding box, non scaricare l'elenco nazionale); player timelapse incorporabile con pubblicità; obbligo di link a windy.com. Il player Windy è il modo per "vedere" anche senza diretta.
  2. **OpenStreetMap** (via Overpass API): oggetti in Italia con tag `contact:webcam` / `webcam` / `camera:url`. Sono pagine di webcam pubblicate dai proprietari (lidi, comuni, rifugi). Molti link sono morti: verificarli e scartare quelli che non rispondono. Non vanno interrogati dal telefono a ogni apertura (il server pubblico è spesso sovraccarico): estrarli periodicamente in un file statico servito con l'app.
  - Le webcam OSM (e quelle Windy che lo prevedono) mostrano un pulsante **"Guarda dal vivo"** che apre la pagina del proprietario, dove spesso c'è la diretta gratuita.
  - Possibili doppioni tra le due fonti (stessa webcam vicina): unirli, preferendo Windy per l'anteprima.
  - Tutte e due le fonti contengono solo webcam pubblicate intenzionalmente → coerente con l'anti-obiettivo.
- **Meteo e mare:** Open-Meteo, gratuito per uso non commerciale, senza chiave, attribuzione CC BY 4.0. Forecast API per temperatura, vento e `precipitation_probability`; Marine API per altezza/direzione onde e temperatura del mare.
- **Preferiti:** salvati in locale sul telefono (localStorage/IndexedDB).
- **Ricerca località:** geocoding gratuito (es. Open-Meteo Geocoding o Nominatim) limitato all'Italia.
- **Mappa:** libreria open source con tile gratuite (es. Leaflet + OpenStreetMap).

## Lasciato al builder

- Architettura del codice, framework (o vanilla JS), struttura dei file.
- Come gestire la chiave Windy (se serve un piccolo proxy/backend gratuito per non esporla o per aggirare CORS, o se basta il client), e dove ospitare la PWA (es. GitHub Pages, Netlify, Cloudflare Pages: tutti gratuiti), scegliendo la soluzione più semplice compatibile con i termini del servizio.
- Come e ogni quanto aggiornare il file statico delle webcam OSM (es. script lanciato a mano o job gratuito programmato).
- Distinzione visiva tra puntini con anteprima (Windy) e puntini solo-link (OSM).
- Raggruppamento dei puntini (clustering) quando la mappa è zoomata indietro.
- Criterio per "webcam costiera" (es. categoria della fonte, oppure presenza di dati Marine validi per quel punto).
- Caching e limitazione delle richieste per stare nei limiti dei piani gratuiti.
- Comportamento offline minimo (basta che l'app si apra e mostri i preferiti; le immagini richiedono rete).
- Stile grafico (pulito, leggibile al sole, adatto al pollice).
