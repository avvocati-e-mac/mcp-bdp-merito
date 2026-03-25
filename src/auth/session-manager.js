import { readFileSync, existsSync } from 'fs';

export function loadStorageState() {
  if (!existsSync('./session.json')) {
    throw new Error(
      'session.json non trovato. Esegui: npm run save-session'
    );
  }
  return JSON.parse(readFileSync('./session.json', 'utf-8'));
}
