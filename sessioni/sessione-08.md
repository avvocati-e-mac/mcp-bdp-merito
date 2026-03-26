# Sessione 08 — Workflow `analisi_quesito_giuridico`

**Data:** 2026-03-26
**Branch:** `feature/analisi-quesito-giuridico`

---

## Obiettivo

Aggiungere un tool MCP di alto livello `analisi_quesito_giuridico` che orchestra
l'intero pipeline di ricerca in modo deterministico lato server, senza dipendere
dal ragionamento del modello LLM per costruire le query.

---

## Architettura implementata

```
src/
  workflows/
    keyword-extractor.js    ← estrazione termini (funzione pura)
    excerpt-analyzer.js     ← pre-scoring sugli estratti SERP (funzione pura)
    relevance-scorer.js     ← scoring finale full content (funzione pura)
    analisi-quesito.js      ← pipeline orchestratore (async, I/O Playwright)
  tools/
    workflow.js             ← registrazione tool MCP
tests/
  workflows/
    keyword-extractor.test.js
    excerpt-analyzer.test.js
    relevance-scorer.test.js
    analisi-quesito.test.js
TODO.md
```

Modifiche minime ai file esistenti:
- `src/tools/search.js`: aggiunti `export` su `eseguiRicerca` e `estraiCardProvvedimento`
- `src/server.js`: aggiunto `registerWorkflowTools(server)`
- `package.json`: aggiunti script `test` e `test:watch` (vitest)

---

## Pipeline a due fasi

### FASE 1 — Scansione ampia (senza aprire documenti)

1. `estraiTerminiRicerca(quesito)` — dizionario 30+ sinonimi giuridici IT, rileva
   riferimenti normativi, mappa materia suggerita alle label reali del select BDP
2. Query in parallelo (`Promise.allSettled`) con pagine in sequenza per ognuna
   (default: 5 pagine SERP per query, max 5 query primarie + 3 abstract)
3. Dedup per `link_dettaglio` o `estremi`
4. `prefiltraPerEstratti()` — scoring [0-1] su 4 fattori:
   - **copertura_termini** (40%): % termini trovati negli estratti
   - **densita_termini** (30%): occorrenze normalizzate per lunghezza
   - **coerenza_contestuale** (20%): presenza bigram/trigram del quesito
   - **lunghezza_estratti** (10%): 1.0 se >100 char, 0.5 se 50-100, 0.0 se <50
5. Classifica in `APRI` (>0.35) / `FORSE` (0.15-0.35) / `SALTA` (<0.15)
   - Se `da_aprire` è vuoto, fallback su `forse`

### FASE 2 — Approfondimento selettivo (legge i dettagli)

5. Lettura dettagli sequenziale (rate limit) dei candidati `da_aprire` (max 15)
6. `calcolaScore()` — scoring finale su 4 componenti:
   - **parole_chiave** (40%): Jaccard tra token quesito e `parole_chiave[]` del provvedimento
   - **materia** (25%): 1.0 match esatto, 0.5 correlata, 0.0 irrilevante
   - **abstract** (20%): 1.0 se `n_abstract_collegati > 0`, 0.5 se ha estratti
   - **riferimenti** (15%): Jaccard riferimenti normativi
7. `ordinaPerPertinenza()` → top N per pertinenza

---

## Dizionario sinonimi (keyword-extractor.js)

30+ coppie chiave→termini coprenti le aree principali:
- **Responsabilità civile/medica**: medico, sanitario, ospedale, malpractice
- **Lavoro**: licenziamento, lavoratore, mobbing, discriminazione
- **Contratti**: locazione, affitto, contratto, inadempimento, appalto
- **Danni**: risarcimento, danno, mora
- **Famiglia**: divorzio, separazione, affidamento, eredità, testamento
- **Proprietà/Possesso**: usucapione, possesso, proprietà, condominio
- **Banca/Credito**: mutuo, fideiussione, banca, usura, anatocismo
- **Processo civile**: opposizione, decreto ingiuntivo, esecuzione forzata, pignoramento, sospensiva

Mapping materia suggerita alle label reali BDP:
- Diritto civile, Diritto del lavoro, Diritto di famiglia, Diritto commerciale,
  Diritto processuale civile, Diritto penale (penale), Diritto amministrativo (amm.)

---

## Test suite — 39 test, tutti verdi

| File                          | Test | Cosa verifica                                      |
|-------------------------------|------|----------------------------------------------------|
| keyword-extractor.test.js     |  9   | purezza, sinonimi, materia, tipo, riferimenti norm.|
| excerpt-analyzer.test.js      | 12   | score, raccomandazioni APRI/FORSE/SALTA, stats     |
| relevance-scorer.test.js      | 10   | Jaccard, materia, abstract, pesi custom, soglia    |
| analisi-quesito.test.js       |  8   | struttura output, dedup, fallback, max_da_aprire   |

Test runner: **vitest** (`npm test`).

---

## Parametri del tool MCP

| Parametro          | Default | Descrizione                                          |
|--------------------|---------|------------------------------------------------------|
| `quesito`          | —       | Quesito giuridico in linguaggio naturale (min 10 ch) |
| `max_provvedimenti`| 10      | Risultati finali da restituire                       |
| `max_pagine_serp`  | 5       | Pagine SERP da analizzare per query (Fase 1)         |
| `max_per_query`    | 15      | Risultati per pagina SERP                            |
| `include_abstract` | true    | Cerca anche negli abstract BDP                       |
| `soglia_score`     | 0.1     | Score minimo per apparire nel risultato finale       |
| `soglia_apri`      | 0.35    | Score estratti minimo per aprire il documento (Fase 2) |
| `max_da_aprire`    | 15      | Max documenti da aprire integralmente in Fase 2      |

---

## Output del tool

```json
{
  "quesito": "...",
  "termini_utilizzati": { "termini_primari": [...], "materia_suggerita": "...", ... },
  "fase1": {
    "pagine_analizzate": 5,
    "provvedimenti_analizzati": 75,
    "provvedimenti_selezionati": 8,
    "provvedimenti_saltati": 55,
    "distribuzione_score_estratti": { "min": 0.0, "max": 0.65, "media": 0.21 }
  },
  "fase2": {
    "documenti_aperti": 8,
    "documenti_scartati_dopo_lettura": 0
  },
  "provvedimenti": [
    {
      "estremi": "Trib. Milano, 15/01/2025 n. 123",
      "materia": "Diritto civile",
      "parole_chiave": [...],
      "_score": 0.74,
      "_score_dettaglio": { "parole_chiave": 0.8, "materia": 1.0, "abstract": 1.0, "riferimenti": 0.5 }
    }
  ],
  "n_trovati_totale": 75,
  "n_restituiti": 10,
  "errori": []
}
```

---

## Commit di questa sessione

```
ca72809 feat(workflow): implementa keyword-extractor con dizionario sinonimi giuridici IT
7651c95 feat(workflow): implementa excerpt-analyzer per pre-scoring multi-pagina SERP
07543a3 feat(workflow): implementa relevance-scorer con scoring euristico multifattore
3f84505 feat(workflow): implementa pipeline a due fasi analisi_quesito_giuridico
8834b4c feat: registra tool workflow in server
cf178fc test: aggiungi test suite completa
b5ccc2a docs: aggiungi TODO.md e aggiorna README
```

---

## Note e decisioni prese

- La paginazione SERP è implementata richiedendo `max_results * N` a `eseguiRicerca`
  e slicing: funziona ma dipende da quanti risultati BDP restituisce effettivamente.
  Se BDP pagina server-side (es. 10 risultati fissi per chiamata), `cercaPagina()`
  restituirà array vuoto per le pagine successive — da verificare live.
- `leggiDettaglio()` in `analisi-quesito.js` implementa un proprio estrattore DOM
  (non riusa `leggi_dettaglio_provvedimento` dal tool MCP) per evitare la dipendenza
  circolare e per poter fare merge con i dati SERP. I selettori sono gli stessi.
- Nessun `console.log` su stdout — tutti i log usano `console.error()`.
