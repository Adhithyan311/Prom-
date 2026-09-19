export function normalizeRegistrationData(formData = {}) {
  return {
    name: formData.name || '',
    department: formData.department || [formData.branch, formData.semester].filter(Boolean).join(' ').trim(),
    semester: formData.semester || '',
    instagram_id: String(formData.instagram_id || formData.instagram || formData.handle || '').replace(/^@/, ''),
    favourite_movie: formData.favourite_movie || formData.favoriteMovie || '',
    gender: formData.gender || '',
    match_intent: formData.match_intent || formData.matchIntent || 'either'
  };
}
