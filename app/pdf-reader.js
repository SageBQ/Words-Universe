const DEFAULT_TEXT_THRESHOLD = 18;

function needsOcr(text, threshold) {
  if (text.replace(/\s/g, '').length < threshold) return true;
  const replacement = (text.match(/\uFFFD/g) || []).length;
  const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
  return replacement >= 8 && replacement > chinese * 0.4;
}

/** @typedef {{phase:string,page:number,total:number,completed:number,percent:number}} PdfProgress */

function extractText(items) {
  const ordered = items.filter((item) => item.str?.trim()).map((item, index) => ({
    text: item.str.trim(),
    x: item.transform?.[4] ?? 0,
    y: item.transform?.[5] ?? -index,
    width: item.width ?? item.str.length * 5,
    index,
  })).sort((a, b) => b.y - a.y || a.index - b.index);
  const rows = [];
  for (const item of ordered) {
    let row = rows.at(-1);
    if (!row || Math.abs(row.y - item.y) > 2.5) rows.push(row = {y: item.y, items: []});
    row.items.push(item);
  }
  const lines = [];
  for (const row of rows) {
    let line = null;
    for (const item of row.items.sort((a, b) => a.x - b.x || a.index - b.index)) {
      const startsAnotherEntry = line && /[\u3400-\u9fff]/.test(line.text)
        && /^[A-Za-z][A-Za-z'’-]*(?:\s|$)/.test(item.text)
        && item.x - line.lastEnd > 35;
      if (!line || startsAnotherEntry) lines.push(line = {text: '', lastEnd: item.x, y: row.y, x: item.x});
      line.text += `${line.text ? ' ' : ''}${item.text}`;
      line.lastEnd = item.x + item.width;
    }
  }
  const generalText = lines.map((line) => line.text.trim()).filter(Boolean).join('\n').replace(/[\t\u00a0]+/g, ' ').trim();
  const numberColumns = new Map();
  for (const item of ordered) {
    if (!/^\d{1,3}$/.test(item.text) || item.x > 150) continue;
    const column = Math.round(item.x / 15);
    numberColumns.set(column, [...(numberColumns.get(column) || []), item]);
  }
  const labels = [...numberColumns.values()].sort((a, b) => b.length - a.length)[0];
  if (!labels || labels.length < 6) return generalText;
  labels.sort((a, b) => b.y - a.y);
  const numberX = labels[0].x;
  const grades = ordered.filter(item => item.x > numberX + 200 && /^(?:A\+?|B|C)$/.test(item.text));
  if (grades.length < labels.length * 0.6) return generalText;
  const gradePositions = grades.map(item => item.x).sort((a, b) => a - b);
  const gradeX = gradePositions[Math.floor(gradePositions.length / 2)];
  const rightEdge = gradeX - 15;
  const tableRows = [];
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const upper = i ? (labels[i - 1].y + label.y) / 2 : label.y + (label.y - labels[1].y) / 2;
    const lower = i < labels.length - 1 ? (label.y + labels[i + 1].y) / 2 : label.y - (labels[i - 1].y - label.y) / 2;
    const cells = ordered.filter(item => item.y < upper && item.y >= lower && item.x > numberX + 10 && item.x < rightEdge && !/^(?:Phoenix|International|Education)(?:\s+(?:International|Education))*$/i.test(item.text));
    const headword = cells.find(item => item.x < numberX + 130 && /^[A-Za-z][A-Za-z'’\-]*(?:\s+[A-Za-z][A-Za-z'’\-]*){0,2}$/.test(item.text));
    if (!headword) continue;
    const definition = cells.filter(item => item.x > headword.x + 55).sort((a, b) => b.y - a.y || a.x - b.x).map(item => item.text).join(' ').trim();
    if (/[\u3400-\u9fff]/.test(definition)) tableRows.push({y: label.y, x: label.x, upper, lower, text: `${label.text} ${headword.text} ${definition}`});
  }
  if (tableRows.length < Math.max(5, labels.length * 0.55)) return generalText;
  const remaining = lines.filter(line => /^Unit\s*\d+/i.test(line.text)
    || !tableRows.some(tableRow => line.y < tableRow.upper && line.y >= tableRow.lower));
  return [...remaining, ...tableRows]
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map(line => line.text)
    .join('\n');
}

function pageWordMap(text, pageNumber, map) {
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:\d+(?:[.)、:]|\s+)\s*)?([A-Za-z][A-Za-z'’\-]*)\s+.*[\u3400-\u9fff]/i);
    if (match && !map.has(match[1].toLowerCase())) map.set(match[1].toLowerCase(), pageNumber);
  }
}

/** @param {{pdfjs:any,createOcrWorker:()=>Promise<any>,renderPageToCanvas:(page:any,pageNumber:number)=>Promise<any>,textThreshold?:number}} options */
export function createPdfReader({
  pdfjs,
  createOcrWorker,
  renderPageToCanvas,
  textThreshold = DEFAULT_TEXT_THRESHOLD,
}) {
  if (!pdfjs?.getDocument || typeof createOcrWorker !== 'function' || typeof renderPageToCanvas !== 'function') {
    throw new TypeError('PDF 阅读器缺少运行依赖。');
  }

  return async function readVocabularyPdf(file, /** @type {{onProgress?:(value:PdfProgress)=>void,shouldCancel?:()=>boolean,pageRange?:{from:number,to:number}} */ {
    onProgress = () => {},
    shouldCancel = () => false,
    pageRange,
  } = {}) {
    const isPdf = file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
    if (!isPdf) throw new Error('请选择 PDF 格式的词书文件。');
    const data = new Uint8Array(await file.arrayBuffer());
    if (data.length < 5 || new TextDecoder().decode(data.subarray(0, 5)) !== '%PDF-') {
      throw new Error('文件不是有效的 PDF，或文件已损坏。');
    }

    let loadingTask;
    let document;
    let ocrWorker;
    try {
      loadingTask = pdfjs.getDocument({data});
      document = await loadingTask.promise;
      if (!Number.isInteger(document.numPages) || document.numPages < 1) throw new Error('PDF 中没有可读取的页面。');
      const start = Math.max(1, Math.floor(pageRange?.from || 1));
      const end = Math.min(document.numPages, Math.floor(pageRange?.to || document.numPages));
      if (end < start) throw new Error('页码范围无效，请检查起始页与结束页。');
      const pageTexts = [];
      const sourcePages = new Map();
      const ocrPages = [];
      const pageCount = end - start + 1;

      for (let pageNumber = start; pageNumber <= end; pageNumber++) {
        if (shouldCancel()) throw new Error('导入已取消。');
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        let text = extractText(content.items || []);
        const localPageNumber = pageNumber;
        if (needsOcr(text, textThreshold)) {
          onProgress({phase: 'ocr', page: localPageNumber, total: document.numPages, completed: pageNumber - start, percent: Math.round(((pageNumber - start) / pageCount) * 100)});
          if (!ocrWorker) ocrWorker = await createOcrWorker();
          const canvas = await renderPageToCanvas(page, localPageNumber);
          try {
            const result = await ocrWorker.recognize(canvas);
            text = String(result?.data?.text || '').trim();
            ocrPages.push(localPageNumber);
          } finally {
            canvas?.width && (canvas.width = 0);
            canvas?.height && (canvas.height = 0);
          }
        }
        pageTexts.push({page: localPageNumber, text});
        pageWordMap(text, localPageNumber, sourcePages);
        page.cleanup?.();
        onProgress({phase: ocrPages.includes(localPageNumber) ? 'ocr' : 'extract', page: localPageNumber, total: document.numPages, completed: pageNumber - start + 1, percent: Math.round(((pageNumber - start + 1) / pageCount) * 100)});
      }
      return {text: pageTexts.map(({text}) => text).filter(Boolean).join('\n'), pageTexts, pageCount: document.numPages, range: {from: start, to: end}, ocrPages, sourcePages};
    } catch (error) {
      if (error?.name === 'PasswordException') throw new Error('该 PDF 有密码保护，请先在本地解锁后再导入。');
      throw error;
    } finally {
      await ocrWorker?.terminate?.();
      await document?.destroy?.();
      if (!document) await loadingTask?.destroy?.();
    }
  };
}
