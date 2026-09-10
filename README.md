# FantaList · 2026/27

Applicazione per consultare il listone durante l’asta: ricerca immediata, FVM e quotazioni visibili,
filtri combinati e stato dei calciatori salvato nel browser.

## Avvio

Con Node.js 22 (almeno 22.12) e npm:

```bash
npm install
npm start
```

Apri `http://localhost:4200`. Puoi usare anche `npx ng serve` oppure `ng serve` con CLI globale.
Il JSON è già incluso: **non occorrono Python e OCR per usare l’app**.

## Funzionalità

- Angular 21, standalone OnPush, TypeScript strict e stato con Signals.
- Tailwind CSS 4.3 con temi chiaro, scuro e automatico, senza librerie UI.
- Ricerca per nome e squadra senza distinzione di maiuscole e accenti.
- Macro ruoli, sottoruoli e squadre multipli, intervalli FVM/quotazione, ordinamento e chip rimovibili.
- Card su smartphone e tablet; da 1024px tabella e sidebar. Viene renderizzata solo la vista pertinente.
- Bottom sheet con bozza, Applica/Reset, Escape, backdrop, focus confinato e blocco dello scroll.
- Dettagli espandibili con entrambi i valori del documento, ruoli completi e indice originale.
- Stato **Disponibile / Chiamato / Acquistato**, modificabile da card e tabella e indipendente dai filtri.
- Tema e stato d’asta persistono in localStorage. Le schede dello stesso browser sincronizzano lo stato
  d’asta. Il salvataggio è locale: non si trasferisce automaticamente ad altri dispositivi.
- Skeleton, stato vuoto, gestione errori e pulsante Riprova.

I filtri sono condivisibili e ripristinabili dalla URL:

```text
/?role=A&roles=Pc&team=Inter&minFvm=50&sort=fvm-desc
```

Parametri: `role`, `roles`, `team`, `q`, `minFvm`, `maxFvm`, `minQuotation`, `maxQuotation`, `sort`.
I multiselect usano valori separati da virgola. Reset filtri non cancella lo stato d’asta.

## Dati

Sorgente: `public/data/lista.pdf`, sei pagine immagine. Il frontend carica `/data/players.json`
e non esegue PDF parsing o OCR. Il dataset contiene **532 calciatori**: 64 portieri, 189 difensori,
193 centrocampisti e 86 attaccanti, 20 squadre e 12 sottoruoli.

L’indice riparte per categoria; gli ID derivano separatamente da macro ruolo, nome e squadra, gestendo
le collisioni. I valori tra parentesi restano `secondaryValue`: il documento non ne spiega il significato.
Filtri e ordinamenti usano `value`. Nomi, accenti e squadre rispecchiano la sorgente senza aggiornamenti esterni.

### Riprodurre l’importazione (solo sviluppo, Windows)

Python 3.12+, OCR Windows con lingua inglese disponibile e Node.js:

```bash
python -m pip install --target .local-tools/pdf -r scripts/requirements.txt
npm install --prefix .local-tools/ocr --no-audit --no-fund tesseract.js@7.0.0
npm run data:import
```

Il comando renderizza il PDF, esegue OCR Windows e Tesseract locale, riconcilia le righe e applica le
correzioni verificate in `scripts/ocr-corrections.json`. Al primo utilizzo Tesseract scarica il modello
inglese nella cache locale. Gli strumenti e gli intermedi restano in `.local-tools`, esclusa da Git
e dal bundle. Nessun servizio riceve le pagine del PDF.

Per riutilizzare l’OCR completato dello stesso PDF:

```bash
python scripts/import_players.py --reuse-ocr
```

Cache e correzioni sono vincolate all’hash SHA-256 del PDF. Un nuovo documento richiede una nuova verifica.
Righe malformate, indici mancanti o duplicati e conteggi inattesi interrompono l’importazione.
Il JSON viene sostituito soltanto dopo la validazione completa.

Consulta [l’audit del dataset](scripts/DATASET_AUDIT.md) e il campione riproducibile in
`scripts/dataset-report.json`.

## Verifiche

```bash
npm run data:validate
npm run test:import
npm run test:unit
npm run test:e2e
npm run format:check
npm run build
```

I test unitari usano Karma/Jasmine e Chrome Headless. I test end-to-end usano Chrome installato
(`channel: chrome`), avviano l’app su `127.0.0.1:4201` e verificano dataset reale, responsive,
asta, persistenza, URL, filtri, errori e accessibilità con axe.
Screenshot e tracce sono in `test-results/`, esclusa da Git.

`npm run format` applica `.prettierrc.json`. Il repository non ha ESLint:
i controlli statici sono TypeScript strict e i template strict Angular.

## Build e struttura

`ng build` genera la SPA in `dist/fanta-list/browser`. Non sono configurati SSR, prerender, backend
o autenticazione. Sul server statico conserva `data/players.json` e configura il fallback delle rotte
su `index.html`.

```text
src/app/core/                         tema
src/app/features/players/models/      modelli, validazione e URL
src/app/features/players/services/    caricamento, filtri Signals e asta
src/app/features/players/components/  card, tabella, filtri e stato
src/app/features/players/pages/       pagina e bottom sheet
public/data/                         PDF e dataset statico
scripts/                             importazione, correzioni e audit
e2e/                                 verifiche nel browser
```
