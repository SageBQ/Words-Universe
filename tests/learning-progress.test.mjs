import test from 'node:test';
import assert from 'node:assert/strict';
import {answerProgress, getDueTerms, markErrorCause, readProgress, writeProgress} from '../app/learning-progress.js';

const storage = new Map();
const fakeStorage = {getItem:key => storage.get(key) || null, setItem:(key,value) => storage.set(key,value), removeItem:key => storage.delete(key)};

test('wrong answers become due and correct streaks increase the review interval', () => {
  const now = Date.UTC(2026, 10, 2, 8);
  const wrong = answerProgress({}, 'abandon', false, now);
  assert.equal(getDueTerms(wrong, now).includes('abandon'), true);
  const correct = answerProgress(wrong, 'abandon', true, now + 1000);
  assert.equal(correct.abandon.attempts, 2);
  assert.equal(correct.abandon.correct, 1);
  assert.ok(correct.abandon.nextReviewAt > now + 1000);
});

test('learning records persist while API keys are never part of the saved shape', () => {
  const record = answerProgress({}, 'common', true, 100);
  writeProgress(record, fakeStorage);
  assert.deepEqual(readProgress(fakeStorage), record);
  assert.equal(JSON.stringify(record).includes('apiKey'), false);
});

test('specific confusion causes are kept and prioritized in the due route', () => {
  const now=Date.UTC(2026,10,2,8);
  const first=answerProgress({},'economic',false,now);
  const second=markErrorCause(first,'economical','synonym',now);
  const third=markErrorCause(second,'economical','synonym',now);
  assert.equal(third.economical.errorCauses.synonym,2);
  assert.deepEqual(getDueTerms(third,now),['economical','economic']);
  assert.equal(answerProgress(third,'economical',true,now).economical.errorCauses.synonym,2);
});
