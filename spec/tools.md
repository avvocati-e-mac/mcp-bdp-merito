# spec/tools.md — Catalogo Tool MCP BDP

> Tutti i tool restituiscono `{ content: [{ type: "text", text: JSON.stringify(result) }] }`
> in caso di successo, oppure lanciano un Error con messaggio leggibile.

---

## PRIORITÀ 1 — Ricerca

### `cerca_provvedimenti`
Ricerca provvedimenti (sentenze, decreti, ordinanze) nella BDP.

```js
Input (zod schema):
{
  query:                z.string().optional(),         // testo libero
  tipo:                 z.enum(["TUTTI","SENTENZA","ORDINANZA","DECRETO"]).default("TUTTI"),
  distretto:            z.string().optional(),         // es. "Bologna"
  materia:              z.string().optional(),         // es. "Locazione"
  tipo_ricerca:         z.enum(["ALMENO_UNA_PAROLA","TUTTE_LE_PAROLE","FRASE_ESATTA"]).default("TUTTE_LE_PAROLE"),
  numero:               z.string().optional(),
  anno:                 z.number().int().optional(),
  numero_ruolo:         z.string().optional(),
  anno_ruolo:           z.number().int().optional(),
  riferimento_normativo: z.string().optional(),        // es. "art. 1453 c.c."
  parola_chiave:        z.string().optional(),
  full_text:            z.string().optional(),         // ricerca nel testo del doc
  data_da:              z.string().optional(),         // formato DD/MM/YYYY
  data_a:               z.string().optional(),
  tipo_data:            z.enum(["DATA","DATA_PUBBLICAZIONE"]).default("DATA"),
  sort_field:           z.enum(["data","rilevanza"]).default("data"),
  sort_order:           z.enum(["asc","desc"]).default("desc"),
  max_results:          z.number().int().min(1).max(100).default(20),
  nelle_cartelle:       z.boolean().default(false),
}

Output: Array di CardProvvedimento:
{
  tipo_provvedimento: string,        // SENTENZA | DECRETO | ORDINANZA
  estremi: string,                   // es. "Trib. Parma n. 123/2024"
  ufficio: string,
  materia: string,
  parole_chiave: string[],
  riferimenti_normativi: string[],
  n_abstract_collegati: number,
  link_dettaglio: string,            // URL assoluto pagina dettaglio
}[]
```

**Flow Playwright**:
1. `goto('/search/standard?target=provvedimento&sort_field=...')`
2. Seleziona radio `[node="378"]` (PROVVEDIMENTI)
3. Compila i campi input con i valori forniti (skip se undefined)
4. Per i select: `selectOption` sull'elemento `[node="XXX"]`
5. Click `[aria-label="Cerca"]`
6. `waitForLoadState("networkidle")`
7. `page.evaluate()` per estrarre le card risultato
8. Gestisci paginazione fino a `max_results`

---

### `cerca_abstract`
Ricerca abstract/massime redazionali nella BDP.

```js
Input: stesso schema di cerca_provvedimenti con aggiunta:
{
  titolo_abstract: z.string().optional(),
  testo_abstract:  z.string().optional(),
}
// target sarà "abstract" invece di "provvedimento"

Output: Array di CardAbstract:
{
  titolo_abstract: string,
  estremi_provvedimento: string,
  ufficio: string,
  materia: string,
  parole_chiave: string[],
  riferimenti_normativi: string[],
  n_precedenti_conformi: number,
  n_precedenti_difformi: number,
  link_dettaglio: string,
}[]
```

---

## PRIORITÀ 2 — Lettura contenuto

### `leggi_dettaglio_provvedimento`
Legge metadati completi e abstract collegati di un provvedimento.

```js
Input:
{
  url: z.string().url().describe("URL della pagina dettaglio provvedimento (da cerca_provvedimenti)")
}

Output:
{
  tipo_provvedimento: string,
  estremi: string,
  ufficio: string,
  materia: string,
  data_provvedimento: string,
  parole_chiave: string[],
  riferimenti_normativi: string[],
  timeline: {
    provvedimento_precedente?: { estremi: string, url?: string },
    esito?: string,
    provvedimento_successivo?: { estremi: string, url?: string },
  },
  abstract_collegati: {
    titolo: string,
    url: string,
  }[],
  annotazioni?: string,
  url_visualizza_provvedimento?: string,  // link al PDF/viewer
}
```

---

### `leggi_abstract`
Legge testo completo e precedenti di un abstract.

```js
Input:
{
  url: z.string().url().describe("URL della pagina dettaglio abstract")
}

Output:
{
  titolo: string,
  estremi_provvedimento: string,
  ufficio: string,
  materia: string,
  testo_abstract: string,            // testo completo del principio di diritto
  parole_chiave: string[],
  riferimenti_normativi: string[],
  precedenti_conformi: {
    estremi: string,
    url?: string,
  }[],
  precedenti_difformi: {
    estremi: string,
    url?: string,
  }[],
}
```

---

### `leggi_testo_provvedimento`
Estrae il testo integrale anonimizzato del documento.

```js
Input:
{
  url: z.string().url().describe("URL viewer provvedimento (url_visualizza_provvedimento da leggi_dettaglio_provvedimento)"),
  from: z.number().int().min(0).default(0).describe("Offset pagina per doc multi-pagina"),
}

Output:
{
  testo: string,          // testo completo anonimizzato (server-side)
  from_usato: number,     // offset pagina restituito
}
```

**Implementazione (HTML inline — nessun PDF):**
```js
await page.goto(url);
await page.waitForLoadState("networkidle");

// Rimuovi toolbar dal computo del testo
const testo = await page.evaluate(() => {
  // I controlli viewer hanno node="5440","5470","5484"
  // Risali al loro contenitore (toolbar) ed escludilo
  const toolbar = document.querySelector(
    '[node="5440"]')?.closest('[class*="toolbar"],[class*="header"],[class*="controls"]'
  );
  const main = document.querySelector('main, [role="main"], .content');
  if (!main) return '';
  const clone = main.cloneNode(true);
  // Rimuovi toolbar nel clone
  clone.querySelectorAll('[node="5440"],[node="5470"],[node="5484"]')
    .forEach(el => el.closest('[class*="toolbar"]')?.remove());
  return clone.innerText ?? clone.textContent ?? '';
});

return { 
  content: [{ type: "text", text: testo }],
};
```

**Nota anonimizzazione**: il testo è già anonimizzato SERVER-SIDE.
Non processare il testo lato client. Parte_1, C.F._1, P.IVA_1 sono i token finali.

**Nota paginazione**: l'URL usa `from=0&size=1`. Per documenti multi-pagina,
iterare incrementando `from` finché la pagina non restituisce testo vuoto.

---

## PRIORITÀ 3 — Navigazione archivio

### `naviga_archivio`
Naviga la struttura gerarchica dell'archivio BDP.

```js
Input:
{
  distretto:  z.string().optional(),
  ufficio:    z.string().optional(),
  materia:    z.string().optional(),
  anno:       z.number().int().optional(),
  mese:       z.number().int().min(1).max(12).optional(),
  target:     z.enum(["provvedimento","abstract"]).default("provvedimento"),
  max_results: z.number().int().max(50).default(20),
}

Output: Lista provvedimenti/abstract con link_dettaglio
```

---

### `ottieni_timeline`
Recupera la catena dei gradi di giudizio per un provvedimento.

```js
Input:
{
  url: z.string().url()
}

Output:
{
  gradi: {
    grado: string,            // "Primo grado" | "Appello" | "Cassazione"
    estremi: string,
    esito?: string,
    url?: string,
  }[]
}
```

---

### `ottieni_precedenti`
Recupera i precedenti conformi e difformi citati in un abstract.

```js
Input:
{
  url: z.string().url().describe("URL abstract"),
  tipo: z.enum(["conformi","difformi","entrambi"]).default("entrambi"),
}

Output:
{
  conformi:  { estremi: string, url?: string }[],
  difformi:  { estremi: string, url?: string }[],
}
```

---

## PRIORITÀ 4 — Utility

### `verifica_sessione`
Controlla se la sessione è ancora valida senza fare ricerche.

```js
Input: {} (nessun parametro)

Output:
{
  valida: boolean,
  messaggio: string,  // es. "Sessione attiva" oppure "Scaduta: riesegui save-session.js"
}
```

### `ottieni_materie`
Restituisce la lista completa delle 66 materie disponibili nella BDP
(utile per suggerire valori corretti a Claude prima di una ricerca).

```js
Input: {} (nessun parametro)
Output: { materie: string[] }
// Estrae le opzioni reali dal select [node="810"] al runtime
```

### `ottieni_distretti`
Restituisce la lista dei 26 distretti disponibili.

```js
Input: {} (nessun parametro)
Output: { distretti: string[] }
// Estrae le opzioni reali dal select [node="705"]
```

---

## Note di implementazione

### Gestione sessione scaduta (in OGNI tool)
```js
if (page.url().includes("idserver.servizicie") || page.url().includes("pst.giustizia.it")) {
  throw new Error("Sessione CIE scaduta. Riesegui: node src/auth/save-session.js");
}
```

### Rate limiting
```js
// Tra ogni navigazione
await page.waitForTimeout(800 + Math.random() * 1200); // 800-2000ms
```

### Paginazione
```js
// Pattern generico da adattare ai selettori reali
while (results.length < max_results) {
  const nextBtn = page.locator('[aria-label="Pagina successiva"], button:has-text("›")').first();
  if (!await nextBtn.isEnabled()) break;
  await nextBtn.click();
  await page.waitForLoadState("networkidle");
  // estrai risultati pagina corrente e aggiungi all'array
}
```
