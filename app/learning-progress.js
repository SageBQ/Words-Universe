export const LEARNING_PROGRESS_KEY = 'lexicon-learning-progress-v1';

const safeRecord = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export function readProgress(storage = typeof localStorage === 'undefined' ? null : localStorage) {
  try { return safeRecord(JSON.parse(storage?.getItem(LEARNING_PROGRESS_KEY) || '{}')); } catch { return {}; }
}

export function writeProgress(progress, storage = typeof localStorage === 'undefined' ? null : localStorage) {
  storage?.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(safeRecord(progress)));
}

export function clearProgress(storage = typeof localStorage === 'undefined' ? null : localStorage) {
  storage?.removeItem(LEARNING_PROGRESS_KEY);
}

export function answerProgress(progress, term, isCorrect, now = Date.now()) {
  const current = safeRecord(progress)[term] || {attempts: 0, correct: 0, streak: 0, lastReviewedAt: 0, incorrect: false, nextReviewAt: now};
  const streak = isCorrect ? current.streak + 1 : 0;
  const hours = isCorrect ? [1, 12, 48, 168, 336][Math.min(streak - 1, 4)] : 0;
  return {...safeRecord(progress), [term]: {attempts: current.attempts + 1, correct: current.correct + (isCorrect ? 1 : 0), streak, lastReviewedAt: now, incorrect: !isCorrect, nextReviewAt: now + hours * 3600000}};
}

export function getDueTerms(progress, now = Date.now()) {
  return Object.entries(safeRecord(progress)).filter(([, value]) => value?.incorrect || Number(value?.nextReviewAt || 0) <= now).map(([term]) => term);
}

export function progressSummary(progress, now = Date.now()) {
  const values = Object.values(safeRecord(progress));
  return {due: getDueTerms(progress, now).length, mastered: values.filter(value => value?.streak >= 3 && !value?.incorrect).length, recentMistakes: values.filter(value => value?.incorrect).length};
}
