import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalQuiz, validateAiQuiz} from '../app/ai-quiz.js';

const words = [
  {term:'common',definition:'共同的；普通的',chinese:'共同的；普通的'},
  {term:'ordinary',definition:'普通的',chinese:'普通的'},
  {term:'rare',definition:'稀有的',chinese:'稀有的'},
  {term:'share',definition:'分享；共同使用',chinese:'分享；共同使用'},
];

test('local quiz always derives answer keys from local vocabulary', () => {
  const quiz = createLocalQuiz(words, 3);
  assert.equal(quiz.length, 3);
  assert.ok(quiz.every(question => words.some(word => word.term === question.answerTerm)));
});

test('AI quiz validation ignores model-supplied answers and accepts only local terms', () => {
  const quiz = validateAiQuiz([{type:'meaning',target:'common',prompt:'选择 common 的释义',choices:['ordinary','rare']}], words);
  assert.equal(quiz[0].answerTerm, 'common');
  assert.deepEqual(quiz[0].choices.includes('common'), true);
});
