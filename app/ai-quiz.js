const pick = (items, index) => items[index % items.length];

export function createLocalQuiz(words, count = 5) {
  const pool = words.filter(word => word?.term).slice(0, 12);
  if (!pool.length) return [];
  return Array.from({length: Math.min(count, pool.length)}, (_, index) => {
    const target = pick(pool, index);
    const choices = [...new Set([target.term, ...pool.filter(word => word.term !== target.term).slice(index + 1, index + 4).map(word => word.term)])].slice(0, 4);
    return {id: `local-${target.term}-${index}`, type: 'meaning', target: target.term, answerTerm: target.term, prompt: `哪一个英文词最符合“${target.chinese || target.definition}”？`, choices};
  });
}

export function validateAiQuiz(items, words) {
  const byTerm = new Map(words.map(word => [String(word.term).toLowerCase(), word]));
  if (!Array.isArray(items)) return [];
  return items.slice(0, 5).map((item, index) => {
    const target = String(item?.target || '').toLowerCase();
    if (!byTerm.has(target)) return null;
    const proposed = Array.isArray(item.choices) ? item.choices.map(choice => String(choice).toLowerCase()).filter(term => byTerm.has(term) && term !== target) : [];
    const choices = [...new Set([target, ...proposed, ...words.filter(word => word.term !== target).slice(0, 3).map(word => word.term)])].slice(0, 4);
    return {id: `ai-${target}-${index}`, type: ['meaning','recall','synonym','morpheme','memory'].includes(item.type) ? item.type : 'meaning', target, answerTerm: target, prompt: String(item.prompt || `请选择与 ${target} 相符的词。`).slice(0, 180), choices};
  }).filter(Boolean);
}
