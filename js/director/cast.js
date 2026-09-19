import { Storage } from '../storage/storage.js';
import { norm } from '../matching/matchUtils.js';
import { setSelectedReelAId, setSelectedReelBId, updateStudioCards } from './matchStudio.js';

/**
 * Escape user-submitted text before inserting it into HTML.
 *
 * SECURITY: every field rendered here (name, department,
 * instagram, matchIntent, favoriteMovie, favoriteGenre,
 * favoriteMusic) originates from student self-registration
 * and is NOT sanitized before it reaches this file. It MUST
 * be escaped here, at the point of innerHTML interpolation.
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderDirectoryList(currentFilter = 'all') {
  const container = document.getElementById("dir-candidates-container");
  if (!container) return;

  const candidates = Storage.getCandidates().filter(c => c.role === "candidate");
  const searchInput = document.getElementById("dir-search-input");
  const q = searchInput ? norm(searchInput.value) : "";

  let filtered = candidates.filter(c => {
    if (currentFilter === "pending" && c.status !== "IN REVIEW") return false;
    if (currentFilter === "matched" && c.status !== "MATCHED") return false;
    if (q) {
      const target = norm(`${c.name} ${c.department} ${c.instagram} ${c.favoriteMovie} ${c.favoriteGenre} ${c.favoriteMusic} ${c.id}`);
      return target.includes(q);
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--muted);font-style:italic;">No candidates found in dossier archive.</div>`;
    return;
  }

  let html = "";
  filtered.forEach(c => {
    const isMatched = c.status === "MATCHED";
    const statusClass = isMatched ? "matched" : "in-review";

    html += `
      <div class="directory-card">
        <div class="info-col">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
            <h4>${escapeHtml(c.name)}</h4>
            <span class="status-badge ${statusClass}">${escapeHtml(c.status)}</span>
            <span style="font-size:10px;color:var(--gold);">#${escapeHtml(c.id)}</span>
          </div>
          <div class="sub-info">
            Branch/Sem: <b>${escapeHtml(c.department)}</b> &nbsp;·&nbsp; Instagram: <b>@${escapeHtml(c.instagram || c.handle)}</b> &nbsp;·&nbsp; Intent: <b>${escapeHtml(c.matchIntent)}</b>
          </div>
          <div style="font-size:12px;color:var(--cream-text);margin-top:4px;">
            🎬 <b>Movie:</b> ${escapeHtml(c.favoriteMovie) || '—'} &nbsp;|&nbsp;
            ✨ <b>Genre:</b> ${escapeHtml(c.favoriteGenre) || '—'} &nbsp;|&nbsp;
            🎵 <b>Music:</b> ${escapeHtml(c.favoriteMusic) || '—'}
          </div>
        </div>
        <div class="actions">
          ${!isMatched ? `
            <button class="btn btn-outline btn-sm" onclick="selectForReel('${c.id}', 'A')">Cast Reel A</button>
            <button class="btn btn-outline btn-sm" onclick="selectForReel('${c.id}', 'B')">Cast Reel B</button>
          ` : `<span style="font-size:11px;color:var(--muted);">Prom Pair</span>`}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

export function selectForReel(candId, reel, switchDirectorTabCallback) {
  if (reel === 'A') setSelectedReelAId(candId);
  if (reel === 'B') setSelectedReelBId(candId);

  if (typeof switchDirectorTabCallback === 'function') {
    switchDirectorTabCallback('studio');
  } else if (typeof window.switchDirectorTab === 'function') {
    window.switchDirectorTab('studio');
  }
  updateStudioCards();
}
