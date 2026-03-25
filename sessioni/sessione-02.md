# Sessione 02 — Fix auth, browser singleton, save-session interattivo

Data: 2026-03-25 (continuazione sessione 01)

---

## Obiettivo della sessione

Risolvere il problema della sessione CIE che non veniva riconosciuta dopo il login.

---

## Problemi risolti

### P0 — save-session.js salvava la sessione prima del completamento del login

**Causa**: Il `waitForURL` con predicato `url.href.includes('bdp.giustizia.it') && !url.href.includes('/login')` si soddisfaceva su `bdp.giustizia.it/` (homepage) nel momento in cui il browser ci arrivava per la prima volta — ma quella homepage faceva subito redirect a `/login` perché il login non era ancora completato. La sessione veniva salvata in quel momento di transizione.

L'utente confermava: cliccava CIE nella pagina Azure B2C ma il browser tornava alla pagina "Accedi" — segno che il processo si era già chiuso.

**Fix finale**: `save-session.js` ora aspetta che l'utente prema INVIO nel terminale dopo aver visto la BDP caricata nel browser. Zero race condition possibile.

### P0 — Browser headless bloccato dal sito BDP

**Fix**: `headless: false` in `browser-factory.js` (già risolto in sessione 01).

### P1 — Session cookie `expires: -1` non sopravvivono tra processi

**Fix**: Browser singleton — un solo browser/context condiviso tra tutti i tool call nello stesso processo MCP. La sessione viene caricata una volta sola al primo tool call e rimane viva finché il server MCP gira.

---

## Modifiche apportate

### Nuovo file: `src/browser/browser-singleton.js`
- Gestisce `_browser` e `_context` a livello di modulo
- `getBrowserContext()` — lazy init con protezione race condition (`_initPromise`)
- Handler `browser.on('disconnected')` che azzera il singleton in caso di crash
- `closeSharedContext()` — per shutdown pulito

### `src/browser/browser-factory.js` — riscritto
- Rimossa `createAuthenticatedContext()` (creava nuovo browser per ogni tool call)
- Aggiunta `getPage()` — apre una nuova page nel context singleton
- `assertNotRedirectedToLogin()` invariata, messaggio aggiornato con istruzioni riavvio

### `src/tools/utility.js`, `search.js`, `content.js`, `navigation.js` — aggiornati
- Tutti i tool ora usano `getPage()` invece di `createAuthenticatedContext()`
- Il `finally` chiude `page.close()` invece di `browser.close()`

### `src/server.js` — aggiornato
- Import `closeSharedContext` da `browser-singleton.js`
- Handler SIGTERM/SIGINT per shutdown pulito del browser singleton

### `src/auth/save-session.js` — riscritto completamente
- Rimosso tutto il codice `waitForURL` e debug localStorage
- Il browser si apre, mostra istruzioni nel terminale, e **aspetta INVIO dall'utente**
- Dopo INVIO: verifica URL corrente (non deve essere `/login` o IdP)
- Salva `session.json`
- Verifica finale navigando a `/search/standard` — se finisce su `/login` esce con `process.exit(1)`

---

## Stato al termine della sessione

### Implementato e verificato (sintassi)
- `node --check` OK su tutti i file
- Zero `createAuthenticatedContext` rimasti nei tool
- Zero `browser.close()` nei tool (solo in `save-session.js`)

### Da verificare (richiede login CIE fisico)
- `npm run save-session` con nuovo flusso interattivo (INVIO)
- `node test-mcp.js` — tutti gli 11 tool
- Selettori card risultato (`estraiCardProvvedimento`, `estraiCardAbstract`) — ancora candidati, da verificare live
- `ottieni_materie` e `ottieni_distretti` — devono restituire liste non vuote con la sessione funzionante

---

## Flusso corretto npm run save-session (nuovo)

1. Eseguire `npm run save-session`
2. Il browser si apre sulla BDP
3. Nel browser: cliccare "Accedi" → cliccare bottone CIE → scansionare QR → NFC + PIN
4. Aspettare che il browser mostri la **homepage della BDP** (non `/login`)
5. Tornare al terminale e premere **INVIO**
6. Verificare i log: `✅ Sessione salvata` + `✅ Sessione verificata`

---

## Struttura file finale

```
src/
├── server.js                    ✅ + SIGTERM/SIGINT handler
├── auth/
│   ├── save-session.js          ✅ riscritto — flusso interattivo con INVIO
│   └── session-manager.js       ✅ invariato
├── browser/
│   ├── browser-factory.js       ✅ riscritto — espone getPage()
│   ├── browser-singleton.js     ✅ NUOVO — singleton browser/context
│   └── utils.js                 ✅ invariato — rateLimit()
└── tools/
    ├── search.js                ✅ usa getPage(), page.close() nel finally
    ├── content.js               ✅ usa getPage(), page.close() nel finally
    ├── navigation.js            ✅ usa getPage(), page.close() nel finally
    └── utility.js               ✅ usa getPage(), page.close() nel finally
```

---

## Prossimi passi (Sessione 03)

1. `npm run save-session` → completare login CIE → premere INVIO → verificare `✅ Sessione verificata`
2. `node test-mcp.js` → verificare tutti gli 11 tool
3. Se `ottieni_materie`/`ottieni_distretti` funzionano → i selettori `[node="810"]` e `[node="705"]` sono corretti
4. Se `cerca_provvedimenti` restituisce risultati → verificare struttura card e aggiornare selettori se necessario
5. Registrare su Claude Desktop con percorso assoluto in `claude_desktop_config.json`

---

## File di test utili

- `test-mcp.js` — testa tutti gli 11 tool via stdio MCP
- `inspect-dom.js` — ispeziona DOM pagina ricerca (da eseguire dopo save-session riuscito)
