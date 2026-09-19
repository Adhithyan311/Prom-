/**
 * Película · Prom Night Edition — UI Modals
 * Reusable modal helper functions
 */

export function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }
}

export function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
}

export function toggleModal(modalId, force) {
  const modal = document.getElementById(modalId);
  if (modal) {
    const isHidden = modal.classList.contains('hidden');
    const shouldShow = force !== undefined ? force : isHidden;
    if (shouldShow) {
      showModal(modalId);
    } else {
      hideModal(modalId);
    }
  }
}
