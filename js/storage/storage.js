import { hashString } from '../matching/matchUtils.js';

export function normalizeMatchRecord(match, index = 0) {
  if (!match || typeof match !== 'object') return match;
  const safeSetId = match.costumeSetId ?? ((index % 4) + 1);
  const safeMatch = { ...match, costumeSetId: safeSetId };
  if (!safeMatch.serial && safeMatch.id) {
    safeMatch.serial = `MATCH-${String(100000 + (Math.abs(hashString(String(safeMatch.id))) % 899999))}`;
  }
  return safeMatch;
}

export function installMatchStorageGuard() {
  const storageObj = (typeof window !== 'undefined' && window.localStorage)
    ? window.localStorage
    : (typeof globalThis !== 'undefined' && globalThis.localStorage)
    ? globalThis.localStorage
    : null;
  if (!storageObj) return;

  const originalSetItem = storageObj.setItem.bind(storageObj);
  const originalGetItem = storageObj.getItem.bind(storageObj);

  storageObj.setItem = function(key, value) {
    if (key === 'pelicula_matches') {
      try {
        const parsed = JSON.parse(String(value));
        if (Array.isArray(parsed)) {
          value = JSON.stringify(parsed.map((match, index) => normalizeMatchRecord(match, index)));
        }
      } catch (error) {
        // ignore non-array payloads and let them pass as-is
      }
    }
    return originalSetItem(key, value);
  };

  storageObj.getItem = function(key) {
    const value = originalGetItem(key);
    if (key !== 'pelicula_matches' || !value) return value;
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return value;
      const normalized = parsed.map((match, index) => normalizeMatchRecord(match, index));
      const normalizedString = JSON.stringify(normalized);
      if (normalizedString !== value) {
        originalSetItem(key, normalizedString);
      }
      return normalizedString;
    } catch (error) {
      return value;
    }
  };
}

export const Storage = {
  getCandidates() {
    try {
      const centralized = localStorage.getItem('peliculaParticipants');
      if (centralized) return this.excludeDirectorRecords(JSON.parse(centralized));
      const data = localStorage.getItem('pelicula_candidates');
      return data ? this.excludeDirectorRecords(JSON.parse(data)) : [];
    } catch(e) { return []; }
  },
  excludeDirectorRecords(candidates) {
    if (!Array.isArray(candidates)) return candidates;
    return candidates.filter(candidate => candidate && candidate.role !== 'director');
  },
  saveCandidates(candidates) {
    localStorage.setItem('peliculaParticipants', JSON.stringify(candidates));
    localStorage.setItem('pelicula_candidates', JSON.stringify(candidates));
  },
  getParticipants() {
    return this.getCandidates();
  },
  saveParticipants(participants) {
    this.saveCandidates(participants);
  },
  getMatches() {
    try {
      const data = localStorage.getItem('pelicula_matches');
      const parsed = data ? JSON.parse(data) : [];
      const normalized = Array.isArray(parsed) ? parsed.map((match, index) => normalizeMatchRecord(match, index)) : [];
      if (JSON.stringify(normalized) !== data) {
        localStorage.setItem('pelicula_matches', JSON.stringify(normalized));
      }
      return normalized;
    } catch(e) { return []; }
  },
  saveMatches(matches) {
    const normalized = Array.isArray(matches) ? matches.map((match, index) => normalizeMatchRecord(match, index)) : [];
    localStorage.setItem('pelicula_matches', JSON.stringify(normalized));
  },
  getSession() {
    try {
      const data = localStorage.getItem('pelicula_session');
      return data ? JSON.parse(data) : null;
    } catch(e) { return null; }
  },
  saveSession(session) {
    localStorage.setItem('pelicula_session', JSON.stringify(session));
  },
  clearSession() {
    localStorage.removeItem('pelicula_session');
  },
  clearDirectorAuth() {
    localStorage.removeItem('peliculaDirectorAuthenticated');
  }
};

export function getItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

export function setItem(key, value) {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch (e) {}
}

export function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {}
}

export function clearItem(key) {
  if (key) {
    removeItem(key);
  } else {
    try {
      localStorage.clear();
    } catch (e) {}
  }
}

