/**
 * Same Scene — Student Authentication
 *
 * Students do not have email/password accounts.
 *
 * Normal access:
 *     SC-XXXX
 *
 * Example:
 *     SC-S7C4
 *     SC-A82K
 *     SC-7P4M
 *
 * Forgotten access code recovery:
 *     Instagram ID + Favourite Movie
 *
 * Supabase RPC functions:
 *
 *     get_student_by_access_code()
 *     recover_student_access_code()
 */


/* =========================================================
   HELPERS
   ========================================================= */


/**
 * Normalize Instagram ID.
 *
 * Examples:
 *
 *     @Aavyaa    → aavyaa
 *     @@Aavyaa   → aavyaa
 *     Aavyaa     → aavyaa
 */
function normalizeInstagramId(value) {

  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();

}


/**
 * Normalize movie title.
 *
 * Case and surrounding spaces are ignored.
 */
function normalizeMovie(value) {

  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

}


/**
 * Normalize access code.
 *
 * Examples:
 *
 *     sc-s7c4   → SC-S7C4
 *     SC-S7C4   → SC-S7C4
 *     sc-a82k   → SC-A82K
 */
function normalizeAccessCode(value) {

  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

}


/**
 * Validate the current access-code format.
 *
 * Correct format:
 *
 *     SC-XXXX
 *
 * XXXX can contain:
 *     A-Z
 *     0-9
 *
 * Examples:
 *
 *     SC-S7C4
 *     SC-A82K
 *     SC-7P4M
 */
function isValidAccessCode(code) {

  return /^SC-[A-Z0-9]{4}$/.test(code);

}


/**
 * Show lookup error.
 */
function showLookupError(message) {

  const errEl =
    document.getElementById("lookupErr");

  if (!errEl) return;

  errEl.style.display = "block";
  errEl.textContent = message;

}


/**
 * Hide lookup error.
 */
function hideLookupError() {

  const errEl =
    document.getElementById("lookupErr");

  if (!errEl) return;

  errEl.style.display = "none";
  errEl.textContent = "";

}


/**
 * Show recovery error.
 */
function showRecoveryError(message) {

  const errorEl =
    document.getElementById("recoveryError");

  if (!errorEl) return;

  errorEl.style.display = "block";
  errorEl.textContent = message;

}


/* =========================================================
   MAIN LOOKUP FORM
   ========================================================= */


export function initLookupForm(
  updateNavStateFn,
  renderCandidateStatusFn
) {

  const form =
    document.getElementById("lookupForm");

  if (!form) return;


  /*
   * Make the status renderer globally available.
   *
   * This is used by the recovered-code
   * "CHECK MY STATUS →" button.
   */

  if (
    typeof renderCandidateStatusFn ===
    "function"
  ) {

    window.__sameSceneRenderStatus =
      renderCandidateStatusFn;

  }


  /*
   * Prevent duplicate initialization.
   */

  if (
    form.dataset.studentAuthInitialized ===
    "true"
  ) {

    return;

  }

  form.dataset.studentAuthInitialized =
    "true";


  /* =======================================================
     NORMAL ACCESS-CODE LOOKUP
     ======================================================= */


  form.onsubmit = async (e) => {

    e.preventDefault();


    const inputEl =
      document.getElementById("l-query");


    const query =
      inputEl
        ? normalizeAccessCode(
            inputEl.value
          )
        : "";


    hideLookupError();


    /* -------------------------------------------------------
       Empty input
       ------------------------------------------------------- */

    if (!query) {

      showLookupError(
        "Please enter your private access code."
      );

      return;

    }


    /* -------------------------------------------------------
       Validate access-code format
       ------------------------------------------------------- */

    if (!isValidAccessCode(query)) {

      showLookupError(
        "Please enter a valid access code in the format SC-S7C4."
      );

      return;

    }


    /* -------------------------------------------------------
       Supabase
       ------------------------------------------------------- */

    if (!window.supabaseClient) {

      console.error(
        "Supabase client is unavailable."
      );

      showLookupError(
        "Status service is unavailable. Please try again."
      );

      return;

    }


    /* -------------------------------------------------------
       Prevent duplicate submission
       ------------------------------------------------------- */

    const submitBtn =
      form.querySelector(
        'button[type="submit"], input[type="submit"]'
      );


    const originalText =
      submitBtn?.textContent;


    if (submitBtn) {

      submitBtn.disabled = true;

      submitBtn.textContent =
        "CHECKING...";

    }


    try {

      /* -----------------------------------------------------
         Ask Supabase for this student.
         ----------------------------------------------------- */

      const { data, error } =
        await window.supabaseClient.rpc(
          "get_student_by_access_code",
          {
            p_access_code: query
          }
        );


      /* -----------------------------------------------------
         Supabase error
         ----------------------------------------------------- */

      if (error) {

        console.error(
          "Student lookup failed:",
          error
        );

        showLookupError(
          "Unable to verify your access code. Please try again."
        );

        return;

      }


      /*
       * RETURNS TABLE returns an array.
       *
       * Therefore:
       *
       * data = [
       *   { ...student... }
       * ]
       *
       * We need the first record.
       */

      const student =
        Array.isArray(data)
          ? data[0]
          : data;


      /* -----------------------------------------------------
         Student not found
         ----------------------------------------------------- */

      if (!student) {

        showLookupError(
          "Invalid access code. Please check your code and try again."
        );

        return;

      }


      /* -----------------------------------------------------
         Save ONLY the access code.
         ----------------------------------------------------- */

      sessionStorage.setItem(
        "sameSceneStudentAccessCode",
        query
      );


      /* -----------------------------------------------------
         Update navigation.
         ----------------------------------------------------- */

      if (
        typeof updateNavStateFn ===
        "function"
      ) {

        updateNavStateFn();

      }


      /* -----------------------------------------------------
         Render student's status.
         ----------------------------------------------------- */

      if (
        typeof renderCandidateStatusFn ===
        "function"
      ) {

        await renderCandidateStatusFn();

      }

    }

    catch (error) {

      console.error(
        "Unexpected student lookup error:",
        error
      );

      showLookupError(
        "Something went wrong. Please try again."
      );

    }

    finally {

      if (submitBtn) {

        submitBtn.disabled = false;


        if (
          originalText !==
          undefined
        ) {

          submitBtn.textContent =
            originalText;

        }

      }

    }

  };


  /* =======================================================
     CREATE FORGOT-CODE BUTTON
     ======================================================= */

  createRecoveryButton(form);

}


/* =========================================================
   CREATE RECOVERY BUTTON
   ========================================================= */


function createRecoveryButton(form) {

  /*
   * Prevent duplicate button.
   */

  if (
    document.getElementById(
      "forgotAccessCodeBtn"
    )
  ) {

    return;

  }


  const recoveryButton =
    document.createElement("button");


  recoveryButton.type =
    "button";


  recoveryButton.id =
    "forgotAccessCodeBtn";


  recoveryButton.className =
    "forgot-access-code-btn";


  recoveryButton.textContent =
    "FORGOT YOUR ACCESS CODE?";


  recoveryButton.addEventListener(
    "click",
    () => {

      showRecoveryForm(form);

    }
  );


  /*
   * Put button below the main
   * status button.
   */

  const submitBtn =
    form.querySelector(
      'button[type="submit"], input[type="submit"]'
    );


  if (
    submitBtn &&
    submitBtn.parentElement
  ) {

    submitBtn.parentElement.appendChild(
      recoveryButton
    );

  }

  else {

    form.appendChild(
      recoveryButton
    );

  }

}


/* =========================================================
   SHOW RECOVERY FORM
   ========================================================= */


function showRecoveryForm(form) {

  /*
   * Hide normal lookup elements.
   */

  const inputEl =
    document.getElementById("l-query");


  const submitBtn =
    form.querySelector(
      'button[type="submit"], input[type="submit"]'
    );


  const forgotBtn =
    document.getElementById(
      "forgotAccessCodeBtn"
    );


  if (inputEl) {

    inputEl
      .closest(".form-field")
      ?.classList.add("hidden");

  }


  if (submitBtn) {

    submitBtn.classList.add(
      "hidden"
    );

  }


  if (forgotBtn) {

    forgotBtn.classList.add(
      "hidden"
    );

  }


  hideLookupError();


  /*
   * Prevent duplicate recovery form.
   */

  let recovery =
    document.getElementById(
      "accessCodeRecovery"
    );


  if (!recovery) {

    recovery =
      document.createElement("div");


    recovery.id =
      "accessCodeRecovery";


    recovery.className =
      "access-code-recovery";


    recovery.innerHTML = `

      <div class="recovery-header">

        <h3>
          Recover Your Access Code
        </h3>

        <p>
          Enter the details you used during registration.
        </p>

      </div>


      <div class="recovery-field">

        <label for="recovery-instagram">
          INSTAGRAM ID
        </label>

        <input
          type="text"
          id="recovery-instagram"
          placeholder="@yourusername"
          autocomplete="off"
        >

      </div>


      <div class="recovery-field" style="margin-top:12px;">

        <label for="recovery-thriller">
          THRILLER PREFERENCE
        </label>

        <select
          id="recovery-thriller"
          style="width:100%;padding:12px;border-radius:6px;border:1px solid #d9c9a8;background:var(--paper-light);color:var(--ink);margin-top:4px;font-family:var(--sans);font-size:13px;"
        >
          <option value="">Select Thriller Movie</option>
          <option value="Anjaam Pathiraa">Anjaam Pathiraa</option>
          <option value="Memories">Memories</option>
        </select>

      </div>


      <div class="recovery-field" style="margin-top:12px;">

        <label for="recovery-romance">
          ROMANTIC PREFERENCE
        </label>

        <select
          id="recovery-romance"
          style="width:100%;padding:12px;border-radius:6px;border:1px solid #d9c9a8;background:var(--paper-light);color:var(--ink);margin-top:4px;font-family:var(--sans);font-size:13px;"
        >
          <option value="">Select Romantic Movie</option>
          <option value="Thattathin Marayathu">Thattathin Marayathu</option>
          <option value="Ohm Shanthi Oshaana">Ohm Shanthi Oshaana</option>
        </select>

      </div>


      <div class="recovery-field" style="margin-top:12px;">

        <label for="recovery-emotional">
          EMOTIONAL PREFERENCE
        </label>

        <select
          id="recovery-emotional"
          style="width:100%;padding:12px;border-radius:6px;border:1px solid #d9c9a8;background:var(--paper-light);color:var(--ink);margin-top:4px;font-family:var(--sans);font-size:13px;"
        >
          <option value="">Select Emotional Movie</option>
          <option value="Akashadoothu">Akashadoothu</option>
          <option value="Thanmathra">Thanmathra</option>
        </select>

      </div>


      <div class="recovery-field" style="margin-top:12px;">

        <label for="recovery-action">
          ACTION PREFERENCE
        </label>

        <select
          id="recovery-action"
          style="width:100%;padding:12px;border-radius:6px;border:1px solid #d9c9a8;background:var(--paper-light);color:var(--ink);margin-top:4px;font-family:var(--sans);font-size:13px;"
        >
          <option value="">Select Action Movie</option>
          <option value="Dhruvam">Dhruvam</option>
          <option value="Narasimham">Narasimham</option>
        </select>

      </div>


      <div
        id="recoveryError"
        class="recovery-error"
        style="display:none;"
      ></div>


      <button
        type="button"
        id="recoverAccessCodeBtn"
        class="recover-access-code-btn"
      >
        RECOVER MY ACCESS CODE →
      </button>


      <button
        type="button"
        id="backToAccessCodeBtn"
        class="back-access-code-btn"
      >
        ← BACK TO STATUS CHECK
      </button>


      <div
        id="recoveryResult"
        class="recovery-result"
        style="display:none;"
      ></div>

    `;


    /*
     * Add recovery form inside
     * the existing lookup form.
     */

    form.appendChild(
      recovery
    );


    /* -----------------------------------------------------
       Recovery button
       ----------------------------------------------------- */

    const recoverBtn =
      document.getElementById(
        "recoverAccessCodeBtn"
      );


    if (recoverBtn) {

      recoverBtn.onclick =
        () => {

          recoverStudentAccessCode();

        };

    }


    /* -----------------------------------------------------
       Back button
       ----------------------------------------------------- */

    const backBtn =
      document.getElementById(
        "backToAccessCodeBtn"
      );


    if (backBtn) {

      backBtn.onclick =
        () => {

          showNormalLookup(
            form
          );

        };

    }

  }

  else {

    recovery.classList.remove(
      "hidden"
    );

  }

}


/* =========================================================
   RECOVER STUDENT ACCESS CODE
   ========================================================= */


async function recoverStudentAccessCode() {

  const instagramEl =
    document.getElementById(
      "recovery-instagram"
    );


  const thrillerEl =
    document.getElementById(
      "recovery-thriller"
    );

  const romanceEl =
    document.getElementById(
      "recovery-romance"
    );

  const emotionalEl =
    document.getElementById(
      "recovery-emotional"
    );

  const actionEl =
    document.getElementById(
      "recovery-action"
    );


  const errorEl =
    document.getElementById(
      "recoveryError"
    );


  const resultEl =
    document.getElementById(
      "recoveryResult"
    );


  const recoverBtn =
    document.getElementById(
      "recoverAccessCodeBtn"
    );


  const instagram =
    instagramEl
      ? normalizeInstagramId(
          instagramEl.value
        )
      : "";


  const thriller =
    thrillerEl
      ? thrillerEl.value.trim()
      : "";

  const romance =
    romanceEl
      ? romanceEl.value.trim()
      : "";

  const emotional =
    emotionalEl
      ? emotionalEl.value.trim()
      : "";

  const action =
    actionEl
      ? actionEl.value.trim()
      : "";


  /* -------------------------------------------------------
     Clear previous messages
     ------------------------------------------------------- */

  if (errorEl) {

    errorEl.style.display =
      "none";

    errorEl.textContent =
      "";

  }


  if (resultEl) {

    resultEl.style.display =
      "none";

    resultEl.innerHTML =
      "";

  }


  /* -------------------------------------------------------
     Validate Instagram
     ------------------------------------------------------- */

  if (!instagram) {

    showRecoveryError(
      "Please enter your Instagram ID."
    );

    return;

  }


  /* -------------------------------------------------------
     Validate movie preferences
     ------------------------------------------------------- */

  if (!thriller || !romance || !emotional || !action) {

    showRecoveryError(
      "Please select one movie from each of the four preference categories."
    );

    return;

  }


  /* -------------------------------------------------------
     Supabase
     ------------------------------------------------------- */

  if (!window.supabaseClient) {

    console.error(
      "Supabase client is unavailable."
    );

    showRecoveryError(
      "Recovery service is unavailable. Please try again."
    );

    return;

  }


  /* -------------------------------------------------------
     Disable recovery button
     ------------------------------------------------------- */

  const originalText =
    recoverBtn?.textContent;


  if (recoverBtn) {

    recoverBtn.disabled =
      true;

    recoverBtn.textContent =
      "RECOVERING...";

  }


  try {

    /* -----------------------------------------------------
       Call Supabase recovery RPC.
       ----------------------------------------------------- */

    let { data, error } =
      await window.supabaseClient.rpc(
        "recover_student_access_code",
        {
          p_instagram_id:
            instagram,

          p_thriller_preference:
            thriller,

          p_romance_preference:
            romance,

          p_emotional_preference:
            emotional,

          p_action_preference:
            action
        }
      );


    /* -----------------------------------------------------
       RPC error
       ----------------------------------------------------- */

    if (error) {

      console.error(
        "Recovery RPC error:",
        error
      );

      showRecoveryError(
        "Unable to recover your access code. Please try again."
      );

      return;

    }


    /*
     * RETURNS TABLE returns an array.
     */

    const recovery =
      Array.isArray(data)
        ? data[0]
        : data;


    /* -----------------------------------------------------
       No matching registration
       ----------------------------------------------------- */

    if (
      !recovery ||
      !recovery.access_code
    ) {

      showRecoveryError(
        "No registration was found matching those details."
      );

      return;

    }


    /*
     * Normalize recovered code.
     */

    const accessCode =
      normalizeAccessCode(
        recovery.access_code
      );


    /*
     * Safety check.
     */

    if (
      !isValidAccessCode(
        accessCode
      )
    ) {

      console.error(
        "Supabase returned an invalid access code:",
        accessCode
      );

      showRecoveryError(
        "The recovered access code is invalid. Please contact the Director."
      );

      return;

    }


    /* -----------------------------------------------------
       Save recovered code
       ----------------------------------------------------- */

    sessionStorage.setItem(
      "sameSceneStudentAccessCode",
      accessCode
    );


    /* -----------------------------------------------------
       Show recovered code
       ----------------------------------------------------- */

    if (resultEl) {

      resultEl.innerHTML = `

        <div class="recovery-success-icon">
          ✓
        </div>


        <div class="recovery-success-label">
          YOUR DOSSIER ID
        </div>


        <div class="recovery-success-code">
          ${accessCode}
        </div>


        <p>
          Your access code has been recovered.
          Keep it safe — you'll need it to check
          your status and reveal your match.
        </p>


        <div class="recovery-result-actions">

          <button
            type="button"
            id="copyRecoveredCodeBtn"
            class="copy-recovered-code-btn"
          >
            COPY CODE
          </button>


          <button
            type="button"
            id="checkRecoveredStatusBtn"
            class="check-recovered-status-btn"
          >
            CHECK MY STATUS →
          </button>

        </div>

      `;


      resultEl.style.display =
        "block";

    }


    /* -----------------------------------------------------
       Hide recovery input controls
       ----------------------------------------------------- */

    const recoveryFields =
      document.querySelectorAll(".recovery-field");

    recoveryFields.forEach(field =>
      field.classList.add("hidden")
    );


    if (recoverBtn) {

      recoverBtn.classList.add(
        "hidden"
      );

    }


    /* =====================================================
       COPY RECOVERED CODE
       ===================================================== */

    const copyBtn =
      document.getElementById(
        "copyRecoveredCodeBtn"
      );


    if (copyBtn) {

      copyBtn.onclick =
        async () => {

          try {

            await navigator.clipboard.writeText(
              accessCode
            );


            copyBtn.textContent =
              "✓ COPIED";

          }

          catch (error) {

            console.error(
              "Copy failed:",
              error
            );


            /*
             * Fallback:
             * show the code on the button.
             */

            copyBtn.textContent =
              accessCode;

          }

        };

    }


    /* =====================================================
       CHECK MY STATUS
       ===================================================== */

    const checkBtn =
      document.getElementById(
        "checkRecoveredStatusBtn"
      );


    if (checkBtn) {

      checkBtn.onclick =
        async (e) => {

          e.preventDefault();


          /*
           * The recovered access code has already
           * been saved into sessionStorage.
           */


          if (
            typeof window.__sameSceneRenderStatus ===
            "function"
          ) {

            try {

              /*
               * Directly render the status page.
               */

              await window.__sameSceneRenderStatus();

            }

            catch (error) {

              console.error(
                "Failed to open recovered status:",
                error
              );

              location.hash =
                "#/status";

            }

          }

          else {

            /*
             * Safe fallback.
             */

            location.hash =
              "#/status";

          }

        };

    }


  }

  catch (error) {

    console.error(
      "Unexpected access code recovery error:",
      error
    );

    showRecoveryError(
      "Something went wrong. Please try again."
    );

  }

  finally {

    if (recoverBtn) {

      recoverBtn.disabled =
        false;


      if (
        originalText !==
        undefined
      ) {

        recoverBtn.textContent =
          originalText;

      }

    }

  }

}


/* =========================================================
   RETURN TO NORMAL LOOKUP
   ========================================================= */


function showNormalLookup(form) {

  const inputEl =
    document.getElementById(
      "l-query"
    );


  const submitBtn =
    form.querySelector(
      'button[type="submit"], input[type="submit"]'
    );


  const forgotBtn =
    document.getElementById(
      "forgotAccessCodeBtn"
    );


  const recovery =
    document.getElementById(
      "accessCodeRecovery"
    );


  hideLookupError();


  /*
   * Show normal lookup.
   */

  if (inputEl) {

    inputEl
      .closest(".form-field")
      ?.classList.remove("hidden");


    inputEl.value =
      "";

  }


  if (submitBtn) {

    submitBtn.classList.remove(
      "hidden"
    );

  }


  if (forgotBtn) {

    forgotBtn.classList.remove(
      "hidden"
    );

  }


  /*
   * Remove recovery form completely.
   */

  if (recovery) {

    recovery.remove();

  }

}