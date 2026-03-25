// DEVE girare con headless: false — il browser deve essere visibile per il login CIE
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
const context = await browser.newContext({ viewport: null });
const page = await context.newPage();

await page.goto('https://bdp.giustizia.it/');

console.error('');
console.error('>>> Il browser si è aperto sulla BDP.');
console.error('>>> Completa il login CIE nel browser:');
console.error('>>>   1. Clicca il bottone "Accedi" o "Accedi con CIE"');
console.error('>>>   2. Nella pagina Azure B2C, clicca il bottone CIE');
console.error('>>>   3. Scansiona il QR code con l\'app CieID sul telefono');
console.error('>>>   4. Avvicina la CIE al lettore NFC e inserisci il PIN nell\'app');
console.error('>>>   5. Aspetta che il browser mostri la homepage della BDP (non /login)');
console.error('>>>');
console.error('>>> Quando la BDP è caricata e sei autenticato, premi INVIO qui...');
console.error('');

// Aspetta che l'utente prema INVIO — nessuna race condition possibile
await new Promise((resolve) => process.stdin.once('data', resolve));

// Verifica che il browser sia effettivamente sulla BDP autenticata
const currentUrl = page.url();
console.error('URL attuale del browser:', currentUrl);

if (
  currentUrl.includes('/login') ||
  currentUrl.includes('idserver.servizicie') ||
  currentUrl.includes('pst.giustizia.it') ||
  currentUrl.includes('auth03.giustizia.it')
) {
  console.error('');
  console.error('❌ Il browser non è ancora sulla BDP autenticata.');
  console.error('   Completa il login nel browser, poi riprova: npm run save-session');
  await browser.close();
  process.exit(1);
}

// Salva la sessione
await context.storageState({ path: './session.json' });
console.error('✅ Sessione salvata in session.json');

// Verifica finale: naviga a una pagina protetta per confermare
await page.goto('https://bdp.giustizia.it/search/standard?target=provvedimento', {
  waitUntil: 'networkidle',
});

if (page.url().includes('/login')) {
  console.error('');
  console.error('❌ Sessione non riconosciuta sulla pagina di ricerca.');
  console.error('   Riprova: npm run save-session');
  await browser.close();
  process.exit(1);
}

console.error('✅ Sessione verificata: accesso alla pagina di ricerca OK');
console.error('   Puoi avviare il server MCP con: node src/server.js');
await browser.close();
