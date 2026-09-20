import { updateNavState } from "../ui/components.js";
import { initLookupForm } from "../auth/studentAuth.js";
import { downloadTicketPass } from "./studentMatch.js";

/**
 * Same Scene — Student Status
 *
 * Student access:
 *     SC-XXXX
 *
 * Student recovery:
 *     Instagram ID + Favourite Movie
 *
 * Students can only retrieve:
 * - their own registration
 * - their own published match
 */


/* =========================================================
   STATUS REFRESH / REALTIME STATE
   ========================================================= */

let studentStatusChannel = null;
let studentStatusRefreshTimer = null;
let studentStatusLoading = false;


/* =========================================================
   MAIN STATUS RENDERER
   ========================================================= */

export async function renderCandidateStatus() {

  const unmatchedEl =
    document.getElementById("status-unmatched");

  const matchedEl =
    document.getElementById("status-matched");

  const lookupEl =
    document.getElementById("status-lookup");


  /*
   * Default state.
   */

  if (unmatchedEl) {
    unmatchedEl.classList.add("hidden");
  }

  if (matchedEl) {
    matchedEl.classList.add("hidden");
  }

  if (lookupEl) {
    lookupEl.classList.remove("hidden");
  }


  /*
   * Supabase availability.
   */

  if (!window.supabaseClient) {

    console.error(
      "Supabase client is unavailable."
    );

    return;
  }


  /*
   * Get current student's access code.
   */

  const accessCode =
    sessionStorage.getItem(
      "sameSceneStudentAccessCode"
    );


  /*
   * No access code.
   */

  if (!accessCode) {

    stopStudentStatusMonitoring();

    initLookupForm(
      updateNavState,
      renderCandidateStatus
    );

    return;
  }


  try {

    /*
     * Retrieve ONLY this student.
     */

    const { data, error } =
      await window.supabaseClient.rpc(
        "get_student_by_access_code",
        {
          p_access_code: accessCode
        }
      );


    if (error) {

      console.error(
        "Failed to retrieve student:",
        error
      );

      stopStudentStatusMonitoring();

      sessionStorage.removeItem(
        "sameSceneStudentAccessCode"
      );

      initLookupForm(
        updateNavState,
        renderCandidateStatus
      );

      return;
    }


    /*
     * RETURNS TABLE gives an array.
     */

    const student =
      Array.isArray(data)
        ? data[0]
        : data;


    if (!student) {

      console.warn(
        "Student access code was not found."
      );

      stopStudentStatusMonitoring();

      sessionStorage.removeItem(
        "sameSceneStudentAccessCode"
      );

      initLookupForm(
        updateNavState,
        renderCandidateStatus
      );

      return;
    }


    /*
     * -------------------------------------------------------
     * WAITING
     * -------------------------------------------------------
     */

    if (student.status === "waiting") {

      renderWaitingStudent(
        student
      );

      startStudentStatusMonitoring(
        accessCode
      );

      return;
    }


    /*
     * -------------------------------------------------------
     * MATCHED
     * -------------------------------------------------------
     */

    if (student.status === "matched") {

      /*
       * Try to reveal the published match.
       */

      const revealed =
        await renderPublishedMatch(
          student
        );


      /*
       * If the match isn't available yet,
       * continue monitoring instead of stopping.
       */

      if (!revealed) {

        startStudentStatusMonitoring(
          accessCode
        );

      } else {

        stopStudentStatusMonitoring();

      }

      return;
    }


    /*
     * Unknown status.
     */

    console.warn(
      "Unknown student status:",
      student.status
    );

    renderWaitingStudent(
      student
    );

    startStudentStatusMonitoring(
      accessCode
    );


  } catch (error) {

    console.error(
      "Unexpected student status error:",
      error
    );

    initLookupForm(
      updateNavState,
      renderCandidateStatus
    );
  }
}


/* =========================================================
   WAITING STATE
   ========================================================= */

function renderWaitingStudent(student) {

  const unmatchedEl =
    document.getElementById(
      "status-unmatched"
    );

  const matchedEl =
    document.getElementById(
      "status-matched"
    );

  const lookupEl =
    document.getElementById(
      "status-lookup"
    );


  /*
   * Show waiting card.
   */

  if (matchedEl) {
    matchedEl.classList.add("hidden");
  }

  if (lookupEl) {
    lookupEl.classList.add("hidden");
  }

  if (unmatchedEl) {
    unmatchedEl.classList.remove("hidden");
  }


  /*
   * Student name.
   */

  setText(
    "um-cand-name",
    student.name
  );


  /*
   * Department.
   */

  setText(
    "um-cand-dept",
    student.department
  );


  /*
   * Dossier ID / Access Code.
   *
   * Do NOT expose the Supabase UUID.
   */

  setText(
    "um-cand-id",
    student.access_code
      ? `#${student.access_code}`
      : "—"
  );


  /*
   * Instagram.
   *
   * Remove all leading @ characters first
   * so the UI never shows @@username.
   */

  setText(
    "um-cand-handle",
    student.instagram_id
      ? `@${String(
          student.instagram_id
        ).replace(/^@+/, "")}`
      : "—"
  );


  /*
   * Movie preferences.
   */

  const parts = (student.favourite_movie || "").split(/ · |\/|,/);
  const thriller = student.thriller_preference || parts[0]?.trim() || "—";
  const romance = student.romance_preference || parts[1]?.trim() || "—";
  const emotional = student.emotional_preference || parts[2]?.trim() || "—";
  const action = student.action_preference || parts[3]?.trim() || "—";

  setText("um-cand-thriller", thriller);
  setText("um-cand-romance", romance);
  setText("um-cand-emotional", emotional);
  setText("um-cand-action", action);
  setText("um-cand-movie", student.favourite_movie || "—");


  /*
   * Old fields retained for UI compatibility.
   */

  setText(
    "um-cand-genre",
    "—"
  );

  setText(
    "um-cand-music",
    "—"
  );


  /*
   * Match intent.
   */

  setText(
    "um-cand-intent",
    formatIntent(
      student.match_intent
    )
  );


  /*
   * Registration date.
   */

  setText(
    "um-cand-date",
    formatDate(
      student.created_at
    )
  );


  /*
   * Access-code warning.
   */

  addAccessCodeWarning();


  /*
   * Logout.
   */

  const logoutBtn =
    document.getElementById(
      "status-unmatched-logout-btn"
    );


  if (logoutBtn) {

    logoutBtn.onclick = () => {

      stopStudentStatusMonitoring();

      sessionStorage.removeItem(
        "sameSceneStudentAccessCode"
      );

      updateNavState();

      renderCandidateStatus();

    };

  }
}


/* =========================================================
   ACCESS CODE WARNING
   ========================================================= */

function addAccessCodeWarning() {

  const unmatchedEl =
    document.getElementById(
      "status-unmatched"
    );

  if (!unmatchedEl) {
    return;
  }


  /*
   * Prevent duplicate warning.
   */

  if (
    unmatchedEl.querySelector(
      ".access-code-warning"
    )
  ) {
    return;
  }


  /*
   * Current access code.
   */

  const accessCode =
    sessionStorage.getItem(
      "sameSceneStudentAccessCode"
    ) || "—";


  /*
   * Create warning.
   */

  const warning =
    document.createElement("div");

  warning.className =
    "access-code-warning";


  warning.innerHTML = `
    <div class="access-code-warning-icon">
      ⚠
    </div>

    <div class="access-code-warning-content">

      <div class="access-code-warning-title">
        KEEP YOUR ACCESS CODE SAFE
      </div>

      <div class="access-code-warning-id-label">
        YOUR DOSSIER ID
      </div>

      <div class="access-code-warning-id">
        ${escapeHtml(accessCode)}
      </div>

      <div class="access-code-warning-text">
        This code is your personal key to check
        your registration status and reveal your match.
        Save it somewhere safe and do not lose it.
      </div>

      <div class="access-code-warning-recovery">
        Forgot your code?
        You can recover it using your
        <strong>Instagram ID + Movie Preferences.</strong>
      </div>

    </div>
  `;


  /*
   * Place warning immediately before
   * the logout button.
   */

  const logoutBtn =
    document.getElementById(
      "status-unmatched-logout-btn"
    );


  if (
    logoutBtn &&
    logoutBtn.parentElement
  ) {

    logoutBtn.parentElement.insertBefore(
      warning,
      logoutBtn
    );

    return;
  }


  /*
   * Fallback.
   */

  unmatchedEl.appendChild(
    warning
  );
}


/* =========================================================
   PUBLISHED MATCH
   ========================================================= */

async function renderPublishedMatch(student) {

  const unmatchedEl =
    document.getElementById(
      "status-unmatched"
    );

  const matchedEl =
    document.getElementById(
      "status-matched"
    );

  const lookupEl =
    document.getElementById(
      "status-lookup"
    );


  /*
   * Don't hide waiting card permanently until
   * we confirm the match actually exists.
   */

  if (lookupEl) {
    lookupEl.classList.add("hidden");
  }


  try {

    const { data, error } =
      await window.supabaseClient.rpc(
        "get_student_match_by_access_code",
        {
          p_access_code:
            sessionStorage.getItem(
              "sameSceneStudentAccessCode"
            )
        }
      );


    if (error) {

      console.error(
        "Failed to retrieve published match:",
        error
      );

      return false;
    }


    /*
     * RETURNS TABLE → array.
     */

    const match =
      Array.isArray(data)
        ? data[0]
        : data;


    /*
     * Match has not been published yet.
     *
     * Keep waiting screen visible.
     */

    if (!match) {

      if (matchedEl) {
        matchedEl.classList.add("hidden");
      }

      if (unmatchedEl) {
        unmatchedEl.classList.remove("hidden");
      }

      renderWaitingStudent(
        student
      );

      return false;
    }


    /*
     * Match exists.
     */

    if (unmatchedEl) {
      unmatchedEl.classList.add("hidden");
    }

    if (matchedEl) {
      matchedEl.classList.remove("hidden");
    }


    /*
     * Partner information.
     */

    const partner = {

      id:
        match.matched_student_id,

      name:
        match.matched_name,

      department:
        match.matched_department,

      semester:
        match.matched_semester,

      instagram_id:
        match.matched_instagram_id,

      favourite_movie:
        match.matched_favourite_movie,

      gender:
        match.matched_gender,

      match_intent:
        match.matched_match_intent

    };


    /* =====================================================
       CURRENT STUDENT (CARD A)
       ===================================================== */
    setText("m-name-a", student.name);
    setText("m-dept-a", `${student.semester || 'S7'} • ${student.department || ''}`);
    setText("m-insta-a", student.instagram_id ? `@${String(student.instagram_id).replace(/^@+/, "")}` : "—");

    const vibesBoxA = document.getElementById("m-vibes-a");
    if (vibesBoxA) {
      const partsA = (student.favourite_movie || "").split(/ · |\/|,/).map(s => s.trim()).filter(Boolean);
      const moviesA = [
        student.thriller_preference,
        student.romance_preference,
        student.emotional_preference,
        student.action_preference
      ].filter(Boolean);

      const finalMoviesA = moviesA.length ? moviesA : partsA;
      if (finalMoviesA.length) {
        vibesBoxA.innerHTML = finalMoviesA.map(m => `<span class="vibe-pill">${escapeHtml(m)}</span>`).join("");
      } else {
        vibesBoxA.innerHTML = `<span class="vibe-pill">${escapeHtml(student.favourite_movie || "Película Selection")}</span>`;
      }
    }


    /* =====================================================
       MATCHED STUDENT (CARD B)
       ===================================================== */
    setText("m-name-b", partner.name);
    setText("m-dept-b", `${partner.semester || 'S5'} • ${partner.department || ''}`);
    setText("m-insta-b", partner.instagram_id ? `@${String(partner.instagram_id).replace(/^@+/, "")}` : "—");

    const vibesBoxB = document.getElementById("m-vibes-b");
    if (vibesBoxB) {
      const partsB = (partner.favourite_movie || "").split(/ · |\/|,/).map(s => s.trim()).filter(Boolean);
      const moviesB = [
        partner.thriller_preference,
        partner.romance_preference,
        partner.emotional_preference,
        partner.action_preference
      ].filter(Boolean);

      const finalMoviesB = moviesB.length ? moviesB : partsB;
      if (finalMoviesB.length) {
        vibesBoxB.innerHTML = finalMoviesB.map(m => `<span class="vibe-pill">${escapeHtml(m)}</span>`).join("");
      } else {
        vibesBoxB.innerHTML = `<span class="vibe-pill">${escapeHtml(partner.favourite_movie || "Película Selection")}</span>`;
      }
    }
    /* =====================================================
       SCROLL TO MATCH PROFILE BUTTON
       ===================================================== */

    const btnScrollToProfile =
      document.getElementById(
        "btnScrollToMatchProfile"
      );

    if (btnScrollToProfile) {
      btnScrollToProfile.onclick = (e) => {
        e.preventDefault();
        const section = document.getElementById("m-profile-section");
        if (section) {
          const navHeight = document.querySelector(".editorial-nav")?.offsetHeight || 75;
          const elementPosition = section.getBoundingClientRect().top + window.pageYOffset;
          const offsetPosition = elementPosition - navHeight;
          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
          });
        }
      };
    }


    /* =====================================================
       GALA CONFIRMATION
       ===================================================== */

    const btnConfirmGala =
      document.getElementById(
        "btnConfirmGala"
      );


    if (btnConfirmGala) {

      btnConfirmGala.onclick =
        (e) => {

          e.preventDefault();

          btnConfirmGala.textContent =
            "✓ Gala Attendance Confirmed";

          btnConfirmGala.style.background =
            "#2F6B3F";

          btnConfirmGala.style.color =
            "#FFFFFF";

        };
    }

    /* =====================================================
       DOWNLOAD TICKET PASS
       ===================================================== */
    const btnDownloadTicket = document.getElementById("btnDownloadTicket");
    if (btnDownloadTicket) {
      btnDownloadTicket.onclick = (e) => {
        e.preventDefault();
        downloadTicketPass(student, partner, match);
      };
    }


    /* =====================================================
       LOGOUT
       ===================================================== */

    const logoutBtn =
      document.getElementById(
        "status-matched-logout-btn"
      );


    if (logoutBtn) {

      logoutBtn.onclick = () => {

        stopStudentStatusMonitoring();

        sessionStorage.removeItem(
          "sameSceneStudentAccessCode"
        );

        updateNavState();

        renderCandidateStatus();

      };

    }


    return true;


  } catch (error) {

    console.error(
      "Unexpected match rendering error:",
      error
    );

    return false;
  }
}


/* =========================================================
   START STUDENT STATUS MONITORING
   ========================================================= */

function startStudentStatusMonitoring(
  accessCode
) {

  stopStudentStatusMonitoring();


  if (!accessCode) {
    return;
  }


  /*
   * -------------------------------------------------------
   * Supabase Realtime
   * -------------------------------------------------------
   */

  if (window.supabaseClient) {

    studentStatusChannel =
      window.supabaseClient
        .channel(
          `same-scene-status-${accessCode}`
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "students"
          },
          async () => {

            console.log(
              "Same Scene: Student record changed."
            );

            await refreshStudentStatus();

          }
        )
        .subscribe(
          (status) => {

            console.log(
              "Same Scene status realtime:",
              status
            );

          }
        );

  }


  /*
   * -------------------------------------------------------
   * Backup polling
   *
   * Check every 5 seconds.
   * -------------------------------------------------------
   */

  studentStatusRefreshTimer =
    setInterval(
      async () => {

        await refreshStudentStatus();

      },
      5000
    );
}


/* =========================================================
   STOP STUDENT STATUS MONITORING
   ========================================================= */

function stopStudentStatusMonitoring() {

  if (studentStatusRefreshTimer) {

    clearInterval(
      studentStatusRefreshTimer
    );

    studentStatusRefreshTimer = null;

  }


  if (
    studentStatusChannel &&
    window.supabaseClient
  ) {

    window.supabaseClient
      .removeChannel(
        studentStatusChannel
      );

    studentStatusChannel = null;

  }

}


/* =========================================================
   REFRESH CURRENT STUDENT STATUS
   ========================================================= */

async function refreshStudentStatus() {

  /*
   * Prevent simultaneous requests.
   */

  if (studentStatusLoading) {
    return;
  }


  const accessCode =
    sessionStorage.getItem(
      "sameSceneStudentAccessCode"
    );


  if (!accessCode) {

    stopStudentStatusMonitoring();

    return;
  }


  if (!window.supabaseClient) {
    return;
  }


  studentStatusLoading = true;


  try {

    const { data, error } =
      await window.supabaseClient.rpc(
        "get_student_by_access_code",
        {
          p_access_code:
            accessCode
        }
      );


    if (error) {

      console.error(
        "Background status refresh failed:",
        error
      );

      return;
    }


    /*
     * RETURNS TABLE → array.
     */

    const student =
      Array.isArray(data)
        ? data[0]
        : data;


    if (!student) {
      return;
    }


    /*
     * Still waiting.
     */

    if (
      student.status ===
      "waiting"
    ) {

      renderWaitingStudent(
        student
      );

      return;
    }


    /*
     * Matched.
     */

    if (
      student.status ===
      "matched"
    ) {

      console.log(
        "Same Scene: Match published. Attempting reveal..."
      );


      const revealed =
        await renderPublishedMatch(
          student
        );


      /*
       * Only stop monitoring after the actual
       * published match has been retrieved.
       */

      if (revealed) {

        stopStudentStatusMonitoring();

      } else {

        /*
         * Match may have been published moments
         * before the RPC becomes visible.
         *
         * Continue checking.
         */

        console.log(
          "Same Scene: Student is matched, but published match is not available yet."
        );

      }

    }

  } catch (error) {

    console.error(
      "Background status refresh error:",
      error
    );

  } finally {

    studentStatusLoading = false;

  }
}


/* =========================================================
   SAFE DOM TEXT
   ========================================================= */

function setText(
  id,
  value
) {

  const el =
    document.getElementById(id);

  if (!el) {
    return;
  }


  el.textContent =
    value === null ||
    value === undefined ||
    value === ""
      ? "—"
      : String(value);
}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(value) {

  return String(value || "")
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* =========================================================
   FORMAT INTENT
   ========================================================= */

function formatIntent(
  intent
) {

  if (!intent) {
    return "—";
  }


  return String(intent)
    .replace(
      /[-_]/g,
      " "
    )
    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase()
    );
}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDate(
  dateValue
) {

  if (!dateValue) {
    return "—";
  }


  const date =
    new Date(dateValue);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "—";
  }


  return date.toLocaleDateString();
}