import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChatRequest, classifyAiError, sanitizeSuggestion} from '../app/ai-client.js';

test('buildChatRequest keeps the API key in headers only and uses the OpenAI-compatible endpoint', () => {
  const request = buildChatRequest({provider:'deepseek',baseUrl:'https://api.deepseek.com',model:'deepseek-flash',authType:'bearer',apiKey:'secret-key'}, [{role:'user',content:'hello'}]);
  assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(request.headers.Authorization, 'Bearer secret-key');
  assert.equal(JSON.stringify(request.body).includes('secret-key'), false);
});

test('classifyAiError gives actionable direct-browser errors', () => {
  assert.match(classifyAiError({status:401}), /密钥/);
  assert.match(classifyAiError({status:429}), /限流/);
  assert.match(classifyAiError(new TypeError('Failed to fetch')), /跨域|网络/);
});

test('sanitizeSuggestion rejects relations outside the local catalogue', () => {
  const result = sanitizeSuggestion({definition:'共同的',memoryStory:'把 common 想成大家共有。',galaxy:'思维认知',relations:['ordinary','not-in-book']}, new Set(['common','ordinary']));
  assert.deepEqual(result.relations, ['ordinary']);
});
