import { Storage } from './storage.js';

export function getMatches() {
  return Storage.getMatches();
}

export function saveMatches(matches) {
  Storage.saveMatches(matches);
}
