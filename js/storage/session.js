import { Storage } from './storage.js';

export function getSession() {
  return Storage.getSession();
}

export function saveSession(session) {
  Storage.saveSession(session);
}

export function clearSession() {
  Storage.clearSession();
}
