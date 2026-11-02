import test from 'node:test';
import assert from 'node:assert/strict';
import { createPdfReader } from '../app/pdf-reader.js';
import { parseVocabularyText } from '../app/pdf-import.js';

function fakePdfjs(pages) {
  return {
    getDocument({data}) {
      assert.ok(data instanceof Uint8Array);
      return {promise: Promise.resolve({
        numPages: pages.length,
        async getPage(number) {
          const page = pages[number - 1];
          return {
            async getTextContent() { return {items: page.items || (page.text || '').split(/\s+/).filter(Boolean).map((str, index) => ({str, transform: [1, 0, 0, 1, index * 20, 100]}))}; },
            getViewport({scale}) { return {width: 100 * scale, height: 120 * scale}; },
          };
        },
        async destroy() {},
      })};
    },
  };
}

test('extracts text-layer content and source page mapping without starting OCR', async () => {
  let ocrStarted = false;
  const read = createPdfReader({
    pdfjs: fakePdfjs([{text: 'abandon vt. 放弃；遗弃'}]),
    createOcrWorker: async () => { ocrStarted = true; throw new Error('unexpected OCR'); },
    renderPageToCanvas: async () => {},
    textThreshold: 5,
  });
  const result = await read(new Blob(['%PDF-1.4'], {type: 'application/pdf'}));
  assert.equal(result.text, 'abandon vt. 放弃；遗弃');
  assert.equal(result.pageCount, 1);
  assert.deepEqual(result.ocrPages, []);
  assert.equal(ocrStarted, false);
});

test('preserves line boundaries when PDF text items are positioned on separate rows', async () => {
  const row = (str, x, y) => ({str, transform: [1, 0, 0, 1, x, y]});
  const read = createPdfReader({
    pdfjs: fakePdfjs([{items: [row('ability', 10, 100), row('n.', 90, 100), row('能力；本领', 120, 100), row('abnormal', 10, 80), row('a.', 90, 80), row('反常的；不正常的', 120, 80)]}]),
    createOcrWorker: async () => { throw new Error('unexpected OCR'); },
    renderPageToCanvas: async () => {},
    textThreshold: 5,
  });
  const result = await read(new Blob(['%PDF-1.4'], {type: 'application/pdf'}));
  assert.equal(result.pageTexts[0].text.split('\n').length, 2);
  assert.equal(result.sourcePages.get('ability'), 1);
  assert.equal(result.sourcePages.get('abnormal'), 1);
});

test('keeps side-by-side vocabulary entries on separate lines', async () => {
  const row = (str, x, y, width) => ({str, width, transform: [1, 0, 0, 1, x, y]});
  const items = [
    row('apple', 10, 100, 30), row('n. 苹果', 55, 100, 45),
    row('banana', 300, 100, 40), row('n. 香蕉', 350, 100, 45),
    row('river', 10, 80, 30), row('n. 河流', 55, 80, 45),
    row('forest', 300, 80, 40), row('n. 森林', 350, 80, 45),
  ];
  const read = createPdfReader({pdfjs: fakePdfjs([{items}]), createOcrWorker: async () => {throw Error('unexpected OCR');}, renderPageToCanvas: async () => {}, textThreshold: 5});
  const result = await read(new Blob(['%PDF-1.4'], {type: 'application/pdf'}));
  assert.deepEqual(result.text.split('\n'), ['apple n. 苹果', 'banana n. 香蕉', 'river n. 河流', 'forest n. 森林']);
  assert.equal(result.sourcePages.get('banana'), 1);
});

test('sorts text by column after clustering slightly offset PDF baselines', async () => {
  const item = (str, x, y, width=20) => ({str, width, transform:[1,0,0,1,x,y]});
  const items = [item('1',57,709.4,4),item(' ',61,709.4,20),item('be',81,708.9,10),item(' ',91,708.9,110),item('aux. 是；在；做',200,709.3,69),item('A+',530,709.4,9)];
  const read = createPdfReader({pdfjs:fakePdfjs([{items}]),createOcrWorker:async()=>{throw Error('unexpected OCR');},renderPageToCanvas:async()=>{},textThreshold:5});
  const result = await read(new Blob(['%PDF-1.4'],{type:'application/pdf'}));
  assert.equal(result.text, '1 be aux. 是；在；做 A+');
  assert.equal(result.sourcePages.get('be'), 1);
});

test('reassembles numbered table rows and preserves unmatched graded rows', async () => {
  const item = (str, x, y, width=20) => ({str, width, transform:[1,0,0,1,x,y]});
  const items = [];
  for (const [index, term, gloss] of [[1,'be','aux. 是'],[2,'day','n. 天'],[3,'man','n. 男人'],[4,'find','v. 找到'],[5,'give','v. 给予'],[6,'more',null]]) {
    const y = 700 - index * 30;
    items.push(item(String(index),57,y,5),item(term,82,y-.5,28),item('A+',530,y,10));
    if (gloss) items.push(item(gloss,200,y-.1,60));
    else items.push(item('adj. 更多的',200,y+7,65),item('adv. 更',200,y-7,45));
  }
  items.push(item('7',57,470,5),item('repair',190,470,35),item('v. 修理',260,470,45),item('A+',530,470,10));
  const read = createPdfReader({pdfjs:fakePdfjs([{items}]),createOcrWorker:async()=>{throw Error('unexpected OCR');},renderPageToCanvas:async()=>{},textThreshold:5});
  const result = await read(new Blob(['%PDF-1.4'],{type:'application/pdf'}));
  assert.equal(result.text.split('\n').length, 7);
  assert.match(result.text, /6 more adj\. 更多的 adv\. 更/);
  assert.match(result.text, /7 repair v\. 修理 A\+/);
  assert.equal(result.sourcePages.get('more'), 1);
  assert.equal(result.sourcePages.get('repair'), 1);
});

test('keeps a new unit heading between the table rows it separates', async () => {
  const item = (str,x,y) => ({str,width:30,transform:[1,0,0,1,x,y]});
  const items=[item('Unit 01｜高频基础',80,740),item('Unit 02｜常见动作与表达',80,590)];
  const terms=['apple','banana','candle','dance','eager','forest'];
  for(let i=1;i<=6;i++){
    const y=720-i*40;
    items.push(item(String(i),57,y),item(terms[i-1],82,y-.4),item(`n. 含义${i}`,200,y),item('A+',530,y));
  }
  const read=createPdfReader({pdfjs:fakePdfjs([{items}]),createOcrWorker:async()=>{throw Error('unexpected OCR');},renderPageToCanvas:async()=>{},textThreshold:5});
  const result=await read(new Blob(['%PDF-1.4'],{type:'application/pdf'}));
  const parsed=parseVocabularyText(result.text);
  assert.deepEqual(parsed.map(word=>word.section),['高频基础','高频基础','高频基础','常见动作与表达','常见动作与表达','常见动作与表达']);
});

test('OCRs sparse pages using one sequential worker and reports page progress', async () => {
  const calls = [];
  let workerCount = 0;
  const read = createPdfReader({
    pdfjs: fakePdfjs([{text: 'a'}, {text: 'b'}]),
    createOcrWorker: async () => {
      workerCount++;
      return {recognize: async (canvas) => {
        calls.push(canvas.page);
        return {data: {text: `${canvas.page === 1 ? 'alpha' : 'beta'} n. 单词${canvas.page}`}};
      }, terminate: async () => calls.push('terminated')};
    },
    renderPageToCanvas: async (_page, pageNumber) => ({page: pageNumber}),
    textThreshold: 12,
  });
  const progress = [];
  const result = await read(new Blob(['%PDF-1.4'], {type: 'application/pdf'}), {onProgress: (value) => progress.push(value)});
  assert.equal(workerCount, 1);
  assert.deepEqual(calls, [1, 2, 'terminated']);
  assert.deepEqual(result.ocrPages, [1, 2]);
  assert.match(result.text, /alpha n\. 单词1/);
  assert.equal(result.sourcePages.get('beta'), 2);
  assert.ok(progress.some(({phase}) => phase === 'ocr'));
});

test('OCRs dense text layers when Chinese definitions decode as replacement characters', async () => {
  let ocrCount = 0;
  const corrupted = '1 apple n. ������������\n2 banana n. ������������';
  const read = createPdfReader({
    pdfjs: fakePdfjs([{items: [{str: corrupted, transform: [1,0,0,1,10,100]}]}]),
    createOcrWorker: async () => ({recognize: async () => {ocrCount++; return {data: {text:'apple n. 苹果\nbanana n. 香蕉'}};}, terminate: async () => {}}),
    renderPageToCanvas: async () => ({}),
  });
  const result = await read(new Blob(['%PDF-1.4'], {type:'application/pdf'}));
  assert.equal(ocrCount, 1);
  assert.equal(result.sourcePages.get('banana'), 1);
});

test('rejects unsupported files but reads every requested page without a fixed page cap', async () => {
  const read = createPdfReader({pdfjs: fakePdfjs(Array.from({length: 3}, () => ({text: 'ability n. 能力；本领；才能；足够长的词条文字层内容'}))), createOcrWorker: async () => {}, renderPageToCanvas: async () => {}});
  await assert.rejects(read(new Blob(['x'], {type: 'text/plain'})), /PDF/);
  const result = await read(new Blob(['%PDF-1.4'], {type: 'application/pdf'}));
  assert.deepEqual(result.range, {from: 1, to: 3});
});

test('honors cancellation and always releases PDF and OCR resources', async () => {
  let destroyed = false;
  let terminated = false;
  const pdfjs = fakePdfjs([{text: 'x'}]);
  const originalGetDocument = pdfjs.getDocument;
  pdfjs.getDocument = (options) => {
    const task = originalGetDocument(options);
    task.promise = task.promise.then((doc) => { doc.destroy = async () => { destroyed = true; }; return doc; });
    return task;
  };
  const read = createPdfReader({pdfjs, createOcrWorker: async () => ({recognize: async () => ({data: {text: 'ignored'}}), terminate: async () => {terminated = true;}}), renderPageToCanvas: async () => {}, textThreshold: 20});
  await assert.rejects(read(new Blob(['%PDF-1.4'], {type: 'application/pdf'}), {shouldCancel: () => true}), /已取消/);
  assert.equal(destroyed, true);
  assert.equal(terminated, false);
});
