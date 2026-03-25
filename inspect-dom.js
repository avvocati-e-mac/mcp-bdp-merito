/**
 * Script di ispezione DOM della BDP.
 * Naviga la pagina di ricerca e stampa la struttura degli elementi chiave.
 * Esegui con: node inspect-dom.js
 */
import { chromium } from 'playwright';
import { loadStorageState } from './src/auth/session-manager.js';

const storageState = loadStorageState();
// Stessa configurazione di browser-factory.js — headless: false, no UA personalizzato
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ storageState });
const page = await context.newPage();

console.error('Cookie caricati:', (await context.cookies()).length);

console.error('Navigazione pagina ricerca...');
await page.goto('https://bdp.giustizia.it/search/standard?target=provvedimento', {
  waitUntil: 'networkidle',
});
console.error('URL dopo goto:', page.url());

// Se siamo ancora autenticati, aspetta che React monti il form
if (!page.url().includes('/login')) {
  console.error('Autenticato! Attendo mount React...');
  // Aspetta che compaia almeno un elemento con node= o un <select>
  try {
    await page.waitForSelector('[node], select, input[type="radio"]', { timeout: 15_000 });
  } catch {
    console.error('Nessun [node] trovato entro 15s — potrebbe servire più tempo');
  }
} else {
  console.error('SESSIONE SCADUTA — rieseguire npm run save-session');
  await browser.close();
  process.exit(1);
}

const report = await page.evaluate(() => {
  const nodeEls = Array.from(document.querySelectorAll('[node]'))
    .slice(0, 80)
    .map(el => ({
      tag: el.tagName.toLowerCase(),
      node: el.getAttribute('node'),
      ariaLabel: el.getAttribute('aria-label'),
      type: el.getAttribute('type'),
      role: el.getAttribute('role'),
      text: el.textContent.trim().slice(0, 60),
    }));

  const selects = Array.from(document.querySelectorAll('select')).map(el => ({
    node: el.getAttribute('node'),
    ariaLabel: el.getAttribute('aria-label'),
    optionsCount: el.options.length,
    firstOptions: Array.from(el.options).slice(0, 6).map(o => o.text.trim()),
  }));

  const radios = Array.from(document.querySelectorAll('input[type="radio"]')).map(el => ({
    node: el.getAttribute('node'),
    name: el.name,
    value: el.value,
    checked: el.checked,
    labelText: el.labels?.[0]?.textContent.trim() ?? '',
  }));

  const buttons = Array.from(document.querySelectorAll('button')).map(el => ({
    node: el.getAttribute('node'),
    text: el.textContent.trim().slice(0, 50),
    ariaLabel: el.getAttribute('aria-label'),
  }));

  const inputs = Array.from(document.querySelectorAll('input:not([type="radio"]):not([type="checkbox"])')).map(el => ({
    node: el.getAttribute('node'),
    type: el.type,
    placeholder: el.placeholder,
    ariaLabel: el.getAttribute('aria-label'),
  }));

  return { nodeEls, selects, radios, buttons, inputs, title: document.title };
});

console.log('\n=== TITLE:', report.title);

console.log(`\n=== ELEMENTI [node=] (${report.nodeEls.length}):`);
report.nodeEls.forEach(el =>
  console.log(`  [node="${el.node}"] <${el.tag}> type=${el.type ?? '-'} aria="${el.ariaLabel ?? '-'}" | "${el.text}"`)
);

console.log(`\n=== SELECT (${report.selects.length}):`);
report.selects.forEach(s =>
  console.log(`  [node="${s.node}"] aria="${s.ariaLabel}" opts=${s.optionsCount} → [${s.firstOptions.join(' | ')}]`)
);

console.log(`\n=== RADIO (${report.radios.length}):`);
report.radios.forEach(r =>
  console.log(`  [node="${r.node}"] name="${r.name}" value="${r.value}" checked=${r.checked} label="${r.labelText}"`)
);

console.log(`\n=== BUTTONS (${report.buttons.length}):`);
report.buttons.forEach(b =>
  console.log(`  [node="${b.node}"] aria="${b.ariaLabel}" | "${b.text}"`)
);

console.log(`\n=== INPUTS (${report.inputs.length}):`);
report.inputs.forEach(i =>
  console.log(`  [node="${i.node}"] type="${i.type}" placeholder="${i.placeholder}" aria="${i.ariaLabel}"`)
);

await browser.close();
