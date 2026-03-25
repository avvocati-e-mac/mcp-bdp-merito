# spec/bdp-structure.md — BDP DOM Structure Reference

> Fonte: ispezione HTML live di https://bdp.giustizia.it (sessione CIE marzo 2026)
> **NOTA CRITICA**: il sito NON usa attributi `node="XXX"`. I selettori primari
> sono `id` HTML standard e classi CSS Bootstrap/custom del Ministero.

---

## 1. URL di accesso diretto

```
Base:        https://bdp.giustizia.it
Ricerca:     /search/standard?target=provvedimento&sort_field=data&sort_order=desc
             /search/standard?target=abstract&sort_field=data&sort_order=desc
Dettaglio:   /provvedimento/page?from=0&size=1&area=CIVILE&target=provvedimento&sort_field=_score&sort_order=desc&q=...
```

Dopo click sul bottone Ricerca, l'URL diventa:
```
/search/standard?from=0&size=10&q=anonymized_testo%3A%22QUERY%22&target=provvedimento&sort_field=_score&sort_order=desc
```

---

## 2. Form di ricerca — Selettori verificati live

### 2.1 Radio: tipo pubblicazione
```js
'#target-provvedimento'   // radio PROVVEDIMENTI (default)
'#target-massima'         // radio ABSTRACT
```

### 2.2 Checkbox
```js
'#collated-toggle'        // "Cerca nelle cartelle personali" (ce ne sono 2, usare .first())
```

### 2.3 Select
```js
'#tipo'               // SENTENZA | ORDINANZA | DECRETO | TUTTI (valore '' = TUTTI)
'#distretto'          // 26 corti d'appello (valore '' = tutti)
'#ufficio'            // dipende dal distretto scelto
'#ruolo'              // 10 ruoli processuali
'#materia'            // 66 materie civili
'#ricerca_testuale'   // ALMENO UNA PAROLA | TUTTE LE PAROLE | FRASE ESATTA
```

Interazione: `await page.locator('#tipo').selectOption({ label: 'SENTENZA' })`

### 2.4 Input testuali
```js
'#testo'                          // campo full text (query principale)
'#numero_provvedimento'           // Numero provvedimento
'#anno_provvedimento'             // Anno provvedimento
'#numero_ruolo'                   // Numero ruolo
'#sub_procedimento'               // Sub procedimento
'#anno_ruolo'                     // Anno ruolo
'#riferimento_normativo'          // Riferimento normativo (es. "art. 1453 c.c.")
'#giudice_assegnatario_fascicolo' // Giudice assegnatario fascicolo
'#presidente'                     // Presidente
'#relatore'                       // Relatore
'#parola_chiave'                  // Parola chiave
'#note_personali'                 // Note personali
```

### 2.5 Bottoni azione
```js
'button[aria-label="Ricerca"]'   // bottone CERCA (class: "btn btn-primary ms-3 flex-fill")
'button[aria-label="Azzera"]'    // bottone AZZERA (class: "btn btn-danger ms-3 flex-fill")
```

### 2.6 Date
```js
// Tipo data
'#date-range-filter-modal-type'  // select: '' | 'Data deposito minuta' | 'Data pubblicazione'

// I datepicker aprono modal — per compilare le date usare gli input vicini ai btn-calendar:
'button[aria-label="Data deposito minuta da"]'  // bottone calendario Da
'button[aria-label="Data deposito minuta a"]'   // bottone calendario A
'button[aria-label="Data di pubblicazione da"]'
'button[aria-label="Data di pubblicazione a"]'
```

---

## 3. Pagina risultati

### 3.1 Struttura HTML verificata live

```html
<!-- Lista risultati: contenitore diretto delle card -->
<div class="card-wrapper mt-2 mb-3">
  <div class="card card-bg">
    <div class="card-body text-secondary">
      <!-- Titolo cliccabile (SPA navigation, NO href) -->
      <button type="button" class="btn-link text-break" title="Visualizza provvedimento in una nuova scheda">
        <div class="title-container-md">
          <span class="badge bg-provvedimento">DECRETO</span>
          <span class="badge bg-secondary ms-1">CIVILE</span>
          <div class="title-text-md">
            <strong>TRIBUNALE DI MANTOVA</strong> - N. R.G. <strong>00001714-2/2023</strong> ...
          </div>
        </div>
      </button>

      <!-- Metadati come righe label + chip -->
      <div class="d-lg-flex align-items-lg-center mt-2">
        <div>Ufficio:&nbsp;</div>
        <a href="#" class="chip-wrapper">
          <div class="chip chip-lg chip-primary pointer">
            <span class="chip-label">TRIBUNALE DI MANTOVA</span>
          </div>
        </a>
      </div>
      <!-- stessa struttura per Ruolo:, Materia:, Giudice assegnatario fascicolo:,
           Parole chiave: (multipli chip), Riferimenti normativi: -->

      <!-- Numero abstract collegati -->
      <div class="accordion mt-3" id="accordion-{N}">
        <div class="accordion-item">
          <div class="accordion-header">
            <button class="accordion-button collapsed">Abstract (0)</button>
          </div>
        </div>
      </div>

      <!-- Estratti di testo con keyword evidenziata -->
      <ul class="estratto">
        <li class="mt-2 mb-2"><button class="btn-link"><i>...testo con <mark>keyword</mark>...</i></button></li>
      </ul>
    </div>
  </div>
</div>
```

### 3.2 Selettori di estrazione card
```js
// Tutte le card nella pagina
'.card.card-bg'

// Tipo provvedimento
'.badge.bg-provvedimento'

// Area (CIVILE/PENALE)
'.badge.bg-secondary'

// Titolo/estremi
'button.btn-link.text-break .title-text-md'

// Chip-label (ufficio, materia, ecc.)
// → trovare il div con label testuale, poi leggere .chip-label al suo interno

// Numero abstract
'button.accordion-button'  // testo: "Abstract (N)"

// Estratti
'.estratto li'
```

### 3.3 Paginazione
```js
'button[aria-label="Pagina successiva"]'   // testo "Successiva"
'button[aria-label="Pagine successive"]'   // testo "..." (salta a blocco)
// NB: non c'è un contatore risultati facilmente selezionabile (è in un CSS :before)
```

### 3.4 IMPORTANTE: URL dettaglio non disponibile nella card
Il click su `button.btn-link.text-break` usa SPA navigation (non href).
Il dettaglio si apre nella stessa tab e l'URL diventa:
```
/provvedimento/page?from=0&size=1&area=CIVILE&target=provvedimento&sort_field=_score&sort_order=desc&q=...
```
Per leggere il dettaglio di un risultato specifico: cliccare la card e leggere l'URL.

---

## 4. Dettaglio Provvedimento

### 4.1 Struttura pagina
Stessa struttura `.card.card-bg > .card-body` della card risultati, ma con più metadati.

### 4.2 Bottoni azione (verificati live)
```js
'button[aria-label="Copia estremi"]'
'button[aria-label="Mostra"]'              // apre viewer PDF #document-modal
'button[aria-label="Scarica provvedimento"]'
'button[aria-label="Stampa"]'
'button[aria-label="Mostra timeline"]'     // apre #provvedimento-timeline-modal
'button[aria-label="Altre azioni"]'
```

### 4.3 Modal Timeline
```js
'#provvedimento-timeline-modal'             // modal Bootstrap
'.provvedimento-timeline-modal .it-timeline-wrapper .row'  // contenitore gradi
```

### 4.4 Paginatore dettaglio (1 di 99+)
I pulsanti precedente/successivo nel dettaglio:
```js
'button[aria-label="Risultato precedente"]'  // class: "btn btn-icon"
'button[aria-label="Risultato successivo"]'  // class: "btn btn-icon"
```

---

## 5. Viewer Provvedimento ✅ VERIFICATO LIVE

**Tipo**: custom PDF viewer con canvas + testo accessibile in `.visually-hidden`.
**NON** è un iframe. Il testo di TUTTE le pagine è in un singolo elemento DOM.

### Modal viewer
```js
'#document-modal'                          // modal Bootstrap, class aggiunge "show" quando aperto
'#document-modal .visually-hidden'         // ← TESTO COMPLETO DEL DOCUMENTO (tutte le pagine)
```

### Struttura interna modal
```html
<div id="document-modal" class="modal fade document-modal show">
  <div class="modal-header">
    <div class="modal-title">DECRETO TRIBUNALE DI MANTOVA - N. R.G. ...</div>
  </div>
  <div class="modal-body">
    <div class="page-wrapper">
      <div class="page">
        <div class="canvasWrapper"><canvas></canvas></div>
        <div class="documentNoteLayer"></div>
      </div>
      <!-- N pagine totali -->
    </div>
    <!-- TESTO COMPLETO ACCESSIBILE: -->
    <div class="visually-hidden">N. R.G. 1714/2023 Tribunale di Mantova ...</div>
  </div>
</div>
```

### Estrazione testo (verificata)
```js
// Click per aprire il viewer
await page.locator('button[aria-label="Mostra"]').click();
await page.waitForSelector('#document-modal.show', { timeout: 15000 });
await page.waitForSelector('#document-modal .visually-hidden', { timeout: 15000 });
await page.waitForTimeout(2000); // rendering

// Leggi tutto il testo (tutte le pagine, ~11.000 char per documento medio)
const testo = await page.evaluate(() =>
  document.querySelector('#document-modal .visually-hidden')?.innerText?.trim() ?? ''
);
```

### Controlli toolbar del viewer
```js
// Select zoom
// input pagina corrente (senza id/node utile)
// checkbox "Evidenzia e annota"
// button Scarica, button Stampa, button Chiudi
```

### Anonimizzazione — applicata SERVER-SIDE
```
Nomi propri    → Parte_1, Controparte_1, CP_1, Persona_1
Codici fiscali → C.F._1
Organizzazioni → Organizzazione_1
```

---

## 6. Archivio
URL e struttura da verificare live.

---

## 7. Autenticazione — URL osservati nel flusso CIE

```
Entry:       https://bdp.giustizia.it/
Login:       redirect → https://pst.giustizia.it/PST/...
QR/IdP:      redirect → https://idserver.servizicie.interno.gov.it/idp/...
Post-auth:   redirect → https://bdp.giustizia.it/ (con cookie di sessione)
```

Sessione scaduta → rilevare con:
```js
page.url().includes('idserver.servizicie') ||
page.url().includes('pst.giustizia.it') ||
page.url().includes('/login')
```
