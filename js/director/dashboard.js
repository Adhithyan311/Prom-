import { Storage } from '../storage/storage.js';

export function updateDashboardStats() {
  const candidates = Storage.getCandidates();
  const candidateOnlyList = candidates.filter(c => c.role === "candidate");

  const totalRegistered = candidateOnlyList.length;
  const totalMatched = candidateOnlyList.filter(c => c.status === "MATCHED").length;
  const totalPending = candidateOnlyList.filter(c => c.status === "IN REVIEW").length;

  const statRegEl = document.getElementById("dr-stat-registered");
  const statMatEl = document.getElementById("dr-stat-matched");
  const statPenEl = document.getElementById("dr-stat-pending");

  if (statRegEl) statRegEl.textContent = totalRegistered;
  if (statMatEl) statMatEl.textContent = totalMatched;
  if (statPenEl) statPenEl.textContent = totalPending;

  return { totalRegistered, totalMatched, totalPending };
}
