import { normalizeRegistrationData } from './validation.js';
import { authenticateDirector } from '../auth/directorAuth.js';


/* =========================================================
   SAME SCENE — REGISTRATION
   ========================================================= */

export let selectedIntent = null;


/* =========================================================
   STUDENT ACCESS CODE
   ========================================================= */

/**
 * Generate a secure, short student access code.
 *
 * Format:
 *     SC-XXXX
 *
 * Confusing characters are excluded:
 *     0 / O
 *     1 / I
 *     5 / S
 */
function generateStudentAccessCode() {

  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ2346789";

  const randomValues =
    new Uint32Array(4);

  crypto.getRandomValues(randomValues);

  let code = "";

  for (let i = 0; i < randomValues.length; i++) {

    code +=
      characters[
        randomValues[i] % characters.length
      ];

  }

  return `SC-${code}`;
}


/* =========================================================
   STUDENT REGISTRATION
   ========================================================= */

export function initRegistrationForm() {

  const intentChips =
    document.querySelectorAll(".intent-chip");


  /* -------------------------------------------------------
     MATCH INTENT
     ------------------------------------------------------- */

  intentChips.forEach(chip => {

    chip.addEventListener("click", () => {

      intentChips.forEach(c =>
        c.classList.remove("selected")
      );

      chip.classList.add("selected");

      selectedIntent =
        chip.dataset.intent;

      const intentField =
        document.getElementById("f-intent");

      if (intentField) {
        intentField.classList.remove("invalid");
      }

    });

  });


  /* -------------------------------------------------------
     REGISTRATION FORM
     ------------------------------------------------------- */

  const regForm =
    document.getElementById("regForm");

  if (!regForm) return;


  regForm.addEventListener(
    "submit",
    async function (e) {

      e.preventDefault();


      /* ---------------------------------------------------
         READ FORM VALUES
         --------------------------------------------------- */

      const nameVal =
        document
          .getElementById("in-name")
          ?.value
          .trim() || "";


      const branchVal =
        document
          .getElementById("in-branch")
          ?.value
          .trim() || "";


      const semesterVal =
        document
          .getElementById("in-semester")
          ?.value
          .trim() || "";


      const instagramVal =
        document
          .getElementById("in-instagram")
          ?.value
          .trim()
          .replace(/^@/, "") || "";


      const movieVal =
        document
          .getElementById("in-movie")
          ?.value
          .trim() || "";


      const genderVal =
        document
          .getElementById("in-gender")
          ?.value
          .trim() || "";


      const departmentVal =
        branchVal;


      /* ---------------------------------------------------
         VALIDATION
         --------------------------------------------------- */

      const fields = [
        ["f-name", nameVal],
        ["f-dept", departmentVal],
        ["f-semester", semesterVal],
        ["f-handle", instagramVal],
        ["f-movie", movieVal],
        ["f-gender", genderVal]
      ];


      let valid = true;


      fields.forEach(([id, value]) => {

        const field =
          document.getElementById(id);

        if (field) {

          field.classList.toggle(
            "invalid",
            !value
          );

        }

        if (!value) {
          valid = false;
        }

      });


      const intentField =
        document.getElementById("f-intent");


      if (intentField) {

        intentField.classList.toggle(
          "invalid",
          !selectedIntent
        );

      }


      if (!selectedIntent) {
        valid = false;
      }


      const successEl =
        document.getElementById("regSuccess");


      if (!valid) {

        if (successEl) {

          successEl.textContent =
            "Please complete all fields in your voucher.";

        }

        return;
      }


      /* ---------------------------------------------------
         SUPABASE CHECK
         --------------------------------------------------- */

      if (!window.supabaseClient) {

        console.error(
          "Supabase client is unavailable."
        );

        if (successEl) {

          successEl.textContent =
            "Registration service is unavailable. Please try again.";

        }

        return;
      }


      /* ---------------------------------------------------
         PREVENT DOUBLE SUBMISSION
         --------------------------------------------------- */

      const submitBtn =
        regForm.querySelector(
          'button[type="submit"], input[type="submit"]'
        );


      const originalButtonText =
        submitBtn?.textContent;


      if (submitBtn) {

        submitBtn.disabled = true;

        submitBtn.textContent =
          "RECORDING...";

      }


      try {

        /* -------------------------------------------------
           INSERT STUDENT

           IMPORTANT:
           We generate the access code locally.

           We DO NOT use:
               .select()
               .single()

           because the student does not need permission
           to read the inserted database row.

           This makes registration faster and respects
           the RLS security model.
           ------------------------------------------------- */

        let accessCode = null;

        let registrationError = null;


        /*
         * Try a few different access codes in the extremely
         * unlikely event of a unique-code collision.
         */

        for (let attempt = 0; attempt < 5; attempt++) {

          accessCode =
            generateStudentAccessCode();


          console.log(
            `Registration attempt ${attempt + 1}`
          );


          const { error } =
            await window.supabaseClient
              .from("students")
              .insert({

                access_code:
                  accessCode,

                name:
                  nameVal,

                department:
                  departmentVal,

                semester:
                  semesterVal,

                instagram_id:
                  instagramVal,

                favourite_movie:
                  movieVal,

                gender:
                  genderVal,

                match_intent:
                  selectedIntent,

                status:
                  "waiting"

              });


          if (!error) {

            registrationError = null;

            break;

          }


          registrationError =
            error;


          /*
           * 23505 = unique constraint violation.
           *
           * Usually this would mean an extremely rare
           * access-code collision.
           *
           * Generate another code and retry.
           */

          if (error.code !== "23505") {
            break;
          }

        }


        /* -------------------------------------------------
           HANDLE DATABASE ERROR
           ------------------------------------------------- */

        if (registrationError) {

          console.error(
            "Student registration failed:",
            registrationError
          );


          if (
            registrationError.code === "23505"
          ) {

            if (successEl) {

              successEl.textContent =
                "Unable to create a unique access code. Please try again.";

            }

          } else {

            if (successEl) {

              successEl.textContent =
                "Unable to record your story. Please try again.";

            }

          }

          return;
        }


        /* -------------------------------------------------
           STORE ACCESS CODE

           The code was generated by this browser,
           so use the local variable instead of reading
           the student back from Supabase.
           ------------------------------------------------- */

        sessionStorage.setItem(
          "sameSceneStudentAccessCode",
          accessCode
        );


        /* -------------------------------------------------
           SUCCESS UI
           ------------------------------------------------- */

        const stepDot2 =
          document.getElementById(
            "stepDot2"
          );


        if (stepDot2) {

          stepDot2.classList.add(
            "active"
          );

        }


        if (successEl) {

          successEl.innerHTML =
            `
              Your story has been recorded.<br>
              Your private access code is
              <strong>${escapeHtml(accessCode)}</strong>.<br>
              <small>Please save this code somewhere safe.</small>
            `;

        }


        /*
         * Reset the form.
         */

        regForm.reset();

        selectedIntent = null;


        intentChips.forEach(c =>
          c.classList.remove("selected")
        );


        /*
         * IMPORTANT:
         *
         * No artificial 1200ms delay.
         *
         * Go to Status immediately after Supabase
         * confirms the INSERT.
         */

        location.hash =
          "#/status";


      } catch (error) {

        console.error(
          "Unexpected registration error:",
          error
        );


        if (successEl) {

          successEl.textContent =
            "Something went wrong. Please try again.";

        }

      } finally {

        if (submitBtn) {

          submitBtn.disabled = false;


          if (
            originalButtonText !==
            undefined
          ) {

            submitBtn.textContent =
              originalButtonText;

          }

        }

      }

    }

  );

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(value) {

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* =========================================================
   DIRECTOR LOGIN
   ========================================================= */

export function initDirectorLogin() {

  const loginForm =
    document.getElementById(
      "directorLoginForm"
    );

  if (!loginForm) return;


  loginForm.addEventListener(
    "submit",
    async (e) => {

      e.preventDefault();


      const emailEl =
        document.getElementById(
          "director-email"
        );


      const passEl =
        document.getElementById(
          "director-password"
        );


      const errorEl =
        document.getElementById(
          "directorLoginError"
        );


      const email =
        emailEl
          ? emailEl.value.trim()
          : "";


      const password =
        passEl
          ? passEl.value
          : "";


      /* ---------------------------------------------------
         PREVENT DOUBLE SUBMISSION
         --------------------------------------------------- */

      const submitBtn =
        loginForm.querySelector(
          'button[type="submit"], input[type="submit"]'
        );


      if (submitBtn) {

        submitBtn.disabled = true;

        submitBtn.dataset.originalText =
          submitBtn.textContent;

        submitBtn.textContent =
          "AUTHENTICATING...";

      }


      try {

        const authResult =
          await authenticateDirector(
            email,
            password
          );


        if (!authResult.success) {

          if (errorEl) {

            errorEl.textContent =
              authResult.error ||
              "Invalid email or password.";

            errorEl.style.display =
              "block";

          }

          return;
        }


        /* -------------------------------------------------
           LOGIN SUCCESS
           ------------------------------------------------- */

        if (errorEl) {

          errorEl.textContent = "";

          errorEl.style.display =
            "none";

        }


        loginForm.reset();


        location.hash =
          "#/director-room";

      }


      catch (error) {

        console.error(
          "Director login error:",
          error
        );


        if (errorEl) {

          errorEl.textContent =
            "Unable to sign in right now. Please try again.";

          errorEl.style.display =
            "block";

        }

      }


      finally {

        if (submitBtn) {

          submitBtn.disabled = false;


          if (
            submitBtn.dataset.originalText
          ) {

            submitBtn.textContent =
              submitBtn.dataset.originalText;

          }

        }

      }

    }

  );

}