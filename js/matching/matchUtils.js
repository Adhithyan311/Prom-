export function norm(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function calculateAffinity(candA, candB) {
  if (!candA || !candB) return 0;
  
  let score = 70; // baseline
  
  const textA = `${candA.favoriteMovie} ${candA.favoriteGenre} ${candA.favoriteMusic} ${candA.department}`;
  const textB = `${candB.favoriteMovie} ${candB.favoriteGenre} ${candB.favoriteMusic} ${candB.department}`;

  const wordsA = norm(textA).split(/[^a-z0-9]+/);
  const wordsB = norm(textB).split(/[^a-z0-9]+/);
  const stopWords = new Set(['the','a','an','and','or','in','of','to','is','for','with','on','at','by','from','s1','s2','s3','s4','s5','s6','s7','s8']);
  const setA = new Set(wordsA.filter(w => w.length > 2 && !stopWords.has(w)));
  const setB = new Set(wordsB.filter(w => w.length > 2 && !stopWords.has(w)));
  
  let common = 0;
  setA.forEach(w => { if (setB.has(w)) common++; });
  score += Math.min(common * 5, 16);
  
  if (norm(candA.favoriteGenre) === norm(candB.favoriteGenre)) {
    score += 7;
  }

  if (candA.matchIntent === candB.matchIntent) {
    score += 5;
  } else if (candA.matchIntent === 'either' || candB.matchIntent === 'either') {
    score += 3;
  }
  
  const seed = (candA.id.charCodeAt(candA.id.length - 1) + candB.id.charCodeAt(candB.id.length - 1)) % 7;
  score += seed;
  
  return Math.max(68, Math.min(98, score));
}
