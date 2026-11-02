import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePdfText,
  parseVocabularyText,
  assignGalaxy,
  buildImportedRelations,
} from '../app/pdf-import.js';

test('normalizePdfText joins words split by a PDF line-end hyphen', () => {
  assert.equal(normalizePdfText('inter-\nnational'), 'international');
});

test('parseVocabularyText extracts headword, part of speech, Chinese gloss and page', () => {
  const [word] = parseVocabularyText('abandon vt. 放弃；遗弃', new Map([['abandon', 3]]));
  assert.equal(word.term, 'abandon');
  assert.equal(word.partOfSpeech, 'vt.');
  assert.equal(word.chinese, '放弃；遗弃');
  assert.equal(word.sourcePage, 3);
  assert.equal(word.etymology, '原 PDF 未提供词源信息。');
  assert.equal(word.memoryStory, '原 PDF 未提供记忆故事。');
});

test('parses compact dictionary POS formatting without requiring a space before Chinese', () => {
  const [word] = parseVocabularyText('able a.有能力的；能干的\nabide vi.(by)遵守；坚持');
  assert.equal(word.term, 'able');
  assert.equal(word.partOfSpeech, 'a.');
  assert.equal(word.chinese, '有能力的；能干的');
});

test('parses numbered vocabulary table rows and drops frequency grades', () => {
  const words = parseVocabularyText('1 be aux. 是；在；做 A+\n2 being n. 存在；生物；生命 A+');
  assert.deepEqual(words.map((word) => word.term), ['be', 'being']);
  assert.equal(words[0].chinese, '是；在；做');
});

test('uses PDF unit headings as section provenance without inventing a unit word', () => {
  const words = parseVocabularyText('Unit 01｜高频基础\n1 be aux. 是；在；做\nUnit 09｜常见动作与表达\n2 move v. 移动');
  assert.deepEqual(words.map((word) => word.term), ['be', 'move']);
  assert.deepEqual(words.map((word) => word.section), ['高频基础', '常见动作与表达']);
});

test('parseVocabularyText removes duplicate headwords without losing first gloss', () => {
  const words = parseVocabularyText('apple n. 苹果\napple n. 苹果树');
  assert.equal(words.length, 1);
  assert.equal(words[0].chinese, '苹果');
});

test('assignGalaxy classifies glossary text about law into the economy galaxy', () => {
  assert.equal(assignGalaxy('法律；法院；法规'), 'economy');
});

test('buildImportedRelations emits one undirected heuristic edge for shared gloss terms', () => {
  const words = parseVocabularyText('competition n. 竞争；比赛\nrace n. 比赛；竞赛');
  const edges = buildImportedRelations(words);
  assert.equal(edges.length, 1);
  assert.deepEqual([edges[0].source, edges[0].target], ['competition', 'race']);
  assert.match(edges[0].reason, /辅助|规则/);
});

test('parseVocabularyText ignores empty and unrelated prose', () => {
  assert.deepEqual(parseVocabularyText(''), []);
  assert.deepEqual(parseVocabularyText('Chapter One\nThis book is arranged alphabetically.'), []);
});
