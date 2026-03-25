import { getPage, assertNotRedirectedToLogin } from '../browser/browser-factory.js';

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 */
export function registerUtilityTools(server) {
  // Tool 9: verifica_sessione
  server.tool(
    'verifica_sessione',
    'Verifica se la sessione CIE è ancora attiva navigando la BDP',
    {},
    async () => {
      const page = await getPage();
      try {
        await page.goto('https://bdp.giustizia.it/', { waitUntil: 'networkidle' });
        const sessioneValida =
          !page.url().includes('idserver') && !page.url().includes('pst.giustizia') && !page.url().includes('/login');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                valida: sessioneValida,
                messaggio: sessioneValida
                  ? 'Sessione attiva'
                  : 'Sessione scaduta. Ferma il server (Ctrl+C), esegui: npm run save-session, poi riavvia.',
              }),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      } finally {
        await page.close();
      }
    }
  );

  // Tool 10: ottieni_materie
  server.tool(
    'ottieni_materie',
    'Estrae le materie disponibili dal select della ricerca BDP (live, non hardcoded)',
    {},
    async () => {
      const page = await getPage();
      try {
        await page.goto('https://bdp.giustizia.it/search/standard?target=provvedimento', {
          waitUntil: 'networkidle',
        });
        assertNotRedirectedToLogin(page);
        const materie = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('#materia option'))
            .map((o) => o.textContent.trim())
            .filter(Boolean);
        });
        return { content: [{ type: 'text', text: JSON.stringify({ materie }) }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      } finally {
        await page.close();
      }
    }
  );

  // Tool 11: ottieni_distretti
  server.tool(
    'ottieni_distretti',
    'Estrae i distretti giudiziari disponibili dal select della ricerca BDP (live, non hardcoded)',
    {},
    async () => {
      const page = await getPage();
      try {
        await page.goto('https://bdp.giustizia.it/search/standard?target=provvedimento', {
          waitUntil: 'networkidle',
        });
        assertNotRedirectedToLogin(page);
        const distretti = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('#distretto option'))
            .map((o) => o.textContent.trim())
            .filter(Boolean);
        });
        return { content: [{ type: 'text', text: JSON.stringify({ distretti }) }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: err.message }],
        };
      } finally {
        await page.close();
      }
    }
  );
}
