import { Storage } from '../storage/storage.js';
import { isDirectorAuthenticated } from '../auth/directorAuth.js';
import { startPromCountdown } from './animations.js';

export function updateNavState() {
  const session = Storage.getSession();
  const sessionBadge = document.getElementById('sessionBadge');
  const userAvatar = document.getElementById('userAvatar');

  if (session && session.role === 'candidate') {
    if (sessionBadge) {
      sessionBadge.textContent = `🎟 ${session.id}`;
      sessionBadge.classList.remove('hidden');
    }
    if (userAvatar) {
      userAvatar.title = `Candidate ${session.id}`;
      userAvatar.onclick = () => { location.hash = '#/status'; };
    }
  } else if (isDirectorAuthenticated()) {
    if (sessionBadge) {
      sessionBadge.textContent = '🎬 Director';
      sessionBadge.classList.remove('hidden');
    }
    if (userAvatar) {
      userAvatar.title = 'Director';
      userAvatar.onclick = null;
    }
  } else {
    if (sessionBadge) sessionBadge.classList.add('hidden');
    if (userAvatar) {
      userAvatar.title = 'No Active Session';
      userAvatar.onclick = null;
    }
  }
}

export function updateExperienceStats() {
  startPromCountdown();
}
