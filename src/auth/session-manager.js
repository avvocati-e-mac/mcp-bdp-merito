import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_PATH = path.resolve(__dirname, '../../session.json');

export function loadStorageState() {
  if (!existsSync(SESSION_PATH)) {
    throw new Error(
      'session.json non trovato. Esegui: npm run save-session'
    );
  }
  return JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));
}
