import { routes } from '../config/constants.js';
import { isDirectorAuthenticated } from '../auth/directorAuth.js';
import { renderDirectorLobby } from '../director/directorRoom.js';
import { renderCandidateStatus } from '../student/studentStatus.js';
import { updateNavState, updateExperienceStats } from '../ui/components.js';
import { goToStep } from '../registration/registration.js';

let isScrollSpyActive = false;
let navToggleWired = false;

export function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    const navHeight = document.querySelector('.editorial-nav')?.offsetHeight || 75;
    const elementPosition = section.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = elementPosition - navHeight;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
}

/**
 * Single Central Student & Application View Rendering Function
 * Explicitly manages view DOM visibility by adding/removing the 'hidden' class.
 * Map:
 *   'home' / 'experience' -> #view-experience
 *   'register'           -> #view-register
 *   'match' / 'status'   -> #view-status
 */
export function showStudentView(viewName, targetSectionId = null) {
  let route = viewName;
  if (viewName === 'home') route = 'experience';
  if (viewName === 'match') route = 'status';

  if (!routes.includes(route)) route = 'experience';

  if (route === 'director-room' && !isDirectorAuthenticated()) {
    location.replace('#/director-login');
    return;
  }

  // Explicitly hide all top-level view containers using REAL IDs
  const viewMap = {
    experience: document.getElementById('view-experience'),
    register: document.getElementById('view-register'),
    status: document.getElementById('view-status'),
    'director-login': document.getElementById('view-director-login'),
    'director-room': document.getElementById('view-director-room')
  };

  Object.keys(viewMap).forEach(key => {
    if (viewMap[key]) {
      viewMap[key].classList.add('hidden');
    }
  });

  // Unhide ONLY the target view — this guarantees a nav click can only
  // ever result in exactly one view being visible at a time.
  const targetViewEl = viewMap[route] || viewMap.experience;
  if (targetViewEl) {
    targetViewEl.classList.remove('hidden');
  }

  // Close mobile navigation drawer if open
  closeMobileNav();

  // Update active state on navbar links — only the link matching the
  // current route (or current scroll target) gets the "active" class.
  document.querySelectorAll('.nav-links a').forEach(a => {
    const r = a.dataset.route;
    const isActive = (r === route) ||
                     (r === 'experience' && route === 'experience' && !targetSectionId) ||
                     (r === 'how-it-works' && targetSectionId === 'how-it-works-section');
    a.classList.toggle('active', isActive);
  });

  // "How It Works" only makes sense on Home — hide it everywhere else
  const howItWorksLink = document.getElementById('navLinkHowItWorks');
  if (howItWorksLink) {
    howItWorksLink.style.display = (route === 'experience') ? '' : 'none';
  }

  // Trigger feature rendering for the target view only
  if (route === 'register') {
    if (typeof goToStep === 'function') {
      goToStep(1);
    }
  } else if (route === 'status') {
    renderCandidateStatus();
  } else if (route === 'experience') {
    updateExperienceStats();
  } else if (route === 'director-room') {
    renderDirectorLobby();
  }

  updateNavState();

  if (targetSectionId) {
    setTimeout(() => {
      scrollToSection(targetSectionId);
    }, 60);
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Sync hash without breaking direct view rendering
  const expectedHash = targetSectionId === 'how-it-works-section'
    ? '#how-it-works-section'
    : targetSectionId === 'm-profile-section'
    ? '#m-profile-section'
    : '#/' + route;

  if (location.hash !== expectedHash) {
    history.pushState(null, '', expectedHash);
  }
}

export function showRoute(route, targetSectionId = null) {
  showStudentView(route, targetSectionId);
}

export function router() {
  const rawHash = location.hash.replace('#/', '').replace('#', '');

  if (rawHash === 'how-it-works-section' || rawHash === 'how-it-works') {
    showStudentView('home', 'how-it-works-section');
    return;
  }

  if (rawHash === 'm-profile-section') {
    showStudentView('match', 'm-profile-section');
    return;
  }

  if (rawHash === 'register') {
    showStudentView('register');
  } else if (rawHash === 'status') {
    showStudentView('match');
  } else if (rawHash === 'director-login' || rawHash === 'director-room') {
    showStudentView(rawHash);
  } else {
    showStudentView('home');
  }
}

function updateNavActiveRoute(activeRoute) {
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === activeRoute);
  });
}

function setupScrollSpy() {
  if (isScrollSpyActive) return;
  isScrollSpyActive = true;

  window.addEventListener('scroll', () => {
    const expView = document.getElementById('view-experience');
    if (!expView || expView.classList.contains('hidden')) return;

    const section = document.getElementById('how-it-works-section');
    if (!section) return;

    const navHeight = document.querySelector('.editorial-nav')?.offsetHeight || 75;
    const sectionTop = section.getBoundingClientRect().top + window.pageYOffset - navHeight - 60;

    const currentY = window.pageYOffset;
    if (currentY >= sectionTop) {
      updateNavActiveRoute('how-it-works');
    } else {
      updateNavActiveRoute('experience');
    }
  }, { passive: true });
}

/**
 * Closes the mobile nav drawer (if open). Safe to call even if the
 * elements don't exist or the drawer is already closed.
 */
function closeMobileNav() {
  const navLinksContainer = document.getElementById('navLinks');
  const navToggleBtn = document.getElementById('navToggleBtn');
  if (navLinksContainer) navLinksContainer.classList.remove('nav-open');
  if (navToggleBtn) navToggleBtn.classList.remove('active');
}

/**
 * Wires the mobile hamburger button to open/close the nav drawer.
 *
 * This is intentionally isolated from the rest of initializeRouter():
 * it is called FIRST and wrapped in its own try/catch so that an error
 * anywhere else during app startup (Supabase, director auth, etc.)
 * can never prevent the hamburger menu from working. It is also safe
 * to call more than once (idempotent) in case initialization runs twice.
 */
function setupMobileNavToggle() {
  if (navToggleWired) return;

  try {
    const navToggleBtn = document.getElementById('navToggleBtn');
    const navLinksContainer = document.getElementById('navLinks');

    if (!navToggleBtn || !navLinksContainer) {
      console.warn('[nav] navToggleBtn or navLinks element not found in DOM.');
      return;
    }

    navToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpened = navLinksContainer.classList.toggle('nav-open');
      navToggleBtn.classList.toggle('active', isOpened);
      navToggleBtn.setAttribute('aria-expanded', String(isOpened));
    });

    // Close the drawer when a nav link inside it is tapped — the link's
    // own click handler (wired below) handles the actual navigation;
    // this only closes the drawer so it never fights the navigation.
    navLinksContainer.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        navLinksContainer.classList.remove('nav-open');
        navToggleBtn.classList.remove('active');
        navToggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Close the drawer when tapping anywhere outside it
    document.addEventListener('click', (e) => {
      if (!navLinksContainer.classList.contains('nav-open')) return;
      if (!navLinksContainer.contains(e.target) && !navToggleBtn.contains(e.target)) {
        navLinksContainer.classList.remove('nav-open');
        navToggleBtn.classList.remove('active');
        navToggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Close the drawer on Escape for accessibility
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinksContainer.classList.contains('nav-open')) {
        navLinksContainer.classList.remove('nav-open');
        navToggleBtn.classList.remove('active');
        navToggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    navToggleWired = true;
  } catch (err) {
    console.error('[nav] Failed to wire mobile nav toggle:', err);
  }
}

/**
 * Binds a single nav-style anchor to a single navigation target.
 * Always calls preventDefault() first so the browser's native hash-jump
 * never runs — the anchor's ONLY effect is the one callback passed in.
 */
function bindNavLink(link, handler) {
  if (!link) return;
  link.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handler();
  };
}

export function initializeRouter() {
  // Wire the hamburger FIRST and defensively, so it always works even if
  // something below throws (Supabase, director auth, missing elements, etc.)
  setupMobileNavToggle();

  window.addEventListener('hashchange', router);

  const brandLogo = document.querySelector('.editorial-nav .brand');
  const navHome = document.querySelector('.nav-links a[data-route="experience"]');
  const navHowItWorks = document.getElementById('navLinkHowItWorks');
  const navRegister = document.querySelector('.nav-links a[data-route="register"]');
  const navStatus = document.getElementById('navLinkStatus');

  // Each nav link is bound to exactly ONE target — clicking it can only
  // ever route to (or scroll to) that single destination.
  bindNavLink(brandLogo, () => showStudentView('home'));
  bindNavLink(navHome, () => showStudentView('home'));
  bindNavLink(navHowItWorks, () => showStudentView('home', 'how-it-works-section'));
  bindNavLink(navRegister, () => showStudentView('register'));
  bindNavLink(navStatus, () => showStudentView('match'));

  // Hero CTA "Find Your Prom Match" — always routes to Register, nothing else
  document.querySelectorAll('.hero-find-match-btn').forEach(btn => {
    bindNavLink(btn, () => showStudentView('register'));
  });

  // Any other stray link pointing at these hashes gets the same single-target
  // treatment, so no link on the page can ever cause a double-navigation.
  document.querySelectorAll('a[href="#/register"]').forEach(link => {
    if (link !== navRegister) bindNavLink(link, () => showStudentView('register'));
  });

  document.querySelectorAll('a[href="#/status"]').forEach(link => {
    if (link !== navStatus) bindNavLink(link, () => showStudentView('match'));
  });

  document.querySelectorAll('a[href="#/experience"]').forEach(link => {
    if (link !== navHome && !link.classList.contains('secret-director-trigger')) {
      bindNavLink(link, () => showStudentView('home'));
    }
  });

  setupScrollSpy();

  // Render initial view based on current location hash
  router();
}