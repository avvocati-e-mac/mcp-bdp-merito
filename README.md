# 🏛️ Banca Dati di Merito per Claude

Questo strumento permette a **Claude Desktop** di consultare direttamente la [Banca Dati di Merito](https://bdp.giustizia.it) del Ministero della Giustizia — la banca dati gratuita che raccoglie sentenze, decreti e ordinanze civili dei tribunali italiani.

Una volta installato, puoi chiedere a Claude cose come:

> *"Cerca sentenze del Tribunale di Bologna sulla locazione abitativa degli ultimi due anni"*

> *"Leggi il testo integrale di questa sentenza e dimmi se è rilevante per il mio caso"*

> *"Trova abstract sulla responsabilità medica con precedenti conformi"*

Claude cercherà, leggerà e analizzerà i provvedimenti per te, direttamente in chat.

---

## Cosa serve prima di iniziare

1. **Un Mac** (il progetto è testato su macOS)
2. **Claude Desktop** installato — scaricalo da [claude.ai/download](https://claude.ai/download)
3. **Node.js 20 o superiore** — scaricalo da [nodejs.org](https://nodejs.org) (scegli la versione "LTS")
4. **La tua CIE** (Carta d'Identità Elettronica) fisica con PIN
5. **L'app CieID** installata sul tuo smartphone ([App Store](https://apps.apple.com/it/app/cieid/id1504644677) / [Google Play](https://play.google.com/store/apps/details?id=it.ipzs.cieid))
6. Un lettore NFC sul telefono (tutti gli smartphone moderni ce l'hanno)

---

## Installazione

### 1. Scarica il progetto

Apri il **Terminale** (cercalo con Spotlight: `⌘ Spazio`, digita "Terminale") e incolla questi comandi uno alla volta:

```bash
cd ~/Documents
git clone https://github.com/avvocati-e-mac/mcp-bdp-merito.git
cd mcp-bdp-merito
```

### 2. Installa le dipendenze

Sempre nel Terminale, nella cartella del progetto:

```bash
npm install
npx playwright install chromium
```

Questo scarica le librerie necessarie e il browser interno usato dallo strumento. Ci vuole qualche minuto.

### 3. Esegui il login con la CIE

Questo passaggio va fatto **una sola volta** (la sessione dura circa un anno):

```bash
node src/auth/save-session.js
```

Si aprirà un browser. Segui questi passi:

1. Clicca **"Accedi"** nella homepage della Banca Dati
2. Seleziona **"Entra con CIE"**
3. Apparirà un **QR code** — aprì l'app **CieID** sul telefono e scansionalo
4. Avvicina la CIE al telefono (NFC) e inserisci il PIN nell'app
5. Aspetta che il browser torni sulla homepage della Banca Dati
6. Torna nel Terminale e premi **Invio**

Se vedi `✅ Sessione verificata`, hai completato il login con successo.

### 4. Configura Claude Desktop

Apri il Terminale e incolla questo comando per trovare il percorso corretto del progetto:

```bash
echo "$(pwd)/src/server.js"
```

Copia l'output (es. `/Users/tuonome/Documents/mcp-bdp-merito/src/server.js`).

Poi apri il file di configurazione di Claude Desktop:

```bash
open ~/Library/Application\ Support/Claude/
```

Apri il file `claude_desktop_config.json` con un editor di testo. Se non esiste, crealo. Il contenuto deve essere:

```json
{
  "mcpServers": {
    "bdp-merito": {
      "command": "node",
      "args": ["/Users/tuonome/Documents/mcp-bdp-merito/src/server.js"]
    }
  }
}
```

> ⚠️ Sostituisci `/Users/tuonome/Documents/mcp-bdp-merito/src/server.js` con il percorso copiato prima.

Se nel file c'era già altro contenuto (altri server MCP), aggiungi solo la parte `"bdp-merito": { ... }` dentro `"mcpServers"`.

### 5. Riavvia Claude Desktop

Chiudi e riapri Claude Desktop. Nella chat dovresti vedere un'icona 🔌 in basso che indica che gli strumenti MCP sono attivi.

---

## Come si usa

Apri una chat con Claude Desktop e chiedi normalmente, in italiano. Alcuni esempi:

**Ricerca provvedimenti:**
- *"Cerca sentenze sulla locazione commerciale del distretto di Milano"*
- *"Trova ordinanze del 2024 del Tribunale di Roma in materia di separazione"*
- *"Cerca provvedimenti che citano l'articolo 1453 del codice civile"*

**Lettura provvedimenti:**
- *"Leggi il testo integrale di questa sentenza: [incolla URL dalla BDP]"*
- *"Dimmi i metadati di questo provvedimento: giudice, materia, parole chiave"*

**Abstract e precedenti:**
- *"Cerca abstract sulla responsabilità del medico"*
- *"Ci sono precedenti conformi per questo abstract?"*

**Navigazione archivio:**
- *"Mostrami i tribunali del distretto di Napoli presenti in archivio"*
- *"Quali materie sono disponibili per il Tribunale di Torino?"*

**Utilità:**
- *"La sessione della Banca Dati è ancora attiva?"*
- *"Elenca tutte le materie disponibili nella BDP"*

---

## Quando la sessione scade

La sessione CIE dura circa **un anno**. Quando scade, Claude risponderà con un messaggio del tipo:

> *Sessione CIE scaduta. Ferma il server, esegui: npm run save-session, poi riavvia.*

Per rinnovarla, apri il Terminale nella cartella del progetto e ripeti il login:

```bash
cd ~/Documents/mcp-bdp-merito
node src/auth/save-session.js
```

Poi riavvia Claude Desktop.

---

## Domande frequenti

**Il browser si apre quando uso Claude — è normale?**
Sì. Lo strumento usa un browser invisibile in background per navigare la BDP. Nella prima chiamata dopo l'avvio di Claude, il browser si inizializza e potresti vederlo comparire brevemente nella Dock.

**I miei dati sono al sicuro?**
Lo strumento accede alla BDP usando le tue credenziali CIE, esattamente come faresti tu nel browser. Non invia nulla a server esterni — tutto rimane sul tuo Mac e sulla BDP del Ministero.

**Posso usarlo senza CIE?**
No. La BDP richiede autenticazione con CIE livello 3. Senza login non è possibile accedere ai provvedimenti.

**Funziona su Windows?**
Il progetto è sviluppato e testato su macOS. Potrebbe funzionare su Windows con adattamenti, ma non è supportato ufficialmente.

**Claude non trova i tool della BDP dopo la configurazione — cosa faccio?**
Verifica che il percorso nel file `claude_desktop_config.json` sia corretto, poi riavvia completamente Claude Desktop (chiudi dall'icona nella barra dei menu, non solo la finestra).

---

## Struttura del progetto

```
mcp-bdp-merito/
├── src/
│   ├── server.js              punto di ingresso del server MCP
│   ├── auth/
│   │   ├── save-session.js    script di login CIE
│   │   └── session-manager.js carica la sessione salvata
│   ├── browser/               gestione del browser interno
│   └── tools/                 gli 11 strumenti disponibili per Claude
├── spec/                      documentazione tecnica dei selettori DOM
├── sessioni/                  diario delle sessioni di sviluppo
├── CLAUDE.md                  istruzioni tecniche per lo sviluppo
└── GUIDA.md                   guida tecnica all'architettura
```

---

## Licenza e crediti

Sviluppato da [@avvocati-e-mac](https://github.com/avvocati-e-mac).

I dati provengono dalla [Banca Dati di Merito](https://bdp.giustizia.it) del Ministero della Giustizia — accesso gratuito previa autenticazione CIE.
