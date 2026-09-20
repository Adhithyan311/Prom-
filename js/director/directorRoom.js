import { Storage } from '../storage/storage.js';

import { updateDashboardStats } from './dashboard.js';

import {
  populateCandidatePickers,
  updateStudioCards
} from './matchStudio.js';

import {
  setAutomaticMatchingStudents,
  initializeMatchingModeSwitch
} from '../matching/automaticMatchingUI.js';

import { renderDirectoryList } from './cast.js';
import { renderMatchesList } from './scenes.js';

import { updateNavState } from '../ui/components.js';
import { logoutDirector } from '../auth/directorAuth.js';


/* =========================================================
   DIRECTOR ROOM STATE
========================================================= */

export let currentDirectoryFilter = 'all';

let directorStudents = [];


/*
 * Fast O(1) student lookup.
 */
const studentMap = new Map();


/*
 * Cached waiting pools.
 */
let waitingStudents = [];
let maleWaitingStudents = [];
let femaleWaitingStudents = [];


/*
 * IMPORTANT
 *
 * Contains every student who already has a row
 * in the matches table.
 *
 * This includes:
 * - draft matches
 * - published matches
 *
 * Therefore a student already used in a match
 * will NEVER appear again in the candidate dropdown.
 */
let matchedStudentIds = new Set();


/*
 * Realtime state.
 */
let directorStudentsChannel = null;
let directorMatchesChannel = null;
let realtimeRefreshTimer = null;


/*
 * Prevent multiple lobby initialisations at the same time.
 */
let lobbyRenderInProgress = false;
let pendingLobbyRender = false;


/*
 * Prevent repeatedly initialising the matching-mode switch.
 */
let matchingModeInitialized = false;


/*
 * Prevent duplicate Director tab initialisation.
 */
let directorTabsInitialized = false;


/* =========================================================
   SMALL HELPERS
========================================================= */

function normalizeStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}


function normalizeGender(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}


function isWaitingStudent(student) {
  return normalizeStatus(student?.status) === 'waiting';
}


/* =========================================================
   MATCH INDEX
========================================================= */

/*
 * Rebuild the Set of students that already participate
 * in a match.
 *
 * This is intentionally kept separate from student indexing.
 */
function rebuildMatchedStudentIndex(matches = []) {

  const ids = new Set();

  for (const match of matches || []) {

    if (match?.student_a_id) {
      ids.add(match.student_a_id);
    }

    if (match?.student_b_id) {
      ids.add(match.student_b_id);
    }

  }

  matchedStudentIds = ids;
}


/*
 * Check whether a student is already involved
 * in any draft/published match.
 */
export function isStudentAlreadyMatched(studentId) {

  if (!studentId) {
    return false;
  }

  return matchedStudentIds.has(studentId);

}


/* =========================================================
   STUDENT INDEXES
========================================================= */

function rebuildStudentIndexes() {

  studentMap.clear();

  waitingStudents = [];
  maleWaitingStudents = [];
  femaleWaitingStudents = [];


  for (const student of directorStudents) {

    if (!student?.id) {
      continue;
    }


    studentMap.set(
      student.id,
      student
    );


    /*
     * Only waiting students can be candidates.
     */
    if (!isWaitingStudent(student)) {
      continue;
    }


    /*
     * IMPORTANT:
     *
     * Even if the database status still says "waiting",
     * a student who already exists in matches is excluded.
     */
    if (matchedStudentIds.has(student.id)) {
      continue;
    }


    waitingStudents.push(student);


    const gender =
      normalizeGender(student.gender);


    if (gender === 'male') {

      maleWaitingStudents.push(student);

    } else if (gender === 'female') {

      femaleWaitingStudents.push(student);

    }

  }

}


/* =========================================================
   GET FAST STUDENT LOOKUP
========================================================= */

export function getDirectorStudentById(id) {

  if (!id) {
    return null;
  }

  return studentMap.get(id) || null;

}


/* =========================================================
   GET CACHED WAITING STUDENTS
========================================================= */

export function getAvailableMatchStudents() {

  return waitingStudents;

}


/* =========================================================
   GET CACHED MALE STUDENTS
========================================================= */

export function getMaleWaitingStudents() {

  return maleWaitingStudents;

}


/* =========================================================
   GET CACHED FEMALE STUDENTS
========================================================= */

export function getFemaleWaitingStudents() {

  return femaleWaitingStudents;

}


/* =========================================================
   LOAD MATCH INDEX
========================================================= */

/*
 * Loads only the information required to know whether
 * a student has already been used in a match.
 *
 * No student data is fetched here.
 */
async function loadMatchedStudentIds() {

  const client =
    window.supabaseClient;


  if (!client) {

    console.error(
      'Supabase client is unavailable.'
    );

    matchedStudentIds = new Set();

    return;

  }


  try {

    const {
      data,
      error
    } =
      await client
        .from('matches')
        .select(
          'student_a_id, student_b_id'
        );


    if (error) {

      console.error(
        'Failed to load Director matches:',
        error
      );

      /*
       * Fail closed.
       *
       * We don't want already matched students
       * accidentally appearing as candidates.
       */
      matchedStudentIds =
        new Set();

      return;

    }


    rebuildMatchedStudentIndex(
      data || []
    );


  } catch (error) {

    console.error(
      'Unexpected match index loading error:',
      error
    );


    matchedStudentIds =
      new Set();

  }

}


/* =========================================================
   REALTIME MATCH CHANGES
========================================================= */

/*
 * Matches realtime keeps matchedStudentIds synchronized.
 *
 * This is important because:
 *
 * CREATE DRAFT
 *      ↓
 * matches INSERT
 *      ↓
 * student immediately disappears
 * from candidate dropdown
 *
 *
 * REMOVE DRAFT
 *      ↓
 * matches DELETE
 *      ↓
 * student becomes available again
 *
 *
 * PUBLISH
 *      ↓
 * match UPDATE
 *      ↓
 * student remains unavailable
 */

export function subscribeToDirectorMatchChanges() {

  const client =
    window.supabaseClient;


  if (!client) {

    console.error(
      'Supabase client is unavailable.'
    );

    return;

  }


  if (directorMatchesChannel) {
    return;
  }


  directorMatchesChannel =
    client
      .channel(
        'same-scene-director-matches'
      )

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches'
        },

        payload => {

          handleRealtimeMatchChange(
            payload
          );

        }
      )

      .subscribe(
        status => {

          console.log(
            'Director match realtime:',
            status
          );

        }
      );

}


/* =========================================================
   HANDLE MATCH REALTIME CHANGE
========================================================= */

function handleRealtimeMatchChange(
  payload
) {

  const eventType =
    payload?.eventType;


  const oldMatch =
    payload?.old || null;


  const newMatch =
    payload?.new || null;


  /*
   * INSERT
   */
  if (eventType === 'INSERT') {

    if (newMatch?.student_a_id) {

      matchedStudentIds.add(
        newMatch.student_a_id
      );

    }


    if (newMatch?.student_b_id) {

      matchedStudentIds.add(
        newMatch.student_b_id
      );

    }

  }


  /*
   * UPDATE
   *
   * Student IDs normally don't change, but handling
   * old/new safely makes this robust.
   */
  else if (eventType === 'UPDATE') {

    /*
     * Remove old IDs first in case the pair changed.
     */
    if (oldMatch?.student_a_id) {

      matchedStudentIds.delete(
        oldMatch.student_a_id
      );

    }


    if (oldMatch?.student_b_id) {

      matchedStudentIds.delete(
        oldMatch.student_b_id
      );

    }


    /*
     * Add new IDs.
     */
    if (newMatch?.student_a_id) {

      matchedStudentIds.add(
        newMatch.student_a_id
      );

    }


    if (newMatch?.student_b_id) {

      matchedStudentIds.add(
        newMatch.student_b_id
      );

    }

  }


  /*
   * DELETE
   */
  else if (eventType === 'DELETE') {

    if (oldMatch?.student_a_id) {

      matchedStudentIds.delete(
        oldMatch.student_a_id
      );

    }


    if (oldMatch?.student_b_id) {

      matchedStudentIds.delete(
        oldMatch.student_b_id
      );

    }

  }


  /*
   * Rebuild the candidate pools.
   */
  rebuildStudentIndexes();


  /*
   * Keep automatic matching synchronized.
   */
  setAutomaticMatchingStudents(
    directorStudents
  );


  /*
   * Keep legacy storage synchronized.
   */
  saveCompatibilityCandidates();


  /*
   * Update UI after the match event.
   */
  scheduleRealtimeUIRefresh();

}


/* =========================================================
   REALTIME STUDENT CHANGES
========================================================= */

export function subscribeToDirectorStudentChanges() {

  const client =
    window.supabaseClient;


  if (!client) {

    console.error(
      'Supabase client is unavailable.'
    );

    return;

  }


  /*
   * Student channel.
   */
  if (!directorStudentsChannel) {

    directorStudentsChannel =
      client
        .channel(
          'same-scene-director-students'
        )

        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'students'
          },

          payload => {

            handleRealtimeStudentChange(
              payload
            );

          }
        )

        .subscribe(
          status => {

            console.log(
              'Director student realtime:',
              status
            );

          }
        );

  }


  /*
   * Match channel.
   */
  subscribeToDirectorMatchChanges();

}


/* =========================================================
   HANDLE ONE REALTIME STUDENT CHANGE
========================================================= */

function handleRealtimeStudentChange(
  payload
) {

  const eventType =
    payload?.eventType;


  const oldStudent =
    payload?.old || null;


  const newStudent =
    payload?.new || null;


  const studentId =
    newStudent?.id ||
    oldStudent?.id ||
    null;


  if (!studentId) {
    return;
  }


  /*
   * DELETE
   */
  if (eventType === 'DELETE') {

    directorStudents =
      directorStudents.filter(
        student =>
          student.id !== studentId
      );

  }


  /*
   * INSERT
   */
  else if (eventType === 'INSERT') {

    const exists =
      directorStudents.some(
        student =>
          student.id === studentId
      );


    if (!exists && newStudent) {

      directorStudents = [
        newStudent,
        ...directorStudents
      ];

    }

  }


  /*
   * UPDATE
   */
  else if (eventType === 'UPDATE') {

    const index =
      directorStudents.findIndex(
        student =>
          student.id === studentId
      );


    if (index !== -1) {

      directorStudents[index] =
        newStudent;

    } else if (newStudent) {

      directorStudents = [
        newStudent,
        ...directorStudents
      ];

    }

  }


  /*
   * Rebuild indexes.
   *
   * matchedStudentIds is deliberately preserved.
   */
  rebuildStudentIndexes();


  /*
   * Automatic matching.
   */
  setAutomaticMatchingStudents(
    directorStudents
  );


  /*
   * Legacy compatibility.
   */
  saveCompatibilityCandidates();


  /*
   * Refresh UI once for a burst of events.
   */
  scheduleRealtimeUIRefresh();

}


/* =========================================================
   DEBOUNCED REALTIME UI REFRESH
========================================================= */

function scheduleRealtimeUIRefresh() {

  clearTimeout(
    realtimeRefreshTimer
  );


  realtimeRefreshTimer =
    setTimeout(
      () => {

        updateDirectorUIAfterStudentChange();

      },
      80
    );

}


/* =========================================================
   UPDATE UI AFTER REALTIME CHANGE
========================================================= */

function updateDirectorUIAfterStudentChange() {

  /*
   * Match Studio.
   *
   * The cached waiting pools already exclude
   * students that exist in matches.
   */
  populateCandidatePickers(
    waitingStudents
  );


  /*
   * Selected cards.
   */
  updateStudioCards();


  /*
   * Dashboard.
   */
  updateDashboardStats();


  /*
   * Directory.
   */
  const directoryContainer =
    document.getElementById(
      'dr-directory-container'
    );


  if (
    directoryContainer ||
    document.querySelector(
      '#dr-tab-content-directory:not(.hidden)'
    )
  ) {

    renderDirectoryList(
      currentDirectoryFilter
    );

  }


  /*
   * Matches tab.
   */
  const matchesContent =
    document.getElementById(
      'dr-tab-content-matches'
    );


  if (
    matchesContent &&
    !matchesContent.classList.contains('hidden')
  ) {

    renderMatchesList();

  }

}


/* =========================================================
   LOAD STUDENTS FROM SUPABASE
========================================================= */

export async function loadDirectorStudents(
  options = {}
) {

  const {
    force = false
  } = options;


  if (!window.supabaseClient) {

    console.error(
      'Supabase client is unavailable.'
    );

    return directorStudents;

  }


  try {

    /*
     * Load students and matches in parallel.
     *
     * This avoids waiting for one request before
     * starting the other.
     */

    const [
      studentsResult,
      matchesResult
    ] =
      await Promise.all([

        window.supabaseClient
          .from('students')
          .select(`
            id,
            access_code,
            name,
            department,
            semester,
            instagram_id,
            favourite_movie,
            thriller_preference,
            romance_preference,
            emotional_preference,
            action_preference,
            gender,
            match_intent,
            status,
            created_at,
            updated_at
          `)
          .order(
            'created_at',
            {
              ascending: false
            }
          ),

        window.supabaseClient
          .from('matches')
          .select(
            'student_a_id, student_b_id'
          )

      ]);


    /*
     * Students error.
     */
    if (studentsResult.error) {

      console.error(
        'Failed to load Director students:',
        studentsResult.error
      );

      return directorStudents;

    }


    /*
     * Matches error.
     *
     * Fail closed so existing matched students
     * do not accidentally appear in the dropdown.
     */
    if (matchesResult.error) {

      console.error(
        'Failed to load Director matches:',
        matchesResult.error
      );

      matchedStudentIds =
        new Set();

    } else {

      rebuildMatchedStudentIndex(
        matchesResult.data || []
      );

    }


    /*
     * Replace local student state.
     */
    directorStudents =
      Array.isArray(
        studentsResult.data
      )
        ? studentsResult.data
        : [];


    /*
     * Rebuild indexes once.
     */
    rebuildStudentIndexes();


    /*
     * Automatic Matching gets the same array.
     */
    setAutomaticMatchingStudents(
      directorStudents
    );


    /*
     * Legacy Directory compatibility.
     */
    saveCompatibilityCandidates();


    return directorStudents;


  } catch (error) {

    console.error(
      'Unexpected Director student loading error:',
      error
    );


    return directorStudents;

  }

}


/* =========================================================
   LEGACY STORAGE COMPATIBILITY
========================================================= */

function saveCompatibilityCandidates() {

  const compatibilityCandidates =
    directorStudents.map(
      student => ({

        id:
          student.id,

        name:
          student.name,

        department:
          student.department,

        branch:
          student.department,

        semester:
          student.semester,

        instagram_id:
          student.instagram_id,

        instagram:
          student.instagram_id,

        handle:
          student.instagram_id,

        favoriteMovie:
          student.favourite_movie,

        favourite_movie:
          student.favourite_movie,

        thriller_preference:
          student.thriller_preference,

        romance_preference:
          student.romance_preference,

        emotional_preference:
          student.emotional_preference,

        action_preference:
          student.action_preference,

        gender:
          student.gender,

        matchIntent:
          student.match_intent,

        match_intent:
          student.match_intent,

        status:
          student.status === 'matched'
            ? 'MATCHED'
            : 'IN REVIEW',

        role:
          'candidate',

        created_at:
          student.created_at,

        updated_at:
          student.updated_at

      })
    );


  Storage.saveCandidates(
    compatibilityCandidates
  );

}


/* =========================================================
   GET ALL LOADED STUDENTS
========================================================= */

export function getDirectorStudents() {

  return directorStudents;

}


/* =========================================================
   FILTER HANDLING
========================================================= */

export function setFilter(
  filter
) {

  currentDirectoryFilter =
    filter;


  document
    .querySelectorAll(
      '.filter-chip'
    )
    .forEach(
      chip => {

        chip.classList.toggle(
          'active',
          chip.id ===
          `filter-${filter}`
        );

      }
    );


  renderDirectoryList(
    currentDirectoryFilter
  );

}


/* =========================================================
   RENDER DIRECTOR ROOM
========================================================= */

export async function renderDirectorLobby(
  options = {}
) {

  /*
   * Prevent duplicate full renders.
   */
  if (lobbyRenderInProgress) {

    pendingLobbyRender = true;

    return;

  }


  lobbyRenderInProgress = true;


  try {

    /*
     * Verify Director authentication.
     */
    const {
      isDirectorAuthenticated
    } =
      await import(
        '../auth/directorAuth.js'
      );


    if (
      !isDirectorAuthenticated()
    ) {

      location.replace(
        '#/director-login'
      );

      return;

    }


    /*
     * Initial/explicit render:
     *
     * fetch fresh students + matches.
     */
    const students =
      await loadDirectorStudents({
        force: true
      });


    /*
     * Subscribe to BOTH students and matches.
     */
    subscribeToDirectorStudentChanges();


    /*
     * Match Studio gets ONLY eligible candidates.
     *
     * waitingStudents has already excluded
     * everyone present in matches.
     */
    populateCandidatePickers(
      waitingStudents
    );


    /*
     * Selected cards.
     */
    updateStudioCards();


    /*
     * Matching mode only once.
     */
    if (!matchingModeInitialized) {

      initializeMatchingModeSwitch();

      matchingModeInitialized = true;

    }


    /*
     * Dashboard.
     */
    updateDashboardStats();


    /*
     * Directory.
     */
    renderDirectoryList(
      currentDirectoryFilter
    );


    /*
     * Matches.
     */
    renderMatchesList();


  } finally {

    lobbyRenderInProgress = false;


    /*
     * If another refresh was requested while rendering,
     * perform one additional render.
     */
    if (pendingLobbyRender) {

      pendingLobbyRender = false;

      queueMicrotask(
        () => {
          renderDirectorLobby();
        }
      );

    }

  }

}


/* =========================================================
   REFRESH DIRECTOR ROOM
========================================================= */

export async function refreshDirectorRoom(
  options = {}
) {

  return renderDirectorLobby(
    options
  );

}


/*
 * Global compatibility.
 */
window.refreshDirectorRoom =
  refreshDirectorRoom;


/* =========================================================
   DIRECTOR TABS
========================================================= */

export function switchDirectorTab(
  tabName
) {

  document
    .querySelectorAll(
      '.dr-tab'
    )
    .forEach(
      tab => {

        tab.classList.toggle(
          'active',
          tab.dataset.tab ===
          tabName
        );

      }
    );


  document
    .querySelectorAll(
      '.dr-sidebar-link'
    )
    .forEach(
      link => {

        link.classList.toggle(
          'active',
          link.dataset.tab ===
          tabName
        );

      }
    );


  const studioContent =
    document.getElementById(
      'dr-tab-content-studio'
    );


  const dirContent =
    document.getElementById(
      'dr-tab-content-directory'
    );


  const matchesContent =
    document.getElementById(
      'dr-tab-content-matches'
    );


  if (studioContent) {

    studioContent.classList.toggle(
      'hidden',
      tabName !== 'studio'
    );

  }


  if (dirContent) {

    dirContent.classList.toggle(
      'hidden',
      tabName !== 'directory'
    );

  }


  if (matchesContent) {

    matchesContent.classList.toggle(
      'hidden',
      tabName !== 'matches'
    );

  }


  /*
   * Directory.
   */
  if (
    tabName ===
    'directory'
  ) {

    renderDirectoryList(
      currentDirectoryFilter
    );

  }


  /*
   * Matches.
   */
  if (
    tabName ===
    'matches'
  ) {

    renderMatchesList();

  }

}


/* =========================================================
   INITIALISE DIRECTOR TABS
========================================================= */

export function initDirectorTabs() {

  /*
   * Prevent duplicate event listeners.
   */
  if (directorTabsInitialized) {
    return;
  }


  directorTabsInitialized = true;


  const tabs =
    document.querySelectorAll(
      '.dr-tab, .dr-sidebar-link[data-tab]'
    );


  tabs.forEach(
    tab => {

      tab.addEventListener(
        'click',

        event => {

          event.preventDefault();


          const tabName =
            tab.dataset.tab;


          if (tabName) {

            switchDirectorTab(
              tabName
            );

          }

        }
      );

    }
  );


  /* -----------------------------------------
     FILTERS
  ----------------------------------------- */

  const filterAll =
    document.getElementById(
      'filter-all'
    );


  const filterPending =
    document.getElementById(
      'filter-pending'
    );


  const filterMatched =
    document.getElementById(
      'filter-matched'
    );


  if (filterAll) {

    filterAll.onclick = () => {

      setFilter(
        'all'
      );

    };

  }


  if (filterPending) {

    filterPending.onclick = () => {

      setFilter(
        'pending'
      );

    };

  }


  if (filterMatched) {

    filterMatched.onclick = () => {

      setFilter(
        'matched'
      );

    };

  }


  /* -----------------------------------------
     DIRECTORY SEARCH
  ----------------------------------------- */

  const searchInput =
    document.getElementById(
      'dir-search-input'
    );


  if (searchInput) {

    let searchTimer = null;


    searchInput.oninput = () => {

      clearTimeout(
        searchTimer
      );


      searchTimer =
        setTimeout(
          () => {

            renderDirectoryList(
              currentDirectoryFilter
            );

          },
          80
        );

    };

  }


  /* -----------------------------------------
     SECURE LOGOUT
  ----------------------------------------- */

  const logoutBtn =
    document.getElementById(
      'dr-logout-btn'
    );


  if (logoutBtn) {

    logoutBtn.onclick =
      async event => {

        event.preventDefault();


        /*
         * Remove realtime subscriptions before logout.
         */
        unsubscribeFromDirectorStudentChanges();


        await logoutDirector();


        updateNavState();


        location.hash =
          '#/director-login';

      };

  }

}


/* =========================================================
   UNSUBSCRIBE REALTIME
========================================================= */

export function unsubscribeFromDirectorStudentChanges() {

  clearTimeout(
    realtimeRefreshTimer
  );

  realtimeRefreshTimer =
    null;


  if (
    directorStudentsChannel &&
    window.supabaseClient
  ) {

    window.supabaseClient
      .removeChannel(
        directorStudentsChannel
      );

  }


  if (
    directorMatchesChannel &&
    window.supabaseClient
  ) {

    window.supabaseClient
      .removeChannel(
        directorMatchesChannel
      );

  }


  directorStudentsChannel =
    null;


  directorMatchesChannel =
    null;

}


/* =========================================================
   OPTIONAL STATE RESET
========================================================= */

export function resetDirectorRoomState() {

  unsubscribeFromDirectorStudentChanges();


  directorStudents = [];


  studentMap.clear();


  waitingStudents = [];


  maleWaitingStudents = [];


  femaleWaitingStudents = [];


  matchedStudentIds =
    new Set();


  matchingModeInitialized =
    false;


  lobbyRenderInProgress =
    false;


  pendingLobbyRender =
    false;

}