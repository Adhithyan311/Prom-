// ============================================================
// AUTOMATIC MATCHING UI
// Película · Prom Night
// ============================================================

import {
  generateAutomaticMatches,
  getMatchingBasis
} from "./automaticMatcher.js";

import {
  isDirectorAuthenticated
} from "../auth/directorAuth.js";


// ============================================================
// STATE
// ============================================================

let currentStudents = [];

let generatedResult = null;

let currentBatchId = null;


// ============================================================
// SUPABASE
// ============================================================

function getSupabaseClient() {
  return typeof window !== "undefined"
    ? window.supabaseClient || null
    : null;
}


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


// ============================================================
// ROOT
// ============================================================

function getRoot() {

  return document.getElementById(
    "automatic-matching-root"
  );

}


// ============================================================
// SET STUDENTS
// ============================================================

export function setAutomaticMatchingStudents(
  students = []
) {

  currentStudents =
    Array.isArray(students)
      ? students
      : [];

}


// ============================================================
// STUDENT CARD
// ============================================================

function renderStudent(student) {

  const instagram =
    String(
      student?.instagram_id || ""
    )
      .trim()
      .replace(/^@/, "");


  return `
    <div class="auto-student">

      <div class="auto-student-name">
        ${escapeHtml(student?.name)}
      </div>

      <div class="auto-student-meta">
        ${escapeHtml(student?.department)}
        ·
        ${escapeHtml(student?.semester)}
      </div>

      <div class="auto-student-movie">
        ${escapeHtml(student?.favourite_movie)}
      </div>

      ${
        instagram
          ? `
            <div class="auto-student-instagram">
              @${escapeHtml(instagram)}
            </div>
          `
          : ""
      }

    </div>
  `;

}


// ============================================================
// PAIR CARD
// ============================================================

function renderPair(pair, index) {

  const basis =
    getMatchingBasis(
      pair.male,
      pair.female
    );


  return `
    <article class="auto-pair-card">

      <div class="auto-pair-number">
        PAIR
        ${String(index + 1).padStart(2, "0")}
      </div>

      <div class="auto-pair">

        <!-- MALE -->

        <div class="auto-person">

          <div class="auto-gender-label">
            MALE
          </div>

          ${renderStudent(pair.male)}

        </div>


        <!-- HEART -->

        <div class="auto-heart">
          ♥
        </div>


        <!-- FEMALE -->

        <div class="auto-person">

          <div class="auto-gender-label">
            FEMALE
          </div>

          ${renderStudent(pair.female)}

        </div>

      </div>


      <!-- MATCHING BASIS -->

      <div class="auto-basis">

        <div class="auto-basis-title">
          MATCHING BASIS
        </div>

        <div class="auto-basis-items">

          ${basis.map(
            item => `
              <span class="auto-basis-chip">
                ✓
                ${escapeHtml(item)}
              </span>
            `
          ).join("")}

        </div>

      </div>

    </article>
  `;

}


// ============================================================
// INITIAL PANEL
// ============================================================

function renderInitialPanel() {

  const root =
    getRoot();

  if (!root) return;


  root.innerHTML = `

    <div class="automatic-empty">

      <div class="automatic-title">
        AUTOMATIC MATCHING
      </div>

      <div class="automatic-description">

        Generate one-to-one
        Male ↔ Female match
        suggestions from students
        currently waiting.

      </div>

      <div class="automatic-rule-note">

        Only Male ↔ Female pairs
        are eligible.

        Same-gender pairs will never
        be generated.

      </div>

      <button
        type="button"
        class="btn btn-primary"
        id="generate-automatic-matches"
      >
        GENERATE MATCHES
      </button>

    </div>

  `;


  const button =
    document.getElementById(
      "generate-automatic-matches"
    );


  if (button) {

    button.onclick =
      generateAutomaticMatchesForUI;

  }

}


// ============================================================
// GENERATE AUTOMATIC MATCHES
// ============================================================

async function generateAutomaticMatchesForUI() {

  if (!isDirectorAuthenticated()) {

    alert(
      "Director authentication is required."
    );

    return;

  }


  const button =
    document.getElementById(
      "generate-automatic-matches"
    );


  if (button) {

    button.disabled = true;

    button.textContent =
      "GENERATING...";

  }


  try {

    const client =
      getSupabaseClient();


    if (!client) {

      throw new Error(
        "Supabase is not available."
      );

    }


    // --------------------------------------------------------
    // ONE QUERY:
    // Get all currently waiting students.
    // --------------------------------------------------------

    const {
      data: freshStudents,
      error: studentsError
    } =
      await client
        .from("students")
        .select(`
          id,
          name,
          department,
          semester,
          instagram_id,
          favourite_movie,
          gender,
          match_intent,
          status,
          created_at,
          updated_at
        `)
        .eq(
          "status",
          "waiting"
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        );


    if (studentsError) {
      throw studentsError;
    }


    currentStudents =
      Array.isArray(freshStudents)
        ? freshStudents
        : [];


    // --------------------------------------------------------
    // ONE QUERY:
    // Get all existing matches.
    //
    // This prevents students already involved in a draft
    // or published match from being generated again.
    // --------------------------------------------------------

    const {
      data: existingMatches,
      error: matchesError
    } =
      await client
        .from("matches")
        .select(`
          student_a_id,
          student_b_id
        `)
        .in(
          "status",
          [
            "draft",
            "published"
          ]
        );


    if (matchesError) {
      throw matchesError;
    }


    // --------------------------------------------------------
    // EXCLUDE ALREADY USED STUDENTS
    // --------------------------------------------------------

    const excludedStudentIds =
      new Set();


    for (
      const match
      of existingMatches || []
    ) {

      if (match.student_a_id) {

        excludedStudentIds.add(
          match.student_a_id
        );

      }


      if (match.student_b_id) {

        excludedStudentIds.add(
          match.student_b_id
        );

      }

    }


    // --------------------------------------------------------
    // IMPORTANT:
    //
    // Only pass students that are:
    //
    // 1. waiting
    // 2. not already in a match
    //
    // This keeps the matcher smaller and faster.
    // --------------------------------------------------------

    const eligibleStudents =
      currentStudents.filter(
        student =>
          !excludedStudentIds.has(
            student.id
          )
      );


    // --------------------------------------------------------
    // MATCH IN MEMORY
    // --------------------------------------------------------

    generatedResult =
      generateAutomaticMatches(
        eligibleStudents
      );


    // --------------------------------------------------------
    // BATCH ID
    // --------------------------------------------------------

    currentBatchId =
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : String(Date.now());


    // --------------------------------------------------------
    // RENDER
    // --------------------------------------------------------

    renderResults();


  } catch (error) {

    console.error(
      "Automatic matching error:",
      error
    );


    alert(
      error?.message ||
      "Unable to generate automatic matches."
    );


  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        "GENERATE MATCHES";

    }

  }

}


// ============================================================
// UNMATCHED MESSAGE
// ============================================================

function renderUnmatchedMessage(result) {

  const unmatchedMales =
    result?.unmatchedMales || [];


  const unmatchedFemales =
    result?.unmatchedFemales || [];


  if (
    unmatchedMales.length === 0 &&
    unmatchedFemales.length === 0
  ) {

    return `
      <div class="automatic-balanced">
        All eligible students have been paired.
      </div>
    `;

  }


  return `

    <div class="automatic-unmatched warning">

      <strong>
        Some students remain unmatched.
      </strong>

      ${
        unmatchedMales.length > 0
          ? `
            <span>
              ${unmatchedMales.length}
              male student${
                unmatchedMales.length === 1
                  ? ""
                  : "s"
              }
              remain unmatched.
            </span>
          `
          : ""
      }

      ${
        unmatchedFemales.length > 0
          ? `
            <span>
              ${unmatchedFemales.length}
              female student${
                unmatchedFemales.length === 1
                  ? ""
                  : "s"
              }
              remain unmatched.
            </span>
          `
          : ""
      }

      <span>
        The remaining students will stay
        in the waiting pool and will not
        be matched automatically.
      </span>

    </div>

  `;

}


// ============================================================
// RENDER RESULTS
// ============================================================

function renderResults() {

  const root =
    getRoot();

  if (!root) return;


  if (!generatedResult) {

    renderInitialPanel();

    return;

  }


  const pairs =
    generatedResult.pairs || [];


  const males =
    generatedResult.males || [];


  const females =
    generatedResult.females || [];


  // ========================================================
  // NO PAIRS
  // ========================================================

  if (pairs.length === 0) {

    root.innerHTML = `

      <div class="automatic-results">

        <div class="automatic-title">
          AUTOMATIC MATCH RESULTS
        </div>

        <div class="automatic-empty-message">

          No eligible Male ↔ Female
          pairs could be generated.

        </div>

        <div class="automatic-summary">

          <div class="automatic-summary-item">

            <span>
              WAITING MALES
            </span>

            <strong>
              ${males.length}
            </strong>

          </div>


          <div class="automatic-summary-item">

            <span>
              WAITING FEMALES
            </span>

            <strong>
              ${females.length}
            </strong>

          </div>


          <div class="automatic-summary-item">

            <span>
              PAIRS
            </span>

            <strong>
              0
            </strong>

          </div>

        </div>


        ${renderUnmatchedMessage(
          generatedResult
        )}


        <button
          type="button"
          class="btn btn-secondary"
          id="regenerate-automatic-matches"
        >
          CHECK AGAIN
        </button>

      </div>

    `;


    const regenerateButton =
      document.getElementById(
        "regenerate-automatic-matches"
      );


    if (regenerateButton) {

      regenerateButton.onclick =
        generateAutomaticMatchesForUI;

    }


    return;

  }


  // ========================================================
  // RESULTS
  // ========================================================

  root.innerHTML = `

    <div class="automatic-results">

      <div class="automatic-results-header">

        <div>

          <div class="automatic-title">
            AUTOMATIC MATCH RESULTS
          </div>

          <div class="automatic-preview-badge">
            PREVIEW ONLY — nothing saved yet
          </div>

          <div class="automatic-count">

            ${pairs.length}
            pair${
              pairs.length === 1
                ? ""
                : "s"
            }
            generated

          </div>

        </div>


        <button
          type="button"
          class="btn btn-secondary"
          id="regenerate-automatic-matches"
        >
          REGENERATE
        </button>

      </div>


      <div class="automatic-summary">

        <div class="automatic-summary-item">

          <span>
            WAITING MALES
          </span>

          <strong>
            ${males.length}
          </strong>

        </div>


        <div class="automatic-summary-item">

          <span>
            WAITING FEMALES
          </span>

          <strong>
            ${females.length}
          </strong>

        </div>


        <div class="automatic-summary-item">

          <span>
            PAIRS GENERATED
          </span>

          <strong>
            ${pairs.length}
          </strong>

        </div>

      </div>


      ${renderUnmatchedMessage(
        generatedResult
      )}


      <div class="automatic-pairs">

        ${pairs.map(
          (pair, index) =>
            renderPair(
              pair,
              index
            )
        ).join("")}

      </div>


      <div class="automatic-actions">

        <button
          type="button"
          class="btn btn-primary"
          id="create-automatic-drafts"
        >
          CREATE DRAFT MATCHES
        </button>

      </div>


    </div>

  `;


  const regenerateButton =
    document.getElementById(
      "regenerate-automatic-matches"
    );


  if (regenerateButton) {

    regenerateButton.onclick =
      generateAutomaticMatchesForUI;

  }


  const createButton =
    document.getElementById(
      "create-automatic-drafts"
    );


  if (createButton) {

    createButton.onclick =
      createAutomaticDrafts;

  }

}


// ============================================================
// CREATE AUTOMATIC DRAFT MATCHES
// ============================================================
//
// PERFORMANCE:
// Previously:
//   Pair 1 → SELECT
//   Pair 2 → SELECT
//   Pair 3 → SELECT
//   ...
//
// Now:
//   1 SELECT for all students
//   1 BULK INSERT for all matches
//
// This is significantly faster.
// ============================================================

async function createAutomaticDrafts() {

  if (
    !generatedResult ||
    !Array.isArray(
      generatedResult.pairs
    ) ||
    generatedResult.pairs.length === 0
  ) {

    return;

  }


  if (!isDirectorAuthenticated()) {

    alert(
      "Director authentication is required."
    );

    return;

  }


  const client =
    getSupabaseClient();


  if (!client) {

    alert(
      "Supabase is not available."
    );

    return;

  }


  const button =
    document.getElementById(
      "create-automatic-drafts"
    );


  if (button) {

    button.disabled = true;

    button.textContent =
      "CREATING DRAFTS...";

  }


  try {

    const pairs =
      generatedResult.pairs;


    // ========================================================
    // COLLECT ALL STUDENT IDS
    // ========================================================

    const studentIds =
      [
        ...new Set(
          pairs.flatMap(
            pair => [
              pair.male.id,
              pair.female.id
            ]
          )
        )
      ];


    // ========================================================
    // ONE DATABASE QUERY
    // ========================================================

    const {
      data: latestStudents,
      error: studentError
    } =
      await client
        .from("students")
        .select(`
          id,
          gender,
          status
        `)
        .in(
          "id",
          studentIds
        );


    if (studentError) {
      throw studentError;
    }


    // ========================================================
    // MAP STUDENTS FOR O(1) LOOKUPS
    // ========================================================

    const studentMap =
      new Map();


    for (
      const student
      of latestStudents || []
    ) {

      studentMap.set(
        student.id,
        student
      );

    }


    // ========================================================
    // VALIDATE IN MEMORY
    // ========================================================

    const pairRows = [];

    const usedStudentIds =
      new Set();

    // Pairs that fail revalidation are SKIPPED, not fatal —
    // the DB state may have legitimately moved since Generate
    // ran (spec: stale-state protection, section 21). We still
    // insert whatever remains valid instead of aborting the
    // whole batch.
    let skippedCount = 0;


    for (
      const pair
      of pairs
    ) {

      const maleId =
        pair?.male?.id;


      const femaleId =
        pair?.female?.id;


      // ------------------------------------------------------
      // ID VALIDATION
      // ------------------------------------------------------

      if (
        !maleId ||
        !femaleId ||
        maleId === femaleId
      ) {

        skippedCount += 1;
        continue;

      }


      // ------------------------------------------------------
      // ONE STUDENT = ONE MATCH
      // ------------------------------------------------------

      if (
        usedStudentIds.has(maleId) ||
        usedStudentIds.has(femaleId)
      ) {

        skippedCount += 1;
        continue;

      }


      const male =
        studentMap.get(
          maleId
        );


      const female =
        studentMap.get(
          femaleId
        );


      if (
        !male ||
        !female
      ) {

        // Student no longer exists in the latest fetch.
        skippedCount += 1;
        continue;

      }


      // ------------------------------------------------------
      // GENDER VALIDATION
      // ------------------------------------------------------

      const maleGender =
        String(
          male.gender || ""
        )
          .trim()
          .toLowerCase();


      const femaleGender =
        String(
          female.gender || ""
        )
          .trim()
          .toLowerCase();


      if (
        maleGender !== "male" ||
        femaleGender !== "female"
      ) {

        skippedCount += 1;
        continue;

      }


      // ------------------------------------------------------
      // STATUS VALIDATION
      // ------------------------------------------------------

      const maleStatus =
        String(
          male.status || ""
        )
          .trim()
          .toLowerCase();


      const femaleStatus =
        String(
          female.status || ""
        )
          .trim()
          .toLowerCase();


      if (
        maleStatus !== "waiting" ||
        femaleStatus !== "waiting"
      ) {

        // One of them was taken by another action (manual
        // match, another automatic batch, etc.) since Generate.
        skippedCount += 1;
        continue;

      }


      // ------------------------------------------------------
      // RESERVE IDS LOCALLY
      // ------------------------------------------------------

      usedStudentIds.add(
        maleId
      );

      usedStudentIds.add(
        femaleId
      );


      // ------------------------------------------------------
      // BUILD BULK INSERT ROW
      // ------------------------------------------------------

      pairRows.push({

        student_a_id:
          maleId,

        student_b_id:
          femaleId,

        status:
          "draft"

      });

    }


    // ========================================================
    // NOTHING SURVIVED REVALIDATION
    // ========================================================

    if (pairRows.length === 0) {

      generatedResult = null;
      currentBatchId = null;

      alert(
        "These automatic matches are no longer available. Generate a new set."
      );

      renderResults();

      return;

    }


    // ========================================================
    // ONE BULK INSERT
    // ========================================================

    const {
      data: createdMatches,
      error: insertError
    } =
      await client
        .from("matches")
        .insert(
          pairRows
        )
        .select(`
          id,
          student_a_id,
          student_b_id,
          status
        `);


    if (insertError) {

      console.error(
        "Automatic draft insert failed:",
        insertError
      );


      if (
        insertError.code === "23505"
      ) {

        throw new Error(
          "One or more students already belong to a match. Please generate the matches again."
        );

      }


      throw insertError;

    }


    const createdCount =
      Array.isArray(createdMatches)
        ? createdMatches.length
        : pairRows.length;


    // ========================================================
    // CLEAR GENERATED RESULT
    // ========================================================

    generatedResult =
      null;


    currentBatchId =
      null;


    // ========================================================
    // SUCCESS
    // ========================================================

    const successMessage =
      skippedCount > 0
        ? `${createdCount} draft match${createdCount === 1 ? "" : "es"} created successfully. ${skippedCount} pair${skippedCount === 1 ? "" : "s"} were no longer available and were skipped.`
        : `${createdCount} automatic draft match${createdCount === 1 ? "" : "es"} created successfully.`;

    alert(
      successMessage
    );


    // ========================================================
    // ONE DIRECTOR ROOM REFRESH
    // ========================================================

    if (
      typeof window.refreshDirectorRoom ===
      "function"
    ) {

      await window.refreshDirectorRoom();

    }


    renderResults();


  } catch (error) {

    console.error(
      "Automatic draft creation error:",
      error
    );


    alert(
      error?.message ||
      "Unable to create automatic draft matches."
    );


  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        "CREATE DRAFT MATCHES";

    }

  }

}


// ============================================================
// INITIALIZE MATCHING MODE SWITCH
// ============================================================

export function initializeMatchingModeSwitch() {

  const manualPanel =
    document.querySelector(
      ".curate-grid"
    );


  if (!manualPanel) {

    console.warn(
      "Automatic Matching: .curate-grid not found."
    );

    return;

  }


  // ----------------------------------------------------------
  // PREVENT DUPLICATE SWITCH
  // ----------------------------------------------------------

  if (
    document.getElementById(
      "matching-mode-switch"
    )
  ) {

    return;

  }


  // ==========================================================
  // SWITCH CONTAINER
  // ==========================================================

  const switchContainer =
    document.createElement(
      "div"
    );


  switchContainer.id =
    "matching-mode-switch";


  switchContainer.className =
    "matching-mode-switch";


  switchContainer.innerHTML = `

    <div class="matching-mode-label">
      MATCHING MODE
    </div>

    <div class="matching-mode-buttons">

      <button
        type="button"
        class="matching-mode-btn active"
        id="manual-matching-btn"
      >
        MANUAL MATCHING
      </button>

      <button
        type="button"
        class="matching-mode-btn"
        id="automatic-matching-btn"
      >
        AUTOMATIC MATCHING
      </button>

    </div>

  `;


  // ==========================================================
  // AUTOMATIC PANEL
  // ==========================================================

  const automaticPanel =
    document.createElement(
      "div"
    );


  automaticPanel.id =
    "automatic-matching-root";


  automaticPanel.hidden =
    true;


  // ==========================================================
  // INSERT UI
  // ==========================================================

  manualPanel.parentNode.insertBefore(
    switchContainer,
    manualPanel
  );


  manualPanel.parentNode.insertBefore(
    automaticPanel,
    manualPanel
  );


  // ==========================================================
  // BUTTONS
  // ==========================================================

  const manualButton =
    document.getElementById(
      "manual-matching-btn"
    );


  const automaticButton =
    document.getElementById(
      "automatic-matching-btn"
    );


  if (
    !manualButton ||
    !automaticButton
  ) {

    console.warn(
      "Automatic Matching: mode buttons could not be initialized."
    );

    return;

  }


  // ==========================================================
  // SET MODE
  // ==========================================================

  function setMode(mode) {

    const manual =
      mode === "manual";


    manualButton.classList.toggle(
      "active",
      manual
    );


    automaticButton.classList.toggle(
      "active",
      !manual
    );


    manualPanel.hidden =
      !manual;


    automaticPanel.hidden =
      manual;


    if (!manual) {

      generatedResult =
        null;


      currentBatchId =
        null;


      renderInitialPanel();

    }

  }


  // ==========================================================
  // MANUAL
  // ==========================================================

  manualButton.onclick =
    () => {

      setMode(
        "manual"
      );

    };


  // ==========================================================
  // AUTOMATIC
  // ==========================================================

  automaticButton.onclick =
    () => {

      setMode(
        "automatic"
      );

    };


  // ==========================================================
  // DEFAULT
  // ==========================================================

  setMode(
    "manual"
  );

}


// ============================================================
// RESET
// ============================================================

export function resetAutomaticMatching() {

  generatedResult =
    null;


  currentBatchId =
    null;


  const automaticPanel =
    getRoot();


  if (
    automaticPanel &&
    !automaticPanel.hidden
  ) {

    renderInitialPanel();

  }

}