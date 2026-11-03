export const LEARNING_PROGRESS_KEY = 'lexicon-learning-progress-v1';
export const ERROR_CAUSES = {meaning:'词义混淆', spelling:'拼写', pronunciation:'发音', synonym:'近义词辨析', morpheme:'词根词缀', usage:'搭配用法'};

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
  const current = safeRecord(progress)[term] || {attempts: 0, correct: 0, streak: 0, lastReviewedAt: 0, incorrect: false, nextReviewAt: now, errorCauses:{}};
  const streak = isCorrect ? current.streak + 1 : 0;
  const days = isCorrect ? [1, 3, 7, 14, 30][Math.min(streak - 1, 4)] : 0;
  return {...safeRecord(progress), [term]: {...current, attempts: current.attempts + 1, correct: current.correct + (isCorrect ? 1 : 0), streak, lastReviewedAt: now, incorrect: !isCorrect, nextReviewAt: now + days * 86400000}};
}

export function markErrorCause(progress, term, cause, now = Date.now()) {
  if(!Object.hasOwn(ERROR_CAUSES,cause))return safeRecord(progress);
  const current=safeRecord(progress)[term] || {attempts:0,correct:0,streak:0,lastReviewedAt:0,incorrect:false,nextReviewAt:now,errorCauses:{}};
  return {...safeRecord(progress),[term]:{...current,incorrect:true,streak:0,nextReviewAt:now,errorCauses:{...current.errorCauses,[cause]:(current.errorCauses?.[cause]||0)+1}}};
}

export function errorCount(value) {
  return Object.values(safeRecord(value?.errorCauses)).reduce((total,count)=>total+(Number(count)||0),0);
}

export function getDueTerms(progress, now = Date.now()) {
  return Object.entries(safeRecord(progress)).filter(([, value]) => value?.incorrect || Number(value?.nextReviewAt || 0) <= now).sort((a,b)=>{
    const riskA=errorCount(a[1])+(a[1]?.incorrect?3:0),riskB=errorCount(b[1])+(b[1]?.incorrect?3:0);
    return riskB-riskA||Number(a[1]?.nextReviewAt||0)-Number(b[1]?.nextReviewAt||0);
  }).map(([term]) => term);
}

export function progressSummary(progress, now = Date.now()) {
  const values = Object.values(safeRecord(progress));
  return {due: getDueTerms(progress, now).length, mastered: values.filter(value => value?.streak >= 3 && !value?.incorrect).length, recentMistakes: values.filter(value => value?.incorrect).length};
}
