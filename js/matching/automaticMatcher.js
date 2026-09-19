// ============================================================
// AUTOMATIC MATCHING ENGINE
// Película · Prom Night
// ============================================================
//
// Pure matching logic. NO DOM. NO Supabase. NO globals.
// Everything this module needs is passed in as arguments, and
// everything it returns is plain data — this is what makes it
// safe to unit-test and safe to reuse from the UI layer
// without duplicating the rules anywhere else.
//
// RULES
// ------------------------------------------------------------
// 1. Only students with status = "waiting" are eligible.
// 2. Male can ONLY be paired with Female.
// 3. Female can ONLY be paired with Male.
// 4. Male + Male is NEVER allowed.
// 5. Female + Female is NEVER allowed.
// 6. Every student can appear in only ONE generated pair.
// 7. If genders are unbalanced, remaining students stay
//    unmatched — the algorithm never forces an invalid pair
//    just to raise the pair count.
// 8. A student already involved in ANY existing match row
//    (draft OR published) is excluded — this is what the
//    caller's `matchedStudentIds` set is for.
// 9. Matching is fully deterministic: same input always
//    produces the same output. No Math.random(), no reliance
//    on unspecified array/object iteration order.
// ============================================================


// ============================================================
// SCORING WEIGHTS
// ============================================================
//
// These are the only four factors used to order eligible
// Male/Female pairs. This is NOT an AI/compatibility score —
// it is a deterministic tally of shared registration fields,
// used only to decide which eligible pair the Director sees
// suggested first. Maximum possible score: 14.
// ============================================================

export const MOVIE_WEIGHT = 5;
export const INTENT_WEIGHT = 4;
export const SEMESTER_WEIGHT = 3;
export const DEPARTMENT_WEIGHT = 2;

export const MAX_COMPATIBILITY_SCORE =
  MOVIE_WEIGHT + INTENT_WEIGHT + SEMESTER_WEIGHT + DEPARTMENT_WEIGHT;


// ============================================================
// NORMALIZATION HELPERS
// ============================================================
//
// Every comparison goes through these so that "CS", " cs ",
// "CS " etc. are treated as equal, and missing/null values
// never throw — they just fail to match anything.
// ============================================================

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeGender(value) {
  const normalized = normalizeText(value);

  if (normalized === "male" || normalized === "female") {
    return normalized;
  }

  // Anything else (null, "", "other", "prefer not to say", a
  // typo, etc.) is deliberately treated as unknown rather than
  // guessed at — unknown-gender students never enter either
  // matching pool.
  return "unknown";
}

function isWaiting(student) {
  return normalizeText(student?.status) === "waiting";
}

function toTime(value) {
  const time = new Date(value ?? 0).getTime();
  return Number.isFinite(time) ? time : 0;
}


// ============================================================
// COMPATIBILITY SCORE
// ============================================================
//
// Returns { score, reasons } for one Male/Female pair.
// `reasons` only ever contains the factors that actually
// contributed points — nothing is listed just to pad the UI.
// ============================================================

export function calculateCompatibilityScore(male, female) {

  const reasons = [];
  let score = 0;

  const sameFavouriteMovie =
    normalizeText(male?.favourite_movie) &&
    normalizeText(male?.favourite_movie) === normalizeText(female?.favourite_movie);

  if (sameFavouriteMovie) {
    score += MOVIE_WEIGHT;
    reasons.push({ label: "Same favourite movie", points: MOVIE_WEIGHT });
  }

  const sameMatchIntent =
    normalizeText(male?.match_intent) &&
    normalizeText(male?.match_intent) === normalizeText(female?.match_intent);

  if (sameMatchIntent) {
    score += INTENT_WEIGHT;
    reasons.push({ label: "Same match intent", points: INTENT_WEIGHT });
  }

  const sameSemester =
    normalizeText(male?.semester) &&
    normalizeText(male?.semester) === normalizeText(female?.semester);

  if (sameSemester) {
    score += SEMESTER_WEIGHT;
    reasons.push({ label: "Same semester", points: SEMESTER_WEIGHT });
  }

  const sameDepartment =
    normalizeText(male?.department) &&
    normalizeText(male?.department) === normalizeText(female?.department);

  if (sameDepartment) {
    score += DEPARTMENT_WEIGHT;
    reasons.push({ label: "Same department", points: DEPARTMENT_WEIGHT });
  }

  return { score, reasons };

}


// ============================================================
// BACKWARD-COMPATIBLE REASON LIST
// ============================================================
//
// Older UI code called getMatchingBasis(male, female) and
// expected a plain string array. Kept so nothing importing it
// breaks; new UI code should prefer the `reasons` array
// returned directly on each generated pair instead of
// recomputing it.
// ============================================================

export function getMatchingBasis(male, female) {

  const { reasons } = calculateCompatibilityScore(male, female);

  if (reasons.length === 0) {
    return ["Eligible Male ↔ Female Pair"];
  }

  return reasons.map(reason => reason.label);

}


// ============================================================
// BUILD ELIGIBLE POOLS
// ============================================================
//
// Waiting + correct gender + not already in ANY match row
// (draft or published), sorted into a stable, deterministic
// order: earliest registration first, then by id. Exported on
// its own so the UI layer can show live "Male: XX / Female: XX
// eligible" counts before Generate is even clicked, using the
// exact same eligibility rule the algorithm itself uses.
// ============================================================

export function getEligiblePools(students = [], matchedStudentIds = new Set()) {

  const excluded =
    matchedStudentIds instanceof Set
      ? matchedStudentIds
      : new Set(matchedStudentIds || []);

  const stableOrder = (a, b) => {
    const timeDiff = toTime(a.created_at) - toTime(b.created_at);
    if (timeDiff !== 0) return timeDiff;
    const idA = String(a.id ?? "");
    const idB = String(b.id ?? "");
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  };

  const eligible = (Array.isArray(students) ? students : [])
    .filter(student =>
      student &&
      student.id !== undefined &&
      student.id !== null &&
      isWaiting(student) &&
      !excluded.has(student.id)
    );

  const males = eligible
    .filter(student => normalizeGender(student.gender) === "male")
    .sort(stableOrder);

  const females = eligible
    .filter(student => normalizeGender(student.gender) === "female")
    .sort(stableOrder);

  return { males, females, totalWaiting: eligible.length };

}


// ============================================================
// GENERATE AUTOMATIC MATCHES
// ============================================================
//
// generateAutomaticMatches(students, matchedStudentIds)
//
// Deterministic, single-pass-per-male greedy assignment:
// for each male (in stable order), scan the still-available
// females and keep only the best-scoring one — no full M×N
// pair array is ever built or sorted, which matters once
// there are ~500 students on each side.
// ============================================================

export function generateAutomaticMatches(students = [], matchedStudentIds = new Set()) {

  if (!Array.isArray(students)) {

    return {
      pairs: [],
      unmatchedMales: [],
      unmatchedFemales: [],
      totalWaiting: 0,
      totalEligibleMales: 0,
      totalEligibleFemales: 0,
      totalPairs: 0
    };

  }

  const { males, females, totalWaiting } =
    getEligiblePools(students, matchedStudentIds);

  const usedFemaleIds = new Set();
  const pairs = [];
  const unmatchedMales = [];

  for (const male of males) {

    let bestFemale = null;
    let bestResult = null;

    for (const female of females) {

      if (usedFemaleIds.has(female.id)) continue;
      if (female.id === male.id) continue; // defensive; genders differ so this shouldn't occur

      const result = calculateCompatibilityScore(male, female);

      const isBetter =
        !bestFemale ||
        result.score > bestResult.score ||
        (
          result.score === bestResult.score &&
          toTime(female.created_at) < toTime(bestFemale.created_at)
        ) ||
        (
          result.score === bestResult.score &&
          toTime(female.created_at) === toTime(bestFemale.created_at) &&
          String(female.id) < String(bestFemale.id)
        );

      if (isBetter) {
        bestFemale = female;
        bestResult = result;
      }

    }

    if (bestFemale) {

      usedFemaleIds.add(bestFemale.id);

      pairs.push({
        male,
        female: bestFemale,
        score: bestResult.score,
        reasons: bestResult.reasons
      });

    } else {

      unmatchedMales.push(male);

    }

  }

  const unmatchedFemales =
    females.filter(female => !usedFemaleIds.has(female.id));

  return {

    pairs,
    unmatchedMales,
    unmatchedFemales,

    totalWaiting,
    totalEligibleMales: males.length,
    totalEligibleFemales: females.length,
    totalPairs: pairs.length,

    // Kept for compatibility with any code still reading
    // result.males / result.females directly.
    males,
    females

  };

}