/**
 * Película · Prom Night Edition — Director Entry
 * Handles subtle single-letter "d" link click navigation to Director Authentication.
 */

export function initDirectorEntry() {
  const dLink = document.getElementById("directorEntryLink");
  if (!dLink) return;

  dLink.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.hash = "#/director-login";
  });
}
