export function renderStudentDetails(candidate) {
  if (!candidate) return null;
  return {
    id: candidate.id,
    name: candidate.name,
    department: candidate.department,
    instagram: candidate.instagram || candidate.handle,
    movie: candidate.favoriteMovie,
    genre: candidate.favoriteGenre,
    music: candidate.favoriteMusic,
    status: candidate.status,
    intent: candidate.matchIntent
  };
}
