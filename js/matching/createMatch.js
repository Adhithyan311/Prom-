/**
 * Same Scene — Manual Match Creation
 *
 * The Director manually selects Student A and Student B.
 *
 * No:
 * - gender restriction
 * - compatibility score
 * - AI matching
 * - automatic pairing
 * - localStorage match creation
 *
 * A newly created match is always a DRAFT.
 */

import { isDirectorAuthenticated } from '../auth/directorAuth.js';
import {
  setSelectedReelAId,
  setSelectedReelBId
} from '../director/matchStudio.js';


export async function handleCreateMatch(
  studentA,
  studentB,
  renderDirectorLobbyFn
) {

  /*
   * Director authentication check.
   */

  if (!isDirectorAuthenticated()) {

    location.replace(
      '#/director-login'
    );

    return;

  }


  /*
   * Validate selected students.
   */

  if (!studentA || !studentB) {

    showMatchMessage(
      'Please select two students.'
    );

    return;

  }


  /*
   * A student cannot be matched with themselves.
   */

  if (studentA.id === studentB.id) {

    showMatchMessage(
      'A student cannot be matched with themselves.'
    );

    return;

  }


  /*
   * Supabase availability.
   */

  if (!window.supabaseClient) {

    console.error(
      'Supabase client is unavailable.'
    );

    showMatchMessage(
      'Match service is unavailable. Please try again.'
    );

    return;

  }


  /*
   * Disable the button while the database
   * operation is running.
   */

  const button =
    document.getElementById(
      'btn-create-match'
    );

  if (button) {

    button.disabled = true;

    button.dataset.originalText =
      button.textContent;

    button.textContent =
      'CREATING SCENE...';

  }


  try {

    /*
     * --------------------------------------------------
     * IMPORTANT SECURITY CHECK
     * --------------------------------------------------
     *
     * Check that both students are still available.
     *
     * Another Director action or another browser tab
     * could have changed their status after the
     * Match Studio loaded.
     */

    const {
      data: latestStudents,
      error: studentError
    } =
      await window.supabaseClient
        .from('students')
        .select(
          'id, name, department, semester, instagram_id, favourite_movie, gender, match_intent, status'
        )
        .in(
          'id',
          [
            studentA.id,
            studentB.id
          ]
        );


    if (studentError) {

      console.error(
        'Failed to verify students:',
        studentError
      );

      showMatchMessage(
        'Unable to verify the selected students.'
      );

      return;

    }


    if (
      !latestStudents ||
      latestStudents.length !== 2
    ) {

      showMatchMessage(
        'One or both selected students could not be found.'
      );

      return;

    }


    const latestA =
      latestStudents.find(
        student =>
          student.id === studentA.id
      );

    const latestB =
      latestStudents.find(
        student =>
          student.id === studentB.id
      );


    /*
     * Both students must still be waiting.
     */

    if (
      latestA.status !== 'waiting' ||
      latestB.status !== 'waiting'
    ) {

      showMatchMessage(
        'One or both students have already been matched.'
      );

      return;

    }


    /*
     * --------------------------------------------------
     * SECURITY: ENFORCE GENDER RULE SERVER-SIDE
     * --------------------------------------------------
     *
     * The Match Studio dropdowns only ever populate
     * Candidate A with male students and Candidate B
     * with female students, but that is a UI convenience,
     * not a security boundary.
     *
     * This function is also reachable directly via
     * window.handleCreateMatch(), so the rule must be
     * enforced here, against the freshly-fetched student
     * records, regardless of what the UI passed in.
     */

    const normalizeGender = (value) =>
      String(value || '').trim().toLowerCase();

    if (
      normalizeGender(latestA.gender) !== 'male' ||
      normalizeGender(latestB.gender) !== 'female'
    ) {

      console.error(
        'Blocked match creation: gender rule violated.',
        { studentA: latestA.id, studentB: latestB.id }
      );

      showMatchMessage(
        'Invalid pairing: Candidate A must be male and Candidate B must be female.'
      );

      return;

    }


    /*
     * --------------------------------------------------
     * CREATE DRAFT MATCH
     * --------------------------------------------------
     *
     * The database schema uses:
     *
     * student_a_id
     * student_b_id
     * status = draft
     */

    const {
      data: match,
      error: matchError
    } =
      await window.supabaseClient
        .from('matches')
        .insert({

          student_a_id:
            latestA.id,

          student_b_id:
            latestB.id,

          status:
            'draft'

        })
        .select(
          'id, student_a_id, student_b_id, status, created_at'
        )
        .single();


    if (matchError) {

      console.error(
        'Failed to create draft match:',
        matchError
      );


      /*
       * PostgreSQL unique constraints protect
       * against a student being placed in more
       * than one match.
       */

      if (
        matchError.code === '23505'
      ) {

        showMatchMessage(
          'One of these students is already assigned to a match.'
        );

      } else {

        showMatchMessage(
          'Unable to create the match. Please try again.'
        );

      }

      return;

    }


    /*
     * --------------------------------------------------
     * SUCCESS
     * --------------------------------------------------
     */

    console.log(
      'Draft match created:',
      match
    );


    /*
     * Clear the current Match Studio selections.
     */

    setSelectedReelAId(null);
    setSelectedReelBId(null);


    /*
     * Tell the Director that the draft was created.
     */

    showMatchMessage(
      `✓ Draft Scene Created: ${latestA.name} ↔ ${latestB.name}`
    );


    /*
     * Refresh the Director Room.
     */

    if (
      typeof renderDirectorLobbyFn ===
      'function'
    ) {

      await renderDirectorLobbyFn();

    } else if (
      typeof window.renderDirectorLobby ===
      'function'
    ) {

      await window.renderDirectorLobby();

    }


  } catch (error) {

    console.error(
      'Unexpected match creation error:',
      error
    );

    showMatchMessage(
      'Something went wrong while creating the match.'
    );

  } finally {

    if (button) {

      button.disabled = false;

      if (
        button.dataset.originalText
      ) {

        button.textContent =
          button.dataset.originalText;

      }

    }

  }

}


/**
 * Display a Director Room message.
 */
function showMatchMessage(message) {

  const msgEl =
    document.getElementById(
      'match-msg'
    );

  if (!msgEl) return;

  msgEl.style.display =
    'block';

  msgEl.textContent =
    message;

  clearTimeout(
    window.sameSceneMatchMessageTimer
  );

  window.sameSceneMatchMessageTimer =
    setTimeout(() => {

      msgEl.style.display =
        'none';

    }, 4000);

}