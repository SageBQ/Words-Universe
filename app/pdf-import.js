export const GALAXIES = [
  'society', 'mind', 'emotion', 'nature', 'science', 'language',
  'action', 'material', 'time', 'life', 'economy', 'culture',
];

const CLASSIFIERS = [
  ['economy', /经济|金融|贸易|商业|公司|市场|货币|银行|法律|法庭|犯罪|政府|政治|行政|税|管理|权利|义务/],
  ['science', /科学|技术|计算机|数据|机器|机械|电子|电力|物理|化学|实验|研究|工程|网络|设备|仪器/],
  ['nature', /自然|动物|植物|森林|海洋|河流|山|天气|气候|地球|宇宙|星|太阳|月亮|环境|农业|矿物/],
  ['life', /身体|医学|疾病|病|健康|治疗|医院|器官|食物|饮食|衣服|家庭|住宅|睡眠|运动|肌肉/],
  ['emotion', /情感|感情|情绪|高兴|快乐|悲伤|痛苦|害怕|恐惧|愤怒|焦虑|喜欢|爱慕|渴望|性格|勇敢|信任/],
  ['language', /语言|单词|词语|语法|句子|说话|讲话|阅读|写作|翻译|教育|学习|知识|学校|大学|考试|书|文章/],
  ['culture', /文化|艺术|音乐|电影|戏剧|绘画|宗教|历史|传统|风俗|节日|文学|诗|美学|博物馆/],
  ['time', /时间|时期|时代|年代|世纪|年|月|星期|小时|分钟|空间|位置|方向|距离|长度|数量|程度|比例|速度/],
  ['material', /材料|物质|金属|木材|工具|器具|家具|建筑|房屋|容器|衣物|机器|车辆|船|飞机|道路|武器/],
  ['society', /社会|人们|人类|个人|男人|女人|儿童|朋友|同事|成员|团体|组织|社区|民族|国家|公共|关系|职业/],
  ['mind', /思想|思维|观点|观念|意识|精神|理论|原则|原因|判断|理解|记忆|想象|意义|真理|方法/],
];

const POS_CODES = 'prep|pron|conj|adj|adv|aux|abbr|phr|num|art|int|vt|vi|ad|a|n|v';
const POS_PATTERN = new RegExp(`^(?:(?:${POS_CODES})(?:\\.)?)(?:\\s*[,/&]\\s*(?:(?:${POS_CODES})(?:\\.)?))*$`, 'i');
const VISUALS = ['nebula', 'binary', 'wireframe', 'glass', 'rock', 'energy', 'ringed', 'crystal', 'ocean', 'comet'];
const STOP_WORDS = new Set('一种 一般 主要 通常 某种 有关 方面 东西 事物 事情 状态 行为 过程 程度 方式 方法 作用 情况 表示 用于 进行 具有 成为 其他 等等 以及 或者 可以 能够 自己 本身 某人 某物'.split(' '));

function hash(value) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

export function normalizePdfText(text) {
  return String(text ?? '')
    .replace(/\u00ad/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/([A-Za-z])[-‐]\s*\n\s*(?=[A-Za-z])/g, '$1')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/[\t\u00a0]+/g, ' ');
}

export function assignGalaxy(chinese, partOfSpeech = '') {
  for (const [galaxy, pattern] of CLASSIFIERS) if (pattern.test(chinese)) return galaxy;
  if (/^(?:v|vi|vt)\.?$/i.test(partOfSpeech)) return 'action';
  return GALAXIES[hash(chinese || 'mind') % GALAXIES.length];
}

function parseLine(rawLine) {
  const line = rawLine
    .replace(/^\s*(?:(?:\d+)(?:[.)、:]|\s+)\s*|[•▪●]\s*)/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!line || !/[\u3400-\u9fff]/.test(line)) return null;

  const match = line.match(/^([A-Za-z][A-Za-z'’\-]*(?:\s+[A-Za-z][A-Za-z'’\-]*){0,2})\s+(.+)$/);
  if (!match) return null;
  const term = match[1].toLowerCase().replace(/[’]/g, "'").trim();
  let remainder = match[2].trim();
  let partOfSpeech = '词性未提供';
  const posMatch = remainder.match(new RegExp(`^((?:(?:${POS_CODES})(?:\\.)?)(?:\\s*[,/&]\\s*(?:(?:${POS_CODES})(?:\\.)?))*)\\s*(.+)$`, 'i'));
  if (posMatch && POS_PATTERN.test(posMatch[1])) {
    partOfSpeech = posMatch[1].toLowerCase().replace(/\s+/g, '');
    remainder = posMatch[2].trim();
  }
  const chinese = remainder
    .replace(/^[\s:：.。·•-]+/, '')
    .replace(/\s+(?:A\+?|B|C)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!chinese || !/[\u3400-\u9fff]/.test(chinese)) return null;
  return {term, chinese, partOfSpeech};
}

function pageFor(sourcePages, term) {
  if (sourcePages instanceof Map) return sourcePages.get(term);
  if (sourcePages && typeof sourcePages === 'object') return sourcePages[term];
  return undefined;
}

export function parseVocabularyText(text, sourcePages) {
  const normalized = normalizePdfText(text);
  const entries = new Map();
  let section = '';
  for (const line of normalized.split(/\n+/)) {
    const heading = line.match(/^\s*Unit\s*\d+\s*[|｜:：—-]?\s*(.+)$/i);
    if (heading) {
      const title = heading[1].trim();
      if (/[\u3400-\u9fff]/.test(title)) section = title.replace(/\s+\d+\s*词\s*$/, '').trim();
      continue;
    }
    const parsed = parseLine(line);
    if (!parsed || entries.has(parsed.term)) continue;
    const galaxy = assignGalaxy(parsed.chinese, parsed.partOfSpeech);
    const word = {
      ...parsed,
      definition: parsed.chinese,
      morphemes: [],
      etymology: '原 PDF 未提供词源信息。',
      memoryStory: '原 PDF 未提供记忆故事。',
      galaxy,
      visual: VISUALS[hash(parsed.term) % VISUALS.length],
      sources: [],
      sourceType: 'imported',
    };
    if (section) word.section = section;
    const sourcePage = pageFor(sourcePages, parsed.term);
    if (Number.isInteger(sourcePage) && sourcePage > 0) word.sourcePage = sourcePage;
    entries.set(parsed.term, word);
  }
  return [...entries.values()];
}

function keywords(chinese) {
  return [...new Set(chinese
    .replace(/[\[\]()（）“”"']/g, ' ')
    .split(/[；;，,、。:：/\s]+/)
    .map((part) => part.replace(/^[的地得把被将向于从在对与和或及为有无使可]+/, '').replace(/[的地得着了者物人]+$/, '').trim())
    .filter((part) => part.length >= 2 && part.length <= 8 && !STOP_WORDS.has(part)))];
}

export function buildImportedRelations(words) {
  const postings = new Map();
  const byTerm = new Map(words.map((word) => [word.term, word]));
  for (const word of words) {
    for (const keyword of keywords(word.chinese)) postings.set(keyword, [...(postings.get(keyword) || []), word.term]);
  }

  const overlap = new Map();
  for (const [keyword, terms] of postings) {
    if (terms.length < 2 || terms.length > 40) continue;
    for (let i = 0; i < terms.length; i++) {
      for (let j = i + 1; j < terms.length; j++) {
        const left = byTerm.get(terms[i]);
        const right = byTerm.get(terms[j]);
        if (left.partOfSpeech !== right.partOfSpeech) continue;
        const [source, target] = [left.term, right.term].sort();
        const key = `${source}\u0000${target}`;
        const shared = overlap.get(key) || {source, target, shared: new Set()};
        shared.shared.add(keyword);
        overlap.set(key, shared);
      }
    }
  }

  const ranked = [...overlap.values()]
    .map((edge) => ({...edge, score: edge.shared.size}))
    .filter((edge) => edge.score > 0)
    .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
  const degree = new Map();
  const result = [];
  for (const edge of ranked) {
    if ((degree.get(edge.source) || 0) >= 4 || (degree.get(edge.target) || 0) >= 4) continue;
    const shared = [...edge.shared].sort((a, b) => b.length - a.length).slice(0, 3);
    result.push({
      source: edge.source,
      target: edge.target,
      weight: Math.max(2, Math.min(5, 2 + edge.score)),
      reason: `本地规则生成的近义候选，共同释义：${shared.join('、')}；仅供辅助探索，并非词典审定关系。`,
    });
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  }
  return result;
}
