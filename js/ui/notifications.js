/**
 * Película · Prom Night Edition — UI Notifications
 * Toast / notification status messages
 */

export function showNotification(message, duration = 3000, targetId = 'match-msg') {
  const el = document.getElementById(targetId);
  if (!el) return;
  
  el.textContent = message;
  el.style.display = 'block';

  if (duration > 0) {
    setTimeout(() => {
      el.style.display = 'none';
    }, duration);
  }
}

export function hideNotification(targetId = 'match-msg') {
  const el = document.getElementById(targetId);
  if (el) {
    el.style.display = 'none';
  }
}
