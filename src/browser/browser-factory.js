import { getBrowserContext } from './browser-singleton.js';

/**
 * Apre una nuova page nel context singleton condiviso.
 * I tool devono chiudere la page nel finally, MAI il browser o il context.
 * @returns {Promise<import('playwright').Page>}
 */
export async function getPage() {
  const context = await getBrowserContext();
  return context.newPage();
}

// Verifica sessione valida dopo ogni goto()
export function assertNotRedirectedToLogin(page) {
  const url = page.url();
  if (
    url.includes('idserver.servizicie') ||
    url.includes('pst.giustizia.it') ||
    url.includes('/login')
  ) {
    throw new Error(
      'Sessione CIE scaduta. Ferma il server (Ctrl+C), esegui: npm run save-session, poi riavvia.'
    );
  }
}
