import {GALAXIES, assignGalaxy, buildImportedRelations} from './pdf-import.js';

export function createImportedCatalogue(words, title) {
  if (!Array.isArray(words) || !words.length) throw new Error('没有可导入的词条。');
  const sourceSections = [...new Set(words.map((word) => String(word.section || '').trim()))];
  const useSections = sourceSections.some(Boolean) && sourceSections.length <= GALAXIES.length;
  const sectionSlots = useSections ? new Map(sourceSections.map((section, index) => [section, GALAXIES[index]])) : null;
  const categoryLabels = Object.fromEntries(useSections ? sourceSections.map((section, index) => [GALAXIES[index], {labelZh: section || '未归档', label: 'BOOK SECTION'}]) : []);
  const seen = new Set();
  const reviewed = words.map((word) => {
    const term = String(word.term || '').trim().toLowerCase();
    const chinese = String(word.chinese || word.definition || '').trim();
    if (!/^[a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*){0,2}$/.test(term)) throw new Error('请检查预览区中的英文单词。');
    if (!chinese) throw new Error(`请补全 ${term} 的中文释义。`);
    if (seen.has(term)) throw new Error(`英文单词 ${term} 重复，请删除或修改其中一条。`);
    seen.add(term);
    return {...word, term, chinese, definition: chinese, galaxy: sectionSlots?.get(String(word.section || '').trim()) || assignGalaxy(chinese, word.partOfSpeech)};
  });
  return {words: reviewed, relations: buildImportedRelations(reviewed), title: String(title || '导入的词书'), categoryMode: useSections ? 'section' : 'semantic', categoryLabels};
}

export function appendImportedCatalogue(current, batch) {
  if (!current) return createImportedCatalogue(batch, '导入的词书');
  const validatedBatch = createImportedCatalogue(batch, current.title);
  const merged = new Map(current.words.map((word) => [word.term, word]));
  for (const word of validatedBatch.words) merged.set(word.term, word);
  return createImportedCatalogue([...merged.values()], current.title);
}

export function resolveCatalogue(imported, builtIn) {
  return imported || builtIn;
}
