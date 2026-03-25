# ANALYSIS REPORT — mcp-bdp

Generato: Phase 1 post-scaffold

---

## Checklist Phase 1

| # | Check | Stato | Note |
|---|-------|-------|------|
| 1 | Tutti i file presenti con struttura corretta | ✅ OK | Struttura completa creata |
| 2 | `server.js` usa `StdioServerTransport` | ✅ OK | Import corretto da `@modelcontextprotocol/sdk/server/stdio.js` |
| 3 | `console.error` usato ovunque, zero `console.log` | ✅ OK | Nessun `console.log` in `src/` |
| 4 | `loadStorageState()` gestisce file assente con messaggio utile | ✅ OK | Throw con messaggio "Esegui: npm run save-session" |
| 5 | `assertNotRedirectedToLogin()` chiamata dopo ogni `page.goto()` | ⚠️ PARZIALE | Chiamata nei tool utility; tool search/content/navigation sono scheletri — da completare in Phase 3 |
| 6 | Ogni tool ha `register*Tools` esportata e registrata in `server.js` | ✅ OK | Tutte e 4 le funzioni register* presenti e importate |
| 7 | Schemi Zod da `spec/tools.md` implementati | ⚠️ PARZIALE | Schema completo per tool utility e scheletri search/content/nav. spec/tools.md non ancora presente — da creare |
| 8 | Rate limiting 800-2000ms tra navigazioni | ✅ OK | `src/browser/utils.js` con `rateLimit()` creato; da usare in Phase 3 nei tool |
| 9 | `browser.close()` in blocco `finally` | ✅ OK | Tool utility (9, 10, 11) hanno finally. Tool scheletro restituiscono errore statico senza browser |

---

## Struttura file verificata

```
mcp-bdp/
├── .gitignore                   ✅ (node_modules/, session.json, .env)
├── package.json                 ✅ (ESM, scripts corretti, dipendenze)
├── spec/                        ✅ (directory creata; tools.md e bdp-structure.md da popolare)
├── src/
│   ├── server.js                ✅ (McpServer + StdioServerTransport + register*)
│   ├── auth/
│   │   ├── save-session.js      ✅ (headless: false, QR CIE, storageState)
│   │   └── session-manager.js   ✅ (loadStorageState con guard esistenza file)
│   ├── browser/
│   │   ├── browser-factory.js   ✅ (createAuthenticatedContext + assertNotRedirectedToLogin)
│   │   └── utils.js             ✅ (rateLimit 800-2000ms)
│   └── tools/
│       ├── search.js            ✅ (scheletro, schema Zod completo)
│       ├── content.js           ✅ (scheletro, schema Zod completo)
│       ├── navigation.js        ✅ (scheletro, schema Zod completo)
│       └── utility.js           ✅ (verifica_sessione, ottieni_materie, ottieni_distretti implementati)
```

---

## Priorità issue

### P0 — Bloccanti per funzionamento

| ID | Issue |
|----|-------|
| P0-1 | `spec/tools.md` e `spec/bdp-structure.md` non presenti — necessari per selettori DOM reali |
| P0-2 | `CLAUDE.md` non presente — selettori `node="XXX"` e flusso auth da documentare dopo prima esecuzione live |
| P0-3 | Tool 1-8 non implementati (scheletri) — da completare in Phase 3A/3B/3C |

### P1 — Importanti per correttezza

| ID | Issue |
|----|-------|
| P1-1 | Selettori DOM (`[node="613"]` per tipo, `[node="810"]` materie, `[node="705"]` distretti) da verificare live con PWDEBUG=1 — potrebbero essere cambiati |
| P1-2 | `rateLimit()` importato nei tool ma non chiamato (tool sono scheletri) — da inserire in Phase 3 |
| P1-3 | Bottone "Cerca" — selettore da ricavare live, usato `button:has-text("Cerca")` come tentativo iniziale |
| P1-4 | Paginatore — selettore completamente sconosciuto, da ricavare live |
| P1-5 | URL pattern archivio (`/archive/...`) da verificare live |

### P2 — Miglioramenti futuri

| ID | Issue |
|----|-------|
| P2-1 | `session-manager.js` usa path relativo `./session.json` — funziona solo se CWD è la root del progetto |
| P2-2 | Nessun timeout configurato per `page.goto()` nei tool (usa default Playwright 30s) |
| P2-3 | `save-session.js` non gestisce il caso di click fallito (selettore accesso potrebbe variare) |

---

## Selettori DOM da aggiornare live

Questi selettori sono ricavati dalla specifica o stimati — **TUTTI da verificare con PWDEBUG=1**:

| Selettore | Usato per | Stato |
|-----------|-----------|-------|
| `[node="378"]` | Radio PROVVEDIMENTI | Da verificare |
| `[node="381"]` | Radio ABSTRACT | Da verificare |
| `[node="613"]` | Select tipo provvedimento | Da verificare |
| `[node="705"]` | Select distretto | Da verificare |
| `[node="810"]` | Select materia | Da verificare |
| `[node="5440"]` | Paginatore viewer testo | Da verificare |
| `[node="5470"]` | Zoom viewer testo | Da verificare |
| `[node="5484"]` | Annotazioni viewer testo | Da verificare |
| `button:has-text("Cerca")` | Bottone submit ricerca | Fallback — verificare |

---

## Decisioni architetturali

1. **Tool scheletro vs non registrati**: preferito registrare tutti gli 11 tool con schema Zod e risposta `isError` per permettere test con inspector anche prima dell'implementazione completa.

2. **Schema Zod in ogni file tool**: ogni file tool definisce i propri schema localmente (non in un file centralizzato) per mantenere la coesione e semplificare le Phase successive.

3. **`assertNotRedirectedToLogin` non in `verifica_sessione`**: il tool verifica_sessione implementa la logica di check URL manualmente (non usa `assertNotRedirectedToLogin`) perché il redirect al login è il segnale di risposta, non un errore.

---

## Stato implementazione Phase 3A/3B/3C

| Tool | Stato | Note |
|------|-------|------|
| cerca_provvedimenti | ✅ IMPLEMENTATO | `eseguiRicerca()` condivisa, paginazione, `estraiCardProvvedimento()` |
| cerca_abstract | ✅ IMPLEMENTATO | `eseguiRicerca()` condivisa, campi titolo/testo abstract aggiuntivi |
| leggi_dettaglio_provvedimento | ✅ IMPLEMENTATO | Metadati, timeline, abstract collegati, url viewer |
| leggi_abstract | ✅ IMPLEMENTATO | Testo completo, precedenti conformi/difformi |
| leggi_testo_provvedimento | ✅ IMPLEMENTATO | 3 strategie di estrazione testo in cascata |
| naviga_archivio | ✅ IMPLEMENTATO | URL querystring + fallback navigazione UI gerarchica |
| ottieni_timeline | ✅ IMPLEMENTATO | Estrazione da sezione gradi di giudizio |
| ottieni_precedenti | ✅ IMPLEMENTATO | Filtraggio per tipo conformi/difformi/entrambi |
| verifica_sessione | ✅ IMPLEMENTATO | (Phase 0) |
| ottieni_materie | ✅ IMPLEMENTATO | (Phase 0) |
| ottieni_distretti | ✅ IMPLEMENTATO | (Phase 0) |

### Selettori card risultato — da verificare live con PWDEBUG=1

I selettori delle card di risultato (`cerca_provvedimenti`, `cerca_abstract`) sono **candidati** basati su pattern comuni:
```
.result-item, [role="article"], [class*="result-row"], [class*="card-result"]
```
Dopo il primo login CIE con `PWDEBUG=1`, ispezionare il DOM della pagina risultati e aggiornare `estraiCardProvvedimento()` / `estraiCardAbstract()` con i selettori reali.

### URL archivio — da verificare live

`naviga_archivio` prova `/archive?target=...&distretto=...` come URL pattern, poi fa fallback su navigazione UI. L'URL reale va confermato live.

## Test Phase 4

*Da compilare dopo npm run save-session e test con MCP Inspector*

| Tool | Appare in inspector | Input valido → output JSON | Input invalido → isError | Sessione scaduta → messaggio |
|------|---------------------|---------------------------|--------------------------|------------------------------|
| cerca_provvedimenti | - | - | - | - |
| cerca_abstract | - | - | - | - |
| leggi_dettaglio_provvedimento | - | - | - | - |
| leggi_abstract | - | - | - | - |
| leggi_testo_provvedimento | - | - | - | - |
| naviga_archivio | - | - | - | - |
| ottieni_timeline | - | - | - | - |
| ottieni_precedenti | - | - | - | - |
| verifica_sessione | - | - | - | - |
| ottieni_materie | - | - | - | - |
| ottieni_distretti | - | - | - | - |
