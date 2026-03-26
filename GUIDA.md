# Guida — MCP Banca Dati del Merito

## Cos'è questo progetto

Un **server MCP** (Model Context Protocol) che permette a Claude Desktop di consultare la [Banca Dati di Merito](https://bdp.giustizia.it) del Ministero della Giustizia — la banca dati gratuita che raccoglie provvedimenti civili (sentenze, decreti, ordinanze) e i relativi abstract redazionali.

Claude può così cercare provvedimenti, leggerne il testo integrale, consultare abstract e precedenti conformi/difformi, navigare l'archivio per distretto/ufficio/materia — tutto direttamente in chat.

---

## Architettura generale

```
Claude Desktop
     │  (JSON-RPC su stdio)
     ▼
src/server.js          ← entry point MCP
     │
     ├── tools/search.js       cerca_provvedimenti, cerca_abstract
     ├── tools/content.js      leggi_dettaglio_provvedimento, leggi_abstract, leggi_testo_provvedimento
     ├── tools/navigation.js   naviga_archivio, ottieni_timeline, ottieni_precedenti
     └── tools/utility.js      verifica_sessione, ottieni_materie, ottieni_distretti
              │
              ▼
     browser/browser-factory.js   getPage() + assertNotRedirectedToLogin()
              │
              ▼
     browser/browser-singleton.js  un solo browser Chromium condiviso
              │
              ▼
     auth/session-manager.js       carica session.json (cookie CIE)
              │
              ▼
     Chromium (headless: false) → bdp.giustizia.it
```

Il server comunica con Claude Desktop tramite **stdio** usando il protocollo MCP (JSON-RPC 2.0). Ogni messaggio di log usa `console.error()` — `console.log()` su stdout corromperebbe il canale di comunicazione.

**SDK:** `@modelcontextprotocol/sdk ^1.10.0` (testato con 1.28.0). I tool usano `server.registerTool(name, { title, description, inputSchema, outputSchema, annotations }, callback)` — `server.tool()` è deprecato dalla 1.10.

---

## Autenticazione CIE

Il sito BDP richiede autenticazione con **CIE livello 3** (Carta d'Identità Elettronica). Il flusso è:

```
bdp.giustizia.it → pst.giustizia.it → idserver.servizicie.interno.gov.it
                                              (QR code qui)
                                                    ↓
                                         app CieID su smartphone
                                         (scansione QR + lettura NFC CIE + PIN)
                                                    ↓
                                         bdp.giustizia.it (autenticato)
```

Dopo il login, i cookie di sessione vengono salvati in `session.json`. Il server li carica ad ogni avvio e li inietta nel browser Chromium — nessun login richiesto per ogni query.

### Quando eseguire il login
La sessione dura circa **1 anno** (il cookie scade 2027-03-25 per la sessione attuale). Quando scade, qualsiasi tool risponde con:
```
Sessione CIE scaduta. Ferma il server (Ctrl+C), esegui: npm run save-session, poi riavvia.
```

### Come rinnovare la sessione
```bash
node src/auth/save-session.js
```
Il browser si apre visibile. Completare il login CIE nel browser, poi premere INVIO nel terminale. Il file `session.json` viene aggiornato automaticamente.

---

## Browser singleton

Il progetto usa **un solo processo Chromium** condiviso tra tutti i tool call:

```
getBrowserContext()  →  _browser (Chromium)  →  _context (con session.json)
                                                       │
                          tool call 1 → newPage() ─────┤
                          tool call 2 → newPage() ─────┤
                          tool call 3 → newPage() ─────┘
```

Ogni tool:
1. chiama `getPage()` per aprire una nuova tab nel context condiviso
2. naviga, esegue le operazioni
3. chiude la page nel `finally` — **mai** il browser o il context

Il singleton gestisce race condition (due tool chiamati contemporaneamente) con un `_initPromise`: se il browser non è ancora pronto, le chiamate parallele aspettano la stessa promise di inizializzazione invece di lanciare due browser.

Il browser viene lanciato con `headless: false` — il sito BDP rileva e blocca i browser headless.

---

## Rate limiting

Tra ogni navigazione il codice attende un tempo casuale:

```js
await page.waitForTimeout(800 + Math.random() * 1200); // 800–2000ms
```

Questo rispetta i server del Ministero e riduce il rischio di ban temporanei.

---

## I tool disponibili

### Ricerca

#### `cerca_provvedimenti`
Cerca sentenze, decreti e ordinanze. Restituisce una lista di card con tipo, area, estremi, ufficio, materia, parole chiave, estratti di testo.

Parametri principali:
- `query` — testo libero
- `tipo` — TUTTI / SENTENZA / ORDINANZA / DECRETO
- `distretto`, `materia` — filtri geografici/tematici
- `numero`, `anno` — numero e anno del provvedimento
- `max_results` — default 20, max 100

#### `cerca_abstract`
Cerca abstract/massime redazionali. Stessa logica di `cerca_provvedimenti` ma sul target `abstract`. Restituisce per ogni card: testo del principio, estremi del provvedimento collegato, ufficio, materia, parole chiave.

---

### Lettura contenuti

#### `leggi_dettaglio_provvedimento`
Dato l'URL di un provvedimento (`/provvedimento/page?id=...`), legge tutti i metadati: tipo, area, estremi, ufficio, ruolo, materia, giudice, parole chiave, riferimenti normativi, gradi di giudizio (accordion), abstract collegati con testo del principio.

#### `leggi_abstract`
Dato l'URL di un abstract (`/abstract/page?id=...`), legge:
- **Principio di diritto** (testo in grassetto)
- **Motivazione** (testo in corsivo)
- Metadati: tipo provvedimento, area, estremi, ufficio, materia, parole chiave
- Conteggio precedenti conformi e difformi

> **Nota:** sia gli URL con `id=` (es. `/abstract/page?id=abc123`) che quelli con `from=` generati dalla ricerca (es. `/abstract/page?from=0&size=1&...`) sono navigabili direttamente — entrambi funzionano come input per `leggi_abstract`.

#### `leggi_testo_provvedimento`
Dato l'URL di un provvedimento, clicca il bottone "Mostra" per aprire il viewer PDF inline, poi estrae il testo integrale anonimizzato dal modal `#document-modal`. Tutto il testo (tutte le pagine) è in un singolo `div.visually-hidden`.

---

### Navigazione

#### `naviga_archivio`
Naviga la struttura gerarchica dell'archivio: Distretto → Ufficio → Materia → Anno → Mese.

```
naviga_archivio({})                          → 26 distretti
naviga_archivio({ distretto: 'BOLOGNA' })    → 11 uffici del distretto Bologna
```

Restituisce `{ tipo: 'navigazione', voci: [{ nome, url }] }` o `{ tipo: 'risultati', voci: [...] }` se siamo al livello delle card.

#### `ottieni_timeline`
Dato l'URL di un provvedimento, apre il modal timeline (`#provvedimento-timeline-modal`) e restituisce la catena dei gradi di giudizio con il grado corrente marcato.

#### `ottieni_precedenti`
Dato l'URL di un abstract (`/abstract/page?id=...`), espande gli accordion "Precedenti conformi" e "Precedenti difformi" e restituisce le liste.

Parametro `tipo`: `conformi` | `difformi` | `entrambi` (default)

---

### Utility

#### `verifica_sessione`
Naviga la homepage BDP e verifica che non ci sia redirect verso il login. Risponde `{ valida: true/false, messaggio: "..." }`.

#### `ottieni_materie`
Legge le 66 materie disponibili dal select `#materia` nella pagina di ricerca (live, non hardcoded).

#### `ottieni_distretti`
Legge i 26 distretti giudiziari dal select `#distretto` (live, non hardcoded).

---

## Flusso tipico di una query MCP

```
Claude: "cerca sentenze sulla locazione abitativa del Tribunale di Bologna"
  │
  ▼
cerca_provvedimenti({ query: 'locazione abitativa', distretto: 'BOLOGNA', tipo: 'SENTENZA' })
  │
  ├── getPage() → nuova tab nel browser singleton
  ├── goto('/search/standard?target=provvedimento&...')
  ├── compilaForm() → fill '#testo', selectOption '#distretto', selectOption '#tipo'
  ├── rateLimit() → attesa 800-2000ms
  ├── click 'button[aria-label="Ricerca"]'
  ├── waitForSelector('.card.card-bg .btn-link.text-break')
  ├── estraiCardProvvedimento() → page.evaluate() → array di oggetti
  └── page.close() → [finally]
  │
  ▼
Claude riceve: lista JSON con tipo/area/estremi/ufficio/materia/estratti
```

---

## Come navigare da un risultato di ricerca all'abstract

La BDP è una **SPA React** — i link sono `<button>` senza `href`. Per ottenere l'URL dell'abstract di un provvedimento:

1. `cerca_provvedimenti` → ottieni URL del provvedimento (es. `/provvedimento/page?id=abc`)
2. `leggi_dettaglio_provvedimento(url)` → nella risposta ci sono gli `abstract_collegati`
3. Per leggere un abstract serve il suo URL `/abstract/page?id=...` — che si ottiene **cliccando** sul principio nell'accordion (la SPA naviga e l'URL cambia)
4. `leggi_abstract(url_abstract)` → principio + motivazione + precedenti

---

## Struttura file

```
mcp-bdm-civile/
├── package.json              type: "module", dipendenze
├── session.json              cookie CIE (non committare mai)
│
├── src/
│   ├── server.js             entry point: crea McpServer, registra tool, collega stdio
│   │
│   ├── auth/
│   │   ├── save-session.js   script login CIE interattivo (headless: false)
│   │   └── session-manager.js  carica session.json → storageState Playwright
│   │
│   ├── browser/
│   │   ├── browser-singleton.js  stato globale browser/context Chromium
│   │   ├── browser-factory.js    getPage() + assertNotRedirectedToLogin()
│   │   └── utils.js              rateLimit()
│   │
│   ├── tools/
│   │   ├── search.js         cerca_provvedimenti, cerca_abstract
│   │   ├── content.js        leggi_dettaglio_provvedimento, leggi_abstract, leggi_testo_provvedimento
│   │   ├── navigation.js     naviga_archivio, ottieni_timeline, ottieni_precedenti
│   │   ├── utility.js        verifica_sessione, ottieni_materie, ottieni_distretti
│   │   └── workflow.js       analisi_quesito_giuridico (registrazione tool MCP)
│   │
│   └── workflows/
│       ├── keyword-extractor.js   estrazione termini da quesito (funzione pura)
│       ├── excerpt-analyzer.js    pre-scoring sugli estratti SERP (funzione pura)
│       ├── relevance-scorer.js    scoring finale full content (funzione pura)
│       └── analisi-quesito.js     pipeline orchestratore a due fasi
│
├── tests/
│   └── workflows/
│       ├── keyword-extractor.test.js
│       ├── excerpt-analyzer.test.js
│       ├── relevance-scorer.test.js
│       └── analisi-quesito.test.js
│
└── spec/
    ├── tools.md              catalogo tool con schemi input/output
    └── bdp-structure.md      selettori DOM verificati live
```

---

## Configurazione Claude Desktop

In `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bdm-civile": {
      "command": "node",
      "args": ["/percorso/assoluto/src/server.js"]
    }
  }
}
```

Dopo aver modificato la configurazione, riavviare Claude Desktop. Il server viene avviato automaticamente all'avvio di Claude e rimane in esecuzione fino alla chiusura.

---

## Comandi utili

```bash
# Prima installazione
npm install
npx playwright install chromium

# Login CIE (solo quando la sessione scade)
node src/auth/save-session.js

# Test manuale di un tool (pattern aggiornato SDK 1.28+)
node -e "
const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
const { registerSearchTools } = await import('./src/tools/search.js');
const server = new McpServer({ name: 'test', version: '1.0.0' });
registerSearchTools(server);
const t = server._registeredTools;
const r = await t.cerca_provvedimenti.handler({ query: 'locazione', max_results: 2 }, {});
console.error(r.content[0].text);
"

# Avvio server diretto (debug)
node src/server.js
```

---

---

## Workflow avanzato: `analisi_quesito_giuridico`

Il tool `analisi_quesito_giuridico` orchestra l'intero pipeline di ricerca in modo
deterministico lato server. È il punto di ingresso consigliato per qualsiasi ricerca
giuridica sulla BDP.

### Funzionamento a due fasi

#### Fase 1 — Scansione ampia (senza aprire documenti)

1. **Estrazione termini** dal quesito in linguaggio naturale:
   - Dizionario di 30+ sinonimi giuridici IT (locazione→contratto d'affitto, licenziamento→recesso datoriale, ecc.)
   - Rilevamento riferimenti normativi (`art. NNN c.c.`, `d.lgs. NNN/AAAA`)
   - Materia suggerita mappata alle label reali del select `#materia` BDP
2. **Query parallele** su più termini (`Promise.allSettled`), con **pagine sequenziali** per ogni query (default: 5 pagine SERP per query)
3. **Deduplicazione** per `link_dettaglio` o `estremi`
4. **Pre-scoring sugli estratti** — senza aprire i documenti:

| Componente            | Peso | Come si calcola                                          |
|-----------------------|------|----------------------------------------------------------|
| `copertura_termini`   | 40%  | % termini del quesito trovati in almeno un estratto      |
| `densita_termini`     | 30%  | occorrenze totali normalizzate per lunghezza estratti    |
| `coerenza_contestuale`| 20%  | presenza bigram/trigram del quesito negli estratti       |
| `lunghezza_estratti`  | 10%  | 1.0 se >100 char, 0.5 se 50–100, 0.0 se <50             |

Ogni provvedimento viene classificato: **APRI** (score >0.35) / **FORSE** (0.15–0.35) / **SALTA** (<0.15).
Se nessuno raggiunge la soglia APRI, si usa il fallback sui FORSE.

#### Fase 2 — Approfondimento selettivo (legge i dettagli)

5. **Lettura sequenziale** dei dettagli SOLO per i candidati APRI (max `max_da_aprire`, default 15)
6. **Scoring finale** su contenuto completo:

| Componente      | Peso | Come si calcola                                                        |
|-----------------|------|------------------------------------------------------------------------|
| `parole_chiave` | 40%  | similarità Jaccard token quesito ↔ `parole_chiave[]` del provvedimento |
| `materia`       | 25%  | 1.0 match esatto, 0.5 materia correlata, 0.0 irrilevante               |
| `abstract`      | 20%  | 1.0 se `n_abstract_collegati > 0`, 0.5 se ha estratti                 |
| `riferimenti`   | 15%  | similarità Jaccard riferimenti normativi                               |

7. **Ordinamento** per `_score` decrescente, restituisce i top N

### Parametri

| Parametro           | Default | Descrizione                                            |
|---------------------|---------|--------------------------------------------------------|
| `quesito`           | —       | Quesito giuridico in linguaggio naturale (min 10 ch)  |
| `max_provvedimenti` | 10      | Risultati finali da restituire                         |
| `max_pagine_serp`   | 5       | Pagine SERP da analizzare per query nella Fase 1      |
| `max_per_query`     | 15      | Risultati per pagina SERP                              |
| `include_abstract`  | true    | Cerca anche tra gli abstract BDP                       |
| `soglia_score`      | 0.1     | Score minimo `_score` per apparire nel risultato       |
| `soglia_apri`       | 0.35    | Score estratti minimo per aprire il documento (Fase 2) |
| `max_da_aprire`     | 15      | Max documenti da aprire integralmente in Fase 2        |

### Output

```json
{
  "quesito": "responsabilità del medico per omessa diagnosi",
  "termini_utilizzati": {
    "termini_primari": ["colpa medica", "responsabilità sanitaria", ...],
    "materia_suggerita": "Diritto civile",
    "riferimenti_normativi": []
  },
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
      "parole_chiave": ["colpa medica", "danno biologico"],
      "_score": 0.74,
      "_score_dettaglio": {
        "parole_chiave": 0.8, "materia": 1.0,
        "abstract": 1.0, "riferimenti": 0.5
      }
    }
  ],
  "n_trovati_totale": 75,
  "n_restituiti": 10,
  "errori": []
}
```

### Architettura interna (workflow/)

I moduli `keyword-extractor.js`, `excerpt-analyzer.js` e `relevance-scorer.js` sono
**funzioni pure** (no I/O, no side effects) — testabili in isolamento senza Playwright.
Solo `analisi-quesito.js` esegue I/O (browser, BDP) ed è mockato nei test.

```bash
npm test   # 39 test, tutti verdi
```

---

## Note importanti

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| `Sessione CIE scaduta` | `session.json` scaduto o assente | `node src/auth/save-session.js` |
| Tool non risponde | Browser bloccato | Ctrl+C, riavvia `node src/server.js` |
| BDP blocca le richieste | Troppe chiamate veloci | Il rate limit è già incorporato; non fare loop rapidi |
| `console.log` nel codice | Corrompe il canale stdio MCP | Usare sempre `console.error()` |
| Browser headless bloccato | Il sito rileva Playwright | `headless: false` è obbligatorio |
| `save-session.js` non salva | CWD diversa dalla root | Eseguire sempre dalla root del progetto: `cd /percorso/mcp-bdm-civile && node src/auth/save-session.js` |
