export function normalizeRegistrationData(formData = {}) {
  const thriller = formData.thriller_preference || formData.thriller || '';
  const romance = formData.romance_preference || formData.romance || '';
  const emotional = formData.emotional_preference || formData.emotional || '';
  const action = formData.action_preference || formData.action || '';
  const compositeMovie = [thriller, romance, emotional, action].filter(Boolean).join(' · ');

  return {
    name: formData.name || '',
    department: formData.department || [formData.branch, formData.semester].filter(Boolean).join(' ').trim(),
    semester: formData.semester || '',
    instagram_id: String(formData.instagram_id || formData.instagram || formData.handle || '').replace(/^@/, ''),
    thriller_preference: thriller,
    romance_preference: romance,
    emotional_preference: emotional,
    action_preference: action,
    favourite_movie: formData.favourite_movie || formData.favoriteMovie || compositeMovie,
    gender: formData.gender || '',
    match_intent: formData.match_intent || formData.matchIntent || 'either'
  };
}

