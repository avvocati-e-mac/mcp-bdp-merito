# CLAUDE.md — MCP Banca Dati del Merito

> Leggi questo file per intero prima di scrivere qualsiasi codice.
> Contiene tutto il contesto necessario per implementare il progetto.

---

## Obiettivo del progetto

Server MCP in **Node.js ESM** che espone tool per ricercare e leggere
provvedimenti civili dalla Banca Dati del Merito del Ministero della Giustizia
(https://bdp.giustizia.it).

L'autenticazione avviene via **CIE livello 3 — flusso ibrido**:
1. Il browser desktop mostra un QR code
2. L'utente lo scansiona con l'app CieID su smartphone
3. Lo smartphone legge la CIE via NFC e inserisce il PIN
4. L'IdP completa il flusso SAML e il browser riceve i cookie di sessione

La sessione viene salvata in `session.json` e riusata dal server MCP ad ogni
avvio, senza richiedere un nuovo login CIE.

---

## Stack tecnico

| Componente     | Scelta                                      |
|----------------|---------------------------------------------|
| Runtime        | Node.js 20+ ESM                             |
| MCP SDK        | @modelcontextprotocol/sdk                   |
| Browser        | playwright (chromium)                       |
| Validazione    | zod                                         |
| Linguaggio     | JavaScript puro con JSDoc (NO TypeScript)   |
| PDF parsing    | pdf-parse (installare solo se necessario)   |

**NON usare TypeScript.** NON usare ts-node.

---

## Struttura del progetto

```
mcp-bdp/
├── CLAUDE.md                    ← questo file
├── package.json                 (type: "module")
├── .gitignore                   (session.json, node_modules)
├── session.json                 ← NON committare mai
│
├── src/
│   ├── server.js                ← entry point MCP (avviato da Claude Desktop)
│   │
│   ├── auth/
│   │   ├── save-session.js      ← script standalone per login CIE (headless: false)
│   │   └── session-manager.js   ← carica session.json, verifica scadenza
│   │
│   ├── browser/
│   │   └── browser-factory.js   ← crea browser context con storageState
│   │
│   └── tools/
│       ├── search.js            ← cerca_provvedimenti, cerca_abstract
│       ├── content.js           ← leggi_dettaglio_provvedimento, leggi_abstract, leggi_testo_provvedimento
│       ├── navigation.js        ← naviga_archivio, ottieni_timeline, ottieni_precedenti
│       └── utility.js           ← verifica_sessione, ottieni_materie, ottieni_distretti
│
├── spec/
│   ├── tools.md                 ← catalogo completo tool con schemi input/output
│   └── bdp-structure.md         ← selettori DOM reali della BDP (verificati live)
│
└── sessioni/                    ← log delle sessioni di sviluppo
    ├── sessione-01.md           Bootstrap, implementazione tool, debug auth
    ├── sessione-02.md           Fix auth, browser singleton, save-session interattivo
    ├── sessione-03.md           Login CIE reale, ispezione DOM live, correzione selettori
    └── sessione-04.md           Archivio, dettaglio con abstract, timeline, correzioni navigation.js
```

---

## Autenticazione — REGOLE CRITICHE

### save-session.js
- DEVE girare con `headless: false` (browser visibile per mostrare QR)
- Usa `page.waitForURL(/bdp\.giustizia\.it/, { timeout: 180_000 })` per
  attendere il completamento del login CIE senza intervenire
- Dopo redirect post-auth: `await context.storageState({ path: './session.json' })`
- Stampa messaggi chiari in console per guidare l'utente

### session-manager.js
- Carica `session.json` con `JSON.parse(fs.readFileSync(...))`
- Espone `loadStorageState()` usata da browser-factory.js

### Rilevamento sessione scaduta (in OGNI tool)
```js
// Dopo ogni goto(), verificare:
if (page.url().includes('idserver.servizicie') ||
    page.url().includes('pst.giustizia.it') ||
    page.url().includes('login')) {
  await browser.close();
  throw new Error(
    'Sessione CIE scaduta. Riesegui: node src/auth/save-session.js'
  );
}
```

### Flusso SAML osservato
```
https://bdp.giustizia.it/               ← entry
→ https://pst.giustizia.it/PST/...      ← PST portale servizi
→ https://idserver.servizicie.interno.gov.it/idp/...  ← IdP CIE (QR qui)
→ https://bdp.giustizia.it/             ← post-auth (cookie sessione)
```

---


### URL pattern pagina provvedimento
```
/provvedimento/page?from=0&size=1&id={HASH}&area={CIVILE|PENALE}&target=provvedimento&sort_field=data&sort_order=desc
```
I parametri `from` e `size` controllano la paginazione per documenti lunghi.
L'HASH dell'id provvedimento viene estratto dal campo `link_dettaglio` delle card risultato.

## Il frontend BDP — SELETTORI VERIFICATI LIVE (sessione-03)

Il sito usa **Bootstrap + classi CSS custom** del Ministero.
**NON** usa attributi `node="XXX"` — usa `id` HTML standard.

### Selettori form di ricerca
```js
// Radio tipo pubblicazione
'#target-provvedimento'           // PROVVEDIMENTI (default)
'#target-massima'                 // ABSTRACT

// Checkbox
'#collated-toggle'                // Cerca nelle cartelle personali

// Select
'#tipo'                           // SENTENZA | ORDINANZA | DECRETO | '' (TUTTI)
'#distretto'                      // 26 corti d'appello
'#ufficio'                        // dipende dal distretto
'#ruolo'                          // 10 ruoli processuali
'#materia'                        // 66 materie civili
'#ricerca_testuale'               // ALMENO UNA PAROLA | TUTTE LE PAROLE | FRASE ESATTA

// Input testuali
'#testo'                          // full text (query principale)
'#numero_provvedimento'
'#anno_provvedimento'
'#numero_ruolo'
'#sub_procedimento'
'#anno_ruolo'
'#riferimento_normativo'
'#giudice_assegnatario_fascicolo'
'#presidente'
'#relatore'
'#parola_chiave'
'#note_personali'

// Bottoni
'button[aria-label="Ricerca"]'    // CERCA
'button[aria-label="Azzera"]'     // RESET
'button[aria-label="Pagina successiva"]'  // paginatore
```

### Card risultati
```js
'.card.card-bg'                              // contenitore card
'.badge.bg-provvedimento'                    // tipo (SENTENZA/DECRETO/ORDINANZA)
'.badge.bg-secondary'                        // area (CIVILE/PENALE)
'button.btn-link.text-break .title-text-md'  // estremi (SPA navigation, NO href)
'.chip-label'                                // valori ufficio/materia/parole chiave
'.accordion-button'                          // "Abstract (N)"
'.estratto li'                               // estratti testo
```

### Viewer provvedimento
```js
'button[aria-label="Mostra"]'               // apre modal viewer
'#document-modal.show'                       // modal aperto
'#document-modal .visually-hidden'           // TESTO COMPLETO (tutte le pagine)
```
Il testo di tutte le pagine è in un **singolo** `div.visually-hidden`.
Non serve paginazione.

### SPA — CRITICO
Dopo click su `button[aria-label="Ricerca"]` aspettare:
```js
await page.waitForSelector('.card.card-bg .btn-link.text-break', { timeout: 20000 });
// waitForLoadState('networkidle') da solo NON basta
```

---

## URL di accesso diretto

```
Ricerca provvedimenti: /search/standard?target=provvedimento&sort_field=data&sort_order=desc
Ricerca abstract:      /search/standard?target=abstract&sort_field=data&sort_order=desc
```

---

## Tool MCP da implementare

Dettaglio completo in `spec/tools.md`. Ordine di implementazione:

**Fase 2 (core):**
1. `cerca_provvedimenti`
2. `cerca_abstract`

**Fase 3 (lettura):**
3. `leggi_dettaglio_provvedimento`
4. `leggi_abstract`
5. `leggi_testo_provvedimento` ← HTML inline, usa innerText (NO pdf-parse)

**Fase 4 (navigazione):**
6. `naviga_archivio`
7. `ottieni_timeline`
8. `ottieni_precedenti`

**Fase 4 (utility):**
9. `verifica_sessione`
10. `ottieni_materie`
11. `ottieni_distretti`

---

## Rate limiting (obbligatorio)

```js
// Inserire tra ogni navigazione per rispettare i server del MinGiustizia
await page.waitForTimeout(800 + Math.random() * 1200); // 800–2000ms random
```

---

## Configurazione Claude Desktop

```json
{
  "mcpServers": {
    "bdp-merito": {
      "command": "node",
      "args": ["/percorso/assoluto/src/server.js"]
    }
  }
}
```

---

## Setup iniziale (primo avvio)

All'inizio di ogni conversazione, verifica se `node_modules/` è presente:

```bash
ls node_modules 2>/dev/null | head -1
```

Se la cartella **non esiste** (progetto appena clonato), chiedi all'utente:

> "La cartella `node_modules` non è presente. Vuoi che esegua `npm install` per installare le dipendenze?"

Attendi la conferma prima di procedere. Se l'utente conferma, esegui:

```bash
npm install
```

---

## Comandi di sviluppo

```bash
# Installazione
npm install

# Login CIE (eseguire quando sessione scade)
node src/auth/save-session.js

# Avvio server MCP in modalità debug (STDIO)
node src/server.js

# Test singolo tool
node -e "import('./src/tools/search.js').then(m => m.cercaProvvedimenti({query: 'locazione'}).then(console.log))"
```

---

## Dipendenze package.json

```json
{
  "name": "mcp-bdp",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "playwright": "latest",
    "zod": "latest"
  }
}
```
