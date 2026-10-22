# Webcam Italia

Cartina dell'Italia con le webcam pubbliche: tocchi un puntino e vedi la webcam,
con temperatura, vento, onde e probabilità di pioggia del posto.

Fonti, tutte gratuite: webcam da [Windy.com](https://www.windy.com/webcams) e da
[OpenStreetMap](https://www.openstreetmap.org), meteo e mare da [Open-Meteo](https://open-meteo.com) (CC BY 4.0).
Solo webcam pubblicate apposta dai proprietari.

## La chiave Windy (gratuita)

1. Vai su https://api.windy.com/keys e accedi (o crea un account Windy).
2. Crea una chiave per **Webcams API**, piano **Free**.
3. Apri l'app, tocca la striscia gialla "Chiave Windy mancante" e incolla la chiave.

La chiave resta solo sul telefono. Senza chiave l'app funziona lo stesso con le webcam OpenStreetMap.

## Installarla sul telefono

Apri l'indirizzo dell'app nel browser del telefono, poi:
- **Android (Chrome):** menu ⋮ → "Aggiungi a schermata Home" / "Installa app".
- **iPhone (Safari):** pulsante Condividi → "Aggiungi alla schermata Home".

## Per chi la mantiene

```
npm test            # test
npm run serve       # prova in locale su http://localhost:5173
npm run build:osm   # aggiorna le webcam OpenStreetMap (qualche minuto)
node scripts/make-icons.mjs   # rigenera le icone
```

Dopo aver cambiato file dell'app, aumenta il nome della cache in `public/sw.js` (`wi-v1` → `wi-v2`).
