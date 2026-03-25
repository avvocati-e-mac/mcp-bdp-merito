/**
 * Script di test che invia richieste MCP via stdio al server
 * e stampa le risposte. Esegui con: node test-mcp.js
 */
import { spawn } from 'child_process';
import { createInterface } from 'readline';

const server = spawn('node', ['src/server.js'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'inherit'], // stderr del server va al nostro stderr
});

let msgId = 1;
const pending = new Map();

function send(obj) {
  const line = JSON.stringify(obj) + '\n';
  server.stdin.write(line);
}

function request(method, params) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    pending.set(id, { resolve, reject });
    send({ jsonrpc: '2.0', id, method, params });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout per ${method} id=${id}`));
      }
    }, 60_000);
  });
}

const rl = createInterface({ input: server.stdout });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id !== undefined && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});

async function callTool(name, args = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TOOL: ${name}`);
  console.log(`INPUT: ${JSON.stringify(args)}`);
  try {
    const result = await request('tools/call', { name, arguments: args });
    const text = result?.content?.[0]?.text ?? JSON.stringify(result);
    // Tronca output lunghi
    const preview = text.length > 800 ? text.slice(0, 800) + '\n... [troncato]' : text;
    if (result?.isError) {
      console.log(`❌ isError: ${preview}`);
    } else {
      console.log(`✅ OUTPUT: ${preview}`);
    }
    return result;
  } catch (e) {
    console.log(`💥 ECCEZIONE: ${e.message}`);
    return null;
  }
}

// Inizializzazione MCP
await request('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'test-client', version: '1.0' },
});
send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

// Lista tool disponibili
const toolsResult = await request('tools/list', {});
console.log(`\n📋 Tool registrati (${toolsResult.tools.length}):`);
toolsResult.tools.forEach(t => console.log(`  - ${t.name}`));

// Test 1: verifica_sessione
await callTool('verifica_sessione');

// Test 2: ottieni_materie
await callTool('ottieni_materie');

// Test 3: ottieni_distretti
await callTool('ottieni_distretti');

// Test 4: cerca_provvedimenti — ricerca leggera
await callTool('cerca_provvedimenti', { query: 'locazione', max_results: 3 });

// Test 5: validazione input errato
await callTool('cerca_provvedimenti', { tipo: 'INVALIDO' });

console.log(`\n${'='.repeat(60)}`);
console.log('Test completati.');
server.stdin.end();
server.kill();
process.exit(0);
