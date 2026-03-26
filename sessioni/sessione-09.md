# Sessione 09 — LLM keyword extraction + fix concorrenza BDP

**Data:** 2026-03-26
**Branch:** `feature/analisi-quesito-giuridico`

---

## Obiettivo

Due miglioramenti al tool `analisi_quesito_giuridico` emersi dal primo test live:

1. **Keywords troppo generiche** — il keyword-extractor deterministico non coglie quesiti complessi (es. TFR + fallimento). Soluzione: parametro `termini_override` per passare termini pre-calcolati dall'LLM.
2. **Troppi accessi in parallelo a BDP** — `Promise.allSettled` con 8 query simultanee causava errori rate-limit. Soluzione: concorrenza limitata con pool di worker.

---

## Modifiche implementate

### `src/workflows/analisi-quesito.js`

**1. Funzione `runWithConcurrency(tasks, limit, delayMs)`**
Inserita dopo `dedup()`. Pool di N worker con semantica identica a `Promise.allSettled` (no throw).

```js
async function runWithConcurrency(tasks, limit, delayMs = 0) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      try {
        results[index] = { status: 'fulfilled', value: await tasks[index]() };
      } catch (err) {
        results[index] = { status: 'rejected', reason: err };
      }
      if (delayMs > 0 && nextIndex < tasks.length) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}
```

**2. Sostituzione `Promise.allSettled` → `runWithConcurrency`**

```js
const risultatiQueries = await runWithConcurrency(taskQuery, max_query_concorrenti, delay_tra_query_ms);
```
Default: `max_query_concorrenti=2`, `delay_tra_query_ms=3000`.

**3. Parametro `termini_override`**

```js
const termini = termini_override != null
  ? {
      termini_primari: termini_override.termini_primari ?? [],
      termini_abstract: termini_override.termini_abstract ?? [],
      materia_suggerita: termini_override.materia_suggerita ?? null,
      tipo_suggerito: termini_override.tipo_suggerito ?? 'TUTTI',
      riferimenti_normativi: termini_override.riferimenti_normativi ?? [],
    }
  : estraiTerminiRicerca(quesito);
```

**4. Campo `_sorgente` nell'output**

```js
termini_utilizzati: {
  ...termini,
  _sorgente: termini_override != null ? 'llm_override' : 'keyword_extractor',
},
```

---

### `src/tools/workflow.js`

**1. Schema `TerminiOverrideSchema`**

```js
const TerminiOverrideSchema = z.object({
  termini_primari: z.array(z.string()).min(1),
  termini_abstract: z.array(z.string()).optional().default([]),
  materia_suggerita: z.string().nullable().optional().default(null),
  tipo_suggerito: z.enum(['TUTTI', 'SENTENZA', 'ORDINANZA', 'DECRETO']).optional().default('TUTTI'),
  riferimenti_normativi: z.array(z.string()).optional().default([]),
});
```

**2. Nuovi parametri in `AnalizzaQuesitioSchema`**

```js
termini_override: TerminiOverrideSchema.optional(),
max_query_concorrenti: z.number().int().min(1).max(5).default(2),
delay_tra_query_ms: z.number().int().min(0).max(10000).default(3000),
```

**3. Description aggiornata** con workflow consigliato per Claude:

> WORKFLOW CONSIGLIATO: prima di chiamare questo tool, genera i termini di ricerca ottimali e passali in `termini_override`. Produce risultati nettamente migliori rispetto al keyword-extractor deterministico interno.

Include istruzioni esplicite su come costruire `termini_primari`, `termini_abstract`, `materia_suggerita`, `tipo_suggerito`, `riferimenti_normativi`.

---

## Test

**43 test, tutti verdi** (suite completa in 705ms).

Nuovi test aggiunti in `tests/workflows/analisi-quesito.test.js`:

| Test | Cosa verifica |
|------|---------------|
| `termini_override usa i termini passati e _sorgente=llm_override` | Override bypassa keyword-extractor |
| `senza termini_override _sorgente=keyword_extractor` | Fallback deterministico |
| `runWithConcurrency: non supera il limite di concorrenza` | Max 2 query simultanee |
| `runWithConcurrency: query fallita non blocca le altre` | Semantica allSettled preservata |

Fix sui test esistenti: aggiunto `delay_tra_query_ms: 0` a tutti i test per evitare timeout (il delay di 3000ms di default si sommerebbe su più query).

---

## Test live (sessione-09)

**Primo test (prima delle modifiche):** query con `Promise.allSettled` e 8 query in parallelo → BDP ha bloccato l'utenza per "elevato numero di richieste". Blocco attivo fino al giorno successivo.

**Secondo test (dopo le modifiche):** `termini_override` confermato funzionante (`_sorgente: 'llm_override'`), ma 0 risultati perché i `termini_primari` erano frasi troppo lunghe (es. `"TFR fallimento lavoratore"`) che la BDP non trova. Lezione: i termini devono essere corti e ricercabili dalla BDP, non frasi descrittive.

**Test completo rimandato a domani** — attesa fine blocco BDP.

---

## Default aggiornati (fine sessione, post blocco BDP)

Ridotti per evitare futuri blocchi:

| Parametro | Prima | Dopo |
|-----------|-------|------|
| `max_pagine_serp` | 5 | 3 |
| `max_per_query` | 15 | 10 |
| `max_da_aprire` | 15 | 10 |
| `delay_tra_query_ms` | 1500 | 3000 |

---

## Note

- `runWithConcurrency` è privata (non esportata) — testata indirettamente tramite `analizzaQuesito` con mock su `eseguiRicerca`.
- Il parametro `termini_override` è completamente opzionale: retrocompatibile al 100%.
- Il `_sorgente` nell'output permette di capire a debug quale path è stato eseguito.
- Quando `termini_override.termini_primari` è vuoto `[]`, il tool torna un risultato vuoto senza crash — responsabilità dell'LLM passare almeno un termine.
- I `termini_primari` passati via `termini_override` devono essere **parole chiave corte** (2-4 parole), non frasi descrittive lunghe — la BDP fa full-text search, non semantic search.
