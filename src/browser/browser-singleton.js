import { chromium } from 'playwright';
import { loadStorageState } from '../auth/session-manager.js';

let _browser = null;
let _context = null;
let _initPromise = null; // protezione da race condition su chiamate parallele

async function _doInit() {
  const storageState = loadStorageState();
  _browser = await chromium.launch({ headless: false });
  _browser.on('disconnected', () => {
    console.error('[mcp-bdp] Browser disconnesso — il prossimo tool call ricrea il context');
    _browser = null;
    _context = null;
  });
  _context = await _browser.newContext({ storageState });
  console.error('[mcp-bdp] Browser singleton avviato');
  return _context;
}

export async function getBrowserContext() {
  if (_browser?.isConnected() && _context) return _context;
  if (!_initPromise) {
    _initPromise = _doInit().finally(() => { _initPromise = null; });
  }
  return _initPromise;
}

export async function closeSharedContext() {
  await _context?.close().catch(() => {});
  await _browser?.close().catch(() => {});
  _browser = null;
  _context = null;
}
