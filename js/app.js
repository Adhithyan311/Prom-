/**
 * Película · Prom Night Edition
 * Main application entry point loading modular ES modules.
 */

import { initializeDirectorAuth } from './auth/directorAuth.js';
import { installMatchStorageGuard } from './storage/storage.js';
import { migrateDataSchema } from './storage/participants.js';
import { normalizeRegistrationData } from './registration/validation.js';
import { initRegistrationForm, initDirectorLogin } from './registration/registration.js';
import { initDirectorEntry } from './director/directorEntry.js';
import {
  initDirectorTabs,
  renderDirectorLobby,
  switchDirectorTab
} from './director/directorRoom.js';
import { selectForReel } from './director/cast.js';
import { confirmUnmatch } from './director/scenes.js';
import { handleCreateMatch } from './matching/createMatch.js';
import { initializeRouter } from './router/router.js';
import { updateNavState } from './ui/components.js';

// Global window bindings for inline HTML event handlers and debugging
window.selectForReel = selectForReel;
window.confirmUnmatch = (matchId) => confirmUnmatch(matchId, renderDirectorLobby);
window.renderDirectorLobby = renderDirectorLobby;
window.switchDirectorTab = switchDirectorTab;
window.normalizeRegistrationData = normalizeRegistrationData;
window.handleCreateMatch = (studentA, studentB) =>
  handleCreateMatch(
    studentA,
    studentB,
    renderDirectorLobby
  );

export async function initializeApp() {
  installMatchStorageGuard();
  migrateDataSchema();

  initDirectorEntry();
  initRegistrationForm();
  initDirectorLogin();
  initDirectorTabs();

  // Restore Supabase Director session BEFORE starting the router.
  await initializeDirectorAuth();

  initializeRouter();

  window.addEventListener("load", () => {
    updateNavState();
  });
}

document.addEventListener("DOMContentLoaded", initializeApp);