import { normalizeRegistrationData } from './validation.js';
import { authenticateDirector } from '../auth/directorAuth.js';


/* =========================================================
   SAME SCENE — REGISTRATION
   ========================================================= */

export let selectedIntent = null;
export let selectedThriller = null;
export let selectedRomance = null;
export let selectedEmotional = null;
export let selectedAction = null;

let currentStep = 1;

function formatIntent(intent) {
  if (intent === "romance") return "Romance (A Love Story)";
  if (intent === "friendship") return "Friendship (A Buddy Picture)";
  if (intent === "either") return "Open to Either";
  return intent || "—";
}

export function goToStep(stepNum) {
  currentStep = stepNum;

  const step1 = document.getElementById("stepIndicator1");
  const step2 = document.getElementById("stepIndicator2");
  const step3 = document.getElementById("stepIndicator3");

  if (step1) {
    step1.classList.toggle("active", stepNum === 1);
    step1.classList.toggle("completed", stepNum > 1);
  }
  if (step2) {
    step2.classList.toggle("active", stepNum === 2);
    step2.classList.toggle("completed", stepNum > 2);
  }
  if (step3) {
    step3.classList.toggle("active", stepNum === 3);
    step3.classList.toggle("completed", stepNum > 3);
  }

  const container = document.getElementById("regFormContainer");
  const step1Content = document.getElementById("reg-step-1");
  const step2Content = document.getElementById("reg-step-2");
  const step3Content = document.getElementById("reg-step-3");
  const step4Content = document.getElementById("reg-step-4");

  if (stepNum === 4) {
    if (container) container.classList.add("hidden");
    if (step4Content) step4Content.classList.remove("hidden");
    return;
  }

  if (container) container.classList.remove("hidden");
  if (step4Content) step4Content.classList.add("hidden");

  if (step1Content) step1Content.classList.toggle("hidden", stepNum !== 1);
  if (step2Content) step2Content.classList.toggle("hidden", stepNum !== 2);
  if (step3Content) step3Content.classList.toggle("hidden", stepNum !== 3);

  const scriptHeading = document.getElementById("mediaScriptHeading");
  if (scriptHeading) {
    if (stepNum === 1) scriptHeading.innerHTML = "Good people<br>Better stories.";
    else if (stepNum === 2) scriptHeading.innerHTML = "A small form<br>A bigger story.";
    else if (stepNum === 3) scriptHeading.innerHTML = "Stories connect<br>people.";
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}


/* =========================================================
   STUDENT ACCESS CODE
   ========================================================= */

function generateStudentAccessCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ2346789";
  const randomValues = new Uint32Array(4);
  crypto.getRandomValues(randomValues);

  let code = "";
  for (let i = 0; i < randomValues.length; i++) {
    code += characters[randomValues[i] % characters.length];
  }

  return `SC-${code}`;
}


/* =========================================================
   STUDENT REGISTRATION
   ========================================================= */

export function initRegistrationForm() {
  const intentChips = document.querySelectorAll(".intent-chip");
  const vibeChips = document.querySelectorAll(".vibe-chip");
  const globalBackBtn = document.getElementById("regGlobalBackBtn");
  const btnStep1Next = document.getElementById("btnStep1Next");
  const btnStep2Back = document.getElementById("btnStep2Back");
  const btnStep2Next = document.getElementById("btnStep2Next");
  const btnStep3Back = document.getElementById("btnStep3Back");
  const btnCopyCode = document.getElementById("btnCopySuccessCode");

  goToStep(1);

  /* Global Back Button */
  if (globalBackBtn) {
    globalBackBtn.onclick = () => {
      if (currentStep === 1) {
        location.hash = "#/experience";
      } else if (currentStep === 2) {
        goToStep(1);
      } else if (currentStep === 3) {
        goToStep(2);
      }
    };
  }

  /* MATCH INTENT */
  intentChips.forEach(chip => {
    chip.addEventListener("click", () => {
      intentChips.forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
      selectedIntent = chip.dataset.intent;

      const intentField = document.getElementById("f-intent");
      if (intentField) {
        intentField.classList.remove("invalid");
      }
    });
  });

  /* MOVIE PREFERENCES (VIBE CHIPS) */
  vibeChips.forEach(chip => {
    chip.addEventListener("click", (e) => {
      const category = chip.dataset.category;
      const value = chip.dataset.value;

      const categoryChips = document.querySelectorAll(`.vibe-chip[data-category="${category}"]`);
      categoryChips.forEach(c => {
        c.classList.remove("selected");
        const radio = c.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
      });

      chip.classList.add("selected");
      const currentRadio = chip.querySelector('input[type="radio"]');
      if (currentRadio) currentRadio.checked = true;

      if (category === "thriller") {
        selectedThriller = value;
      } else if (category === "romantic") {
        selectedRomance = value;
      } else if (category === "emotional") {
        selectedEmotional = value;
      } else if (category === "action") {
        selectedAction = value;
      }

      const catBlock = document.getElementById(`vibe-cat-${category}`);
      if (catBlock) {
        catBlock.classList.remove("invalid");
      }

      const errEl = document.getElementById("step2Err");
      if (errEl && selectedThriller && selectedRomance && selectedEmotional && selectedAction) {
        errEl.style.display = "none";
      }
    });
  });

  /* STEP 1 NEXT BUTTON */
  if (btnStep1Next) {
    btnStep1Next.onclick = () => {
      const nameVal = document.getElementById("in-name")?.value.trim() || "";
      const branchVal = document.getElementById("in-branch")?.value.trim() || "";
      const semesterVal = document.getElementById("in-semester")?.value.trim() || "";
      const instagramVal = document.getElementById("in-instagram")?.value.trim().replace(/^@/, "") || "";
      const genderVal = document.getElementById("in-gender")?.value.trim() || "";

      const fields = [
        ["f-name", nameVal],
        ["f-dept", branchVal],
        ["f-semester", semesterVal],
        ["f-handle", instagramVal],
        ["f-gender", genderVal]
      ];

      let valid = true;
      fields.forEach(([id, val]) => {
        const f = document.getElementById(id);
        if (f) f.classList.toggle("invalid", !val);
        if (!val) valid = false;
      });

      const intentField = document.getElementById("f-intent");
      if (intentField) intentField.classList.toggle("invalid", !selectedIntent);
      if (!selectedIntent) valid = false;

      if (valid) {
        goToStep(2);
      }
    };
  }

  /* STEP 2 BACK & NEXT BUTTONS */
  if (btnStep2Back) {
    btnStep2Back.onclick = () => goToStep(1);
  }

  if (btnStep2Next) {
    btnStep2Next.onclick = () => {
      const catThriller = document.getElementById("vibe-cat-thriller");
      const catRomantic = document.getElementById("vibe-cat-romantic");
      const catEmotional = document.getElementById("vibe-cat-emotional");
      const catAction = document.getElementById("vibe-cat-action");

      if (catThriller) catThriller.classList.toggle("invalid", !selectedThriller);
      if (catRomantic) catRomantic.classList.toggle("invalid", !selectedRomance);
      if (catEmotional) catEmotional.classList.toggle("invalid", !selectedEmotional);
      if (catAction) catAction.classList.toggle("invalid", !selectedAction);

      const allSelected = selectedThriller && selectedRomance && selectedEmotional && selectedAction;

      const errEl = document.getElementById("step2Err");
      if (errEl) {
        errEl.style.display = allSelected ? "none" : "block";
      }

      if (!allSelected) return;

      /* Populate Confirmation (Step 3) */
      const nameVal = document.getElementById("in-name")?.value.trim() || "";
      const branchVal = document.getElementById("in-branch")?.value.trim() || "";
      const semesterVal = document.getElementById("in-semester")?.value.trim() || "";
      const instagramVal = document.getElementById("in-instagram")?.value.trim().replace(/^@/, "") || "";
      const genderVal = document.getElementById("in-gender")?.value.trim() || "";

      setText("confirmName", nameVal);
      setText("confirmDept", branchVal);
      setText("confirmSem", semesterVal);
      setText("confirmInsta", instagramVal ? `@${instagramVal}` : "—");
      setText("confirmGender", genderVal);
      setText("confirmIntent", formatIntent(selectedIntent));
      setText("confirmThriller", selectedThriller);
      setText("confirmRomance", selectedRomance);
      setText("confirmEmotional", selectedEmotional);
      setText("confirmAction", selectedAction);

      goToStep(3);
    };
  }

  /* STEP 3 BACK BUTTON */
  if (btnStep3Back) {
    btnStep3Back.onclick = () => goToStep(2);
  }

  /* COPY CODE BUTTON IN SUCCESS SCREEN */
  if (btnCopyCode) {
    btnCopyCode.onclick = async () => {
      const codeVal = document.getElementById("successAccessCode")?.textContent.trim();
      if (codeVal) {
        try {
          await navigator.clipboard.writeText(codeVal);
          btnCopyCode.textContent = "✓ COPIED";
          setTimeout(() => {
            btnCopyCode.textContent = "📋 COPY ACCESS CODE";
          }, 2500);
        } catch (e) {
          btnCopyCode.textContent = codeVal;
        }
      }
    };
  }

  /* REGISTRATION FORM SUBMIT (FINAL STEP 3 SUBMIT) */
  const regForm = document.getElementById("regForm");
  if (!regForm) return;

  regForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const nameVal = document.getElementById("in-name")?.value.trim() || "";
    const branchVal = document.getElementById("in-branch")?.value.trim() || "";
    const semesterVal = document.getElementById("in-semester")?.value.trim() || "";
    const instagramVal = document.getElementById("in-instagram")?.value.trim().replace(/^@/, "") || "";
    const genderVal = document.getElementById("in-gender")?.value.trim() || "";

    if (!nameVal || !branchVal || !semesterVal || !instagramVal || !genderVal || !selectedIntent ||
        !selectedThriller || !selectedRomance || !selectedEmotional || !selectedAction) {
      goToStep(1);
      return;
    }

    const successEl = document.getElementById("regSuccess");
    if (!window.supabaseClient) {
      if (successEl) successEl.textContent = "Registration service is unavailable. Please try again.";
      return;
    }

    const submitBtn = document.getElementById("btnSealSubmit");
    const originalButtonText = submitBtn?.textContent;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "RECORDING...";
    }

    try {
      let accessCode = null;
      let registrationError = null;
      const compositeMovie = `${selectedThriller} · ${selectedRomance} · ${selectedEmotional} · ${selectedAction}`;

      for (let attempt = 0; attempt < 5; attempt++) {
        accessCode = generateStudentAccessCode();

        const { error } = await window.supabaseClient.from("students").insert({
          access_code: accessCode,
          name: nameVal,
          department: branchVal,
          semester: semesterVal,
          instagram_id: instagramVal,
          favourite_movie: compositeMovie,
          thriller_preference: selectedThriller,
          romance_preference: selectedRomance,
          emotional_preference: selectedEmotional,
          action_preference: selectedAction,
          gender: genderVal,
          match_intent: selectedIntent,
          status: "waiting"
        });

        if (!error) {
          registrationError = null;
          break;
        }

        registrationError = error;
        if (error.code !== "23505") break;
      }

      if (registrationError) {
        console.error("Student registration failed:", registrationError);
        if (successEl) {
          successEl.textContent = registrationError.code === "23505"
            ? "Unable to create a unique access code. Please try again."
            : "Unable to record your story. Please try again.";
        }
        return;
      }

      sessionStorage.setItem("sameSceneStudentAccessCode", accessCode);

      const codeDisplay = document.getElementById("successAccessCode");
      if (codeDisplay) codeDisplay.textContent = accessCode;

      regForm.reset();
      selectedIntent = null;
      selectedThriller = null;
      selectedRomance = null;
      selectedEmotional = null;
      selectedAction = null;

      intentChips.forEach(c => c.classList.remove("selected"));
      vibeChips.forEach(c => {
        c.classList.remove("selected");
        const radio = c.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
      });

      goToStep(4);

    } catch (error) {
      console.error("Unexpected registration error:", error);
      if (successEl) successEl.textContent = "Something went wrong. Please try again.";
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (originalButtonText !== undefined) {
          submitBtn.textContent = originalButtonText;
        }
      }
    }
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "—";
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