import {
  getDirectorStudents,
  getDirectorStudentById,
  getMaleWaitingStudents,
  getFemaleWaitingStudents
} from './directorRoom.js';


/* =========================================================
   MATCH STUDIO STATE
========================================================= */

export let selectedReelAId = null;
export let selectedReelBId = null;


/*
 * Cached DOM references.
 */
let selectA = null;
let selectB = null;
let btnCreateMatch = null;


/*
 * Prevent repeatedly assigning picker listeners.
 */
let pickerListenersInitialized = false;


/*
 * Prevent unnecessary picker rebuilding.
 */
let lastMaleSignature = '';
let lastFemaleSignature = '';


/* =========================================================
   DOM REFERENCES
========================================================= */

function cacheDomReferences() {

  if (!selectA) {

    selectA =
      document.getElementById(
        'select-reel-a'
      );

  }


  if (!selectB) {

    selectB =
      document.getElementById(
        'select-reel-b'
      );

  }


  if (!btnCreateMatch) {

    btnCreateMatch =
      document.getElementById(
        'btn-create-match'
      );

  }

}


/* =========================================================
   SELECTION STATE
========================================================= */

export function setSelectedReelAId(id) {

  selectedReelAId =
    id || null;


  updateStudioCards();

}


export function setSelectedReelBId(id) {

  selectedReelBId =
    id || null;


  updateStudioCards();

}


/* =========================================================
   NORMALIZE GENDER
========================================================= */

function normalizeGender(
  gender
) {

  return String(
    gender || ''
  )
    .trim()
    .toLowerCase();

}


/* =========================================================
   CHECK WAITING STATUS
========================================================= */

function isWaitingStudent(
  student
) {

  return String(
    student?.status || ''
  )
    .trim()
    .toLowerCase() ===
    'waiting';

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
  value
) {

  return String(
    value ?? ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );

}


/* =========================================================
   CREATE STUDENT SIGNATURE
========================================================= */

function createPoolSignature(
  students
) {

  return students
    .map(
      student =>
        `${student.id}:${student.status}`
    )
    .join('|');

}


/* =========================================================
   BUILD OPTION HTML
========================================================= */

function buildOptions(
  pool,
  currentVal,
  placeholder
) {

  const options = [
    `<option value="">${escapeHtml(
      placeholder
    )}</option>`
  ];


  for (
    const student
    of pool
  ) {

    const selected =
      student.id === currentVal
        ? ' selected'
        : '';


    const instagram =
      student.instagram_id
        ? `@${String(
            student.instagram_id
          ).replace(
            /^@/,
            ''
          )}`
        : 'No Instagram';


    const movie =
      student.favourite_movie ||
      'No movie';


    options.push(
      `<option value="${escapeHtml(
        student.id
      )}"${selected}>` +
      `${escapeHtml(
        student.name
      )}` +
      ` (${escapeHtml(
        student.department
      )})` +
      ` · ${escapeHtml(
        student.semester || '—'
      )}` +
      ` · ${escapeHtml(
        instagram
      )}` +
      ` · ${escapeHtml(
        movie
      )}` +
      `</option>`
    );

  }


  return options.join('');

}


/* =========================================================
   INITIALIZE PICKER LISTENERS
========================================================= */

function initializePickerListeners() {

  cacheDomReferences();


  if (
    pickerListenersInitialized ||
    !selectA ||
    !selectB
  ) {

    return;

  }


  pickerListenersInitialized =
    true;


  /*
   * Candidate A selection.
   *
   * Candidate A is always a MALE student.
   */
  selectA.addEventListener(
    'change',
    event => {

      selectedReelAId =
        event.target.value ||
        null;


      updateStudioCards();

    }
  );


  /*
   * Candidate B selection.
   *
   * Candidate B is always a FEMALE student.
   */
  selectB.addEventListener(
    'change',
    event => {

      selectedReelBId =
        event.target.value ||
        null;


      updateStudioCards();

    }
  );

}


/* =========================================================
   POPULATE DIRECTOR PICKERS
========================================================= */

/*
 * IMPORTANT:
 *
 * This function intentionally does NOT use the `students`
 * parameter to determine Candidate A/B.
 *
 * The authoritative pools come from directorRoom.js:
 *
 * getMaleWaitingStudents()
 *      ↓
 * Candidate A
 *
 * getFemaleWaitingStudents()
 *      ↓
 * Candidate B
 *
 * directorRoom.js already removes:
 *
 * - non-waiting students
 * - students already present in matches
 *
 * Therefore scenes.js cannot accidentally put the wrong
 * gender into either dropdown.
 */

export function populateCandidatePickers() {

  cacheDomReferences();


  if (
    !selectA ||
    !selectB
  ) {

    return;

  }


  initializePickerListeners();


  /* =======================================================
     CANDIDATE A = MALE ONLY
  ======================================================= */

  const maleStudents =
    getMaleWaitingStudents();


  /* =======================================================
     CANDIDATE B = FEMALE ONLY
  ======================================================= */

  const femaleStudents =
    getFemaleWaitingStudents();


  /* =======================================================
     VALIDATE CURRENT MALE SELECTION
  ======================================================= */

  if (
    !maleStudents.some(
      student =>
        student.id ===
        selectedReelAId
    )
  ) {

    selectedReelAId =
      null;

  }


  /* =======================================================
     VALIDATE CURRENT FEMALE SELECTION
  ======================================================= */

  if (
    !femaleStudents.some(
      student =>
        student.id ===
        selectedReelBId
    )
  ) {

    selectedReelBId =
      null;

  }


  /* =======================================================
     CREATE POOL SIGNATURES
  ======================================================= */

  const maleSignature =
    createPoolSignature(
      maleStudents
    );


  const femaleSignature =
    createPoolSignature(
      femaleStudents
    );


  const maleChanged =
    maleSignature !==
    lastMaleSignature;


  const femaleChanged =
    femaleSignature !==
    lastFemaleSignature;


  /* =======================================================
     CANDIDATE A DROPDOWN
     MALE ONLY
  ======================================================= */

  if (maleChanged) {

    selectA.innerHTML =
      buildOptions(
        maleStudents,
        selectedReelAId,
        '-- Choose Male Student A --'
      );


    lastMaleSignature =
      maleSignature;

  }


  /* =======================================================
     CANDIDATE B DROPDOWN
     FEMALE ONLY
  ======================================================= */

  if (femaleChanged) {

    selectB.innerHTML =
      buildOptions(
        femaleStudents,
        selectedReelBId,
        '-- Choose Female Student B --'
      );


    lastFemaleSignature =
      femaleSignature;

  }


  /*
   * Restore selected values if the option list
   * did not need rebuilding.
   */
  if (
    !maleChanged &&
    selectA.value !==
      (selectedReelAId || '')
  ) {

    selectA.value =
      selectedReelAId || '';

  }


  if (
    !femaleChanged &&
    selectB.value !==
      (selectedReelBId || '')
  ) {

    selectB.value =
      selectedReelBId || '';

  }


  /*
   * Update the student cards.
   */
  updateStudioCards();

}


/* =========================================================
   UPDATE MATCH STUDIO CARDS
========================================================= */

export function updateStudioCards(
  handleCreateMatchCallback
) {

  cacheDomReferences();


  /*
   * O(1) student lookup.
   */
  let studentA =
    getDirectorStudentById(
      selectedReelAId
    );


  let studentB =
    getDirectorStudentById(
      selectedReelBId
    );


  /*
   * Compatibility fallback.
   *
   * Only used if the Director Room index has not
   * been populated yet.
   */
  if (
    selectedReelAId &&
    !studentA
  ) {

    const students =
      getDirectorStudents();


    studentA =
      students.find(
        student =>
          student.id ===
          selectedReelAId
      ) || null;

  }


  if (
    selectedReelBId &&
    !studentB
  ) {

    const students =
      getDirectorStudents();


    studentB =
      students.find(
        student =>
          student.id ===
          selectedReelBId
      ) || null;

  }


  /* =======================================================
     FAST TEXT UPDATE HELPER
  ======================================================= */

  const setEl = (
    id,
    text
  ) => {

    const el =
      document.getElementById(
        id
      );


    if (!el) {
      return;
    }


    el.textContent =
      text === undefined ||
      text === null ||
      text === ''
        ? '—'
        : String(text);

  };


  /* =======================================================
     STUDENT A
  ======================================================= */

  setEl(
    'lead-a-name',
    studentA
      ? studentA.name
      : 'No Student Selected'
  );


  setEl(
    'lead-a-dept',
    studentA
      ? studentA.department
      : 'Department'
  );


  setEl(
    'lead-a-handle',
    studentA?.instagram_id
      ? `@${String(
          studentA.instagram_id
        ).replace(
          /^@/,
          ''
        )}`
      : '@username'
  );


  setEl(
    'lead-a-movie',
    studentA?.favourite_movie ||
      '—'
  );


  setEl(
    'lead-a-genre',
    '—'
  );


  setEl(
    'lead-a-music',
    '—'
  );


  setEl(
    'lead-a-intent',
    studentA?.match_intent ||
      '—'
  );


  setEl(
    'lead-a-status',
    studentA?.status ||
      '—'
  );


  setEl(
    'reel-a-id',
    studentA
      ? `ID #${studentA.id}`
      : 'Select Student'
  );


  /* =======================================================
     STUDENT B
  ======================================================= */

  setEl(
    'lead-b-name',
    studentB
      ? studentB.name
      : 'No Student Selected'
  );


  setEl(
    'lead-b-dept',
    studentB
      ? studentB.department
      : 'Department'
  );


  setEl(
    'lead-b-handle',
    studentB?.instagram_id
      ? `@${String(
          studentB.instagram_id
        ).replace(
          /^@/,
          ''
        )}`
      : '@username'
  );


  setEl(
    'lead-b-movie',
    studentB?.favourite_movie ||
      '—'
  );


  setEl(
    'lead-b-genre',
    '—'
  );


  setEl(
    'lead-b-music',
    '—'
  );


  setEl(
    'lead-b-intent',
    studentB?.match_intent ||
      '—'
  );


  setEl(
    'lead-b-status',
    studentB?.status ||
      '—'
  );


  setEl(
    'reel-b-id',
    studentB
      ? `ID #${studentB.id}`
      : 'Select Student'
  );


  /* =======================================================
     MANUAL MATCH INDICATOR
  ======================================================= */

  const affinityPctDisplay =
    document.getElementById(
      'affinity-pct-display'
    );


  const affinityGaugeCircle =
    document.getElementById(
      'affinity-gauge-circle'
    );


  const quoteText =
    document.getElementById(
      'affinity-quote-text'
    );


  /*
   * No compatibility score.
   */
  if (affinityPctDisplay) {

    affinityPctDisplay.textContent =
      'MANUAL';

  }


  if (affinityGaugeCircle) {

    affinityGaugeCircle.setAttribute(
      'stroke-dashoffset',
      '132'
    );

  }


  setEl(
    'aff-bar-1-val',
    '—'
  );


  setEl(
    'aff-bar-2-val',
    '—'
  );


  setEl(
    'aff-bar-3-val',
    '—'
  );


  const bar1 =
    document.getElementById(
      'aff-bar-1'
    );


  const bar2 =
    document.getElementById(
      'aff-bar-2'
    );


  const bar3 =
    document.getElementById(
      'aff-bar-3'
    );


  if (bar1) {

    bar1.style.width =
      '0%';

  }


  if (bar2) {

    bar2.style.width =
      '0%';

  }


  if (bar3) {

    bar3.style.width =
      '0%';

  }


  /* =======================================================
     DIRECTOR DECISION MESSAGE
  ======================================================= */

  if (quoteText) {

    if (
      studentA &&
      studentB
    ) {

      quoteText.textContent =
        `Director's selection: ${studentA.name} × ${studentB.name}.`;

    } else {

      quoteText.textContent =
        'Select one male and one female student to prepare a scene.';

    }

  }


  /* =======================================================
     CREATE MATCH BUTTON
  ======================================================= */

  if (!btnCreateMatch) {
    return;
  }


  /*
   * Strict manual pairing rule:
   *
   * Candidate A → MALE
   * Candidate B → FEMALE
   * Both → WAITING
   * A !== B
   */
  const validPair =
    studentA &&
    studentB &&
    studentA.id !==
      studentB.id &&
    isWaitingStudent(
      studentA
    ) &&
    isWaitingStudent(
      studentB
    ) &&
    normalizeGender(
      studentA.gender
    ) === 'male' &&
    normalizeGender(
      studentB.gender
    ) === 'female';


  if (validPair) {

    btnCreateMatch.disabled =
      false;


    btnCreateMatch.style.opacity =
      '1';


    btnCreateMatch.style.cursor =
      'pointer';


    /*
     * Store the current callback on the button.
     *
     * We only install the actual click listener once.
     */
    btnCreateMatch.__matchStudioHandler =
      () => {

        if (
          typeof handleCreateMatchCallback ===
          'function'
        ) {

          handleCreateMatchCallback(
            studentA,
            studentB
          );

        } else if (
          typeof window.handleCreateMatch ===
          'function'
        ) {

          window.handleCreateMatch(
            studentA,
            studentB
          );

        }

      };


    if (
      !btnCreateMatch.__matchStudioListener
    ) {

      btnCreateMatch.__matchStudioListener =
        true;


      btnCreateMatch.addEventListener(
        'click',
        () => {

          const handler =
            btnCreateMatch.__matchStudioHandler;


          if (
            typeof handler ===
            'function'
          ) {

            handler();

          }

        }
      );

    }

  } else {

    btnCreateMatch.disabled =
      true;


    btnCreateMatch.style.opacity =
      '0.5';


    btnCreateMatch.style.cursor =
      'not-allowed';


    btnCreateMatch.__matchStudioHandler =
      null;

  }

}


/* =========================================================
   RESET MATCH STUDIO
========================================================= */

export function resetMatchStudio() {

  selectedReelAId =
    null;


  selectedReelBId =
    null;


  lastMaleSignature =
    '';


  lastFemaleSignature =
    '';


  cacheDomReferences();


  if (selectA) {

    selectA.value =
      '';

  }


  if (selectB) {

    selectB.value =
      '';

  }


  updateStudioCards();

}