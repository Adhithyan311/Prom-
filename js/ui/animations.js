let promCountdownInterval = null;

export function startPromCountdown() {
  const targetDate = new Date("2026-09-25T19:30:00");

  const update = () => {
    const container = document.getElementById("prom-countdown-container");
    if (!container) return;

    const now = new Date().getTime();
    const distance = targetDate.getTime() - now;

    if (distance <= 0) {
      if (promCountdownInterval) {
        clearInterval(promCountdownInterval);
        promCountdownInterval = null;
      }
      container.innerHTML = `
        <div class="stat-event-started" style="width:100%;text-align:center;padding:10px 0;">
          <div style="font-family:var(--serif);font-size:28px;color:var(--gold);letter-spacing:.08em;">✦ PROM NIGHT HAS BEGUN ✦</div>
          <div style="font-size:11px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-top:6px;">25 September 2026 · 7:30 PM — 9:30 PM</div>
        </div>
      `;
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    const pad = n => String(n).padStart(2, '0');

    const daysEl = document.getElementById("cd-days");
    const hoursEl = document.getElementById("cd-hours");
    const minsEl = document.getElementById("cd-mins");
    const secsEl = document.getElementById("cd-secs");

    if (daysEl) daysEl.textContent = pad(days);
    if (hoursEl) hoursEl.textContent = pad(hours);
    if (minsEl) minsEl.textContent = pad(minutes);
    if (secsEl) secsEl.textContent = pad(seconds);
  };

  update();
  if (promCountdownInterval) clearInterval(promCountdownInterval);
  promCountdownInterval = setInterval(update, 1000);
}
