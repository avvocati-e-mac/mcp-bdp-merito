# Sessione 01 — Bootstrap, implementazione tool, debug auth

Data: 2026-03-25

---

## Obiettivo della sessione

Costruire da zero l'MCP server `mcp-bdp` per la Banca Dati del Merito del Ministero della Giustizia.

---

## Attività svolte

### Phase 0 — Bootstrap scaffold
- Creati tutti i file della struttura progetto:
  - `package.json` (ESM, dipendenze: @modelcontextprotocol/sdk, playwright, zod)
  - `.gitignore`
  - `src/server.js` — entry point MCP con StdioServerTransport
  - `src/auth/save-session.js` — login CIE headless:false
  - `src/auth/session-manager.js` — loadStorageState()
  - `src/browser/browser-factory.js` — createAuthenticatedContext() + assertNotRedirectedToLogin()
  - `src/browser/utils.js` — rateLimit() 800-2000ms
  - `src/tools/search.js` — scheletro tool 1-2
  - `src/tools/content.js` — scheletro tool 3-5
  - `src/tools/navigation.js` — scheletro tool 6-8
  - `src/tools/utility.js` — tool 9-11 implementati
- `npm install` OK (93 pacchetti, 0 vulnerabilità)
- Ricevuti e letti `CLAUDE.md`, `spec/tools.md`, `spec/bdp-structure.md`

### Phase 1 — Analisi
- Creato `ANALYSIS_REPORT.md` con checklist completa
- Identificato: selettori card risultato da verificare live, URL archivio da verificare live
- Fix immediato: `naviga_archivio` — `target` corretto da `z.string()` a `z.enum(['provvedimento','abstract'])`

### Phase 2 — Fix firma SDK
- Errore: `server.tool()` riceveva `{ description, inputSchema }` come oggetto — non supportato
- Fix: firma corretta `server.tool(name, description, schema.shape, callback)` applicata a tutti gli 11 tool
- Verificato con `node --check` su tutti i file

### Phase 3A — Implementazione search.js
- `cerca_provvedimenti` e `cerca_abstract` implementati con:
  - `compilaForm()` — compila tutti i campi con selettori `[node="XXX"]` da CLAUDE.md
  - `eseguiRicerca()` — logica condivisa con paginazione
  - `estraiCardProvvedimento()` / `estraiCardAbstract()` — estrazione DOM via `page.evaluate()`
  - Rate limiting tra navigazioni
  - Bottone Cerca: `[aria-label="Cerca"]` con fallback `button:has-text("Cerca")`

### Phase 3B — Implementazione content.js
- `leggi_dettaglio_provvedimento` — metadati, timeline gradi, abstract collegati, url viewer
- `leggi_abstract` — testo principio di diritto, precedenti conformi/difformi
- `leggi_testo_provvedimento` — 3 strategie estrazione testo in cascata (node 5440, .viewer-container, fallback main)

### Phase 3C — Implementazione navigation.js + utility.js
- `naviga_archivio` — URL querystring + fallback navigazione UI gerarchica
- `ottieni_timeline` — catena gradi di giudizio
- `ottieni_precedenti` — filtro conformi/difformi/entrambi
- `verifica_sessione`, `ottieni_materie`, `ottieni_distretti` — già implementati in Phase 0, confermati

### Phase 4 — Config registrazione
- Creato `.mcp.json` per registrazione Claude Code

### Test con test-mcp.js
- Creato script `test-mcp.js` che simula chiamate MCP via stdio
- Risultati primo test (dopo fix firma SDK):
  - ✅ 11 tool registrati correttamente
  - ✅ `verifica_sessione` → `{"valida":true,"messaggio":"Sessione attiva"}`
  - ⚠️ `ottieni_materie` → `{"materie":[]}` (lista vuota)
  - ⚠️ `ottieni_distretti` → `{"distretti":[]}` (lista vuota)
  - ⚠️ `cerca_provvedimenti` → timeout su `[node="378"]`
  - ✅ Input invalido → `isError: true` con messaggio Zod corretto

---

## Problemi identificati e stato

### P0 — Sito blocca browser headless
**Problema**: `headless: true` → pagina "Accesso Negato". Tutti i tool usavano headless.
**Fix applicato**: `headless: false` in `browser-factory.js`.

### P0 — Session cookie `expires: -1`
**Problema**: I cookie di sessione BDP sono session cookie (`expires: -1`). Salvati con `storageState` e ricaricati in un nuovo context non vengono riconosciuti dal server — la BDP fa redirect a `/login`.
**Analisi**: Il `waitForURL(/bdp\.giustizia\.it/)` in `save-session.js` si soddisfaceva su `/login` (che è su `bdp.giustizia.it`) senza che il login CIE fosse realmente completato.
**Fix applicato**: `waitForURL` ora usa funzione predicato che esclude `/login`:
```js
await page.waitForURL(
  (url) => url.href.includes('bdp.giustizia.it') && !url.href.includes('/login'),
  { timeout: 180_000, waitUntil: 'networkidle' }
);
```
**Stato**: ✅ Fix applicato. Il `save-session` ora attende correttamente l'URL autenticato. Da verificare che il login CIE venga completato per intero (QR + NFC + PIN) prima del timeout.

### P1 — Selettori card risultato non verificati
**Stato**: Ispezione DOM non ancora eseguita con successo (bloccata dal problema sessione). I selettori in `estraiCardProvvedimento()` e `estraiCardAbstract()` sono **candidati** da verificare live.

### P1 — URL archivio non verificato
**Stato**: `naviga_archivio` usa `/archive?target=...` come tentativo — da confermare live.

---

## File modificati in questa sessione

| File | Stato |
|------|-------|
| `package.json` | Creato |
| `.gitignore` | Creato |
| `.mcp.json` | Creato |
| `src/server.js` | Creato |
| `src/auth/save-session.js` | Creato + 4 fix iterativi (waitForURL, UA, ispezione inline, predicato URL) |
| `src/auth/session-manager.js` | Creato |
| `src/browser/browser-factory.js` | Creato + fix headless:false |
| `src/browser/utils.js` | Creato |
| `src/tools/search.js` | Creato → implementato completamente |
| `src/tools/content.js` | Creato → implementato completamente |
| `src/tools/navigation.js` | Creato → implementato completamente |
| `src/tools/utility.js` | Creato → implementato completamente |
| `ANALYSIS_REPORT.md` | Creato + aggiornato con stato Phase 3 |
| `test-mcp.js` | Creato (script di test stdio) |
| `inspect-dom.js` | Creato (script ispezione DOM — da usare nella prossima sessione) |

---

## Prossimi passi (Sessione 02)

1. **Eseguire `npm run save-session`** completando per intero il flusso CIE (QR + NFC + PIN) — attendere l'URL autenticato
2. **Eseguire `node inspect-dom.js`** subito dopo (o integrare nell'ultimo step di `save-session.js`) per ottenere i selettori reali di:
   - Card risultato ricerca (`cerca_provvedimenti`, `cerca_abstract`)
   - Select con `[node="810"]` materie e `[node="705"]` distretti
   - Paginatore risultati
   - URL pattern archivio
3. **Aggiornare i selettori** in `search.js` (estraiCardProvvedimento, estraiCardAbstract) con i valori reali
4. **Eseguire `node test-mcp.js`** per verificare tutti gli 11 tool
5. **Registrare su Claude Desktop** con il percorso assoluto
