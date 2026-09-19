import { Storage } from './storage.js';

/**
 * Same Scene — Legacy Participant Compatibility Layer
 *
 * Student registration is now handled by Supabase.
 * These functions are temporarily retained so the existing
 * Director UI does not break while we migrate it to Supabase.
 */

export function getCandidates() {
  return Storage.getCandidates();
}

export function saveCandidates(candidates) {
  Storage.saveCandidates(candidates);
}

export function getParticipants() {
  return Storage.getParticipants();
}

export function saveParticipants(participants) {
  Storage.saveParticipants(participants);
}

/**
 * Legacy helper.
 *
 * Kept temporarily for modules that still import it.
 * New student registrations should NOT use this function.
 */
export function createParticipantObject(payload = {}) {
  return {
    id: payload.id || `PL-${String(Date.now()).slice(-6)}`,
    name: payload.name || '',
    branch: payload.branch || '',
    semester: payload.semester || '',
    instagram: payload.instagram || '',
    favoriteMovie: payload.favoriteMovie || '',
    favoriteGenre: payload.favoriteGenre || '',
    favoriteMusic: payload.favoriteMusic || '',
    matchIntent: payload.matchIntent || 'romance',
    gender: payload.gender || '',
    matchedWith: payload.matchedWith ?? null,
    costumeTheme: payload.costumeTheme ?? null,
    role: 'candidate',
    department:
      payload.department ||
      `${payload.branch || ''} ${payload.semester || ''}`.trim(),
    handle: payload.instagram || payload.handle || '',
    status: payload.status || 'IN REVIEW',
    registrationDate:
      payload.registrationDate ||
      new Date().toLocaleDateString()
  };
}

/**
 * Legacy ID generator.
 *
 * Kept temporarily for old Director/localStorage modules.
 */
export function generateParticipantId() {
  const participants = Storage.getParticipants();

  return `PL-${String(participants.length + 1).padStart(3, '0')}`;
}

export function generateCandidateId() {
  const candidates = Storage.getCandidates();
  const nextNum = candidates.length + 1;

  return `PL-${String(nextNum).padStart(3, '0')}`;
}

/**
 * Old migration is intentionally disabled.
 *
 * We no longer want to manufacture:
 * - favourite genre
 * - favourite music
 * - costume
 * - fake Instagram values
 * - old participant fields
 */
export function migrateDataSchema() {
  // Intentionally empty.
  // Student data is now stored in Supabase.
}