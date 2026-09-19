import { routes } from '../config/constants.js';
import { isDirectorAuthenticated } from '../auth/directorAuth.js';
import { renderDirectorLobby } from '../director/directorRoom.js';
import { renderCandidateStatus } from '../student/studentStatus.js';
import { updateNavState, updateExperienceStats } from '../ui/components.js';

export function showRoute(route) {
  if (!routes.includes(route)) route = 'experience';

  if (route === 'director-room' && !isDirectorAuthenticated()) {
    location.replace('#/director-login');
    return;
  }

  routes.forEach(r => {
    const el = document.getElementById('view-' + r);
    if (el) el.classList.toggle('hidden', r !== route);
  });

  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });

  if (route === 'director-room') {
    renderDirectorLobby();
  } else if (route === 'status') {
    renderCandidateStatus();
  } else if (route === 'experience') {
    updateExperienceStats();
  }

  updateNavState();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function router() {
  const hash = location.hash.replace('#/', '') || 'experience';
  const route = hash || 'experience';

  showRoute(route);
}

export function initializeRouter() {
  window.addEventListener('hashchange', router);
  router();
}
