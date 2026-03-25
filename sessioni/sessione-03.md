# Sessione 03 — Login CIE, ispezione DOM live, correzione selettori

Data: 2026-03-25

---

## Obiettivo
Eseguire il primo login CIE reale, verificare la sessione e correggere tutti i selettori DOM del codice (che erano basati su attributi `node="XXX"` inesistenti).

## Risultati

### Login CIE
- Eseguito `node src/auth/save-session.js` con successo
- `session.json` salvato, cookie `cookiesession1` scade **2027-03-25**
- Utente autenticato: STROZZI FILIPPO

### Scoperta critica: selettori `[node="XXX"]` ERRATI
Il CLAUDE.md originale documentava `[node="XXX"]` come selettori primari del sito.
Dopo ispezione DOM live si è scoperto che il sito usa **`id` HTML standard e classi CSS Bootstrap** — nessun attributo `node` presente nel DOM reale.

### Selettori corretti (verificati live)

**Form ricerca:**
- Radio: `#target-provvedimento` / `#target-massima`
- Select: `#tipo`, `#distretto`, `#ufficio`, `#ruolo`, `#materia`, `#ricerca_testuale`
- Input: `#testo`, `#numero_provvedimento`, `#anno_provvedimento`, `#numero_ruolo`, `#anno_ruolo`, `#riferimento_normativo`, `#parola_chiave`
- Bottoni: `button[aria-label="Ricerca"]`, `button[aria-label="Azzera"]`

**Card risultati:**
- Contenitore: `.card.card-bg`
- Tipo/area: `.badge.bg-provvedimento`, `.badge.bg-secondary`
- Titolo (SPA, NO href): `button.btn-link.text-break .title-text-md`
- Metadati: `.d-lg-flex.align-items-lg-center` + `.chip-label`
- Abstract count: `.accordion-button` (testo "Abstract (N)")
- Estratti: `.estratto li`

**Paginatore:** `button[aria-label="Pagina successiva"]`

**Viewer testo (scoperta importante):**
- Bottone apertura: `button[aria-label="Mostra"]`
- Modal: `#document-modal`
- Testo completo (TUTTE le pagine): `#document-modal .visually-hidden`
- Il testo di tutte le pagine è in un singolo `div.visually-hidden` (~11.000 char per documento medio)
- NON serve paginazione — tutto in un elemento

**Problema SPA:** dopo click su "Ricerca", il contenuto è asincrono. Serve:
```js
await page.waitForSelector('.card.card-bg .btn-link.text-break', { timeout: 20000 });
```
`waitForLoadState('networkidle')` da solo non basta.

**URL dettaglio:** il click sulla card usa SPA navigation (no href). L'URL risultante:
```
/provvedimento/page?from=0&size=1&area=CIVILE&target=provvedimento&sort_field=_score&sort_order=desc&q=...
```

### File modificati
- `src/tools/search.js` — selettori form e card completamente riscritti
- `src/tools/content.js` — `leggi_testo_provvedimento` riscritto, `leggi_dettaglio_provvedimento` aggiornato
- `spec/bdp-structure.md` — riscritto completamente con selettori verificati live

### Test eseguiti
| Test | Risultato |
|------|-----------|
| Sessione attiva (homepage BDP) | ✅ |
| `cerca_provvedimenti({ query: 'locazione', max_results: 3 })` | ✅ 3 risultati con tutti i campi |
| `leggi_testo_provvedimento` | ✅ 11.435 char estratti correttamente |

### Da fare nella sessione successiva
1. Testare `leggi_dettaglio_provvedimento` su provvedimento reale
2. Trovare provvedimento con abstract e testare `leggi_abstract`
3. Verificare URL archivio per `naviga_archivio`
4. Configurare Claude Desktop
