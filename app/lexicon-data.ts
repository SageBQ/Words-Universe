import vocabulary from './vocabulary.json';

export type Galaxy = 'society'|'mind'|'emotion'|'nature'|'science'|'language'|'action'|'material'|'time'|'life'|'economy'|'culture';
export type VisualStyle = 'nebula'|'binary'|'wireframe'|'glass'|'rock'|'energy'|'ringed'|'crystal'|'ocean'|'comet';
export type Morpheme = { form:string; gloss:string; kind:'prefix'|'root'|'suffix' };
export type Word = { term:string; chinese:string; partOfSpeech:string; definition:string; morphemes:Morpheme[]; etymology:string; memoryStory:string; galaxy:Galaxy; visual:VisualStyle; sources:{label:string;url:string}[]; sourceType?:'built-in'|'imported'; sourcePage?:number; section?:string };
export type Relation = { source:string; target:string; weight:number; reason:string };

export const galaxyMeta:Record<Galaxy,{label:string;labelZh:string;color:string;center:[number,number]}>= {
 society:{label:'SOCIETY',labelZh:'人与社会',color:'#e1a36e',center:[150,170]},
 mind:{label:'MIND',labelZh:'思维认知',color:'#96a8ed',center:[425,150]},
 emotion:{label:'EMOTION',labelZh:'情感性格',color:'#df82a4',center:[710,165]},
 nature:{label:'NATURE',labelZh:'自然环境',color:'#70c5a8',center:[1000,165]},
 science:{label:'SCIENCE',labelZh:'科学技术',color:'#5fc6df',center:[235,390]},
 language:{label:'LANGUAGE',labelZh:'语言学习',color:'#b994e5',center:[515,360]},
 action:{label:'ACTION',labelZh:'行动变化',color:'#f0bb68',center:[820,390]},
 material:{label:'MATERIAL',labelZh:'物质器物',color:'#ad8e7d',center:[1070,390]},
 time:{label:'TIME',labelZh:'时空数量',color:'#779bd1',center:[160,625]},
 life:{label:'LIFE',labelZh:'生活健康',color:'#df927d',center:[445,610]},
 economy:{label:'ECONOMY',labelZh:'经济法律',color:'#d0b06e',center:[735,620]},
 culture:{label:'CULTURE',labelZh:'文化艺术',color:'#c682d8',center:[1020,620]},
};

const classifiers:Array<[Galaxy,RegExp]> = [
 ['economy',/经济|金融|贸易|商业|公司|市场|货币|银行|法律|法庭|犯罪|政府|政治|行政|税|管理|权利|义务/],
 ['science',/科学|技术|计算机|数据|机器|机械|电子|电力|物理|化学|实验|研究|工程|网络|设备|仪器/],
 ['nature',/自然|动物|植物|森林|海洋|河流|山|天气|气候|地球|宇宙|星|太阳|月亮|环境|农业|矿物/],
 ['life',/身体|医学|疾病|病|健康|治疗|医院|器官|食物|饮食|衣服|家庭|住宅|睡眠|运动|肌肉/],
 ['emotion',/情感|感情|情绪|高兴|快乐|悲伤|痛苦|害怕|恐惧|愤怒|焦虑|喜欢|爱慕|渴望|性格|勇敢|信任/],
 ['language',/语言|单词|词语|语法|句子|说话|讲话|阅读|写作|翻译|教育|学习|知识|学校|大学|考试|书|文章/],
 ['culture',/文化|艺术|音乐|电影|戏剧|绘画|宗教|历史|传统|风俗|节日|文学|诗|美学|博物馆/],
 ['time',/时间|时期|时代|年代|世纪|年|月|星期|小时|分钟|空间|位置|方向|距离|长度|数量|程度|比例|速度/],
 ['material',/材料|物质|金属|木材|工具|器具|家具|建筑|房屋|容器|衣物|机器|车辆|船|飞机|道路|武器/],
 ['society',/社会|人们|人类|个人|男人|女人|儿童|朋友|同事|成员|团体|组织|社区|民族|国家|公共|关系|职业/],
 ['mind',/思想|思维|观点|观念|意识|精神|理论|原则|原因|判断|理解|记忆|想象|意义|真理|方法/],
];

const prefixes:Record<string,string>={anti:'反、抗',auto:'自己',bi:'二、双',co:'共同',com:'共同、完全',con:'共同',de:'向下、除去',dis:'分离、否定',en:'使成为',ex:'向外、以前',extra:'在外、额外',fore:'在前',inter:'在…之间',intra:'在内部',mal:'坏、不良',micro:'微小',mis:'错误',multi:'多',non:'非、不',over:'过度、在上',post:'在后',pre:'在前、预先',re:'再次、向后',semi:'半',sub:'在下、次级',super:'在上、超级',tele:'远距离',trans:'穿越、转变',tri:'三',un:'不、相反',under:'在下、不足'};
const suffixes:Record<string,string>={able:'能够…的',al:'…的',ance:'状态、性质',ence:'状态、性质',ant:'人或事物',ent:'人或性质',ary:'与…有关的',er:'做…的人或物',or:'做…的人或物',ful:'充满…的',hood:'状态、时期',ible:'能够…的',ic:'…的',ical:'…的',ing:'行为或过程',ion:'行为或结果',tion:'行为或结果',ation:'行为或过程',ity:'性质、状态',ive:'有…性质的',ize:'使成为',less:'没有…的',ly:'以…方式',ment:'行为或结果',ness:'性质、状态',ous:'充满…的',ship:'身份、关系',ward:'朝向'};
const special:Record<string,Morpheme[]>={
 astronaut:[{form:'astro',gloss:'星星、太空',kind:'root'},{form:'naut',gloss:'航行者',kind:'root'}],
 biography:[{form:'bio',gloss:'生命',kind:'root'},{form:'graph',gloss:'书写、记录',kind:'root'},{form:'y',gloss:'名词后缀',kind:'suffix'}],
 telephone:[{form:'tele',gloss:'远距离',kind:'prefix'},{form:'phone',gloss:'声音',kind:'root'}],
 microscope:[{form:'micro',gloss:'微小',kind:'prefix'},{form:'scope',gloss:'观察工具',kind:'root'}],
 geography:[{form:'geo',gloss:'地球',kind:'root'},{form:'graph',gloss:'描绘、记录',kind:'root'},{form:'y',gloss:'学科名词后缀',kind:'suffix'}],
 democracy:[{form:'demo',gloss:'人民',kind:'root'},{form:'cracy',gloss:'统治、政体',kind:'root'}],
 transport:[{form:'trans',gloss:'穿越',kind:'prefix'},{form:'port',gloss:'携带、运送',kind:'root'}],
 predict:[{form:'pre',gloss:'预先',kind:'prefix'},{form:'dict',gloss:'说',kind:'root'}],
 contradict:[{form:'contra',gloss:'相反',kind:'prefix'},{form:'dict',gloss:'说',kind:'root'}],
};

const styles:VisualStyle[]=['nebula','binary','wireframe','glass','rock','energy','ringed','crystal','ocean','comet'];
const hash=(value:string)=>{let h=2166136261;for(const char of value)h=Math.imul(h^char.charCodeAt(0),16777619);return h>>>0};
const posOf=(meaning:string)=>meaning.match(/^[A-Za-z.&/]+/)?.[0]||'word';
const definitionOf=(meaning:string)=>meaning.replace(/^[A-Za-z.&/]+\s*/,'').trim()||meaning;

function classify(term:string,meaning:string):Galaxy{
 for(const [galaxy,pattern] of classifiers)if(pattern.test(meaning))return galaxy;
 if(/^(?:v|vi|vt)\./i.test(meaning))return 'action';
 return hash(term)%3===0?'mind':hash(term)%3===1?'society':'material';
}

function analyze(term:string):Morpheme[]{
 if(special[term])return special[term];
 const prefix=Object.keys(prefixes).sort((a,b)=>b.length-a.length).find(p=>term.startsWith(p)&&term.length-p.length>=4);
 const suffix=Object.keys(suffixes).sort((a,b)=>b.length-a.length).find(s=>term.endsWith(s)&&term.length-s.length-(prefix?.length||0)>=3);
 const start=prefix?.length||0,end=suffix?term.length-suffix.length:term.length;
 const result:Morpheme[]=[];
 if(prefix)result.push({form:prefix,gloss:prefixes[prefix],kind:'prefix'});
 result.push({form:term.slice(start,end)||term,gloss:'核心词干',kind:'root'});
 if(suffix)result.push({form:suffix,gloss:suffixes[suffix],kind:'suffix'});
 return result;
}

export const words:Word[]=(vocabulary as Array<{term:string;meaning:string}>).map(({term,meaning})=>{
 const morphemes=analyze(term),definition=definitionOf(meaning),galaxy=classify(term,meaning);
 const pieces=morphemes.map(m=>`${m.form}（${m.gloss}）`).join(' + '),hasStructure=morphemes.length>1;
 return {term,chinese:meaning,partOfSpeech:posOf(meaning),definition,morphemes,
  etymology:hasStructure?`构词线索：${pieces}。该拆解用于理解常见构词成分；完整历史词源可由下方词源词典核验。`:`“${term}”在此作为核心词整体记忆；完整历史演变请参考下方词源词典。`,
  memoryStory:hasStructure?`把 ${term} 想成 ${pieces}：让这些画面共同指向“${definition.slice(0,42)}”。`:`把“${term}”写在一颗星球上，让它反复发出“${definition.slice(0,46)}”这条中文信号。`,
  galaxy,visual:styles[hash(term)%styles.length],sources:[{label:'Etymonline',url:`https://www.etymonline.com/word/${encodeURIComponent(term)}`},{label:'Merriam-Webster',url:`https://www.merriam-webster.com/dictionary/${encodeURIComponent(term)}`}],
 };
});

const semanticStopWords=new Set(['一种','一般','主要','通常','某种','有关','方面','东西','事物','事情','状态','行为','过程','程度','方式','方法','作用','情况','表示','用于','进行','具有','成为','使成','其他','等等','以及','或者','可以','能够','自己','本身','某人','某物']);
const partOfSpeechFamily=(value:string)=>value.toLowerCase().match(/(?:^|\/)(vi|vt|adj|adv|prep|pron|conj|num|ad|n|v|a)/)?.[1]?.replace('vi','v').replace('vt','v').replace('adj','a').replace('adv','ad')||'word';

function semanticGlosses(word:Word){
 const clean=word.definition.replace(/\[[^\]]*\]/g,' ').replace(/\([^)]*\)/g,' ').replace(/[“”"']/g,' ');
 return [...new Set(clean.split(/[；;，,、。:：\/]|\s{2,}/)
  .map(piece=>piece.replace(/^[的地得把被将向于从在对与和或及为有无使可]+/,'').replace(/[的地得着了者物人]+$/,'').trim())
  .flatMap(piece=>piece.match(/[\u3400-\u9fff]{2,8}/g)||[])
  .map(piece=>piece.replace(/^(表示|指|用于|使|把|将)/,'').replace(/(的|地|得)$/,'').trim())
  .filter(piece=>piece.length>=2&&piece.length<=8&&!semanticStopWords.has(piece)))];
}

type Candidate={term:string;score:number;shared:Set<string>};
const glossesByTerm=new Map(words.map(word=>[word.term,semanticGlosses(word)]));
const glossIndex=new Map<string,Word[]>();
for(const word of words)for(const gloss of glossesByTerm.get(word.term)??[])glossIndex.set(gloss,[...(glossIndex.get(gloss)??[]),word]);

const candidates=new Map<string,Map<string,Candidate>>();
for(const [gloss,bucket] of glossIndex){
 if(bucket.length<2||bucket.length>24)continue;
 for(let i=0;i<bucket.length;i++)for(let j=i+1;j<bucket.length;j++){
  const a=bucket[i],b=bucket[j];
  if(partOfSpeechFamily(a.partOfSpeech)!==partOfSpeechFamily(b.partOfSpeech))continue;
  const increment=Math.min(5,gloss.length)+1;
  const add=(from:Word,to:Word)=>{const map=candidates.get(from.term)??new Map<string,Candidate>(),entry=map.get(to.term)??{term:to.term,score:0,shared:new Set<string>()};entry.score+=increment;entry.shared.add(gloss);map.set(to.term,entry);candidates.set(from.term,map)};
  add(a,b);add(b,a);
 }
}

const relationPairs=new Map<string,Relation>();
for(const word of words){
 const ranked=[...(candidates.get(word.term)?.values()??[])].sort((a,b)=>b.score-a.score||a.term.localeCompare(b.term)).slice(0,4);
 for(const candidate of ranked){
  if(candidate.score<3)continue;
  const [source,target]=[word.term,candidate.term].sort(),key=`${source}\u0000${target}`;
  if(relationPairs.has(key))continue;
  const shared=[...candidate.shared].sort((a,b)=>b.length-a.length).slice(0,3);
  const weight=Math.max(2,Math.min(5,2+Math.floor(candidate.score/4)));
  relationPairs.set(key,{source,target,weight,reason:`共同核心释义：${shared.map(value=>`“${value}”`).join('、')}；词性相容，判定为${weight>=4?'高度':''}近义关系。`});
 }
}
export const relations:Relation[]=[...relationPairs.values()];
export const wordByTerm=new Map(words.map(word=>[word.term,word]));
export const galaxyCounts=Object.fromEntries((Object.keys(galaxyMeta) as Galaxy[]).map(g=>[g,words.filter(w=>w.galaxy===g).length])) as Record<Galaxy,number>;
const relationIndex=new Map<string,Relation[]>();
for(const relation of relations){relationIndex.set(relation.source,[...(relationIndex.get(relation.source)??[]),relation]);relationIndex.set(relation.target,[...(relationIndex.get(relation.target)??[]),relation])}
export function neighborsOf(term:string){return relationIndex.get(term)??[]}
export function validateLexicon(){const unique=new Set(words.map(w=>w.term)),relationKeys=new Set(relations.map(r=>`${r.source}\u0000${r.target}`));if(words.length<5000||unique.size!==words.length||words.some(w=>!w.definition||!w.chinese||!w.morphemes.length)||relationKeys.size!==relations.length||relations.some(r=>!unique.has(r.source)||!unique.has(r.target)||!r.reason))throw new Error('Vocabulary data integrity check failed');return{words:words.length,galaxies:Object.keys(galaxyMeta).length,relations:relations.length}}
validateLexicon();
