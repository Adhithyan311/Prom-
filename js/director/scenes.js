// ============================================================
// PELÍCULA · PROM NIGHT
// DIRECTOR SCENES
// ============================================================
//
// Match lifecycle:
//
//     draft
//       ↓
// Director reviews
//       ↓
//   published
//       ↓
// Students can see their match
//
// Rules:
// - Only Director can publish.
// - Only draft matches can be published.
// - Both students must still be waiting.
// - Publishing changes both students to "matched".
// - Published matches cannot be removed/rematched.
//
// PERFORMANCE:
// - One matches query + one student query on initial render.
// - Event delegation instead of one listener per button.
// - No full Director Room refresh after every action.
// - Realtime in directorRoom.js handles student/match state.
// - No repeated listener creation.
// - No unnecessary DOM work.
// ============================================================

import {
  isDirectorAuthenticated
} from "../auth/directorAuth.js";


/* ============================================================
   STATE
============================================================ */

let matchesRenderInProgress = false;
let pendingMatchesRender = false;

let matchRenderTimer = null;

let matchesCache = [];
let matchStudentsCache = new Map();

let matchesListenersInitialized = false;


/* ============================================================
   SUPABASE
============================================================ */

function getSupabaseClient() {

  return typeof window !== "undefined"
    ? window.supabaseClient || null
    : null;

}


/* ============================================================
   SAFE HTML
============================================================ */

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* ============================================================
   CLEAN INSTAGRAM
============================================================ */

function cleanInstagram(value) {

  return String(value || "")
    .trim()
    .replace(/^@/, "");

}


/* ============================================================
   FORMAT DATE
============================================================ */

function formatDate(value) {

  if (!value) {
    return "—";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "—";

  }


  return date.toLocaleDateString();

}


/* ============================================================
   TEMPORARY MESSAGE
============================================================ */

function showSceneMessage(message) {

  const msgEl =
    document.getElementById(
      "match-msg"
    );


  if (!msgEl) {
    return;
  }


  msgEl.style.display =
    "block";


  msgEl.textContent =
    message;


  clearTimeout(
    window.sameSceneSceneMessageTimer
  );


  window.sameSceneSceneMessageTimer =
    setTimeout(
      () => {

        msgEl.style.display =
          "none";

      },
      4000
    );

}


/* ============================================================
   GET MATCH CONTAINER
============================================================ */

function getMatchesContainer() {

  return document.getElementById(
    "dir-matches-container"
  );

}


/* ============================================================
   INITIALISE EVENT DELEGATION
============================================================ */

/*
 * OLD:
 *
 * Every render:
 *
 * querySelectorAll(...)
 *      ↓
 * addEventListener(...)
 *      ↓
 * repeat
 *
 *
 * NEW:
 *
 * One listener on the container.
 *
 * It handles:
 * - Publish Match
 * - Remove Draft
 *
 * This listener survives innerHTML replacements.
 */

function initializeMatchesEventDelegation() {

  if (matchesListenersInitialized) {
    return;
  }


  const container =
    getMatchesContainer();


  if (!container) {
    return;
  }


  matchesListenersInitialized =
    true;


  container.addEventListener(
    "click",
    event => {

      const publishButton =
        event.target.closest(
          "[data-publish-match]"
        );


      if (publishButton) {

        event.preventDefault();


        const matchId =
          publishButton.dataset.publishMatch;


        if (matchId) {

          publishMatch(
            matchId
          );

        }


        return;

      }


      const removeButton =
        event.target.closest(
          "[data-remove-draft]"
        );


      if (removeButton) {

        event.preventDefault();


        const matchId =
          removeButton.dataset.removeDraft;


        if (matchId) {

          confirmUnmatch(
            matchId
          );

        }

      }

    }
  );

}


/* ============================================================
   RENDER ALL DIRECTOR MATCHES
============================================================ */

export async function renderMatchesList() {

  const container =
    getMatchesContainer();


  if (!container) {
    return;
  }


  /*
   * Prevent duplicate simultaneous renders.
   */
  if (matchesRenderInProgress) {

    pendingMatchesRender =
      true;

    return;

  }


  matchesRenderInProgress =
    true;


  initializeMatchesEventDelegation();


  /*
   * AUTHENTICATION
   */
  if (!isDirectorAuthenticated()) {

    matchesRenderInProgress =
      false;


    location.replace(
      "#/director-login"
    );

    return;

  }


  const client =
    getSupabaseClient();


  if (!client) {

    matchesRenderInProgress =
      false;


    container.innerHTML = `
      <div style="
        text-align:center;
        padding:32px;
        color:var(--muted);
        font-style:italic;
      ">
        Match service unavailable.
      </div>
    `;

    return;

  }


  try {

    /*
     * Loading text is only shown when there is no
     * existing rendered match list.
     *
     * This prevents flickering during refreshes.
     */
    if (!matchesCache.length) {

      container.innerHTML = `
        <div style="
          text-align:center;
          padding:32px;
          color:var(--muted);
          font-style:italic;
        ">
          Loading scenes...
        </div>
      `;

    }


    /* ========================================================
       FETCH MATCHES
    ======================================================== */

    const {
      data: matches,
      error: matchError
    } =
      await client
        .from("matches")
        .select(`
          id,
          student_a_id,
          student_b_id,
          status,
          created_at,
          published_at
        `)
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (matchError) {

      console.error(
        "Failed to load matches:",
        matchError
      );


      container.innerHTML = `
        <div style="
          text-align:center;
          padding:32px;
          color:var(--muted);
          font-style:italic;
        ">
          Unable to load scenes.
        </div>
      `;


      matchesRenderInProgress =
        false;


      return;

    }


    matchesCache =
      Array.isArray(matches)
        ? matches
        : [];


    /* ========================================================
       EMPTY
    ======================================================== */

    if (!matchesCache.length) {

      matchStudentsCache =
        new Map();


      container.innerHTML = `
        <div style="
          text-align:center;
          padding:32px;
          color:var(--muted);
          font-style:italic;
        ">
          No curated matches created yet.
          Select students in Matchmaking Studio
          to prepare a scene.
        </div>
      `;


      matchesRenderInProgress =
        false;


      return;

    }


    /* ========================================================
       COLLECT STUDENT IDS
    ======================================================== */

    const studentIds = [
      ...new Set(
        matchesCache.flatMap(
          match => [
            match.student_a_id,
            match.student_b_id
          ]
        )
      )
    ];


    /* ========================================================
       FETCH STUDENTS IN CHUNKS (PREVENT URI TOO LONG ERROR)
    ======================================================== */

    const chunkSize = 50;
    const studentChunks = [];
    for (let i = 0; i < studentIds.length; i += chunkSize) {
      studentChunks.push(studentIds.slice(i, i + chunkSize));
    }

    let students = [];
    let studentError = null;

    try {
      const studentResults = await Promise.all(
        studentChunks.map(chunk =>
          client
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
              status
            `)
            .in("id", chunk)
        )
      );

      for (const res of studentResults) {
        if (res.error) {
          studentError = res.error;
          break;
        }
        if (res.data) {
          students.push(...res.data);
        }
      }
    } catch (err) {
      studentError = err;
    }


    if (studentError) {

      console.error(
        "Failed to load matched students:",
        studentError
      );


      container.innerHTML = `
        <div style="
          text-align:center;
          padding:32px;
          color:var(--muted);
          font-style:italic;
        ">
          Unable to load scene participants.
        </div>
      `;


      matchesRenderInProgress =
        false;


      return;

    }


    /* ========================================================
       FAST STUDENT LOOKUP
    ======================================================== */

    matchStudentsCache =
      new Map(
        (students || []).map(
          student => [
            student.id,
            student
          ]
        )
      );


    /* ========================================================
       BUILD HTML
    ======================================================== */

    const htmlParts = [];


    for (
      const match
      of matchesCache
    ) {

      const studentA =
        matchStudentsCache.get(
          match.student_a_id
        );


      const studentB =
        matchStudentsCache.get(
          match.student_b_id
        );


      /*
       * Ignore broken match records.
       */
      if (
        !studentA ||
        !studentB
      ) {

        continue;

      }


      const isPublished =
        match.status ===
        "published";


      const statusLabel =
        isPublished
          ? "PUBLISHED"
          : "DRAFT";


      const statusClass =
        isPublished
          ? "published"
          : "draft";


      const createdDate =
        formatDate(
          match.created_at
        );


      const publishedDate =
        match.published_at
          ? formatDate(
              match.published_at
            )
          : null;


      htmlParts.push(`

        <div
          class="match-card"
          data-match-card="${escapeHtml(match.id)}"
        >

          <div class="pair">

            <!-- STUDENT A -->

            <div class="cand">

              <h4>
                ${escapeHtml(
                  studentA.name
                )}
              </h4>

              <p>
                ${escapeHtml(
                  studentA.department
                )}
                ·
                @${escapeHtml(
                  cleanInstagram(
                    studentA.instagram_id
                  )
                )}
              </p>

            </div>


            <!-- VERSUS -->

            <div class="versus">
              ⟷
            </div>


            <!-- STUDENT B -->

            <div class="cand">

              <h4>
                ${escapeHtml(
                  studentB.name
                )}
              </h4>

              <p>
                ${escapeHtml(
                  studentB.department
                )}
                ·
                @${escapeHtml(
                  cleanInstagram(
                    studentB.instagram_id
                  )
                )}
              </p>

            </div>

          </div>


          <!-- META -->

          <div>

            <div style="
              font-size:10px;
              color:var(--muted);
              margin-bottom:4px;
              text-align:right;
            ">
              Scene:
              #${escapeHtml(match.id)}
            </div>


            <div style="
              font-size:10px;
              color:var(--muted);
              margin-bottom:4px;
              text-align:right;
            ">
              Created:
              ${escapeHtml(createdDate)}
            </div>


            <div style="
              font-size:10px;
              margin-bottom:8px;
              text-align:right;
            ">

              <span
                class="scene-status ${statusClass}"
              >
                ${statusLabel}
              </span>

            </div>


            ${
              !isPublished

                ? `

                  <button
                    class="btn btn-outline btn-sm"
                    data-publish-match="${escapeHtml(match.id)}"
                  >
                    Publish Match
                  </button>


                  <button
                    class="btn btn-outline btn-sm"
                    style="
                      border-color:#9c3b3b;
                      color:#e88a8a;
                      margin-left:6px;
                    "
                    data-remove-draft="${escapeHtml(match.id)}"
                  >
                    Remove Draft
                  </button>

                `

                : `

                  <div style="
                    font-size:10px;
                    color:var(--muted);
                    text-align:right;
                  ">
                    Published
                    ${
                      publishedDate
                        ? `· ${escapeHtml(publishedDate)}`
                        : ""
                    }
                  </div>

                `
            }

          </div>

        </div>

      `);

    }


    /* ========================================================
       NO VALID MATCHES
    ======================================================== */

    if (!htmlParts.length) {

      container.innerHTML = `
        <div style="
          text-align:center;
          padding:32px;
          color:var(--muted);
          font-style:italic;
        ">
          No valid scenes found.
        </div>
      `;


      matchesRenderInProgress =
        false;


      return;

    }


    /*
     * One DOM write.
     */
    container.innerHTML =
      htmlParts.join("");


  } catch (error) {

    console.error(
      "Unexpected Scenes error:",
      error
    );


    container.innerHTML = `
      <div style="
        text-align:center;
        padding:32px;
        color:var(--muted);
        font-style:italic;
      ">
        Something went wrong while loading scenes.
      </div>
    `;

  } finally {

    matchesRenderInProgress =
      false;


    /*
     * If another refresh arrived while this render
     * was running, perform only one additional render.
     */
    if (pendingMatchesRender) {

      pendingMatchesRender =
        false;


      queueMicrotask(
        () => {
          renderMatchesList();
        }
      );

    }

  }

}


/* ============================================================
   LIGHTWEIGHT MATCH LIST REFRESH
============================================================ */

export function scheduleMatchesRefresh() {

  clearTimeout(
    matchRenderTimer
  );


  matchRenderTimer =
    setTimeout(
      () => {

        renderMatchesList();

      },
      80
    );

}


/* ============================================================
   PUBLISH MATCH
============================================================ */

export async function publishMatch(
  matchId
) {

  /* ----------------------------------------------------------
     AUTH
  ---------------------------------------------------------- */

  if (!isDirectorAuthenticated()) {

    location.replace(
      "#/director-login"
    );

    return;

  }


  /* ----------------------------------------------------------
     CLIENT
  ---------------------------------------------------------- */

  const client =
    getSupabaseClient();


  if (!client) {

    showSceneMessage(
      "Match service is unavailable."
    );

    return;

  }


  /* ----------------------------------------------------------
     VALIDATE ID
  ---------------------------------------------------------- */

  if (!matchId) {

    showSceneMessage(
      "Invalid match selected."
    );

    return;

  }


  /* ----------------------------------------------------------
     CONFIRM
  ---------------------------------------------------------- */

  const confirmed =
    confirm(
      "Publish this match? Both students will be able to see their match after publication."
    );


  if (!confirmed) {
    return;
  }


  /* ----------------------------------------------------------
     FIND BUTTON
  ---------------------------------------------------------- */

  const button =
    document.querySelector(
      `[data-publish-match="${CSS.escape(matchId)}"]`
    );


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "PUBLISHING...";

  }


  try {

    /* ========================================================
       STEP 1
       GET LATEST MATCH
    ======================================================== */

    const {
      data: match,
      error: matchError
    } =
      await client
        .from("matches")
        .select(`
          id,
          student_a_id,
          student_b_id,
          status
        `)
        .eq(
          "id",
          matchId
        )
        .maybeSingle();


    if (matchError) {
      throw matchError;
    }


    if (!match) {

      showSceneMessage(
        "This scene no longer exists."
      );

      return;

    }


    /* --------------------------------------------------------
       MUST BE DRAFT
    -------------------------------------------------------- */

    if (
      match.status !==
      "draft"
    ) {

      showSceneMessage(
        "This scene has already been published."
      );

      return;

    }


    /* ========================================================
       STEP 2
       GET BOTH STUDENTS
    ======================================================== */

    const {
      data: students,
      error: studentError
    } =
      await client
        .from("students")
        .select(`
          id,
          name,
          gender,
          status
        `)
        .in(
          "id",
          [
            match.student_a_id,
            match.student_b_id
          ]
        );


    if (studentError) {
      throw studentError;
    }


    const studentMap =
      new Map(
        (students || []).map(
          student => [
            student.id,
            student
          ]
        )
      );


    const studentA =
      studentMap.get(
        match.student_a_id
      );


    const studentB =
      studentMap.get(
        match.student_b_id
      );


    if (
      !studentA ||
      !studentB
    ) {

      showSceneMessage(
        "One of the students could not be found."
      );

      return;

    }


    /* ========================================================
       STEP 3
       FINAL STATUS CHECK
    ======================================================== */

    const studentAWaiting =
      String(
        studentA.status || ""
      )
        .trim()
        .toLowerCase() ===
      "waiting";


    const studentBWaiting =
      String(
        studentB.status || ""
      )
        .trim()
        .toLowerCase() ===
      "waiting";


    if (
      !studentAWaiting ||
      !studentBWaiting
    ) {

      showSceneMessage(
        "One or both students are no longer available for matching."
      );

      return;

    }


    /* ========================================================
       STEP 4
       FINAL GENDER CHECK
    ======================================================== */

    const genderA =
      String(
        studentA.gender || ""
      )
        .trim()
        .toLowerCase();


    const genderB =
      String(
        studentB.gender || ""
      )
        .trim()
        .toLowerCase();


    const validGenderPair =
      (
        genderA === "male" &&
        genderB === "female"
      ) ||
      (
        genderA === "female" &&
        genderB === "male"
      );


    if (!validGenderPair) {

      showSceneMessage(
        "Only Male ↔ Female matches can be published."
      );

      return;

    }


    /* ========================================================
       STEP 5
       UPDATE BOTH STUDENTS
    ======================================================== */

    const {
      data: updatedStudents,
      error: studentsUpdateError
    } =
      await client
        .from("students")
        .update({
          status: "matched",
          updated_at:
            new Date().toISOString()
        })
        .in(
          "id",
          [
            match.student_a_id,
            match.student_b_id
          ]
        )
        .eq(
          "status",
          "waiting"
        )
        .select(`
          id,
          status
        `);


    if (studentsUpdateError) {
      throw studentsUpdateError;
    }


    /* ========================================================
       VERIFY BOTH WERE UPDATED
    ======================================================== */

    if (
      !updatedStudents ||
      updatedStudents.length !== 2
    ) {

      /*
       * Best-effort rollback.
       */
      await client
        .from("students")
        .update({
          status: "waiting",
          updated_at:
            new Date().toISOString()
        })
        .in(
          "id",
          [
            match.student_a_id,
            match.student_b_id
          ]
        )
        .eq(
          "status",
          "matched"
        );


      showSceneMessage(
        "The students changed while publishing. Please try again."
      );

      return;

    }


    /* ========================================================
       STEP 6
       PUBLISH MATCH
    ======================================================== */

    const {
      data: publishedMatch,
      error: publishError
    } =
      await client
        .from("matches")
        .update({
          status: "published",
          published_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          match.id
        )
        .eq(
          "status",
          "draft"
        )
        .select(`
          id,
          status,
          published_at
        `)
        .maybeSingle();


    /* ========================================================
       PUBLISH FAILED
    ======================================================== */

    if (
      publishError ||
      !publishedMatch
    ) {

      console.error(
        "Publish match update failed:",
        publishError
      );


      /*
       * Best-effort student rollback.
       */
      await client
        .from("students")
        .update({
          status: "waiting",
          updated_at:
            new Date().toISOString()
        })
        .in(
          "id",
          [
            match.student_a_id,
            match.student_b_id
          ]
        )
        .eq(
          "status",
          "matched"
        );


      throw (
        publishError ||
        new Error(
          "The match could not be published."
        )
      );

    }


    /* ========================================================
       SUCCESS
    ======================================================== */

    showSceneMessage(
      `✓ Match published: ${studentA.name} ↔ ${studentB.name}`
    );


    /*
     * IMPORTANT PERFORMANCE CHANGE
     *
     * Do NOT call:
     *
     * window.refreshDirectorRoom()
     *
     * here.
     *
     * directorRoom.js is already subscribed to:
     * - students realtime
     * - matches realtime
     *
     * Therefore:
     *
     * students UPDATE
     *      ↓
     * Director local state updates
     *
     * matches UPDATE
     *      ↓
     * matchedStudentIds updates
     *
     * Candidate dropdown updates without
     * reloading the entire Director Room.
     */


    /*
     * Only refresh the Scenes list.
     */
    await renderMatchesList();


  } catch (error) {

    console.error(
      "Unexpected publish error:",
      error
    );


    showSceneMessage(
      error?.message ||
      "Unable to publish this match. Please try again."
    );


    /*
     * Refresh only Scenes.
     */
    await renderMatchesList();


  } finally {

    /*
     * The list may have been rerendered.
     */
    if (button) {

      button.disabled =
        false;

      button.textContent =
        "Publish Match";

    }

  }

}


/* ============================================================
   REMOVE DRAFT MATCH
============================================================ */

export async function handleUnmatch(
  matchId,
  renderDirectorLobbyFn
) {

  if (!isDirectorAuthenticated()) {

    location.replace(
      "#/director-login"
    );

    return;

  }


  const client =
    getSupabaseClient();


  if (!client) {

    showSceneMessage(
      "Match service is unavailable."
    );

    return;

  }


  if (!matchId) {

    showSceneMessage(
      "Invalid scene selected."
    );

    return;

  }


  try {

    /* ========================================================
       VERIFY MATCH
    ======================================================== */

    const {
      data: match,
      error
    } =
      await client
        .from("matches")
        .select(`
          id,
          student_a_id,
          student_b_id,
          status
        `)
        .eq(
          "id",
          matchId
        )
        .maybeSingle();


    if (error) {

      console.error(
        "Failed to verify draft:",
        error
      );


      showSceneMessage(
        "Unable to verify this scene."
      );

      return;

    }


    if (!match) {

      showSceneMessage(
        "Scene not found."
      );

      return;

    }


    /* ========================================================
       ONLY DRAFTS CAN BE REMOVED
    ======================================================== */

    if (
      match.status !==
      "draft"
    ) {

      showSceneMessage(
        "Published matches cannot be dissolved."
      );

      return;

    }


    /* ========================================================
       DELETE DRAFT
    ======================================================== */

    const {
      error: deleteError
    } =
      await client
        .from("matches")
        .delete()
        .eq(
          "id",
          matchId
        )
        .eq(
          "status",
          "draft"
        );


    if (deleteError) {

      console.error(
        "Failed to remove draft:",
        deleteError
      );


      showSceneMessage(
        "Unable to remove this draft."
      );

      return;

    }


    /* ========================================================
       SUCCESS
    ======================================================== */

    showSceneMessage(
      "Draft match removed."
    );


    /*
     * IMPORTANT:
     *
     * No renderDirectorLobby().
     * No window.refreshDirectorRoom().
     *
     * directorRoom.js listens for the DELETE event
     * on matches and immediately puts both students
     * back into the available candidate pool.
     */


    await renderMatchesList();


  } catch (error) {

    console.error(
      "Unexpected draft removal error:",
      error
    );


    showSceneMessage(
      "Something went wrong."
    );

  }

}


/* ============================================================
   CONFIRM REMOVE DRAFT
============================================================ */

export function confirmUnmatch(
  matchId,
  renderDirectorLobbyFn
) {

  const confirmed =
    confirm(
      "Remove this draft scene? Both students will remain available for another Director selection."
    );


  if (!confirmed) {
    return;
  }


  handleUnmatch(
    matchId,
    renderDirectorLobbyFn
  );

}


/* ============================================================
   GLOBAL COMPATIBILITY
============================================================ */

window.publishMatch =
  publishMatch;


window.confirmUnmatch =
  confirmUnmatch;