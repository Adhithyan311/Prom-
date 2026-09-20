// ============================================================
// AUTOMATIC MATCHING ENGINE
// Película · Prom Night
// ============================================================
//
// Pure matching logic. NO DOM. NO Supabase. NO globals.
//
// RULES
// ------------------------------------------------------------
// 1. Only students with status = "waiting" are eligible.
// 2. Male can ONLY be paired with Female (Hard eligibility filter).
// 3. Female can ONLY be paired with Male (Hard eligibility filter).
// 4. Male + Male is NEVER allowed.
// 5. Female + Female is NEVER allowed.
// 6. Every student can appear in only ONE generated pair per batch.
// 7. Students missing the 4 new movie preferences are excluded
//    from automatic preference matching (staying waiting in directory).
// 8. Matching score is based strictly on the 4 movie categories:
//    - THRILLER  (25%)
//    - ROMANCE   (25%)
//    - EMOTIONAL (25%)
//    - ACTION    (25%)
//    Percentage = (matched categories / 4) * 100%.
// 9. Matching is fully deterministic: global candidate pairs are
//    sorted by score descending with stable created_at / id tie-breakers.
// ============================================================


export const MAX_COMPATIBILITY_SCORE = 4;


// ============================================================
// NORMALIZATION HELPERS
// ============================================================

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeGender(value) {
  const normalized = normalizeText(value);

  if (normalized === "male" || normalized === "female") {
    return normalized;
  }

  return "unknown";
}

function isWaiting(student) {
  return normalizeText(student?.status) === "waiting";
}

function hasCompletePreferences(student) {
  return Boolean(
    student?.thriller_preference &&
    student?.romance_preference &&
    student?.emotional_preference &&
    student?.action_preference
  );
}

function toTime(value) {
  const time = new Date(value ?? 0).getTime();
  return Number.isFinite(time) ? time : 0;
}


// ============================================================
// COMPATIBILITY SCORE
// ============================================================
//
// Calculates preference compatibility across the 4 categories.
// Returns { score, percentage, reasons }.
// ============================================================

export function calculateCompatibilityScore(male, female) {
  const reasons = [];
  let score = 0;

  // 1. THRILLER
  const maleThriller = String(male?.thriller_preference || "").trim();
  const femaleThriller = String(female?.thriller_preference || "").trim();
  if (maleThriller && femaleThriller && normalizeText(maleThriller) === normalizeText(femaleThriller)) {
    score += 1;
    reasons.push({ category: "Thriller", value: maleThriller, label: `Thriller — ${maleThriller}` });
  }

  // 2. ROMANCE
  const maleRomance = String(male?.romance_preference || "").trim();
  const femaleRomance = String(female?.romance_preference || "").trim();
  if (maleRomance && femaleRomance && normalizeText(maleRomance) === normalizeText(femaleRomance)) {
    score += 1;
    reasons.push({ category: "Romance", value: maleRomance, label: `Romance — ${maleRomance}` });
  }

  // 3. EMOTIONAL
  const maleEmotional = String(male?.emotional_preference || "").trim();
  const femaleEmotional = String(female?.emotional_preference || "").trim();
  if (maleEmotional && femaleEmotional && normalizeText(maleEmotional) === normalizeText(femaleEmotional)) {
    score += 1;
    reasons.push({ category: "Emotional", value: maleEmotional, label: `Emotional — ${maleEmotional}` });
  }

  // 4. ACTION
  const maleAction = String(male?.action_preference || "").trim();
  const femaleAction = String(female?.action_preference || "").trim();
  if (maleAction && femaleAction && normalizeText(maleAction) === normalizeText(femaleAction)) {
    score += 1;
    reasons.push({ category: "Action", value: maleAction, label: `Action — ${maleAction}` });
  }

  const percentage = Math.round((score / 4) * 100);

  return { score, percentage, reasons };
}


// ============================================================
// MATCHING BASIS HELPER
// ============================================================

export function getMatchingBasis(male, female) {
  const { reasons } = calculateCompatibilityScore(male, female);

  if (reasons.length === 0) {
    return ["Eligible Male ↔ Female Pair (0% Match)"];
  }

  return reasons.map(r => r.label);
}


// ============================================================
// BUILD ELIGIBLE POOLS
// ============================================================
//
// Filter: status="waiting" + valid gender + not already matched
// + has all 4 movie preference fields populated.
// Sorted deterministically by created_at then id.
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
      !excluded.has(student.id) &&
      hasCompletePreferences(student)
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
// Global greedy assignment:
// 1. Build eligible Male & Female pools (hard gender filter).
// 2. Generate all candidate Male-Female pairs.
// 3. Sort pairs by compatibility score descending with stable tie-breakers.
// 4. Assign one-to-one pairs iteratively.
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

  const { males, females, totalWaiting } = getEligiblePools(students, matchedStudentIds);

  // Generate all candidate pairs
  const candidatePairs = [];

  for (const male of males) {
    for (const female of females) {
      if (male.id === female.id) continue;

      const result = calculateCompatibilityScore(male, female);

      candidatePairs.push({
        male,
        female,
        score: result.score,
        percentage: result.percentage,
        reasons: result.reasons
      });
    }
  }

  // Sort candidate pairs deterministically:
  // 1. Score descending
  // 2. Male created_at ascending
  // 3. Female created_at ascending
  // 4. Male ID ascending
  // 5. Female ID ascending
  candidatePairs.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const maleTimeA = toTime(a.male.created_at);
    const maleTimeB = toTime(b.male.created_at);
    if (maleTimeA !== maleTimeB) return maleTimeA - maleTimeB;

    const femaleTimeA = toTime(a.female.created_at);
    const femaleTimeB = toTime(b.female.created_at);
    if (femaleTimeA !== femaleTimeB) return femaleTimeA - femaleTimeB;

    const maleIdA = String(a.male.id ?? "");
    const maleIdB = String(b.male.id ?? "");
    if (maleIdA !== maleIdB) return maleIdA < maleIdB ? -1 : 1;

    const femaleIdA = String(a.female.id ?? "");
    const femaleIdB = String(b.female.id ?? "");
    return femaleIdA < femaleIdB ? -1 : femaleIdA > femaleIdB ? 1 : 0;
  });

  // Assign one-to-one pairs
  const usedMaleIds = new Set();
  const usedFemaleIds = new Set();
  const pairs = [];

  for (const pair of candidatePairs) {
    if (usedMaleIds.has(pair.male.id) || usedFemaleIds.has(pair.female.id)) {
      continue;
    }

    usedMaleIds.add(pair.male.id);
    usedFemaleIds.add(pair.female.id);
    pairs.push(pair);
  }

  const unmatchedMales = males.filter(m => !usedMaleIds.has(m.id));
  const unmatchedFemales = females.filter(f => !usedFemaleIds.has(f.id));

  return {
    pairs,
    unmatchedMales,
    unmatchedFemales,
    totalWaiting,
    totalEligibleMales: males.length,
    totalEligibleFemales: females.length,
    totalPairs: pairs.length,
    males,
    females
  };
}