export const AI_PRESETS = {
  deepseek: {label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', authType: 'bearer'},
  qwen: {label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', authType: 'bearer'},
  zhipu: {label: '智谱', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.3-flash', authType: 'bearer'},
  custom: {label: '自定义模型／代理', baseUrl: '', model: '', authType: 'bearer'},
};

export function buildChatRequest(config, messages) {
  const baseUrl = String(config.baseUrl || '').replace(/\/+$/, '');
  if (!baseUrl) throw new Error('请填写 Base URL。');
  if (!config.model?.trim()) throw new Error('请填写模型名称。');
  const headers = {'Content-Type': 'application/json'};
  if (config.authType === 'bearer' && config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  if (config.authType === 'x-api-key' && config.apiKey) headers['X-API-Key'] = config.apiKey;
  return {url: `${baseUrl}/chat/completions`, headers, body: {model: config.model.trim(), messages, temperature: 0.3, response_format: {type: 'json_object'}}};
}

export function classifyAiError(error) {
  if (error?.status === 401 || error?.status === 403) return '密钥无效、无权限，或认证方式不正确。';
  if (error?.status === 429) return '服务商正在限流或余额不足，请稍后再试。';
  if (error?.status === 404) return '模型或接口地址不可用，请核对高级设置。';
  if (error?.status >= 500) return '服务商暂时不可用，请稍后再试。';
  if (error instanceof TypeError || /fetch|network|cors/i.test(String(error?.message || error))) return '浏览器无法直接访问该接口（可能是网络或跨域限制）。请改用支持浏览器调用的兼容代理。';
  return String(error?.message || 'AI 请求未完成，请检查配置后重试。');
}

function extractJson(text) {
  const raw = String(text || '').trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(raw);
}

export async function requestAiJson(config, messages, fetchImpl = fetch) {
  const request = buildChatRequest(config, messages);
  const response = await fetchImpl(request.url, {method: 'POST', headers: request.headers, body: JSON.stringify(request.body)});
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), {status: response.status});
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error('服务未返回可用内容。');
  return extractJson(content);
}

export function sanitizeSuggestion(value, localTerms) {
  const text = (input, limit = 220) => String(input || '').replace(/[<>]/g, '').trim().slice(0, limit);
  const relations = Array.isArray(value?.relations) ? value.relations.map(term => String(term).toLowerCase().trim()).filter(term => localTerms.has(term)).slice(0, 3) : [];
  return {definition: text(value?.definition), etymologyHint: text(value?.etymologyHint), memoryStory: text(value?.memoryStory), galaxy: text(value?.galaxy, 40), relations: [...new Set(relations)]};
}

export async function testAiConnection(config, fetchImpl = fetch) {
  await requestAiJson(config, [{role: 'system', content: 'Return JSON only: {"ok":true}.'}, {role: 'user', content: 'ping'}], fetchImpl);
  return true;
}

export async function generateWordSuggestion(config, word, candidateTerms, fetchImpl = fetch) {
  const result = await requestAiJson(config, [
    {role: 'system', content: 'You are a careful English vocabulary tutor. Return JSON only with definition, etymologyHint, memoryStory, galaxy, relations. relations must use only exact candidates supplied by the user; at most 3. Do not invent facts.'},
    {role: 'user', content: JSON.stringify({word: {term: word.term, definition: word.definition, chinese: word.chinese, morphemes: word.morphemes}, candidateTerms})},
  ], fetchImpl);
  return sanitizeSuggestion(result, new Set(candidateTerms.map(term => term.toLowerCase())));
}

export async function reviewImportedWords(config, words, fetchImpl = fetch) {
  if (!Array.isArray(words) || !words.length || words.length > 10) throw new Error('每次请勾选 1–10 个词条进行 AI 校对。');
  const result = await requestAiJson(config, [
    {role: 'system', content: 'You review OCR-extracted English vocabulary. Return JSON only: {"items":[{"term":"exact submitted term","definition":"concise Chinese gloss","theme":"short theme","note":"possible OCR issue or empty"}]}. Never add items.'},
    {role: 'user', content: JSON.stringify(words.map(word => ({term: word.term, definition: word.definition, sourcePage: word.sourcePage})))},
  ], fetchImpl);
  const source = new Set(words.map(word => String(word.term).toLowerCase()));
  return Array.isArray(result?.items) ? result.items.filter(item => source.has(String(item?.term).toLowerCase())).slice(0, words.length).map(item => ({term: String(item.term).toLowerCase(), definition: String(item.definition || '').slice(0, 180), theme: String(item.theme || '').slice(0, 40), note: String(item.note || '').slice(0, 160)})) : [];
}

export async function generateQuiz(config, words, fetchImpl = fetch) {
  const candidates = words.slice(0, 12).map(word => ({term: word.term, chinese: word.chinese, definition: word.definition, morphemes: word.morphemes}));
  const result = await requestAiJson(config, [
    {role: 'system', content: 'Return JSON only: {"questions":[{"type":"meaning|recall|synonym|morpheme|memory","target":"exact candidate term","prompt":"Chinese learning question","choices":["exact candidate term"]}]}. Create at most 5 questions. target and every choice must exactly use supplied candidate terms. Never provide answer keys.'},
    {role: 'user', content: JSON.stringify({candidates})},
  ], fetchImpl);
  return result?.questions;
}
