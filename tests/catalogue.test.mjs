import test from 'node:test';
import assert from 'node:assert/strict';
import {appendImportedCatalogue, createImportedCatalogue, resolveCatalogue} from '../app/catalogue.js';
import {parseVocabularyText} from '../app/pdf-import.js';

test('confirming the draft creates an active catalogue with imported words and local semantic relations', () => {
  const draft = parseVocabularyText('competition n. 竞争；比赛\nrace n. 比赛；竞赛');
  const imported = createImportedCatalogue(draft, 'Test Book');
  const builtIn = {words: [{term: 'sample'}], relations: [], title: 'Built in'};
  assert.equal(resolveCatalogue(imported, builtIn), imported);
  assert.deepEqual(imported.words.map((word) => word.term), ['competition', 'race']);
  assert.equal(imported.relations.length, 1);
  assert.equal(imported.title, 'Test Book');
});

test('a cancelled draft leaves the built-in catalogue active; restore resolves to the same catalogue', () => {
  const builtIn = {words: [{term: 'sample'}], relations: [{source: 'sample', target: 'specimen'}], title: 'Built in'};
  const unconfirmedDraft = parseVocabularyText('competition n. 竞争；比赛');
  assert.equal(resolveCatalogue(null, builtIn), builtIn);
  assert.equal(resolveCatalogue(null, builtIn).words.length, 1);
  assert.equal(unconfirmedDraft.length, 1);
});

test('refuses to activate an empty catalogue', () => {
  assert.throws(() => createImportedCatalogue([], 'Empty'), /没有可导入/);
});

test('review edits update classification and reject duplicate or invalid headwords', () => {
  const [word] = parseVocabularyText('river n. 河流');
  const catalogue = createImportedCatalogue([{...word, term: 'market', chinese: '市场', definition: '市场'}], 'Edited');
  assert.equal(catalogue.words[0].galaxy, 'economy');
  assert.throws(() => createImportedCatalogue([{...word, term: ''}], 'Bad'), /英文单词/);
  assert.throws(() => createImportedCatalogue([word, {...word}], 'Bad'), /重复/);
});

test('appends a second page range while retaining the first batch and updating overlaps', () => {
  const first = createImportedCatalogue(parseVocabularyText('apple n. 苹果'), 'Wordbook');
  const second = parseVocabularyText('banana n. 香蕉\napple n. 苹果；水果');
  const combined = appendImportedCatalogue(first, second);
  assert.equal(combined.title, 'Wordbook');
  assert.deepEqual(combined.words.map((word) => word.term), ['apple', 'banana']);
  assert.equal(combined.words[0].definition, '苹果；水果');
});

test('uses source PDF section themes for imported galaxy labels', () => {
  const words = parseVocabularyText('Unit 01｜高频基础\n1 be aux. 是；在；做\nUnit 09｜常见动作与表达\n2 move v. 移动');
  const imported = createImportedCatalogue(words, 'CET4词汇书');
  assert.equal(imported.categoryMode, 'section');
  assert.equal(imported.categoryLabels[imported.words[0].galaxy].labelZh, '高频基础');
  assert.equal(imported.categoryLabels[imported.words[1].galaxy].labelZh, '常见动作与表达');
  assert.notEqual(imported.words[0].galaxy, imported.words[1].galaxy);
});
