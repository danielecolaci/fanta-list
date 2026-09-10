# Audit del Listone 2026/27

Sorgente: `public/data/lista.pdf`, 6 pagine immagine.

SHA-256: `6d8704ce38608386a6f97f379d3781b771f3be138013c276e69a4cb400d90de4`.

## Estrazione

Il primo OCR Windows ometteva numerosi indici, ruoli e valori brevi. Tesseract ha recuperato le righe;
un passaggio dedicato alla colonna dei ruoli ingrandita e binarizzata ne ha migliorato la lettura.
Le coordinate delle parole associano le sei colonne alle righe, anche attraverso i cambi pagina.

Le correzioni residue sono registrate per riga e colonna in `ocr-corrections.json`, con motivazione,
dopo confronto visivo con il PDF. Non provengono da elenchi esterni. La normalizzazione ripristina
separatori nei ruoli ma non assegna valori numerici a campi illeggibili: questi bloccano l’importazione
finché non esiste una correzione verificata.

## Risultato

| Categoria      | Righe | Indici originali       |
| -------------- | ----: | ---------------------- |
| Portieri       |    64 | 1–64                   |
| Difensori      |   189 | 1–189                  |
| Centrocampisti |   193 | 1–193                  |
| Attaccanti     |    86 | 1–86                   |
| Totale         |   532 | ID globalmente univoci |

20 squadre, 12 sottoruoli, nessun nome o squadra vuoti, valori principali e secondari numerici,
nessun indice mancante o duplicato nelle categorie. I conteggi visivi attesi sono verificati anche
durante l’importazione dello stesso PDF per intercettare eventuali righe finali perse dall’OCR.

## Confronto visivo

Sono state lette tutte le sei pagine e confrontate con le righe estratte, includendo nomi, squadre,
macro ruoli, sottoruoli e coppie di valori. Il controllo copre primi/ultimi tre calciatori di ogni
categoria e righe centrali. Il report JSON aggiunge un campione con dieci posizioni pseudocasuali
riproducibili (seed `202627`), comprese nel confronto delle pagine.

`test_import_players.py` conserva 32 righe trascritte visivamente come riferimenti indipendenti dal
parser, comprese le righe centrali e dieci ulteriori righe distribuite nel documento.

| Calciatore | Ruolo completo | FVM      | Quotazione |
| ---------- | -------------- | -------- | ---------- |
| Bijlow     | P(Por)         | 15(15)   | 8(8)       |
| Vigorito   | P(Por)         | 1(1)     | 1(1)       |
| Abankwah   | D(Dd,Dc)       | 10(12)   | 2(2)       |
| Dimarco    | D(E,W)         | 240(240) | 31(29)     |
| Kouadio    | D(Dd,Dc)       | 14(10)   | 3(3)       |
| Zortea     | D(Dd,E)        | 19(19)   | 7(7)       |
| Calhanoglu | C(M,C)         | 243(273) | 28(29)     |
| Mctominay  | C(C,T)         | 220(220) | 27(27)     |
| Zielinski  | C(C)           | 45(45)   | 12(12)     |
| Bonny      | A(Pc)          | 15(12)   | 7(6)       |
| Malen      | A(Pc)          | 450(450) | 38(38)     |
| Zeballos   | A(A)           | 18(18)   | 6(6)       |

Sono preservati accenti e abbreviazioni visibili, ad esempio `Montipò`, `Bernabè`, `Esposito F.P.` e
`Martinez L.`. Squadre e valori apparentemente insoliti non sono sostituiti con dati ricordati o online.
Il documento non spiega il significato delle parentesi: il modello usa `secondaryValue` e la UI mostra
“secondario”, senza inventare interpretazioni quali valore precedente o prezzo d’acquisto.
